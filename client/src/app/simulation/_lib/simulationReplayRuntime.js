import { getRuleset } from '../../../utils/rulesets';
import { SIMULATION_ENGINE_VERSION } from '../_generated/simulationEngineVersion';
import { applyRegionDataToZones } from './lumiaRegionData';
import { buildBaseZoneGraph, buildHyperloopZoneGraph, getHyperloopZoneIds, isHyperloopTransit } from './mapGraphRuntime';
import { getForbiddenAddedZoneIdsForPhase, getForbiddenZoneIdsForPhase } from './forbiddenZoneRuntime';
import { buildCraftableItems, buildItemKeyById, buildItemMetaById, buildItemNameById } from './itemOptionsRuntime';

export const REPLAY_SCHEMA = 'eternal-hunger.replay.v1';
const SETTINGS_KEYS = ['rulesetId', 'matchMode', 'statWeights', 'suddenDeathTurn', 'forbiddenZoneEnabled',
  'forbiddenZoneStartDay', 'forbiddenZoneStartPhase', 'forbiddenZoneDamageBase', 'battle', 'skills',
  'equipment', 'characterSkillsEnabled', 'weaponSkillCooldownSec', 'erMetaScale'];

// The same JSON-owned input feeds the original game and its replay. In
// particular, no reference to a mutable pregame actor or catalog escapes here.
export function cloneReplayData(value) {
  return JSON.parse(JSON.stringify(value));
}

export function resolveReplayMap(map, storage) {
  const result = cloneReplayData(map);
  if (!Object.hasOwn(result, 'mutantWildlifeSpawnZoneId')) {
    result.mutantWildlifeSpawnZoneId = '';
    try {
      const local = storage === undefined ? window.localStorage : storage;
      result.mutantWildlifeSpawnZoneId = String(local?.getItem(`eh_mutant_spawn_zone_${result._id || result.id}`) || '').trim();
    } catch { /* An empty override uses the normal spawn selection. */ }
  }
  if (!result.crateAllowDeny || typeof result.crateAllowDeny !== 'object' || Array.isArray(result.crateAllowDeny)) {
    result.crateAllowDeny = {};
    try {
      const local = storage === undefined ? window.localStorage : storage;
      const rules = JSON.parse(local?.getItem(`eh_map_zone_crate_rules_${result._id || result.id}`) || 'null');
      if (rules && typeof rules === 'object' && !Array.isArray(rules)) result.crateAllowDeny = rules;
    } catch { /* A missing legacy override means no denied crates. */ }
  }
  return result;
}

export function createSimulationRunInput(state, storage) {
  const settings = Object.fromEntries(SETTINGS_KEYS.filter((key) => state.settings?.[key] !== undefined)
    .map((key) => [key, state.settings[key]]));
  settings.simulationRuleset = getRuleset(settings.rulesetId, state.settings?.simulationRuleset);
  const input = cloneReplayData({ schema: REPLAY_SCHEMA, engineVersion: SIMULATION_ENGINE_VERSION,
    runSeed: String(state.runSeed || '').trim() || '0', settings,
    map: resolveReplayMap(state.activeMap, storage),
    publicItems: state.publicItems || [], kiosks: state.kiosks || [], droneOffers: state.droneOffers || [],
    initialFrame: { day: 0, phase: 'night', matchSec: 0, survivors: state.survivors || [], dead: state.dead || [],
      killCounts: state.killCounts || {}, assistCounts: state.assistCounts || {}, spawnState: state.spawnState || null },
  });
  validateSimulationRunInput(input);
  return input;
}

export function validateSimulationRunInput(input) {
  if (input?.schema !== REPLAY_SCHEMA) throw new Error('시작 조건이 없는 이전 기록입니다.');
  if (input.engineVersion !== SIMULATION_ENGINE_VERSION) throw new Error('경기 규칙이 업데이트되어 이 기록의 동일 재경기를 실행할 수 없습니다.');
  const actors = input.initialFrame?.survivors;
  if (!Array.isArray(actors) || actors.length < 2 || actors.length > 24
    || new Set(actors.map((actor) => String(actor?._id || actor?.id || ''))).size !== actors.length
    || actors.some((actor) => !String(actor?._id || actor?.id || '') || !(Number(actor.hp) > 0))
    || input.initialFrame.day !== 0 || input.initialFrame.matchSec !== 0 || input.initialFrame.phase !== 'night'
    || !Array.isArray(input.map?.zones) || !input.map.zones.length
    || !input.settings?.simulationRuleset || !Array.isArray(input.publicItems)
    || !Array.isArray(input.kiosks) || !Array.isArray(input.droneOffers)) {
    throw new Error('저장된 경기 시작 조건이 손상되었습니다.');
  }
  return input;
}

export function validateSimulationReplayOutcome(record) {
  const events = record?.events;
  const finalFrame = record?.finalFrame;
  const ending = record?.summary?.ending;
  if (!Array.isArray(events) || !events.length || String(events.at(-1)?.kind || '') !== 'match_end'
    || !finalFrame || !Array.isArray(finalFrame.survivors) || !Array.isArray(finalFrame.dead)
    || !record?.random || typeof record.random !== 'object'
    || !ending || typeof ending !== 'object' || !String(ending.outcome || '').trim()
    || !Number.isFinite(Number(ending.atSec)) || Number(ending.atSec) < 0) {
    throw new Error('경기 결과 기록이 손상되었습니다.');
  }
  return record;
}

export function validateSimulationReplayRecord(record) {
  if (!record || record.schema !== REPLAY_SCHEMA || !String(record.id || '').trim()) {
    throw new Error('경기 기록을 찾을 수 없습니다.');
  }
  validateSimulationRunInput(record.input);
  validateSimulationReplayOutcome(record);
  return record;
}

export function prepareSimulationRunInput(input) {
  validateSimulationRunInput(input);
  const owned = cloneReplayData(input);
  const zones = applyRegionDataToZones(owned.map.zones);
  const baseGraph = buildBaseZoneGraph(owned.map, zones);
  const loops = getHyperloopZoneIds(owned.map, zones);
  const cache = {};
  const state = { ...owned.initialFrame, activeMap: owned.map, activeMapId: String(owned.map._id || owned.map.id),
    settings: owned.settings, runSeed: owned.runSeed, publicItems: owned.publicItems,
    kiosks: owned.kiosks, droneOffers: owned.droneOffers, zones,
    zoneGraph: buildHyperloopZoneGraph(baseGraph, zones, loops),
    craftables: buildCraftableItems(owned.publicItems), itemKeyById: buildItemKeyById(owned.publicItems),
    itemMetaById: buildItemMetaById(owned.publicItems), itemNameById: buildItemNameById(owned.publicItems),
  };
  return { state, helpers: {
    getZoneName: (id) => zones.find((zone) => String(zone.zoneId) === String(id))?.name || id,
    isHyperloopTransit: (from, to) => isHyperloopTransit(baseGraph, loops, from, to),
    getForbiddenZoneIdsForPhase: (map, day, phase) => getForbiddenZoneIdsForPhase(map, day, phase, zones, owned.settings, cache),
    getForbiddenAddedZoneIdsForPhase: (map, day, phase) => getForbiddenAddedZoneIdsForPhase(map, day, phase, zones, owned.settings, cache),
  } };
}

export function semanticRunEvents(events) {
  return cloneReplayData((events || []).map(({ ts, ...event }) => event));
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function compareSimulationReplay(expected, actual) {
  const left = semanticRunEvents(expected.events);
  const right = semanticRunEvents(actual.events);
  let firstDifference = -1;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if (canonical(left[index]) !== canonical(right[index])) { firstDifference = index; break; }
  }
  const sameFinalState = canonical(expected.finalFrame) === canonical(actual.finalFrame);
  const sameRandom = canonical(expected.random) === canonical(actual.random);
  const expectedHasEnding = expected?.summary && Object.hasOwn(expected.summary, 'ending');
  const actualHasEnding = actual?.summary && Object.hasOwn(actual.summary, 'ending');
  const sameEnding = expectedHasEnding === actualHasEnding
    && (!expectedHasEnding || canonical(expected.summary.ending) === canonical(actual.summary.ending));
  return { matched: firstDifference === -1 && sameFinalState && sameRandom && sameEnding, firstDifference,
    expectedEvents: left.length, actualEvents: right.length, sameFinalState, sameRandom, sameEnding };
}
