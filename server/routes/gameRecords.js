const express = require('express');
const mongoose = require('mongoose');

const GamePlayRecord = require('../models/GamePlayRecord');

const router = express.Router();

const MAX_RECORD_PAYLOAD_BYTES = toPositiveInt(process.env.GAME_RECORD_MAX_BYTES, 512 * 1024);
const VALID_RESULTS = new Set(['win', 'loss', 'draw', 'clear', 'fail', 'none']);

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

function mapRecord(row, options = {}) {
  if (!row) return null;
  const mapped = {
    id: String(row._id || ''),
    gameSlug: row.gameSlug || '',
    title: row.title || '플레이 기록',
    mode: row.mode || '',
    result: row.result || 'none',
    score: toFiniteNumber(row.score),
    playTimeSec: toNonNegativeInt(row.playTimeSec),
    summary: normalizeObject(row.summary),
    payloadBytes: Number(row.payloadBytes || 0),
    playedAt: row.playedAt || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
  if (options.includePayload) mapped.payload = row.payload ?? {};
  return mapped;
}

function getUserObjectId(req, res) {
  const raw = String(req.user?.id || req.user?._id || '');
  if (!mongoose.Types.ObjectId.isValid(raw)) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return null;
  }
  return new mongoose.Types.ObjectId(raw);
}

router.get('/', async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;

    const gameSlug = normalizeKey(req.query?.gameSlug);
    const limit = Math.min(200, Math.max(1, toNonNegativeInt(req.query?.limit) || 100));
    const query = { userId };
    if (gameSlug) query.gameSlug = gameSlug;

    const rows = await GamePlayRecord.find(query)
      .select('-payload')
      .sort({ playedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ records: rows.map((row) => mapRecord(row)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임 기록을 불러오지 못했습니다.' });
  }
});

router.post('/:gameSlug', async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;

    const gameSlug = normalizeKey(req.params?.gameSlug);
    if (!gameSlug) return res.status(400).json({ error: '게임 키가 올바르지 않습니다.' });

    const payload = req.body?.payload ?? {};
    const summary = normalizeObject(req.body?.summary);
    const payloadBytes = getJsonBytes(payload);
    if (payloadBytes > MAX_RECORD_PAYLOAD_BYTES) {
      return res.status(413).json({ error: `기록 데이터는 ${MAX_RECORD_PAYLOAD_BYTES.toLocaleString('ko-KR')}바이트 이내로 입력해주세요.` });
    }

    const result = VALID_RESULTS.has(String(req.body?.result || '')) ? String(req.body.result) : 'none';
    const playedAt = req.body?.playedAt ? new Date(req.body.playedAt) : new Date();

    const row = await GamePlayRecord.create({
      userId,
      gameSlug,
      title: cleanText(req.body?.title, '플레이 기록', 120),
      mode: cleanText(req.body?.mode, '', 80),
      result,
      score: toFiniteNumber(req.body?.score),
      playTimeSec: toNonNegativeInt(req.body?.playTimeSec),
      summary,
      payload,
      payloadBytes,
      playedAt: playedAt && !Number.isNaN(playedAt.getTime()) ? playedAt : new Date(),
    });

    res.status(201).json({ message: '게임 기록을 저장했습니다.', record: mapRecord(row, { includePayload: true }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임 기록 저장에 실패했습니다.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;
    const id = String(req.params?.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '게임 기록 ID가 올바르지 않습니다.' });
    }

    const row = await GamePlayRecord.findOne({ _id: id, userId }).lean();
    if (!row) return res.status(404).json({ error: '게임 기록을 찾을 수 없습니다.' });

    res.json({ record: mapRecord(row, { includePayload: true }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임 기록을 불러오지 못했습니다.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;
    const id = String(req.params?.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '게임 기록 ID가 올바르지 않습니다.' });
    }

    const result = await GamePlayRecord.deleteOne({ _id: id, userId });
    if (!result.deletedCount) return res.status(404).json({ error: '게임 기록을 찾을 수 없습니다.' });

    res.json({ message: '게임 기록을 삭제했습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게임 기록 삭제에 실패했습니다.' });
  }
});

module.exports = router;
