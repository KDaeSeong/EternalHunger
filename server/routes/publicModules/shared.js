const mongoose = require('mongoose');
const User = require('../../models/User');
const Post = require('../../models/Post');
const TwentyQuestionsRoom = require('../../models/TwentyQuestionsRoom');
const GameRoom = require('../../models/GameRoom');
const UserFollow = require('../../models/UserFollow');
const Character = require('../../models/Characters');
const TeamRecord = require('../../models/TeamRecord');
const GameLog = require('../../models/GameLog');
const Item = require('../../models/Item');
const MapModel = require('../../models/Map');
const Kiosk = require('../../models/Kiosk');
const DroneOffer = require('../../models/DroneOffer');
const Perk = require('../../models/Perk');
const GameCatalogEntry = require('../../models/GameCatalogEntry');
const ErMeta = require('../../models/ErMeta');
const { dedupeScopedPerks, ensureDefaultPublicPerks } = require('../../utils/defaultPerks');
const { DEFAULT_ZONES, normalizeZoneList } = require('../../utils/defaultZones');
const { buildDefaultZoneConnections } = require('../../utils/defaultZoneConnections');
const { getOptionalUserId, scopedFilter } = require('../../utils/requestScope');

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

function mapPublicGameCandidate(row) {
  return {
    id: normalizeId(row),
    slug: normalizeGameSlug(row?.slug),
    title: row?.title || '',
    subtitle: row?.subtitle || '',
    priority: row?.priority || '후보',
    stage: row?.stage || 'planned',
    stageLabel: row?.stageLabel || '이식 후보',
    adapter: row?.adapter || 'discussion',
    roomSystem: row?.roomSystem || 'none',
    resultMode: row?.resultMode || 'manual',
    scope: row?.scope || '',
    summary: row?.summary || '',
    nextStep: row?.nextStep || '',
    supportsRooms: Boolean(row?.supportsRooms),
    supportsStateSync: Boolean(row?.supportsStateSync),
    supportsRecords: Boolean(row?.supportsRecords),
    supportsSaves: Boolean(row?.supportsSaves),
    sortOrder: Number(row?.sortOrder || 1000),
    updatedAt: row?.updatedAt || null,
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
    title: result.recordTitle || result.roomTitle || base.title || '게임 결과',
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

module.exports = {
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
};
