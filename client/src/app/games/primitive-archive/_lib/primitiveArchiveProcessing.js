export const TRIBE_PROCESS_ACTION_IDS = Object.freeze(['kiln', 'weave', 'smelt', 'forge', 'mill']);
export const DEFAULT_TRIBE_PROCESSING_PLAN = Object.freeze({ actionId: '', targetStock: 0 });

const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const isCount = value => Number.isSafeInteger(value) && value >= 0;
const isObservedStock = value => typeof value === 'number' && Number.isFinite(value)
  && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const exactKeys = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));

export function isValidTribeProcessingPlan(value) {
  return exactKeys(value, ['actionId', 'targetStock']) && isCount(value.targetStock)
    && (value.actionId === '' ? value.targetStock === 0
      : TRIBE_PROCESS_ACTION_IDS.includes(value.actionId) && value.targetStock > 0);
}

export function normalizeTribeProcessingPlan(value) {
  if (!isValidTribeProcessingPlan(value)) throw new RangeError('Invalid tribe processing plan');
  return { actionId: value.actionId, targetStock: value.targetStock };
}

function isValidItemMap(value) {
  return isRecord(value) && Object.entries(value).every(([id, count]) => (
    /^[a-z][a-z0-9_]*$/.test(id) && isCount(count) && count > 0
  ));
}

export function isValidTribeProcessingReceipt(value) {
  const bonus = isRecord(value) && Object.hasOwn(value, 'bonusBatches') ? value.bonusBatches : 0;
  const keys = ['actionId', 'targetStock', 'workers', 'batches', 'stockBefore', 'stockAfter', 'spent', 'gains', 'reason'];
  if (isRecord(value) && Object.hasOwn(value, 'bonusBatches')) keys.push('bonusBatches');
  if (!exactKeys(value, keys)
    || !isValidTribeProcessingPlan({ actionId: value.actionId, targetStock: value.targetStock })
    || !isCount(value.workers) || value.workers > 24
    || !isCount(bonus) || bonus > 1 || !isCount(value.batches) || value.batches < bonus
    || value.batches - bonus > value.workers || (bonus > 0 && value.batches - bonus < 1)
    || !isValidItemMap(value.spent) || !isValidItemMap(value.gains)
    || typeof value.reason !== 'string' || !value.reason.trim() || value.reason.length > 300
    || /[\u0000-\u001f\u007f]/.test(value.reason)) return false;
  const spent = Object.values(value.spent);
  const gains = Object.values(value.gains);
  if (value.stockBefore === null || value.stockAfter === null) {
    return value.stockBefore === null && value.stockAfter === null && value.actionId !== ''
      && value.batches === 0 && spent.length === 0 && gains.length === 0;
  }
  if (!isObservedStock(value.stockBefore) || !isObservedStock(value.stockAfter)) return false;
  if (value.batches === 0) {
    return spent.length === 0 && gains.length === 0 && value.stockAfter === value.stockBefore
      && (value.actionId !== '' || value.stockBefore === 0);
  }
  // Receipts describe their historical amounts, not today's recipe ratios.
  return value.actionId !== '' && spent.length > 0 && gains.length === 1
    && value.stockAfter === value.stockBefore + gains[0];
}

export function isValidOptionalTribeProcessing(tribe) {
  if (tribe === undefined) return true;
  if (!isRecord(tribe)) return false;
  if (Object.hasOwn(tribe, 'processingPlan') && !isValidTribeProcessingPlan(tribe.processingPlan)) return false;
  if (tribe.assignments != null && Object.hasOwn(tribe.assignments, 'artisan')
    && (!isCount(tribe.assignments.artisan) || tribe.assignments.artisan > 24)) return false;
  if (tribe.autoAssignments != null && Object.hasOwn(tribe.autoAssignments, 'artisan')
    && tribe.autoAssignments.artisan !== 0) return false;
  const receipt = tribe.lastProduction;
  return !receipt || typeof receipt !== 'object' || !Object.hasOwn(receipt, 'processing')
    || (isRecord(receipt) && isValidTribeProcessingReceipt(receipt.processing));
}
