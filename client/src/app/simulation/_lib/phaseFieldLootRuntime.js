import {
  addItemToInventory,
  autoEquipBest,
  buildCraftGoal,
  crateTypeLabel,
  formatInvAddNote,
  getActorPerkEffects,
  itemDisplayName,
  itemIcon,
  pickAutoTranscendOption,
  pickGoalLoadoutKeys,
  rollFieldLoot,
  tryAutoCraftFromLoot,
} from './simulationEngine';
import { advanceActorRouteProgressForGoal } from './phaseRouteProgressRuntime';
import {
  gainText,
  getLootCraftOptions,
  shouldLogItemReceive,
} from './runEventRuntime';

export function runFieldLootPhase({
  actions = {},
  state = {},
} = {}) {
  const {
    actor,
    craftables,
    didMove = false,
    itemMetaById,
    itemNameById,
    mapObj,
    nextDay,
    nextPhase,
    pendingPickAssigned = false,
    pendingTranscendPick = null,
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
    getZoneName = (zoneId) => String(zoneId || ''),
    grantMastery = () => {},
    setPendingTranscendPick = () => {},
  } = actions;

  const updated = actor || {};
  let nextPendingPickAssigned = !!pendingPickAssigned;
  const loot = rollFieldLoot(mapObj, updated.zoneId, publicItems, ruleset, {
    moved: didMove,
    day: nextDay,
    phase: nextPhase,
    dropWeightsByKey: ruleset?.worldSpawns?.legendaryCrate?.dropWeightsByKey,
    perkEffects: getActorPerkEffects(updated),
    goalItemIds: (Array.isArray(preGoal?.missing) ? preGoal.missing : []).map((missing) => String(missing?.itemId || '')).filter(Boolean),
    routeItemIds: Array.isArray(updated?.routePlanItemIdsByZone?.[String(updated.zoneId || '')])
      ? updated.routePlanItemIdsByZone[String(updated.zoneId || '')]
      : [],
  });

  if (loot) {
    const isTransPick = String(loot?.crateType || '').toLowerCase() === 'transcend_pick' && Array.isArray(loot?.options);
    if (isTransPick) {
      const devPickable = !!showMarketPanel && !nextPendingPickAssigned && !pendingTranscendPick && String(selectedCharId || '') === String(updated?._id || '');
      if (devPickable) {
        nextPendingPickAssigned = true;
        setPendingTranscendPick({
          id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          characterId: String(updated?._id || ''),
          characterName: updated?.name,
          zoneId: String(updated?.zoneId || ''),
          options: loot.options,
          at: atNow(),
        });
        addLog(`🎁 [${updated.name}] ${getZoneName(updated.zoneId)}에서 초월 장비 선택 상자를 발견했습니다. (개발자 도구: 선택 대기)`, 'highlight');
      } else {
        const auto = pickAutoTranscendOption(loot.options, publicItems) || (loot.options[0] || null);
        const chosenId = String(auto?.itemId || '');
        const chosenItem = (Array.isArray(publicItems) ? publicItems : []).find((item) => String(item?._id) === chosenId) || null;
        updated.inventory = addItemToInventory(updated.inventory, chosenItem, chosenId, 1, nextDay, ruleset);
        const meta = updated.inventory?._lastAdd;
        const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
        const name = itemDisplayName(chosenItem || { _id: chosenId, name: auto?.name });
        addLog(`🎁 [${updated.name}] ${getZoneName(updated.zoneId)}에서 초월 장비 선택 상자 오픈 → ${itemIcon(chosenItem)} [${name}] ${gainText(got)}${formatInvAddNote(meta, 1, updated.inventory, ruleset)}`, 'highlight');
        emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: chosenId, source: 'box', sourceKind: 'transcend_pick', zoneId: String(updated?.zoneId || ''), choice: 'auto' }, atNow());
        if (got > 0) grantMastery(updated, 'search', 350, '항공 보급');
        if (got > 0) autoEquipBest(updated, itemMetaById);
      }
    } else {
      updated.inventory = addItemToInventory(updated.inventory, loot.item, loot.itemId, loot.qty, nextDay, ruleset);
      const meta = updated.inventory?._lastAdd;
      const got = Math.max(0, Number(meta?.acceptedQty ?? loot.qty));
      const name = loot.item?.name || '아이템';
      if (shouldLogItemReceive(got, meta)) {
        addLog(`📦 [${updated.name}] ${getZoneName(updated.zoneId)}에서 ${crateTypeLabel(loot.crateType)} ${itemIcon(loot.item || { type: '' })} [${name}] ${gainText(got)}${formatInvAddNote(meta, loot.qty, updated.inventory, ruleset)}`, 'normal');
      }
      emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(loot.itemId || ''), source: 'box', sourceKind: String(loot?.crateType || ''), zoneId: String(updated?.zoneId || '') }, atNow());
      if (got > 0) grantMastery(updated, 'search', 70, '상자 탐색');
      if (got > 0) autoEquipBest(updated, itemMetaById);
    }
  }

  if (loot && String(loot?.crateType || '').toLowerCase() !== 'transcend_pick' && loot.itemId) {
    const crafted = tryAutoCraftFromLoot(updated.inventory, loot.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
    applyLootCraftResult(updated, crafted, itemMetaById, atNow(), updated?.zoneId);
  }

  if (loot && String(loot?.crateId || '') === 'route_plan') {
    const postLootGoal = buildCraftGoal(updated.inventory, craftables, itemNameById, {
      goalTier: updated?.goalGearTier,
      goalItemKeys: pickGoalLoadoutKeys(updated),
      perkEffects: getActorPerkEffects(updated),
    });
    advanceActorRouteProgressForGoal({
      actor: updated,
      craftGoal: postLootGoal,
      includeRoutePlanMissing: false,
      ruleset,
      searched: true,
      zoneId: updated.zoneId,
    });
  }

  return {
    actor: updated,
    loot,
    pendingPickAssigned: nextPendingPickAssigned,
  };
}
