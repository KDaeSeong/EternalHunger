import {
  getWildlifeDamageMultiplier,
  getWildlifeMasteryEntries,
} from '../../../utils/masteryLogic';
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

export function runHuntAction({
  actions = {},
  state = {},
} = {}) {
  const {
    actor,
    canReviveThisMatch = false,
    craftables,
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
    recovering = false,
    reviveCutoffIdx = 0,
    ruleset,
    wasAlive = true,
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
  const updated = actor || {};

  const boss = recovering ? null : consumeBossAtZone(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset);
  const mutant = boss ? null : (recovering ? null : consumeMutantWildlifeAtZone(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset));
  const hunt = boss || mutant || consumeWildlifeAtZone(nextSpawn, mapObj, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, { moved: didMove, isKioskZone, recovering });
  const isBossReward = !!boss;
  const isMutantReward = !boss && !!mutant;

  if (!hunt) {
    return {
      actor: updated,
      died: false,
      hunt: null,
    };
  }

  const dmg = Math.max(0, Number(hunt.damage || 0));
  const estimatedWildlifeDamage = Math.round((isBossReward ? 260 : isMutantReward ? 180 : 110) * getWildlifeDamageMultiplier(updated));
  updated.hp = Math.max(0, Number(updated.hp || 0) - dmg);
  addLog(`🎯 [${updated.name}] ${hunt.log}${dmg > 0 ? ` (피해 -${dmg})` : ''}`, dmg > 0 ? 'highlight' : 'normal');
  grantMasteries(updated, getWildlifeMasteryEntries({ damageDealt: estimatedWildlifeDamage, damageTaken: dmg }), isBossReward ? '보스 사냥' : isMutantReward ? '변이 사냥' : '사냥');

  const creditGain = Math.max(0, Number(hunt?.credits || 0));
  if (creditGain > 0) {
    updated.simCredits = Math.max(0, Number(updated.simCredits || 0) + creditGain);
    addLog(`💳 [${updated.name}] ${isBossReward ? '보스 처치 보상' : isMutantReward ? '변이 사냥 보상' : '사냥 보상'} (크레딧 +${creditGain})`, 'system');
    emitRunEvent('gain', { who: String(updated?._id || ''), itemId: 'CREDITS', qty: creditGain, source: isBossReward ? 'boss' : isMutantReward ? 'mutant' : 'hunt', kind: String(hunt?.kind || ''), zoneId: String(updated?.zoneId || '') }, atNow());

    if (isBossReward) {
      const pb = 0.45;
      updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
      updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
      updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
      updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
    }
  }

  const drops = normalizeRewardDropEntries(
    Array.isArray(hunt?.drops) ? hunt.drops : (hunt?.drop ? [hunt.drop] : []),
    publicItems,
    itemNameById,
  );
  if (isBossReward) {
    emitObjectiveRunEvent(updated, 'boss', {
      subkind: String(hunt?.kind || ''),
      credits: creditGain,
      damage: dmg,
      dropCount: drops.length,
      success: true,
      danger: 0.45,
    }, atNow());
  }

  const goalMissingSet = goalMissingIds instanceof Set
    ? goalMissingIds
    : new Set((Array.isArray(goalMissingIds) ? goalMissingIds : []).map((id) => String(id || '')).filter(Boolean));

  for (const drop of drops) {
    if (!drop?.itemId || !drop?.item) continue;
    const qty = Math.max(1, Number(drop.qty || 1));
    const name = drop.item?.name || itemNameById?.[String(drop.itemId || '')] || '아이템';
    const huntDropItem = markInventoryGoalItem(drop.item, goalMissingSet.has(String(drop.itemId || '')));
    updated.inventory = addItemToInventory(updated.inventory, huntDropItem, drop.itemId, qty, nextDay, ruleset);
    const meta = updated.inventory?._lastAdd;
    const got = Math.max(0, Number(meta?.acceptedQty ?? qty));
    if (shouldLogItemReceive(got, meta)) {
      addLog(`🧾 [${updated.name}] 드랍: ${itemIcon(drop.item || { type: '' })} [${name}] ${gainText(got)}${formatInvAddNote(meta, qty, updated.inventory, ruleset)}`, 'normal');
    }
    emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(drop.itemId || ''), source: isBossReward ? 'boss' : isMutantReward ? 'mutant' : 'hunt', kind: String(hunt?.kind || ''), zoneId: String(updated?.zoneId || '') }, atNow());

    const specialKind = classifySpecialByName(name);
    const immediate = tryImmediateCraftFromSpecial(updated, specialKind, String(drop.itemId || ''), publicItems, itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
    if (immediate?.changed) {
      updated.inventory = immediate.inventory;
      (Array.isArray(immediate.logs) ? immediate.logs : []).forEach((message) => addLog(String(message), 'highlight'));
    }
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

  const died = updated.hp <= 0 && wasAlive;
  if (died) {
    setDeathMetadata(updated, 'wildlife_hunt', { causeName: '사냥 중 치명상' });
    updated.deadAtPhaseIdx = phaseIdxNow;
    updated.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
    addLog(`💀 [${updated.name}]이(가) 사냥 중 치명상을 입고 사망했습니다.`, 'death');
    emitDeathRunEventOnce(updated, { reason: 'wildlife_hunt', cause: '사냥 중 치명상' });
  }

  return {
    actor: updated,
    died,
    hunt,
  };
}
