const express = require('express');
const mongoose = require('mongoose');

const { verifyToken } = require('../middleware/authMiddleware');
const GamePlayRecord = require('../models/GamePlayRecord');
const GameRoom = require('../models/GameRoom');

const router = express.Router();

const MAX_ROOM_STATE_BYTES = toPositiveInt(process.env.GAME_ROOM_STATE_MAX_BYTES, 256 * 1024);
const MAX_ROOM_RECORD_PAYLOAD_BYTES = toPositiveInt(process.env.GAME_ROOM_RECORD_MAX_BYTES || process.env.GAME_RECORD_MAX_BYTES, 512 * 1024);
const VALID_STATUSES = new Set(['open', 'playing', 'finished', 'closed']);
const VALID_PLAYER_STATUSES = new Set(['joined', 'ready']);
const VALID_RECORD_RESULTS = new Set(['win', 'loss', 'draw', 'clear', 'fail', 'none']);

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normalizeKey(value, fallback = '') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function cleanText(value, fallback, maxLength) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return (text || fallback).slice(0, maxLength);
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getJsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toNonNegativeInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function getUserObjectId(req, res) {
  const raw = String(req.user?.id || req.user?._id || '');
  if (!mongoose.Types.ObjectId.isValid(raw)) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return null;
  }
  return new mongoose.Types.ObjectId(raw);
}

function normalizeId(value) {
  if (!value) return '';
  return String(value._id || value.id || value);
}

function displayName(user) {
  return String(user?.nickname || user?.username || '사용자').trim() || '사용자';
}

function compactUser(user) {
  if (!user) return null;
  return {
    _id: normalizeId(user),
    username: user.username || '',
    nickname: user.nickname || '',
    displayName: displayName(user),
  };
}

function activePlayers(players) {
  return (Array.isArray(players) ? players : []).filter((player) => player?.status !== 'left');
}

function findPlayerIndex(room, userId) {
  const key = String(userId || '');
  return Array.isArray(room?.players)
    ? room.players.findIndex((player) => normalizeId(player.userId) === key)
    : -1;
}

function isHost(room, userId) {
  return Boolean(userId && normalizeId(room?.hostId) === String(userId));
}

function isParticipant(room, userId) {
  const index = findPlayerIndex(room, userId);
  return index >= 0 && room.players[index]?.status !== 'left';
}

function normalizeRecordResult(value, fallback = 'none') {
  const result = String(value || '').trim();
  return VALID_RECORD_RESULTS.has(result) ? result : fallback;
}

function resultForPlayer(body, playerId) {
  const resultByUserId = normalizeObject(body?.resultByUserId);
  const direct = normalizeRecordResult(resultByUserId[playerId], '');
  if (direct) return direct;

  const winnerUserId = normalizeId(body?.winnerUserId);
  if (winnerUserId) return winnerUserId === playerId ? 'win' : 'loss';

  return normalizeRecordResult(body?.result, 'none');
}

function scoreForPlayer(body, playerId) {
  const scoreByUserId = normalizeObject(body?.scoreByUserId);
  return toFiniteNumber(scoreByUserId[playerId] ?? body?.score);
}

function mapPlayer(player) {
  const user = player?.userId && typeof player.userId === 'object' ? compactUser(player.userId) : null;
  return {
    userId: normalizeId(player?.userId),
    user,
    displayName: user?.displayName || '사용자',
    role: player?.role || 'player',
    status: player?.status || 'joined',
    joinedAt: player?.joinedAt || null,
    leftAt: player?.leftAt || null,
  };
}

function mapRoom(row, options = {}) {
  if (!row) return null;
  const userId = options.userId ? String(options.userId) : '';
  const players = Array.isArray(row.players) ? row.players.map(mapPlayer) : [];
  const active = activePlayers(row.players);
  return {
    id: normalizeId(row),
    _id: normalizeId(row),
    gameSlug: row.gameSlug || '',
    title: row.title || '게임방',
    mode: row.mode || '',
    status: row.status || 'open',
    visibility: row.visibility || 'public',
    hostId: normalizeId(row.hostId),
    host: row.hostId && typeof row.hostId === 'object' ? compactUser(row.hostId) : null,
    hostName: row.hostId && typeof row.hostId === 'object' ? displayName(row.hostId) : '방장',
    maxPlayers: Number(row.maxPlayers || 0),
    playerCount: active.length,
    players,
    summary: normalizeObject(row.summary),
    settings: normalizeObject(row.settings),
    revision: Number(row.revision || 0),
    result: normalizeObject(row.result),
    recordedAt: row.recordedAt || null,
    recordedBy: normalizeId(row.recordedBy),
    recordCount: Number(row.recordCount || 0),
    isHost: isHost(row, userId),
    isParticipant: isParticipant(row, userId),
    startedAt: row.startedAt || null,
    endedAt: row.endedAt || null,
    lastActivityAt: row.lastActivityAt || row.updatedAt || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    ...(options.includeState ? { state: normalizeObject(row.state), stateBytes: Number(row.stateBytes || 0) } : {}),
  };
}

function populateRoom(query) {
  return query
    .populate('hostId', 'username nickname')
    .populate('players.userId', 'username nickname');
}

async function findRoomById(id) {
  if (!mongoose.Types.ObjectId.isValid(String(id || ''))) return null;
  return populateRoom(GameRoom.findById(id));
}

async function serializeFreshRoom(id, req, options = {}) {
  const room = await findRoomById(id);
  return mapRoom(room, { userId: req.user?.id, includeState: Boolean(options.includeState) });
}

function assertStateSize(res, state) {
  const bytes = getJsonBytes(state);
  if (bytes > MAX_ROOM_STATE_BYTES) {
    res.status(413).json({ error: `방 상태 데이터는 ${MAX_ROOM_STATE_BYTES.toLocaleString('ko-KR')}바이트 이내로 입력해주세요.` });
    return null;
  }
  return bytes;
}

router.get('/', async (req, res) => {
  try {
    const gameSlug = normalizeKey(req.query?.gameSlug);
    const rawStatus = String(req.query?.status || '').trim();
    const limit = Math.min(100, Math.max(1, toPositiveInt(req.query?.limit, 40)));
    const query = { visibility: 'public' };
    if (gameSlug) query.gameSlug = gameSlug;
    if (VALID_STATUSES.has(rawStatus)) query.status = rawStatus;
    else query.status = { $in: ['open', 'playing'] };

    const rows = await populateRoom(
      GameRoom.find(query)
        .sort({ lastActivityAt: -1, updatedAt: -1 })
        .limit(limit)
    ).lean();

    res.json({ rooms: rows.map((row) => mapRoom(row)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임방 목록을 불러오지 못했습니다.' });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const room = await findRoomById(req.params.id);
    if (!room) return res.status(404).json({ error: '게임방을 찾을 수 없습니다.' });
    const userId = String(req.user.id);
    if (room.visibility !== 'public' && !isParticipant(room, userId) && !isHost(room, userId)) {
      return res.status(404).json({ error: '게임방을 찾을 수 없습니다.' });
    }
    res.json({ room: mapRoom(room, { userId, includeState: true }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임방 정보를 불러오지 못했습니다.' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;

    const gameSlug = normalizeKey(req.body?.gameSlug);
    if (!gameSlug) return res.status(400).json({ error: '게임을 선택해주세요.' });

    const state = normalizeObject(req.body?.state);
    const stateBytes = assertStateSize(res, state);
    if (stateBytes == null) return;

    const maxPlayers = Math.min(64, Math.max(1, toPositiveInt(req.body?.maxPlayers, 4)));
    const now = new Date();
    const room = await GameRoom.create({
      gameSlug,
      title: cleanText(req.body?.title, '새 게임방', 120),
      mode: cleanText(req.body?.mode, '', 80),
      visibility: req.body?.visibility === 'private' ? 'private' : 'public',
      hostId: userId,
      maxPlayers,
      players: [{ userId, role: 'host', status: 'joined', joinedAt: now }],
      summary: normalizeObject(req.body?.summary),
      settings: normalizeObject(req.body?.settings),
      state,
      stateBytes,
      lastActivityAt: now,
    });

    const mapped = await serializeFreshRoom(room._id, req, { includeState: true });
    res.status(201).json({ message: '게임방을 만들었습니다.', room: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임방 생성에 실패했습니다.' });
  }
});

router.post('/:id/join', verifyToken, async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;

    const room = await GameRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: '게임방을 찾을 수 없습니다.' });
    if (['finished', 'closed'].includes(room.status)) return res.status(400).json({ error: '종료된 방에는 참가할 수 없습니다.' });

    const index = findPlayerIndex(room, userId);
    const joinedCount = activePlayers(room.players).length;
    if (room.status === 'playing' && index < 0) {
      return res.status(400).json({ error: '진행 중인 방에는 새로 참가할 수 없습니다.' });
    }
    if (index >= 0 && room.players[index].status !== 'left') {
      const mapped = await serializeFreshRoom(room._id, req, { includeState: true });
      return res.json({ message: '이미 참가 중입니다.', room: mapped });
    }
    if (joinedCount >= Number(room.maxPlayers || 1)) {
      return res.status(400).json({ error: '방 정원이 가득 찼습니다.' });
    }

    const now = new Date();
    if (index >= 0) {
      room.players[index].status = 'joined';
      room.players[index].joinedAt = now;
      room.players[index].leftAt = null;
    } else {
      room.players.push({ userId, role: 'player', status: 'joined', joinedAt: now });
    }
    room.lastActivityAt = now;
    await room.save();

    const mapped = await serializeFreshRoom(room._id, req, { includeState: true });
    res.json({ message: '게임방에 참가했습니다.', room: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임방 참가에 실패했습니다.' });
  }
});

router.post('/:id/leave', verifyToken, async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;

    const room = await GameRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: '게임방을 찾을 수 없습니다.' });
    const index = findPlayerIndex(room, userId);
    if (index < 0 || room.players[index].status === 'left') {
      const mapped = await serializeFreshRoom(room._id, req, { includeState: true });
      return res.json({ message: '이미 퇴장했습니다.', room: mapped });
    }

    const now = new Date();
    room.players[index].status = 'left';
    room.players[index].leftAt = now;
    room.lastActivityAt = now;
    if (isHost(room, userId) && !['finished', 'closed'].includes(room.status)) {
      room.status = 'closed';
      room.endedAt = now;
    }
    await room.save();

    const mapped = await serializeFreshRoom(room._id, req, { includeState: true });
    res.json({ message: isHost(room, userId) ? '방장이 나가 방을 종료했습니다.' : '게임방에서 나갔습니다.', room: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임방 퇴장에 실패했습니다.' });
  }
});

router.post('/:id/ready', verifyToken, async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;
    const nextStatus = VALID_PLAYER_STATUSES.has(String(req.body?.status || '')) ? String(req.body.status) : 'ready';

    const room = await GameRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: '게임방을 찾을 수 없습니다.' });
    const index = findPlayerIndex(room, userId);
    if (index < 0 || room.players[index].status === 'left') {
      return res.status(403).json({ error: '참가자만 준비 상태를 바꿀 수 있습니다.' });
    }
    if (['finished', 'closed'].includes(room.status)) return res.status(400).json({ error: '종료된 방입니다.' });

    room.players[index].status = nextStatus;
    room.lastActivityAt = new Date();
    await room.save();

    const mapped = await serializeFreshRoom(room._id, req, { includeState: true });
    res.json({ message: nextStatus === 'ready' ? '준비 완료했습니다.' : '준비를 취소했습니다.', room: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '준비 상태 변경에 실패했습니다.' });
  }
});

router.post('/:id/status', verifyToken, async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;
    const status = String(req.body?.status || '').trim();
    if (!VALID_STATUSES.has(status)) return res.status(400).json({ error: '방 상태가 올바르지 않습니다.' });

    const room = await GameRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: '게임방을 찾을 수 없습니다.' });
    if (!isHost(room, userId)) return res.status(403).json({ error: '방장만 방 상태를 바꿀 수 있습니다.' });

    const now = new Date();
    room.status = status;
    room.lastActivityAt = now;
    if (status === 'playing' && !room.startedAt) room.startedAt = now;
    if (['finished', 'closed'].includes(status) && !room.endedAt) room.endedAt = now;
    await room.save();

    const mapped = await serializeFreshRoom(room._id, req, { includeState: true });
    res.json({ message: '방 상태를 변경했습니다.', room: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '방 상태 변경에 실패했습니다.' });
  }
});

router.post('/:id/state', verifyToken, async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;

    const state = normalizeObject(req.body?.state);
    const stateBytes = assertStateSize(res, state);
    if (stateBytes == null) return;

    const room = await GameRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: '게임방을 찾을 수 없습니다.' });
    if (!isParticipant(room, userId) && !isHost(room, userId)) {
      return res.status(403).json({ error: '참가자만 방 상태를 저장할 수 있습니다.' });
    }
    if (['finished', 'closed'].includes(room.status)) return res.status(400).json({ error: '종료된 방입니다.' });

    const expectedRevision = req.body?.revision;
    if (expectedRevision !== undefined && Number(expectedRevision) !== Number(room.revision || 0)) {
      const mapped = await serializeFreshRoom(room._id, req, { includeState: true });
      return res.status(409).json({ error: '방 상태가 이미 갱신되었습니다.', room: mapped });
    }

    room.state = state;
    room.stateBytes = stateBytes;
    room.summary = normalizeObject(req.body?.summary || room.summary);
    room.revision = Number(room.revision || 0) + 1;
    room.lastActivityAt = new Date();
    await room.save();

    const mapped = await serializeFreshRoom(room._id, req, { includeState: true });
    res.json({ message: '방 상태를 저장했습니다.', room: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '방 상태 저장에 실패했습니다.' });
  }
});

router.post('/:id/records', verifyToken, async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;

    const room = await GameRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: '게임방을 찾을 수 없습니다.' });
    if (!isHost(room, userId)) return res.status(403).json({ error: '방장만 방 결과를 기록할 수 있습니다.' });
    if (room.recordedAt) {
      const mapped = await serializeFreshRoom(room._id, req, { includeState: true });
      return res.status(409).json({ error: '이미 결과가 기록된 방입니다.', room: mapped });
    }

    const players = activePlayers(room.players);
    if (!players.length) return res.status(400).json({ error: '기록할 참가자가 없습니다.' });

    const roomId = normalizeId(room);
    const now = new Date();
    const playedAt = req.body?.playedAt ? new Date(req.body.playedAt) : now;
    const safePlayedAt = playedAt && !Number.isNaN(playedAt.getTime()) ? playedAt : now;
    const winnerUserId = normalizeId(req.body?.winnerUserId);
    const baseSummary = {
      ...normalizeObject(req.body?.summary),
      roomId,
      roomTitle: room.title || '',
      roomStatus: room.status || 'open',
      winnerUserId,
      playerCount: players.length,
    };
    const basePayload = {
      roomId,
      roomRevision: Number(room.revision || 0),
      payload: req.body?.payload ?? {},
    };
    const payloadBytes = getJsonBytes(basePayload);
    if (payloadBytes > MAX_ROOM_RECORD_PAYLOAD_BYTES) {
      return res.status(413).json({ error: `방 결과 데이터는 ${MAX_ROOM_RECORD_PAYLOAD_BYTES.toLocaleString('ko-KR')}바이트 이내로 입력해주세요.` });
    }

    const title = cleanText(req.body?.title, room.title || '게임방 기록', 120);
    const mode = cleanText(req.body?.mode, room.mode || '', 80);
    const playTimeSec = toNonNegativeInt(req.body?.playTimeSec);
    const records = players.map((player) => {
      const playerId = normalizeId(player.userId);
      return {
        userId: player.userId,
        gameSlug: room.gameSlug,
        title,
        mode,
        result: resultForPlayer(req.body, playerId),
        score: scoreForPlayer(req.body, playerId),
        playTimeSec,
        summary: {
          ...baseSummary,
          playerId,
          playerRole: player.role || 'player',
        },
        payload: {
          ...basePayload,
          playerId,
        },
        payloadBytes,
        playedAt: safePlayedAt,
      };
    });

    const created = await GamePlayRecord.insertMany(records);
    room.status = room.status === 'closed' ? room.status : 'finished';
    if (!room.endedAt) room.endedAt = now;
    room.result = {
      ...baseSummary,
      recordIds: created.map((row) => normalizeId(row)),
      recordedAt: now.toISOString(),
    };
    room.recordedAt = now;
    room.recordedBy = userId;
    room.recordCount = created.length;
    room.lastActivityAt = now;
    await room.save();

    const mapped = await serializeFreshRoom(room._id, req, { includeState: true });
    res.status(201).json({ message: '방 결과를 기록했습니다.', recordsCreated: created.length, room: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '방 결과 기록에 실패했습니다.' });
  }
});

module.exports = router;
