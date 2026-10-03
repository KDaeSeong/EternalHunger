// Server-side LP for a finished Eternal Hunger run.
// The match itself runs in the browser, so the outcome is client-reported; the
// server only decides the amount from fixed rules (mirrors the client's
// lpRewardRuntime) and never accepts an LP number from the request.
const LP_REWARD_BASE = 50;
const LP_REWARD_PREDICTION_BONUS = 100;
const LP_MIN_PARTICIPANTS = 2;

function normalizeId(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

/**
 * @param {object} input
 * @param {Array<{charId: string, teamId?: string}>} input.participants sanitized roster
 * @param {string} input.winnerId
 * @param {string} [input.winnerTeamId]
 * @param {string} [input.predictedWinnerId]
 * @param {boolean} [input.devRunTainted]
 */
function computeLpReward({ participants = [], winnerId = '', winnerTeamId = '', predictedWinnerId = '', devRunTainted = false } = {}) {
  const roster = Array.isArray(participants) ? participants : [];
  const winner = normalizeId(winnerId);
  const predicted = normalizeId(predictedWinnerId);
  const empty = { base: 0, predictionBonus: 0, total: 0, predictionCorrect: false, predictedWinnerId: predicted };
  if (devRunTainted || !winner || roster.length < LP_MIN_PARTICIPANTS) return empty;
  if (!roster.some((row) => normalizeId(row?.charId) === winner)) return empty;

  const predictedRow = predicted ? roster.find((row) => normalizeId(row?.charId) === predicted) : null;
  const winnerRow = roster.find((row) => normalizeId(row?.charId) === winner);
  const teamId = normalizeId(winnerTeamId) || normalizeId(winnerRow?.teamId);
  const predictionCorrect = Boolean(predictedRow) && (
    normalizeId(predictedRow.charId) === winner
    || (Boolean(teamId) && normalizeId(predictedRow.teamId) === teamId)
  );
  const predictionBonus = predictionCorrect ? LP_REWARD_PREDICTION_BONUS : 0;
  return {
    base: LP_REWARD_BASE,
    predictionBonus,
    total: LP_REWARD_BASE + predictionBonus,
    predictionCorrect,
    predictedWinnerId: predicted,
  };
}

module.exports = { LP_MIN_PARTICIPANTS, LP_REWARD_BASE, LP_REWARD_PREDICTION_BONUS, computeLpReward };
