// server/routes/characters.js
const express = require('express');
const router = express.Router();
const Character = require('../models/Characters');
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
    const charList = req.body;
    const userId = req.user.id; // ★ 토큰에서 추출한 유저 ID

    const incomingIds = charList.filter(c => c._id).map(c => c._id);
    
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

module.exports = router;