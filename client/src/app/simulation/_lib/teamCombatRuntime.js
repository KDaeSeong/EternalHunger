import { simulationRandom } from '../../../utils/simulationRandom.js';
import { canBasicAttackByStatus, canActVoluntarilyByStatus, isTargetableByStatus, getForcedControlEffect } from '../../../utils/statusLogic';
import { areSameTeam, getActorTeamId } from './teamRuntime';
import { isAiRecoveryLocked } from './survivorLifecycleRuntime';
import { lockActorActionTime } from './phaseActionTimelineRuntime';
import { isBasicAttackReady } from './combatTimingRuntime.js';
import { isInBasicAttackRange } from './combatSpatialRuntime.js';
import { shareCombatSpace, getCombatSpaceId } from '../../../utils/combatSpaceLogic.js';

const idOf = (actor) => String(actor?._id || actor?.id || '');

export function canJoinTeamCombat(actor, { nowSec = 0, zoneId = '', newDeadIds = [] } = {}) {
  return !!idOf(actor) && Number(actor.hp || 0) > 0 && !newDeadIds.includes(idOf(actor))
    && (!zoneId || String(actor.zoneId) === String(zoneId)) && canBasicAttackByStatus(actor)
    && !actor._pendingCharacterCast && !isAiRecoveryLocked(actor, nowSec) && Number(actor._actionReadyAtSec || 0) <= nowSec && isBasicAttackReady(actor, nowSec);
}

export function pickTeamFocusTarget(actor, targets, preferredId = '', roster = [actor]) {
  const candidates = targets.filter((target) => Number(target?.hp || 0) > 0 && !areSameTeam(actor, target)
    && String(target.zoneId) === String(actor.zoneId) && canBasicAttackByStatus(actor, target)
    && isTargetableByStatus(target) && isInBasicAttackRange(actor, target, roster));
  const held = candidates.find((target) => idOf(target) === preferredId);
  if (held) return held;
  return [...candidates].sort((a, b) => Number(a.hp) / Math.max(1, Number(a.maxHp || 100))
    - Number(b.hp) / Math.max(1, Number(b.maxHp || 100)) || Number(a.hp) - Number(b.hp) || idOf(a).localeCompare(idOf(b)))[0] || null;
}

export function recordCombatContribution(victim, attacker, damage, phaseIdx, nowSec = 0) {
  if (!victim || !attacker || !shareCombatSpace(victim, attacker) || damage <= 0 || areSameTeam(victim, attacker)) return;
  const id = idOf(attacker);
  const prior = victim._combatContributions || {};
  // Keep only the current/recent life history. Revival clears this ledger.
  const ledger = Object.fromEntries(Object.entries(prior).filter(([, row]) => phaseIdx - row.phaseIdx <= 4));
  ledger[id] = { damage: Number(ledger[id]?.damage || 0) + damage, phaseIdx, atSec: nowSec };
  victim._combatContributions = ledger;
}

// One local round, not a power multiplier on a remote teammate. Every eligible
// member spends its own action; deaths, movement and control effects invalidate
// later turns. Sides alternate, with an unbiased starting side each round.
export function runTeamCombatRound({ actor, target, survivorMap, newDeadIds = [], nowSec = 0,
  resolveStrike, emitRunEvent = () => {}, addLog = () => {}, at = null,
  random = simulationRandom, todaysSurvivors = [], estimatePower = () => 0, onlyActorId = '' } = {}) {
  const zoneId = String(actor?.zoneId || '');
  if (!actor || !target || !shareCombatSpace(actor, target) || !zoneId || zoneId !== String(target.zoneId) || areSameTeam(actor, target)) return { handled: false };
  const live = [...survivorMap.values()].filter((row) => Number(row?.hp || 0) > 0 && !newDeadIds.includes(idOf(row))
    && shareCombatSpace(actor, row) && String(row.zoneId) === zoneId && !isAiRecoveryLocked(row, nowSec));
  const sides = [actor, target].map((leader) => live.filter((row) => areSameTeam(leader, row)));
  if (sides.every((side) => side.length <= 1)) return { handled: false };
  const eligible = sides.map((side) => side.filter((row) => (!onlyActorId || idOf(row) === onlyActorId) && canJoinTeamCombat(row, { nowSec, zoneId, newDeadIds }))
    .sort((a, b) => Number(estimatePower(b)) - Number(estimatePower(a)) || idOf(a).localeCompare(idOf(b))));
  const participants = eligible.flat();
  if (!participants.length) return { handled: true, participants: [], strikes: [] };
  const committed = new Set(participants.map(idOf));
  for (let i = todaysSurvivors.length - 1; i >= 0; i--) if (committed.has(idOf(todaysSurvivors[i]))) todaysSurvivors.splice(i, 1);
  const first = random() < 0.5 ? 0 : 1;
  const queue = [];
  for (let n = 0; n < Math.max(...eligible.map((side) => side.length)); n++) {
    for (const side of [first, 1 - first]) if (eligible[side][n]) queue.push({ side, id: idOf(eligible[side][n]) });
  }
  const focus = sides.map((side) => side.find((row) => row._combatIntent?.focusTargetId)?._combatIntent.focusTargetId || '');
  const strikes = [];
  const encounterId = `${nowSec}:${zoneId}:${getCombatSpaceId(actor)}:${[getActorTeamId(actor), getActorTeamId(target)].sort().join(':')}`;
  emitRunEvent('team_engagement', { encounterId, zoneId, combatSpaceId: getCombatSpaceId(actor), teams: sides.map((side) => side.map(idOf)),
    participants: participants.map(idOf), atSec: nowSec }, at);
  addLog(`🤝 팀 교전: ${actor.teamName || actor.name} ${eligible[0].length}명 ↔ ${target.teamName || target.name} ${eligible[1].length}명`, 'combat-detail');
  for (const turn of queue) {
    const striker = survivorMap.get(turn.id);
    // Earlier hits can kill, move or control a queued participant.
    if (!striker || !shareCombatSpace(actor, striker) || Number(striker.hp || 0) <= 0 || newDeadIds.includes(turn.id) || String(striker.zoneId) !== zoneId
      || !canJoinTeamCombat(striker, { nowSec, zoneId, newDeadIds })) continue;
    const opponents = sides[1 - turn.side].map((row) => survivorMap.get(idOf(row))).filter((row) => row
      && !newDeadIds.includes(idOf(row)) && !isAiRecoveryLocked(row, nowSec));
    const victim = pickTeamFocusTarget(striker, opponents, focus[turn.side], [...survivorMap.values()]);
    if (!victim) continue;
    const heldFocus = focus[turn.side] === idOf(victim);
    if (!getForcedControlEffect(striker)) focus[turn.side] = idOf(victim);
    for (const member of getForcedControlEffect(striker) ? [] : sides[turn.side]) {
      const current = survivorMap.get(idOf(member));
      if (current?._combatIntent) current._combatIntent.focusTargetId = idOf(victim);
    }
    const beforeHp = Number(victim.hp);
    const result = resolveStrike(striker, victim);
    if (result?.performed === false) continue;
    const after = survivorMap.get(idOf(victim)) || victim;
    const hit = { who: turn.id, targetId: idOf(victim), teamId: getActorTeamId(striker), encounterId,
      damage: Math.max(0, beforeHp - Number(after.hp)), reason: getForcedControlEffect(striker) ? 'taunted_target' : heldFocus ? 'focus_fire' : 'vulnerable_target', zoneId };
    strikes.push(hit);
    emitRunEvent('team_strike', hit, at);
  }
  return { handled: true, participants: participants.map(idOf), strikes, encounterId };
}

export function commitRetreatCover(flee, chaser, roster, { nowSec = 0, newDeadIds = [], estimatePower = () => 1, roundSec = 8 } = {}) {
  if (!shareCombatSpace(flee, chaser)) return { helpers: [], bonus: 0 };
  const byId = new Map(roster.map((actor) => [idOf(actor), actor]));
  const helpers = [...byId.values()].filter((actor) => idOf(actor) !== idOf(flee) && shareCombatSpace(actor, flee) && areSameTeam(actor, flee)
    && canActVoluntarilyByStatus(actor)
    && canJoinTeamCombat(actor, { nowSec, zoneId: flee.zoneId, newDeadIds })
    && isInBasicAttackRange(actor, chaser, roster)
    && Number(actor.hp) / Math.max(1, Number(actor.maxHp || 100)) >= 0.4)
    .sort((a, b) => estimatePower(b) - estimatePower(a) || idOf(a).localeCompare(idOf(b))).slice(0, 2);
  if (!helpers.length) return { helpers: [], bonus: 0 };
  const coverPower = helpers.reduce((sum, actor) => sum + Math.max(0, estimatePower(actor)), 0);
  const bonus = Math.min(0.24, 0.12 * coverPower / Math.max(1, estimatePower(chaser)));
  if (bonus <= 0) return { helpers: [], bonus: 0 };
  lockActorActionTime(helpers, nowSec, roundSec);
  return { helpers: helpers.map(idOf), bonus };
}
