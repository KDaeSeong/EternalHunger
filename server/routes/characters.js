// server/routes/characters.js
const express = require('express');
const router = express.Router();
const Character = require('../models/Characters');
const Item = require('../models/Item');
const { buildItemNameMap, normalizeInventory } = require('../utils/inventory');
const { verifyToken } = require('../middleware/authMiddleware'); // ★ 추가

// 모든 요청에 대해 토큰 검증
router.use(verifyToken);

// 1. 캐릭터 목록 불러오기 (내 것만)
router.get('/', async (req, res) => {
  try {
    const characters = await Character.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(characters);
  } catch (err) {
    res.status(500).json({ error: "불러오기 실패" });
  }
});

// 2. 캐릭터 저장 (userId 부여)
router.post('/save', async (req, res) => {
  try {
    const charList = Array.isArray(req.body) ? req.body : [];
    const userId = req.user.id; // ★ 토큰에서 추출한 유저 ID

    // ✅ 인벤토리 정규화(legacy -> itemId)
    const items = await Item.find({}, '_id name');
    const itemNameMap = buildItemNameMap(items);

    for (const c of charList) {
      if (c?.inventory) c.inventory = normalizeInventory(c.inventory, itemNameMap, { merge: true });
    }

    const incomingIds = charList.filter(c => c && c._id).map(c => c._id);
    
    // 내 캐릭터 중에서만 삭제/수정 수행
    await Character.deleteMany({ userId, _id: { $nin: incomingIds } });

    for (const char of charList) {
      if (char._id) {
        await Character.findOneAndUpdate({ _id: char._id, userId }, char);
      } else {
        const { id, _id, ...newCharData } = char; 
        await new Character({ ...newCharData, userId }).save(); // ★ userId 부여 필수!
      }
    }
    res.json({ message: "저장 완료" });
  } catch (err) {
    res.status(500).json({ error: "저장 실패: " + err.message });
  }
});

// ✅ 인벤토리 정규화 단독 엔드포인트(요청: legacy -> itemId 매핑)
// POST /api/characters/normalize-inventory { characterId? }
router.post('/normalize-inventory', async (req, res) => {
  try {
    const userId = req.user.id;
    const characterId = req.body?.characterId;

    const items = await Item.find({}, '_id name');
    const itemNameMap = buildItemNameMap(items);

    const query = { userId };
    if (characterId) query._id = characterId;

    const chars = await Character.find(query);
    let updated = 0;

    for (const ch of chars) {
      const before = JSON.stringify(ch.inventory || []);
      ch.inventory = normalizeInventory(ch.inventory, itemNameMap, { merge: true });
      ch.markModified('inventory');
      const after = JSON.stringify(ch.inventory || []);
      if (before !== after) {
        await ch.save();
        updated++;
      }
    }

    res.json({ message: '정규화 완료', updated, total: chars.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '정규화 실패' });
  }
});

module.exports = router;