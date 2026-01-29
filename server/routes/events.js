const express = require('express');
const router = express.Router();
const GameEvent = require('../models/GameEvent');
const { verifyToken } = require('../middleware/authMiddleware');

// 모든 요청에 대해 토큰 검증 미들웨어 적용
router.use(verifyToken);

// 1. 내 이벤트 목록 가져오기
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    // ✅ 필터(로드맵 6번): 생존자/사망자/낮밤/구역
    const q = { userId };

    if (req.query.timeOfDay && req.query.timeOfDay !== 'both') {
      q.timeOfDay = String(req.query.timeOfDay);
    }

    if (req.query.mapId) q.mapId = String(req.query.mapId);
    if (req.query.zoneId) q.zoneId = String(req.query.zoneId);

    // survivorCount / victimCount 범위 필터
    const sMin = req.query.survivorMin != null ? Number(req.query.survivorMin) : null;
    const sMax = req.query.survivorMax != null ? Number(req.query.survivorMax) : null;
    const vMin = req.query.victimMin != null ? Number(req.query.victimMin) : null;
    const vMax = req.query.victimMax != null ? Number(req.query.victimMax) : null;

    if (sMin != null || sMax != null) {
      q.survivorCount = {};
      if (sMin != null && !Number.isNaN(sMin)) q.survivorCount.$gte = sMin;
      if (sMax != null && !Number.isNaN(sMax)) q.survivorCount.$lte = sMax;
    }
    if (vMin != null || vMax != null) {
      q.victimCount = {};
      if (vMin != null && !Number.isNaN(vMin)) q.victimCount.$gte = vMin;
      if (vMax != null && !Number.isNaN(vMax)) q.victimCount.$lte = vMax;
    }

    const events = await GameEvent.find(q).sort({ createdAt: 1 });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "로드 실패" });
  }
});

// 2. 이벤트 추가 (단일/배열 모두 지원)
router.post('/add', async (req, res) => {
  try {
    const userId = req.user.id;
    const data = req.body;

    if (Array.isArray(data)) {
      const docs = data.map(e => ({ 
        ...e, 
        userId,
        survivorCount: Number(e.survivorCount || 1),
        victimCount: Number(e.victimCount || 0),
        timeOfDay: e.timeOfDay || 'both'
      }));
      await GameEvent.insertMany(docs);
    } else {
      await new GameEvent({ 
        ...data, 
        userId,
        survivorCount: Number(data.survivorCount || 1),
        victimCount: Number(data.victimCount || 0),
        timeOfDay: data.timeOfDay || 'both'
      }).save();
    }
    res.json({ message: "이벤트가 저장되었습니다." });
  } catch (err) { 
    res.status(500).json({ error: "저장 실패" }); 
  }
});

// 3. 순서 재정렬 및 일괄 업데이트
router.put('/reorder', async (req, res) => {
  try {
    const userId = req.user.id;
    // 내 이벤트만 삭제 후 재등록
    await GameEvent.deleteMany({ userId });
    const docs = req.body.map(e => ({ 
      ...e, 
      userId, 
      _id: undefined,
      survivorCount: Number(e.survivorCount || 1),
      victimCount: Number(e.victimCount || 0),
      timeOfDay: e.timeOfDay || 'both'
    }));
    if (docs.length > 0) await GameEvent.insertMany(docs);
    res.json({ message: "순서가 변경되었습니다." });
  } catch (err) { 
    res.status(500).json({ error: "정렬 저장 실패" }); 
  }
});

// server/routes/events.js (권장)

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // ★ 프론트에서 보낸 모든 데이터를 구조 분해 할당으로 받습니다.
    const { text, type, survivorCount, victimCount, timeOfDay, mapId, zoneId, conditions, image } = req.body;

	    const setDoc = {
	      text: String(text),
	      type: type || 'normal',
	      survivorCount: Number(survivorCount || 1),
	      victimCount: Number(victimCount || 0),
	      timeOfDay: timeOfDay || 'both',
	      conditions: conditions || {},
	    };
	    const unsetDoc = {};
	    if (mapId) setDoc.mapId = String(mapId); else unsetDoc.mapId = 1;
	    if (zoneId) setDoc.zoneId = String(zoneId); else unsetDoc.zoneId = 1;
	    if (image) setDoc.image = String(image); else unsetDoc.image = 1;

    const updated = await GameEvent.findOneAndUpdate(
      { _id: req.params.id, userId }, 
	      Object.keys(unsetDoc).length ? { $set: setDoc, $unset: unsetDoc } : { $set: setDoc },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "이벤트가 없거나 권한이 없습니다." });
    res.json({ message: "성공적으로 수정되었습니다!", event: updated });
  } catch (err) {
    res.status(500).json({ error: "수정 중 서버 오류가 발생했습니다." });
  }
});

// 5. 개별 삭제
router.delete('/:id', async (req, res) => {
  try {
    await GameEvent.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: "삭제 완료" });
  } catch (err) { 
    res.status(500).json({ error: "삭제 실패" }); 
  }
});

module.exports = router;