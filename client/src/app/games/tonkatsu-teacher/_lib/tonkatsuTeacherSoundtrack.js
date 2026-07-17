export const TONKATSU_TEACHER_BGM_SCENES = Object.freeze({
  opening: 'tonkatsu-opening',
  kitchen: 'tonkatsu-kitchen',
  service: 'tonkatsu-service',
  growth: 'tonkatsu-growth',
  contest: 'tonkatsu-contest',
  judge: 'tonkatsu-judge',
  celebration: 'tonkatsu-celebration',
  setback: 'tonkatsu-setback',
});

export const TONKATSU_TEACHER_SOUNDTRACK = Object.freeze([
  Object.freeze({ scene: 'opening', theme: TONKATSU_TEACHER_BGM_SCENES.opening, title: '가게 불을 켜다', icon: 'tonkatsu-opening' }),
  Object.freeze({ scene: 'kitchen', theme: TONKATSU_TEACHER_BGM_SCENES.kitchen, title: '바삭한 주방', icon: 'tonkatsu-kitchen' }),
  Object.freeze({ scene: 'service', theme: TONKATSU_TEACHER_BGM_SCENES.service, title: '점심시간의 행진', icon: 'tonkatsu-service' }),
  Object.freeze({ scene: 'growth', theme: TONKATSU_TEACHER_BGM_SCENES.growth, title: '비법 연구 노트', icon: 'tonkatsu-growth' }),
  Object.freeze({ scene: 'contest', theme: TONKATSU_TEACHER_BGM_SCENES.contest, title: '챔피언 테이블', icon: 'tonkatsu-contest' }),
  Object.freeze({ scene: 'judge', theme: TONKATSU_TEACHER_BGM_SCENES.judge, title: '맛의 판정', icon: 'tonkatsu-judge' }),
  Object.freeze({ scene: 'celebration', theme: TONKATSU_TEACHER_BGM_SCENES.celebration, title: '축하의 만찬', icon: 'tonkatsu-celebration' }),
  Object.freeze({ scene: 'setback', theme: TONKATSU_TEACHER_BGM_SCENES.setback, title: '다시 불을 지피다', icon: 'tonkatsu-setback' }),
]);

export function resolveTonkatsuTeacherBgmScene({
  activeTabId = 'kitchen',
  state,
  operationsReport,
  judge,
} = {}) {
  if (state?.ended) return TONKATSU_TEACHER_BGM_SCENES.celebration;
  if (activeTabId === 'judge' || Boolean(judge?.match && !judge.match.resolved)) {
    return TONKATSU_TEACHER_BGM_SCENES.judge;
  }

  if (activeTabId === 'kitchen') return TONKATSU_TEACHER_BGM_SCENES.kitchen;
  if (activeTabId === 'students' || activeTabId === 'production') {
    return TONKATSU_TEACHER_BGM_SCENES.service;
  }
  if (activeTabId === 'growth') return TONKATSU_TEACHER_BGM_SCENES.growth;
  if (
    (activeTabId === 'operations' || activeTabId === 'advanced')
    && Number(operationsReport?.readinessPct || 0) < 30
  ) {
    return TONKATSU_TEACHER_BGM_SCENES.setback;
  }
  return TONKATSU_TEACHER_BGM_SCENES.opening;
}

export function tonkatsuTeacherResultMusic(presentation) {
  const key = String(presentation?.key || '');

  if (key === 'newRun' || key === 'nextDay') {
    return { theme: TONKATSU_TEACHER_BGM_SCENES.opening, durationMs: 8_000 };
  }
  if (key === 'cook') {
    return { theme: TONKATSU_TEACHER_BGM_SCENES.kitchen, durationMs: 7_000 };
  }
  if (key === 'cookFail' || key === 'blocked') {
    return { theme: TONKATSU_TEACHER_BGM_SCENES.setback, durationMs: 9_000 };
  }
  if (['purchase', 'sale', 'orderComplete', 'serve', 'businessMode'].includes(key)) {
    return { theme: TONKATSU_TEACHER_BGM_SCENES.service, durationMs: 8_000 };
  }
  if (['methodLevelUp', 'facilityUpgrade', 'research', 'cosmeticBuy', 'cosmeticEquip'].includes(key)) {
    return { theme: TONKATSU_TEACHER_BGM_SCENES.growth, durationMs: 9_000 };
  }
  if (['battleVictory', 'battleDefeat', 'tournamentLoss'].includes(key)) {
    return { theme: TONKATSU_TEACHER_BGM_SCENES.contest, durationMs: 11_000 };
  }
  if (['judgeStart', 'judgeCorrect', 'judgeWrong', 'judgeReset'].includes(key)) {
    return { theme: TONKATSU_TEACHER_BGM_SCENES.judge, durationMs: 10_000 };
  }
  if (key === 'tournamentWin' || key === 'complete') {
    return { theme: TONKATSU_TEACHER_BGM_SCENES.celebration, durationMs: 18_000 };
  }
  return null;
}
