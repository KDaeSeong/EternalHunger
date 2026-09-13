import { createInitialSpawnState } from './spawnStateRuntime';
import { getRuntimeActorKey } from './runtimeParticipantRuntime';

export function createInitialSimulationFrame() {
  return { day: 0, phase: 'night', matchSec: 0, survivors: [], dead: [],
    killCounts: {}, assistCounts: {}, spawnState: createInitialSpawnState(''),
    forbiddenAddedNow: [], forbiddenZoneIds: null, frameMapId: '' };
}

export const SIMULATION_FRAME_FIELDS = Object.keys(createInitialSimulationFrame());

export function reduceSimulationFrame(state, action) {
  if (action.type === 'publish') return { ...state, ...action.frame };
  if (action.type !== 'field' || !SIMULATION_FRAME_FIELDS.includes(action.field)) return state;
  const value = typeof action.value === 'function' ? action.value(state[action.field]) : action.value;
  if (Object.is(state[action.field], value)) return state;
  return { ...state, [action.field]: value };
}

export function combineSimulationCounts(base = {}, added = {}) {
  const result = { ...base };
  for (const [id, count] of Object.entries(added)) result[id] = Number(result[id] || 0) + Number(count || 0);
  return result;
}

function latestActors(rows) {
  const byId = new Map();
  for (const actor of rows || []) {
    const id = getRuntimeActorKey(actor);
    if (id) byId.set(id, actor);
  }
  return [...byId.values()];
}

// A single owned snapshot is used by the map, roster, clock, and team counters.
// Do not normalize or award anything here: observing cannot change gameplay.
export function createSimulationFrame({ day, phase, matchSec, survivors = [], dead = [],
  killCounts = {}, assistCounts = {}, spawnState, forbiddenAddedNow = [], forbiddenIds = new Set(), mapId = '',
}) {
  const living = latestActors(survivors).filter((actor) => Number(actor.hp) > 0);
  const aliveIds = new Set(living.map(getRuntimeActorKey));
  // Prefer the engine's normalized corpse over its older zero-HP live-map row.
  // Preserve death order too: revival iterates that order using match RNG.
  const recordedDead = latestActors(dead);
  const recordedIds = new Set(recordedDead.map(getRuntimeActorKey));
  const fallen = [...recordedDead, ...latestActors(survivors).filter((actor) => Number(actor.hp) <= 0 && !recordedIds.has(getRuntimeActorKey(actor)))]
    .filter((actor) => !aliveIds.has(getRuntimeActorKey(actor)));
  return structuredClone({ day, phase, matchSec, survivors: living, dead: fallen,
    killCounts, assistCounts, spawnState, forbiddenAddedNow,
    forbiddenZoneIds: [...forbiddenIds], frameMapId: String(mapId || ''),
  });
}

export function publishSimulationFrame(frame, actions = {}) {
  if (actions.setSimulationFrame) {
    actions.setSimulationFrame(frame);
    return;
  }
  // Headless/legacy hosts can still use field setters. The React host publishes
  // through one reducer action, never a chain of partially updated UI states.
  for (const field of SIMULATION_FRAME_FIELDS) {
    actions[`set${field[0].toUpperCase()}${field.slice(1)}`]?.(frame[field]);
  }
}
