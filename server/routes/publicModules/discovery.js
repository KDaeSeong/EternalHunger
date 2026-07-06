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


router.get('/guides', async (req, res) => {
  try {
    const guideCategories = ['guide', 'simulation', 'game'];
    const discussionCategories = ['guide', 'feedback', 'bug', 'simulation', 'game'];
    const [
      featuredGuides,
      recentGuides,
      recentDiscussions,
      categorySummary,
    ] = await Promise.all([
      Post.find({ category: { $in: guideCategories }, isNotice: true })
        .select('_id title category gameSlug content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt noticePinnedAt')
        .populate('authorId', 'username nickname')
        .sort({ noticePinnedAt: -1, createdAt: -1 })
        .limit(4)
        .lean(),
      Post.find({ category: { $in: guideCategories } })
        .select('_id title category gameSlug content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt')
        .populate('authorId', 'username nickname')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      Post.find({ category: { $in: discussionCategories } })
        .select('_id title category gameSlug content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt')
        .populate('authorId', 'username nickname')
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(8)
        .lean(),
      Post.aggregate([
        { $match: { category: { $in: discussionCategories } } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            latestAt: { $max: '$createdAt' },
          },
        },
        { $sort: { count: -1, _id: 1 } },
      ]),
    ]);

    res.json({
      featuredGuides: featuredGuides.map(mapGuidePost),
      recentGuides: recentGuides.map(mapGuidePost),
      recentDiscussions: recentDiscussions.map(mapGuidePost),
      categories: categorySummary.map((row) => ({
        category: row?._id || 'free',
        count: toNonNegativeInt(row?.count),
        latestAt: row?.latestAt || null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '가이드 정보를 불러오지 못했습니다.' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const query = cleanText(req.query?.q, 80);
    const emptyResults = {
      posts: [],
      rooms: [],
      users: [],
      characters: [],
    };

    if (!query) {
      return res.json({
        query: '',
        counts: { total: 0, posts: 0, rooms: 0, users: 0, characters: 0 },
        results: emptyResults,
      });
    }

    const pattern = new RegExp(escapeRegExp(query), 'i');
    const [
      posts,
      rooms,
      sharedRooms,
      users,
      characters,
    ] = await Promise.all([
      Post.find({ $or: [{ title: pattern }, { content: pattern }] })
        .select('_id title category gameSlug content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt noticePinnedAt')
        .populate('authorId', 'username nickname')
        .sort({ isNotice: -1, noticePinnedAt: -1, updatedAt: -1, createdAt: -1 })
        .limit(10)
        .lean(),
      TwentyQuestionsRoom.find({ $or: [{ title: pattern }, { hint: pattern }] })
        .select('_id title category hint status maxQuestions questions guesses hostId solvedBy solvedAt createdAt updatedAt')
        .populate('hostId', 'username nickname')
        .populate('solvedBy', 'username nickname')
        .sort({ status: 1, updatedAt: -1 })
        .limit(8)
        .lean(),
      GameRoom.find({ visibility: 'public', $or: [{ title: pattern }, { gameSlug: pattern }, { mode: pattern }] })
        .select('_id gameSlug title mode status visibility maxPlayers players summary revision hostId createdAt updatedAt lastActivityAt')
        .populate('hostId', 'username nickname')
        .sort({ lastActivityAt: -1, updatedAt: -1 })
        .limit(8)
        .lean(),
      User.find({ ...VISIBLE_USER_FILTER, $or: [{ username: pattern }, { nickname: pattern }] })
        .select('username nickname profileBio lp createdAt')
        .sort({ lp: -1, createdAt: 1 })
        .limit(8)
        .lean(),
      Character.find({
        $or: [
          { name: pattern },
          { weaponType: pattern },
          { erSubject: pattern },
          { erRole: pattern },
        ],
      })
        .select('name weaponType records userId createdAt')
        .populate('userId', 'username nickname')
        .sort({ 'records.totalWins': -1, 'records.totalKills': -1, 'records.gamesPlayed': -1, name: 1 })
        .limit(8)
        .lean(),
    ]);

    const results = {
      posts: posts.map(mapSearchPost),
      rooms: sortRoomsByActivity([
        ...rooms.map(mapHubRoom),
        ...sharedRooms.map(mapSharedGameRoom),
      ]).slice(0, 12),
      users: users.map(mapHubUserRank),
      characters: characters.map(mapHubCharacterRank),
    };

    res.json({
      query,
      counts: {
        posts: results.posts.length,
        rooms: results.rooms.length,
        users: results.users.length,
        characters: results.characters.length,
        total: results.posts.length + results.rooms.length + results.users.length + results.characters.length,
      },
      results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '검색 결과를 불러오지 못했습니다.' });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const [
      userCount,
      characterCount,
      teamCount,
      users,
      characters,
      teams,
    ] = await Promise.all([
      User.countDocuments(VISIBLE_USER_FILTER),
      Character.countDocuments({}),
      TeamRecord.countDocuments({}),
      User.find(VISIBLE_USER_FILTER)
        .select('username nickname profileBio lp statistics createdAt')
        .sort({ lp: -1, createdAt: 1 })
        .limit(25)
        .lean(),
      Character.find({})
        .select('name weaponType records userId createdAt')
        .populate('userId', 'username nickname')
        .sort({ 'records.totalWins': -1, 'records.totalKills': -1, 'records.gamesPlayed': -1, name: 1 })
        .limit(25)
        .lean(),
      TeamRecord.find({})
        .populate('userId', 'username nickname')
        .sort({ totalWins: -1, gamesPlayed: -1, totalKills: -1, totalAssists: -1, updatedAt: -1 })
        .limit(25)
        .lean(),
    ]);

    res.json({
      counts: {
        users: toNonNegativeInt(userCount),
        characters: toNonNegativeInt(characterCount),
        teams: toNonNegativeInt(teamCount),
      },
      users: users.map(mapHubUserRank),
      characters: characters.map(mapHubCharacterRank),
      teams: teams.map(mapHubTeamRank),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '리더보드를 불러오지 못했습니다.' });
  }
});

module.exports = router;
