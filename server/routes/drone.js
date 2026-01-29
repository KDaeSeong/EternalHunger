// server/routes/drone.js
// 🚁 전송 드론 구매(로드맵 4번)

const express = require('express');
const router = express.Router();

const DroneOffer = require('../models/DroneOffer');
const User = require('../models/User');
const Character = require('../models/Characters');
const Item = require('../models/Item');

const {
  buildItemNameMap,
  normalizeInventory,
  addToInventory,
} = require('../utils/inventory');

/**
 * POST /api/drone/buy
 * body: { characterId, offerId, qty }
 */
router.post('/buy', async (req, res) => {
  try {
    const userId = req.user.id;
    const { characterId, offerId } = req.body || {};
    const qty = Math.max(1, Number(req.body?.qty || 1));

    if (!characterId || !offerId) return res.status(400).json({ error: 'characterId, offerId가 필요합니다.' });

    const [user, ch, offer, items] = await Promise.all([
      User.findById(userId),
      Character.findOne({ _id: characterId, userId }),
      DroneOffer.findById(offerId).populate('itemId'),
      Item.find({}, '_id name'),
    ]);

    if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    if (!ch) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다.' });
    if (!offer || !offer.isActive) return res.status(404).json({ error: '판매 항목을 찾을 수 없습니다.' });

    const item = offer.itemId;
    if (!item) return res.status(404).json({ error: '아이템 정보를 찾을 수 없습니다.' });
    if (Number(item.tier || 1) > Number(offer.maxTier || 1)) return res.status(400).json({ error: '티어 제한으로 구매할 수 없습니다.' });

    const price = Math.max(0, Number(offer.priceCredits || 0));
    const total = price * qty;
    if (Number(user.credits || 0) < total) return res.status(400).json({ error: '크레딧이 부족합니다.' });

    const itemNameMap = buildItemNameMap(items);
    ch.inventory = normalizeInventory(ch.inventory, itemNameMap, { merge: true });

    user.credits -= total;
    addToInventory(ch.inventory, { itemId: item._id, name: item.name, qty });

    ch.markModified('inventory');
    await Promise.all([user.save(), ch.save()]);

    res.json({ message: '구매 완료', credits: user.credits, character: ch });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '드론 구매 실패' });
  }
});

module.exports = router;
