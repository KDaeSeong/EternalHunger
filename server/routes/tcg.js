const express = require('express');
const mongoose = require('mongoose');

const TcgDeck = require('../models/TcgDeck');
const { verifyToken } = require('../middleware/authMiddleware');
const {
  TCG_GAME_SLUG,
  TCG_DECK_RULES,
  TCG_CARDS,
  DEFAULT_DECK_CARD_IDS,
  getTcgCard,
  validateDeckCardIds,
  summarizeDeck,
} = require('../utils/tcgCatalog');

const router = express.Router();

function normalizeKey(value, fallback = '') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function cleanName(value, fallback = '스타터 덱') {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return (text || fallback).slice(0, 80);
}

function getUserObjectId(req, res) {
  const raw = String(req.user?.id || req.user?._id || '');
  if (!mongoose.Types.ObjectId.isValid(raw)) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return null;
  }
  return new mongoose.Types.ObjectId(raw);
}

function mapDeck(row, options = {}) {
  if (!row) return null;
  const cardIds = Array.isArray(row.cardIds) ? row.cardIds : [];
  const mapped = {
    id: String(row._id || ''),
    gameSlug: row.gameSlug || TCG_GAME_SLUG,
    deckKey: row.deckKey || '',
    name: row.name || '스타터 덱',
    cardIds,
    active: Boolean(row.active),
    summary: row.summary || summarizeDeck(cardIds),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
  if (options.includeCards) mapped.cards = cardIds.map(getTcgCard).filter(Boolean);
  return mapped;
}

async function ensureStarterDeck(userId) {
  const existing = await TcgDeck.findOne({ userId, gameSlug: TCG_GAME_SLUG })
    .sort({ active: -1, updatedAt: -1 })
    .lean();
  if (existing) return existing;

  const row = await TcgDeck.create({
    userId,
    gameSlug: TCG_GAME_SLUG,
    deckKey: 'starter',
    name: '스타터 덱',
    cardIds: DEFAULT_DECK_CARD_IDS,
    active: true,
    summary: summarizeDeck(DEFAULT_DECK_CARD_IDS),
  });
  return row.toObject();
}

router.get('/cards', (req, res) => {
  res.json({
    gameSlug: TCG_GAME_SLUG,
    rules: TCG_DECK_RULES,
    cards: TCG_CARDS,
    defaultDeckCardIds: DEFAULT_DECK_CARD_IDS,
  });
});

router.get('/decks', verifyToken, async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;

    await ensureStarterDeck(userId);
    const decks = await TcgDeck.find({ userId, gameSlug: TCG_GAME_SLUG })
      .sort({ active: -1, updatedAt: -1 })
      .lean();
    const activeDeck = decks.find((deck) => deck.active) || decks[0] || null;

    res.json({
      decks: decks.map((deck) => mapDeck(deck)),
      activeDeck: mapDeck(activeDeck, { includeCards: true }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '덱 정보를 불러오지 못했습니다.' });
  }
});

router.get('/decks/active', verifyToken, async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;

    await ensureStarterDeck(userId);
    let deck = await TcgDeck.findOne({ userId, gameSlug: TCG_GAME_SLUG, active: true })
      .sort({ updatedAt: -1 })
      .lean();
    if (!deck) {
      deck = await TcgDeck.findOne({ userId, gameSlug: TCG_GAME_SLUG })
        .sort({ updatedAt: -1 })
        .lean();
    }

    res.json({ deck: mapDeck(deck, { includeCards: true }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '활성 덱을 불러오지 못했습니다.' });
  }
});

router.put('/decks/:deckKey', verifyToken, async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;

    const deckKey = normalizeKey(req.params?.deckKey, 'main');
    if (!deckKey) return res.status(400).json({ error: '덱 키가 올바르지 않습니다.' });

    const validation = validateDeckCardIds(req.body?.cardIds);
    if (!validation.ok) return res.status(400).json({ error: validation.error });

    const patch = {
      userId,
      gameSlug: TCG_GAME_SLUG,
      deckKey,
      name: cleanName(req.body?.name, '커스텀 덱'),
      cardIds: validation.cardIds,
      summary: summarizeDeck(validation.cardIds),
    };

    const row = await TcgDeck.findOneAndUpdate(
      { userId, gameSlug: TCG_GAME_SLUG, deckKey },
      { $set: patch, $setOnInsert: { active: false } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({ message: '덱을 저장했습니다.', deck: mapDeck(row, { includeCards: true }) });
  } catch (err) {
    console.error(err);
    if (err?.code === 11000) return res.status(409).json({ error: '덱 저장이 충돌했습니다. 다시 시도해주세요.' });
    res.status(500).json({ error: '덱 저장에 실패했습니다.' });
  }
});

router.post('/decks/:deckKey/activate', verifyToken, async (req, res) => {
  try {
    const userId = getUserObjectId(req, res);
    if (!userId) return;

    const deckKey = normalizeKey(req.params?.deckKey);
    if (!deckKey) return res.status(400).json({ error: '덱 키가 올바르지 않습니다.' });

    const deck = await TcgDeck.findOne({ userId, gameSlug: TCG_GAME_SLUG, deckKey }).lean();
    if (!deck) return res.status(404).json({ error: '덱을 찾을 수 없습니다.' });

    await TcgDeck.updateMany({ userId, gameSlug: TCG_GAME_SLUG }, { $set: { active: false } });
    const activeDeck = await TcgDeck.findOneAndUpdate(
      { userId, gameSlug: TCG_GAME_SLUG, deckKey },
      { $set: { active: true } },
      { new: true }
    ).lean();

    res.json({ message: '활성 덱을 변경했습니다.', deck: mapDeck(activeDeck, { includeCards: true }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '활성 덱 변경에 실패했습니다.' });
  }
});

module.exports = router;
