const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Item = require('../models/Item'); // ★ 아이템 모델 추가!
const Character = require('../models/Characters');
const MapModel = require('../models/Map');
const Kiosk = require('../models/Kiosk');
const TradeOffer = require('../models/TradeOffer');
const DroneOffer = require('../models/DroneOffer');
const { DEFAULT_ZONES, DEFAULT_ZONE_IDS, DEFAULT_ZONE_DEFS, KIOSK_MAP_NAMES, canonicalZoneId, normalizeZoneList } = require('../utils/defaultZones');
const { buildDefaultZoneConnections } = require('../utils/defaultZoneConnections');
const { upsertDefaultItemTree, upsertDefaultItemTreeBatch } = require('../utils/defaultItemTree');

// ★ [수정 1] 미들웨어를 정확한 경로에서 불러옵니다.
// (방금 authMiddleware.js를 만들었다면 이 경로가 맞습니다)
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const { requireUserId, ownedFilter, withOwner } = require('../utils/requestScope');
const adminDroneOfferRoutes = require('./admin/droneOffers');
const adminPerkRoutes = require('./admin/perks');

// ★ [수정 2] 이 라우터의 '모든' 요청에 대해 문지기 2명을 세웁니다.
// 순서: 1차(로그인 확인) -> 2차(관리자 확인)
// 이제 개별 라우트마다 verifyAdmin을 또 적을 필요가 없습니다.
router.use(verifyToken, verifyAdmin);
router.use('/drone-offers', adminDroneOfferRoutes);
router.use('/perks', adminPerkRoutes);

function scope(req, res, extra = {}) {
  const userId = requireUserId(req, res);
  if (!userId) return null;
  return ownedFilter(userId, extra);
}


// 1. 모든 유저 LP 초기화 (시즌 초기화)
router.post('/reset-lp', async (req, res) => {
    try {
        await User.updateMany({}, { lp: 0 });
        console.log(`[Admin] ${req.user.username}님이 시즌을 초기화했습니다.`);
        res.json({ message: "모든 유저의 LP가 0으로 초기화되었습니다." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. 특정 유저에게 LP 선물하기 (이벤트)
router.post('/give-lp', async (req, res) => {
    const { username, amount } = req.body;
    try {
        const user = await User.findOneAndUpdate(
            { username }, 
            { $inc: { lp: amount } },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({ error: "유저를 찾을 수 없습니다." });
        }

        console.log(`[Admin] ${username}님에게 ${amount} LP 지급`);
        res.json({ message: `${username}님에게 ${amount} LP 지급 완료!`, currentLp: user.lp });
    } catch (err) {
        res.status(500).json({ error: "서버 오류" });
    }
});

// 1. 새 아이템 생성
// 모든 아이템 목록 가져오기 (관리용)
// 1. 아이템 목록 가져오기 (GET /api/admin/items)
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

// 1. 모든 구역 목록 로드
router.get('/maps', async (req, res) => {
    try {
        const filter = scope(req, res);
        if (!filter) return;
        const maps = await MapModel.find(filter).populate('connectedMaps', 'name').lean(); // 연결된 맵 이름까지 가져옴
        res.json((Array.isArray(maps) ? maps : []).map((map) => ({
          ...map,
          zones: normalizeZoneList(map?.zones),
        })));
    } catch (err) { res.status(500).json({ error: "맵 로드 실패" }); }
});

// ✅ 맵 목록 정리(운영 편의)
// POST /api/admin/maps/normalize-list
// - 구역 이름으로 잘못 생성된 레거시 맵 삭제
// - 소방서/경찰서 맵이 없으면 기본 zones 포함으로 자동 생성
router.post('/maps/normalize-list', async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const result = await ensureDefaultLumiaMap(userId, { force: true, cleanupLegacy: true });
    const currentCount = await MapModel.countDocuments(ownedFilter(userId));

    res.json({
      message: '루미아 섬 기본 맵 정리 완료',
      mapId: String(result?.map?._id || ''),
      mapName: String(result?.map?.name || DEFAULT_LUMIA_MAP_NAME),
      currentMapCount: currentCount,
      zoneCount: Array.isArray(result?.map?.zones) ? result.map.zones.length : DEFAULT_ZONES.length,
      created: Boolean(result?.created),
      updated: Boolean(result?.updated),
      migrated: Boolean(result?.migrated),
      deletedLegacyCount: Number(result?.deletedLegacyCount || 0),
      deletedLegacyNames: result?.deletedLegacyNames || [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '맵 목록 정리 실패' });
  }
});

// 2. 새로운 구역 생성
router.post('/maps', async (req, res) => {
    try {
        const userId = requireUserId(req, res);
        if (!userId) return;
        // ✅ zones를 비워서 생성하면, 기본 구역(키오스크/일반 구역) 세트를 자동으로 넣어줍니다.
        // - 관리자 화면에서 맵을 만들 때 '기본 맵 구역'을 빠르게 세팅하기 위함
        const payload = { ...(req.body || {}) };
        if (!Array.isArray(payload.zones) || payload.zones.length === 0) {
            // ✅ zones 순차번호(zoneNo)까지 포함해서 주입
            payload.zones = cloneDefaultZones();
        } else {
            // ✅ 커스텀 zones라도 zoneNo가 비어있으면 1..N으로 채워줌
            payload.zones = normalizeZoneList(payload.zones).map((z, idx) => ({
              ...(z || {}),
              zoneNo: Number.isFinite(Number(z?.zoneNo)) ? Number(z.zoneNo) : (idx + 1),
            }));
        }
        // 🌠 자연 코어 스폰 허용 구역(zoneId 배열)도 함께 세팅(미지정 시 zones.coreSpawn 기준)
        if (!Array.isArray(payload.coreSpawnZones) || payload.coreSpawnZones.length === 0) {
            payload.coreSpawnZones = coreSpawnZoneIdsFromZones(payload.zones);
        }

        // 🧭 기본 존 동선(인접 그래프)도 함께 세팅(미지정 시 기본 프리셋)
        if (!Array.isArray(payload.zoneConnections) || payload.zoneConnections.length === 0) {
            const zoneIds = (Array.isArray(payload.zones) ? payload.zones : [])
              .map((z) => String(z?.zoneId || '').trim())
              .filter(Boolean);
            payload.zoneConnections = buildDefaultZoneConnections(zoneIds);
        }
        const newMap = new MapModel(withOwner(userId, payload));
        await newMap.save();
        res.json({ message: "신규 구역이 생성되었습니다.", map: newMap });
    } catch (err) { res.status(500).json({ error: "구역 생성 실패" }); }
});

// =========================
// ✅ 기존 맵에 '기본 맵 구역' 세트 일괄 적용
// POST /api/admin/maps/apply-default-zones
// body: { mode: 'missing' | 'force', mapIds?: string[] }
// - missing: zones가 비어있는 맵에만 적용(기본)
// - force: 기존 zones가 있어도 강제 덮어쓰기(주의)
function cloneDefaultZones() {
  // DEFAULT_ZONES는 상수이므로, bulkWrite에서 안전하게 쓰기 위해 매번 깊은 복사를 만들어줍니다.
  return (Array.isArray(DEFAULT_ZONES) ? DEFAULT_ZONES : []).map((z, idx) => ({
    zoneNo: idx + 1,
    zoneId: String(z?.zoneId || ''),
    name: String(z?.name || ''),
    polygon: (Array.isArray(z?.polygon) ? z.polygon : []).map((p) => ({
      x: Number(p?.x || 0),
      y: Number(p?.y || 0),
    })),
    isForbidden: Boolean(z?.isForbidden),
    hasKiosk: Boolean(z?.hasKiosk),
    coreSpawn: Boolean(z?.coreSpawn),
  }));
}

function coreSpawnZoneIdsFromZones(zones) {
  const list = Array.isArray(zones) ? zones : [];
  return list
    .filter((z) => z && z.coreSpawn === true)
    .map((z) => canonicalZoneId(z.zoneId))
    .filter(Boolean);
}

const DEFAULT_LUMIA_MAP_NAME = '루미아 섬';
const DEFAULT_ZONE_ID_SET = new Set(Array.isArray(DEFAULT_ZONE_IDS) ? DEFAULT_ZONE_IDS.map(String) : []);
const DEFAULT_ZONE_NAME_SET = new Set((Array.isArray(DEFAULT_ZONE_DEFS) ? DEFAULT_ZONE_DEFS : []).map((z) => String(z?.name || '')).filter(Boolean));
const KIOSK_ZONE_ID_SET = new Set((Array.isArray(DEFAULT_ZONES) ? DEFAULT_ZONES : []).filter((z) => z?.hasKiosk).map((z) => String(z?.zoneId || '')).filter(Boolean));

function defaultZoneCoverage(zones) {
  const ids = new Set((Array.isArray(zones) ? zones : []).map((z) => canonicalZoneId(z?.zoneId)).filter(Boolean));
  let covered = 0;
  for (const id of DEFAULT_ZONE_ID_SET) {
    if (ids.has(id)) covered += 1;
  }
  return covered;
}

function looksLikeLegacyZoneNamedDefaultMap(mapDoc) {
  const name = String(mapDoc?.name || '').trim();
  if (!DEFAULT_ZONE_NAME_SET.has(name)) return false;
  return defaultZoneCoverage(mapDoc?.zones) >= Math.min(18, DEFAULT_ZONE_ID_SET.size);
}

function sameObjectId(a, b) {
  return String(a || '') === String(b || '');
}

function defaultMapPatch() {
  const dz = cloneDefaultZones();
  const zoneIds = dz.map((z) => String(z?.zoneId || '').trim()).filter(Boolean);
  return {
    name: DEFAULT_LUMIA_MAP_NAME,
    zones: dz,
    coreSpawnZones: coreSpawnZoneIdsFromZones(dz),
    zoneConnections: buildDefaultZoneConnections(zoneIds),
  };
}

async function ensureDefaultLumiaMap(userId, { force = false, cleanupLegacy = false } = {}) {
  const ownerFilter = ownedFilter(userId);
  const patch = defaultMapPatch();
  let map = await MapModel.findOne(ownedFilter(userId, { name: DEFAULT_LUMIA_MAP_NAME }));
  const legacy = await MapModel.find(ownerFilter).select('_id name zones');
  let legacyDefaultMaps = (Array.isArray(legacy) ? legacy : []).filter(looksLikeLegacyZoneNamedDefaultMap);
  let created = false;
  let updated = false;
  let migrated = false;
  let deletedLegacyCount = 0;
  let deletedLegacyNames = [];

  if (!map) {
    if (legacyDefaultMaps.length) {
      map = legacyDefaultMaps[0];
      await MapModel.updateOne(
        ownedFilter(userId, { _id: map._id }),
        { $set: { ...patch, ownerUserId: userId } }
      );
      map = await MapModel.findOne(ownedFilter(userId, { _id: map._id }));
      migrated = true;
    }
  }

  if (!map) {
    map = await new MapModel({ ...patch, ownerUserId: userId }).save();
    created = true;
  } else if (force || !Array.isArray(map?.zones) || map.zones.length === 0 || !Array.isArray(map?.zoneConnections) || map.zoneConnections.length === 0) {
    await MapModel.updateOne(
      ownedFilter(userId, { _id: map._id }),
      { $set: patch }
    );
    map = await MapModel.findOne(ownedFilter(userId, { _id: map._id }));
    updated = true;
  }

  if (cleanupLegacy && map?._id) {
    const deleteIds = legacyDefaultMaps
      .filter((m) => !sameObjectId(m?._id, map?._id))
      .map((m) => m._id)
      .filter(Boolean);
    if (deleteIds.length) {
      deletedLegacyNames = legacyDefaultMaps
        .filter((m) => !sameObjectId(m?._id, map?._id))
        .map((m) => String(m?.name || ''))
        .filter(Boolean);
      const del = await MapModel.deleteMany(ownedFilter(userId, { _id: { $in: deleteIds } }));
      deletedLegacyCount = Number(del?.deletedCount || 0);
      await Kiosk.deleteMany(ownedFilter(userId, { mapId: { $in: deleteIds } }));
    }
  }

  return {
    map,
    created,
    updated,
    migrated,
    deletedLegacyCount,
    deletedLegacyNames,
  };
}

router.post('/maps/apply-default-zones', async (req, res) => {
  try {
    const body = req.body || {};
    const rawMode = String(body.mode || 'missing').trim().toLowerCase();
    const mode = rawMode === 'force' || rawMode === 'overwrite' ? 'force' : rawMode;

    if (mode !== 'missing' && mode !== 'force') {
      return res.status(400).json({ error: "mode는 'missing' 또는 'force'만 가능합니다." });
    }

    const mapIds = Array.isArray(body.mapIds) ? body.mapIds.filter(Boolean).map(String) : null;
    const userId = requireUserId(req, res);
    if (!userId) return;

    if (!mapIds || mapIds.length === 0) {
      const result = await ensureDefaultLumiaMap(userId, { force: mode === 'force', cleanupLegacy: true });
      const map = result?.map;
      return res.json({
        message: '루미아 섬 기본 구역/동선 적용 완료',
        mode,
        targetCount: map?._id ? 1 : 0,
        updatedCount: Number(result?.created || result?.updated || result?.migrated ? 1 : 0),
        skippedCount: Number(result?.created || result?.updated || result?.migrated ? 0 : 1),
        mapId: String(map?._id || ''),
        mapName: String(map?.name || DEFAULT_LUMIA_MAP_NAME),
        zoneCount: Array.isArray(map?.zones) ? map.zones.length : DEFAULT_ZONES.length,
        created: Boolean(result?.created),
        updated: Boolean(result?.updated),
        migrated: Boolean(result?.migrated),
        deletedLegacyCount: Number(result?.deletedLegacyCount || 0),
        deletedLegacyNames: result?.deletedLegacyNames || [],
      });
    }

    const filter = scope(req, res, mapIds && mapIds.length ? { _id: { $in: mapIds } } : {});
    if (!filter) return;

    const maps = await MapModel.find(filter).select('_id name zones');
    const ops = [];
    const updatedMapIds = [];
    const skippedMapIds = [];

    for (const m of (Array.isArray(maps) ? maps : [])) {
      const empty = !Array.isArray(m?.zones) || m.zones.length === 0;
      const shouldApply = mode === 'force' || empty;

      if (!shouldApply) {
        skippedMapIds.push(String(m?._id || ''));
        continue;
      }

      updatedMapIds.push(String(m?._id || ''));
      const dz = cloneDefaultZones();
      const zoneIds = dz.map((z) => String(z?.zoneId || '').trim()).filter(Boolean);
      const dc = buildDefaultZoneConnections(zoneIds);
      ops.push({
        updateOne: {
          filter: { _id: m._id, ownerUserId: filter.ownerUserId },
          update: { $set: { zones: dz, coreSpawnZones: coreSpawnZoneIdsFromZones(dz), zoneConnections: dc } },
        },
      });
    }

    if (ops.length) {
      await MapModel.bulkWrite(ops);
    }

    res.json({
      message: '기본 맵 구역 적용 완료',
      mode,
      targetCount: (Array.isArray(maps) ? maps.length : 0),
      updatedCount: updatedMapIds.length,
      skippedCount: skippedMapIds.length,
      updatedMapIds,
      skippedMapIds,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '기본 구역 적용 실패' });
  }
});
// =========================
// 🌠 coreSpawnZones(자연 코어 스폰 허용 구역) 편집
// POST /api/admin/maps/:id/core-spawn-zones
// body:
//  - { coreSpawnZones: string[] | string }  // 콤마/공백 구분 가능
//  - { mode: 'fromZones' }                 // zones[*].coreSpawn 기반으로 재생성
function parseZoneIds(raw) {
  if (Array.isArray(raw)) return raw.map(canonicalZoneId).filter(Boolean);
  const s = String(raw || '');
  return s.split(/[,\s]+/g).map(canonicalZoneId).filter(Boolean);
}

router.post('/maps/:id/core-spawn-zones', async (req, res) => {
  try {
    const mapId = String(req.params.id || '');
    const filter = scope(req, res, { _id: mapId });
    if (!filter) return;
    const map = await MapModel.findOne(filter).select('_id name zones coreSpawnZones');
    if (!map) return res.status(404).json({ error: '맵을 찾을 수 없습니다.' });

    const mode = String(req.body?.mode || '').trim().toLowerCase();
    if (mode === 'fromzones') {
      const next = coreSpawnZoneIdsFromZones(map.zones);
      map.coreSpawnZones = next;
      await map.save();
      return res.json({ message: 'zones.coreSpawn 기반으로 재생성 완료', mapId, coreSpawnZones: next });
    }

    const nextRaw = (req.body && (req.body.coreSpawnZones ?? req.body.zoneIds)) ?? '';
    const next = Array.from(new Set(parseZoneIds(nextRaw)));

    const validZoneIds = new Set(
      normalizeZoneList(map.zones)
        .map((z) => String(z?.zoneId || ''))
        .filter(Boolean)
    );
    const unknown = next.filter((id) => !validZoneIds.has(id));
    if (unknown.length) {
      return res.status(400).json({ error: `존 ID가 존재하지 않습니다: ${unknown.join(', ')}` });
    }

    map.coreSpawnZones = next;
    await map.save();
    res.json({ message: 'coreSpawnZones 저장 완료', mapId, coreSpawnZones: next });
  } catch (err) {
    res.status(500).json({ error: err.message || '저장 실패' });
  }
});

// =========================
// 📦 존별 상자 스폰 허용/금지(crateAllowDeny)
// GET  /api/admin/maps/:id/crate-allow-deny
// POST /api/admin/maps/:id/crate-allow-deny
// body: { crateAllowDeny: { [zoneId]: string[] } }
const CRATE_RULE_KEYS = new Set(['food', 'legendary_material', 'transcend_pick']);

function normalizeCrateAllowDeny(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;

  for (const [zoneIdRaw, denyRaw] of Object.entries(raw)) {
    const zoneId = String(zoneIdRaw || '').trim();
    if (!zoneId) continue;
    const denyArr = Array.isArray(denyRaw) ? denyRaw : [];
    const deny = Array.from(
      new Set(
        denyArr
          .map((v) => String(v || '').trim())
          .filter((k) => k && CRATE_RULE_KEYS.has(k))
      )
    );
    if (deny.length) out[zoneId] = deny;
  }

  return out;
}

router.get('/maps/:id/crate-allow-deny', async (req, res) => {
  try {
    const mapId = String(req.params.id || '');
    const filter = scope(req, res, { _id: mapId });
    if (!filter) return;
    const map = await MapModel.findOne(filter).select('_id name crateAllowDeny');
    if (!map) return res.status(404).json({ error: '맵을 찾을 수 없습니다.' });

    const cur = (map.crateAllowDeny && typeof map.crateAllowDeny.toObject === 'function')
      ? map.crateAllowDeny.toObject()
      : (map.crateAllowDeny || {});
    res.json({ mapId, crateAllowDeny: normalizeCrateAllowDeny(cur) });
  } catch (err) {
    res.status(500).json({ error: err.message || '조회 실패' });
  }
});

router.post('/maps/:id/crate-allow-deny', async (req, res) => {
  try {
    const mapId = String(req.params.id || '');
    const filter = scope(req, res, { _id: mapId });
    if (!filter) return;
    const map = await MapModel.findOne(filter).select('_id name zones crateAllowDeny');
    if (!map) return res.status(404).json({ error: '맵을 찾을 수 없습니다.' });

    const payload = (req.body && (req.body.crateAllowDeny ?? req.body.zoneCrateRules)) ?? {};
    const next = normalizeCrateAllowDeny(payload);

    const validZoneIds = new Set(
      (Array.isArray(map.zones) ? map.zones : [])
        .map((z) => String(z?.zoneId || '').trim())
        .filter(Boolean)
    );
    const unknown = Object.keys(next).filter((zid) => !validZoneIds.has(zid));
    if (unknown.length) {
      return res.status(400).json({ error: `존 ID가 존재하지 않습니다: ${unknown.join(', ')}` });
    }

    map.crateAllowDeny = next;
    await map.save();
    res.json({ message: 'crateAllowDeny 저장 완료', mapId, crateAllowDeny: next });
  } catch (err) {
    res.status(500).json({ error: err.message || '저장 실패' });
  }
});

// =========================
// ✅ 맵 zones 기반으로 '실제 키오스크 배치' 문서 자동 생성
// POST /api/admin/kiosks/generate
// body: { mode: 'missing' | 'force', mapIds?: string[] }
// - missing: 이미 있는 키오스크(mapId+zoneId)는 건드리지 않음(기본)
// - force: 대상 맵의 키오스크(키오스크 구역에 해당) 삭제 후 재생성(주의)

function mapLooksLikeKioskMap(mapName) {
  const name = String(mapName || '').trim();
  if (!name) return false;
  if (Array.isArray(KIOSK_MAP_NAMES) && KIOSK_MAP_NAMES.includes(name)) return true;

  // 커스텀/영문 대비
  const nm = name.toLowerCase();
  const keywords = [
    'barge', 'vessel', 'ship', '바지선',
    'hospital', '병원',
    'archery', '양궁',
    'hotel', '호텔',
    'warehouse', 'storage', '창고',
    'lab', 'research', '연구',
    'temple', '절',
    'fire', 'firestation', '소방',
    'police', '경찰',
    'cathedral', 'church', '성당',
    'school', 'academy', '학교',
  ];
  return keywords.some((k) => nm.includes(String(k).toLowerCase()));
}

function zoneLooksLikeKioskZone(zone) {
  const zoneId = String(zone?.zoneId || '').trim();
  if (zoneId && KIOSK_ZONE_ID_SET.has(zoneId)) return true;
  if (zone?.hasKiosk === true) return true;
  return mapLooksLikeKioskMap(zone?.name);
}

function listKioskTargetsForMaps(maps) {
  const out = [];
  for (const m of (Array.isArray(maps) ? maps : [])) {
    const zones = Array.isArray(m?.zones) ? m.zones : [];
    if (zones.length) {
      for (const z of zones) {
        const zoneId = String(z?.zoneId || '').trim();
        if (!zoneId || !zoneLooksLikeKioskZone(z)) continue;
        out.push({
          map: m,
          mapId: m._id,
          zoneId,
          zoneName: String(z?.name || zoneId),
        });
      }
      continue;
    }

    if (mapLooksLikeKioskMap(m?.name)) {
      out.push({
        map: m,
        mapId: m._id,
        zoneId: '',
        zoneName: String(m?.name || '지역'),
      });
    }
  }
  return out;
}

function centroidOfPolygon(poly) {
  const pts = Array.isArray(poly) ? poly : [];
  if (!pts.length) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const p of pts) {
    const x = Number(p?.x);
    const y = Number(p?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    sx += x;
    sy += y;
    n += 1;
  }
  if (n <= 0) return { x: 0, y: 0 };
  return { x: sx / n, y: sy / n };
}

function buildKioskId(mapId, zoneId = '') {
  const m = String(mapId || '').trim();
  const z = String(zoneId || '').trim();
  return z ? `KIOSK_${m}_${z}` : `KIOSK_${m}`;
}

async function buildKioskCatalogTemplate(userId) {
  // ✅ 키오스크 카탈로그 템플릿(아이템 ObjectId 기반)
  // - 운석↔생나 교환
  // - 포스 코어 → 미스릴 교환
  // - 미스릴 → 전술 강화 모듈 교환
  const kioskItemNames = ['운석', '생명의 나무', '미스릴', '포스 코어', '전술 강화 모듈'];
  const kioskItems = await Item.find(ownedFilter(userId, { name: { $in: kioskItemNames } })).select('_id name');
  const itemIdByName = new Map((Array.isArray(kioskItems) ? kioskItems : []).map((it) => [String(it.name), it._id]));

  const priceByName = {
    '운석': 10,
    '생명의 나무': 10,
    '미스릴': 15,
    '포스 코어': 20,
    '전술 강화 모듈': 100,
  };

  const getId = (nm) => itemIdByName.get(String(nm)) || null;

  const catalogTemplate = [];

  // 판매(크레딧으로 구매)
  for (const nm of kioskItemNames) {
    const id = getId(nm);
    if (!id) continue;
    catalogTemplate.push({ itemId: id, mode: 'sell', priceCredits: Number(priceByName[nm] || 0) });
  }

  // 교환(1:1)
  const meteorId = getId('운석');
  const treeId = getId('생명의 나무');
  const mithrilId = getId('미스릴');
  const forceCoreId = getId('포스 코어');
  const moduleId = getId('전술 강화 모듈');

  if (meteorId && treeId) {
    catalogTemplate.push({ itemId: meteorId, mode: 'exchange', exchange: { giveItemId: treeId, giveQty: 1 } });
    catalogTemplate.push({ itemId: treeId, mode: 'exchange', exchange: { giveItemId: meteorId, giveQty: 1 } });
  }
  if (mithrilId && forceCoreId) {
    catalogTemplate.push({ itemId: mithrilId, mode: 'exchange', exchange: { giveItemId: forceCoreId, giveQty: 1 } });
  }
  if (moduleId && mithrilId) {
    catalogTemplate.push({ itemId: moduleId, mode: 'exchange', exchange: { giveItemId: mithrilId, giveQty: 1 } });
  }

  // 환급(전술 강화 모듈 → 크레딧)
  if (moduleId) {
    catalogTemplate.push({ itemId: moduleId, mode: 'buy', priceCredits: Number(priceByName['전술 강화 모듈'] || 100) });
  }

  // exchange 스키마는 optional이므로, 응답 직전 sanitize
  return catalogTemplate.map((row) => ({
    itemId: row.itemId,
    mode: row.mode,
    priceCredits: Number(row.priceCredits || 0),
    exchange: row.exchange ? { giveItemId: row.exchange.giveItemId, giveQty: Number(row.exchange.giveQty || 1) } : undefined,
  }));
}

router.post('/kiosks/generate', async (req, res) => {
  try {
    const body = req.body || {};
    const rawMode = String(body.mode || 'missing').trim().toLowerCase();
    const mode = rawMode === 'force' || rawMode === 'overwrite' ? 'force' : rawMode;

    if (mode !== 'missing' && mode !== 'force') {
      return res.status(400).json({ error: "mode는 'missing' 또는 'force'만 가능합니다." });
    }

    const userId = requireUserId(req, res);
    if (!userId) return;
    const mapIds = Array.isArray(body.mapIds) ? body.mapIds.filter(Boolean).map(String) : null;
    const filter = ownedFilter(userId, mapIds && mapIds.length ? { _id: { $in: mapIds } } : {});

    let maps = await MapModel.find(filter).select('_id name zones');
    if (!maps.length && !mapIds) {
      const ensured = await ensureDefaultLumiaMap(userId, { force: true, cleanupLegacy: false });
      maps = ensured?.map ? [ensured.map] : [];
    }

    const targets = listKioskTargetsForMaps(maps);
    const mapIdList = Array.from(new Set(targets.map((t) => String(t?.mapId || '')).filter(Boolean)));

    if (!targets.length) {
      return res.json({
        message: '대상 키오스크 구역이 없습니다.',
        mode,
        targetMapCount: 0,
        targetZoneCount: 0,
        createdCount: 0,
        skippedCount: 0,
        deletedCount: 0,
      });
    }

    // force 모드면 먼저 삭제(구역당 1개 정책이므로 대상 맵 키오스크 전부 삭제)
    let deletedCount = 0;
    if (mode === 'force') {
      const del = await Kiosk.deleteMany(ownedFilter(userId, { mapId: { $in: mapIdList } }));
      deletedCount = Number(del?.deletedCount || 0);
    }

    const existing = mode === 'force'
      ? []
      : await Kiosk.find(ownedFilter(userId, { mapId: { $in: mapIdList } })).select('mapId zoneId kioskId');

    const existingTargetKeys = new Set((Array.isArray(existing) ? existing : []).map((k) => `${String(k?.mapId || '')}:${String(k?.zoneId || '')}`));

    const catalogTemplate = await buildKioskCatalogTemplate(userId);

    const toInsert = [];
    let skippedCount = 0;

    for (const target of targets) {
      const m = target.map;
      const mid = String(target?.mapId || '').trim();
      const zid = String(target?.zoneId || '').trim();
      if (!mid) continue;
      const key = `${mid}:${zid}`;
      if (existingTargetKeys.has(key)) {
        skippedCount += 1;
        continue;
      }
      toInsert.push({
        kioskId: buildKioskId(m._id, zid),
        ownerUserId: userId,
        name: `${String(target?.zoneName || m?.name || '지역')} 키오스크`,
        mapId: m._id,
        zoneId: zid,
        x: 0,
        y: 0,
        catalog: catalogTemplate,
      });
    }

    if (toInsert.length) {
      await Kiosk.insertMany(toInsert, { ordered: false });
    }

    res.json({
      message: '키오스크 생성 완료(구역당 1개)',
      mode,
      targetMapCount: mapIdList.length,
      targetZoneCount: targets.length,
      createdCount: toInsert.length,
      skippedCount,
      deletedCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '키오스크 배치 생성 실패' });
  }
});

// ✅ 기존 키오스크 데이터 정규화
// POST /api/admin/kiosks/normalize
// - zones.hasKiosk 기준으로 구역당 1개 유지
// - kioskId: KIOSK_<mapId>_<zoneId>로 통일
// - zoneId가 없는 예전 맵당 키오스크는 삭제
router.post('/kiosks/normalize', async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    let maps = await MapModel.find(ownedFilter(userId)).select('_id name zones');
    if (!maps.length) {
      const ensured = await ensureDefaultLumiaMap(userId, { force: true, cleanupLegacy: false });
      maps = ensured?.map ? [ensured.map] : [];
    }

    const targets = listKioskTargetsForMaps(maps);
    const mapIdList = Array.from(new Set(targets.map((t) => String(t?.mapId || '')).filter(Boolean)));
    const targetKeys = new Set(targets.map((t) => `${String(t?.mapId || '')}:${String(t?.zoneId || '')}`));
    const targetByKey = new Map(targets.map((t) => [`${String(t?.mapId || '')}:${String(t?.zoneId || '')}`, t]));

    const catalogTemplate = await buildKioskCatalogTemplate(userId);
    const allKiosks = mapIdList.length
      ? await Kiosk.find(ownedFilter(userId, { mapId: { $in: mapIdList } })).select('_id kioskId name mapId zoneId catalog')
      : [];

    const byTarget = new Map();
    const staleIds = [];
    for (const k of (Array.isArray(allKiosks) ? allKiosks : [])) {
      const key = `${String(k?.mapId || '')}:${String(k?.zoneId || '')}`;
      if (!targetKeys.has(key)) {
        staleIds.push(k._id);
        continue;
      }
      if (!byTarget.has(key)) byTarget.set(key, []);
      byTarget.get(key).push(k);
    }

    let deletedDup = 0;
    let deletedStale = 0;
    let updated = 0;
    let created = 0;

    if (staleIds.length) {
      const del = await Kiosk.deleteMany(ownedFilter(userId, { _id: { $in: staleIds } }));
      deletedStale = Number(del?.deletedCount || 0);
    }

    for (const [key, target] of targetByKey.entries()) {
      const list = byTarget.get(key) || [];
      let keep = null;

      if (list.length > 1) {
        list.sort((a, b) => (Array.isArray(b.catalog) ? b.catalog.length : 0) - (Array.isArray(a.catalog) ? a.catalog.length : 0));
        keep = list[0];
        const delIds = list.slice(1).map((x) => x._id).filter(Boolean);
        if (delIds.length) {
          const del = await Kiosk.deleteMany(ownedFilter(userId, { _id: { $in: delIds } }));
          deletedDup += Number(del?.deletedCount || 0);
        }
      } else {
        keep = list[0] || null;
      }

      const m = target.map;
      const zid = String(target.zoneId || '');
      const nextName = `${String(target.zoneName || m?.name || '지역')} 키오스크`;

      if (!keep) {
        await new Kiosk({
          kioskId: buildKioskId(m._id, zid),
          ownerUserId: userId,
          name: nextName,
          mapId: m._id,
          zoneId: zid,
          x: 0,
          y: 0,
          catalog: catalogTemplate,
        }).save();
        created += 1;
        continue;
      }

      keep.kioskId = buildKioskId(m._id, zid);
      keep.name = nextName;
      keep.zoneId = zid;
      if (!Array.isArray(keep.catalog) || keep.catalog.length === 0) keep.catalog = catalogTemplate;
      await keep.save();
      updated += 1;
    }

    res.json({
      message: '키오스크 정규화 완료',
      kioskMapCount: mapIdList.length,
      kioskZoneCount: targets.length,
      created,
      updated,
      deletedDup,
      deletedStale,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '키오스크 정규화 실패' });
  }
});

// 3. 동선 연결 (A구역과 B구역 연결)
router.put('/maps/:id/connect', async (req, res) => {
    const { targetMapId } = req.body;
    try {
        // 내 맵에 상대방 추가, 상대방 맵에 나를 추가 (양방향 연결)
        const filter = scope(req, res);
        if (!filter) return;
        await MapModel.findOneAndUpdate({ ...filter, _id: req.params.id }, { $addToSet: { connectedMaps: targetMapId } });
        await MapModel.findOneAndUpdate({ ...filter, _id: targetMapId }, { $addToSet: { connectedMaps: req.params.id } });
        res.json({ message: "구역 간 동선이 연결되었습니다." });
    } catch (err) { res.status(500).json({ error: "동선 연결 실패" }); }
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
// PUT /api/admin/maps/:id
router.put('/maps/:id', async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const updated = await MapModel.findOneAndUpdate(ownedFilter(userId, { _id: req.params.id }), withOwner(userId, req.body), { new: true });
    if (!updated) return res.status(404).json({ error: '맵을 찾을 수 없습니다.' });
    res.json({ message: '맵이 수정되었습니다.', map: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '맵 수정 실패' });
  }
});

// DELETE /api/admin/maps/:id
router.delete('/maps/:id', async (req, res) => {
  try {
    const filter = scope(req, res, { _id: req.params.id });
    if (!filter) return;
    const deleted = await MapModel.findOneAndDelete(filter);
    if (!deleted) return res.status(404).json({ error: '맵을 찾을 수 없습니다.' });
    res.json({ message: '맵이 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '맵 삭제 실패' });
  }
});

// =========================
// ✅ 키오스크 CRUD(로드맵 3번)
router.get('/kiosks', async (req, res) => {
  try {
    const filter = scope(req, res);
    if (!filter) return;
    const kiosks = await Kiosk.find(filter).populate('mapId', 'name').lean();
    res.json(kiosks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '키오스크 로드 실패' });
  }
});

router.post('/kiosks', async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const payload = { ...(req.body || {}) };
    if (!payload.mapId) return res.status(400).json({ error: 'mapId가 필요합니다.' });
    if (!payload.kioskId) payload.kioskId = buildKioskId(payload.mapId);
    if (payload.zoneId == null) payload.zoneId = '';
    payload.x = Number(payload.x || 0);
    payload.y = Number(payload.y || 0);
    if (!Array.isArray(payload.catalog)) payload.catalog = [];

    const kiosk = await new Kiosk(withOwner(userId, payload)).save();
    res.json({ message: '키오스크가 추가되었습니다.', kiosk });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '키오스크 저장 실패' });
  }
});

router.put('/kiosks/:id', async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const updated = await Kiosk.findOneAndUpdate(ownedFilter(userId, { _id: req.params.id }), withOwner(userId, req.body), { new: true });
    if (!updated) return res.status(404).json({ error: '키오스크를 찾을 수 없습니다.' });
    res.json({ message: '키오스크가 수정되었습니다.', kiosk: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '키오스크 수정 실패' });
  }
});

router.delete('/kiosks/:id', async (req, res) => {
  try {
    const filter = scope(req, res, { _id: req.params.id });
    if (!filter) return;
    const deleted = await Kiosk.findOneAndDelete(filter);
    if (!deleted) return res.status(404).json({ error: '키오스크를 찾을 수 없습니다.' });
    res.json({ message: '키오스크가 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '키오스크 삭제 실패' });
  }
});

// ✅ 기본 아이템/레시피 트리 자동 생성(프로토타입)
// POST /api/admin/items/generate-default-tree
// body: { mode?: 'missing' | 'force' }
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
