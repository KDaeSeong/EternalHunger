// server/routes/kiosks.js
// 🏪 키오스크 거래(로드맵 3번)

const express = require('express');
const router = express.Router();

const Kiosk = require('../models/Kiosk');
const User = require('../models/User');
const Character = require('../models/Characters');
const Item = require('../models/Item');
const Perk = require('../models/Perk');
const { scopedFilter } = require('../utils/requestScope');
const { isKioskCatalogRowAllowed } = require('../../shared/marketItemPolicy.cjs');

const {
  buildItemNameMap,
  normalizeInventory,
  removeFromInventory,
  addToInventory,
  countInInventory,
} = require('../utils/inventory');
const { getOwnedPerkContext, applyDiscountedCost, applySaleBonus } = require('../utils/perkRuntime');
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
    const qty = parsePositiveQuantity(req.body?.qty);

    if (!characterId) return res.status(400).json({ error: 'characterId가 필요합니다.' });
    if (!Number.isFinite(idx) || idx < 0) return res.status(400).json({ error: 'catalogIndex가 올바르지 않습니다.' });
    if (qty === null) return res.status(400).json({ error: 'qty가 올바르지 않습니다.' });

    const result = await runMarketTransaction(User, async (session) => {
      const kiosk = await attachSession(
        Kiosk.findOne(scopedFilter(req, { _id: kioskId }))
          .populate([
            { path: 'catalog.itemId', options: { session }, ordered: true },
            { path: 'catalog.exchange.giveItemId', options: { session }, ordered: true },
          ]), session
      );
      if (!kiosk) throw marketError(404, '키오스크를 찾을 수 없습니다.');
      const user = await attachSession(User.findById(userId), session);
      if (!user) throw marketError(404, '유저를 찾을 수 없습니다.');
      const ch = await attachSession(Character.findOne({ _id: characterId, userId }), session);
      if (!ch) throw marketError(404, '캐릭터를 찾을 수 없습니다.');
      const items = await attachSession(Item.find(scopedFilter(req), '_id name'), session);

      const entry = kiosk.catalog?.[idx];
      if (!entry) throw marketError(404, 'catalog 항목을 찾을 수 없습니다.');
      if (!isKioskCatalogRowAllowed(entry)) throw marketError(400, '키오스크에서는 음식과 물을 거래할 수 없습니다.');

      const itemNameMap = buildItemNameMap(items);
      ch.inventory = normalizeInventory(ch.inventory, itemNameMap, { merge: true });
      const perkCtx = await getOwnedPerkContext(user, modelWithSession(Perk, session));
      const perkFx = perkCtx.effects || {};
      const mode = entry.mode || 'sell';
      const basePrice = Number(entry.priceCredits || 0);
      if (!Number.isFinite(basePrice)) throw marketError(400, '카탈로그 가격이 올바르지 않습니다.');
      const unitBuyPrice = applyDiscountedCost(Math.max(0, basePrice), perkFx.kioskDiscountPct, perkFx.marketDiscountPct);
      const unitSellPrice = applySaleBonus(Math.max(0, basePrice), perkFx.saleBonusPct);
      const totalPrice = (mode === 'buy' ? unitSellPrice : unitBuyPrice) * qty;
      if (!Number.isFinite(totalPrice) || totalPrice < 0 || totalPrice > Number.MAX_SAFE_INTEGER) {
        throw marketError(400, '거래 금액이 올바르지 않습니다.');
      }
      const entryItemId = entry.itemId?._id || entry.itemId;
      if (!entryItemId) throw marketError(400, '카탈로그 아이템이 비어 있습니다.');

      let creditDelta = 0;
      if (mode === 'sell') {
        creditDelta = -totalPrice;
        addToInventory(ch.inventory, { itemId: entryItemId, name: entry.itemId?.name, qty });
      } else if (mode === 'buy') {
        const have = countInInventory(ch.inventory, entryItemId);
        if (have < qty) throw marketError(400, '아이템이 부족합니다.');
        if (!removeFromInventory(ch.inventory, entryItemId, qty)) throw marketError(500, '차감 실패');
        creditDelta = totalPrice;
      } else if (mode === 'exchange') {
        const giveItemId = entry.exchange?.giveItemId?._id || entry.exchange?.giveItemId;
        const unitGiveQty = Number(entry.exchange?.giveQty || 1);
        const giveQty = Math.max(1, unitGiveQty) * qty;
        if (!giveItemId) throw marketError(400, '교환 항목이 올바르지 않습니다.');
        if (!Number.isFinite(unitGiveQty) || unitGiveQty > Number.MAX_SAFE_INTEGER
          || !Number.isFinite(giveQty) || giveQty <= 0 || giveQty > Number.MAX_SAFE_INTEGER) {
          throw marketError(400, '교환 수량이 올바르지 않습니다.');
        }
        const have = countInInventory(ch.inventory, giveItemId);
        if (have < giveQty) throw marketError(400, '교환 재료가 부족합니다.');
        if (!removeFromInventory(ch.inventory, giveItemId, giveQty)) throw marketError(500, '교환 차감 실패');
        addToInventory(ch.inventory, { itemId: entryItemId, name: entry.itemId?.name, qty });
      } else {
        throw marketError(400, '지원하지 않는 mode 입니다.');
      }

      const updatedUser = await applyCreditDelta(User, userId, creditDelta, session, '크레딧이 부족합니다.');
      ch.markModified('inventory');
      await ch.save({ session });
      return { message: '거래 완료', credits: updatedUser?.credits ?? user.credits, character: ch, perkEffects: perkFx };
    });

    res.json(result);
  } catch (err) {
    sendMarketError(res, err, '키오스크 거래 실패');
  }
});

module.exports = router;
