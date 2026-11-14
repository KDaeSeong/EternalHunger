const { GAME_MILESTONES, toNonNegativeInt } = require('../../shared/achievementCatalog.cjs');

async function queryResult(query, session, { lean = false } = {}) {
  if (session && typeof query.session === 'function') query = query.session(session);
  return lean && typeof query.lean === 'function' ? query.lean() : query;
}

function gameRecordPipeline(userId) {
  return [
    { $match: { userId, gameSlug: { $in: GAME_MILESTONES.map((row) => row.slug) } } },
    { $project: { gameSlug: 1, clientRunId: 1, result: 1, playedAt: 1 } },
    { $sort: { playedAt: 1, _id: 1 } },
    { $group: {
      _id: { gameSlug: '$gameSlug', run: { $cond: [
        { $and: [{ $eq: [{ $type: '$clientRunId' }, 'string'] }, { $ne: ['$clientRunId', ''] }] },
        '$clientRunId', { $toString: '$_id' },
      ] } },
      result: { $first: '$result' },
    } },
    { $group: {
      _id: '$_id.gameSlug', plays: { $sum: 1 },
      clears: { $sum: { $cond: [{ $in: ['$result', ['win', 'clear']] }, 1, 0] } },
    } },
  ];
}

function createAchievementTotalsLoader({ User, Character, TeamRecord, GameLog, Post,
  TwentyQuestionsRoom, GamePlayRecord, PrimitiveArchiveReward }) {
  return async function loadTotals(userId, session) {
    const [user, characters, teamRows, runs, posts, commentRows, hostedRooms, solvedRooms, gameRows, archiveRows] = await Promise.all([
      queryResult(User.findById(userId).select('username nickname lp credits badges perks statistics'), session, { lean: true }),
      queryResult(Character.countDocuments({ userId }), session),
      queryResult(TeamRecord.aggregate([
        { $match: { userId } },
        { $group: { _id: null, teams: { $sum: 1 }, wins: { $sum: '$totalWins' } } },
      ]), session),
      queryResult(GameLog.countDocuments({ userId }), session),
      queryResult(Post.countDocuments({ authorId: userId }), session),
      queryResult(Post.aggregate([
        { $match: { 'comments.authorId': userId } },
        { $unwind: '$comments' }, { $match: { 'comments.authorId': userId } }, { $count: 'count' },
      ]), session),
      queryResult(TwentyQuestionsRoom.countDocuments({ hostId: userId }), session),
      queryResult(TwentyQuestionsRoom.countDocuments({ solvedBy: userId }), session),
      queryResult(GamePlayRecord.aggregate(gameRecordPipeline(userId)), session),
      queryResult(PrimitiveArchiveReward.aggregate([
        { $match: { userId, gameSlug: 'primitive-archive', tier: { $in: ['basic', 'full'] },
          status: { $in: ['awarded', 'daily_limit'] } } },
        { $group: { _id: null, runs: { $sum: 1 },
          full: { $sum: { $cond: [{ $eq: ['$tier', 'full'] }, 1, 0] } } } },
      ]), session),
    ]);
    if (!user) return { user: null, totals: {} };
    const stats = user.statistics || {};
    const archiveRuns = toNonNegativeInt(archiveRows[0]?.runs);
    const totals = {
      totalGames: toNonNegativeInt(stats.totalGames), totalWins: toNonNegativeInt(stats.totalWins),
      totalKills: toNonNegativeInt(stats.totalKills), lp: toNonNegativeInt(user.lp),
      credits: toNonNegativeInt(user.credits), badges: Array.isArray(user.badges) ? user.badges.length : 0,
      perks: Array.isArray(user.perks) ? user.perks.length : 0, characters: toNonNegativeInt(characters),
      teams: toNonNegativeInt(teamRows[0]?.teams), teamWins: toNonNegativeInt(teamRows[0]?.wins),
      runs: toNonNegativeInt(runs), posts: toNonNegativeInt(posts), comments: toNonNegativeInt(commentRows[0]?.count),
      hostedRooms: toNonNegativeInt(hostedRooms), solvedRooms: toNonNegativeInt(solvedRooms),
      gameRecords: archiveRuns, gameClears: archiveRuns, gameVariety: archiveRuns > 0 ? 1 : 0,
      archiveRuns, archiveFullRuns: toNonNegativeInt(archiveRows[0]?.full),
    };
    const supported = new Set(GAME_MILESTONES.map((row) => row.slug));
    for (const row of gameRows) {
      if (!supported.has(row._id)) continue;
      const plays = toNonNegativeInt(row.plays);
      totals[`game:${row._id}`] = plays;
      totals.gameRecords += plays;
      totals.gameClears += toNonNegativeInt(row.clears);
      if (plays > 0) totals.gameVariety += 1;
    }
    totals.sitePlays = totals.totalGames + totals.gameRecords;
    return { user, totals };
  };
}

module.exports = { createAchievementTotalsLoader, gameRecordPipeline };
