// server/routes/kiosks.js
// 🏪 키오스크 거래(로드맵 3번)

const express = require('express');
const router = express.Router();

const Kiosk = require('../models/Kiosk');
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

/**
 * POST /api/kiosks/:id/transaction
 * body: { characterId, catalogIndex, qty }
 * - catalogIndex: Kiosk.catalog index
 * - mode는 catalog에 저장된 값을 따릅니다(sell/buy/exchange)
 */
router.post('/:id/transaction', async (req, res) => {
  try {
    const userId = req.user.id;
    const kioskId = req.params.id;
    const characterId = req.body?.characterId;
    const idx = Number(req.body?.catalogIndex);
    const qty = Math.max(1, Number(req.body?.qty || 1));

    if (!characterId) return res.status(400).json({ error: 'characterId가 필요합니다.' });
    if (!Number.isFinite(idx) || idx < 0) return res.status(400).json({ error: 'catalogIndex가 올바르지 않습니다.' });

    const [kiosk, user, ch, items] = await Promise.all([
      Kiosk.findById(kioskId).populate('catalog.itemId').populate('catalog.exchange.giveItemId'),
      User.findById(userId),
      Character.findOne({ _id: characterId, userId }),
      Item.find({}, '_id name'),
    ]);

    if (!kiosk) return res.status(404).json({ error: '키오스크를 찾을 수 없습니다.' });
    if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    if (!ch) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다.' });

    const entry = kiosk.catalog?.[idx];
    if (!entry) return res.status(404).json({ error: 'catalog 항목을 찾을 수 없습니다.' });

    const itemNameMap = buildItemNameMap(items);
    ch.inventory = normalizeInventory(ch.inventory, itemNameMap, { merge: true });

    const mode = entry.mode || 'sell';
    const price = Math.max(0, Number(entry.priceCredits || 0));
    const totalPrice = price * qty;

    if (mode === 'sell') {
      if (Number(user.credits || 0) < totalPrice) return res.status(400).json({ error: '크레딧이 부족합니다.' });
      user.credits -= totalPrice;
      addToInventory(ch.inventory, { itemId: entry.itemId?._id || entry.itemId, name: entry.itemId?.name, qty });
    } else if (mode === 'buy') {
      const have = countInInventory(ch.inventory, entry.itemId?._id || entry.itemId);
      if (have < qty) return res.status(400).json({ error: '아이템이 부족합니다.' });
      if (!removeFromInventory(ch.inventory, entry.itemId?._id || entry.itemId, qty)) return res.status(500).json({ error: '차감 실패' });
      user.credits += totalPrice;
    } else if (mode === 'exchange') {
      const giveItemId = entry.exchange?.giveItemId?._id || entry.exchange?.giveItemId;
      const giveQty = Math.max(1, Number(entry.exchange?.giveQty || 1)) * qty;
      if (!giveItemId) return res.status(400).json({ error: '교환 항목이 올바르지 않습니다.' });
      const have = countInInventory(ch.inventory, giveItemId);
      if (have < giveQty) return res.status(400).json({ error: '교환 재료가 부족합니다.' });
      if (!removeFromInventory(ch.inventory, giveItemId, giveQty)) return res.status(500).json({ error: '교환 차감 실패' });
      addToInventory(ch.inventory, { itemId: entry.itemId?._id || entry.itemId, name: entry.itemId?.name, qty });
    } else {
      return res.status(400).json({ error: '지원하지 않는 mode 입니다.' });
    }

    ch.markModified('inventory');
    await Promise.all([ch.save(), user.save()]);

    res.json({ message: '거래 완료', credits: user.credits, character: ch });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '키오스크 거래 실패' });
  }
});

module.exports = router;
