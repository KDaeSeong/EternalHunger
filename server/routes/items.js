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

const crypto = require('crypto');

function clampTier6(v) {
  const n = Math.floor(Number(v || 1));
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(6, Math.max(1, n));
}

function tierLabelKo6(tier) {
  const t = clampTier6(tier);
  if (t === 6) return '초월';
  if (t === 5) return '전설';
  if (t === 4) return '영웅';
  if (t === 3) return '희귀';
  if (t === 2) return '고급';
  return '일반';
}

function normalizeNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function normalizeStats(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    atk: normalizeNumber(s.atk, 0),
    def: normalizeNumber(s.def, 0),
    hp: normalizeNumber(s.hp, 0),
    skillAmp: normalizeNumber(s.skillAmp, 0),
    atkSpeed: normalizeNumber(s.atkSpeed, 0),
    critChance: normalizeNumber(s.critChance, 0),
    cdr: normalizeNumber(s.cdr, 0),
    lifesteal: normalizeNumber(s.lifesteal, 0),
    moveSpeed: normalizeNumber(s.moveSpeed, 0),
  };
}

function computeEstimatedValue(stats, tier) {
  // 너무 과하지 않게 "가격"만 보기 좋게 추정(관리자 표/거래 기본값)
  const t = clampTier6(tier);
  const s = stats || {};
  let v = 50 * t;
  v += Math.max(0, normalizeNumber(s.atk, 0)) * 6;
  v += Math.max(0, normalizeNumber(s.def, 0)) * 6;
  v += Math.max(0, normalizeNumber(s.hp, 0)) * 0.6;
  v += Math.max(0, normalizeNumber(s.skillAmp, 0)) * 600;
  v += Math.max(0, normalizeNumber(s.atkSpeed, 0)) * 400;
  v += Math.max(0, normalizeNumber(s.critChance, 0)) * 450;
  v += Math.max(0, normalizeNumber(s.cdr, 0)) * 350;
  v += Math.max(0, normalizeNumber(s.lifesteal, 0)) * 380;
  v += Math.max(0, normalizeNumber(s.moveSpeed, 0)) * 420;
  // 최소 1
  return Math.max(1, Math.round(v));
}

function makeExternalIdFallback(payload) {
  // itemId가 없는 데이터(혹시 모를 케이스)에도 저장 가능하도록 시그니처 생성
  const base = {
    name: String(payload?.name || payload?.text || ''),
    equipSlot: String(payload?.equipSlot || ''),
    weaponType: String(payload?.weaponType || ''),
    tier: clampTier6(payload?.tier || 1),
    stats: normalizeStats(payload?.stats),
  };
  const h = crypto.createHash('sha1').update(JSON.stringify(base)).digest('hex').slice(0, 18);
  return `sim_${h}`;
}

function normalizeSimEquipmentToItemDoc(raw, userId) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const externalIdRaw = String(src.itemId || src.id || '').trim();
  const externalId = externalIdRaw || makeExternalIdFallback(src);

  const equipSlot = String(src.equipSlot || '').trim();
  const weaponType = String(src.weaponType || '').trim();
  const archetype = String(src.archetype || '').trim();

  const tier = clampTier6(src.tier || 1);
  const rarity = String(src.rarity || src.grade || '').trim() || tierLabelKo6(tier);

  const name = String(src.name || src.text || '').trim() || `${rarity} 장비`;

  const tags = Array.isArray(src.tags) ? src.tags.map((t) => String(t).trim()).filter(Boolean) : [];
  // 시뮬 생성물 표기
  tags.push('simulation', 'generated');

  // type 보정: equipmentCatalog는 weapon이면 type='weapon'(영문)이라 enum에 안 맞음
  const rawType = String(src.type || '').trim().toLowerCase();
  const type = (equipSlot === 'weapon' || rawType === 'weapon' || rawType === '무기') ? '무기' : '방어구';

  const stats = normalizeStats(src.stats);
  const value = computeEstimatedValue(stats, tier);

  // description은 간단히(검색/디버그용)
  const lines = [];
  if (equipSlot) lines.push(`slot:${equipSlot}`);
  if (weaponType) lines.push(`weaponType:${weaponType}`);
  if (archetype) lines.push(`archetype:${archetype}`);
  const description = lines.join(' | ');

  return {
    externalId,
    name,
    type,
    tags: [...new Set(tags)],
    rarity,
    tier,
    stackMax: 1,
    value,
    baseCreditValue: value,
    stats,
    equipSlot,
    weaponType,
    archetype,
    source: 'simulation',
    generatedByUserId: userId,
    generatedAt: new Date(),
    description,
  };
}

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

/**
 * POST /api/items/ingest-sim-equipments
 * body: { items: any[] }
 * - 시뮬레이션에서 랜덤 생성된 장비를 Item 컬렉션에 저장(또는 externalId 기준 upsert)
 * - 인증: verifyToken(/api/items 라우터 공통)
 */
router.post('/ingest-sim-equipments', async (req, res) => {
  try {
    const userId = req.user?.id;
    const list = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!list.length) return res.json({ message: 'no-op', savedCount: 0, items: [] });

    // 안전장치: 한 번에 너무 많이 넣지 않기(폭주 방지)
    const limited = list.slice(0, 120);

    const saved = [];
    let skippedLockedCount = 0;

    for (const raw of limited) {
      const doc = normalizeSimEquipmentToItemDoc(raw, userId);

      // ✅ 관리자 잠금된 아이템은 시뮬 업서트가 덮어쓰지 않도록 스킵
      const existing = await Item.findOne({ externalId: doc.externalId });
      if (existing && existing.lockedByAdmin === true) {
        skippedLockedCount += 1;
        saved.push(existing);
        continue;
      }

      // externalId로 upsert
      const it = await Item.findOneAndUpdate(
        { externalId: doc.externalId },
        { $set: doc, $setOnInsert: { createdAt: new Date() } },
        { upsert: true, new: true }
      );
      saved.push(it);
    }

    res.json({ message: 'ok', savedCount: saved.length, skippedLockedCount, items: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '시뮬 장비 저장 실패' });
  }
});

module.exports = router;
