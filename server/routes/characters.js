// server/routes/characters.js 수정

const { verifyToken } = require('../middleware/authMiddleware'); // 미들웨어 불러오기

// server/routes/characters.js
const express = require('express');
const router = express.Router();
const Character = require('../models/Characters');

// 1. 캐릭터 목록 불러오기 (GET /api/characters)
router.get('/', verifyToken, async (req, res) => { // verifyToken 추가
  try {
    const characters = await Character.find({ userId: req.user.id }); // 내 것만 찾기
    res.json(characters);
  } catch (err) { res.status(500).json({ error: "불러오기 실패" }); }
});

// 2. 캐릭터 리스트 통째로 저장하기 (POST /api/characters/save)
router.post('/save', verifyToken, async (req, res) => {
  try {
    const charList = req.body;
    const userId = req.user.id;

    // 1. 내 캐릭터들 중에서만 요청에 없는 것 삭제
    const incomingIds = charList.filter(c => c._id).map(c => c._id);
    await Character.deleteMany({ userId, _id: { $nin: incomingIds } });

    // 2. 저장 시 userId 포함
    for (const char of charList) {
      if (char._id) {
        await Character.findOneAndUpdate({ _id: char._id, userId }, char);
      } else {
        const { _id, ...newCharData } = char;
        await new Character({ ...newCharData, userId }).save(); // userId 부여
      }
    }
    res.json({ message: "저장 완료" });
  } catch (err) { /* 에러 처리 */ }
});

module.exports = router;