export function formatMoveIntentLabel(reason, objectiveType = '', objectiveSubkind = '') {
  const raw = String(reason || '').replace(/:ttl/g, '').replace(/:priority/g, '').trim();
  const type = String(objectiveType || '').toLowerCase();
  const sub = String(objectiveSubkind || '').toLowerCase();

  if (raw.startsWith('early_route')) return '루트 파밍';
  if (raw === 'recover') return '회복 우선';
  if (raw.includes('크레딧') || raw.includes('야생동물')) return '야생동물 사냥';
  if (raw.includes('키오스크')) return '키오스크 주문';
  if (type === 'natural_core' || raw.includes('특수 재료')) {
    if (sub === 'meteor') return '운석 확인';
    if (sub === 'life_tree') return '생명의 나무 확인';
    return '특수 재료 확인';
  }
  if (type === 'legendary_crate' || raw.includes('전설')) return '전설 상자 확인';
  if (type === 'transcend_crate' || raw.includes('초월')) return '초월 상자 확인';
  if (type === 'boss' || raw.includes('알파') || raw.includes('오메가') || raw.includes('위클라인')) return '보스 확인';
  if (type === 'dimension_rift' || raw.includes('dimension_rift') || raw.includes('차원의 틈')) return '차원의 틈 확인';
  if (raw.includes('재료')) return '재료 파밍';
  return '로테이션';
}
