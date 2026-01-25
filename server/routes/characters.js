// server/routes/characters.js
const express = require('express');
const router = express.Router();
const Character = require('../models/Characters');

// 1. 캐릭터 목록 불러오기 (GET /api/characters)
router.get('/', async (req, res) => {
  try {
    const characters = await Character.find().sort({ createdAt: -1 });
    res.json(characters);
  } catch (err) {
    res.status(500).json({ error: "불러오기 실패" });
  }
});

// 2. 캐릭터 리스트 통째로 저장하기 (POST /api/characters/save)
router.post('/save', async (req, res) => {
  try {
    const charList = req.body; // 프론트에서 보낸 캐릭터 배열

    // [스마트 동기화 로직]
    
    // Step 1: 요청된 리스트에 있는 유효한 _id들만 추출
    const incomingIds = charList
      .filter(c => c._id) // _id가 있는 것만
      .map(c => c._id);

    // Step 2: DB에는 있지만, 요청 리스트에는 없는(삭제된) 캐릭터들을 DB에서 삭제
    // (프론트에서 '삭제' 버튼 누른 애들을 여기서 진짜 지워줌)
    await Character.deleteMany({ _id: { $nin: incomingIds } });

    // Step 3: 하나씩 순회하며 "업데이트" 또는 "새로 생성"
    let savedCount = 0;
    
    for (const char of charList) {
      if (char._id) {
        // ID가 있으면 -> 기존 정보 업데이트
        await Character.findByIdAndUpdate(char._id, char);
      } else {
        // ID가 없으면(임시 ID인 경우) -> 새로 생성
        // (temp id인 'id' 필드는 버리고 나머지로 생성)
        const { id, _id, ...newCharData } = char; 
        await new Character(newCharData).save();
      }
      savedCount++;
    }

    res.json({ message: "저장 완료", count: savedCount });

  } catch (err) {
    console.error("저장 에러:", err);
    res.status(500).json({ error: "저장 중 오류 발생: " + err.message });
  }
});

module.exports = router;