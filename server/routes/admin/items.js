const express = require('express');
const router = express.Router();
const Item = require('../../models/Item');
const Character = require('../../models/Characters');
const MapModel = require('../../models/Map');
const Kiosk = require('../../models/Kiosk');
const TradeOffer = require('../../models/TradeOffer');
const DroneOffer = require('../../models/DroneOffer');
const { requireUserId, ownedFilter, withOwner } = require('../../utils/requestScope');
const { upsertDefaultItemTree, upsertDefaultItemTreeBatch } = require('../../utils/defaultItemTree');

function scope(req, res, extra = {}) {
  const userId = requireUserId(req, res);
  if (!userId) return null;
  return ownedFilter(userId, extra);
}

router.get('/items', async (req, res) => {
    try {
        const filter = scope(req, res);
        if (!filter) return;
        const items = await Item.find(filter).sort({ createdAt: -1 }).lean();
        res.json(items);
    } catch (err) { 
        res.status(500).json({ error: "아이템 로드 실패" }); 
    }
});

// 2. 아이템 추가하기 (POST /api/admin/items)
router.post('/items', async (req, res) => {
    try {
        const userId = requireUserId(req, res);
        if (!userId) return;
        const newItem = new Item(withOwner(userId, req.body));
        await newItem.save();
        res.json({ message: "아이템이 성공적으로 추가되었습니다.", item: newItem });
    } catch (err) { 
        res.status(500).json({ error: "아이템 저장 실패" }); 
    }
});

// 아이템 삭제하기
router.delete('/items/:id', async (req, res) => {
    try {
        const filter = scope(req, res, { _id: req.params.id });
        if (!filter) return;
        const result = await Item.deleteOne(filter);
        if (Number(result?.deletedCount || 0) < 1) return res.status(404).json({ error: "아이템을 찾을 수 없습니다." });
        res.json({ message: "아이템이 삭제되었습니다.", deletedCount: 1, id: String(req.params.id || '') });
    } catch (err) { res.status(500).json({ error: "삭제 실패" }); }
});

function nonNamuItemQuery() {
  const namuPrefix = /^namu:/;
  const notNamuField = (field) => ({
    $or: [
      { [field]: { $exists: false } },
      { [field]: null },
      { [field]: '' },
      { [field]: { $not: namuPrefix } },
    ],
  });

  return {
    $and: [
      notNamuField('itemKey'),
      notNamuField('externalId'),
    ],
  };
}

function normalizeItemIdentity(item) {
  const key = String(item?.itemKey || '').trim();
  const externalId = String(item?.externalId || '').trim();
  return key || externalId;
}

function itemCompletenessScore(item) {
  let score = 0;
  if (item?.lockedByAdmin) score += 1000;
  const recipeCount = Array.isArray(item?.recipe?.ingredients) ? item.recipe.ingredients.length : 0;
  if (recipeCount > 0) score += 500 + Math.min(recipeCount, 20);
  if (item?.externalId) score += 50;
  if (item?.description) score += 20;
  if (item?.image) score += 20;
  score += Math.min(Array.isArray(item?.tags) ? item.tags.length : 0, 20);
  score += Math.min(Array.isArray(item?.spawnZones) ? item.spawnZones.length : 0, 20);
  score += Math.min(Array.isArray(item?.spawnCrateTypes) ? item.spawnCrateTypes.length : 0, 20);
  const stats = item?.stats && typeof item.stats === 'object' ? item.stats : {};
  score += Object.values(stats).filter((v) => Number(v) !== 0).length;
  const createdAt = item?.createdAt ? new Date(item.createdAt).getTime() : 0;
  if (Number.isFinite(createdAt)) score += createdAt / 100000000000000;
  return score;
}

function mergeItemPatch(canonical, duplicate) {
  const patch = {};
  const mergeArray = (field) => {
    const a = Array.isArray(canonical?.[field]) ? canonical[field] : [];
    const b = Array.isArray(duplicate?.[field]) ? duplicate[field] : [];
    const merged = [...new Set([...a, ...b].map((v) => String(v || '').trim()).filter(Boolean))];
    if (merged.length !== a.length) patch[field] = merged;
  };

  mergeArray('tags');
  mergeArray('spawnZones');
  mergeArray('spawnCrateTypes');
  mergeArray('upgradeItemKeys');

  if (!canonical?.description && duplicate?.description) patch.description = duplicate.description;
  if (!canonical?.image && duplicate?.image) patch.image = duplicate.image;
  if (!canonical?.externalId && duplicate?.externalId) patch.externalId = duplicate.externalId;
  if (!canonical?.equipSlot && duplicate?.equipSlot) patch.equipSlot = duplicate.equipSlot;
  if (!canonical?.weaponType && duplicate?.weaponType) patch.weaponType = duplicate.weaponType;
  if (!canonical?.archetype && duplicate?.archetype) patch.archetype = duplicate.archetype;
  if (!(Number(canonical?.droneCreditsCost) > 0) && Number(duplicate?.droneCreditsCost) > 0) {
    patch.droneCreditsCost = Number(duplicate.droneCreditsCost);
  }

  const canonicalRecipeCount = Array.isArray(canonical?.recipe?.ingredients) ? canonical.recipe.ingredients.length : 0;
  const duplicateRecipeCount = Array.isArray(duplicate?.recipe?.ingredients) ? duplicate.recipe.ingredients.length : 0;
  if (canonicalRecipeCount === 0 && duplicateRecipeCount > 0) patch.recipe = duplicate.recipe;

  return patch;
}

async function replaceDuplicateItemRefs(userId, fromId, toId) {
  const fromStr = String(fromId);
  const ops = [
    Item.updateMany(
      { ownerUserId: userId, 'recipe.ingredients.itemId': fromId },
      { $set: { 'recipe.ingredients.$[e].itemId': toId } },
      { arrayFilters: [{ 'e.itemId': fromId }] }
    ),
    Character.updateMany(
      { userId, 'inventory.itemId': fromId },
      { $set: { 'inventory.$[e].itemId': toId } },
      { arrayFilters: [{ 'e.itemId': fromId }] }
    ),
    Character.updateMany(
      { userId, 'inventory.itemId': fromStr },
      { $set: { 'inventory.$[e].itemId': toId } },
      { arrayFilters: [{ 'e.itemId': fromStr }] }
    ),
    MapModel.updateMany(
      { ownerUserId: userId, 'itemCrates.lootTable.itemId': fromId },
      { $set: { 'itemCrates.$[].lootTable.$[e].itemId': toId } },
      { arrayFilters: [{ 'e.itemId': fromId }] }
    ),
    Kiosk.updateMany(
      { ownerUserId: userId, 'catalog.itemId': fromId },
      { $set: { 'catalog.$[e].itemId': toId } },
      { arrayFilters: [{ 'e.itemId': fromId }] }
    ),
    Kiosk.updateMany(
      { ownerUserId: userId, 'catalog.exchange.giveItemId': fromId },
      { $set: { 'catalog.$[e].exchange.giveItemId': toId } },
      { arrayFilters: [{ 'e.exchange.giveItemId': fromId }] }
    ),
    DroneOffer.updateMany({ ownerUserId: userId, itemId: fromId }, { $set: { itemId: toId } }),
    TradeOffer.updateMany(
      { fromUserId: userId, 'give.itemId': fromId },
      { $set: { 'give.$[e].itemId': toId } },
      { arrayFilters: [{ 'e.itemId': fromId }] }
    ),
    TradeOffer.updateMany(
      { fromUserId: userId, 'want.itemId': fromId },
      { $set: { 'want.$[e].itemId': toId } },
      { arrayFilters: [{ 'e.itemId': fromId }] }
    ),
  ];

  const results = await Promise.allSettled(ops);
  return results.reduce((sum, result) => {
    if (result.status !== 'fulfilled') return sum;
    return sum + Number(result.value?.modifiedCount || 0);
  }, 0);
}

// 현재 계정 아이템 중 itemKey/externalId 어디에도 namu: prefix가 없는 항목 일괄 삭제
router.post('/items/delete-non-namu', async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, Math.floor(Number(req.body?.limit || 200))));
    const dryRun = req.body?.dryRun === true;
    const filter = scope(req, res, nonNamuItemQuery());
    if (!filter) return;

    const targets = await Item.find(filter)
      .select('_id itemKey externalId name')
      .sort({ _id: 1 })
      .limit(limit)
      .lean();

    if (dryRun) {
      const total = await Item.countDocuments(filter);
      return res.json({
        message: 'namu: 외 아이템 삭제 대상 확인 완료',
        summary: {
          dryRun: true,
          matchedCount: total,
          batchCount: targets.length,
          done: targets.length >= total,
          targets: targets.slice(0, 50).map((item) => ({
            id: String(item._id),
            itemKey: String(item.itemKey || ''),
            externalId: String(item.externalId || ''),
            name: String(item.name || ''),
          })),
        },
      });
    }

    if (!targets.length) {
      return res.json({
        message: 'namu: 외 아이템 삭제 완료',
        summary: { deletedCount: 0, done: true, targets: [] },
      });
    }

    const ids = targets.map((item) => item._id);
    const result = await Item.deleteMany({ _id: { $in: ids } });
    res.json({
      message: 'namu: 외 아이템 배치 삭제 완료',
      summary: {
        deletedCount: Number(result?.deletedCount || 0),
        done: targets.length < limit,
        targets: targets.slice(0, 50).map((item) => ({
          id: String(item._id),
          itemKey: String(item.itemKey || ''),
          externalId: String(item.externalId || ''),
          name: String(item.name || ''),
        })),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'namu: 외 아이템 삭제 실패' });
  }
});

// 현재 계정 아이템 중 같은 itemKey/externalId를 가진 항목을 1개로 통합
router.post('/items/dedupe', async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const rawPrefix = String(req.body?.prefix ?? 'namu:').trim();
    const prefix = rawPrefix && rawPrefix.toLowerCase() !== 'all' ? rawPrefix : '';
    const limitGroups = Math.min(200, Math.max(1, Math.floor(Number(req.body?.limitGroups || 50))));
    const dryRun = req.body?.dryRun === true;

    const items = await Item.find(ownedFilter(userId))
      .select('_id itemKey externalId name tags recipe stats equipSlot weaponType archetype spawnZones spawnCrateTypes upgradeItemKeys droneCreditsCost lockedByAdmin description image createdAt')
      .sort({ _id: 1 })
      .lean();

    const groups = new Map();
    for (const item of items) {
      const identity = normalizeItemIdentity(item);
      if (!identity) continue;
      if (prefix && !identity.startsWith(prefix)) continue;
      if (!groups.has(identity)) groups.set(identity, []);
      groups.get(identity).push(item);
    }

    const duplicateGroups = [...groups.entries()]
      .filter(([, list]) => list.length > 1)
      .sort((a, b) => a[0].localeCompare(b[0], 'ko'));
    const targets = duplicateGroups.slice(0, limitGroups);
    let deletedCount = 0;
    let referenceUpdatedCount = 0;
    let mergedCount = 0;
    const samples = [];

    for (const [identity, list] of targets) {
      const sorted = [...list].sort((a, b) => itemCompletenessScore(b) - itemCompletenessScore(a));
      const canonical = sorted[0];
      const duplicates = sorted.slice(1);
      const duplicateIds = duplicates.map((item) => item._id);

      samples.push({
        key: identity,
        keepId: String(canonical._id),
        deleteIds: duplicateIds.map(String),
        name: String(canonical.name || ''),
      });

      if (dryRun) continue;

      let canonicalDoc = await Item.findOne(ownedFilter(userId, { _id: canonical._id }));
      if (canonicalDoc) {
        for (const duplicate of duplicates) {
          const patch = mergeItemPatch(canonicalDoc.toObject(), duplicate);
          if (Object.keys(patch).length) {
            await Item.updateOne(ownedFilter(userId, { _id: canonical._id }), { $set: patch });
            mergedCount += 1;
            canonicalDoc = await Item.findOne(ownedFilter(userId, { _id: canonical._id }));
            if (!canonicalDoc) break;
          }
        }
      }

      for (const duplicate of duplicates) {
        referenceUpdatedCount += await replaceDuplicateItemRefs(userId, duplicate._id, canonical._id);
      }

      const result = await Item.deleteMany(ownedFilter(userId, { _id: { $in: duplicateIds } }));
      deletedCount += Number(result?.deletedCount || 0);
    }

    res.json({
      message: dryRun ? '아이템 중복 정리 대상 확인 완료' : '아이템 중복 정리 완료',
      summary: {
        dryRun,
        prefix: prefix || 'all',
        duplicateGroupCount: duplicateGroups.length,
        processedGroupCount: targets.length,
        deletedCount,
        mergedCount,
        referenceUpdatedCount,
        done: duplicateGroups.length <= limitGroups,
        samples: samples.slice(0, 30),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '아이템 중복 정리 실패' });
  }
});

// =========================
// ✅ 아이템 수정(로드맵 1-1)
// PUT /api/admin/items/:id
router.put('/items/:id', async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const updated = await Item.findOneAndUpdate(ownedFilter(userId, { _id: req.params.id }), withOwner(userId, req.body), { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    res.json({ message: '아이템이 수정되었습니다.', item: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '수정 실패' });
  }
});

// =========================
// ✅ 맵 수정/삭제(로드맵 2번)

router.post('/items/generate-default-tree', async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const rawMode = String(req.body?.mode || 'missing').trim().toLowerCase();
    const mode = rawMode === 'replace' ? 'replace' : rawMode === 'force' || rawMode === 'overwrite' ? 'force' : 'missing';
    if (req.body?.batch === true || req.body?.phase) {
      const phase = String(req.body?.phase || 'items').trim().toLowerCase();
      const offset = Math.max(0, Math.floor(Number(req.body?.offset || 0)));
      const limit = Math.min(250, Math.max(1, Math.floor(Number(req.body?.limit || 100))));
      const summary = await upsertDefaultItemTreeBatch({ mode, ownerUserId: userId, phase, offset, limit });
      return res.json({ message: '기본 아이템 트리 배치 적용 완료', summary });
    }
    const summary = await upsertDefaultItemTree({ mode, ownerUserId: userId });
    res.json({ message: '기본 아이템 트리 적용 완료', summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '기본 아이템 트리 적용 실패' });
  }
});

module.exports = router;
