const express = require('express');
const Item = require('../../models/Item');
const MapModel = require('../../models/Map');
const Kiosk = require('../../models/Kiosk');
const { DEFAULT_ZONES, KIOSK_MAP_NAMES } = require('../../utils/defaultZones');
const { requireUserId, ownedFilter, withOwner } = require('../../utils/requestScope');

module.exports = function createKioskRouter({ ensureDefaultLumiaMap }) {
  const router = express.Router();
  const KIOSK_ZONE_ID_SET = new Set((Array.isArray(DEFAULT_ZONES) ? DEFAULT_ZONES : []).filter((z) => z?.hasKiosk).map((z) => String(z?.zoneId || '')).filter(Boolean));

  function scope(req, res, extra = {}) {
    const userId = requireUserId(req, res);
    if (!userId) return null;
    return ownedFilter(userId, extra);
  }

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

  return router;
};
