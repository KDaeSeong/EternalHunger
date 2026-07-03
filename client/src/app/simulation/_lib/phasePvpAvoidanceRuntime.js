import {
  applyAiRecoveryWindow,
  bfsPickSafestZone,
  upsertRuntimeSurvivor,
} from './simulationEngine';

export function buildZonePopulation(survivorMap, newDeadIds) {
  const population = {};
  for (const survivor of survivorMap.values()) {
    if (!survivor || Number(survivor.hp || 0) <= 0) continue;
    if (newDeadIds.includes(survivor._id)) continue;
    const zoneId = String(survivor.zoneId || '');
    if (!zoneId) continue;
    population[zoneId] = (population[zoneId] || 0) + 1;
  }
  return population;
}

export function resolvePvpAvoidanceMove({
  actions = {},
  state = {},
  text = {},
} = {}) {
  const {
    actor,
    currentActionSec = () => 0,
    forbiddenIds = new Set(),
    newDeadIds = [],
    opponent,
    reason = 'avoid_power',
    recoverSec = 4,
    ruleset = {},
    safeZoneSec = 0,
    survivorMap,
    zoneGraph = {},
  } = state;
  const {
    addLog = () => {},
    atNow = () => null,
    emitRunEvent = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
  } = actions;
  const {
    holdLog = () => '',
    holdReason = `${String(reason || 'avoid')}_hold`,
    moveLog = () => '',
  } = text;

  const from = String(actor?.zoneId || '');
  const population = buildZonePopulation(survivorMap, newDeadIds);
  const depthMax = Math.max(1, Math.floor(Number(ruleset?.ai?.safeSearchDepth ?? 3)));
  const minDelta = Math.max(0, Math.floor(Number(ruleset?.ai?.recoverMinSaferDelta ?? 1)));
  const pick = bfsPickSafestZone(from, zoneGraph, forbiddenIds, population, { maxDepth: depthMax, minDelta });
  const dest = String(pick?.nextStep || '');

  if (dest && dest !== from) {
    actor.zoneId = dest;
    applyAiRecoveryWindow(actor, currentActionSec(), {
      reason,
      opponentId: String(opponent?._id || ''),
      recoverSec,
      safeZoneSec,
    });
    upsertRuntimeSurvivor(survivorMap, actor);
    addLog(moveLog({ dest, from, getZoneName }) || `🏃 [${actor.name}] 교전 회피: ${getZoneName(from)} → ${getZoneName(dest)}`, 'system');
    emitRunEvent('move', { who: String(actor?._id || ''), name: actor?.name, from, to: dest, reason }, atNow());
    return { moved: true, toZoneId: dest };
  }

  applyAiRecoveryWindow(actor, currentActionSec(), {
    reason: holdReason,
    opponentId: String(opponent?._id || ''),
    recoverSec: Math.max(1, Number(text?.holdRecoverSec ?? recoverSec)),
  });
  addLog(holdLog({ getZoneName }) || `🏃 [${actor.name}] 교전 회피`, 'system');
  return { moved: false, toZoneId: '' };
}
