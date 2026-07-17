export const STARLEAGUE_BGM_SCENES = Object.freeze({
  office: 'starleague-office',
  broadcast: 'starleague-broadcast',
  personal: 'starleague-personal',
  winners: 'starleague-winners',
  finals: 'starleague-finals',
  ceremony: 'starleague-ceremony',
  archive: 'starleague-archive',
});

export const STARLEAGUE_SOUNDTRACK = Object.freeze([
  Object.freeze({ scene: 'office', theme: STARLEAGUE_BGM_SCENES.office, title: '프런트 데스크', icon: 'sponsor' }),
  Object.freeze({ scene: 'broadcast', theme: STARLEAGUE_BGM_SCENES.broadcast, title: 'ON AIR', icon: 'match' }),
  Object.freeze({ scene: 'personal', theme: STARLEAGUE_BGM_SCENES.personal, title: '별들의 무대', icon: 'cup' }),
  Object.freeze({ scene: 'winners', theme: STARLEAGUE_BGM_SCENES.winners, title: '승자연전', icon: 'winners' }),
  Object.freeze({ scene: 'finals', theme: STARLEAGUE_BGM_SCENES.finals, title: '마지막 한 세트', icon: 'verdict' }),
  Object.freeze({ scene: 'ceremony', theme: STARLEAGUE_BGM_SCENES.ceremony, title: '챔피언의 밤', icon: 'champion' }),
  Object.freeze({ scene: 'archive', theme: STARLEAGUE_BGM_SCENES.archive, title: '명승부 필름', icon: 'archive' }),
]);

const OFFICE_TABS = new Set(['team', 'market']);
const DRAMATIC_MATCH_ACTIONS = new Set(['comeback', 'defeat', 'event', 'verdict', 'victory']);

export function resolveStarleagueBgmScene({
  activeTabId = 'league',
  ended = false,
  personalStage = 'NOT_STARTED',
  seasonStage = 'REGULAR',
  winnersStage = 'NOT_STARTED',
} = {}) {
  if (activeTabId === 'records') return STARLEAGUE_BGM_SCENES.archive;
  if (ended) return STARLEAGUE_BGM_SCENES.ceremony;
  if (OFFICE_TABS.has(activeTabId)) return STARLEAGUE_BGM_SCENES.office;
  if (activeTabId === 'cups') {
    if (winnersStage === 'IN_PROGRESS') return STARLEAGUE_BGM_SCENES.winners;
    if (personalStage === 'IN_PROGRESS') return STARLEAGUE_BGM_SCENES.personal;
    return personalStage === 'DONE' && winnersStage !== 'DONE'
      ? STARLEAGUE_BGM_SCENES.winners
      : STARLEAGUE_BGM_SCENES.personal;
  }
  if (['POSTSEASON', 'POSTSEASON_READY'].includes(seasonStage)) {
    return STARLEAGUE_BGM_SCENES.finals;
  }
  return STARLEAGUE_BGM_SCENES.broadcast;
}

export function starleagueResultMusic(presentation = {}) {
  const key = String(presentation?.key || '');
  const action = String(presentation?.action || '');
  if (['seasonChampion', 'personalChampion', 'winnersChampion'].includes(key)) {
    return { theme: STARLEAGUE_BGM_SCENES.ceremony, durationMs: 18_000 };
  }
  if (key === 'regularMatch') {
    return {
      theme: STARLEAGUE_BGM_SCENES.finals,
      durationMs: DRAMATIC_MATCH_ACTIONS.has(action) ? 15_000 : 10_000,
    };
  }
  if (['personalStart', 'personalProgress', 'personalMatch'].includes(key)) {
    return { theme: STARLEAGUE_BGM_SCENES.personal, durationMs: 10_000 };
  }
  if (['winnersStart', 'winnersSet'].includes(key)) {
    return { theme: STARLEAGUE_BGM_SCENES.winners, durationMs: 10_000 };
  }
  if (['newRun', 'nextSeason'].includes(key)) {
    return { theme: STARLEAGUE_BGM_SCENES.broadcast, durationMs: 9_000 };
  }
  return null;
}
