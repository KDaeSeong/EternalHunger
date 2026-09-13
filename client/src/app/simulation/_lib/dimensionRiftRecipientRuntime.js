import { getActorTeamId } from './teamRuntime.js';
import { getRevivePhaseConfig, getDeathAtSec, getCorpseRemainingSec } from './revivalPolicyRuntime.js';
import { inspectDimensionRiftRewardOffer, expireDimensionRiftReward } from './dimensionRiftRewardRuntime.js';

const idOf = (actor) => String(actor?._id || actor?.id || '');
const alive = (actor) => actor?.hp != null && Number.isFinite(Number(actor.hp)) && Number(actor.hp) > 0;

function confirmedDeath(actor, phaseIdxNow, nowSec) {
  const deathPhase = actor?.deadAtPhaseIdx;
  const deathAt = getDeathAtSec(actor);
  const rawDeathAt = actor?._deathAt ?? actor?.deathAtSec ?? actor?.corpseStartedAtSec;
  return actor?.hp === 0 && Number.isSafeInteger(deathPhase)
    && deathPhase >= 0 && deathPhase <= phaseIdxNow && Number.isFinite(rawDeathAt) && deathAt != null && deathAt <= nowSec;
}

// This is a possibility assessment, not a revival command or a promise that a
// revival will occur. A distant kiosk, insufficient current credits, or today's
// lack of a local teammate cannot prove that a future revival is impossible.
export function assessDimensionRiftRecipients(rift, currentRoster, {
  dead = [], rosterComplete = false, canReviveThisMatch, phaseIdxNow, nowSec,
  reviveCfg = {}, ruleset = {},
} = {}) {
  const waiting = (reason) => ({ permanentlyEliminated: false, reason });
  const inspected = inspectDimensionRiftRewardOffer(rift, ruleset);
  if (!inspected.offer) return waiting(inspected.reason);
  if (!Number.isSafeInteger(phaseIdxNow) || phaseIdxNow < 0 || !Number.isFinite(nowSec)
    || nowSec < rift.resolution.atSec) return waiting('invalid_time');
  if ((currentRoster || []).some((actor) => alive(actor) && inspected.offer.memberIds.includes(idOf(actor)))) return waiting('living_recipient');
  // Current actor identities supersede stale corpse copies, including revival.
  const byId = new Map([...dead, ...(currentRoster || [])].filter(idOf).map((actor) => [idOf(actor), actor]));
  const recipients = inspected.offer.memberIds.map((id) => byId.get(id));
  if (recipients.some((actor) => !actor)) return waiting('unknown_recipient');
  if (recipients.some(alive)) return waiting('living_recipient');
  if (recipients.some((actor) => getActorTeamId(actor) !== rift.resolution.winnerTeamId)) return waiting('recipient_team_changed');
  if (recipients.some((actor) => !confirmedDeath(actor, phaseIdxNow, nowSec)
    || getDeathAtSec(actor) < rift.resolution.atSec)) return waiting('unconfirmed_death');
  if (canReviveThisMatch !== true && canReviveThisMatch !== false) return waiting('unknown_revival_policy');
  const cfg = getRevivePhaseConfig(reviveCfg);
  const clocks = [cfg.autoReviveIdx, cfg.paidReviveStartIdx, cfg.paidReviveCutoffIdx, cfg.wipeProtectionCutoffIdx];
  if (canReviveThisMatch && (!clocks.every((value) => Number.isSafeInteger(value) && value >= 0)
    || !Number.isFinite(cfg.corpseWindowSec) || !Number.isFinite(cfg.corpseInteractSec))) return waiting('invalid_revival_policy');
  const team = [...byId.values()].filter((actor) => getActorTeamId(actor) === rift.resolution.winnerTeamId);
  const expectedIds = [...new Set(team.flatMap((actor) => Array.isArray(actor.matchTeamRosterIds) ? actor.matchTeamRosterIds.map(String) : []))];
  const incompleteTeam = rosterComplete !== true || expectedIds.some((id) => !byId.has(id)
    || getActorTeamId(byId.get(id)) !== rift.resolution.winnerTeamId)
    || team.some((actor) => !alive(actor) && !confirmedDeath(actor, phaseIdxNow, nowSec));
  const wipeMayRestoreTeam = phaseIdxNow <= cfg.wipeProtectionCutoffIdx && team.some((actor) =>
    confirmedDeath(actor, phaseIdxNow, nowSec) && !actor.revivedOnce
    && actor.deadAtPhaseIdx <= cfg.wipeProtectionCutoffIdx && actor.deadAtPhaseIdx <= cfg.autoReviveIdx);
  const teamCanRecover = team.some(alive) || wipeMayRestoreTeam ? true : incompleteTeam ? null : false;
  const evidence = recipients.map((actor) => {
    const paths = [];
    if (canReviveThisMatch) {
      // Corpse interaction does not test revivedOnce in the real runtime.
      if (phaseIdxNow <= cfg.wipeProtectionCutoffIdx && teamCanRecover !== false
        && getCorpseRemainingSec(actor, nowSec, cfg) >= cfg.corpseInteractSec) paths.push('corpse_interaction');
      if (!actor.revivedOnce && actor.deadAtPhaseIdx <= cfg.autoReviveIdx
        && ((phaseIdxNow <= cfg.wipeProtectionCutoffIdx && actor.deadAtPhaseIdx <= cfg.wipeProtectionCutoffIdx)
          || (phaseIdxNow <= cfg.autoReviveIdx && teamCanRecover !== false))) paths.push('auto');
      if (!actor.revivedOnce && actor.deadAtPhaseIdx <= cfg.paidReviveCutoffIdx
        && Math.max(phaseIdxNow, cfg.paidReviveStartIdx) <= cfg.paidReviveCutoffIdx
        && teamCanRecover !== false) paths.push('kiosk_paid');
    }
    return { who: idOf(actor), deathPhaseIdx: actor.deadAtPhaseIdx, deathAtSec: getDeathAtSec(actor),
      revivedOnce: Boolean(actor.revivedOnce), paths };
  });
  const proof = { phaseIdxNow, nowSec, canReviveThisMatch, teamCanRecover,
    knownTeamIds: team.map(idOf), expectedTeamIds: expectedIds,
    policy: canReviveThisMatch ? { autoReviveIdx: cfg.autoReviveIdx, paidReviveStartIdx: cfg.paidReviveStartIdx,
      paidReviveCutoffIdx: cfg.paidReviveCutoffIdx, wipeProtectionCutoffIdx: cfg.wipeProtectionCutoffIdx,
      corpseWindowSec: cfg.corpseWindowSec, corpseInteractSec: cfg.corpseInteractSec } : null, recipients: evidence };
  return { permanentlyEliminated: evidence.every((entry) => !entry.paths.length),
    reason: evidence.some((entry) => entry.paths.length) ? 'revival_still_possible' : 'recipients_eliminated', proof };
}

export function expireEliminatedDimensionRiftReward(rift, currentRoster, options = {}) {
  if (rift?.rewardReceipt || rift?.rewardClosure || rift?.matchClosure) return { expired: false, reason: 'reward_closed' };
  const eligibility = assessDimensionRiftRecipients(rift, currentRoster, options);
  if (!eligibility.permanentlyEliminated) return { expired: false, reason: eligibility.reason };
  return expireDimensionRiftReward(rift, { nowSec: options.nowSec, ruleset: options.ruleset,
    reason: 'recipients_eliminated', eligibilityEvidence: eligibility.proof });
}
