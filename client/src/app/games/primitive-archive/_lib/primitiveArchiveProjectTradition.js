import { TRIBE_PROJECTS } from './primitiveArchiveData';
import { isValidFounderHistory } from './primitiveArchiveFounders.js';
import { isValidAncestralFaith } from './primitiveArchiveAncestralFaith.js';

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
const record = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const shape = (value, keys) => record(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));
const integer = value => Number.isSafeInteger(value) && value >= 0;
const day = value => integer(value) && value >= 1;
const craftCount = founder => ['craft', 'camp', 'project'].reduce((sum, kind) => sum + Number(founder?.tallies?.[kind] || 0), 0);

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
  if (raw === undefined) return true;
  if (!shape(raw, ['version', 'runId', 'origin', 'lastReservedDay', 'pending', 'lastSettlement', 'records'])
    || raw.version !== 1 || typeof raw.runId !== 'string' || raw.runId !== state?.runId
    || !day(state?.day) || !['new_run', 'legacy_disabled'].includes(raw.origin)
    || !integer(raw.lastReservedDay) || raw.lastReservedDay > state.day
    || !Array.isArray(raw.records) || raw.records.length > TRIBE_PROJECTS.length * 3) return false;
  if (raw.origin === 'legacy_disabled') return raw.lastReservedDay === 0 && raw.pending === null && raw.lastSettlement === null && !raw.records.length;
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
  if (raw.records.reduce((sum, row) => sum + row.appliedWork, 0) > Math.min(raw.lastReservedDay, state.day - 1)) return false;
  if (raw.pending !== null) {
    const pending = raw.pending;
    if (!shape(pending, ['reservedDay', 'dueDay', 'projectId', 'founderId'])
      || !day(pending.reservedDay) || pending.reservedDay !== raw.lastReservedDay
      || pending.reservedDay > state.day || !day(pending.dueDay) || pending.dueDay !== pending.reservedDay + 1
      || !projectIds.has(pending.projectId) || !founderValid(pending.founderId)
      || state.ancestralFaith.lastRiteDay !== pending.reservedDay
      || state.ancestralFaith.lastRiteFounderId !== pending.founderId) return false;
  }
  if (raw.lastSettlement !== null) {
    const receipt = raw.lastSettlement;
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
  if (raw.lastReservedDay === 0) return raw.pending === null && raw.lastSettlement === null && !raw.records.length;
  return raw.pending !== null || raw.lastSettlement?.reservedDay === raw.lastReservedDay;
}

export function normalizeProjectTradition(raw, state, options = {}) {
  // Missing old-save state stays disabled. Reading a run never creates a
  // reservation or credits a previously completed community project.
  if (raw === undefined) return { version: 1, runId: state.runId, origin: 'legacy_disabled',
    lastReservedDay: 0, pending: null, lastSettlement: null, records: [] };
  if (!isValidProjectTradition(raw, state, options)) throw new RangeError('Invalid project tradition');
  // A due reservation survives the temporary day+1 state until real building
  // work is settled. Faith's ordinary same-day expiry does not erase it.
  return { ...raw, pending: raw.pending ? { ...raw.pending } : null,
    lastSettlement: raw.lastSettlement ? { ...raw.lastSettlement } : null, records: raw.records.map(row => ({ ...row })) };
}

export function reserveProjectTradition(state, { projectId, founderId }) {
  const tradition = normalizeProjectTradition(state.projectTradition, state);
  return { ...state, projectTradition: { ...tradition, lastReservedDay: state.day,
    pending: { reservedDay: state.day, dueDay: state.day + 1, projectId, founderId } } };
}

export function projectTraditionBonus(state, { projectId, baseWork, progressBefore, work }) {
  const tradition = normalizeProjectTradition(state.projectTradition, state);
  const pending = tradition.pending;
  if (state.ended || tradition.origin !== 'new_run' || !pending || pending.dueDay !== state.day
    || pending.projectId !== projectId || baseWork < 1) return 0;
  return Math.min(1, Math.max(0, work - progressBefore - baseWork));
}

export function settleProjectTradition(state, { projectId = '', completed = false, available = false,
  builders = 0, committed = false, baseWork = 0, bonusWork = 0, progressBefore = 0, progressAfter = progressBefore } = {}) {
  const tradition = normalizeProjectTradition(state.projectTradition, state);
  const pending = tradition.pending;
  if (tradition.origin !== 'new_run' || !pending || pending.dueDay > state.day) return state;
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
