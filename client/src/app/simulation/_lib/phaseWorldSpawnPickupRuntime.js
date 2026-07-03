import {
  addItemToInventory,
  autoEquipBest,
  formatInvAddNote,
  itemDisplayName,
  itemIcon,
  openSpawnedFoodCrate,
  openSpawnedTranscendCrate,
  pickupSpawnedCore,
  pickAutoTranscendOption,
  tryAutoCraftFromLoot,
  tryImmediateCraftFromSpecial,
} from './simulationEngine';
import {
  gainText,
  getLootCraftOptions,
  shouldLogItemReceive,
} from './runEventRuntime';

export function runWorldSpawnPickupPhase({
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
    pendingPickAssigned = false,
    pendingTranscendPick = null,
    phaseIdxNow = 0,
    preGoal,
    publicItems,
    ruleset,
    selectedCharId,
    showMarketPanel = false,
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
    setPendingTranscendPick = () => {},
  } = actions;

  const updated = actor || {};
  let nextPendingPickAssigned = !!pendingPickAssigned;

  const foodCrate = openSpawnedFoodCrate(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, {
    moved: didMove,
    goalItemIds: (Array.isArray(preGoal?.missing) ? preGoal.missing : []).map((m) => String(m?.itemId || '')).filter(Boolean),
  });
  if (foodCrate) {
    updated.inventory = addItemToInventory(updated.inventory, foodCrate.item, foodCrate.itemId, foodCrate.qty, nextDay, ruleset);
    const metaF = updated.inventory?._lastAdd;
    const gotF = Math.max(0, Number(metaF?.acceptedQty ?? foodCrate.qty));
    const nmF = foodCrate.item?.name || '소모품';
    if (shouldLogItemReceive(gotF, metaF)) {
      addLog(`🍱 [${updated.name}] ${getZoneName(updated.zoneId)}에서 음식 상자를 열어 ${itemIcon(foodCrate.item)} [${nmF}] ${gainText(gotF)}${formatInvAddNote(metaF, foodCrate.qty, updated.inventory, ruleset)}`, 'normal');
    }
    emitItemGainIfAny(gotF, { who: String(updated?._id || ''), itemId: String(foodCrate.itemId || ''), source: 'foodcrate', zoneId: String(updated?.zoneId || '') }, atNow());
    if (gotF > 0) {
      grantMastery(updated, 'search', 70, '음식 상자');
      const craftedF = tryAutoCraftFromLoot(updated.inventory, foodCrate.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
      applyLootCraftResult(updated, craftedF, itemMetaById, atNow(), updated?.zoneId);
    }

    const crF = Math.max(0, Number(foodCrate?.credits || 0));
    if (crF > 0) {
      updated.simCredits = Math.max(0, Number(updated.simCredits || 0) + crF);
      addLog(`💳 [${updated.name}] 음식 상자 보상 크레딧 +${crF}`, 'system');
      emitRunEvent('gain', { who: String(updated?._id || ''), itemId: 'CREDITS', qty: crF, source: 'foodcrate', zoneId: String(updated?.zoneId || '') }, atNow());
    }
  }

  const transcendCrate = openSpawnedTranscendCrate(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, { moved: didMove });
  if (transcendCrate && Array.isArray(transcendCrate.options)) {
    const devPickable = !!showMarketPanel && !nextPendingPickAssigned && !pendingTranscendPick && String(selectedCharId || '') === String(updated?._id || '');
    if (devPickable) {
      nextPendingPickAssigned = true;
      setPendingTranscendPick({
        id: String(transcendCrate?.crateId || `${Date.now()}-${Math.floor(Math.random() * 1e6)}`),
        characterId: String(updated?._id || ''),
        characterName: updated?.name,
        zoneId: String(updated?.zoneId || ''),
        options: transcendCrate.options,
        at: atNow(),
      });
      addLog(`🎁 [${updated.name}] ${getZoneName(updated.zoneId)}에서 초월 장비 선택 상자를 발견했습니다. (개발자 도구: 선택 대기)`, 'highlight');
    } else {
      const auto = pickAutoTranscendOption(transcendCrate.options, publicItems) || (transcendCrate.options[0] || null);
      const chosenId = String(auto?.itemId || '');
      const chosenItem = (Array.isArray(publicItems) ? publicItems : []).find((it) => String(it?._id) === chosenId) || null;
      updated.inventory = addItemToInventory(updated.inventory, chosenItem, chosenId, 1, nextDay, ruleset);
      const metaT = updated.inventory?._lastAdd;
      const gotT = Math.max(0, Number(metaT?.acceptedQty ?? 1));
      const nmT = itemDisplayName(chosenItem || { _id: chosenId, name: auto?.name });
      addLog(`🎁 [${updated.name}] ${getZoneName(updated.zoneId)}에서 초월 장비 선택 상자 오픈 → ${itemIcon(chosenItem)} [${nmT}] ${gainText(gotT)}${formatInvAddNote(metaT, 1, updated.inventory, ruleset)}`, 'highlight');
      emitItemGainIfAny(gotT, { who: String(updated?._id || ''), itemId: chosenId, source: 'box', sourceKind: 'transcend_pick', zoneId: String(updated?.zoneId || ''), choice: 'auto', crateId: String(transcendCrate?.crateId || '') }, atNow());
      if (gotT > 0) grantMastery(updated, 'search', 350, '항공 보급');
      if (gotT > 0) autoEquipBest(updated, itemMetaById);
    }
  }

  const corePickup = pickupSpawnedCore(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, { moved: didMove });
  if (corePickup) {
    updated.inventory = addItemToInventory(updated.inventory, corePickup.item, corePickup.itemId, corePickup.qty || 1, nextDay, ruleset);
    const meta = updated.inventory?._lastAdd;
    const got = Math.max(0, Number(meta?.acceptedQty ?? (corePickup.qty || 1)));
    const nm = corePickup.item?.name || '특수 재료';
    if (shouldLogItemReceive(got, meta, { important: true })) {
      addLog(`🌠 [${updated.name}] ${getZoneName(updated.zoneId)} 오브젝트 채집: [${nm}] ${gainText(got)}${formatInvAddNote(meta, corePickup.qty || 1, updated.inventory, ruleset)}`, 'highlight');
    }
    emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(corePickup.itemId || ''), source: 'natural', kind: String(corePickup.kind || ''), zoneId: String(updated?.zoneId || '') }, atNow());
    if (got > 0) grantMastery(updated, 'search', 100, '자원 채취');

    const immediateCore = tryImmediateCraftFromSpecial(updated, String(corePickup.kind || ''), String(corePickup.itemId || ''), publicItems, itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
    if (immediateCore?.changed) {
      updated.inventory = immediateCore.inventory;
      (Array.isArray(immediateCore.logs) ? immediateCore.logs : []).forEach((m) => addLog(String(m), 'highlight'));
    }
    if (Number(immediateCore?.pvpBonus || 0) > 0) {
      const pb = Number(immediateCore.pvpBonus || 0);
      updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
      updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
      updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
      updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
    }
    emitObjectiveRunEvent(updated, 'natural_core', {
      subkind: String(corePickup.kind || ''),
      itemId: String(corePickup.itemId || ''),
      itemName: String(nm || ''),
      qty: got,
      success: got > 0,
      danger: Math.max(0, Number(immediateCore?.pvpBonus || 0)),
    }, atNow());

    const craftedN = immediateCore?.changed ? null : tryAutoCraftFromLoot(updated.inventory, corePickup.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
    applyLootCraftResult(updated, craftedN, itemMetaById, atNow(), updated?.zoneId);
  }

  return {
    actor: updated,
    pendingPickAssigned: nextPendingPickAssigned,
  };
}
