import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { createSeedRng, restoreSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { getActiveSimulationRandom, simulationRandom, simulationRandomId, withSimulationRandom, runSimulationSteps } = await import('../src/utils/simulationRandom.js');
const { appendSimulationLog } = await import('../src/app/simulation/_lib/logActionRuntime.js');
const { createEquipmentItem } = await import('../src/utils/equipmentCatalog.js');
const { calculateBattle } = await import('../src/utils/battleLogic.js');
const { hasEffectImmunity } = await import('../src/utils/statusEffectApplication.js');
const { pickInitialErWeaponType } = await import('../src/utils/erMeta.js');
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { requestSimulationMainThreadYield } = await import('../src/app/simulation/_lib/simulationCooperativeYieldRuntime.js');
const { subscribeObserverWorkMeasurements } = await import('../src/app/simulation/_lib/observerWorkMeasurementRuntime.js');

let checks = 0;
const check = async (name, run) => { await run(); checks += 1; console.log(`PASS ${name}`); };

// Frozen pre-isolation implementation, to prevent an accidental RNG/balance
// change being blessed by two copies of the new implementation agreeing.
function legacyRandom(seedStr) {
  let hash = 2166136261;
  const seed = String(seedStr || '');
  for (let i = 0; i < seed.length; i += 1) { hash ^= seed.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  let state = hash >>> 0;
  return () => {
    state |= 0; state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

await check('seeded values preserve the existing FNV-1a/Mulberry32 sequence', () => {
  for (const seed of ['', 'RUN:0', 'RUN:1101', '팀:은하', 'other']) {
    const actual = createSeedRng(seed); const expected = legacyRandom(seed);
    for (let i = 0; i < 1000; i += 1) assert.equal(actual(), expected());
    assert.equal(actual.getState().draws, 1000);
  }
  assert.notEqual(createSeedRng('a')(), createSeedRng('b')());
});

await check('JSON random snapshots resume both draws and unique item IDs', () => {
  const source = createSeedRng('save');
  source(); source.nextId('eq'); source();
  const snapshot = source.getState();
  const restored = restoreSeedRng(JSON.parse(JSON.stringify(snapshot)));
  for (let i = 0; i < 40; i += 1) {
    assert.equal(source(), restored());
    assert.equal(source.nextId('wpn'), restored.nextId('wpn'));
  }
  assert.deepEqual(source.getState(), restored.getState());
  assert.equal(snapshot.draws, 3, 'Snapshot is an owned value, not live mutable state.');
  const ids = new Set(Array.from({ length: 1000 }, () => source.nextId('eq')));
  assert.equal(ids.size, 1000);
});

await check('unsupported or malformed random snapshots fail closed', () => {
  const good = createSeedRng('valid').getState();
  for (const bad of [null, {}, { ...good, algorithm: 'unknown' }, { ...good, state: -1 },
    { ...good, state: 2 ** 32 }, { ...good, state: 1.5 }, { ...good, draws: NaN },
    { ...good, draws: -1 }, { ...good, draws: Number.MAX_SAFE_INTEGER + 1 }, { ...good, ids: 1 },
    { ...good, nameHistory: null }, { ...good, nameHistory: [['key', 'not-list']] },
    { ...good, nameHistory: [['key', [null]]] }, { ...good, nameHistory: [['key', []], ['key', []]] }]) {
    assert.throws(() => restoreSeedRng(bad), /Invalid or unsupported/);
  }
});

await check('scope never patches native randomness and restores nested sources after errors', () => {
  const native = Math.random;
  const source = createSeedRng('outer'); const expected = createSeedRng('outer');
  assert.equal(getActiveSimulationRandom(), null);
  withSimulationRandom(source, () => {
    assert.equal(Math.random, native);
    assert.equal(simulationRandom(), expected());
    assert.throws(() => withSimulationRandom(() => 0.25, () => { assert.equal(simulationRandom(), 0.25); throw new Error('nested'); }), /nested/);
    assert.equal(simulationRandom(), expected());
    assert.equal(getActiveSimulationRandom(), source);
  });
  assert.equal(getActiveSimulationRandom(), null);
  assert.equal(Math.random, native);
  assert.throws(() => withSimulationRandom({}, () => {}), /random source/);
  assert.throws(() => withSimulationRandom(source, () => Promise.resolve()), /synchronous/);
  assert.equal(getActiveSimulationRandom(), null);
});

await check('separate asynchronous runs cannot consume each other or UI randomness', async () => {
  function* steps() {
    const result = [simulationRandom()];
    yield Promise.resolve();
    result.push(simulationRandom());
    yield Promise.resolve();
    return [...result, simulationRandom()];
  }
  const native = Math.random;
  const first = runSimulationSteps(createSeedRng('first'), steps());
  assert.equal(getActiveSimulationRandom(), null);
  for (let i = 0; i < 25; i += 1) Math.random();
  const second = runSimulationSteps(createSeedRng('second'), steps());
  const actual = await Promise.all([first, second]);
  for (let i = 0; i < 2; i += 1) {
    const source = createSeedRng(['first', 'second'][i]);
    assert.deepEqual(actual[i], [source(), source(), source()]);
  }
  assert.equal(getActiveSimulationRandom(), null);
  assert.equal(Math.random, native);
});

await check('rejected async steps resume catch and finally with the correct source', async () => {
  const expected = createSeedRng('errors');
  const values = [];
  function* caught() {
    try { yield Promise.reject(new Error('wait failed')); }
    catch (error) { assert.match(error.message, /wait failed/); values.push(simulationRandom()); }
    finally { values.push(simulationRandom()); yield Promise.resolve(); values.push(simulationRandom()); }
  }
  await runSimulationSteps(createSeedRng('errors'), caught());
  assert.deepEqual(values, [expected(), expected(), expected()]);
  function* uncaught() { yield Promise.reject(new Error('propagate')); }
  await assert.rejects(runSimulationSteps(createSeedRng('errors'), uncaught()), /propagate/);
  assert.equal(getActiveSimulationRandom(), null);
});

await check('browser cooperative yields release and restore the match RNG without drawing', async () => {
  assert.equal(requestSimulationMainThreadYield(), null, 'Headless checks must not schedule host timers.');
  const source = createSeedRng('cooperative-yield');
  const expected = createSeedRng('cooperative-yield');
  const values = [];
  let timerCalls = 0;
  function* steps() {
    values.push(simulationRandom());
    const pause = requestSimulationMainThreadYield({
      schedulerRef: null,
      windowRef: {
        setTimeout: (resolve, delay) => {
          timerCalls += 1;
          assert.equal(delay, 0);
          queueMicrotask(() => {
            assert.equal(getActiveSimulationRandom(), null, 'The host wait must not retain a match RNG.');
            resolve();
          });
        },
      },
    });
    if (pause) yield pause;
    values.push(simulationRandom());
  }
  await runSimulationSteps(source, steps());
  assert.deepEqual(values, [expected(), expected()]);
  assert.equal(timerCalls, 1);
  assert.deepEqual(source.getState(), expected.getState(), 'Scheduling must not consume random draws.');
  assert.equal(getActiveSimulationRandom(), null);

  let schedulerCalls = 0;
  await requestSimulationMainThreadYield({
    windowRef: {},
    schedulerRef: { yield: () => { schedulerCalls += 1; return Promise.resolve(); } },
  });
  assert.equal(schedulerCalls, 1, 'Prefer the browser scheduler when it is available.');
});

await check('shared battle, status, weapon and equipment helpers use match-local randomness', () => {
  const native = Math.random;
  const now = Date.now;
  Math.random = () => { throw new Error('Shared helper escaped the match RNG.'); };
  Date.now = () => { throw new Error('Generated equipment cannot depend on wall time.'); };
  try {
    function exercise() {
      const actor = { _id: 'a', name: 'a', hp: 100, maxHp: 100, attackPower: 20, defense: 10, inventory: [] };
      return {
        battle: calculateBattle(actor, { ...actor, _id: 'b', name: 'b' }, 1),
        status: hasEffectImmunity({ statusResists: { '기절': 0.5 } }, '기절'),
        weapon: pickInitialErWeaponType({}),
        equipment: ['weapon', 'head', 'clothes', 'arms', 'shoes'].map((slot) => createEquipmentItem({ slot })),
      };
    }
    const first = withSimulationRandom(createSeedRng('shared'), exercise);
    const second = withSimulationRandom(createSeedRng('shared'), exercise);
    assert.deepEqual(first, second);
    assert.equal(new Set(first.equipment.map((item) => item.id)).size, 5);
  } finally { Math.random = native; Date.now = now; }
  Math.random = () => 0.5;
  Date.now = () => 1234;
  try {
    assert.equal(simulationRandom(), 0.5);
    assert.equal(simulationRandomId('outside'), 'outside_1234_500000000');
  } finally { Math.random = native; Date.now = now; }
});

await check('deferred and repeated log updaters neither draw randomness nor mutate sequence', () => {
  const native = Math.random;
  Math.random = () => { throw new Error('Log rendering must not draw randomness.'); };
  try {
    const refs = { fullLogsRef: { current: [] }, fullLogEntriesRef: { current: [] }, logSeqRef: { current: 0 } };
    const updates = [];
    const source = createSeedRng('log');
    const before = source.getState();
    withSimulationRandom(source, () => {
      for (const text of ['first', 'second']) appendSimulationLog({ text, refs, actions: { setLogs: (update) => updates.push(update) } });
    });
    assert.deepEqual(source.getState(), before);
    assert.equal(refs.logSeqRef.current, 2);
    let rows = [];
    for (const update of updates) { const next = update(rows); assert.deepEqual(update(rows), next); rows = next; }
    assert.equal(refs.logSeqRef.current, 2);
    assert.equal(new Set(rows.map((row) => row.id)).size, 2);
    assert.deepEqual(refs.fullLogsRef.current, ['first', 'second']);
  } finally { Math.random = native; }
});

await check('legendary name history is per-run, resumable, and independent of previous games', async () => {
  const item = () => createEquipmentItem({ slot: 'weapon', tier: 5, weaponType: '양손검' });
  const source = createSeedRng('legendary-names');
  const initial = withSimulationRandom(source, () => Array.from({ length: 20 }, item));
  assert.ok(source.getState().nameHistory.length > 0);
  const snapshot = source.getState();
  const restored = restoreSeedRng(JSON.parse(JSON.stringify(snapshot)));
  const continuation = withSimulationRandom(source, () => Array.from({ length: 20 }, item));
  assert.deepEqual(withSimulationRandom(restored, () => Array.from({ length: 20 }, item)), continuation);
  assert.deepEqual(withSimulationRandom(createSeedRng('legendary-names'), () => Array.from({ length: 20 }, item)), initial);
  assert.notDeepEqual(source.getState().nameHistory, snapshot.nameHistory, 'Saved histories must not mutate with the live source.');
  function* generate() {
    const items = [];
    for (let i = 0; i < 20; i += 1) { items.push(item()); yield Promise.resolve(); }
    return items;
  }
  const concurrent = await Promise.all([
    runSimulationSteps(createSeedRng('legendary-names'), generate()),
    runSimulationSteps(createSeedRng('legendary-names'), generate()),
  ]);
  concurrent.forEach((items) => assert.deepEqual(items, initial));
});

await check('all engine random draws route through the isolated boundary, wired to the page', () => {
  const lib = new URL('../src/app/simulation/_lib/', import.meta.url);
  for (const file of fs.readdirSync(lib).filter((name) => name.endsWith('.js'))) {
    assert.doesNotMatch(fs.readFileSync(new URL(file, lib), 'utf8'), /Math\.random/, `Unscoped randomness in ${file}`);
  }
  for (const file of ['battleLogic', 'equipmentCatalog', 'erMeta', 'statusEffectApplication']) {
    assert.doesNotMatch(fs.readFileSync(new URL(`../src/utils/${file}.js`, import.meta.url), 'utf8'), /Math\.random|Date\.now/);
  }
  const hook = fs.readFileSync(new URL('useSimulationRunSeed.js', lib), 'utf8');
  assert.match(hook, /runRandomRef = useRef\(null\)/);
  const controller = fs.readFileSync(new URL('useSimulationPageController.js', lib), 'utf8');
  assert.match(controller, /useSimulationPhaseController\(\{\s*refs: \{[^}]*runRandomRef/s);
  const cycle = fs.readFileSync(new URL('simulationPhaseCycleRuntime.js', lib), 'utf8');
  const pvp = fs.readFileSync(new URL('phasePvpActionLoopRuntime.js', lib), 'utf8');
  assert.match(cycle, /requestMainThreadYield:\s*requestSimulationMainThreadYield/);
  assert.match(pvp, /if \(framePublishYield\) yield framePublishYield/);
});

await check('actual complete matches reproduce all events and frames despite concurrent UI, speed and observer changes', async () => {
  const input = await createRandomIsolationInput();
  const native = Math.random;
  const fetch = globalThis.fetch;
  const now = Date.now;
  let uiAllowed = false;
  let uiDraws = 0;
  let apiCalls = 0;
  let timestamp = 1000;
  let diagnosticClock = 0;
  const measuredStages = new Set();
  let disposeMeasurements = () => {};
  const guardedNative = () => {
    assert.ok(uiAllowed, 'An actual engine path still calls native randomness.');
    uiDraws += 1;
    return native();
  };
  Math.random = guardedNative;
  Date.now = () => ++timestamp;
  globalThis.fetch = () => { apiCalls += 1; throw new Error('Guest matches must not use the account server.'); };
  const uiNoise = () => {
    assert.equal(Math.random, guardedNative, 'The engine must never replace the browser RNG.');
    uiAllowed = true;
    try { for (let i = 0; i < 7; i += 1) Math.random(); }
    finally { uiAllowed = false; }
  };
  try {
    const baseline = await runRandomIsolationMatch(input);
    assert.equal(uiDraws, 0);
    console.log(`RNG_MATCH_BASELINE ${JSON.stringify(baseline.evidence)}`);
    // A diagnostic-enabled run must retain every event/frame and RNG state of
    // the unmeasured run. Retain stage names only, never actors or match state.
    disposeMeasurements = subscribeObserverWorkMeasurements(() => ++diagnosticClock,
      ({ name }) => measuredStages.add(name));
    const replays = await Promise.all([
      runRandomIsolationMatch(input, { noisy: true, uiNoise }),
      runRandomIsolationMatch(input, { noisy: true, phaseOnly: true, uiNoise }),
    ]);
    disposeMeasurements();
    for (const stage of ['growth.singleActor', 'growth.actorMovement', 'growth.actorLoot', 'growth.actorPlan', 'growth.actorQueue']) {
      assert.ok(measuredStages.has(stage), `The real action pipeline did not measure ${stage}.`);
    }
    for (const replay of replays) {
      assert.deepEqual(replay.events, baseline.events, 'Every event, not just the winner, must reproduce.');
      assert.deepEqual(replay.finalFrame, baseline.finalFrame, 'Include inventory IDs, gear, life state and field stock.');
      assert.deepEqual(replay.logs, baseline.logs, 'Actual combat and growth explanations must reproduce.');
      assert.deepEqual(replay.evidence, baseline.evidence, 'Every frame and RNG state must reproduce.');
    }
    assert.ok(uiDraws > 10000);
    assert.equal(apiCalls, 0);
    assert.equal(getActiveSimulationRandom(), null);
    console.log(`RNG_MATCH_REPLAYS ${JSON.stringify({ matches: 3, uiDraws, apiCalls, ...baseline.evidence })}`);
  } finally { disposeMeasurements(); Math.random = native; globalThis.fetch = fetch; Date.now = now; }
});

console.log(`SIMULATION_RANDOM_CHECKS ${checks}/${checks}`);
