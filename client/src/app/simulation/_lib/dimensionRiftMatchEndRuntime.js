import { expireDimensionRiftReward } from './dimensionRiftRewardRuntime.js';
import { leaveDimensionRiftSpace } from './dimensionRiftSpaceRuntime.js';
import { getCombatSpaceId } from '../../../utils/combatSpaceLogic.js';
import { reconcileCharacterCasts } from './characterCastRuntime.js';
import { describeDimensionRiftMatchClosure } from './dimensionRiftRewardPresentation.js';

// Only the authoritative match-end decision calls this. A missing recipient or
// a zero-HP snapshot during play is NOT proof that their team cannot revive.
export function closeDimensionRiftsAtMatchEnd(spawn, roster, {
  nowSec, day, phase, ruleset = {}, battleSettings = {}, actions = {},
} = {}) {
  if (!spawn || !Number.isFinite(nowSec) || nowSec < 0) return { closed: false, reason: 'invalid_time_or_spawn' };
  if (spawn.dimensionRiftMatchClosure) return { closed: false, reason: 'already_closed', summary: spawn.dimensionRiftMatchClosure };
  const settlements = [];
  const contestClosures = [];
  const rewardClosures = [];
  for (const rift of spawn.dimensionRifts || []) {
    if (!rift || typeof rift !== 'object') continue;
    if (rift.matchClosure) { settlements.push(rift.matchClosure); continue; }
    const wasResolved = rift.resolved === true;
    if (!wasResolved) {
      rift.resolved = true;
      rift.status = 'closed';
      rift.winnerTeamId = '';
      rift.loserTeamId = '';
      // Never turn an unfinished contest into a final free win, even if only
      // the overall winning team remains inside before the admission deadline.
      if (!rift.resolution) rift.resolution = { id: `${rift.id}:resolution`, atSec: nowSec,
        reason: 'match_end', winnerTeamId: '', winnerMemberIds: [], loserTeamIds: [] };
      contestClosures.push({ riftId: rift.id, zoneId: rift.zoneId, reason: 'match_end', atSec: nowSec });
    }
    let disposition = 'no_reward';
    let issue = '';
    if (rift.rewardReceipt) {
      disposition = 'claimed'; // Preserve the original receipt and paid resources.
    } else if (rift.rewardClosure) {
      disposition = rift.rewardClosure.disposition || 'invalid';
      issue = rift.rewardClosure.issue || '';
    } else {
      const expired = wasResolved ? expireDimensionRiftReward(rift, { nowSec, ruleset, reason: 'match_end' }) : { reason: 'no_result' };
      if (expired.expired) {
        disposition = 'expired';
        rewardClosures.push({ ...rift.rewardClosure, riftId: rift.id, zoneId: rift.zoneId });
      } else if (expired.reason !== 'no_result' || rift.rewardOffer != null) {
        disposition = 'invalid';
        issue = expired.reason;
        // Quarantine inconsistent input. Do not repair a partial/legacy claim
        // into another payable offer, guess a refund, or erase its evidence.
        rift.rewardClosure = { id: `${rift.id}:reward:closed`, disposition, reason: 'match_end',
          issue, atSec: nowSec, expiredWorldGifts: 0, itemsGranted: 0, creditsGranted: 0 };
        rewardClosures.push({ ...rift.rewardClosure, riftId: rift.id, zoneId: rift.zoneId });
      }
    }
    rift.matchClosure = { id: `${rift.id}:match-end`, riftId: rift.id, atSec: nowSec,
      reason: 'match_end', disposition, issue, contestClosed: !wasResolved,
      rewardClosedAtSec: rift.rewardClosure?.atSec ?? null, rewardClosureReason: rift.rewardClosure?.reason || '',
      expiredWorldGifts: disposition === 'expired' ? Number(rift.rewardClosure?.expiredWorldGifts || 0) : 0 };
    settlements.push(rift.matchClosure);
  }
  const summary = { atSec: nowSec, settlements: structuredClone(settlements),
    expiredWorldGifts: settlements.filter((row) => row.disposition === 'expired' && row.expiredWorldGifts === 1).length,
    expiredForElimination: settlements.filter((row) => row.disposition === 'expired' && row.rewardClosureReason === 'recipients_eliminated').length,
    invalidRewards: settlements.filter((row) => row.disposition === 'invalid').length,
    unfinishedContests: settlements.filter((row) => row.contestClosed).length };
  // Lock every offer AND spawning before callbacks can re-enter the runtime.
  spawn.dimensionRiftMatchClosure = summary;
  const spaceChanges = [];
  for (const actor of roster || []) {
    const space = getCombatSpaceId(actor);
    if (!space.startsWith('dimension_rift:')) continue;
    const change = leaveDimensionRiftSpace(actor, { id: space.slice('dimension_rift:'.length) }, nowSec, 'match_end',
      { allowInvalidEntry: true });
    if (change) spaceChanges.push(change);
  }
  const at = { day, phase, sec: nowSec };
  const emit = (kind, data) => actions.emitRunEvent?.(kind, data, at);
  spaceChanges.forEach((change) => emit('dimension_rift_space', change));
  if (spaceChanges.length) reconcileCharacterCasts(roster, nowSec, battleSettings, { ...actions, atNow: () => at });
  contestClosures.forEach((data) => emit('dimension_rift_closed', data));
  rewardClosures.forEach((data) => emit('dimension_rift_reward_closed', data));
  const explanation = describeDimensionRiftMatchClosure(summary);
  if (explanation) actions.addLog?.(explanation, 'system');
  return { closed: true, summary, spaceChanges };
}
