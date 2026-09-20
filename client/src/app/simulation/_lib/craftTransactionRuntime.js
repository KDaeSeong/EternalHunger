import { addItemToInventory, consumeIngredientsFromInv, getInvItemId } from './inventoryRules.js';
import { getCraftRecipeTerms } from './gearRecipeGuardRuntime.js';

const reject = (reason, details = {}) => ({ ok: false, reason, ...details });
const numeric = (value) => typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;

function getCraftState(actor) {
  const credits = numeric(actor?.simCredits === undefined ? 0 : actor.simCredits);
  const revision = actor?._craftRevision === undefined ? 0 : actor._craftRevision;
  if (!Number.isFinite(credits) || credits < 0 || credits > Number.MAX_SAFE_INTEGER
    || !Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) return null;
  const cycle = actor?._actionCycleKey ?? null;
  if (cycle !== null && typeof cycle !== 'string' && !Number.isFinite(cycle)) return null;
  return { actorId: String(actor?._id || ''), credits, revision, cycle, inventory: JSON.stringify(actor?.inventory ?? []) };
}

// Preview uses owned copies. In particular, a partial output receipt cannot
// discard ingredients, auto-dropped materials, or the previous equipped item.
export function prepareCraftTransaction(actor, item, day = 1, ruleset = {}) {
  if (!actor || !Number.isFinite(numeric(actor.hp)) || numeric(actor.hp) <= 0) return reject('actor_inactive');
  const terms = getCraftRecipeTerms(item);
  if (!terms) return reject('invalid_recipe');
  const before = getCraftState(actor);
  if (!before) return reject('invalid_credits');
  if (before.credits < terms.creditsCost) return reject('insufficient_credits', { required: terms.creditsCost, available: before.credits });
  const rows = actor.inventory === undefined ? [] : actor.inventory;
  if (!Array.isArray(rows)) return reject('invalid_inventory');
  const available = new Map();
  for (const row of rows) {
    const id = getInvItemId(row);
    const qty = numeric(row?.qty === undefined ? 1 : row.qty);
    const total = (available.get(id) || 0) + qty;
    if (!id.trim() || !Number.isSafeInteger(qty) || qty <= 0 || !Number.isSafeInteger(total)) return reject('invalid_inventory');
    available.set(id, total);
  }
  if (terms.ingredients.some((row) => (available.get(row.itemId) || 0) < row.qty)) return reject('insufficient_items');
  const afterConsume = consumeIngredientsFromInv(structuredClone(rows), terms.ingredients);
  const inventory = addItemToInventory(afterConsume, item, item._id, terms.resultQty, day, ruleset);
  if (inventory._lastAdd?.itemId !== String(item._id) || inventory._lastAdd.acceptedQty !== terms.resultQty) return reject('inventory_full');
  const receipt = { receiptVersion: 1, actionKey: `craft:${before.actorId}:${before.revision + 1}`,
    itemId: String(item._id), qty: terms.resultQty, receivedQty: terms.resultQty,
    paidCost: terms.creditsCost, beforeCredits: before.credits, afterCredits: before.credits - terms.creditsCost,
    consumed: terms.ingredients.map((row) => ({ ...row })) };
  return { ok: true, before, inventory, receipt, item: structuredClone(item), day,
    ruleset: structuredClone({ inventory: ruleset?.inventory, equipment: ruleset?.equipment }) };
}

// The revision travels with the actor in snapshots. Replaying an already
// committed prepared result cannot pay twice, even if resources are refilled.
// Separate successful loot recipes in the same action remain permitted.
export function commitCraftTransaction(actor, prepared) {
  if (!prepared?.ok || !prepared.before || !prepared.receipt) return reject('invalid_transaction');
  if (JSON.stringify(getCraftState(actor)) !== JSON.stringify(prepared.before)) return reject('stale_transaction');
  const current = prepareCraftTransaction(actor, prepared.item, prepared.day, prepared.ruleset);
  if (!current.ok) return current;
  if (JSON.stringify(current.receipt) !== JSON.stringify(prepared.receipt)
    || JSON.stringify(current.inventory) !== JSON.stringify(prepared.inventory)) return reject('invalid_transaction');
  actor.inventory = current.inventory;
  actor.simCredits = current.receipt.afterCredits;
  actor._craftRevision = current.before.revision + 1;
  return { ok: true, receipt: current.receipt };
}

export function craftFailureText(reason, details = {}) {
  if (reason === 'insufficient_credits') return `제작 비용 부족 · 필요 ${details.required}Cr / 보유 ${details.available}Cr`;
  return ({ actor_inactive: '생존 상태가 아니어서 제작할 수 없음', invalid_recipe: '제작법의 재료·수량·비용 확인 필요',
    insufficient_items: '현재 제작 재료 부족', inventory_full: '제작 수량 전체를 가방에 받을 공간 부족',
    stale_transaction: '제작 중 소지품이나 행동이 바뀌어 취소', invalid_inventory: '소지품 정보 확인 필요' })[reason] || '제작 정보 확인 필요';
}
