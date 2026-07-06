const express = require('express');
const router = express.Router();
const {
  mongoose,
  User,
  Post,
  TwentyQuestionsRoom,
  GameRoom,
  UserFollow,
  Character,
  TeamRecord,
  GameLog,
  Item,
  MapModel,
  Kiosk,
  DroneOffer,
  Perk,
  GameCatalogEntry,
  ErMeta,
  dedupeScopedPerks,
  ensureDefaultPublicPerks,
  DEFAULT_ZONES,
  normalizeZoneList,
  buildDefaultZoneConnections,
  getOptionalUserId,
  scopedFilter,
  PUBLIC_FOLLOW_USER_SELECT,
  VISIBLE_USER_FILTER,
  PUBLIC_ITEM_SELECT,
  normalizeId,
  cleanText,
  normalizeGameSlug,
  escapeRegExp,
  toNonNegativeInt,
  displayName,
  mapPublicUser,
  mapPublicPost,
  mapPublicCommentActivity,
  mapCompactUser,
  mapHubPost,
  mapPublicGameCandidate,
  mapGuidePost,
  mapSearchPost,
  mapPublicRoom,
  mapHubRoom,
  activeGameRoomPlayers,
  mapSharedGameRoom,
  roomActivityTime,
  sortRoomsByActivity,
  mapCharacterRecord,
  mapHubUserRank,
  mapHubCharacterRank,
  mapTeamRecord,
  mapHubTeamRank,
  mapHubRun,
  mapHubRoomResult,
  mapActivityPost,
  mapActivityComment,
  mapActivityRoom,
  activitySortTime,
  clampListLimit,
  mapFollowEntries,
  loadFollowPreview,
} = require('./shared');


router.get('/activity', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(80, Number(req.query?.limit || 40)));
    const scope = String(req.query?.scope || 'all').trim() === 'following' ? 'following' : 'all';
    const viewerIdRaw = getOptionalUserId(req);
    const viewerId = mongoose.Types.ObjectId.isValid(String(viewerIdRaw || ''))
      ? new mongoose.Types.ObjectId(viewerIdRaw)
      : null;
    let followingIds = [];
    if (scope === 'following') {
      if (!viewerId) return res.status(401).json({ error: '로그인이 필요합니다.' });
      const follows = await UserFollow.find({ followerId: viewerId }).select('followingId').lean();
      followingIds = follows
        .map((row) => row?.followingId)
        .filter(Boolean);
      if (!followingIds.length) {
        return res.json({
          scope: { mode: scope, followingCount: 0 },
          counts: { total: 0, posts: 0, comments: 0, rooms: 0, solvedRooms: 0 },
          activity: [],
        });
      }
    }
    const authorFilter = scope === 'following' ? { authorId: { $in: followingIds } } : {};
    const commentMatch = scope === 'following'
      ? { 'comments.0': { $exists: true }, 'comments.authorId': { $in: followingIds } }
      : { 'comments.0': { $exists: true } };
    const roomFilter = scope === 'following'
      ? { $or: [{ hostId: { $in: followingIds } }, { solvedBy: { $in: followingIds } }] }
      : {};
    const [
      recentPosts,
      recentComments,
      recentRooms,
    ] = await Promise.all([
      Post.find(authorFilter)
        .select('_id title category gameSlug content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt')
        .populate('authorId', 'username nickname')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Post.aggregate([
        { $match: commentMatch },
        { $unwind: '$comments' },
        ...(scope === 'following' ? [{ $match: { 'comments.authorId': { $in: followingIds } } }] : []),
        { $sort: { 'comments.createdAt': -1, _id: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'comments.authorId',
            foreignField: '_id',
            as: 'commentAuthor',
          },
        },
        { $unwind: { path: '$commentAuthor', preserveNullAndEmptyArrays: true } },
        { $addFields: { 'comments.authorId': '$commentAuthor' } },
        {
          $project: {
            title: 1,
            category: 1,
            gameSlug: 1,
            commentCount: 1,
            reactionCount: 1,
            viewCount: 1,
            comments: 1,
          },
        },
      ]),
      TwentyQuestionsRoom.find(roomFilter)
        .select('_id title category hint status maxQuestions questions guesses hostId solvedBy solvedAt createdAt updatedAt')
        .populate('hostId', 'username nickname')
        .populate('solvedBy', 'username nickname')
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    const activity = [
      ...recentPosts.map(mapActivityPost),
      ...recentComments.map(mapActivityComment),
      ...recentRooms.map(mapActivityRoom),
    ]
      .sort((a, b) => activitySortTime(b) - activitySortTime(a))
      .slice(0, limit);

    res.json({
      scope: {
        mode: scope,
        followingCount: followingIds.length,
      },
      counts: {
        total: activity.length,
        posts: activity.filter((row) => row.kind === 'post').length,
        comments: activity.filter((row) => row.kind === 'comment').length,
        rooms: activity.filter((row) => row.kind === 'room').length,
        solvedRooms: activity.filter((row) => row.kind === 'room' && row.label === '정답').length,
      },
      activity,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '활동 피드를 불러오지 못했습니다.' });
  }
});

module.exports = router;
