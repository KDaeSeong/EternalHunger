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


router.get('/home-hub', async (req, res) => {
  try {
    const [
      userCount,
      postCount,
      characterCount,
      roomCount,
      activeRoomCount,
      sharedRoomCount,
      activeSharedRoomCount,
      notices,
      recentPosts,
      activeRooms,
      activeSharedRooms,
      topUsers,
      topCharacters,
    ] = await Promise.all([
      User.countDocuments(VISIBLE_USER_FILTER),
      Post.countDocuments({}),
      Character.countDocuments({}),
      TwentyQuestionsRoom.countDocuments({}),
      TwentyQuestionsRoom.countDocuments({ status: 'active' }),
      GameRoom.countDocuments({ visibility: 'public' }),
      GameRoom.countDocuments({ visibility: 'public', status: { $in: ['open', 'playing'] } }),
      Post.find({ isNotice: true })
        .select('_id title category gameSlug content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt noticePinnedAt')
        .populate('authorId', 'username nickname')
        .sort({ noticePinnedAt: -1, createdAt: -1 })
        .limit(3)
        .lean(),
      Post.find({})
        .select('_id title category gameSlug content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt')
        .populate('authorId', 'username nickname')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      TwentyQuestionsRoom.find({ status: 'active' })
        .select('_id title category hint status maxQuestions questions guesses hostId createdAt updatedAt')
        .populate('hostId', 'username nickname')
        .sort({ updatedAt: -1 })
        .limit(6)
        .lean(),
      GameRoom.find({ visibility: 'public', status: { $in: ['open', 'playing'] } })
        .select('_id gameSlug title mode status visibility maxPlayers players summary revision hostId createdAt updatedAt lastActivityAt')
        .populate('hostId', 'username nickname')
        .sort({ lastActivityAt: -1, updatedAt: -1 })
        .limit(6)
        .lean(),
      User.find(VISIBLE_USER_FILTER)
        .select('username nickname profileBio lp createdAt')
        .sort({ lp: -1, createdAt: 1 })
        .limit(5)
        .lean(),
      Character.find({})
        .select('name weaponType records userId createdAt')
        .populate('userId', 'username nickname')
        .sort({ 'records.totalWins': -1, 'records.totalKills': -1, 'records.gamesPlayed': -1, name: 1 })
        .limit(5)
        .lean(),
    ]);

    const mergedActiveRooms = sortRoomsByActivity([
      ...activeRooms.map(mapHubRoom),
      ...activeSharedRooms.map(mapSharedGameRoom),
    ]).slice(0, 6);

    res.json({
      counts: {
        users: toNonNegativeInt(userCount),
        posts: toNonNegativeInt(postCount),
        characters: toNonNegativeInt(characterCount),
        rooms: toNonNegativeInt(roomCount) + toNonNegativeInt(sharedRoomCount),
        activeRooms: toNonNegativeInt(activeRoomCount) + toNonNegativeInt(activeSharedRoomCount),
      },
      notices: notices.map(mapHubPost),
      recentPosts: recentPosts.map(mapHubPost),
      activeRooms: mergedActiveRooms,
      rankings: {
        points: topUsers.map(mapHubUserRank),
        characters: topCharacters.map(mapHubCharacterRank),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '홈 허브 정보를 불러오지 못했습니다.' });
  }
});

router.get('/game-candidates', async (req, res) => {
  try {
    const rows = await GameCatalogEntry.find({ visible: true })
      .sort({ sortOrder: 1, updatedAt: -1 })
      .limit(100)
      .lean();
    res.json({ candidates: rows.map(mapPublicGameCandidate) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임 후보 목록을 불러오지 못했습니다.' });
  }
});

router.get('/games/:slug/hub', async (req, res) => {
  try {
    const slug = cleanText(req.params.slug, 60);
    const isEternalHunger = slug === 'eternal-hunger';
    const isTwentyQuestions = slug === 'twenty-questions';
    const postCategories = isTwentyQuestions ? ['game', 'free'] : ['simulation', 'guide', 'game'];
    const postFilter = {
      $or: [
        { gameSlug: slug },
        { category: { $in: postCategories }, gameSlug: { $in: ['', null] } },
      ],
    };

    if (!isEternalHunger && !isTwentyQuestions) {
      const roomFilter = { gameSlug: slug, visibility: 'public' };
      const activeRoomFilter = { ...roomFilter, status: { $in: ['open', 'playing'] } };
      const recordedRoomFilter = { ...roomFilter, recordedAt: { $ne: null } };
      const [userCount, postCount, roomCount, activeRoomCount, runCount, recentPosts, activeRooms, recentRooms, recentRuns] = await Promise.all([
        User.countDocuments(VISIBLE_USER_FILTER),
        Post.countDocuments({ gameSlug: slug }),
        GameRoom.countDocuments(roomFilter),
        GameRoom.countDocuments(activeRoomFilter),
        GameRoom.countDocuments(recordedRoomFilter),
        Post.find({ gameSlug: slug })
          .select('_id title category gameSlug content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt')
          .populate('authorId', 'username nickname')
          .sort({ updatedAt: -1, createdAt: -1 })
          .limit(6)
          .lean(),
        GameRoom.find(activeRoomFilter)
          .select('_id gameSlug title mode status visibility maxPlayers players summary revision hostId createdAt updatedAt lastActivityAt')
          .populate('hostId', 'username nickname')
          .sort({ lastActivityAt: -1, updatedAt: -1 })
          .limit(6)
          .lean(),
        GameRoom.find(roomFilter)
          .select('_id gameSlug title mode status visibility maxPlayers players summary revision hostId createdAt updatedAt lastActivityAt')
          .populate('hostId', 'username nickname')
          .sort({ lastActivityAt: -1, updatedAt: -1 })
          .limit(6)
          .lean(),
        GameRoom.find(recordedRoomFilter)
          .select('_id gameSlug title mode status visibility maxPlayers players summary result recordedAt recordCount hostId createdAt updatedAt endedAt lastActivityAt')
          .populate('hostId', 'username nickname')
          .sort({ recordedAt: -1, updatedAt: -1 })
          .limit(6)
          .lean(),
      ]);

      return res.json({
        slug,
        counts: {
          users: toNonNegativeInt(userCount),
          posts: toNonNegativeInt(postCount),
          characters: 0,
          teams: 0,
          runs: toNonNegativeInt(runCount),
          rooms: toNonNegativeInt(roomCount),
          activeRooms: toNonNegativeInt(activeRoomCount),
          visibleRooms: activeRooms.length,
        },
        recentPosts: recentPosts.map(mapHubPost),
        activeRooms: activeRooms.map(mapSharedGameRoom),
        recentRooms: recentRooms.map(mapSharedGameRoom),
        recentRuns: recentRuns.map(mapHubRoomResult),
        rankings: {
          points: [],
          characters: [],
          teams: [],
        },
      });
    }

    if (isTwentyQuestions) {
      const [
        userCount,
        postCount,
        roomCount,
        activeRoomCount,
        solvedRoomCount,
        closedRoomCount,
        recentPosts,
        activeRooms,
        recentRooms,
        topUsers,
      ] = await Promise.all([
        User.countDocuments(VISIBLE_USER_FILTER),
        Post.countDocuments(postFilter),
        TwentyQuestionsRoom.countDocuments({}),
        TwentyQuestionsRoom.countDocuments({ status: 'active' }),
        TwentyQuestionsRoom.countDocuments({ status: 'solved' }),
        TwentyQuestionsRoom.countDocuments({ status: 'closed' }),
        Post.find(postFilter)
          .select('_id title category gameSlug content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt')
          .populate('authorId', 'username nickname')
          .sort({ updatedAt: -1, createdAt: -1 })
          .limit(6)
          .lean(),
        TwentyQuestionsRoom.find({ status: 'active' })
          .select('_id title category hint status maxQuestions questions guesses hostId solvedBy solvedAt createdAt updatedAt')
          .populate('hostId', 'username nickname')
          .populate('solvedBy', 'username nickname')
          .sort({ updatedAt: -1 })
          .limit(6)
          .lean(),
        TwentyQuestionsRoom.find({})
          .select('_id title category hint status maxQuestions questions guesses hostId solvedBy solvedAt createdAt updatedAt')
          .populate('hostId', 'username nickname')
          .populate('solvedBy', 'username nickname')
          .sort({ updatedAt: -1 })
          .limit(6)
          .lean(),
        User.find(VISIBLE_USER_FILTER)
          .select('username nickname profileBio lp statistics createdAt')
          .sort({ lp: -1, createdAt: 1 })
          .limit(5)
          .lean(),
      ]);

      return res.json({
        slug,
        counts: {
          users: toNonNegativeInt(userCount),
          posts: toNonNegativeInt(postCount),
          rooms: toNonNegativeInt(roomCount),
          activeRooms: toNonNegativeInt(activeRoomCount),
          solvedRooms: toNonNegativeInt(solvedRoomCount),
          closedRooms: toNonNegativeInt(closedRoomCount),
          visibleRooms: activeRooms.length,
        },
        recentPosts: recentPosts.map(mapHubPost),
        activeRooms: activeRooms.map(mapHubRoom),
        recentRooms: recentRooms.map(mapHubRoom),
        recentRuns: [],
        rankings: {
          points: topUsers.map(mapHubUserRank),
          characters: [],
          teams: [],
        },
      });
    }

    const [
      userCount,
      postCount,
      characterCount,
      teamCount,
      runCount,
      roomCount,
      activeRoomCount,
      recentPosts,
      activeRooms,
      recentRooms,
      recentRuns,
      topUsers,
      topCharacters,
      topTeams,
    ] = await Promise.all([
      User.countDocuments(VISIBLE_USER_FILTER),
      Post.countDocuments(postFilter),
      Character.countDocuments({}),
      TeamRecord.countDocuments({}),
      GameLog.countDocuments({}),
      GameRoom.countDocuments({ gameSlug: slug, visibility: 'public' }),
      GameRoom.countDocuments({ gameSlug: slug, visibility: 'public', status: { $in: ['open', 'playing'] } }),
      Post.find(postFilter)
        .select('_id title category gameSlug content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt')
        .populate('authorId', 'username nickname')
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(6)
        .lean(),
      GameRoom.find({ gameSlug: slug, visibility: 'public', status: { $in: ['open', 'playing'] } })
        .select('_id gameSlug title mode status visibility maxPlayers players summary revision hostId createdAt updatedAt lastActivityAt')
        .populate('hostId', 'username nickname')
        .sort({ lastActivityAt: -1, updatedAt: -1 })
        .limit(6)
        .lean(),
      GameRoom.find({ gameSlug: slug, visibility: 'public' })
        .select('_id gameSlug title mode status visibility maxPlayers players summary revision hostId createdAt updatedAt lastActivityAt')
        .populate('hostId', 'username nickname')
        .sort({ lastActivityAt: -1, updatedAt: -1 })
        .limit(6)
        .lean(),
      GameLog.find({})
        .select('title playedAt winnerName winnerTeamName matchMode teamSize summary')
        .sort({ playedAt: -1, _id: -1 })
        .limit(6)
        .lean(),
      User.find(VISIBLE_USER_FILTER)
        .select('username nickname profileBio lp statistics createdAt')
        .sort({ lp: -1, createdAt: 1 })
        .limit(5)
        .lean(),
      Character.find({})
        .select('name weaponType records userId createdAt')
        .populate('userId', 'username nickname')
        .sort({ 'records.totalWins': -1, 'records.totalKills': -1, 'records.gamesPlayed': -1, name: 1 })
        .limit(6)
        .lean(),
      TeamRecord.find({})
        .populate('userId', 'username nickname')
        .sort({ totalWins: -1, gamesPlayed: -1, totalKills: -1, totalAssists: -1, updatedAt: -1 })
        .limit(6)
        .lean(),
    ]);

    return res.json({
      slug,
      counts: {
        users: toNonNegativeInt(userCount),
        posts: toNonNegativeInt(postCount),
        characters: toNonNegativeInt(characterCount),
        teams: toNonNegativeInt(teamCount),
        runs: toNonNegativeInt(runCount),
        rooms: toNonNegativeInt(roomCount),
        activeRooms: toNonNegativeInt(activeRoomCount),
        visibleRooms: activeRooms.length,
      },
      recentPosts: recentPosts.map(mapHubPost),
      activeRooms: activeRooms.map(mapSharedGameRoom),
      recentRooms: recentRooms.map(mapSharedGameRoom),
      recentRuns: recentRuns.map(mapHubRun),
      rankings: {
        points: topUsers.map(mapHubUserRank),
        characters: topCharacters.map(mapHubCharacterRank),
        teams: topTeams.map(mapHubTeamRank),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임 허브 정보를 불러오지 못했습니다.' });
  }
});

module.exports = router;
