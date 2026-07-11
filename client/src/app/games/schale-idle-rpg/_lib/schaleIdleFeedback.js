function counter(state, key) {
  return Number(state?.counters?.[key] || 0);
}

function collectionSize(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.values(value).filter(Boolean).length;
  return 0;
}

export function schaleIdleResultCue(previous, next) {
  if (!previous || !next || previous.runId !== next.runId) return '';

  const previousTowerAt = Number(previous.towerLastBatchReport?.at || 0);
  const nextTowerAt = Number(next.towerLastBatchReport?.at || 0);
  if (nextTowerAt > previousTowerAt) {
    return Number(next.towerLastBatchReport?.successes || 0) > 0 ? 'towerClear' : 'towerFail';
  }

  const previousDutyAt = Number(previous.lastDutyReport?.at || 0);
  const nextDutyAt = Number(next.lastDutyReport?.at || 0);
  if (nextDutyAt > previousDutyAt) {
    return counter(next, 'CLEAR_FLOOR') > counter(previous, 'CLEAR_FLOOR')
      ? 'dutyComplete'
      : 'defeat';
  }

  if (counter(next, 'ENHANCE_TRY') > counter(previous, 'ENHANCE_TRY')) {
    return counter(next, 'ENHANCE_SUCCESS') > counter(previous, 'ENHANCE_SUCCESS')
      ? 'enhanceSuccess'
      : 'enhanceFail';
  }
  if (counter(next, 'CRAFT') > counter(previous, 'CRAFT')) return 'craftComplete';
  if (counter(next, 'REROLL') > counter(previous, 'REROLL')) return 'reroll';
  if (counter(next, 'SALVAGE') > counter(previous, 'SALVAGE')) return 'salvage';
  if (counter(next, 'SHOP_BUY') > counter(previous, 'SHOP_BUY')) return 'shop';
  if (counter(next, 'UPGRADE') > counter(previous, 'UPGRADE')) return 'research';

  const previousClaims = collectionSize(previous.claimedMissions)
    + collectionSize(previous.achievementClaims)
    + collectionSize(previous.seasonRewardClaims);
  const nextClaims = collectionSize(next.claimedMissions)
    + collectionSize(next.achievementClaims)
    + collectionSize(next.seasonRewardClaims);
  if (nextClaims > previousClaims) return 'reward';

  return '';
}
