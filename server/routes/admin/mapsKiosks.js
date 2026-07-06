const express = require('express');
const router = express.Router();
const MapModel = require('../../models/Map');
const Kiosk = require('../../models/Kiosk');
const { DEFAULT_ZONES, DEFAULT_ZONE_IDS, DEFAULT_ZONE_DEFS, canonicalZoneId, normalizeZoneList } = require('../../utils/defaultZones');
const { buildDefaultZoneConnections } = require('../../utils/defaultZoneConnections');
const { requireUserId, ownedFilter, withOwner } = require('../../utils/requestScope');

function scope(req, res, extra = {}) {
  const userId = requireUserId(req, res);
  if (!userId) return null;
  return ownedFilter(userId, extra);
}

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

router.use(require('./kiosks')({ ensureDefaultLumiaMap }));

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

module.exports = router;
