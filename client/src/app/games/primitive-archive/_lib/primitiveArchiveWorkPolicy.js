export const TRIBE_WORK_POLICIES = Object.freeze([
  Object.freeze({ id: 'balanced', label: '균형 운영',
    description: '기존 식량·건설·자재·기록 배치 순서를 그대로 사용합니다.' }),
  Object.freeze({ id: 'construction', label: '건설 우선',
    description: '기존 비축으로 식량 안전을 확보한 뒤, 실제 자재와 남은 작업이 있는 선택 사업에 자동 일손을 먼저 투입합니다.' }),
  Object.freeze({ id: 'research', label: '기록 우선',
    description: '기존 비축으로 식량 안전을 확보한 뒤, 유효한 목표 기술의 남은 RP 안에서 자동 일손을 기록대에 먼저 투입합니다.' }),
]);

export const isValidTribeWorkPolicy = value => value === undefined
  || (typeof value === 'string' && TRIBE_WORK_POLICIES.some(policy => policy.id === value));

export function normalizeTribeWorkPolicy(value) {
  if (!isValidTribeWorkPolicy(value)) throw new RangeError('Invalid tribe work policy');
  return value === undefined ? 'balanced' : value;
}

export function isValidTribeProductionReceipt(receipt, jobIds) {
  if (!receipt || typeof receipt !== 'object') return true;
  const hasPolicy = Object.hasOwn(receipt, 'workPolicy');
  const hasAssignments = Object.hasOwn(receipt, 'assignments');
  // Older receipts remain observations of their own time. Do not infer either
  // missing field from today's selected policy, jobs or population.
  if (!hasPolicy && !hasAssignments) return true;
  if (Array.isArray(receipt)) return false;
  if (hasPolicy && (typeof receipt.workPolicy !== 'string' || !isValidTribeWorkPolicy(receipt.workPolicy))) return false;
  if (hasAssignments) {
    const assignments = receipt.assignments;
    if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) return false;
    const keys = new Set(jobIds);
    let total = 0;
    for (const [key, count] of Object.entries(assignments)) {
      if (!keys.has(key) || typeof count !== 'number' || !Number.isFinite(count)
        || !Number.isInteger(count) || count < 0 || count > 24) return false;
      total += count;
    }
    if (total > 24) return false;
  }
  return true;
}

export function tribeWorkPolicyDetails({ id, unlocked, ended, applicationBlockedReason = '' }) {
  const policy = TRIBE_WORK_POLICIES.find(row => row.id === normalizeTribeWorkPolicy(id));
  const endedReason = '종료된 런에서는 운영 방침을 변경할 수 없습니다.';
  const lockedReason = '사회 제도 「국가 노동력」을 확립하면 건설·기록 우선 방침을 선택할 수 있습니다.';
  return { id: policy.id, label: policy.label, unlocked: Boolean(unlocked),
    blockedReason: ended ? endedReason : !unlocked ? lockedReason : applicationBlockedReason,
    applicationBlockedReason,
    costText: '방침 변경은 AP·ST·시간·자원을 소비하지 않고 연구나 공로를 추가하지 않습니다.',
    timingText: '선택 즉시 일손을 옮기지 않습니다. 다음 자동 운영 또는 다음 아침 재배치 때 적용합니다. 수동 배치와 이전 저장의 수동 일손은 유지합니다.',
    options: TRIBE_WORK_POLICIES.map(option => {
      const blockedReason = ended ? endedReason : option.id === policy.id ? '현재 선택한 운영 방침입니다.'
        : option.id !== 'balanced' && !unlocked ? lockedReason : '';
      return { ...option, canSelect: !blockedReason, blockedReason };
    }) };
}

export function prioritizeTribeWorkPolicy({ id, unlocked, safeReserve, population, priority, targets,
  projectRemaining = 0, researchRemaining = 0 }) {
  const policyId = normalizeTribeWorkPolicy(id);
  if (!unlocked || !safeReserve || policyId === 'balanced') return { priority, targets, applied: 'balanced' };
  const focus = policyId === 'construction' ? 'builder' : 'scholar';
  const remaining = policyId === 'construction' ? projectRemaining : researchRemaining;
  if (!Number.isFinite(remaining) || remaining <= 0) return { priority, targets, applied: 'balanced' };
  return { priority: [focus, ...priority.filter(job => job !== focus)],
    targets: { ...targets, [focus]: Math.min(population, Math.ceil(remaining)) }, applied: policyId };
}
