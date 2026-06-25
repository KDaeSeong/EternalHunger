const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Item = require('../models/Item'); // ★ 아이템 모델 추가!
const MapModel = require('../models/Map');
const Kiosk = require('../models/Kiosk');
const { DEFAULT_ZONES, KIOSK_MAP_NAMES } = require('../utils/defaultZones');
const { buildDefaultZoneConnections } = require('../utils/defaultZoneConnections');
const { upsertDefaultItemTree } = require('../utils/defaultItemTree');

// ★ [수정 1] 미들웨어를 정확한 경로에서 불러옵니다.
// (방금 authMiddleware.js를 만들었다면 이 경로가 맞습니다)
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

// ★ [수정 2] 이 라우터의 '모든' 요청에 대해 문지기 2명을 세웁니다.
// 순서: 1차(로그인 확인) -> 2차(관리자 확인)
// 이제 개별 라우트마다 verifyAdmin을 또 적을 필요가 없습니다.
router.use(verifyToken, verifyAdmin);


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
        const items = await Item.find().sort({ createdAt: -1 });
        res.json(items);
    } catch (err) { 
        res.status(500).json({ error: "아이템 로드 실패" }); 
    }
});

// 2. 아이템 추가하기 (POST /api/admin/items)
router.post('/items', async (req, res) => {
    try {
        const newItem = new Item(req.body);
        await newItem.save();
        res.json({ message: "아이템이 성공적으로 추가되었습니다.", item: newItem });
    } catch (err) { 
        res.status(500).json({ error: "아이템 저장 실패" }); 
    }
});

// 아이템 삭제하기
router.delete('/items/:id', async (req, res) => {
    try {
        const result = await Item.deleteOne({ _id: req.params.id });
        if (Number(result?.deletedCount || 0) < 1) return res.status(404).json({ error: "아이템을 찾을 수 없습니다." });
        res.json({ message: "아이템이 삭제되었습니다.", deletedCount: 1, id: String(req.params.id || '') });
    } catch (err) { res.status(500).json({ error: "삭제 실패" }); }
});

// 1. 모든 구역 목록 로드
router.get('/maps', async (req, res) => {
    try {
        const maps = await MapModel.find().populate('connectedMaps', 'name'); // 연결된 맵 이름까지 가져옴
        res.json(maps);
    } catch (err) { res.status(500).json({ error: "맵 로드 실패" }); }
});

// ✅ 맵 목록 정리(운영 편의)
// POST /api/admin/maps/normalize-list
// - 공원(Park) 맵 삭제
// - 소방서/경찰서 맵이 없으면 기본 zones 포함으로 자동 생성
router.post('/maps/normalize-list', async (req, res) => {
  try {
    const normalizeName = (v) => String(v || '').trim().replace(/\s+/g, '');
    const lower = (v) => normalizeName(v).toLowerCase();

    const deleteTargets = new Set(['공원', 'park']);
    const ensureNames = ['소방서', '경찰서'];

    const all = await MapModel.find().select('_id name connectedMaps');

    // 1) 공원 삭제
    const toDelete = (Array.isArray(all) ? all : []).filter((m) => deleteTargets.has(lower(m?.name)));
    const deleteIds = toDelete.map((m) => m._id).filter(Boolean);
    let deletedCount = 0;
    let deletedNames = [];

    if (deleteIds.length) {
      deletedNames = toDelete.map((m) => String(m?.name || '')).filter(Boolean);
      await MapModel.deleteMany({ _id: { $in: deleteIds } });
      deletedCount = deleteIds.length;
      // 연결 관계 정리(고아 ObjectId 제거)
      await MapModel.updateMany(
        { connectedMaps: { $in: deleteIds } },
        { $pull: { connectedMaps: { $in: deleteIds } } }
      );
    }

    // 2) 소방서/경찰서 보장
    const existing = await MapModel.find({ name: { $in: ensureNames } }).select('_id name');
    const existingSet = new Set((Array.isArray(existing) ? existing : []).map((m) => normalizeName(m?.name)));
    const createdNames = [];

    for (const nm of ensureNames) {
      if (existingSet.has(normalizeName(nm))) continue;
      const dz = cloneDefaultZones();
      const zoneIds = dz.map((z) => String(z?.zoneId || '').trim()).filter(Boolean);
      const dc = buildDefaultZoneConnections(zoneIds);
      await new MapModel({
        name: nm,
        zones: dz,
        coreSpawnZones: coreSpawnZoneIdsFromZones(dz),
        zoneConnections: dc,
      }).save();
      createdNames.push(nm);
    }

    res.json({
      message: '맵 목록 정리 완료',
      deletedCount,
      deletedNames,
      createdCount: createdNames.length,
      createdNames,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '맵 목록 정리 실패' });
  }
});

// 2. 새로운 구역 생성
router.post('/maps', async (req, res) => {
    try {
        // ✅ zones를 비워서 생성하면, 기본 구역(키오스크/일반 구역) 세트를 자동으로 넣어줍니다.
        // - 관리자 화면에서 맵을 만들 때 '기본 맵 구역'을 빠르게 세팅하기 위함
        const payload = { ...(req.body || {}) };
        if (!Array.isArray(payload.zones) || payload.zones.length === 0) {
            // ✅ zones 순차번호(zoneNo)까지 포함해서 주입
            payload.zones = cloneDefaultZones();
        } else {
            // ✅ 커스텀 zones라도 zoneNo가 비어있으면 1..N으로 채워줌
            payload.zones = payload.zones.map((z, idx) => ({
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
        const newMap = new MapModel(payload);
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
    .map((z) => String(z.zoneId || ''))
    .filter(Boolean);
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
    const filter = {};
    if (mapIds && mapIds.length) filter._id = { $in: mapIds };

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
          filter: { _id: m._id },
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
  if (Array.isArray(raw)) return raw.map(String);
  const s = String(raw || '');
  return s.split(/[,\s]+/g).map((v) => v.trim()).filter(Boolean);
}

router.post('/maps/:id/core-spawn-zones', async (req, res) => {
  try {
    const mapId = String(req.params.id || '');
    const map = await MapModel.findById(mapId).select('_id name zones coreSpawnZones');
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
      (Array.isArray(map.zones) ? map.zones : [])
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
    const map = await MapModel.findById(mapId).select('_id name crateAllowDeny');
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
    const map = await MapModel.findById(mapId).select('_id name zones crateAllowDeny');
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

function buildKioskId(mapId) {
  const m = String(mapId || '').trim();
  return `KIOSK_${m}`;
}

async function buildKioskCatalogTemplate() {
  // ✅ 키오스크 카탈로그 템플릿(아이템 ObjectId 기반)
  // - 운석↔생나 교환
  // - 포스 코어 → 미스릴 교환
  // - 미스릴 → 전술 강화 모듈 교환
  const kioskItemNames = ['운석', '생명의 나무', '미스릴', '포스 코어', '전술 강화 모듈'];
  const kioskItems = await Item.find({ name: { $in: kioskItemNames } }).select('_id name');
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

    const mapIds = Array.isArray(body.mapIds) ? body.mapIds.filter(Boolean).map(String) : null;
    const filter = {};
    if (mapIds && mapIds.length) filter._id = { $in: mapIds };

    const maps = await MapModel.find(filter).select('_id name');
    const targetMaps = (Array.isArray(maps) ? maps : []).filter((m) => mapLooksLikeKioskMap(m?.name));
    const mapIdList = targetMaps.map((m) => m._id);

    if (!mapIdList.length) {
      return res.json({
        message: '대상 맵(키오스크 지역)이 없습니다.',
        mode,
        targetMapCount: 0,
        createdCount: 0,
        skippedCount: 0,
        deletedCount: 0,
      });
    }

    // force 모드면 먼저 삭제(맵당 1개 정책이므로 대상 맵 키오스크 전부 삭제)
    let deletedCount = 0;
    if (mode === 'force') {
      const del = await Kiosk.deleteMany({ mapId: { $in: mapIdList } });
      deletedCount = Number(del?.deletedCount || 0);
    }

    const existing = mode === 'force'
      ? []
      : await Kiosk.find({ mapId: { $in: mapIdList } }).select('mapId kioskId');

    const existingMapIds = new Set((Array.isArray(existing) ? existing : []).map((k) => String(k?.mapId || '')));

    const catalogTemplate = await buildKioskCatalogTemplate();

    const toInsert = [];
    let skippedCount = 0;

    for (const m of targetMaps) {
      const mid = String(m?._id || '').trim();
      if (!mid) continue;
      if (existingMapIds.has(mid)) {
        skippedCount += 1;
        continue;
      }
      toInsert.push({
        kioskId: buildKioskId(m._id),
        name: `${String(m?.name || '지역')} 키오스크`,
        mapId: m._id,
        zoneId: '',
        x: 0,
        y: 0,
        catalog: catalogTemplate,
      });
    }

    if (toInsert.length) {
      await Kiosk.insertMany(toInsert, { ordered: false });
    }

    res.json({
      message: '키오스크 생성 완료(맵당 1개)',
      mode,
      targetMapCount: targetMaps.length,
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
// - 맵당 1개로 중복 제거
// - kioskId: KIOSK_<mapId>로 통일
// - name: <맵이름> 키오스크로 통일
// - zoneId는 사용하지 않음(빈값)
router.post('/kiosks/normalize', async (req, res) => {
  try {
    const maps = await MapModel.find({}).select('_id name');
    const targetMaps = (Array.isArray(maps) ? maps : []).filter((m) => mapLooksLikeKioskMap(m?.name));
    const mapIdList = targetMaps.map((m) => m._id);

    const catalogTemplate = await buildKioskCatalogTemplate();

    const allKiosks = await Kiosk.find({ mapId: { $in: mapIdList } }).select('_id kioskId name mapId zoneId catalog');

    const byMap = new Map();
    for (const k of (Array.isArray(allKiosks) ? allKiosks : [])) {
      const mid = String(k?.mapId || '').trim();
      if (!mid) continue;
      if (!byMap.has(mid)) byMap.set(mid, []);
      byMap.get(mid).push(k);
    }

    let deletedDup = 0;
    let updated = 0;
    let created = 0;

    for (const m of targetMaps) {
      const mid = String(m?._id || '').trim();
      if (!mid) continue;
      const list = byMap.get(mid) || [];

      // 1) 중복 제거(1개만 유지)
      if (list.length > 1) {
        // 카탈로그 있는 것을 우선 유지
        list.sort((a, b) => (Array.isArray(b.catalog) ? b.catalog.length : 0) - (Array.isArray(a.catalog) ? a.catalog.length : 0));
        const keep = list[0];
        const delIds = list.slice(1).map((x) => x._id).filter(Boolean);
        if (delIds.length) {
          const del = await Kiosk.deleteMany({ _id: { $in: delIds } });
          deletedDup += Number(del?.deletedCount || 0);
        }
        byMap.set(mid, [keep]);
      }

      let k = (byMap.get(mid) || [])[0] || null;
      if (!k) {
        // 2) 없으면 생성
        await new Kiosk({
          kioskId: buildKioskId(m._id),
          name: `${String(m?.name || '지역')} 키오스크`,
          mapId: m._id,
          zoneId: '',
          x: 0,
          y: 0,
          catalog: catalogTemplate,
        }).save();
        created += 1;
        continue;
      }

      // 3) 통일 업데이트
      k.kioskId = buildKioskId(m._id);
      k.name = `${String(m?.name || '지역')} 키오스크`;
      k.zoneId = '';
      if (!Array.isArray(k.catalog) || k.catalog.length === 0) k.catalog = catalogTemplate;
      await k.save();
      updated += 1;
    }

    res.json({
      message: '키오스크 정규화 완료',
      kioskMapCount: targetMaps.length,
      created,
      updated,
      deletedDup,
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
        await MapModel.findByIdAndUpdate(req.params.id, { $addToSet: { connectedMaps: targetMapId } });
        await MapModel.findByIdAndUpdate(targetMapId, { $addToSet: { connectedMaps: req.params.id } });
        res.json({ message: "구역 간 동선이 연결되었습니다." });
    } catch (err) { res.status(500).json({ error: "동선 연결 실패" }); }
});


// =========================
// ✅ 아이템 수정(로드맵 1-1)
// PUT /api/admin/items/:id
router.put('/items/:id', async (req, res) => {
  try {
    const updated = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
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
    const updated = await MapModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
    const deleted = await MapModel.findByIdAndDelete(req.params.id);
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
    const kiosks = await Kiosk.find({}).populate('mapId', 'name');
    res.json(kiosks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '키오스크 로드 실패' });
  }
});

router.post('/kiosks', async (req, res) => {
  try {
    const payload = { ...(req.body || {}) };
    if (!payload.mapId) return res.status(400).json({ error: 'mapId가 필요합니다.' });
    if (!payload.kioskId) payload.kioskId = buildKioskId(payload.mapId);
    if (payload.zoneId == null) payload.zoneId = '';
    payload.x = Number(payload.x || 0);
    payload.y = Number(payload.y || 0);
    if (!Array.isArray(payload.catalog)) payload.catalog = [];

    const kiosk = await new Kiosk(payload).save();
    res.json({ message: '키오스크가 추가되었습니다.', kiosk });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '키오스크 저장 실패' });
  }
});

router.put('/kiosks/:id', async (req, res) => {
  try {
    const updated = await Kiosk.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: '키오스크를 찾을 수 없습니다.' });
    res.json({ message: '키오스크가 수정되었습니다.', kiosk: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '키오스크 수정 실패' });
  }
});

router.delete('/kiosks/:id', async (req, res) => {
  try {
    const deleted = await Kiosk.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: '키오스크를 찾을 수 없습니다.' });
    res.json({ message: '키오스크가 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '키오스크 삭제 실패' });
  }
});

// =========================
// ✅ 드론 판매 목록 CRUD(로드맵 4번)
const DroneOffer = require('../models/DroneOffer');

router.get('/drone-offers', async (req, res) => {
  try {
    const offers = await DroneOffer.find({}).populate('itemId', 'name tier rarity');
    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '드론 판매 목록 로드 실패' });
  }
});

router.post('/drone-offers', async (req, res) => {
  try {
    const offer = await new DroneOffer(req.body).save();
    res.json({ message: '드론 판매가 추가되었습니다.', offer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '저장 실패' });
  }
});

router.put('/drone-offers/:id', async (req, res) => {
  try {
    const updated = await DroneOffer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    res.json({ message: '수정 완료', offer: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '수정 실패' });
  }
});

router.delete('/drone-offers/:id', async (req, res) => {
  try {
    const deleted = await DroneOffer.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    res.json({ message: '삭제 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '삭제 실패' });
  }
});

// =========================
// ✅ 특전 CRUD(로드맵 7번)
const Perk = require('../models/Perk');

router.get('/perks', async (req, res) => {
  try {
    const perks = await Perk.find({}).sort({ lpCost: 1 });
    res.json(perks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '특전 로드 실패' });
  }
});

router.post('/perks', async (req, res) => {
  try {
    const perk = await new Perk(req.body).save();
    res.json({ message: '특전이 추가되었습니다.', perk });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '특전 저장 실패' });
  }
});

router.put('/perks/:id', async (req, res) => {
  try {
    const updated = await Perk.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: '특전을 찾을 수 없습니다.' });
    res.json({ message: '특전이 수정되었습니다.', perk: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '특전 수정 실패' });
  }
});

router.delete('/perks/:id', async (req, res) => {
  try {
    const deleted = await Perk.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: '특전을 찾을 수 없습니다.' });
    res.json({ message: '특전이 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '특전 삭제 실패' });
  }
});



// ✅ 기본 아이템/레시피 트리 자동 생성(프로토타입)
// POST /api/admin/items/generate-default-tree
// body: { mode?: 'missing' | 'force' }
router.post('/items/generate-default-tree', async (req, res) => {
  try {
    const mode = (req.body?.mode === 'force') ? 'force' : 'missing';
    const summary = await upsertDefaultItemTree({ mode });
    res.json({ message: '기본 아이템 트리 적용 완료', summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '기본 아이템 트리 적용 실패' });
  }
});

module.exports = router;
