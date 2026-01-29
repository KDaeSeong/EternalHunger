const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Item = require('../models/Item'); // ★ 아이템 모델 추가!
const Map = require('../models/Map');

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
        await Item.findByIdAndDelete(req.params.id);
        res.json({ message: "아이템이 삭제되었습니다." });
    } catch (err) { res.status(500).json({ error: "삭제 실패" }); }
});

// 1. 모든 구역 목록 로드
router.get('/maps', async (req, res) => {
    try {
        const maps = await Map.find().populate('connectedMaps', 'name'); // 연결된 맵 이름까지 가져옴
        res.json(maps);
    } catch (err) { res.status(500).json({ error: "맵 로드 실패" }); }
});

// 2. 새로운 구역 생성
router.post('/maps', async (req, res) => {
    try {
        const newMap = new Map(req.body);
        await newMap.save();
        res.json({ message: "신규 구역이 생성되었습니다.", map: newMap });
    } catch (err) { res.status(500).json({ error: "구역 생성 실패" }); }
});

// 3. 동선 연결 (A구역과 B구역 연결)
router.put('/maps/:id/connect', async (req, res) => {
    const { targetMapId } = req.body;
    try {
        // 내 맵에 상대방 추가, 상대방 맵에 나를 추가 (양방향 연결)
        await Map.findByIdAndUpdate(req.params.id, { $addToSet: { connectedMaps: targetMapId } });
        await Map.findByIdAndUpdate(targetMapId, { $addToSet: { connectedMaps: req.params.id } });
        res.json({ message: "구역 간 동선이 연결되었습니다." });
    } catch (err) { res.status(500).json({ error: "동선 연결 실패" }); }
});


// =========================
// ✅ 아이템 수정(로드맵 1-1)
// PUT /api/admin/items/:id
router.put('/items/:id', async (req, res) => {
  try {
    const updated = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
    const updated = await Map.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
    const deleted = await Map.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: '맵을 찾을 수 없습니다.' });
    res.json({ message: '맵이 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '맵 삭제 실패' });
  }
});

// =========================
// ✅ 키오스크 CRUD(로드맵 3번)
const Kiosk = require('../models/Kiosk');

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
    const kiosk = await new Kiosk(req.body).save();
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

module.exports = router;