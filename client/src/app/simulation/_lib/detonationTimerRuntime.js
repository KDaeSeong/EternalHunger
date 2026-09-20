import { roundCombatTime } from './combatTimingRuntime.js';
import { ENDGAME_START } from './suddenDeathRuntime.js';

export const DETONATION_MAX_SEC = 30;
export const FINAL_NIGHT_DETONATION_BONUS_SEC = 15;
const finite = (value, fallback) => value != null && Number.isFinite(Number(value)) ? Number(value) : fallback;

export function getDetonationBaseMaxSec(ruleset) {
  return Math.max(0, Math.min(DETONATION_MAX_SEC, finite(ruleset?.detonation?.maxSec, DETONATION_MAX_SEC)));
}

export function getDetonationMaxSec(actor, ruleset) {
  return getDetonationBaseMaxSec(ruleset) + (actor?.detonationFinalNight === true ? FINAL_NIGHT_DETONATION_BONUS_SEC : 0);
}

// Own the actor before calling. Never trust a cap inflated by an old kill reward.
export function normalizeDetonationTimer(actor, ruleset, { finalNight = actor?.detonationFinalNight === true } = {}) {
  if (!actor || !ruleset?.detonation) return actor;
  actor.detonationFinalNight = finalNight === true;
  actor.detonationMaxSec = getDetonationMaxSec(actor, ruleset);
  actor.detonationSec = roundCombatTime(Math.max(0, Math.min(actor.detonationMaxSec,
    finite(actor.detonationSec, finite(ruleset.detonation.startSec, 20)))));
  return actor;
}

export function resetDetonationTimer(actor, ruleset, { newMatch = false, finalNight = actor?.detonationFinalNight === true } = {}) {
  if (!actor || !ruleset?.detonation) return actor;
  if (newMatch) {
    actor.detonationFinalNightBonusGranted = false;
    actor.detonationFinalNightBonusAtSec = null;
  }
  // Revival retains the already-granted marker but does not award another 15s.
  actor.detonationSec = finite(ruleset.detonation.startSec, 20);
  return normalizeDetonationTimer(actor, ruleset, { finalNight: !newMatch && finalNight });
}

export function restoreDetonationTime(actor, seconds, ruleset) {
  if (!actor || !(Number(actor.hp) > 0) || !ruleset?.detonation) return 0;
  normalizeDetonationTimer(actor, ruleset);
  const before = actor.detonationSec;
  actor.detonationSec = Math.min(actor.detonationMaxSec, roundCombatTime(before + Math.max(0, finite(seconds, 0))));
  return roundCombatTime(actor.detonationSec - before);
}

export function applyFinalNightDetonationBonus({ actors = [], ruleset, day, phase, atSec = 0, previousGrant = null, actions = {} } = {}) {
  if (!ruleset?.detonation || previousGrant || Number(day) !== ENDGAME_START.day || phase !== ENDGAME_START.phase) return previousGrant;
  const actorIds = [], seen = new Set();
  const at = { day: Number(day), phase, sec: roundCombatTime(atSec) };
  for (const actor of actors) {
    const who = String(actor?._id || '');
    if (!who || seen.has(who) || !(Number(actor.hp) > 0)) continue;
    seen.add(who);
    if (actor.detonationFinalNightBonusGranted === true) continue;
    normalizeDetonationTimer(actor, ruleset, { finalNight: false });
    const beforeSec = actor.detonationSec;
    actor.detonationFinalNight = true;
    actor.detonationFinalNightBonusGranted = true;
    actor.detonationFinalNightBonusAtSec = at.sec;
    actor.detonationMaxSec = getDetonationMaxSec(actor, ruleset);
    actor.detonationSec = roundCombatTime(beforeSec + FINAL_NIGHT_DETONATION_BONUS_SEC);
    actorIds.push(who);
    const evidence = { who, reason: 'final_night', beforeSec, afterSec: actor.detonationSec,
      addedSec: FINAL_NIGHT_DETONATION_BONUS_SEC, maxSec: actor.detonationMaxSec, zoneId: String(actor.zoneId || '') };
    actions.emitRunEvent?.('detonation_bonus', evidence, { ...at });
    actions.addLog?.(`⏱️ [${actor.name || who}] 마지막 밤: 금지구역 타이머 ${beforeSec}초 +15초 → ${actor.detonationSec}초 (최대 ${actor.detonationMaxSec}초)`, 'highlight');
  }
  // The match ledger prevents late revivals or a repeated phase entry from
  // receiving a new grant. Actor markers also survive normalization/save-load.
  return { version: 1, ...at, actorIds };
}
