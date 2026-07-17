export const PRIMITIVE_ARCHIVE_BGM_SCENES = Object.freeze({
  survival: 'archive-survival',
  frontier: 'archive-frontier',
  insight: 'archive-insight',
  settlement: 'archive-settlement',
  crisis: 'archive-crisis',
  era: 'archive-era',
  legacy: 'archive-legacy',
});

export const PRIMITIVE_ARCHIVE_SOUNDTRACK = Object.freeze([
  Object.freeze({ scene: 'survival', theme: PRIMITIVE_ARCHIVE_BGM_SCENES.survival, title: '불씨와 첫 발자국', icon: 'survival' }),
  Object.freeze({ scene: 'frontier', theme: PRIMITIVE_ARCHIVE_BGM_SCENES.frontier, title: '경계 너머', icon: 'discover' }),
  Object.freeze({ scene: 'insight', theme: PRIMITIVE_ARCHIVE_BGM_SCENES.insight, title: '별 아래의 문답', icon: 'research' }),
  Object.freeze({ scene: 'settlement', theme: PRIMITIVE_ARCHIVE_BGM_SCENES.settlement, title: '돌과 나무의 노래', icon: 'camp' }),
  Object.freeze({ scene: 'crisis', theme: PRIMITIVE_ARCHIVE_BGM_SCENES.crisis, title: '겨울의 이빨', icon: 'warning' }),
  Object.freeze({ scene: 'era', theme: PRIMITIVE_ARCHIVE_BGM_SCENES.era, title: '새 시대의 문', icon: 'primitive-era' }),
  Object.freeze({ scene: 'legacy', theme: PRIMITIVE_ARCHIVE_BGM_SCENES.legacy, title: '기록은 남는다', icon: 'archive' }),
]);

const FRONTIER_TABS = new Set(['map']);
const INSIGHT_TABS = new Set(['growth']);
const SETTLEMENT_TABS = new Set(['camp', 'tribe']);

export function primitiveArchiveCrisisLevel({
  bodyTemp = 37,
  hp = 100,
  hunger = 0,
  stamina = 100,
} = {}) {
  const dangerSignals = [
    Number(hp) <= 35,
    Number(hunger) >= 70,
    Number(stamina) <= 18,
    Number(bodyTemp) <= 35.4,
  ].filter(Boolean).length;
  return dangerSignals >= 1 ? dangerSignals : 0;
}

export function resolvePrimitiveArchiveBgmScene({
  activeTabId = 'actions',
  bodyTemp = 37,
  ended = false,
  hp = 100,
  hunger = 0,
  stamina = 100,
  victory = false,
} = {}) {
  if (victory || ended) return PRIMITIVE_ARCHIVE_BGM_SCENES.legacy;
  if (primitiveArchiveCrisisLevel({ bodyTemp, hp, hunger, stamina }) > 0) {
    return PRIMITIVE_ARCHIVE_BGM_SCENES.crisis;
  }
  if (FRONTIER_TABS.has(activeTabId)) return PRIMITIVE_ARCHIVE_BGM_SCENES.frontier;
  if (INSIGHT_TABS.has(activeTabId)) return PRIMITIVE_ARCHIVE_BGM_SCENES.insight;
  if (SETTLEMENT_TABS.has(activeTabId)) return PRIMITIVE_ARCHIVE_BGM_SCENES.settlement;
  return PRIMITIVE_ARCHIVE_BGM_SCENES.survival;
}

export function primitiveArchiveMilestoneMusic(cue = '') {
  const key = String(cue || '');
  if (key === 'eraAdvance') return { theme: PRIMITIVE_ARCHIVE_BGM_SCENES.era, durationMs: 15_000 };
  if (key === 'discover') return { theme: PRIMITIVE_ARCHIVE_BGM_SCENES.frontier, durationMs: 9_000 };
  if (['complete', 'civicComplete', 'inspiration', 'research'].includes(key)) {
    return { theme: PRIMITIVE_ARCHIVE_BGM_SCENES.insight, durationMs: 10_000 };
  }
  if (['projectComplete', 'growth', 'diplomacy'].includes(key)) {
    return { theme: PRIMITIVE_ARCHIVE_BGM_SCENES.settlement, durationMs: 9_000 };
  }
  return null;
}
