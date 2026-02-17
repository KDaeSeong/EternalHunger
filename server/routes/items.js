// server/routes/items.js
// 아이템 관련 행동 API
// - 조합(craft)

const express = require('express');
const router = express.Router();

function clampTier4(v) {
  const n = Math.floor(Number(v || 1));
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(4, Math.max(1, n));
}

function tierLabelKo(tier) {
  const t = clampTier4(tier);
  if (t === 4) return '초월';
  if (t === 3) return '전설';
  if (t === 2) return '영웅';
  return '일반';
}

function classifySpecialByName(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('vf') && (n.includes('blood') || n.includes('혈액'))) return 'vf';
  if (n.includes('운석') || n.includes('meteor')) return 'meteor';
  if (n.includes('생명의 나무') || n.includes('life tree') || n.includes('tree of life')) return 'life_tree';
  if (n.includes('미스릴') || n.includes('mithril')) return 'mithril';
  if ((n.includes('포스') && n.includes('코어')) || n.includes('force core')) return 'force_core';
  return null;
}

function isSpecialCoreKind(kind) {
  return kind === 'meteor' || kind === 'life_tree' || kind === 'mithril' || kind === 'force_core';
}

function isEquipmentItem(item) {
  const t = String(item?.type || '');
  const tags = Array.isArray(item?.tags) ? item.tags : [];
  if (t.includes('무기') || t.includes('방어') || t.includes('장비')) return true;
  if (tags.includes('weapon') || tags.includes('armor') || tags.includes('equipment')) return true;
  return false;
}

function computeCraftTierFromIngredientItems(ingredientItems) {
  const arr = Array.isArray(ingredientItems) ? ingredientItems : [];
  let hasVf = false;
  let hasLegendaryMat = false;
  let hasEquip = false;

  for (const it of arr) {
    const kind = classifySpecialByName(it?.name);
    if (kind === 'vf') hasVf = true;
    if (isSpecialCoreKind(kind)) hasLegendaryMat = true;
    if (isEquipmentItem(it)) hasEquip = true;
  }

  if (hasVf) return 4;
  if (hasLegendaryMat) return 3;
  if (hasEquip) return 2;
  return 1;
}

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
      Item.find({}, '_id name tags type tier'),
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
    const itemMetaMap = {};
    for (const it of (Array.isArray(items) ? items : [])) {
      if (!it?._id) continue;
      itemMetaMap[String(it._id)] = { name: it.name, type: it.type, tags: it.tags, tier: clampTier4(it.tier || 1) };
    }
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
    const ingredientItems = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])      .map((ing) => itemMetaMap[String(ing?.itemId || '')])      .filter(Boolean);

    const isEquip = isEquipmentItem(resultItem);
    let craftedTier = clampTier4(resultItem?.tier || 1);
    let craftedRarity;
    if (isEquip) {
      craftedTier = computeCraftTierFromIngredientItems(ingredientItems);
      craftedRarity = tierLabelKo(craftedTier);
    }

    addToInventory(ch.inventory, { itemId: resultItem._id, name: resultItem.name, qty: give, tags: resultItem.tags, type: resultItem.type, tier: craftedTier, rarity: craftedRarity });

    ch.markModified('inventory');
    await ch.save();

    res.json({ message: '조합 성공', credits: user.credits, character: ch });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '조합 실패' });
  }
});

module.exports = router;
