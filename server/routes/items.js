// server/routes/items.js
// 아이템 관련 행동 API
// - 조합(craft)

const express = require('express');
const router = express.Router();

const Item = require('../models/Item');
const User = require('../models/User');
const Character = require('../models/Characters');

const {
  buildItemNameMap,
  normalizeInventory,
  removeFromInventory,
  addToInventory,
  countInInventory,
} = require('../utils/inventory');

/**
 * POST /api/items/craft
 * body: { characterId, itemId, qty }
 * - itemId: '결과 아이템' id
 */
router.post('/craft', async (req, res) => {
  try {
    const userId = req.user.id;
    const characterId = req.body?.characterId;
    const resultItemId = req.body?.itemId;
    const qty = Number(req.body?.qty || 1);

    if (!characterId || !resultItemId) return res.status(400).json({ error: 'characterId, itemId가 필요합니다.' });
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'qty가 올바르지 않습니다.' });

    const [user, ch, resultItem, items] = await Promise.all([
      User.findById(userId),
      Character.findOne({ _id: characterId, userId }),
      Item.findById(resultItemId),
      Item.find({}, '_id name tags type'),
    ]);

    if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    if (!ch) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다.' });
    if (!resultItem) return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });

    const recipe = resultItem.recipe;
    if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
      return res.status(400).json({ error: '이 아이템은 조합 레시피가 없습니다.' });
    }

    // inventory 정규화(안전)
    const itemNameMap = buildItemNameMap(items);
    ch.inventory = normalizeInventory(ch.inventory, itemNameMap, { merge: true });

    // 재료 체크
    for (const ing of recipe.ingredients) {
      const need = Number(ing.qty || 1) * qty;
      const have = countInInventory(ch.inventory, ing.itemId);
      if (have < need) {
        return res.status(400).json({ error: `재료 부족: ${String(ing.itemId)} (${have}/${need})` });
      }
    }

    // 크레딧 체크/차감
    const cost = Number(recipe.creditsCost || 0) * qty;
    if (cost > 0) {
      if (Number(user.credits || 0) < cost) return res.status(400).json({ error: '크레딧이 부족합니다.' });
      user.credits -= cost;
      await user.save();
    }

    // 재료 차감
    for (const ing of recipe.ingredients) {
      const need = Number(ing.qty || 1) * qty;
      const ok = removeFromInventory(ch.inventory, ing.itemId, need);
      if (!ok) return res.status(500).json({ error: '재료 차감 중 오류' });
    }

    // 결과 지급
    const give = Number(recipe.resultQty || 1) * qty;
    addToInventory(ch.inventory, { itemId: resultItem._id, name: resultItem.name, qty: give, tags: resultItem.tags, type: resultItem.type });

    ch.markModified('inventory');
    await ch.save();

    res.json({ message: '조합 성공', credits: user.credits, character: ch });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '조합 실패' });
  }
});

module.exports = router;
