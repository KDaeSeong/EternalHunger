import {
  autoEquipBest,
  classifySpecialByName,
  consumeIngredientsFromInv,
  formatInvAddNote,
  pruneEquippedAgainstInventory,
  tryAutoCraftFromLoot,
  tryImmediateCraftFromSpecial,
} from './simulationEngine';
import {
  gainText,
  getLootCraftOptions,
  shouldLogItemReceive,
} from './runEventRuntime';
import { commitProcurementTransaction, getProcurementActionKey, procurementFailureText } from './procurementTransactionRuntime.js';

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

  const offer = queuedActionType === 'droneOrder' ? queuedDroneOrder : queuedKioskAction;
  const transaction = commitProcurementTransaction({
    actor: updated, actionType: queuedActionType, offer, day: nextDay, phaseIdxNow, ruleset,
  });
  const observation = { receiptVersion: 1, who: String(updated._id || ''), zoneId: String(updated.zoneId || ''),
    actionKey: transaction.actionKey || getProcurementActionKey(updated, phaseIdxNow), actionType: queuedActionType,
    itemId: String(offer?.itemId || ''), itemName: String(offer?.item?.name || itemNameById?.[offer?.itemId] || ''),
    source: queuedActionType === 'droneOrder' ? 'drone' : 'kiosk' };
  if (!transaction.ok) {
    // A successful retry is silent: do not duplicate gain/craft/module events.
    if (transaction.reason !== 'already_committed') {
      addLog(`🛒 [${updated.name || '실험체'}] ${procurementFailureText(transaction.reason)} (크레딧·가방 변경 없음)`, 'system');
      emitRunEvent('procurement', { ...observation, outcome: 'cancelled', reason: transaction.reason, receivedQty: 0,
        qty: Number.isSafeInteger(Number(offer?.qty)) && Number(offer.qty) > 0 ? Number(offer.qty) : 0 }, atNow());
    }
    return { actor: updated, didProcure: false, ran: true, reason: transaction.reason };
  }
  emitRunEvent('procurement', { ...observation, outcome: 'completed', qty: transaction.qty, receivedQty: transaction.receivedQty,
    paidCost: transaction.paidCost, gainedCredits: transaction.gainedCredits,
    beforeCredits: transaction.beforeCredits, afterCredits: transaction.afterCredits,
    consumed: transaction.consumed.map((row) => ({ ...row, itemName: String(itemNameById?.[row.itemId] || row.itemId) })) }, atNow());
  pruneEquippedAgainstInventory(updated);
  const receipt = { actionKey: transaction.actionKey, paidCost: transaction.paidCost,
    consumed: transaction.consumed, beforeCredits: transaction.beforeCredits, afterCredits: transaction.afterCredits };
  const kioskAction = queuedKioskAction;
  if (KIOSK_ACTION_TYPES.has(queuedActionType) && kioskAction?.itemId && kioskAction?.item) {
    const itemNm = kioskAction.item?.name || kioskAction.label || '아이템';

    if (kioskAction.kind === 'buy') {
      const { meta, qty: want, receivedQty: got, paidCost } = transaction;

      applyTacticalModuleUpgrade(updated, kioskAction, itemNm, got, ruleset, addLog);
      if (shouldLogItemReceive(got, meta)) {
        addLog(`🏪 [${updated.name}] 키오스크 ${kioskAction.label ? `(${kioskAction.label}) ` : ''}구매: [${itemNm}] ${gainText(got, '구매', '구매 실패')}${formatInvAddNote(meta, want, updated.inventory, ruleset)}${paidCost > 0 ? ` (크레딧 -${paidCost})` : ''}`, 'system');
      }
      emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(kioskAction.itemId || ''), source: 'kiosk', kind: 'buy', zoneId: String(updated?.zoneId || ''), ...receipt }, atNow());
      if (got > 0) autoEquipBest(updated, itemMetaById);
      didProcure = true;

      const specialKKind = classifySpecialByName(String(kioskAction?.item?.name || itemNm || ''));
      const immediateK = tryImmediateCraftFromSpecial(updated, specialKKind, String(kioskAction.itemId || ''), publicItems, itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
      if (immediateK?.changed) {
        updated.inventory = immediateK.inventory;
      }
      (immediateK?.logs || []).forEach((message) => addLog(String(message), immediateK.changed ? 'highlight' : 'system'));
      applyImmediateDanger(updated, immediateK, phaseIdxNow);

      const craftedK = immediateK?.changed ? null : tryAutoCraftFromLoot(updated.inventory, kioskAction.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
      applyLootCraftResult(updated, craftedK, itemMetaById, atNow(), updated?.zoneId);
    }

    if (kioskAction.kind === 'exchange' && Array.isArray(kioskAction.consume) && kioskAction.consume.length) {
      const consumedNames = transaction.consumed
        .map((entry) => `${itemNameById?.[String(entry.itemId)] || String(entry.itemId)} x${entry.qty}`)
        .join(' + ');
      const { meta, qty: want, receivedQty: got } = transaction;

      applyTacticalModuleUpgrade(updated, kioskAction, itemNm, got, ruleset, addLog);
      if (shouldLogItemReceive(got, meta, { important: true })) {
        addLog(`🏪 [${updated.name}] 키오스크 교환: ${consumedNames} → [${itemNm}] ${gainText(got, '교환', '교환 실패')}${formatInvAddNote(meta, want, updated.inventory, ruleset)}`, 'system');
      }
      emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(kioskAction.itemId || ''), source: 'kiosk', kind: 'exchange', zoneId: String(updated?.zoneId || ''), ...receipt }, atNow());
      if (got > 0) autoEquipBest(updated, itemMetaById);
      didProcure = true;

      const specialEKind = classifySpecialByName(String(kioskAction?.item?.name || itemNm || ''));
      const immediateE = tryImmediateCraftFromSpecial(updated, specialEKind, String(kioskAction.itemId || ''), publicItems, itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
      if (immediateE?.changed) {
        updated.inventory = immediateE.inventory;
      }
      (immediateE?.logs || []).forEach((message) => addLog(String(message), immediateE.changed ? 'highlight' : 'system'));
      applyImmediateDanger(updated, immediateE, phaseIdxNow);

      const craftedE = immediateE?.changed ? null : tryAutoCraftFromLoot(updated.inventory, kioskAction.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(updated));
      applyLootCraftResult(updated, craftedE, itemMetaById, atNow(), updated?.zoneId);
    }

    if (kioskAction.kind === 'sell') {
      const { qty: q, gainedCredits: gain } = transaction;
      addLog(`🏪 [${updated.name}] 키오스크 환급: [${itemNm}] x${q} → 크레딧 +${gain}`, 'system');
      emitRunEvent('gain', { who: String(updated?._id || ''), itemId: 'CREDITS', qty: gain, source: 'kiosk', kind: 'sell', zoneId: String(updated?.zoneId || ''), ...receipt }, atNow());
      didProcure = true;
    }
  }

  if (!didProcure && queuedActionType === 'droneOrder') {
    const droneOrder = queuedDroneOrder;
    if (droneOrder?.itemId) {
      const { qty, meta, receivedQty: got, paidCost } = transaction;
      const item = droneOrder?.item || null;
      const itemId = String(droneOrder.itemId || item?._id || '');
      if (itemId) {
        if (shouldLogItemReceive(got, meta)) {
          addLog(`🚁 [${updated.name}] 드론 호출: ${item?.name || itemNameById?.[itemId] || '아이템'} ${gainText(got, '수령', '호출 실패')}${formatInvAddNote(meta, qty, updated.inventory, ruleset)}${paidCost > 0 ? ` (-${paidCost}Cr, 즉시)` : ''}`, 'normal');
        }
        emitItemGainIfAny(got, { who: String(updated?._id || ''), itemId: String(itemId || ''), source: 'drone', zoneId: String(updated?.zoneId || ''), ...receipt }, atNow());
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
