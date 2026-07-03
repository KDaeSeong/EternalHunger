import {
  addItemToInventory,
  autoEquipBest,
  classifySpecialByName,
  consumeIngredientsFromInv,
  formatInvAddNote,
  tryAutoCraftFromLoot,
  tryImmediateCraftFromSpecial,
} from './simulationEngine';
import {
  gainText,
  getLootCraftOptions,
  shouldLogItemReceive,
} from './runEventRuntime';

const PROCUREMENT_ACTION_TYPES = new Set(['kioskBuy', 'kioskExchange', 'kioskSell', 'droneOrder']);
const KIOSK_ACTION_TYPES = new Set(['kioskBuy', 'kioskExchange', 'kioskSell']);

function applyImmediateDanger(actor, immediate, phaseIdxNow) {
  if (Number(immediate?.pvpBonus || 0) <= 0) return;
  const pb = Number(immediate.pvpBonus || 0);
  actor._gatherPvpBonus = Math.max(Number(actor._gatherPvpBonus || 0), pb);
  actor._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
  actor._immediateDanger = Math.max(Number(actor._immediateDanger || 0), pb);
  actor._immediateDangerUntilPhaseIdx = phaseIdxNow;
}

function applyTacticalModuleUpgrade(actor, kioskAction, itemName, got, ruleset, addLog) {
  const tacMode = String(ruleset?.ai?.tacModuleUpgradeMode || 'level');
  const tags = Array.isArray(kioskAction?.item?.tags) ? kioskAction.item.tags : [];
  const isTacModule = String(itemName || '').includes('전술 강화 모듈') || tags.some((tag) => String(tag).toLowerCase().includes('tac_skill_module'));
  if (tacMode !== 'level' || !isTacModule || got <= 0) return;

  const beforeLv = Math.max(1, Math.min(2, Math.floor(Number(actor?.tacticalSkillLevel || 1))));
  const inc = Math.max(0, Math.min(2 - beforeLv, Math.floor(got)));
  if (inc <= 0) return;

  actor.tacticalSkillLevel = beforeLv + inc;
  actor.inventory = consumeIngredientsFromInv(actor.inventory, [{ itemId: String(kioskAction.itemId || ''), qty: inc }]);
  addLog(`🎛️ [${actor.name}] 전술 강화 모듈 사용 → 전술 스킬 레벨 +${inc} (Lv.${actor.tacticalSkillLevel})`, 'highlight');
}

export function runProcurementAction({
  actions = {},
  state = {},
} = {}) {
  const {
    actor,
    craftables,
    itemMetaById,
    itemNameById,
    nextDay,
    nextPhase,
    phaseIdxNow = 0,
    publicItems,
    queuedActionType,
    queuedDroneOrder,
    queuedKioskAction,
    ruleset,
  } = state;
  const {
    addLog = () => {},
    applyLootCraftResult = () => {},
    atNow = () => null,
    emitItemGainIfAny = () => {},
    emitRunEvent = () => {},
  } = actions;

  const updated = actor || {};
  let didProcure = false;

  if (!PROCUREMENT_ACTION_TYPES.has(queuedActionType)) {
    return {
      actor: updated,
      didProcure,
      ran: false,
    };
  }

  const kioskAction = queuedKioskAction;
  if (KIOSK_ACTION_TYPES.has(queuedActionType) && kioskAction?.itemId && kioskAction?.item) {
    const itemNm = kioskAction.item?.name || kioskAction.label || '아이템';

    if (kioskAction.kind === 'buy') {
      const cost = Math.max(0, Number(kioskAction.cost || 0));
      updated.inventory = addItemToInventory(updated.inventory, kioskAction.item, kioskAction.itemId, kioskAction.qty || 1, nextDay, ruleset);
      const meta = updated.inventory?._lastAdd;
      const want = Math.max(1, Number(kioskAction.qty || 1));
      const got = Math.max(0, Number(meta?.acceptedQty ?? want));
      const paidCost = got > 0 ? cost : 0;
      if (paidCost > 0) updated.simCredits = Math.max(0, Number(updated.simCredits || 0) - paidCost);

      applyTacticalModuleUpgrade(updated, kioskAction, itemNm, got, ruleset, addLog);
      if (shouldLogItemReceive(got, meta)) {
        addLog(`🏪 [${updated.name}] 키오스크 ${kioskAction.label ? `(${kioskAction.label}) ` : ''}구매: [${itemNm}] ${gainText(got, '구매', '구매 실패')}${formatInvAddNote(meta, want, updated.inventory, ruleset)}${paidCost > 0 ? ` (크레딧 -${paidCost})` : ''}`, 'system');
      }
      emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(kioskAction.itemId || ''), source: 'kiosk', kind: 'buy', zoneId: String(updated?.zoneId || '') }, atNow());
      if (got > 0) autoEquipBest(updated, itemMetaById);
      didProcure = true;

      const specialKKind = classifySpecialByName(String(kioskAction?.item?.name || itemNm || ''));
      const immediateK = tryImmediateCraftFromSpecial(updated, specialKKind, String(kioskAction.itemId || ''), publicItems, itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
      if (immediateK?.changed) {
        updated.inventory = immediateK.inventory;
        (Array.isArray(immediateK.logs) ? immediateK.logs : []).forEach((message) => addLog(String(message), 'highlight'));
      }
      applyImmediateDanger(updated, immediateK, phaseIdxNow);

      const craftedK = immediateK?.changed ? null : tryAutoCraftFromLoot(updated.inventory, kioskAction.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
      applyLootCraftResult(updated, craftedK, itemMetaById, atNow(), updated?.zoneId);
    }

    if (kioskAction.kind === 'exchange' && Array.isArray(kioskAction.consume) && kioskAction.consume.length) {
      const consumedNames = kioskAction.consume
        .map((entry) => `${itemNameById?.[String(entry.itemId)] || String(entry.itemId)} x${entry.qty || 1}`)
        .join(' + ');
      updated.inventory = consumeIngredientsFromInv(updated.inventory, kioskAction.consume);
      updated.inventory = addItemToInventory(updated.inventory, kioskAction.item, kioskAction.itemId, kioskAction.qty || 1, nextDay, ruleset);
      const meta = updated.inventory?._lastAdd;
      const want = Math.max(1, Number(kioskAction.qty || 1));
      const got = Math.max(0, Number(meta?.acceptedQty ?? want));

      applyTacticalModuleUpgrade(updated, kioskAction, itemNm, got, ruleset, addLog);
      if (shouldLogItemReceive(got, meta, { important: true })) {
        addLog(`🏪 [${updated.name}] 키오스크 교환: ${consumedNames} → [${itemNm}] ${gainText(got, '교환', '교환 실패')}${formatInvAddNote(meta, want, updated.inventory, ruleset)}`, 'system');
      }
      emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(kioskAction.itemId || ''), source: 'kiosk', kind: 'exchange', zoneId: String(updated?.zoneId || '') }, atNow());
      if (got > 0) autoEquipBest(updated, itemMetaById);
      didProcure = true;

      const craftedE = tryAutoCraftFromLoot(updated.inventory, kioskAction.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
      applyLootCraftResult(updated, craftedE, itemMetaById, atNow(), updated?.zoneId);
    }

    if (kioskAction.kind === 'sell') {
      const q = Math.max(1, Number(kioskAction.qty || 1));
      const gain = Math.max(0, Number(kioskAction.credits || 0));
      updated.inventory = consumeIngredientsFromInv(updated.inventory, [{ itemId: String(kioskAction.itemId || ''), qty: q }]);
      updated.simCredits = Math.max(0, Number(updated.simCredits || 0) + gain);
      addLog(`🏪 [${updated.name}] 키오스크 환급: [${itemNm}] x${q} → 크레딧 +${gain}`, 'system');
      emitRunEvent('gain', { who: String(updated?._id || ''), itemId: 'CREDITS', qty: gain, source: 'kiosk', kind: 'sell', zoneId: String(updated?.zoneId || '') }, atNow());
      didProcure = true;
    }
  }

  if (!didProcure && queuedActionType === 'droneOrder') {
    const droneOrder = queuedDroneOrder;
    if (droneOrder?.itemId && Number(droneOrder?.cost || 0) <= Number(updated.simCredits || 0)) {
      const cost = Math.max(0, Number(droneOrder.cost || 0));
      const qty = Math.max(1, Number(droneOrder.qty || 1));
      const item = droneOrder?.item || null;
      const itemId = String(droneOrder.itemId || item?._id || '');
      if (itemId) {
        updated.inventory = addItemToInventory(updated.inventory, item, itemId, qty, nextDay, ruleset);
        const meta = updated.inventory?._lastAdd;
        const got = Math.max(0, Number(meta?.acceptedQty ?? qty));
        const paidCost = got > 0 ? cost : 0;
        if (paidCost > 0) updated.simCredits = Math.max(0, Number(updated.simCredits || 0) - paidCost);
        if (shouldLogItemReceive(got, meta)) {
          addLog(`🚁 [${updated.name}] 드론 호출: ${item?.name || itemNameById?.[itemId] || '아이템'} ${gainText(got, '수령', '호출 실패')}${formatInvAddNote(meta, qty, updated.inventory, ruleset)}${paidCost > 0 ? ` (-${paidCost}Cr, 즉시)` : ''}`, 'normal');
        }
        emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(itemId || ''), source: 'drone', zoneId: String(updated?.zoneId || '') }, atNow());
        if (got > 0) autoEquipBest(updated, itemMetaById);
        didProcure = true;

        const craftedD = tryAutoCraftFromLoot(updated.inventory, itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
        applyLootCraftResult(updated, craftedD, itemMetaById, atNow(), updated?.zoneId, 'highlight');
      }
    }
  }

  return {
    actor: updated,
    didProcure,
    ran: true,
  };
}
