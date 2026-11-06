import { TRIBE_PROJECTS } from './primitiveArchiveData';
import { isValidFounderHistory } from './primitiveArchiveFounders.js';
import { isValidAncestralFaith } from './primitiveArchiveAncestralFaith.js';
import { TRIBE_PROCESS_ACTION_IDS, isValidTribeProcessingPlan, isValidTribeProcessingReceipt } from './primitiveArchiveProcessing.js';

const projectIds = new Set(TRIBE_PROJECTS.map(project => project.id));
const reasons = {
  applied: '실제 건설대 작업에 전승 작업 1을 적용했습니다.',
  missed_day: '예약한 바로 다음 아침이 지나 전승 예약이 만료되었습니다.',
  no_project: '아침 정산에 선택된 사업이 없어 전승 예약이 만료되었습니다.',
  target_changed: '선택한 사업이 바뀌어 전승 예약이 만료되었습니다.',
  completed: '예약한 사업이 이미 완성되어 전승 예약이 만료되었습니다.',
  locked: '사업의 선행 연구가 충족되지 않아 전승 예약이 만료되었습니다.',
  no_builders: '실제 건설대 일손이 없어 전승 예약이 만료되었습니다.',
  materials: '실제 착수 자재가 부족하여 전승 예약이 만료되었습니다.',
  ended: '런이 종료되어 전승 예약이 만료되었습니다.',
  no_base_work: '실제 기본 건설 작업이 없어 전승 예약이 만료되었습니다.',
  no_room: '기본 건설 작업으로 남은 필요량을 채워 추가 전승 작업을 적용하지 않았습니다.',
};
const processingReasons = {
  applied: '실제 기본 가공과 재료 소비에 전승 가공 1묶음을 더했습니다.',
  missed_day: '예약한 바로 다음 아침이 지나 가공 전승이 만료되었습니다.',
  ended: '런이 종료되어 가공 전승이 만료되었습니다.',
  no_plan: '가공 계획이 꺼져 가공 전승이 만료되었습니다.',
  target_changed: '공정이나 목표 비축이 바뀌어 가공 전승이 만료되었습니다.',
  locked: '필요 연구가 충족되지 않아 가공 전승이 만료되었습니다.',
  quantity: '실제 재고 수량을 확인할 수 없어 가공 전승이 만료되었습니다.',
  no_workers: '실제 가공대 일손이 없어 가공 전승이 만료되었습니다.',
  materials: '추가 묶음에 필요한 실제 재료가 부족해 가공 전승이 만료되었습니다.',
  no_base_work: '실제 기본 가공이 없어 가공 전승을 적용하지 않았습니다.',
  no_room: '기본 가공으로 목표를 채워 가공 전승을 적용하지 않았습니다.',
  stock_limit: '안전한 재고 수량 한도로 가공 전승을 적용하지 않았습니다.',
};
const record = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const shape = (value, keys) => record(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));
const integer = value => Number.isSafeInteger(value) && value >= 0;
const day = value => integer(value) && value >= 1;
const craftCount = founder => ['craft', 'camp', 'project'].reduce((sum, kind) => sum + Number(founder?.tallies?.[kind] || 0), 0);

function contributionDaysFit(rows) {
  const fixed = new Set();
  const flexible = [];
  for (const row of rows) {
    const count = row.appliedWork ?? row.appliedBatches;
    // First/last dates are actual applications, not an estimated interval.
    for (const date of new Set([row.firstDay, row.lastDay])) {
      if (fixed.has(date)) return false;
      fixed.add(date);
    }
    if (count > 2) flexible.push({ start: row.firstDay + 1, end: row.lastDay - 1, count: count - 2 });
  }
  // Check whether the remaining aggregate uses can fit the unoccupied days.
  // This rejects impossible history without inventing any missing use dates.
  for (const start of new Set(flexible.map(row => row.start))) {
    for (const end of new Set(flexible.map(row => row.end))) {
      if (end < start) continue;
      const demand = flexible.filter(row => row.start >= start && row.end <= end).reduce((sum, row) => sum + row.count, 0);
      const occupied = [...fixed].filter(date => date >= start && date <= end).length;
      if (demand > end - start + 1 - occupied) return false;
    }
  }
  return true;
}

function hasProcessingBonusEvidence(raw, state) {
  const production = state?.tribe?.lastProduction;
  const actual = production?.processing;
  if (!(actual?.bonusBatches > 0)) return true;
  if (raw?.origin !== 'new_run' || !day(production.day) || production.day > state.day) return false;
  const pending = raw.pending;
  if (pending?.kind === 'processing' && pending.dueDay === production.day && production.day === state.day
    && pending.actionId === actual.actionId && pending.targetStock === actual.targetStock) return true;
  // A later morning can settle project work before replacing yesterday's
  // production receipt. Its exact last contribution day still proves origin.
  if (production.day < state.day && Array.isArray(raw.processingRecords)
    && raw.processingRecords.some(row => row.actionId === actual.actionId && row.lastDay === production.day)) return true;
  const receipt = raw.lastSettlement;
  if (receipt?.kind !== 'processing' || receipt.result !== 'applied' || receipt.day !== production.day) return false;
  if (!['actionId', 'targetStock', 'workers', 'batches', 'bonusBatches', 'stockBefore', 'stockAfter']
    .every(key => receipt[key] === actual[key])) return false;
  return ['spent', 'gains'].every(key => record(receipt[key]) && record(actual[key])
    && Object.keys(receipt[key]).length === Object.keys(actual[key]).length
    && Object.entries(receipt[key]).every(([id, count]) => Object.hasOwn(actual[key], id) && actual[key][id] === count));
}

function hasKnownOrigin(state) {
  const history = state?.founderHistory;
  return state?.lineage?.mode === 'hybrid' && history?.origin === 'new_run'
    && history.foundersKnown === true && isValidFounderHistory(history, state)
    && history.members.filter(member => member.isFounder).length === 3
    && state.ancestralFaith?.origin === 'new_run' && isValidAncestralFaith(state.ancestralFaith, state);
}

export function createProjectTradition(state) {
  return { version: 1, runId: state.runId, origin: hasKnownOrigin(state) ? 'new_run' : 'legacy_disabled',
    lastReservedDay: 0, pending: null, lastSettlement: null, records: [] };
}

export function isValidProjectTradition(raw, state, { completingProjectId = '' } = {}) {
  if (!hasProcessingBonusEvidence(raw, state)) return false;
  if (raw === undefined) return true;
  const rootKeys = ['version', 'runId', 'origin', 'lastReservedDay', 'pending', 'lastSettlement', 'records'];
  if (record(raw) && Object.hasOwn(raw, 'processingRecords')) rootKeys.push('processingRecords');
  if (!shape(raw, rootKeys)
    || raw.version !== 1 || typeof raw.runId !== 'string' || raw.runId !== state?.runId
    || !day(state?.day) || !['new_run', 'legacy_disabled'].includes(raw.origin)
    || !integer(raw.lastReservedDay) || raw.lastReservedDay > state.day
    || !Array.isArray(raw.records) || raw.records.length > TRIBE_PROJECTS.length * 3) return false;
  if (raw.origin === 'legacy_disabled') return raw.lastReservedDay === 0 && raw.pending === null && raw.lastSettlement === null
    && !raw.records.length && !Object.hasOwn(raw, 'processingRecords');
  if (!hasKnownOrigin(state)) return false;
  const founderValid = founderId => state.founderHistory.members.some(member => member.isFounder
    && member.actorId === founderId && craftCount(member) >= 3);
  const recordIds = new Set();
  const projectTotals = new Map();
  for (const contribution of raw.records) {
    if (!shape(contribution, ['projectId', 'founderId', 'appliedWork', 'firstDay', 'lastDay', 'completedDay'])
      || !projectIds.has(contribution.projectId) || !founderValid(contribution.founderId)
      || !integer(contribution.appliedWork) || contribution.appliedWork < 1
      || !day(contribution.firstDay) || contribution.firstDay < 2 || !day(contribution.lastDay) || contribution.lastDay < contribution.firstDay
      || contribution.appliedWork > contribution.lastDay - contribution.firstDay + 1
      || (contribution.appliedWork === 1 && contribution.firstDay !== contribution.lastDay)
      || contribution.lastDay > state.day || contribution.lastDay > raw.lastReservedDay + 1 || !integer(contribution.completedDay)
      || contribution.completedDay > state.day
      || (state.projects?.completed?.[contribution.projectId] && contribution.completedDay === 0
        && contribution.projectId !== completingProjectId)
      || (contribution.completedDay > 0 && (contribution.completedDay < contribution.lastDay
        || !state.projects?.completed?.[contribution.projectId]))) return false;
    const key = `${contribution.projectId}\0${contribution.founderId}`;
    if (recordIds.has(key)) return false;
    recordIds.add(key);
    projectTotals.set(contribution.projectId, (projectTotals.get(contribution.projectId) || 0) + contribution.appliedWork);
  }
  for (const [id, total] of projectTotals) {
    if (total > TRIBE_PROJECTS.find(project => project.id === id).work
      || total > Number(state.projects?.progress?.[id] || 0)) return false;
  }
  const processingRecords = Object.hasOwn(raw, 'processingRecords') ? raw.processingRecords : [];
  if (!Array.isArray(processingRecords) || (Object.hasOwn(raw, 'processingRecords') && !processingRecords.length)
    || processingRecords.length > TRIBE_PROCESS_ACTION_IDS.length * 3) return false;
  const processingIds = new Set();
  for (const row of processingRecords) {
    if (!shape(row, ['actionId', 'founderId', 'appliedBatches', 'firstDay', 'lastDay'])
      || !TRIBE_PROCESS_ACTION_IDS.includes(row.actionId) || !founderValid(row.founderId)
      || !integer(row.appliedBatches) || row.appliedBatches < 1
      || !day(row.firstDay) || row.firstDay < 2 || !day(row.lastDay) || row.lastDay < row.firstDay
      || row.lastDay > state.day || row.lastDay > raw.lastReservedDay + 1
      || row.appliedBatches > row.lastDay - row.firstDay + 1
      || (row.appliedBatches === 1 && row.firstDay !== row.lastDay)) return false;
    const key = `${row.actionId}\0${row.founderId}`;
    if (processingIds.has(key)) return false;
    processingIds.add(key);
  }
  const totalWork = raw.records.reduce((sum, row) => sum + row.appliedWork, 0)
    + processingRecords.reduce((sum, row) => sum + row.appliedBatches, 0);
  if (!integer(totalWork) || totalWork > Math.min(raw.lastReservedDay, state.day - 1)) return false;
  if (processingRecords.length && !contributionDaysFit([...raw.records, ...processingRecords])) return false;
  if (raw.pending !== null) {
    const pending = raw.pending;
    const processing = pending?.kind === 'processing';
    if (!(processing
      ? shape(pending, ['kind', 'reservedDay', 'dueDay', 'actionId', 'targetStock', 'founderId'])
        && pending.actionId !== '' && isValidTribeProcessingPlan({ actionId: pending.actionId, targetStock: pending.targetStock })
      : shape(pending, ['reservedDay', 'dueDay', 'projectId', 'founderId']) && projectIds.has(pending.projectId))
      || !day(pending.reservedDay) || pending.reservedDay !== raw.lastReservedDay
      || pending.reservedDay > state.day || !day(pending.dueDay) || pending.dueDay !== pending.reservedDay + 1
      || !founderValid(pending.founderId)
      || state.ancestralFaith.lastRiteDay !== pending.reservedDay
      || state.ancestralFaith.lastRiteFounderId !== pending.founderId) return false;
    const active = state.ancestralFaith.active;
    if (processing && active && (active.domain !== 'craft' || active.founderId !== pending.founderId
      || active.day !== pending.reservedDay || active.remaining > 1)) return false;
  }
  if (raw.lastSettlement !== null) {
    const receipt = raw.lastSettlement;
    if (receipt?.kind === 'processing') {
      if (!isValidProcessingSettlement(receipt, state, founderValid, processingRecords)) return false;
      if (receipt.reservedDay > raw.lastReservedDay || (raw.pending && receipt.reservedDay >= raw.pending.reservedDay)) return false;
    } else {
    if (!shape(receipt, ['day', 'reservedDay', 'dueDay', 'reservedProjectId', 'projectId', 'founderId',
      'baseWork', 'bonusWork', 'progressBefore', 'progressAfter', 'result', 'reason'])
      || !day(receipt.day) || receipt.day > state.day || !day(receipt.reservedDay)
      || receipt.reservedDay > raw.lastReservedDay || !day(receipt.dueDay)
      || receipt.dueDay !== receipt.reservedDay + 1 || receipt.day < receipt.dueDay
      || !projectIds.has(receipt.reservedProjectId) || !founderValid(receipt.founderId)
      || !(receipt.projectId === '' || projectIds.has(receipt.projectId))
      || !['baseWork', 'bonusWork', 'progressBefore', 'progressAfter'].every(key => integer(receipt[key]))
      || receipt.bonusWork > 1 || receipt.progressAfter !== receipt.progressBefore + receipt.baseWork + receipt.bonusWork
      || !['applied', 'expired'].includes(receipt.result) || !Object.hasOwn(reasons, receipt.reason)) return false;
    const project = TRIBE_PROJECTS.find(project => project.id === receipt.projectId);
    if (receipt.progressAfter > (project?.work || 0)) return false;
    if (receipt.result === 'applied' && (receipt.reason !== 'applied' || receipt.bonusWork !== 1
      || receipt.baseWork < 1 || receipt.day !== receipt.dueDay || receipt.projectId !== receipt.reservedProjectId)) return false;
    if (receipt.result === 'applied' && !raw.records.some(row => row.projectId === receipt.projectId
      && row.founderId === receipt.founderId && row.appliedWork >= receipt.bonusWork && row.lastDay >= receipt.day)) return false;
    if (receipt.result === 'expired' && (receipt.reason === 'applied' || receipt.bonusWork !== 0)) return false;
    if (receipt.reason === 'target_changed' && receipt.projectId === receipt.reservedProjectId) return false;
    if (receipt.reason === 'no_project' && receipt.projectId !== '') return false;
    if (raw.pending && receipt.reservedDay >= raw.pending.reservedDay) return false;
    }
  }
  if (raw.lastReservedDay === 0) return raw.pending === null && raw.lastSettlement === null && !raw.records.length && !processingRecords.length;
  return raw.pending !== null || raw.lastSettlement?.reservedDay === raw.lastReservedDay;
}

export function normalizeProjectTradition(raw, state, options = {}) {
  // Missing old-save state stays disabled. Reading a run never creates a
  // reservation or credits a previously completed community project.
  if (raw === undefined) {
    if (!hasProcessingBonusEvidence(raw, state)) throw new RangeError('Missing processing tradition provenance');
    return { version: 1, runId: state.runId, origin: 'legacy_disabled',
      lastReservedDay: 0, pending: null, lastSettlement: null, records: [] };
  }
  if (!isValidProjectTradition(raw, state, options)) throw new RangeError('Invalid project tradition');
  // A due reservation survives the temporary day+1 state until real building
  // work is settled. Faith's ordinary same-day expiry does not erase it.
  return { ...raw, pending: raw.pending ? { ...raw.pending } : null,
    lastSettlement: raw.lastSettlement ? { ...raw.lastSettlement,
      ...(raw.lastSettlement.kind === 'processing' ? { spent: { ...raw.lastSettlement.spent }, gains: { ...raw.lastSettlement.gains } } : {}) } : null,
    records: raw.records.map(row => ({ ...row })),
    ...(Object.hasOwn(raw, 'processingRecords') ? { processingRecords: raw.processingRecords.map(row => ({ ...row })) } : {}) };
}

export function reserveProjectTradition(state, { projectId, founderId }) {
  const tradition = normalizeProjectTradition(state.projectTradition, state);
  if (state.ended || tradition.origin !== 'new_run' || tradition.pending || tradition.lastReservedDay === state.day) return state;
  return { ...state, projectTradition: { ...tradition, lastReservedDay: state.day,
    pending: { reservedDay: state.day, dueDay: state.day + 1, projectId, founderId } } };
}

export function projectTraditionBonus(state, { projectId, baseWork, progressBefore, work }) {
  const tradition = normalizeProjectTradition(state.projectTradition, state);
  const pending = tradition.pending;
  if (state.ended || tradition.origin !== 'new_run' || !pending || pending.kind === 'processing' || pending.dueDay !== state.day
    || pending.projectId !== projectId || baseWork < 1) return 0;
  return Math.min(1, Math.max(0, work - progressBefore - baseWork));
}

export function settleProjectTradition(state, { projectId = '', completed = false, available = false,
  builders = 0, committed = false, baseWork = 0, bonusWork = 0, progressBefore = 0, progressAfter = progressBefore } = {}) {
  const tradition = normalizeProjectTradition(state.projectTradition, state);
  const pending = tradition.pending;
  if (tradition.origin !== 'new_run' || !pending || pending.kind === 'processing' || pending.dueDay > state.day) return state;
  const reason = pending.dueDay !== state.day ? 'missed_day' : state.ended ? 'ended'
    : (state.projects?.completed?.[pending.projectId] || completed) ? 'completed' : !projectId ? 'no_project'
      : pending.projectId !== projectId ? 'target_changed' : !available ? 'locked'
      : builders < 1 ? 'no_builders' : !committed ? 'materials' : baseWork < 1 ? 'no_base_work'
        : bonusWork < 1 ? 'no_room' : 'applied';
  const receipt = { day: state.day, reservedDay: pending.reservedDay, dueDay: pending.dueDay,
    reservedProjectId: pending.projectId, projectId, founderId: pending.founderId,
    baseWork, bonusWork, progressBefore, progressAfter, result: reason === 'applied' ? 'applied' : 'expired', reason };
  const records = tradition.records.map(row => ({ ...row }));
  if (reason === 'applied' && bonusWork > 0) {
    const prior = records.find(row => row.projectId === projectId && row.founderId === pending.founderId);
    if (prior) { prior.appliedWork += bonusWork; prior.lastDay = state.day; }
    else records.push({ projectId, founderId: pending.founderId, appliedWork: bonusWork,
      firstDay: state.day, lastDay: state.day, completedDay: 0 });
  }
  return { ...state, projectTradition: { ...tradition, pending: null, lastSettlement: receipt, records } };
}

export function markProjectTraditionCompleted(state, projectId) {
  const tradition = normalizeProjectTradition(state.projectTradition, state, { completingProjectId: projectId });
  if (tradition.origin !== 'new_run' || !tradition.records.some(row => row.projectId === projectId && !row.completedDay)) return state;
  return { ...state, projectTradition: { ...tradition, records: tradition.records.map(row =>
    row.projectId === projectId && !row.completedDay ? { ...row, completedDay: state.day } : row) } };
}

export const projectTraditionReason = reason => reasons[reason] || '정산 결과를 확인할 수 없습니다.';

function isValidProcessingSettlement(receipt, state, founderValid, records) {
  if (!shape(receipt, ['kind', 'day', 'reservedDay', 'dueDay', 'reservedActionId', 'reservedTargetStock',
    'actionId', 'targetStock', 'founderId', 'workers', 'baseBatches', 'bonusBatches', 'batches',
    'stockBefore', 'stockAfter', 'spent', 'gains', 'result', 'reason'])
    || !day(receipt.day) || receipt.day > state.day || !day(receipt.reservedDay)
    || !day(receipt.dueDay) || receipt.dueDay !== receipt.reservedDay + 1 || receipt.day < receipt.dueDay
    || receipt.reservedActionId === '' || !isValidTribeProcessingPlan({ actionId: receipt.reservedActionId, targetStock: receipt.reservedTargetStock })
    || !founderValid(receipt.founderId) || !integer(receipt.baseBatches)
    || receipt.batches !== receipt.baseBatches + receipt.bonusBatches
    || !['applied', 'expired'].includes(receipt.result) || !Object.hasOwn(processingReasons, receipt.reason)
    || !isValidTribeProcessingReceipt({ actionId: receipt.actionId, targetStock: receipt.targetStock,
      workers: receipt.workers, batches: receipt.batches, bonusBatches: receipt.bonusBatches,
      stockBefore: receipt.stockBefore, stockAfter: receipt.stockAfter, spent: receipt.spent, gains: receipt.gains,
      reason: processingReasons[receipt.reason] })) return false;
  const matches = receipt.actionId === receipt.reservedActionId && receipt.targetStock === receipt.reservedTargetStock;
  if (receipt.result === 'applied') {
    return receipt.reason === 'applied' && receipt.day === receipt.dueDay && matches
      && receipt.bonusBatches === 1 && receipt.baseBatches >= 1
      && records.some(row => row.actionId === receipt.actionId && row.founderId === receipt.founderId
        && row.appliedBatches >= 1 && row.lastDay >= receipt.day);
  }
  return receipt.reason !== 'applied' && receipt.bonusBatches === 0
    && (receipt.reason !== 'target_changed' || !matches)
    && (receipt.reason !== 'no_plan' || receipt.actionId === '')
    && (receipt.reason !== 'missed_day' || receipt.day > receipt.dueDay);
}

export function reserveProcessingTradition(state, { actionId, targetStock, founderId }) {
  const tradition = normalizeProjectTradition(state.projectTradition, state);
  if (state.ended || tradition.origin !== 'new_run' || tradition.pending || tradition.lastReservedDay === state.day
    || !actionId || !isValidTribeProcessingPlan({ actionId, targetStock })) return state;
  const projectTradition = { ...tradition, lastReservedDay: state.day,
    pending: { kind: 'processing', reservedDay: state.day, dueDay: state.day + 1, actionId, targetStock, founderId } };
  return isValidProjectTradition(projectTradition, state) ? { ...state, projectTradition } : state;
}

export function processingTraditionBonus(state, { actionId, targetStock, workers = 0, baseBatches = 0,
  materialBatches = 0, neededBatches = 0, safeStockBatches = 0, available = true, quantityValid = true } = {}) {
  const tradition = normalizeProjectTradition(state.projectTradition, state);
  const pending = tradition.pending;
  if (state.ended || tradition.origin !== 'new_run' || pending?.kind !== 'processing' || pending.dueDay !== state.day
    || pending.actionId !== actionId || pending.targetStock !== targetStock || !available || !quantityValid
    || ![workers, baseBatches, materialBatches, neededBatches, safeStockBatches].every(integer)
    || workers < 1 || workers > 24 || baseBatches < 1 || baseBatches > workers) return 0;
  return Math.min(materialBatches, neededBatches, safeStockBatches) > baseBatches ? 1 : 0;
}

export function settleProcessingTradition(state, { actionId = '', targetStock = 0, workers = 0, baseBatches = 0,
  bonusBatches = 0, batches = baseBatches + bonusBatches, stockBefore = 0, stockAfter = stockBefore,
  spent = {}, gains = {}, available = true, quantityValid = true,
  materialBatches = 0, neededBatches = 0, safeStockBatches = 0 } = {}) {
  const tradition = normalizeProjectTradition(state.projectTradition, state);
  const pending = tradition.pending;
  if (tradition.origin !== 'new_run' || pending?.kind !== 'processing' || pending.dueDay > state.day) return state;
  if (bonusBatches > 0 && processingTraditionBonus(state, { actionId, targetStock, workers, baseBatches,
    materialBatches, neededBatches, safeStockBatches, available, quantityValid }) !== bonusBatches) {
    throw new RangeError('Invalid processing tradition bonus');
  }
  const reason = pending.dueDay !== state.day ? 'missed_day' : state.ended ? 'ended'
    : !actionId ? 'no_plan' : pending.actionId !== actionId || pending.targetStock !== targetStock ? 'target_changed'
      : !available ? 'locked' : !quantityValid ? 'quantity' : workers < 1 ? 'no_workers'
        : baseBatches < 1 ? materialBatches < 1 ? 'materials' : neededBatches < 1 ? 'no_room'
          : safeStockBatches < 1 ? 'stock_limit' : 'no_base_work'
          : bonusBatches === 1 ? 'applied' : materialBatches <= baseBatches ? 'materials'
            : neededBatches <= baseBatches ? 'no_room' : safeStockBatches <= baseBatches ? 'stock_limit' : 'no_room';
  const receipt = { kind: 'processing', day: state.day, reservedDay: pending.reservedDay, dueDay: pending.dueDay,
    reservedActionId: pending.actionId, reservedTargetStock: pending.targetStock, actionId, targetStock,
    founderId: pending.founderId, workers, baseBatches, bonusBatches, batches, stockBefore, stockAfter,
    spent: { ...spent }, gains: { ...gains }, result: reason === 'applied' ? 'applied' : 'expired', reason };
  const records = (tradition.processingRecords || []).map(row => ({ ...row }));
  if (reason === 'applied') {
    const prior = records.find(row => row.actionId === actionId && row.founderId === pending.founderId);
    if (prior) { prior.appliedBatches += 1; prior.lastDay = state.day; }
    else records.push({ actionId, founderId: pending.founderId, appliedBatches: 1, firstDay: state.day, lastDay: state.day });
  }
  const projectTradition = { ...tradition, pending: null, lastSettlement: receipt,
    ...(records.length ? { processingRecords: records } : {}) };
  if (!isValidProjectTradition(projectTradition, state)) throw new RangeError('Invalid processing tradition settlement');
  return { ...state, projectTradition };
}

export const processingTraditionReason = reason => processingReasons[reason] || '가공 전승 정산 결과를 확인할 수 없습니다.';
