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


router.get('/users/:id/follows', async (req, res) => {
  try {
    const id = normalizeId(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '사용자 ID가 올바르지 않습니다.' });
    }

    const userId = new mongoose.Types.ObjectId(id);
    const type = req.query?.type === 'followers' ? 'followers' : 'following';
    const limit = clampListLimit(req.query?.limit, 30, 100);
    const viewerIdRaw = getOptionalUserId(req);
    const viewerId = mongoose.Types.ObjectId.isValid(String(viewerIdRaw || ''))
      ? new mongoose.Types.ObjectId(viewerIdRaw)
      : null;

    const exists = await User.exists({ _id: userId });
    if (!exists) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const filter = type === 'followers' ? { followingId: userId } : { followerId: userId };
    const userField = type === 'followers' ? 'followerId' : 'followingId';
    const [count, rows] = await Promise.all([
      UserFollow.countDocuments(filter),
      UserFollow.find(filter)
        .populate(userField, PUBLIC_FOLLOW_USER_SELECT)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    res.json({
      userId: id,
      type,
      count: toNonNegativeInt(count),
      users: await mapFollowEntries(rows, userField, viewerId),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '팔로우 목록을 불러오지 못했습니다.' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const id = normalizeId(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '사용자 ID가 올바르지 않습니다.' });
    }

    const userId = new mongoose.Types.ObjectId(id);
    const viewerIdRaw = getOptionalUserId(req);
    const viewerId = mongoose.Types.ObjectId.isValid(String(viewerIdRaw || ''))
      ? new mongoose.Types.ObjectId(viewerIdRaw)
      : null;
    const user = await User.findOne({ _id: userId, ...VISIBLE_USER_FILTER })
      .select('username nickname profileBio lp statistics badges createdAt')
      .lean();
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const [
      recentPosts,
      postCount,
      commentAgg,
      recentComments,
      recentRooms,
      hostedRoomCount,
      solvedHostedRoomCount,
      followerCount,
      followingCount,
      viewerFollow,
      topCharacters,
      topTeams,
      socialPreview,
    ] = await Promise.all([
      Post.find({ authorId: userId })
        .select('_id title category gameSlug content isNotice commentCount reactionCount viewCount createdAt updatedAt')
        .sort({ isNotice: -1, noticePinnedAt: -1, createdAt: -1 })
        .limit(6)
        .lean(),
      Post.countDocuments({ authorId: userId }),
      Post.aggregate([
        { $unwind: '$comments' },
        { $match: { 'comments.authorId': userId } },
        { $count: 'count' },
      ]),
      Post.aggregate([
        { $match: { 'comments.authorId': userId } },
        { $project: {
          title: 1,
          category: 1,
          gameSlug: 1,
          comments: {
            $filter: {
              input: '$comments',
              as: 'comment',
              cond: { $eq: ['$$comment.authorId', userId] },
            },
          },
        } },
        { $unwind: '$comments' },
        { $sort: { 'comments.createdAt': -1, _id: -1 } },
        { $limit: 6 },
      ]),
      TwentyQuestionsRoom.find({ hostId: userId })
        .populate('solvedBy', 'username nickname')
        .sort({ updatedAt: -1 })
        .limit(6)
        .lean(),
      TwentyQuestionsRoom.countDocuments({ hostId: userId }),
      TwentyQuestionsRoom.countDocuments({ hostId: userId, status: 'solved' }),
      UserFollow.countDocuments({ followingId: userId }),
      UserFollow.countDocuments({ followerId: userId }),
      viewerId && normalizeId(viewerId) !== normalizeId(userId)
        ? UserFollow.exists({ followerId: viewerId, followingId: userId })
        : null,
      Character.find({ userId })
        .select('name weaponType records')
        .sort({ 'records.totalWins': -1, 'records.gamesPlayed': -1, 'records.totalKills': -1, name: 1 })
        .limit(6)
        .lean(),
      TeamRecord.find({ userId })
        .sort({ totalWins: -1, gamesPlayed: -1, totalKills: -1, updatedAt: -1 })
        .limit(6)
        .lean(),
      loadFollowPreview(userId, viewerId, 6),
    ]);

    res.json({
      user: mapPublicUser(user),
      summary: {
        postCount: toNonNegativeInt(postCount),
        commentCount: toNonNegativeInt(commentAgg?.[0]?.count),
        hostedRoomCount: toNonNegativeInt(hostedRoomCount),
        solvedHostedRoomCount: toNonNegativeInt(solvedHostedRoomCount),
        followerCount: toNonNegativeInt(followerCount),
        followingCount: toNonNegativeInt(followingCount),
      },
      viewerFollow: {
        following: Boolean(viewerFollow),
        isSelf: Boolean(viewerId && normalizeId(viewerId) === normalizeId(userId)),
      },
      recentPosts: recentPosts.map(mapPublicPost),
      recentComments: recentComments.map(mapPublicCommentActivity),
      recentRooms: recentRooms.map(mapPublicRoom),
      topCharacters: topCharacters.map(mapCharacterRecord),
      topTeams: topTeams.map(mapTeamRecord),
      social: socialPreview,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '사용자 프로필을 불러오지 못했습니다.' });
  }
});

module.exports = router;
