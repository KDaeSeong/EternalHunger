import { STUDY_BONUS_POINTS } from './primitiveArchiveAncestralFaith.js';

export const DEFAULT_TRIBE_EDUCATION_PLAN = Object.freeze({ teachers: 0 });

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => record(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));
const workerCount = value => Number.isSafeInteger(value) && value >= 0 && value <= 24;
const observed = value => typeof value === 'number' && Number.isFinite(value)
  && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const receiptKeys = ['teachersRequested', 'scholarsAvailable', 'teachers', 'generalScholars', 'civicId',
  'progressBefore', 'progressAfter', 'requestedPoints', 'appliedPoints', 'paperBefore', 'paperAfter', 'spent', 'reason'];

export function isValidTribeEducationPlan(value) {
  return exactKeys(value, ['teachers']) && workerCount(value.teachers);
}

export function normalizeTribeEducationPlan(value) {
  if (value === undefined) return { ...DEFAULT_TRIBE_EDUCATION_PLAN };
  if (!isValidTribeEducationPlan(value)) throw new RangeError('Invalid tribe education plan');
  return { teachers: value.teachers };
}

export function isValidTribeEducationReceipt(receipt, assignments) {
  const hasTradition = record(receipt) && ['basePoints', 'traditionPoints', 'traditionFounderId'].some(key => Object.hasOwn(receipt, key));
  if (!exactKeys(receipt, hasTradition ? [...receiptKeys, 'basePoints', 'traditionPoints', 'traditionFounderId'] : receiptKeys)) return false;
  if (hasTradition && (!observed(receipt.basePoints) || !observed(receipt.traditionPoints)
    || receipt.traditionPoints > STUDY_BONUS_POINTS || receipt.appliedPoints !== receipt.basePoints + receipt.traditionPoints
    || typeof receipt.traditionFounderId !== 'string' || !receipt.traditionFounderId
    || (receipt.traditionPoints > 0 && !(receipt.basePoints > 0 && receipt.teachers > 0)))) return false;
  if (!['teachersRequested', 'scholarsAvailable', 'teachers', 'generalScholars']
    .every(key => workerCount(receipt[key]))) return false;
  if (receipt.teachers > Math.min(receipt.teachersRequested, receipt.scholarsAvailable)
    || receipt.generalScholars + receipt.teachers !== receipt.scholarsAvailable) return false;
  if (record(assignments) && Object.hasOwn(assignments, 'scholar')
    && assignments.scholar !== receipt.scholarsAvailable) return false;
  if (typeof receipt.civicId !== 'string' || !/^(?:[A-Z][A-Z0-9_]*|)$/.test(receipt.civicId)) return false;
  if (!['progressBefore', 'progressAfter', 'requestedPoints', 'appliedPoints']
    .every(key => observed(receipt[key]))) return false;
  if (receipt.appliedPoints !== receipt.progressAfter - receipt.progressBefore
    || receipt.requestedPoints < receipt.appliedPoints) return false;
  if (typeof receipt.reason !== 'string' || !receipt.reason.trim() || receipt.reason.length > 300
    || /[\u0000-\u001f\u007f-\u009f]/.test(receipt.reason)) return false;
  if (receipt.teachers > 0) {
    return !!receipt.civicId && receipt.requestedPoints > 0 && receipt.appliedPoints > 0
      && observed(receipt.paperBefore) && observed(receipt.paperAfter)
      && exactKeys(receipt.spent, ['paper']) && Number.isSafeInteger(receipt.spent.paper)
      && receipt.spent.paper > 0 && receipt.paperBefore - receipt.paperAfter === receipt.spent.paper;
  }
  const unchangedStock = (receipt.paperBefore === null && receipt.paperAfter === null)
    || (observed(receipt.paperBefore) && observed(receipt.paperAfter) && receipt.paperBefore === receipt.paperAfter);
  return receipt.requestedPoints === 0 && receipt.appliedPoints === 0
    && receipt.progressBefore === receipt.progressAfter && unchangedStock && exactKeys(receipt.spent, []);
}

export function isValidOptionalTribeEducation(tribe) {
  if (tribe === undefined) return true;
  if (!record(tribe)) return false;
  if (Object.hasOwn(tribe, 'educationPlan') && !isValidTribeEducationPlan(tribe.educationPlan)) return false;
  const receipt = tribe.lastProduction;
  if (record(receipt) && Object.hasOwn(receipt, 'education')) {
    return isValidTribeEducationReceipt(receipt.education, receipt.assignments);
  }
  return true;
}
