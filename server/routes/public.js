// server/routes/public.js
const express = require('express');
const router = express.Router();

const Item = require('../models/Item');
const Map = require('../models/Map');
const Kiosk = require('../models/Kiosk');
const DroneOffer = require('../models/DroneOffer');
const Perk = require('../models/Perk');
const { DEFAULT_ZONES } = require('../utils/defaultZones');
const { buildDefaultZoneConnections } = require('../utils/defaultZoneConnections');

/**
 * ✅ 공개 데이터 API
 * - 시뮬레이션/에디터/메인에서 필요한 '기본 데이터'를 비로그인으로도 조회 가능
 */

router.get('/items', async (req, res) => {
  try {
    const items = await Item.find({}).sort({ createdAt: 1 });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '아이템 로드 실패' });
  }
});

router.get('/maps', async (req, res) => {
  try {
    const maps = await Map.find({}).populate('connectedMaps', 'name');

    // ✅ 맵 zones가 비어있으면, '기본 맵 구역' 세트를 응답에 주입합니다.
    // - DB를 강제로 수정하진 않습니다(응답 레벨에서만 보정).
    const normalized = (Array.isArray(maps) ? maps : []).map((m) => {
      const o = (typeof m?.toObject === 'function') ? m.toObject() : m;

      // ✅ mongoose Map(crateAllowDeny)가 JSON에서 {}로 날아가지 않도록 평탄화
      // - { [zoneId]: string[] } 형태로 항상 내려줍니다.
      let crateAllowDeny = o?.crateAllowDeny;
      if (crateAllowDeny && typeof crateAllowDeny.toObject === 'function') {
        crateAllowDeny = crateAllowDeny.toObject();
      }
      if (crateAllowDeny instanceof Map) {
        crateAllowDeny = Object.fromEntries(crateAllowDeny.entries());
      }
      if (!crateAllowDeny || typeof crateAllowDeny !== 'object' || Array.isArray(crateAllowDeny)) {
        crateAllowDeny = {};
      }

      // zones 보정
      const zones = (!Array.isArray(o?.zones) || o.zones.length === 0) ? DEFAULT_ZONES : o.zones;

      // zoneConnections 보정(비어있으면 기본 프리셋 주입)
      const hasConns = Array.isArray(o?.zoneConnections) && o.zoneConnections.length > 0;
      const zoneIds = (Array.isArray(zones) ? zones : []).map((z) => String(z?.zoneId || '').trim()).filter(Boolean);
      const zoneConnections = hasConns ? o.zoneConnections : buildDefaultZoneConnections(zoneIds);

      return { ...o, crateAllowDeny, zones, zoneConnections };
    });

    res.json(normalized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '맵 로드 실패' });
  }
});

router.get('/kiosks', async (req, res) => {
  try {
    const kiosks = await Kiosk.find({})
      .populate('mapId', 'name')
      .populate('catalog.itemId', 'name tier rarity baseCreditValue tags')
      .populate('catalog.exchange.giveItemId', 'name tier rarity baseCreditValue tags');
    res.json(kiosks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '키오스크 로드 실패' });
  }
});

router.get('/drone-offers', async (req, res) => {
  try {
    const offers = await DroneOffer.find({ isActive: true }).populate('itemId', 'name tier rarity baseCreditValue');
    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '드론 판매 목록 로드 실패' });
  }
});

router.get('/perks', async (req, res) => {
  try {
    const perks = await Perk.find({ isActive: true }).sort({ lpCost: 1 });
    res.json(perks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '특전 로드 실패' });
  }
});

module.exports = router;
