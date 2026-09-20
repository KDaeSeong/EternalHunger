import { addItemToInventory, consumeIngredientsFromInv, getInvItemId } from './inventoryRules.js';

const ACTION_KINDS = { kioskBuy: 'buy', kioskExchange: 'exchange', kioskSell: 'sell', droneOrder: 'drone' };

function numeric(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return NaN;
  return Number(value);
}

function positiveQty(value = 1) {
  const qty = numeric(value);
  return Number.isSafeInteger(qty) && qty > 0 ? qty : NaN;
}

function itemKey(value) {
  return typeof value === 'string' && value.trim() ? value : '';
}

function combineIngredients(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const totals = new Map();
  for (const row of rows) {
    const itemId = itemKey(row?.itemId);
    const qty = positiveQty(row?.qty);
    const total = (totals.get(itemId) || 0) + qty;
    if (!itemId || !Number.isSafeInteger(total) || total <= 0) return null;
    totals.set(itemId, total);
  }
  return [...totals].map(([itemId, qty]) => ({ itemId, qty }));
}

export function getProcurementActionKey(actor, phaseIdxNow = 0) {
  const phase = numeric(phaseIdxNow);
  const cycle = actor?._actionCycleKey;
  if (!Number.isSafeInteger(phase) || phase < 0
    || (cycle != null && typeof cycle !== 'string' && !Number.isFinite(cycle))) return '';
  return `phase:${phase}:cycle:${cycle ?? 'legacy'}`;
}

// A quoted quantity and its total price form one transaction. Prepare on copies
// so capacity failure also rolls back ingredient use, gear replacement and drops.
// This function is synchronous: no callback can change funds between check/commit.
export function commitProcurementTransaction({ actor, actionType, offer, day = 1, phaseIdxNow = 0, ruleset } = {}) {
  const reject = (reason) => ({ ok: false, reason });
  if (!Object.hasOwn(ACTION_KINDS, actionType)) return reject('invalid_action');
  const kind = ACTION_KINDS[actionType];
  if (!actor || !Number.isFinite(numeric(actor.hp)) || numeric(actor.hp) <= 0) return reject('actor_inactive');
  if (!offer || (offer.kind !== kind && !(kind === 'drone' && offer.kind === undefined))) return reject('invalid_offer');

  const itemId = itemKey(offer.itemId);
  const item = offer.item;
  const suppliedId = itemKey(item?._id || item?.itemId || item?.id);
  const qty = positiveQty(offer.qty);
  if (!itemId || !item || typeof item !== 'object' || suppliedId !== itemId) return reject('invalid_item');
  if (!Number.isSafeInteger(qty)) return reject('invalid_quantity');

  const actionKey = getProcurementActionKey(actor, phaseIdxNow);
  if (!actionKey) return reject('invalid_action_cycle');
  // Serialized with the actor, so retrying a restored action cannot pay twice.
  if (actor._procurementActionKey === actionKey) return reject('already_committed');

  const beforeCredits = numeric(actor.simCredits === undefined ? 0 : actor.simCredits);
  const paidCost = kind === 'buy' || kind === 'drone' ? numeric(offer.cost) : 0;
  const gainedCredits = kind === 'sell' ? numeric(offer.credits) : 0;
  if (![beforeCredits, paidCost, gainedCredits].every((value) => Number.isFinite(value) && value >= 0)) return reject('invalid_credits');
  if (beforeCredits < paidCost) return reject('insufficient_credits');
  const afterCredits = beforeCredits - paidCost + gainedCredits;
  if (!Number.isFinite(afterCredits)) return reject('invalid_credits');

  const consumed = kind === 'sell' ? [{ itemId, qty }]
    : kind === 'exchange' ? combineIngredients(offer.consume) : [];
  if (!consumed) return reject('invalid_ingredients');
  const currentInventory = actor.inventory === undefined ? [] : actor.inventory;
  if (!Array.isArray(currentInventory)) return reject('invalid_inventory');
  const inventory = [];
  const available = new Map();
  for (const entry of currentInventory) {
    const id = itemKey(getInvItemId(entry));
    const count = positiveQty(entry?.qty);
    const total = (available.get(id) || 0) + count;
    if (!id || !Number.isSafeInteger(total) || total <= 0) return reject('invalid_inventory');
    available.set(id, total);
    inventory.push({ ...entry, itemId: id, qty: count });
  }
  if (consumed.some((row) => (available.get(row.itemId) || 0) < row.qty)) return reject('insufficient_items');

  let nextInventory = consumeIngredientsFromInv(inventory, consumed);
  let meta = null;
  if (kind !== 'sell') {
    nextInventory = addItemToInventory(nextInventory, item, itemId, qty, day, ruleset);
    meta = nextInventory._lastAdd;
    if (meta?.itemId !== itemId || meta?.acceptedQty !== qty) return reject('cannot_receive_full_order');
  }

  actor.inventory = nextInventory;
  actor.simCredits = afterCredits;
  actor._procurementActionKey = actionKey;
  return { ok: true, actionKey, kind, itemId, qty, receivedQty: kind === 'sell' ? 0 : qty,
    paidCost, gainedCredits, beforeCredits, afterCredits, consumed, meta };
}

const FAILURE_TEXT = {
  actor_inactive: '생존 상태가 아니어서 거래 취소',
  insufficient_credits: '현재 크레딧 부족으로 거래 취소',
  insufficient_items: '현재 판매·교환 재료 부족으로 거래 취소',
  cannot_receive_full_order: '주문 수량 전체를 가방에 받을 수 없어 거래 취소',
};

export function procurementFailureText(reason) {
  return FAILURE_TEXT[reason] || '거래 정보가 올바르지 않아 거래 취소';
}
