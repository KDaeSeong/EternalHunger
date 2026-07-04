const express = require('express');
const mongoose = require('mongoose');

const GameSaveSlot = require('../models/GameSaveSlot');

const router = express.Router();

const MAX_SAVE_BYTES = toPositiveInt(process.env.GAME_SAVE_MAX_BYTES, 1024 * 1024);
const MAX_SLOTS_PER_GAME = toPositiveInt(process.env.GAME_SAVE_MAX_SLOTS_PER_GAME, 20);

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

function cleanSaveName(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text.slice(0, 80) || '저장 슬롯';
}

function cleanVersion(value) {
  return String(value || '').trim().slice(0, 40);
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getJsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
}

function mapSlot(row, options = {}) {
  if (!row) return null;
  const mapped = {
    id: String(row._id || ''),
    gameSlug: row.gameSlug || '',
    slotKey: row.slotKey || '',
    saveName: row.saveName || '저장 슬롯',
    version: row.version || '',
    summary: normalizeObject(row.summary),
    payloadBytes: Number(row.payloadBytes || 0),
    lastPlayedAt: row.lastPlayedAt || null,
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
    const query = { userId };
    if (gameSlug) query.gameSlug = gameSlug;

    const rows = await GameSaveSlot.find(query)
      .select('-payload')
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(200)
      .lean();

    res.json({ saves: rows.map((row) => mapSlot(row)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '저장 슬롯을 불러오지 못했습니다.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;
    const id = String(req.params?.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '저장 슬롯 ID가 올바르지 않습니다.' });
    }

    const row = await GameSaveSlot.findOne({ _id: id, userId }).lean();
    if (!row) return res.status(404).json({ error: '저장 슬롯을 찾을 수 없습니다.' });

    res.json({ save: mapSlot(row, { includePayload: true }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '저장 슬롯을 불러오지 못했습니다.' });
  }
});

router.put('/:gameSlug/:slotKey', async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;

    const gameSlug = normalizeKey(req.params?.gameSlug);
    const slotKey = normalizeKey(req.params?.slotKey);
    if (!gameSlug || !slotKey) {
      return res.status(400).json({ error: '게임과 슬롯 키가 올바르지 않습니다.' });
    }

    const payload = req.body?.payload ?? {};
    const summary = normalizeObject(req.body?.summary);
    const payloadBytes = getJsonBytes(payload);
    if (payloadBytes > MAX_SAVE_BYTES) {
      return res.status(413).json({ error: `저장 데이터는 ${MAX_SAVE_BYTES.toLocaleString('ko-KR')}바이트 이내로 입력해주세요.` });
    }

    const existing = await GameSaveSlot.findOne({ userId, gameSlug, slotKey }).select('_id').lean();
    if (!existing) {
      const count = await GameSaveSlot.countDocuments({ userId, gameSlug });
      if (count >= MAX_SLOTS_PER_GAME) {
        return res.status(400).json({ error: `게임별 저장 슬롯은 ${MAX_SLOTS_PER_GAME}개까지 만들 수 있습니다.` });
      }
    }

    const lastPlayedAt = req.body?.lastPlayedAt ? new Date(req.body.lastPlayedAt) : null;
    const patch = {
      userId,
      gameSlug,
      slotKey,
      saveName: cleanSaveName(req.body?.saveName),
      version: cleanVersion(req.body?.version),
      summary,
      payload,
      payloadBytes,
      lastPlayedAt: lastPlayedAt && !Number.isNaN(lastPlayedAt.getTime()) ? lastPlayedAt : new Date(),
    };

    const row = await GameSaveSlot.findOneAndUpdate(
      { userId, gameSlug, slotKey },
      { $set: patch },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({ message: '저장 슬롯을 저장했습니다.', save: mapSlot(row, { includePayload: true }) });
  } catch (err) {
    console.error(err);
    if (err?.code === 11000) {
      return res.status(409).json({ error: '저장 슬롯이 충돌했습니다. 다시 시도해주세요.' });
    }
    res.status(500).json({ error: '저장 슬롯 저장에 실패했습니다.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;
    const id = String(req.params?.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '저장 슬롯 ID가 올바르지 않습니다.' });
    }

    const result = await GameSaveSlot.deleteOne({ _id: id, userId });
    if (!result.deletedCount) return res.status(404).json({ error: '저장 슬롯을 찾을 수 없습니다.' });

    res.json({ message: '저장 슬롯을 삭제했습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '저장 슬롯 삭제에 실패했습니다.' });
  }
});

module.exports = router;
