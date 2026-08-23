import {
  getGameIntegration,
  getGamePortingChecklist,
} from './gameCatalog.js';

export function getApplicableGamePortingChecklist(gameOrSlug) {
  const integration = getGameIntegration(gameOrSlug);
  return getGamePortingChecklist(gameOrSlug).filter((item) => {
    if (item.key === 'room') return integration.roomSystem !== 'none';
    if (item.key === 'sync') return integration.roomSystem === 'game-room';
    return true;
  });
}

export function getGamePortingProgress(gameOrSlug) {
  const items = getApplicableGamePortingChecklist(gameOrSlug);
  const total = items.length || 1;
  const done = items.filter((item) => item.done).length;
  const ratio = done / total;
  const percent = Math.round(ratio * 100);
  return {
    done,
    total,
    ratio,
    label: `${done}/${total}`,
    percent,
    percentLabel: `${percent}%`,
  };
}
