import './register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runSimulationPhaseCycle } from '../../src/app/simulation/_lib/simulationPhaseCycleRuntime.js';
import { buildGuestSimulationMap, buildGuestSimulationRoster, loadGuestSimulationItemCatalog } from '../../src/app/simulation/_lib/guestSimulationBootstrap.js';
import { applyGuestCharacterProfiles } from '../../src/app/simulation/_lib/guestCharacterProfileRuntime.js';
import { buildInitialSimulationRoster } from '../../src/app/simulation/_lib/simulationInitialRosterRuntime.js';
import { getDefaultSimulationSettings } from '../../src/app/simulation/_lib/simulationPageRuntime.js';
import { buildBaseZoneGraph, buildHyperloopZoneGraph, isHyperloopTransit } from '../../src/app/simulation/_lib/mapGraphRuntime.js';
import { getForbiddenZoneIdsForPhase, getForbiddenAddedZoneIdsForPhase } from '../../src/app/simulation/_lib/forbiddenZoneRuntime.js';
import { buildCraftableItems, buildItemMetaById, buildItemNameById, buildItemKeyById } from '../../src/app/simulation/_lib/itemOptionsRuntime.js';
import { applyLootCraftResult } from '../../src/app/simulation/_lib/lootCraftResultRuntime.js';
import { appendSimulationLog, emitSimulationRunEvent } from '../../src/app/simulation/_lib/logActionRuntime.js';
import { buildTeamObserverModel } from '../../src/app/simulation/_lib/teamObserverRuntime.js';
import { createSeedRng, restoreSeedRng } from '../../src/app/simulation/_lib/randomSeedRuntime.js';
import { withSimulationRandom } from '../../src/utils/simulationRandom.js';
import * as eventActions from '../../src/app/simulation/_lib/runEventRuntime.js';
import * as mastery from '../../src/app/simulation/_lib/masteryProgressRuntime.js';
import * as combat from '../../src/app/simulation/_lib/combatRuntime.js';
import { prepareSimulationRunInput } from '../../src/app/simulation/_lib/simulationReplayRuntime.js';
import { runGuardedPhaseAdvance } from '../../src/app/simulation/_lib/phaseControllerGuards.js';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

export async function createRandomIsolationInput(runSeed = '1101', { guestProfiles = [] } = {}) {
  const map = buildGuestSimulationMap();
  const settings = getDefaultSimulationSettings();
  const items = await loadGuestSimulationItemCatalog();
  const { shuffledChars } = withSimulationRandom(createSeedRng('FIXTURE:initial-roster'), () => buildInitialSimulationRoster({
    charList: applyGuestCharacterProfiles(buildGuestSimulationRoster(), guestProfiles), routeItems: items, initialMap: map,
    initialZoneIds: map.zones.map((zone) => zone.zoneId), loadedSettings: settings,
  }));
  // This is a test input snapshot, not the product's still-pending replay save
  // format. Every run reconstructs derived maps from these same JSON values.
  return JSON.stringify({ map, settings, items, survivors: shuffledChars, runSeed });
}

export async function runRandomIsolationMatch(inputJson, { noisy = false, phaseOnly = false, uiNoise = () => {}, savedInput = null, onFinish, onFrame } = {}) {
  const fixture = savedInput ? { map: savedInput.map, settings: savedInput.settings, items: savedInput.publicItems,
    survivors: savedInput.initialFrame.survivors, runSeed: savedInput.runSeed } : JSON.parse(inputJson);
  const { map, settings, items, survivors, runSeed } = structuredClone(fixture);
  const prepared = savedInput ? prepareSimulationRunInput(savedInput) : null;
  const baseGraph = buildBaseZoneGraph(map, map.zones);
  const loops = map.zones.filter((zone) => zone.hasHyperloop).map((zone) => zone.zoneId);
  const itemMetaById = buildItemMetaById(items);
  const itemNameById = buildItemNameById(items);
  const itemKeyById = buildItemKeyById(items);
  survivors.forEach((actor) => { actor._itemKeyById = itemKeyById; });
  const state = { activeMap: map, activeMapId: map._id, autoSpeed: 32, settings, runSeed,
    day: 0, phase: 'night', matchSec: 0, dead: [], survivors, killCounts: {}, assistCounts: {}, spawnState: null,
    publicItems: items, craftables: buildCraftableItems(items), itemMetaById, itemNameById, itemKeyById,
    zones: map.zones, zoneGraph: buildHyperloopZoneGraph(baseGraph, map.zones, loops), kiosks: [], droneOffers: [],
  };
  if (prepared) Object.assign(state, prepared.state);
  const refs = Object.fromEntries(Object.entries({ activeMap: map, activeMapId: map._id, autoSpeed: 32,
    runRandom: null, fullLogs: [], fullLogEntries: [], logSeq: 0, startStarterLoadoutApplied: false,
    suddenDeathActive: false, suddenDeathEndAtSec: null, suddenDeathForbiddenAnnounced: false,
  }).map(([key, current]) => [`${key}Ref`, { current }]));
  const events = [];
  refs.fullRunEventsRef = { current: [] };
  const pendingLogUpdates = [];
  const frameHash = createHash('sha256');
  const delays = new Set();
  let visibleLogs = [];
  let latestFrame;
  let ending;
  let phases = 0;
  let frames = 0;
  let ticks = 0;
  let displaySteps = 0;
  let observerReads = 0;
  let source;
  let finishPromise;
  function applyLogUpdate(update) {
    const before = refs.runRandomRef.current?.getState();
    const next = update(visibleLogs);
    if (noisy) assert.deepEqual(update(visibleLogs), next, 'Repeating a React updater must be pure.');
    visibleLogs = next;
    assert.deepEqual(refs.runRandomRef.current?.getState(), before, 'Rendering logs cannot draw game randomness.');
  }
  function flushLogs() { pendingLogUpdates.splice(0).forEach(applyLogUpdate); }
  const emitRunEvent = (kind, payload, at) => emitSimulationRunEvent({ kind, payload, at, state, refs,
    actions: { setRunEvents: (update) => {
      // Capture each real event before the view's 5,000-row retention limit.
      // Wall-clock diagnostic metadata is intentionally not a match outcome.
      const { ts, ...event } = update([])[0];
      events.push(event);
    } },
  });
  const addLog = (text, type) => appendSimulationLog({ text, type, refs,
    actions: { setLogs: (update) => noisy ? pendingLogUpdates.push(update) : applyLogUpdate(update) },
  });
  const actions = {
    addLog, emitRunEvent, normalizeAutoSpeed: Number,
    resetPhaseLogs: () => { flushLogs(); visibleLogs = []; },
    setForbiddenAddedNow: () => {}, setPendingTranscendPick: () => {},
    persistSimEquipmentsFromChars: async () => {},
    finishGame: (alive, kills, assists, options) => {
      ending = options.ending;
      finishPromise = onFinish?.({ finalSurvivors: alive, latestKillCounts: kills, latestAssistCounts: assists, options,
        state: { ...state, runEvents: refs.fullRunEventsRef.current }, refs,
        finalFrame: latestFrame, random: refs.runRandomRef.current?.getState() });
    },
    grantMastery: mastery.grantMastery, grantMasteries: mastery.grantMasteries,
    grantPvpDamageMastery: mastery.grantPvpDamageMastery, grantPvpKillMastery: mastery.grantPvpKillMastery,
    applyErTraitAfterBattle: combat.applyErTraitAfterBattle, applyErWeaponSkillAfterCombat: combat.applyErWeaponSkillAfterCombat,
    waitForVisibleTick: async (delay, clock) => {
      assert.ok(clock.elapsedSec > 0);
      ticks = Math.round((ticks + clock.elapsedSec) * 1e6) / 1e6;
      displaySteps += 1;
      delays.add(delay);
      if (noisy) {
        uiNoise();
        // Extra microtask boundaries interleave another real match and UI work.
        await Promise.resolve();
        uiNoise();
        flushLogs();
        refs.autoSpeedRef.current = [1, 8, 32][displaySteps % 3];
      }
    },
    setSimulationFrame: (frame) => {
      freeze(frame);
      assert.equal(frame.survivors.length + frame.dead.length, survivors.length);
      assert.ok(!latestFrame || latestFrame.matchSec <= frame.matchSec);
      latestFrame = frame;
      onFrame?.(frame, { publicItems: items, events });
      frames += 1;
      frameHash.update(JSON.stringify(frame));
      if (noisy) {
        uiNoise();
        if (frames % 17 === 0) {
          const before = refs.runRandomRef.current.getState();
          // Match the product's explicit rules/forbidden-zone inputs so observer
          // noise cannot fall back to unrelated browser-stored rules.
          buildTeamObserverModel({ ...frame, events, teamId: `team:${(frames % 8) + 1}`, publicItems: items,
            settings, forbiddenIds: frame.forbiddenZoneIds });
          assert.deepEqual(refs.runRandomRef.current.getState(), before);
          observerReads += 1;
        }
      }
      if (!phaseOnly) Object.assign(state, frame);
    },
  };
  for (const field of ['day', 'phase', 'matchSec', 'dead', 'survivors', 'spawnState', 'killCounts', 'assistCounts']) {
    actions[`set${field[0].toUpperCase()}${field.slice(1)}`] = (value) => { state[field] = typeof value === 'function' ? value(state[field]) : value; };
  }
  for (const name of ['emitItemGainIfAny', 'emitCraftRunEvent', 'emitObjectiveRunEvent', 'emitQueueRunEvent', 'emitEffectRunEvents', 'emitConsumableRunEvent']) {
    actions[name] = (...args) => eventActions[name](emitRunEvent, ...args);
  }
  actions.applyLootCraftResult = (actor, result, meta, at, zoneId) => applyLootCraftResult(actor, result, meta,
    { at, zoneId, addLog, grantCraftMastery: mastery.grantCraftMastery, emitCraftRunEvent: actions.emitCraftRunEvent });
  const forbiddenCache = new Map();
  const helpers = {
    getZoneName: (id) => map.zones.find((zone) => zone.zoneId === id)?.name || id,
    isHyperloopTransit: (from, to) => isHyperloopTransit(baseGraph, loops, from, to),
    getForbiddenZoneIdsForPhase: (m, d, p) => getForbiddenZoneIdsForPhase(m, d, p, map.zones, settings, forbiddenCache),
    getForbiddenAddedZoneIdsForPhase: (m, d, p) => getForbiddenAddedZoneIdsForPhase(m, d, p, map.zones, settings, forbiddenCache),
  };
  while (!ending && phases < 24) {
    freeze(state.survivors); freeze(state.dead); freeze(state.spawnState);
    const proceed = () => runSimulationPhaseCycle({ state, refs, actions, helpers: prepared?.helpers || helpers });
    if (savedInput) {
      await runGuardedPhaseAdvance({ refs, state, proceedPhase: proceed, actions: {
        setRunEvents: (rows) => {
          refs.fullRunEventsRef.current = structuredClone(rows);
          events.push(...rows);
        },
      } });
    } else await proceed();
    if (source) assert.equal(source, refs.runRandomRef.current, 'Do not reset randomness at a phase boundary.');
    if (phaseOnly) Object.assign(state, latestFrame);
    if (noisy) refs.runRandomRef.current = restoreSeedRng(JSON.parse(JSON.stringify(refs.runRandomRef.current.getState())));
    source = refs.runRandomRef.current;
    phases += 1;
  }
  await finishPromise;
  flushLogs();
  assert.ok(ending, 'The replay comparison must reach a real match ending.');
  assert.equal(events.filter((event) => event.kind === 'match_end').length, 1);
  assert.equal(ticks, ending.atSec);
  assert.ok(events.some((event) => event.kind === 'craft'));
  assert.ok(events.some((event) => event.kind === 'battle'));
  if (noisy) assert.ok(delays.size > 1 && observerReads > 0);
  const evidence = { seed: runSeed, phases, frames, ticks, eventCount: events.length, ending,
    random: refs.runRandomRef.current.getState(),
    eventDigest: createHash('sha256').update(JSON.stringify(events)).digest('hex'),
    frameDigest: frameHash.digest('hex'),
  };
  return { evidence, finalFrame: latestFrame, events, logs: refs.fullLogEntriesRef.current };
}
