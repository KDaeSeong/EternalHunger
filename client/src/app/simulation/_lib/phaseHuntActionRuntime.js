import {
  getWildlifeDamageMultiplier,
  getWildlifeMasteryEntries,
} from '../../../utils/masteryLogic';
import { getActorDimensionRiftId } from '../../../utils/combatSpaceLogic.js';
import { getDamageBlockReason, hasActionBlockStatus, canBasicAttackByStatus, canUseSkillByStatus } from '../../../utils/statusLogic.js';
import {
  addItemToInventory,
  classifySpecialByName,
  consumeBossAtZone,
  consumeMutantWildlifeAtZone,
  consumeWildlifeAtZone,
  formatInvAddNote,
  itemIcon,
  markInventoryGoalItem,
  normalizeRewardDropEntries,
  tryAutoCraftFromLoot,
  tryImmediateCraftFromSpecial,
} from './simulationEngine';
import {
  gainText,
  getLootCraftOptions,
  shouldLogItemReceive,
} from './runEventRuntime';
import { createTimedWildlifeEncounter } from './wildlifeCombatRuntime.js';

export function runHuntAction({
  actions = {},
  state = {},
} = {}) {
  const {
    actor,
    canReviveThisMatch = false,
    craftables,
    currentActionSec = null,
    deferHuntSettlement = false,
    didMove = false,
    goalMissingIds = new Set(),
    isKioskZone = false,
    itemMetaById,
    itemNameById,
    mapObj,
    nextDay,
    nextPhase,
    nextSpawn,
    phaseIdxNow = 0,
    publicItems,
    preparedHunt = null,
    preparedHuntRole = '',
    recovering = false,
    reviveCutoffIdx = 0,
    ruleset,
    actualDamageDealt = null,
    actualDamageTaken = null,
    damageAlreadyApplied = false,
    encounterId = '',
    settlementHpBefore = null,
  } = state;
  const {
    addLog = () => {},
    applyLootCraftResult = () => {},
    atNow = () => null,
    emitDeathRunEventOnce = () => {},
    emitItemGainIfAny = () => {},
    emitObjectiveRunEvent = () => {},
    emitRunEvent = () => {},
    grantMasteries = () => {},
    setDeathMetadata = () => {},
  } = actions;
  const readCurrentActionSec = typeof currentActionSec === 'function'
    ? currentActionSec
    : () => Number(atNow?.()?.sec || 0);
  const updated = actor || {};
  const currentHpBefore = Number(updated.hp || 0);
  const hpBefore = settlementHpBefore != null && Number.isFinite(Number(settlementHpBefore)) ? Number(settlementHpBefore) : currentHpBefore;
  if (getActorDimensionRiftId(updated)) return { actor: updated, died: false, hunt: null, reason: 'combat_space' };
  if (!Number.isFinite(currentHpBefore) || currentHpBefore <= 0 || hasActionBlockStatus(updated)
    || !canBasicAttackByStatus(updated) && !canUseSkillByStatus(updated)) return { actor: updated, died: false, hunt: null };
  const actionKey = `phase:${phaseIdxNow}:cycle:${updated._actionCycleKey ?? 'legacy'}`;
  if (updated._huntActionKey === actionKey) return { actor: updated, died: false, hunt: null, reason: 'already_settled' };
  if (updated._wildlifeHunt && !preparedHunt) return { actor: updated, died: false, hunt: null, reason: 'active_encounter' };

  const engagementKey = encounterId || `hunt:${String(updated._id || '')}:${phaseIdxNow}:${String(updated._actionCycleKey ?? 'legacy')}`;
  const reserveOpts = { reserveOnly: deferHuntSettlement === true, claimantId: String(updated._id || ''), engagementId: engagementKey };
  const preparedRole = String(preparedHuntRole || '');
  const boss = preparedHunt && preparedRole === 'boss' ? preparedHunt
    : preparedHunt ? null : (recovering ? null : consumeBossAtZone(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, reserveOpts));
  const mutant = preparedHunt && preparedRole === 'mutant' ? preparedHunt
    : preparedHunt ? null : (boss ? null : (recovering ? null : consumeMutantWildlifeAtZone(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, reserveOpts)));
  const hunt = preparedHunt || boss || mutant || consumeWildlifeAtZone(nextSpawn, mapObj, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset,
    { moved: didMove, isKioskZone, recovering, ...reserveOpts });
  const isBossReward = preparedRole ? preparedRole === 'boss' : !!boss;
  const isMutantReward = preparedRole ? preparedRole === 'mutant' : !boss && !!mutant;

  if (!hunt) {
    return {
      actor: updated,
      died: false,
      hunt: null,
    };
  }

  if (deferHuntSettlement && hunt.pending) {
    const encounter = createTimedWildlifeEncounter(updated, hunt, {
      nowSec: readCurrentActionSec(), phaseIdxNow, nextDay, actionKey,
    });
    if (!encounter) return { actor: updated, died: false, hunt: null, reason: 'encounter_create_failed' };
    updated._wildlifeHunt = encounter;
    updated.aiCurrentAction = 'hunt_combat';
    addLog(`🎯 [${updated.name}] ${encounter.target.name} 추적 개시 · HP ${encounter.target.hp}`, 'highlight');
    emitRunEvent('hunt_start', { who: String(updated._id || ''), encounterId: encounter.id, kind: encounter.kind,
      zoneId: encounter.zoneId, wildlifeId: encounter.target._id, wildlifeName: encounter.target.name, wildlifeHp: encounter.target.hp,
      wildlifeMaxHp: encounter.target.maxHp, distance: Math.hypot(
        Number(updated?._spatial?.x || 0) - Number(encounter.target?._spatial?.x || 0),
        Number(updated?._spatial?.y || 0) - Number(encounter.target?._spatial?.y || 0)),
      actionKey }, atNow());
    return { actor: updated, died: false, hunt: { ...hunt, encounterId: encounter.id }, pending: true };
  }

  // The consumer has settled this encounter in the world. Reserve its action
  // before callbacks, so JSON restoration/re-entry cannot settle another target.
  updated._huntActionKey = actionKey;
  const defeated = hunt.defeated === true;
  const aggregateDamage = getDamageBlockReason(null, updated) ? 0 : Math.min(currentHpBefore, Math.max(0, Number(hunt.damage) || 0));
  const dmg = damageAlreadyApplied ? Math.max(0, Number(actualDamageTaken || 0)) : aggregateDamage;
  const damageDealt = defeated && actualDamageDealt != null && Number.isFinite(Number(actualDamageDealt))
    ? Math.max(0, Number(actualDamageDealt))
    : defeated ? Math.round((isBossReward ? 260 : isMutantReward ? 180 : 110) * getWildlifeDamageMultiplier(updated)) : 0;
  if (!damageAlreadyApplied) updated.hp = Math.max(0, currentHpBefore - aggregateDamage);
  const died = updated.hp <= 0;
  addLog(`🎯 [${updated.name}] ${hunt.log}${!damageAlreadyApplied && dmg > 0 ? ` (피해 -${dmg})` : ''}`, dmg > 0 ? 'highlight' : 'normal');
  if (died) {
    setDeathMetadata(updated, 'wildlife_hunt', { causeName: '사냥 중 치명상' });
    updated.deadAtPhaseIdx = phaseIdxNow;
    updated.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
    addLog(`💀 [${updated.name}]이(가) 사냥 중 치명상으로 사망했습니다.${defeated ? ' (동시 처치 전리품만 정산, 후속 행동 중단)' : ''}`, 'death');
    emitDeathRunEventOnce(updated, { reason: 'wildlife_hunt', cause: '사냥 중 치명상' });
  }
  const masteryEntries = getWildlifeMasteryEntries({ damageDealt, damageTaken: dmg });
  if (masteryEntries.length) grantMasteries(updated, masteryEntries, isBossReward ? '보스 사냥' : isMutantReward ? '변이 사냥' : '사냥');
  if (died) updated.hp = 0;

  const creditGain = defeated ? Math.max(0, Number(hunt?.credits || 0)) : 0;
  const receipt = { actionKey, ...(encounterId ? { encounterId } : {}), posthumous: died, settlement: 'same_encounter' };
  if (creditGain > 0) {
    updated.simCredits = Math.max(0, Number(updated.simCredits || 0) + creditGain);
    addLog(`💳 [${updated.name}] ${isBossReward ? '보스 처치 보상' : isMutantReward ? '변이 사냥 보상' : '사냥 보상'} (크레딧 +${creditGain})`, 'system');
    emitRunEvent('gain', { who: String(updated?._id || ''), itemId: 'CREDITS', qty: creditGain, source: isBossReward ? 'boss' : isMutantReward ? 'mutant' : 'hunt', kind: String(hunt?.kind || ''), zoneId: String(updated?.zoneId || ''), ...receipt }, atNow());

    if (isBossReward && !died) {
      const pb = 0.45;
      updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
      updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
      updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
      updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
    }
  }

  const drops = defeated ? normalizeRewardDropEntries(
    Array.isArray(hunt?.drops) ? hunt.drops : (hunt?.drop ? [hunt.drop] : []),
    publicItems,
    itemNameById,
  ) : [];
  if (isBossReward) {
    emitObjectiveRunEvent(updated, 'boss', {
      subkind: String(hunt?.kind || ''),
      credits: creditGain,
      damage: dmg,
      dropCount: drops.length,
      success: defeated,
      danger: defeated && !died && creditGain > 0 ? 0.45 : 0,
      ...receipt,
    }, atNow());
  }

  const goalMissingSet = goalMissingIds instanceof Set
    ? goalMissingIds
    : new Set((Array.isArray(goalMissingIds) ? goalMissingIds : []).map((id) => String(id || '')).filter(Boolean));

  const receivedDrops = [];
  const unreceivedDrops = [];
  for (const drop of drops) {
    if (!drop?.itemId || !drop?.item) continue;
    const qty = Math.max(1, Number(drop.qty || 1));
    const name = drop.item?.name || itemNameById?.[String(drop.itemId || '')] || '아이템';
    const huntDropItem = markInventoryGoalItem(drop.item, goalMissingSet.has(String(drop.itemId || '')));
    updated.inventory = addItemToInventory(updated.inventory, huntDropItem, drop.itemId, qty, nextDay, ruleset);
    const meta = updated.inventory?._lastAdd;
    const got = Math.max(0, Number(meta?.acceptedQty ?? qty));
    if (got > 0) receivedDrops.push({ itemId: String(drop.itemId), qty: got });
    if (got < qty) unreceivedDrops.push({ itemId: String(drop.itemId), qty: qty - got, reason: String(meta?.reason || 'inventory_rejected') });
    if (shouldLogItemReceive(got, meta)) {
      addLog(`🧾 [${updated.name}] 드랍: ${itemIcon(drop.item || { type: '' })} [${name}] ${gainText(got)}${formatInvAddNote(meta, qty, updated.inventory, ruleset)}`, 'normal');
    }
    emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(drop.itemId || ''), source: isBossReward ? 'boss' : isMutantReward ? 'mutant' : 'hunt', kind: String(hunt?.kind || ''), zoneId: String(updated?.zoneId || ''), ...receipt }, atNow());

    // Loot from the same simultaneous kill remains in the death snapshot.
    // Crafting with it would be a new action and is forbidden after lethal damage.
    if (died || Number(updated.hp || 0) <= 0 || got <= 0) continue;

    const specialKind = classifySpecialByName(name);
    const immediate = tryImmediateCraftFromSpecial(updated, specialKind, String(drop.itemId || ''), publicItems, itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
    if (immediate?.changed) {
      updated.inventory = immediate.inventory;
    }
    (immediate?.logs || []).forEach((message) => addLog(String(message), immediate.changed ? 'highlight' : 'system'));
    if (Number(immediate?.pvpBonus || 0) > 0) {
      const pb = Number(immediate.pvpBonus || 0);
      updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
      updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
      updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
      updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
    }

    const crafted = immediate?.changed ? null : tryAutoCraftFromLoot(updated.inventory, drop.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
    applyLootCraftResult(updated, crafted, itemMetaById, atNow(), updated?.zoneId);
  }

  emitRunEvent('hunt_settlement', { who: String(updated._id || ''), zoneId: String(updated.zoneId || ''),
    kind: String(hunt.kind || ''), defeated, died, hpBefore, hpAfter: updated.hp, damage: dmg,
    damageDealt, credits: creditGain, receivedDrops, unreceivedDrops, ...receipt }, atNow());

  return {
    actor: updated,
    died,
    hunt,
  };
}
