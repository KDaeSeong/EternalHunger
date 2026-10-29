// server/routes/drone.js
// 🚁 전송 드론 구매(로드맵 4번)

const express = require('express');
const router = express.Router();

const DroneOffer = require('../models/DroneOffer');
const User = require('../models/User');
const Character = require('../models/Characters');
const Item = require('../models/Item');
const Perk = require('../models/Perk');
const { scopedFilter } = require('../utils/requestScope');
const { isMarketItemAllowed } = require('../../shared/marketItemPolicy.cjs');

const {
  buildItemNameMap,
  normalizeInventory,
  addToInventory,
} = require('../utils/inventory');
const { getOwnedPerkContext, applyDiscountedCost } = require('../utils/perkRuntime');
const {
  applyCreditDelta,
  attachSession,
  marketError,
  modelWithSession,
  parsePositiveQuantity,
  runMarketTransaction,
  sendMarketError,
} = require('../utils/marketTransaction');

/**
 * POST /api/drone/buy
 * body: { characterId, offerId, qty }
 */
router.post('/buy', async (req, res) => {
  try {
    const userId = req.user.id;
    const { characterId, offerId } = req.body || {};
    const qty = parsePositiveQuantity(req.body?.qty);

    if (!characterId || !offerId) return res.status(400).json({ error: 'characterId, offerId가 필요합니다.' });
    if (qty === null) return res.status(400).json({ error: 'qty가 올바르지 않습니다.' });

    const result = await runMarketTransaction(User, async (session) => {
      const user = await attachSession(User.findById(userId), session);
      if (!user) throw marketError(404, '유저를 찾을 수 없습니다.');
      const ch = await attachSession(Character.findOne({ _id: characterId, userId }), session);
      if (!ch) throw marketError(404, '캐릭터를 찾을 수 없습니다.');
      const offer = await attachSession(
        DroneOffer.findOne(scopedFilter(req, { _id: offerId })).populate('itemId'), session
      );
      if (!offer || !offer.isActive) throw marketError(404, '판매 항목을 찾을 수 없습니다.');
      const items = await attachSession(Item.find(scopedFilter(req), '_id name'), session);

      const item = offer.itemId;
      if (!item) throw marketError(404, '아이템 정보를 찾을 수 없습니다.');
      if (!isMarketItemAllowed(item, 'drone')) throw marketError(400, '전송 드론은 물을 제외한 음식을 판매하지 않습니다.');
      if (Number(item.tier || 1) > Number(offer.maxTier || 1)) throw marketError(400, '티어 제한으로 구매할 수 없습니다.');

      const perkCtx = await getOwnedPerkContext(user, modelWithSession(Perk, session));
      const perkFx = perkCtx.effects || {};
      const basePrice = Number(offer.priceCredits || 0);
      if (!Number.isFinite(basePrice)) throw marketError(400, '판매 가격이 올바르지 않습니다.');
      const price = applyDiscountedCost(Math.max(0, basePrice), perkFx.droneDiscountPct, perkFx.marketDiscountPct);
      const total = price * qty;
      if (!Number.isFinite(total) || total < 0 || total > Number.MAX_SAFE_INTEGER) {
        throw marketError(400, '구매 금액이 올바르지 않습니다.');
      }

      const itemNameMap = buildItemNameMap(items);
      ch.inventory = normalizeInventory(ch.inventory, itemNameMap, { merge: true });
      addToInventory(ch.inventory, { itemId: item._id, name: item.name, qty });

      const updatedUser = await applyCreditDelta(User, userId, -total, session, '크레딧이 부족합니다.');
      ch.markModified('inventory');
      await ch.save({ session });
      return { message: '구매 완료', credits: updatedUser?.credits ?? user.credits, character: ch, perkEffects: perkFx };
    });

    res.json(result);
  } catch (err) {
    sendMarketError(res, err, '드론 구매 실패');
  }
});

module.exports = router;
