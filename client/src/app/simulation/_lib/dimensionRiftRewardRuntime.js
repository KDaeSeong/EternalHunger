import { addItemToInventory } from './inventoryRules.js';
import { getDimensionRiftGiftMeta, pickDimensionRiftChoice } from './dimensionRiftRuntime.js';
import { getActorTeamId } from './teamRuntime.js';
import { getCombatSpaceId, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';

const alive = (actor) => actor && Number.isFinite(Number(actor.hp)) && Number(actor.hp) > 0;
const idOf = (actor) => String(actor?._id || actor?.id || '');

const validIds = (ids) => Array.isArray(ids) && ids.length > 0
  && ids.every((id) => typeof id === 'string' && id.trim()) && new Set(ids).size === ids.length;

// Inspect restored state before creating or spending an offer. This is also
// used at match end, without choosing loot, inspecting bags, or consuming RNG.
export function inspectDimensionRiftRewardOffer(rift, ruleset = {}) {
  const result = rift?.resolution;
  if (!rift?.resolved || !result?.winnerTeamId) return { reason: 'no_result' };
  if (typeof result.id !== 'string' || !result.id || typeof result.winnerTeamId !== 'string'
    || !Number.isFinite(result.atSec) || result.atSec < 0 || !validIds(result.winnerMemberIds)) return { reason: 'invalid_result' };
  const expectedId = `${result.id}:gift`;
  if (rift.rewardOffer == null) {
    const fallback = Number(rift.day) === 2 ? 45 : Number(rift.day) === 3 ? 65 : 90;
    const credits = Number(ruleset.worldSpawns?.dimensionRift?.rewardCreditsByDay?.[String(rift.day)] ?? fallback);
    if (!Number.isSafeInteger(credits) || credits < 0) return { reason: 'invalid_reward_credits' };
    return { offer: { id: expectedId, status: 'pending', remaining: 1,
      memberIds: [...result.winnerMemberIds], creditsPerMember: credits,
      choiceItemId: '', choiceKey: '', nextAttemptAtSec: result.atSec } };
  }
  const offer = rift.rewardOffer;
  if (offer.status !== 'pending' || offer.remaining !== 1) return { reason: 'not_pending' };
  if (offer.id !== expectedId || !validIds(offer.memberIds)
    || offer.memberIds.length !== result.winnerMemberIds.length
    || offer.memberIds.some((id) => !result.winnerMemberIds.includes(id))
    || !Number.isSafeInteger(offer.creditsPerMember) || offer.creditsPerMember < 0
    || typeof offer.choiceItemId !== 'string' || typeof offer.choiceKey !== 'string'
    || !Number.isFinite(offer.nextAttemptAtSec) || offer.nextAttemptAtSec < result.atSec) return { reason: 'invalid_offer' };
  return { offer };
}

// Callers must first establish the terminal condition (actual match end or a
// complete no-revival proof). This commit neither chooses loot nor pays actors.
export function expireDimensionRiftReward(rift, {
  nowSec, ruleset = {}, reason, eligibilityEvidence = null,
} = {}) {
  if (rift?.rewardReceipt || rift?.rewardClosure || rift?.matchClosure) return { expired: false, reason: 'reward_closed' };
  if (!['match_end', 'recipients_eliminated'].includes(reason)) return { expired: false, reason: 'invalid_expiry_reason' };
  const inspected = inspectDimensionRiftRewardOffer(rift, ruleset);
  if (!inspected.offer) return { expired: false, reason: inspected.reason };
  if (!Number.isFinite(nowSec) || nowSec < rift.resolution.atSec) return { expired: false, reason: 'invalid_time' };
  const offer = inspected.offer;
  if (reason === 'recipients_eliminated' && (eligibilityEvidence?.nowSec !== nowSec
    || !Array.isArray(eligibilityEvidence?.recipients) || eligibilityEvidence.recipients.length !== offer.memberIds.length
    || eligibilityEvidence.recipients.some((entry) => !entry || typeof entry !== 'object')
    || new Set(eligibilityEvidence.recipients.map((entry) => entry.who)).size !== offer.memberIds.length
    || eligibilityEvidence.recipients.some((entry) => !offer.memberIds.includes(entry.who)
      || !Array.isArray(entry.paths) || entry.paths.length > 0))) return { expired: false, reason: 'invalid_expiry_evidence' };
  const closure = { id: `${offer.id}:closed`, disposition: 'expired', reason, atSec: nowSec,
    pendingReason: offer.pendingReason || 'not_attempted', winnerTeamId: rift.resolution.winnerTeamId,
    memberIds: [...offer.memberIds], itemId: offer.choiceItemId, expiredWorldGifts: 1,
    creditsPerMember: offer.creditsPerMember, itemsGranted: 0, creditsGranted: 0,
    ...(eligibilityEvidence ? { eligibilityEvidence: structuredClone(eligibilityEvidence) } : {}) };
  offer.status = 'expired';
  offer.remaining = 0;
  offer.nextAttemptAtSec = null;
  offer.closedAtSec = nowSec;
  offer.expiryReason = reason;
  rift.rewardOffer = offer;
  rift.rewardClosure = closure;
  return { expired: true, closure };
}

// The unopened gift belongs to the resolved world objective. Opening transfers
// its one catalog content item, never both a reusable gift token and its loot.
// A failed receive keeps the gift, credits and every inventory unchanged.
export function tryClaimDimensionRiftReward(rift, roster, {
  publicItems = [], ruleset = {}, nowSec = 0, day = rift?.day,
} = {}) {
  if (rift?.matchClosure || rift?.rewardClosure) return { claimed: false, reason: 'reward_closed' };
  if (!rift?.resolved || !rift.resolution?.winnerTeamId) return { claimed: false, reason: 'no_result' };
  if (rift.rewardReceipt) return { claimed: false, reason: 'already_claimed' };
  const now = Number(nowSec);
  if (nowSec == null || !Number.isFinite(now) || now < 0 || now < Number(rift.resolution.atSec)) return { claimed: false, reason: 'invalid_time' };
  const inspected = inspectDimensionRiftRewardOffer(rift, ruleset);
  if (!inspected.offer) return { claimed: false, reason: inspected.reason };
  const offer = inspected.offer;
  rift.rewardOffer = offer;
  if (now < Number(offer.nextAttemptAtSec || 0)) return { claimed: false, reason: 'retry_later' };
  const defer = (reason) => {
    const announce = offer.pendingReason !== reason;
    offer.pendingReason = reason;
    offer.nextAttemptAtSec = Math.round((now + 20) * 1e6) / 1e6;
    return { claimed: false, reason, announce };
  };
  const winners = [...new Map((roster || []).filter(alive).map((actor) => [idOf(actor), actor])).values()]
    .filter((actor) => offer.memberIds.includes(idOf(actor))
    && getActorTeamId(actor) === rift.resolution.winnerTeamId);
  if (!winners.length) return defer('no_living_recipient');
  if (!offer.choiceItemId) {
    const choice = pickDimensionRiftChoice(publicItems, rift.day);
    if (!choice.item) return defer('missing_catalog_content');
    offer.choiceItemId = String(choice.item._id);
    offer.choiceKey = choice.key;
  }
  const item = publicItems.find((row) => String(row?._id || '') === offer.choiceItemId && !row.deleted);
  if (!item) return defer('missing_catalog_content');
  const creditRecipients = winners.map((actor) => ({ actor, before: Number(actor.simCredits ?? 0) }));
  if (creditRecipients.some(({ before }) => !Number.isFinite(before) || before < 0
    || !Number.isFinite(before + offer.creditsPerMember))) return defer('invalid_current_credits');
  const local = winners.filter((actor) => String(actor.zoneId) === String(rift.zoneId) && getCombatSpaceId(actor) === WORLD_COMBAT_SPACE)
    .sort((a, b) => Number(a.teamSlot || 99) - Number(b.teamSlot || 99) || idOf(a).localeCompare(idOf(b)));
  let prepared = null;
  for (const actor of local) {
    const inventory = addItemToInventory(structuredClone(actor.inventory || []), item, offer.choiceItemId, 1, day, ruleset);
    if (Number(inventory?._lastAdd?.acceptedQty || 0) === 1) { prepared = { actor, inventory }; break; }
  }
  if (!prepared) return defer(local.length ? 'inventory_full' : 'recipient_away');
  const receipt = { id: offer.id, resolvedAtSec: rift.resolution.atSec, claimedAtSec: now,
    winnerTeamId: rift.resolution.winnerTeamId, who: idOf(prepared.actor), itemId: offer.choiceItemId,
    qty: 1, consumedWorldGift: 1, giftRarity: getDimensionRiftGiftMeta(rift.day)?.rarity || rift.giftRarity || '',
    inventoryReceipt: structuredClone(prepared.inventory._lastAdd),
    credits: creditRecipients.map(({ actor, before }) => ({ who: idOf(actor), qty: offer.creditsPerMember,
      before, after: before + offer.creditsPerMember })) };
  // Commit all mutations before any log/event/craft callback can re-enter.
  prepared.actor.inventory = prepared.inventory;
  creditRecipients.forEach(({ actor, before }) => { actor.simCredits = before + offer.creditsPerMember; });
  offer.remaining = 0;
  offer.status = 'claimed';
  offer.pendingReason = '';
  rift.rewardReceipt = receipt;
  return { claimed: true, receipt, representative: prepared.actor, item };
}
