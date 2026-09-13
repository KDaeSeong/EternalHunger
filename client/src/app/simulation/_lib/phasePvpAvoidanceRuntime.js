import {
  applyAiRecoveryWindow,
  upsertRuntimeSurvivor,
} from './simulationEngine';
import { assessTeamCombat, pickTeamSafeZone } from './teamTacticsRuntime';
import { estimateMovePower } from './movePowerRuntime';
import { getActorTeamId } from './teamRuntime';
import { canMoveByStatus } from '../../../utils/statusLogic.js';
import { shareCombatSpace } from '../../../utils/combatSpaceLogic.js';
import { getActorDimensionRiftId } from './dimensionRiftSpaceRuntime.js';
import { withdrawFromDimensionRift } from './dimensionRiftWithdrawalRuntime.js';
import {
  consumeRetreatAvoidDecision,
  getRetreatAvoidZoneId,
  rememberRetreatOrigin,
} from './retreatDecisionMemoryRuntime.js';

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
    actor: requestedActor,
    currentActionSec = () => 0,
    forbiddenIds = new Set(),
    newDeadIds = [],
    opponent: requestedOpponent,
    reason = 'avoid_power',
    recoverSec = 4,
    ruleset = {},
    estimatePower = (row) => estimateMovePower(row, { ruleset }),
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

  const actor = survivorMap?.get(String(requestedActor?._id || '')) || requestedActor;
  const opponent = survivorMap?.get(String(requestedOpponent?._id || '')) || requestedOpponent;
  const from = String(actor?.zoneId || '');
  // A failed movement must not grant the AI's temporary combat protection.
  if (!actor || Number(actor.hp || 0) <= 0 || !canMoveByStatus(actor)
    || newDeadIds.includes(actor._id)
    || (opponent && (Number(opponent.hp || 0) <= 0 || newDeadIds.includes(opponent._id)
      || !shareCombatSpace(actor, opponent) || String(actor.zoneId) !== String(opponent.zoneId)))) {
    return { moved: false, toZoneId: '', blocked: true };
  }
  if (getActorDimensionRiftId(actor)) {
    const exit = withdrawFromDimensionRift(actor, currentActionSec(), {
      reason, opponentId: opponent?._id || '', actions: { addLog, atNow, emitRunEvent },
    });
    if (!exit) return { moved: false, toZoneId: '', blocked: true };
    upsertRuntimeSurvivor(survivorMap, actor);
    return { moved: false, withdrawn: true, toZoneId: from, riftId: exit.riftId };
  }
  const roster = [...survivorMap.values()].filter((row) => !newDeadIds.includes(row?._id));
  const depthMax = Math.max(1, Math.floor(Number(ruleset?.ai?.safeSearchDepth ?? 3)));
  const assessment = assessTeamCombat(actor, roster, { estimatePower });
  const avoidZoneId = getRetreatAvoidZoneId(actor);
  const pick = pickTeamSafeZone(actor, roster, zoneGraph, forbiddenIds, {
    maxDepth: depthMax,
    estimatePower,
    excludedZoneIds: avoidZoneId ? [avoidZoneId] : [],
  });
  consumeRetreatAvoidDecision(actor);
  const dest = String(pick?.nextStep || '');

  if (dest && dest !== from) {
    actor.zoneId = dest;
    rememberRetreatOrigin(actor, from);
    applyAiRecoveryWindow(actor, currentActionSec(), {
      reason,
      opponentId: String(opponent?._id || ''),
      recoverSec,
      safeZoneSec,
    });
    upsertRuntimeSurvivor(survivorMap, actor);
    addLog(moveLog({ dest, from, getZoneName }) || `🏃 [${actor.name}] 교전 회피: ${getZoneName(from)} → ${getZoneName(dest)}`, 'system');
    emitRunEvent('move', { who: String(actor?._id || ''), name: actor?.name, from, to: dest, reason, teamId: getActorTeamId(actor), teamAssessment: assessment }, atNow());
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
