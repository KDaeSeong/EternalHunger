const express = require('express');
const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/authMiddleware');
const GameRoom = require('../models/GameRoom');
const { generateJoinCode, hashJoinCode, verifyJoinCode } = require('../utils/gameRoomAccess');

const router = express.Router();
const MAX_ROOM_STATE_BYTES = positiveInt(process.env.GAME_ROOM_STATE_MAX_BYTES, 256 * 1024);

function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanText(value, fallback, maxLength) {
  const output = String(value || '').trim().replace(/\s+/g, ' ');
  return (output || fallback).slice(0, maxLength);
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function normalizeId(value) {
  return String(value?._id || value?.id || value || '');
}

function activePlayers(players) {
  return (Array.isArray(players) ? players : []).filter((player) => player?.status !== 'left');
}

function isHost(room, userId) {
  return normalizeId(room?.hostId) === String(userId || '');
}

function isParticipant(room, userId) {
  return activePlayers(room?.players).some((player) => normalizeId(player?.userId) === String(userId || ''));
}

function mapUser(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    _id: normalizeId(value),
    username: value.username || '',
    nickname: value.nickname || '',
    displayName: value.nickname || value.username || '사용자',
  };
}

function mapRoom(room, userId, includeState = false) {
  if (!room) return null;
  const players = (Array.isArray(room.players) ? room.players : []).map((player) => {
    const user = mapUser(player.userId);
    return {
      userId: normalizeId(player.userId),
      user,
      displayName: user?.displayName || '사용자',
      role: player.role || 'player',
      status: player.status || 'joined',
      joinedAt: player.joinedAt || null,
      leftAt: player.leftAt || null,
    };
  });
  return {
    id: normalizeId(room),
    _id: normalizeId(room),
    gameSlug: room.gameSlug || '',
    title: room.title || '게임방',
    mode: room.mode || '',
    status: room.status || 'open',
    visibility: room.visibility || 'public',
    hostId: normalizeId(room.hostId),
    host: mapUser(room.hostId),
    hostName: mapUser(room.hostId)?.displayName || '방장',
    maxPlayers: Number(room.maxPlayers || 0),
    playerCount: activePlayers(room.players).length,
    players,
    summary: normalizeObject(room.summary),
    settings: normalizeObject(room.settings),
    revision: Number(room.revision || 0),
    result: normalizeObject(room.result),
    recordedAt: room.recordedAt || null,
    recordedBy: normalizeId(room.recordedBy),
    recordCount: Number(room.recordCount || 0),
    isHost: isHost(room, userId),
    isParticipant: isParticipant(room, userId),
    startedAt: room.startedAt || null,
    endedAt: room.endedAt || null,
    lastActivityAt: room.lastActivityAt || room.updatedAt || null,
    createdAt: room.createdAt || null,
    updatedAt: room.updatedAt || null,
    ...(includeState ? { state: normalizeObject(room.state), stateBytes: Number(room.stateBytes || 0) } : {}),
  };
}

async function populateRoom(query) {
  const room = await query
    .select('+joinCodeHash')
    .populate('hostId', 'username nickname')
    .populate('players.userId', 'username nickname');
  return room;
}

function validObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function stateBytes(res, state) {
  const bytes = Buffer.byteLength(JSON.stringify(state ?? null), 'utf8');
  if (bytes > MAX_ROOM_STATE_BYTES) {
    res.status(413).json({ error: `방 상태 데이터는 ${MAX_ROOM_STATE_BYTES.toLocaleString('ko-KR')}바이트 이내로 입력해주세요.` });
    return null;
  }
  return bytes;
}

router.get('/:id', verifyToken, async (req, res, next) => {
  if (!validObjectId(req.params.id)) return next();
  try {
    const room = await populateRoom(GameRoom.findById(req.params.id));
    if (!room || room.visibility === 'public') return next();
    const userId = String(req.user.id);
    const member = isHost(room, userId) || isParticipant(room, userId);
    const invited = verifyJoinCode(req.query?.joinCode, room.joinCodeHash);
    if (!member && !invited) return res.status(404).json({ error: '게임방을 찾을 수 없습니다.' });
    return res.json({ room: { ...mapRoom(room, userId, member), inviteAuthorized: invited } });
  } catch (error) {
    console.error('private room lookup failed:', error);
    return res.status(500).json({ error: '게임방 정보를 불러오지 못했습니다.' });
  }
});

router.post('/', verifyToken, async (req, res, next) => {
  if (req.body?.visibility !== 'private') return next();
  try {
    const gameSlug = normalizeKey(req.body?.gameSlug);
    if (!gameSlug) return res.status(400).json({ error: '게임을 선택해주세요.' });
    const state = normalizeObject(req.body?.state);
    const bytes = stateBytes(res, state);
    if (bytes == null) return undefined;
    const joinCode = generateJoinCode();
    const now = new Date();
    const room = await GameRoom.create({
      gameSlug,
      title: cleanText(req.body?.title, '새 게임방', 120),
      mode: cleanText(req.body?.mode, '', 80),
      visibility: 'private',
      joinCodeHash: hashJoinCode(joinCode),
      hostId: req.user.id,
      maxPlayers: Math.min(64, Math.max(1, positiveInt(req.body?.maxPlayers, 4))),
      players: [{ userId: req.user.id, role: 'host', status: 'joined', joinedAt: now }],
      summary: normalizeObject(req.body?.summary),
      settings: normalizeObject(req.body?.settings),
      state,
      stateBytes: bytes,
      lastActivityAt: now,
    });
    const fresh = await populateRoom(GameRoom.findById(room._id));
    return res.status(201).json({
      message: '비공개 게임방을 만들었습니다.',
      room: mapRoom(fresh, req.user.id, true),
      joinCode,
    });
  } catch (error) {
    console.error('private room create failed:', error);
    return res.status(500).json({ error: '게임방 생성에 실패했습니다.' });
  }
});

router.post('/:id/join', verifyToken, async (req, res, next) => {
  if (!validObjectId(req.params.id)) return next();
  try {
    const room = await GameRoom.findById(req.params.id).select('+joinCodeHash');
    if (!room || room.visibility === 'public') return next();
    const userId = String(req.user.id);
    if (!isHost(room, userId) && !isParticipant(room, userId) && !verifyJoinCode(req.body?.joinCode, room.joinCodeHash)) {
      return res.status(403).json({ error: '비공개 방 초대 코드가 올바르지 않습니다.', code: 'ROOM_INVITE_REQUIRED' });
    }
    if (['finished', 'closed'].includes(room.status)) return res.status(400).json({ error: '종료된 방에는 참가할 수 없습니다.' });
    const index = room.players.findIndex((player) => normalizeId(player.userId) === userId);
    if (room.status === 'playing' && index < 0) return res.status(400).json({ error: '진행 중인 방에는 새로 참가할 수 없습니다.' });
    if (index >= 0 && room.players[index].status !== 'left') {
      const fresh = await populateRoom(GameRoom.findById(room._id));
      return res.json({ message: '이미 참가 중입니다.', room: mapRoom(fresh, userId, true) });
    }
    if (activePlayers(room.players).length >= Number(room.maxPlayers || 1)) {
      return res.status(400).json({ error: '방 정원이 가득 찼습니다.' });
    }
    const now = new Date();
    if (index >= 0) {
      room.players[index].status = 'joined';
      room.players[index].joinedAt = now;
      room.players[index].leftAt = null;
    } else {
      room.players.push({ userId: req.user.id, role: 'player', status: 'joined', joinedAt: now });
    }
    room.lastActivityAt = now;
    await room.save();
    const fresh = await populateRoom(GameRoom.findById(room._id));
    return res.json({ message: '게임방에 참가했습니다.', room: mapRoom(fresh, userId, true) });
  } catch (error) {
    console.error('private room join failed:', error);
    return res.status(500).json({ error: '게임방 참가에 실패했습니다.' });
  }
});

router.post('/:id/state', verifyToken, async (req, res) => {
  if (!validObjectId(req.params.id)) return res.status(404).json({ error: '게임방을 찾을 수 없습니다.' });
  const expectedRevision = Number(req.body?.revision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return res.status(400).json({ error: '현재 방 revision이 필요합니다.', code: 'ROOM_REVISION_REQUIRED' });
  }
  const state = normalizeObject(req.body?.state);
  const bytes = stateBytes(res, state);
  if (bytes == null) return undefined;
  const now = new Date();
  const set = { state, stateBytes: bytes, lastActivityAt: now };
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'summary')) set.summary = normalizeObject(req.body.summary);
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'settings')) set.settings = normalizeObject(req.body.settings);
  try {
    const updated = await populateRoom(GameRoom.findOneAndUpdate(
      {
        _id: req.params.id,
        revision: expectedRevision,
        status: { $nin: ['finished', 'closed'] },
        $or: [
          { hostId: req.user.id },
          { players: { $elemMatch: { userId: req.user.id, status: { $ne: 'left' } } } },
        ],
      },
      { $set: set, $inc: { revision: 1 } },
      { new: true },
    ));
    if (updated) return res.json({ message: '방 상태를 저장했습니다.', room: mapRoom(updated, req.user.id, true) });

    const current = await populateRoom(GameRoom.findById(req.params.id));
    if (!current) return res.status(404).json({ error: '게임방을 찾을 수 없습니다.' });
    if (!isHost(current, req.user.id) && !isParticipant(current, req.user.id)) {
      return res.status(403).json({ error: '참가자만 방 상태를 저장할 수 있습니다.' });
    }
    if (['finished', 'closed'].includes(current.status)) return res.status(400).json({ error: '종료된 방입니다.' });
    return res.status(409).json({
      error: '방 상태가 이미 갱신되었습니다.',
      code: 'ROOM_REVISION_CONFLICT',
      room: mapRoom(current, req.user.id, true),
    });
  } catch (error) {
    console.error('atomic room state save failed:', error);
    return res.status(500).json({ error: '방 상태 저장에 실패했습니다.' });
  }
});

module.exports = router;
