import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { MessageChannel } from 'node:worker_threads';

const { createRandomIsolationInput } = await import('./lib/run-random-isolation-match.mjs');
const { createSimulationRunInput, prepareSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { createInitialSimulationFrame, SIMULATION_FRAME_FIELDS } = await import('../src/app/simulation/_lib/simulationFrameRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const {
  applySimulationPhaseWorkerRefState,
  captureSimulationPhaseWorkerRefState,
  createSimulationPhaseWorkerCommand,
  restoreSimulationPhaseWorkerOptions,
} = await import('../src/app/simulation/_lib/simulationPhaseWorkerInputRuntime.js');

let checks = 0;
async function check(name, run) {
  await run();
  checks += 1;
  console.log(`PASS ${name}`);
}

async function throughMessageChannel(value) {
  const channel = new MessageChannel();
  try {
    const received = new Promise((resolve, reject) => {
      channel.port2.once('message', resolve);
      channel.port2.once('messageerror', reject);
    });
    channel.port1.postMessage(value);
    return await received;
  } finally {
    channel.port1.close();
    channel.port2.close();
  }
}

function containsDisallowedPayload(value) {
  const seen = new WeakSet();
  const stack = [{ value, key: '' }];
  const disallowedKey = /(?:token|authorization|account|session|credential|password|email|userId)/i;
  while (stack.length) {
    const row = stack.pop();
    if (disallowedKey.test(row.key)) return true;
    if (typeof row.value === 'function' || typeof row.value === 'symbol') return true;
    if (!row.value || typeof row.value !== 'object' || seen.has(row.value)) continue;
    seen.add(row.value);
    for (const key of Object.keys(row.value)) stack.push({ value: row.value[key], key });
  }
  return false;
}

const fixture = JSON.parse(await createRandomIsolationInput('1101'));
const input = createSimulationRunInput({
  activeMap: fixture.map,
  runSeed: fixture.runSeed,
  settings: fixture.settings,
  publicItems: fixture.items,
  survivors: fixture.survivors,
  dead: [],
  kiosks: [],
  droneOffers: [],
  spawnState: null,
});
const prepared = prepareSimulationRunInput(input);
const frame = { ...createInitialSimulationFrame(), ...prepared.state,
  forbiddenAddedNow: [], forbiddenZoneIds: [], frameMapId: String(prepared.state.activeMapId || '') };
frame.survivors[0] = { ...frame.survivors[0], _openingAcquiredItemIds: { head: 'phase-fixture:acquired-head' },
  _lateAcquiredItemIds: { legend: { head: 'phase-fixture:acquired-legend-head' } } };
const initialRandom = createSeedRng('WORKER:phase-input:1101');
initialRandom();
initialRandom.nextId('worker-input');
initialRandom.nameHistory.set('seeded-name-history', ['에메랄드']);
const refs = {
  runRandomRef: { current: initialRandom },
  fullLogEntriesRef: { current: [{ text: '시작', type: 'system' }, { text: '진행', type: 'normal' }] },
  startStarterLoadoutAppliedRef: { current: true },
  suddenDeathActiveRef: { current: false },
  suddenDeathEndAtSecRef: { current: 4321 },
  suddenDeathForbiddenAnnouncedRef: { current: true },
  authTokenRef: { current: 'TEST_TOKEN_MUST_NOT_CROSS' },
  accountSessionRef: { current: { accountId: 'TEST_ACCOUNT_MUST_NOT_CROSS' } },
  helperRef: { current: () => 'TEST_FUNCTION_MUST_NOT_CROSS' },
};
const state = { ...frame, autoSpeed: 32, selectedCharId: frame.survivors[0]?._id || '',
  showMarketPanel: true, pendingTranscendPick: { actorId: frame.survivors[0]?._id || '', choice: 'test' },
  accountSession: { accountId: 'TEST_ACCOUNT_MUST_NOT_CROSS', token: 'TEST_TOKEN_MUST_NOT_CROSS' },
  nonTransferableHelper: () => 'TEST_FUNCTION_MUST_NOT_CROSS' };

await check('a real MessageChannel clone owns frame and input while logs stay in the main journal', async () => {
  const mainLogEntries = refs.fullLogEntriesRef.current;
  const expectedMainLogs = structuredClone(mainLogEntries);
  const command = createSimulationPhaseWorkerCommand({ input, state, refs });
  assert.deepEqual(Object.keys(command.frame).sort(), [...SIMULATION_FRAME_FIELDS].sort());
  assert.deepEqual(command.logEntries, [], 'Worker receives only its phase-local log journal.');
  assert.equal(refs.fullLogEntriesRef.current, mainLogEntries, 'Command construction keeps the main journal owned by Main.');
  assert.deepEqual(command.refState, {
    startStarterLoadoutApplied: true,
    suddenDeathActive: false,
    suddenDeathEndAtSec: 4321,
    suddenDeathForbiddenAnnounced: true,
  });
  assert.deepEqual(command.ui, {
    autoSpeed: 32,
    selectedCharId: frame.survivors[0]?._id || '',
    showMarketPanel: true,
    pendingTranscendPick: state.pendingTranscendPick,
  });
  const workerCommand = await throughMessageChannel(command);
  const expectedActor = workerCommand.input.initialFrame.survivors[0];
  const expectedZone = workerCommand.input.map.zones[0].name;
  const expectedItem = workerCommand.input.publicItems[0].name;
  const expectedFrameHp = workerCommand.frame.survivors[0].hp;
  assert.deepEqual(workerCommand.frame.survivors[0]._openingAcquiredItemIds, { head: 'phase-fixture:acquired-head' },
    'An ongoing phase transfer preserves its already-recorded opening acquisitions.');
  assert.deepEqual(workerCommand.frame.survivors[0]._lateAcquiredItemIds,
    { legend: { head: 'phase-fixture:acquired-legend-head' } });
  input.initialFrame.survivors[0].hp = -999;
  input.map.zones[0].name = 'producer mutation';
  input.publicItems[0].name = 'producer mutation';
  state.survivors[0].hp = -998;
  state.survivors[0]._openingAcquiredItemIds.head = 'producer mutation';
  state.survivors[0]._lateAcquiredItemIds.legend.head = 'producer mutation';
  command.ui.pendingTranscendPick.actorId = 'producer mutation';
  command.refState.startStarterLoadoutApplied = false;
  command.random.nameHistory[0][1][0] = 'producer mutation';
  assert.equal(workerCommand.input.initialFrame.survivors[0].hp, expectedActor.hp);
  assert.equal(workerCommand.input.map.zones[0].name, expectedZone);
  assert.equal(workerCommand.input.publicItems[0].name, expectedItem);
  assert.equal(workerCommand.frame.survivors[0].hp, expectedFrameHp);
  assert.equal(workerCommand.frame.survivors[0]._openingAcquiredItemIds.head, 'phase-fixture:acquired-head');
  assert.equal(workerCommand.frame.survivors[0]._lateAcquiredItemIds.legend.head, 'phase-fixture:acquired-legend-head');
  assert.deepEqual(workerCommand.logEntries, []);
  assert.equal(refs.fullLogEntriesRef.current, mainLogEntries);
  assert.deepEqual(mainLogEntries, expectedMainLogs, 'Transport leaves all existing Main log entries intact.');
  assert.equal(workerCommand.ui.pendingTranscendPick.actorId, frame.survivors[0]?._id || '');
  assert.equal(workerCommand.refState.startStarterLoadoutApplied, true);
  assert.equal(workerCommand.random.nameHistory[0][1][0], '에메랄드');
  assert.notEqual(workerCommand.input, command.input);
  assert.notEqual(workerCommand.frame, command.frame);
  assert.equal(containsDisallowedPayload(workerCommand), false);
  assert.equal(JSON.stringify(workerCommand).includes('TEST_TOKEN_MUST_NOT_CROSS'), false);
  assert.equal(JSON.stringify(workerCommand).includes('TEST_ACCOUNT_MUST_NOT_CROSS'), false);
});

await check('worker restore preserves every frame field, prepared helpers, flags, RNG draws, IDs and name history', async () => {
  const sourceFixture = JSON.parse(await createRandomIsolationInput('1101'));
  const sourceInput = createSimulationRunInput({ activeMap: sourceFixture.map, runSeed: sourceFixture.runSeed,
    settings: sourceFixture.settings, publicItems: sourceFixture.items, survivors: sourceFixture.survivors,
    dead: [], kiosks: [], droneOffers: [], spawnState: null });
  const sourcePrepared = prepareSimulationRunInput(sourceInput);
  const sourceState = { ...createInitialSimulationFrame(), ...sourcePrepared.state,
    forbiddenAddedNow: [], forbiddenZoneIds: [], frameMapId: String(sourcePrepared.state.activeMapId || ''),
    autoSpeed: 8, selectedCharId: sourceFixture.survivors[1]?._id || '', showMarketPanel: false,
    pendingTranscendPick: null };
  const sourceRng = createSeedRng('WORKER:restore:1101');
  sourceRng(); sourceRng.nextId('before-transfer');
  sourceRng.nameHistory.set('kept', ['라일락']);
  const sourceRefs = { runRandomRef: { current: sourceRng }, startStarterLoadoutAppliedRef: { current: false },
    suddenDeathActiveRef: { current: true }, suddenDeathEndAtSecRef: { current: 9876 },
    suddenDeathForbiddenAnnouncedRef: { current: false }, fullLogEntriesRef: { current: [] } };
  const command = createSimulationPhaseWorkerCommand({ input: sourceInput, state: sourceState, refs: sourceRefs });
  assert.deepEqual(command.logEntries, []);
  const workerCommand = await throughMessageChannel(command);
  const workerPrepared = prepareSimulationRunInput(workerCommand.input);
  const restored = restoreSimulationPhaseWorkerOptions(workerCommand, workerPrepared);
  const restoredFrame = Object.fromEntries(SIMULATION_FRAME_FIELDS.map(field => [field, restored.state[field]]));
  assert.deepEqual(restoredFrame, workerCommand.frame);
  assert.deepEqual(restored.refs.fullLogEntriesRef.current, [], 'Each restored phase starts with an empty local log list.');
  assert.deepEqual(restored.state.pendingTranscendPick, workerCommand.ui.pendingTranscendPick);
  assert.equal(restored.state.autoSpeed, workerCommand.ui.autoSpeed);
  assert.equal(restored.state.selectedCharId, workerCommand.ui.selectedCharId);
  assert.equal(restored.state.showMarketPanel, workerCommand.ui.showMarketPanel);
  assert.equal(restored.helpers.getZoneName('alley'), sourcePrepared.helpers.getZoneName('alley'));
  for (const zone of sourcePrepared.state.zones) {
    assert.equal(restored.helpers.getZoneName(zone.zoneId), sourcePrepared.helpers.getZoneName(zone.zoneId));
    for (const destination of sourcePrepared.state.zones) {
      assert.equal(restored.helpers.isHyperloopTransit(zone.zoneId, destination.zoneId),
        sourcePrepared.helpers.isHyperloopTransit(zone.zoneId, destination.zoneId));
    }
  }
  for (const day of [1, 4, 7]) for (const phase of ['night', 'morning', 'day', 'evening']) {
    assert.deepEqual(restored.helpers.getForbiddenZoneIdsForPhase(restored.state.activeMap, day, phase),
      sourcePrepared.helpers.getForbiddenZoneIdsForPhase(sourcePrepared.state.activeMap, day, phase));
    assert.deepEqual(restored.helpers.getForbiddenAddedZoneIdsForPhase(restored.state.activeMap, day, phase),
      sourcePrepared.helpers.getForbiddenAddedZoneIdsForPhase(sourcePrepared.state.activeMap, day, phase));
  }
  assert.deepEqual(captureSimulationPhaseWorkerRefState(restored.refs), workerCommand.random
    ? { ...workerCommand.refState, random: workerCommand.random }
    : { ...workerCommand.refState, random: null });
  const { restoreSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
  const controlRng = restoreSeedRng(workerCommand.random);
  const workerRng = restored.refs.runRandomRef.current;
  assert.deepEqual(workerRng.getState(), controlRng.getState());
  for (let index = 0; index < 5; index += 1) assert.equal(workerRng(), controlRng());
  assert.equal(workerRng.nextId('after-transfer'), controlRng.nextId('after-transfer'));
  workerRng.nameHistory.set('post-transfer', ['수국']);
  controlRng.nameHistory.set('post-transfer', ['수국']);
  assert.deepEqual(workerRng.getState(), controlRng.getState());
  const workerSnapshot = captureSimulationPhaseWorkerRefState(restored.refs);
  sourceRefs.startStarterLoadoutAppliedRef.current = true;
  sourceRefs.suddenDeathActiveRef.current = false;
  sourceRefs.suddenDeathEndAtSecRef.current = null;
  sourceRefs.suddenDeathForbiddenAnnouncedRef.current = true;
  sourceRefs.runRandomRef.current = null;
  applySimulationPhaseWorkerRefState(workerSnapshot, sourceRefs);
  assert.deepEqual(captureSimulationPhaseWorkerRefState(sourceRefs), workerSnapshot);
  assert.equal(restored.refs.runRandomRef.current.getState().nameHistory.length >= 2, true);
});

await check('worker command and restore reject missing owned inputs', async () => {
  assert.throws(() => createSimulationPhaseWorkerCommand({ input: null }), TypeError);
  assert.throws(() => restoreSimulationPhaseWorkerOptions({}, null), TypeError);
});

console.log(`SIMULATION_PHASE_WORKER_INPUT_CHECKS ${checks}/${checks}`);
