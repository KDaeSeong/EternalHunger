// server/routes/public.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const User = require('../models/User');
const Post = require('../models/Post');
const TwentyQuestionsRoom = require('../models/TwentyQuestionsRoom');
const GameRoom = require('../models/GameRoom');
const UserFollow = require('../models/UserFollow');
const Character = require('../models/Characters');
const TeamRecord = require('../models/TeamRecord');
const GameLog = require('../models/GameLog');
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

const PUBLIC_FOLLOW_USER_SELECT = 'username nickname profileBio lp statistics badges createdAt';
const VISIBLE_USER_FILTER = { moderationStatus: { $ne: 'deactivated' } };

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

function normalizeGameSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
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
    gameSlug: normalizeGameSlug(post?.gameSlug),
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
    gameSlug: normalizeGameSlug(row?.gameSlug),
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
  const maxQuestions = Math.max(1, Number(room?.maxQuestions || 20));
  const questionCount = questions.length;
  const guessCount = guesses.length;
  const attemptCount = questionCount + guessCount;
  return {
    _id: normalizeId(room),
    title: room?.title || '',
    category: room?.category || 'free',
    hint: room?.hint || '',
    status: room?.status || 'active',
    maxQuestions,
    questionCount,
    guessCount,
    attemptCount,
    remainingCount: Math.max(0, maxQuestions - attemptCount),
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
  const id = normalizeId(room);
  return {
    ...mapPublicRoom(room),
    roomType: 'twenty-questions',
    gameSlug: 'twenty-questions',
    href: `/twenty-questions/${id}`,
    host: mapCompactUser(room?.hostId),
    hostName: displayName(room?.hostId),
  };
}

function activeGameRoomPlayers(room) {
  return (Array.isArray(room?.players) ? room.players : []).filter((player) => player?.status !== 'left');
}

function mapSharedGameRoom(room) {
  const id = normalizeId(room);
  const players = activeGameRoomPlayers(room);
  return {
    _id: id,
    id,
    roomType: 'game-room',
    gameSlug: normalizeGameSlug(room?.gameSlug),
    href: `/games/rooms/${id}`,
    title: room?.title || '게임방',
    category: 'game-room',
    categoryLabel: room?.mode || '게임방',
    hint: room?.summary?.gameTitle || room?.mode || '',
    mode: room?.mode || '',
    status: room?.status || 'open',
    visibility: room?.visibility || 'public',
    maxPlayers: Math.max(1, Number(room?.maxPlayers || 1)),
    playerCount: players.length,
    revision: toNonNegativeInt(room?.revision),
    host: mapCompactUser(room?.hostId),
    hostName: displayName(room?.hostId),
    createdAt: room?.createdAt || null,
    updatedAt: room?.updatedAt || null,
    lastActivityAt: room?.lastActivityAt || room?.updatedAt || null,
  };
}

function roomActivityTime(room) {
  const time = new Date(room?.lastActivityAt || room?.updatedAt || room?.createdAt || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortRoomsByActivity(rooms) {
  return [...rooms].sort((a, b) => roomActivityTime(b) - roomActivityTime(a));
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

function mapHubRun(row) {
  const summary = row?.summary || {};
  return {
    _id: normalizeId(row),
    title: row?.title || '',
    playedAt: row?.playedAt || null,
    winnerName: row?.winnerName || '',
    winnerTeamName: row?.winnerTeamName || '',
    matchMode: row?.matchMode || '',
    teamSize: toNonNegativeInt(row?.teamSize),
    participantCount: toNonNegativeInt(summary.participantCount),
    teamCount: toNonNegativeInt(summary.teamCount),
    totalKills: toNonNegativeInt(summary.totalKills),
    totalAssists: toNonNegativeInt(summary.totalAssists),
    totalDeaths: toNonNegativeInt(summary.totalDeaths),
    totalRevives: toNonNegativeInt(summary.totalRevives),
    legendCount: toNonNegativeInt(summary.legendCount),
    transCount: toNonNegativeInt(summary.transCount),
  };
}

function mapHubRoomResult(room) {
  const base = mapSharedGameRoom(room);
  const result = room?.result && typeof room.result === 'object' ? room.result : {};
  return {
    _id: normalizeId(room),
    kind: 'room-result',
    gameSlug: base.gameSlug,
    href: base.href,
    title: result.roomTitle || base.title || '게임 결과',
    playedAt: room?.recordedAt || room?.endedAt || room?.updatedAt || null,
    matchMode: base.mode,
    status: base.status,
    playerCount: base.playerCount,
    recordCount: toNonNegativeInt(room?.recordCount),
    winnerUserId: normalizeId(result.winnerUserId),
    summary: result,
  };
}

function mapActivityPost(post) {
  return {
    _id: `post-${normalizeId(post)}`,
    kind: 'post',
    title: post?.title || '',
    label: post?.isNotice ? '공지' : '게시글',
    category: post?.category || 'free',
    gameSlug: normalizeGameSlug(post?.gameSlug),
    href: `/board/${normalizeId(post)}`,
    actor: mapCompactUser(post?.authorId),
    actorName: displayName(post?.authorId),
    contentPreview: cleanText(post?.content, 120),
    createdAt: post?.createdAt || null,
    updatedAt: post?.updatedAt || null,
    stats: {
      comments: toNonNegativeInt(post?.commentCount),
      reactions: toNonNegativeInt(post?.reactionCount),
      views: toNonNegativeInt(post?.viewCount),
    },
  };
}

function mapActivityComment(row) {
  const comment = row?.comments || row?.comment || {};
  return {
    _id: `comment-${normalizeId(row)}-${normalizeId(comment)}`,
    kind: 'comment',
    title: row?.title || '',
    label: '댓글',
    category: row?.category || 'free',
    gameSlug: normalizeGameSlug(row?.gameSlug),
    href: `/board/${normalizeId(row)}`,
    actor: mapCompactUser(comment?.authorId),
    actorName: displayName(comment?.authorId),
    contentPreview: cleanText(comment?.content, 140),
    createdAt: comment?.createdAt || null,
    updatedAt: comment?.updatedAt || null,
    stats: {
      comments: toNonNegativeInt(row?.commentCount),
      reactions: toNonNegativeInt(row?.reactionCount),
      views: toNonNegativeInt(row?.viewCount),
    },
  };
}

function mapActivityRoom(room) {
  const mapped = mapHubRoom(room);
  const solvedActor = mapped.status === 'solved' ? mapped.solvedBy : null;
  const actor = solvedActor || mapped.host;
  const statusLabel = mapped.status === 'solved' ? '정답' : mapped.status === 'closed' ? '종료' : '스무고개';
  return {
    _id: `room-${mapped._id}`,
    kind: 'room',
    title: mapped.title,
    label: statusLabel,
    category: mapped.category,
    href: `/twenty-questions/${mapped._id}`,
    actor,
    actorName: actor?.displayName || mapped.hostName || '?듬챸',
    contentPreview: cleanText(mapped.hint, 140),
    createdAt: mapped.createdAt,
    updatedAt: mapped.solvedAt || mapped.updatedAt,
    stats: {
      questions: mapped.questionCount,
      guesses: mapped.guessCount,
      attempts: mapped.attemptCount,
      remaining: mapped.remainingCount,
    },
  };
}

function activitySortTime(row) {
  const ms = new Date(row?.updatedAt || row?.createdAt || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function clampListLimit(value, fallback = 20, max = 80) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

async function mapFollowEntries(rows, userField, viewerId = null) {
  const entries = Array.isArray(rows) ? rows : [];
  const users = entries
    .map((row) => mapPublicUser(row?.[userField]))
    .filter((user) => user?._id);
  const userIds = users
    .map((user) => normalizeId(user._id))
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  const viewerIdText = normalizeId(viewerId);
  let viewerFollowingIds = new Set();

  if (viewerIdText && mongoose.Types.ObjectId.isValid(viewerIdText) && userIds.length) {
    const follows = await UserFollow.find({
      followerId: new mongoose.Types.ObjectId(viewerIdText),
      followingId: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
    }).select('followingId').lean();
    viewerFollowingIds = new Set(follows.map((row) => normalizeId(row.followingId)));
  }

  return entries
    .map((row) => {
      const user = mapPublicUser(row?.[userField]);
      if (!user?._id) return null;
      return {
        user,
        followedAt: row?.createdAt || null,
        viewerFollowing: viewerFollowingIds.has(normalizeId(user._id)),
      };
    })
    .filter(Boolean);
}

async function loadFollowPreview(userId, viewerId = null, limit = 6) {
  const [followers, following] = await Promise.all([
    UserFollow.find({ followingId: userId })
      .populate('followerId', PUBLIC_FOLLOW_USER_SELECT)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    UserFollow.find({ followerId: userId })
      .populate('followingId', PUBLIC_FOLLOW_USER_SELECT)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  const [mappedFollowers, mappedFollowing] = await Promise.all([
    mapFollowEntries(followers, 'followerId', viewerId),
    mapFollowEntries(following, 'followingId', viewerId),
  ]);

  return {
    followers: mappedFollowers,
    following: mappedFollowing,
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
