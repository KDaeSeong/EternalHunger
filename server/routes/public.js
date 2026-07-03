// server/routes/public.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const User = require('../models/User');
const Post = require('../models/Post');
const TwentyQuestionsRoom = require('../models/TwentyQuestionsRoom');
const UserFollow = require('../models/UserFollow');
const Character = require('../models/Characters');
const TeamRecord = require('../models/TeamRecord');
const Item = require('../models/Item');
const MapModel = require('../models/Map');
const Kiosk = require('../models/Kiosk');
const DroneOffer = require('../models/DroneOffer');
const Perk = require('../models/Perk');
const { dedupeScopedPerks, ensureDefaultPublicPerks } = require('../utils/defaultPerks');
const ErMeta = require('../models/ErMeta');
const { DEFAULT_ZONES, normalizeZoneList } = require('../utils/defaultZones');
const { buildDefaultZoneConnections } = require('../utils/defaultZoneConnections');
const { getOptionalUserId, scopedFilter } = require('../utils/requestScope');

const PUBLIC_ITEM_SELECT = [
  '_id',
  'itemKey',
  'externalId',
  'name',
  'type',
  'tags',
  'rarity',
  'tier',
  'erCode',
  'itemSubType',
  'stackMax',
  'value',
  'baseCreditValue',
  'recipe',
  'stats',
  'equipSlot',
  'weaponType',
  'archetype',
  'spawnZones',
  'spawnCrateTypes',
  'droneCreditsCost',
  'upgradeItemKeys',
  'source',
  'lockedByAdmin',
  'description',
].join(' ');

function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value?.toHexString === 'function') return value.toHexString();
  if (value?._id && value._id !== value) return normalizeId(value._id);
  if (value?.id && value.id !== value) return normalizeId(value.id);
  if (value?.$oid) return String(value.$oid);
  if (typeof value?.toString === 'function') return value.toString();
  return '';
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toNonNegativeInt(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function displayName(user) {
  return String(user?.nickname || user?.username || '익명').trim() || '익명';
}

function mapPublicUser(user) {
  const statistics = user?.statistics || {};
  return {
    _id: normalizeId(user),
    username: user?.username || '',
    nickname: user?.nickname || '',
    profileBio: user?.profileBio || '',
    displayName: displayName(user),
    lp: Number(user?.lp || 0),
    badges: Array.isArray(user?.badges) ? user.badges.map((badge) => ({
      name: badge?.name || '',
      unlockedAt: badge?.unlockedAt || null,
    })).filter((badge) => badge.name) : [],
    statistics: {
      totalGames: toNonNegativeInt(statistics.totalGames),
      totalWins: toNonNegativeInt(statistics.totalWins),
      totalKills: toNonNegativeInt(statistics.totalKills),
    },
    createdAt: user?.createdAt || null,
  };
}

function mapPublicPost(post) {
  return {
    _id: normalizeId(post),
    title: post?.title || '',
    category: post?.category || 'free',
    isNotice: Boolean(post?.isNotice),
    commentCount: toNonNegativeInt(post?.commentCount),
    reactionCount: toNonNegativeInt(post?.reactionCount),
    viewCount: toNonNegativeInt(post?.viewCount),
    contentPreview: cleanText(post?.content, 120),
    createdAt: post?.createdAt || null,
    updatedAt: post?.updatedAt || null,
  };
}

function mapPublicCommentActivity(row) {
  const comment = row?.comments || row?.comment || {};
  return {
    _id: normalizeId(comment),
    postId: normalizeId(row),
    postTitle: row?.title || '',
    postCategory: row?.category || 'free',
    contentPreview: cleanText(comment?.content, 140),
    createdAt: comment?.createdAt || null,
    updatedAt: comment?.updatedAt || null,
  };
}

function mapCompactUser(user) {
  if (!user || typeof user !== 'object') return null;
  return {
    _id: normalizeId(user),
    username: user.username || '',
    nickname: user.nickname || '',
    profileBio: user.profileBio || '',
    displayName: displayName(user),
  };
}

function mapHubPost(post) {
  return {
    ...mapPublicPost(post),
    author: mapCompactUser(post?.authorId),
    authorName: displayName(post?.authorId),
  };
}

function mapGuidePost(post) {
  return {
    ...mapHubPost(post),
    contentPreview: cleanText(post?.content, 180),
  };
}

function mapSearchPost(post) {
  return {
    ...mapGuidePost(post),
    resultType: post?.category === 'guide' ? 'guide' : 'post',
  };
}

function mapPublicRoom(room) {
  const questions = Array.isArray(room?.questions) ? room.questions : [];
  const guesses = Array.isArray(room?.guesses) ? room.guesses : [];
  return {
    _id: normalizeId(room),
    title: room?.title || '',
    category: room?.category || 'free',
    hint: room?.hint || '',
    status: room?.status || 'active',
    questionCount: questions.length,
    guessCount: guesses.length,
    solvedBy: room?.solvedBy && typeof room.solvedBy === 'object' ? {
      _id: normalizeId(room.solvedBy),
      username: room.solvedBy.username || '',
      nickname: room.solvedBy.nickname || '',
      displayName: displayName(room.solvedBy),
    } : null,
    solvedAt: room?.solvedAt || null,
    createdAt: room?.createdAt || null,
    updatedAt: room?.updatedAt || null,
  };
}

function mapHubRoom(room) {
  return {
    ...mapPublicRoom(room),
    host: mapCompactUser(room?.hostId),
    hostName: displayName(room?.hostId),
  };
}

function mapCharacterRecord(row) {
  const records = row?.records || {};
  const gamesPlayed = toNonNegativeInt(records.gamesPlayed);
  const totalWins = toNonNegativeInt(records.totalWins);
  const totalKills = toNonNegativeInt(records.totalKills);
  const totalAssists = toNonNegativeInt(records.totalAssists);
  const deathCount = toNonNegativeInt(records.deathCount);
  return {
    _id: normalizeId(row),
    name: row?.name || '',
    previewImage: '',
    weaponType: row?.weaponType || '',
    gamesPlayed,
    totalWins,
    totalKills,
    totalAssists,
    deathCount,
    winRate: gamesPlayed > 0 ? totalWins / gamesPlayed : 0,
    kda: Math.round(((totalKills + totalAssists) / Math.max(1, deathCount)) * 100) / 100,
  };
}

function mapHubUserRank(row) {
  const statistics = row?.statistics || {};
  return {
    _id: normalizeId(row),
    username: row?.username || '',
    nickname: row?.nickname || '',
    displayName: displayName(row),
    lp: Number(row?.lp || 0),
    totalGames: toNonNegativeInt(statistics.totalGames),
    totalWins: toNonNegativeInt(statistics.totalWins),
    totalKills: toNonNegativeInt(statistics.totalKills),
    createdAt: row?.createdAt || null,
  };
}

function mapHubCharacterRank(row) {
  const mapped = mapCharacterRecord(row);
  return {
    ...mapped,
    owner: mapCompactUser(row?.userId),
    ownerName: displayName(row?.userId),
  };
}

function mapTeamRecord(row) {
  const gamesPlayed = toNonNegativeInt(row?.gamesPlayed);
  const totalWins = toNonNegativeInt(row?.totalWins);
  const totalKills = toNonNegativeInt(row?.totalKills);
  const totalAssists = toNonNegativeInt(row?.totalAssists);
  const deathCount = toNonNegativeInt(row?.deathCount);
  return {
    _id: normalizeId(row),
    teamKey: row?.teamKey || '',
    teamName: row?.teamName || '',
    rosterNames: Array.isArray(row?.rosterNames) ? row.rosterNames.map(String).filter(Boolean) : [],
    gamesPlayed,
    totalWins,
    totalKills,
    totalAssists,
    deathCount,
    winRate: gamesPlayed > 0 ? totalWins / gamesPlayed : 0,
    kda: Math.round(((totalKills + totalAssists) / Math.max(1, deathCount)) * 100) / 100,
    lastMatchAt: row?.lastMatchAt || null,
  };
}

function mapHubTeamRank(row) {
  return {
    ...mapTeamRecord(row),
    owner: mapCompactUser(row?.userId),
    ownerName: displayName(row?.userId),
  };
}

/**
 * ✅ 공개 데이터 API
 * - 시뮬레이션/에디터/메인에서 필요한 '기본 데이터'를 비로그인으로도 조회 가능
 */


router.get('/ping', async (req, res) => {
  try {
    res.json({ ok: true, ts: Date.now() });
  } catch (err) {
    res.status(500).json({ error: '핑 실패' });
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
    const user = await User.findById(userId)
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
    ] = await Promise.all([
      Post.find({ authorId: userId })
        .select('_id title category content isNotice commentCount reactionCount viewCount createdAt updatedAt')
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
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '사용자 프로필을 불러오지 못했습니다.' });
  }
});

router.get('/home-hub', async (req, res) => {
  try {
    const [
      userCount,
      postCount,
      characterCount,
      roomCount,
      activeRoomCount,
      notices,
      recentPosts,
      activeRooms,
      topUsers,
      topCharacters,
    ] = await Promise.all([
      User.countDocuments({}),
      Post.countDocuments({}),
      Character.countDocuments({}),
      TwentyQuestionsRoom.countDocuments({}),
      TwentyQuestionsRoom.countDocuments({ status: 'active' }),
      Post.find({ isNotice: true })
        .select('_id title category content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt noticePinnedAt')
        .populate('authorId', 'username nickname')
        .sort({ noticePinnedAt: -1, createdAt: -1 })
        .limit(3)
        .lean(),
      Post.find({})
        .select('_id title category content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt')
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
      User.find({})
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

    res.json({
      counts: {
        users: toNonNegativeInt(userCount),
        posts: toNonNegativeInt(postCount),
        characters: toNonNegativeInt(characterCount),
        rooms: toNonNegativeInt(roomCount),
        activeRooms: toNonNegativeInt(activeRoomCount),
      },
      notices: notices.map(mapHubPost),
      recentPosts: recentPosts.map(mapHubPost),
      activeRooms: activeRooms.map(mapHubRoom),
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
        .select('_id title category content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt noticePinnedAt')
        .populate('authorId', 'username nickname')
        .sort({ noticePinnedAt: -1, createdAt: -1 })
        .limit(4)
        .lean(),
      Post.find({ category: { $in: guideCategories } })
        .select('_id title category content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt')
        .populate('authorId', 'username nickname')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      Post.find({ category: { $in: discussionCategories } })
        .select('_id title category content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt')
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
      users,
      characters,
    ] = await Promise.all([
      Post.find({ $or: [{ title: pattern }, { content: pattern }] })
        .select('_id title category content isNotice commentCount reactionCount viewCount authorId createdAt updatedAt noticePinnedAt')
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
      User.find({ $or: [{ username: pattern }, { nickname: pattern }] })
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
      rooms: rooms.map(mapHubRoom),
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
      User.countDocuments({}),
      Character.countDocuments({}),
      TeamRecord.countDocuments({}),
      User.find({})
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

router.get('/items', async (req, res) => {
  try {
    const items = await Item.find(scopedFilter(req))
      .select(PUBLIC_ITEM_SELECT)
      .sort({ createdAt: 1 })
      .lean();
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '아이템 로드 실패' });
  }
});

router.get('/maps', async (req, res) => {
  try {
    const maps = await MapModel.find(scopedFilter(req))
      .populate('connectedMaps', 'name')
      .lean();

    // ✅ 맵 zones가 비어있으면, '기본 맵 구역' 세트를 응답에 주입합니다.
    // - DB를 강제로 수정하진 않습니다(응답 레벨에서만 보정).
    const normalized = (Array.isArray(maps) ? maps : []).map((m) => {
      const o = (typeof m?.toObject === 'function') ? m.toObject() : m;

      // ✅ mongoose Map(crateAllowDeny)가 JSON에서 {}로 날아가지 않도록 평탄화
      // - { [zoneId]: string[] } 형태로 항상 내려줍니다.
      let crateAllowDeny = o?.crateAllowDeny;
      if (crateAllowDeny && typeof crateAllowDeny.toObject === 'function') {
        crateAllowDeny = crateAllowDeny.toObject();
      }
      if (crateAllowDeny instanceof Map) {
        crateAllowDeny = Object.fromEntries(crateAllowDeny.entries());
      }
      if (!crateAllowDeny || typeof crateAllowDeny !== 'object' || Array.isArray(crateAllowDeny)) {
        crateAllowDeny = {};
      }

      // zones 보정
      const zones = normalizeZoneList((!Array.isArray(o?.zones) || o.zones.length === 0) ? DEFAULT_ZONES : o.zones);

      // zoneConnections 보정(비어있으면 기본 프리셋 주입)
      const hasConns = Array.isArray(o?.zoneConnections) && o.zoneConnections.length > 0;
      const zoneIds = (Array.isArray(zones) ? zones : []).map((z) => String(z?.zoneId || '').trim()).filter(Boolean);
      const zoneConnections = hasConns ? o.zoneConnections : buildDefaultZoneConnections(zoneIds);

      return { ...o, crateAllowDeny, zones, zoneConnections };
    });

    res.json(normalized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '맵 로드 실패' });
  }
});

router.get('/kiosks', async (req, res) => {
  try {
    const kiosks = await Kiosk.find(scopedFilter(req))
      .select('_id kioskId name mapId zoneId x y catalog')
      .populate('mapId', 'name')
      .populate('catalog.itemId', 'name tier rarity baseCreditValue tags')
      .populate('catalog.exchange.giveItemId', 'name tier rarity baseCreditValue tags')
      .lean();
    res.json(kiosks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '키오스크 로드 실패' });
  }
});

router.get('/drone-offers', async (req, res) => {
  try {
    const offers = await DroneOffer.find(scopedFilter(req, { isActive: true }))
      .select('_id itemId priceCredits maxTier')
      .populate('itemId', 'name tier rarity baseCreditValue')
      .lean();
    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '드론 판매 목록 로드 실패' });
  }
});

router.get('/perks', async (req, res) => {
  try {
    await ensureDefaultPublicPerks(Perk);
    const perks = await Perk.find(scopedFilter(req, { isActive: true })).sort({ category: 1, lpCost: 1 }).lean();
    res.json(dedupeScopedPerks(perks, getOptionalUserId(req)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '특전 로드 실패' });
  }
});

router.get('/er-meta', async (req, res) => {
  try {
    const namespace = String(req.query?.namespace || '').trim();
    const q = namespace ? { namespace } : {};
    const limit = Math.max(1, Math.min(5000, Number(req.query?.limit || 500)));
    const items = await ErMeta.find(q)
      .sort({ namespace: 1, localizedName: 1, name: 1, code: 1 })
      .limit(limit)
      .lean();
    const summary = await ErMeta.aggregate([
      { $group: { _id: '$namespace', count: { $sum: 1 }, latest: { $max: '$importedAt' } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ items, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ER 메타 로드 실패' });
  }
});

module.exports = router;
