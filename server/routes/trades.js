// server/routes/trades.js
// 🔁 아이템 교환(거래 오퍼)

const express = require('express');
const router = express.Router();

const TradeOffer = require('../models/TradeOffer');
const User = require('../models/User');
const Character = require('../models/Characters');
const Item = require('../models/Item');

const {
  buildItemNameMap,
  normalizeInventory,
  removeFromInventory,
  addToInventory,
  countInInventory,
} = require('../utils/inventory');

function normalizeIO(list) {
  return (Array.isArray(list) ? list : [])
    .filter((x) => x && x.itemId)
    .map((x) => ({ itemId: x.itemId, qty: Math.max(1, Number(x.qty || 1)) }));
}

// GET /api/trades?mine=true
router.get('/', async (req, res) => {
  try {
    const mine = String(req.query?.mine || '') === 'true';
    const q = mine ? { fromUserId: req.user.id } : { status: 'open' };
    const offers = await TradeOffer.find(q)
      .sort({ createdAt: -1 })
      .populate('fromCharacterId', 'name')
      .populate('give.itemId', 'name tier rarity')
      .populate('want.itemId', 'name tier rarity');

    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '오퍼 로드 실패' });
  }
});

// POST /api/trades
// body: { fromCharacterId, give, want, wantCredits, note }
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { fromCharacterId, give, want, wantCredits, note } = req.body || {};
    if (!fromCharacterId) return res.status(400).json({ error: 'fromCharacterId가 필요합니다.' });

    const ch = await Character.findOne({ _id: fromCharacterId, userId });
    if (!ch) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다.' });

    const giveN = normalizeIO(give);
    const wantN = normalizeIO(want);
    const wc = Math.max(0, Number(wantCredits || 0));

    if (giveN.length === 0) return res.status(400).json({ error: 'give 항목이 비었습니다.' });

    // 인벤토리 정규화
    const items = await Item.find({}, '_id name');
    const itemNameMap = buildItemNameMap(items);
    ch.inventory = normalizeInventory(ch.inventory, itemNameMap, { merge: true });

    // give 보유 체크
    for (const g of giveN) {
      const have = countInInventory(ch.inventory, g.itemId);
      if (have < g.qty) return res.status(400).json({ error: `보유 아이템 부족: ${String(g.itemId)} (${have}/${g.qty})` });
    }

    const offer = await new TradeOffer({
      fromUserId: userId,
      fromCharacterId,
      give: giveN,
      want: wantN,
      wantCredits: wc,
      note: String(note || ''),
      status: 'open'
    }).save();

    res.json({ message: '오퍼 생성 완료', offer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '오퍼 생성 실패' });
  }
});

// POST /api/trades/:id/cancel
router.post('/:id/cancel', async (req, res) => {
  try {
    const offer = await TradeOffer.findOneAndUpdate(
      { _id: req.params.id, fromUserId: req.user.id, status: 'open' },
      { status: 'cancelled' },
      { new: true }
    );
    if (!offer) return res.status(404).json({ error: '취소할 오퍼를 찾을 수 없습니다.' });
    res.json({ message: '오퍼 취소 완료', offer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '오퍼 취소 실패' });
  }
});

// POST /api/trades/:id/accept
// body: { toCharacterId }
router.post('/:id/accept', async (req, res) => {
  try {
    const userId = req.user.id;
    const toCharacterId = req.body?.toCharacterId;
    if (!toCharacterId) return res.status(400).json({ error: 'toCharacterId가 필요합니다.' });

    const offer = await TradeOffer.findById(req.params.id);
    if (!offer || offer.status !== 'open') return res.status(404).json({ error: '오퍼를 찾을 수 없습니다.' });
    if (String(offer.fromUserId) === String(userId)) return res.status(400).json({ error: '본인 오퍼는 수락할 수 없습니다.' });

    const [fromUser, toUser, fromChar, toChar, items] = await Promise.all([
      User.findById(offer.fromUserId),
      User.findById(userId),
      Character.findById(offer.fromCharacterId),
      Character.findOne({ _id: toCharacterId, userId }),
      Item.find({}, '_id name'),
    ]);

    if (!fromUser || !toUser) return res.status(404).json({ error: '유저 정보를 찾을 수 없습니다.' });
    if (!fromChar || !toChar) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다.' });

    const itemNameMap = buildItemNameMap(items);
    fromChar.inventory = normalizeInventory(fromChar.inventory, itemNameMap, { merge: true });
    toChar.inventory = normalizeInventory(toChar.inventory, itemNameMap, { merge: true });

    // offer owner가 give를 아직 보유하는지
    for (const g of offer.give || []) {
      const have = countInInventory(fromChar.inventory, g.itemId);
      if (have < g.qty) return res.status(400).json({ error: '오퍼 주최자의 아이템이 부족합니다.' });
    }
    // acceptor가 want를 보유하는지
    for (const w of offer.want || []) {
      const have = countInInventory(toChar.inventory, w.itemId);
      if (have < w.qty) return res.status(400).json({ error: '수락자의 아이템이 부족합니다.' });
    }

    const wc = Math.max(0, Number(offer.wantCredits || 0));
    if (wc > 0 && Number(toUser.credits || 0) < wc) return res.status(400).json({ error: '수락자의 크레딧이 부족합니다.' });

    // 1) fromChar -> toChar (give)
    for (const g of offer.give || []) {
      if (!removeFromInventory(fromChar.inventory, g.itemId, g.qty)) return res.status(500).json({ error: 'give 차감 실패' });
      addToInventory(toChar.inventory, { itemId: g.itemId, qty: g.qty });
    }
    // 2) toChar -> fromChar (want)
    for (const w of offer.want || []) {
      if (!removeFromInventory(toChar.inventory, w.itemId, w.qty)) return res.status(500).json({ error: 'want 차감 실패' });
      addToInventory(fromChar.inventory, { itemId: w.itemId, qty: w.qty });
    }

    // 3) credits transfer
    if (wc > 0) {
      toUser.credits -= wc;
      fromUser.credits += wc;
    }

    fromChar.markModified('inventory');
    toChar.markModified('inventory');

    await Promise.all([
      fromChar.save(),
      toChar.save(),
      fromUser.save(),
      toUser.save(),
      TradeOffer.findByIdAndUpdate(offer._id, { status: 'accepted', acceptedByUserId: userId, acceptedAt: new Date() }, { new: true })
    ]);

    res.json({ message: '거래 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '거래 실패' });
  }
});

module.exports = router;
