import {
  addItemToInventory,
  classifySpecialByName,
  formatInvAddNote,
  openSpawnedLegendaryCrate,
  tryAutoCraftFromLoot,
  tryImmediateCraftFromSpecial,
} from './simulationEngine';
import {
  gainText,
  getLootCraftOptions,
  shouldLogItemReceive,
} from './runEventRuntime';

export function openLegendaryCrateForActor({
  actions = {},
  state = {},
} = {}) {
  const {
    actor,
    craftables,
    didMove = false,
    itemMetaById,
    itemNameById,
    nextDay,
    nextPhase,
    nextSpawn,
    phaseIdxNow = 0,
    publicItems,
    ruleset,
  } = state;
  const {
    addLog = () => {},
    applyLootCraftResult = () => {},
    atNow = () => null,
    emitItemGainIfAny = () => {},
    emitObjectiveRunEvent = () => {},
    emitRunEvent = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
    grantMastery = () => {},
  } = actions;
  const updated = actor || {};
  const legendary = openSpawnedLegendaryCrate(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, { moved: didMove });

  if (!legendary) {
    return {
      actor: updated,
      opened: false,
    };
  }

  updated.inventory = addItemToInventory(updated.inventory, legendary.item, legendary.itemId, legendary.qty, nextDay, ruleset);
  const meta = updated.inventory?._lastAdd;
  const got = Math.max(0, Number(meta?.acceptedQty ?? legendary.qty));
  const name = legendary.item?.name || '전설 재료';
  if (shouldLogItemReceive(got, meta, { important: true })) {
    addLog(`🟪 [${updated.name}] ${getZoneName(updated.zoneId)}에서 🎁 전설 재료 상자를 열어 [${name}] ${gainText(got)}${formatInvAddNote(meta, legendary.qty, updated.inventory, ruleset)}`, 'normal');
  }
  emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(legendary.itemId || ''), source: 'legend', zoneId: String(updated?.zoneId || '') }, atNow());
  if (got > 0) grantMastery(updated, 'search', 350, '항공 보급');

  const specialKind = classifySpecialByName(String(legendary?.item?.name || ''));
  const immediate = tryImmediateCraftFromSpecial(updated, specialKind, String(legendary.itemId || ''), publicItems, itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
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

  const credits = Math.max(0, Number(legendary?.credits || 0));
  if (credits > 0) {
    updated.simCredits = Math.max(0, Number(updated.simCredits || 0) + credits);
    addLog(`💳 [${updated.name}] 전설 상자 보상 크레딧 +${credits}`, 'system');
    emitRunEvent('gain', { who: String(updated?._id || ''), itemId: 'CREDITS', qty: credits, source: 'legend', zoneId: String(updated?.zoneId || '') }, atNow());
  }

  emitObjectiveRunEvent(updated, 'legendary_crate', {
    subkind: 'legendary_material',
    itemId: String(legendary.itemId || ''),
    itemName: String(name || ''),
    qty: got,
    credits,
    success: got > 0,
    danger: Math.max(0, Number(immediate?.pvpBonus || 0)),
  }, atNow());

  const bonusDrops = Array.isArray(legendary?.bonusDrops) ? legendary.bonusDrops : [];
  for (const bonusDrop of bonusDrops) {
    if (!bonusDrop?.itemId || !bonusDrop?.item) continue;
    const qty = Math.max(1, Number(bonusDrop.qty || 1));
    updated.inventory = addItemToInventory(updated.inventory, bonusDrop.item, bonusDrop.itemId, qty, nextDay, ruleset);
    const metaB = updated.inventory?._lastAdd;
    const gotB = Math.max(0, Number(metaB?.acceptedQty ?? qty));
    const nameB = bonusDrop.item?.name || '전설 재료';
    if (shouldLogItemReceive(gotB, metaB)) {
      addLog(`🟪 [${updated.name}] 전설 상자 추가드랍: [${nameB}] ${gainText(gotB)}${formatInvAddNote(metaB, qty, updated.inventory, ruleset)}`, 'highlight');
    }
    emitItemGainIfAny(gotB, { who: String(updated?._id || ''), itemId: String(bonusDrop.itemId || ''), source: 'legend', zoneId: String(updated?.zoneId || '') }, atNow());

    const bonusKind = classifySpecialByName(String(bonusDrop?.item?.name || nameB || ''));
    const immediateBonus = tryImmediateCraftFromSpecial(updated, bonusKind, String(bonusDrop.itemId || ''), publicItems, itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
    if (immediateBonus?.changed) {
      updated.inventory = immediateBonus.inventory;
      (Array.isArray(immediateBonus.logs) ? immediateBonus.logs : []).forEach((message) => addLog(String(message), 'highlight'));
    }
    if (Number(immediateBonus?.pvpBonus || 0) > 0) {
      const pb = Number(immediateBonus.pvpBonus || 0);
      updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
      updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
      updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
      updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
    }
    if (gotB > 0 && !immediateBonus?.changed) {
      const craftedB = tryAutoCraftFromLoot(updated.inventory, bonusDrop.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
      applyLootCraftResult(updated, craftedB, itemMetaById, atNow(), updated?.zoneId);
    }
  }

  const crafted = immediate?.changed ? null : tryAutoCraftFromLoot(updated.inventory, legendary.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
  applyLootCraftResult(updated, crafted, itemMetaById, atNow(), updated?.zoneId);

  return {
    actor: updated,
    legendary,
    opened: true,
  };
}
