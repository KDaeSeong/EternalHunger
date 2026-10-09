const SHARED_PURPOSE = /^팀 제작 (구매|교환):/;

const asId = value => typeof value === 'string' ? value : '';
const positiveQty = value => Number.isSafeInteger(value) && value > 0 ? value : 0;

function creditClass(event) {
  const paidCost = event.paidCost;
  const beforeCredits = event.beforeCredits;
  const afterCredits = event.afterCredits;
  if (!Number.isFinite(paidCost) || paidCost < 0
    || !Number.isFinite(beforeCredits) || beforeCredits < 0
    || !Number.isFinite(afterCredits) || afterCredits < 0
    || Math.abs(beforeCredits - afterCredits - paidCost) >= 1e-6) return '';
  return paidCost > 0 ? 'paid' : 'zero-fee';
}

function normalizedConsumption(event) {
  if (!Array.isArray(event.consumed)) return null;
  const totals = new Map();
  for (const row of event.consumed) {
    const itemId = asId(row?.itemId);
    const qty = positiveQty(row?.qty);
    if (!itemId || !qty) return null;
    const total = (totals.get(itemId) || 0) + qty;
    if (!Number.isSafeInteger(total)) return null;
    totals.set(itemId, total);
  }
  return totals;
}

function queueKey(event) {
  return JSON.stringify([asId(event.who), asId(event.actionKey), asId(event.chosen), asId(event.itemId)]);
}

function receiptQueueKey(event) {
  return JSON.stringify([asId(event.who), asId(event.actionKey), asId(event.actionType), asId(event.itemId)]);
}

function drainLots(lots, who, itemId, qty) {
  let remaining = qty;
  const actorLots = lots.get(who);
  const itemLots = actorLots?.get(itemId) || [];
  for (const lot of itemLots) {
    if (remaining <= 0) break;
    const used = Math.min(lot.remainingQty, remaining);
    lot.remainingQty -= used;
    remaining -= used;
  }
}

function invalidateActorLots(lots, who) {
  for (const itemLots of lots.get(who)?.values() || []) {
    for (const lot of itemLots) lot.remainingQty = 0;
  }
}

function addLot(lots, who, itemId, receiptEventIndex, qty) {
  let actorLots = lots.get(who);
  if (!actorLots) lots.set(who, actorLots = new Map());
  let itemLots = actorLots.get(itemId);
  if (!itemLots) actorLots.set(itemId, itemLots = []);
  itemLots.push({ receiptEventIndex, remainingQty: qty });
}

/**
 * Build quantity-bounded journal associations from actual procurement and craft events.
 * This is not lot provenance or causal shared procurement.
 */
export function summarizeKioskCraftEvidence(events, { equippedCraftEventIndexes = new Set() } = {}) {
  const rows = Array.isArray(events) ? events : [];
  const equippedIndexes = equippedCraftEventIndexes instanceof Set ? equippedCraftEventIndexes : new Set();
  const receivedReceiptEventIndexes = [];
  const associations = [];
  const zeroFeeAssociations = [];
  const queues = new Map();
  const receiptQueueIndexes = new Map();
  const lots = new Map();
  const completedProcurementKeys = new Set();
  const craftActionKeys = new Set();

  for (let eventIndex = 0; eventIndex < rows.length; eventIndex += 1) {
    const event = rows[eventIndex] || {};

    if (event.kind === 'queue' && event.actionKey && event.who && event.itemId
      && ['kioskBuy', 'kioskExchange'].includes(event.chosen)) {
      queues.set(queueKey(event), eventIndex);
    }

    if (event.kind === 'procurement' && event.outcome === 'completed'
      && ['kioskBuy', 'kioskExchange', 'kioskSell'].includes(event.actionType)
      && event.source === 'kiosk' && typeof event.who === 'string' && event.who
      && typeof event.actionKey === 'string' && event.actionKey) {
      const who = asId(event.who);
      const procurementKey = JSON.stringify([who, event.actionKey]);
      if (completedProcurementKeys.has(procurementKey)) {
        throw new Error(`Duplicate completed procurement action: ${who}:${event.actionKey}`);
      }
      completedProcurementKeys.add(procurementKey);

      if (['kioskSell', 'kioskExchange'].includes(event.actionType)) {
        const consumption = normalizedConsumption(event);
        if (!consumption) invalidateActorLots(lots, who);
        else for (const [itemId, qty] of consumption) drainLots(lots, who, itemId, qty);
      }
    }

    if (event.kind === 'procurement' && event.outcome === 'completed'
      && ['kioskBuy', 'kioskExchange'].includes(event.actionType) && event.source === 'kiosk'
      && typeof event.who === 'string' && event.who
      && typeof event.actionKey === 'string' && event.actionKey
      && typeof event.itemId === 'string' && event.itemId) {
      const who = asId(event.who);
      const itemId = asId(event.itemId);
      const receivedQty = positiveQty(event.receivedQty);
      if (receivedQty) {
        receivedReceiptEventIndexes.push(eventIndex);
        const queueEventIndex = queues.get(receiptQueueKey(event)) ?? null;
        receiptQueueIndexes.set(eventIndex, queueEventIndex);
        addLot(lots, who, itemId, eventIndex, receivedQty);
      }
    }

    if (event.kind === 'craft') {
      const who = asId(event.who);
      const actionKey = asId(event.actionKey);
      if (who && actionKey) {
        const craftKey = JSON.stringify([who, actionKey]);
        if (craftActionKeys.has(craftKey)) throw new Error(`Duplicate craft action: ${who}:${actionKey}`);
        craftActionKeys.add(craftKey);
      }
      const consumption = normalizedConsumption(event);
      if (!who) continue;
      if (!consumption) {
        invalidateActorLots(lots, who);
        continue;
      }
      const validCraft = typeof event.who === 'string' && !!event.who
        && typeof event.actionKey === 'string' && !!event.actionKey
        && typeof event.itemId === 'string' && !!event.itemId
        && positiveQty(event.qty) > 0;
      const craftCreditClass = creditClass(event);
      for (const [itemId, qty] of consumption) {
        let remaining = qty;
        const actorLots = lots.get(who);
        const itemLots = actorLots?.get(itemId) || [];
        for (const lot of itemLots) {
          if (remaining <= 0) break;
          const linkedQty = Math.min(lot.remainingQty, remaining);
          if (!linkedQty) continue;
          lot.remainingQty -= linkedQty;
          remaining -= linkedQty;
          if (validCraft && eventIndex > lot.receiptEventIndex && craftCreditClass) {
            const receipt = rows[lot.receiptEventIndex];
            const queueEventIndex = receiptQueueIndexes.get(lot.receiptEventIndex) ?? null;
            const queue = queueEventIndex == null ? null : rows[queueEventIndex];
            const association = {
              receiptEventIndex: lot.receiptEventIndex,
              queueEventIndex,
              craftEventIndex: eventIndex,
              who,
              purchasedId: itemId,
              linkedQty,
              purchaseActionKey: asId(receipt?.actionKey),
              craftActionKey: asId(event.actionKey),
              actionType: asId(receipt?.actionType),
              paidCost: receipt?.paidCost,
              craftId: asId(event.itemId),
              craftCost: event.paidCost,
              sharedPurposeTagged: !!queue && SHARED_PURPOSE.test(String(queue.sharedGoalReason || '')),
              equippedObserved: equippedIndexes.has(eventIndex),
            };
            (craftCreditClass === 'paid' ? associations : zeroFeeAssociations).push(association);
          }
        }
      }
    }
  }

  return {
    receivedReceiptEventIndexes,
    associations,
    zeroFeeAssociations,
    scope: 'quantity-bounded journal association, not lot provenance or causal shared procurement',
  };
}
