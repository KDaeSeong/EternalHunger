export const AUTO_DAY_GOALS = [
  { id: 'default', label: '기본 운영', description: '기존 우선순위로 생존과 발전을 함께 운영합니다.' },
  { id: 'completion', label: '기초 완주', description: '생존을 지킨 뒤 책과 아카이브 시설, 필요한 재료를 우선합니다.' },
  { id: 'development', label: '장기 발전', description: '생존을 지킨 뒤 선택한 공동 사업과 연구, 제도, 생산을 우선합니다.' },
  { id: 'exploration', label: '탐사', description: '생존을 지킨 뒤 해금과 체력이 허용하는 실제 지도 답사를 우선합니다.' },
];

export function normalizeAutoDayGoal(value) {
  return AUTO_DAY_GOALS.some((goal) => goal.id === value) ? value : 'default';
}
