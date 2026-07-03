export const LP_REWARD_BASE = 50;
export const LP_REWARD_PREDICTION_BONUS = 100;

function normalizeId(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function getDefaultActorKey(actor) {
  return normalizeId(actor?._id || actor?.id || actor?.charId);
}

function sameId(a, b) {
  const aa = normalizeId(a);
  const bb = normalizeId(b);
  return Boolean(aa && bb && aa === bb);
}

function findActorByPredictionId(participants, predictedId, getActorKey) {
  if (!predictedId) return null;
  const keyOf = typeof getActorKey === 'function' ? getActorKey : getDefaultActorKey;
  return (Array.isArray(participants) ? participants : []).find((actor) => sameId(keyOf(actor), predictedId)) || null;
}

function getActorTeamId(actor) {
  return normalizeId(actor?.teamId || actor?.matchTeamId || actor?.squadId);
}

function isPredictedWinnerInWinningTeam({ predictedActor, predictedWinnerId, winner, winningTeam, getActorKey }) {
  const predictedId = normalizeId(predictedWinnerId);
  if (!predictedId || !winner) return false;
  const keyOf = typeof getActorKey === 'function' ? getActorKey : getDefaultActorKey;
  if (sameId(keyOf(winner), predictedId)) return true;

  const winningTeamId = normalizeId(winningTeam?.teamId);
  if (winningTeamId && sameId(getActorTeamId(predictedActor), winningTeamId)) return true;

  const members = Array.isArray(winningTeam?.members) ? winningTeam.members : [];
  return members.some((member) => sameId(keyOf(member), predictedId));
}

export function buildLpRewardSummary({
  getActorKey,
  isDevRunTainted = false,
  participants = [],
  predictedWinnerId = '',
  winner = null,
  winningTeam = null,
} = {}) {
  if (isDevRunTainted) {
    return {
      baseLP: 0,
      predictedName: '',
      predictionBonusLP: 0,
      predictionCorrect: false,
      predictedWinnerId: normalizeId(predictedWinnerId),
      totalLP: 0,
    };
  }

  const normalizedPredictionId = normalizeId(predictedWinnerId);
  const predictedActor = findActorByPredictionId(participants, normalizedPredictionId, getActorKey);
  const predictionCorrect = isPredictedWinnerInWinningTeam({
    getActorKey,
    predictedActor,
    predictedWinnerId: normalizedPredictionId,
    winner,
    winningTeam,
  });
  const predictionBonusLP = predictionCorrect ? LP_REWARD_PREDICTION_BONUS : 0;

  return {
    baseLP: LP_REWARD_BASE,
    predictedName: predictedActor?.name || '',
    predictionBonusLP,
    predictionCorrect,
    predictedWinnerId: normalizedPredictionId,
    totalLP: LP_REWARD_BASE + predictionBonusLP,
  };
}

export function formatLpRewardBreakdown(summary = {}) {
  const baseLP = Math.max(0, Number(summary.baseLP || 0));
  const predictionBonusLP = Math.max(0, Number(summary.predictionBonusLP || 0));
  const parts = [];
  if (baseLP > 0) parts.push(`기본 ${baseLP}`);
  if (predictionBonusLP > 0) parts.push(`예측 성공 ${predictionBonusLP}`);
  return parts.join(' + ') || '보상 없음';
}
