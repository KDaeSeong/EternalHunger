// server/routes/characters.js 수정

const { verifyToken } = require('../middleware/authMiddleware'); // 미들웨어 불러오기

// 1. 목록 불러오기 (내 것만)
router.get('/', verifyToken, async (req, res) => {
  try {
    const characters = await Character.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(characters);
  } catch (err) { res.status(500).json({ error: "불러오기 실패" }); }
});

// 2. 저장 로직 (필터링 추가)
router.post('/save', verifyToken, async (req, res) => {
  try {
    const charList = req.body;
    const userId = req.user.id;

    const incomingIds = charList.filter(c => c._id).map(c => c._id);
    // ★ 내 캐릭터들 중에서만 삭제 수행
    await Character.deleteMany({ userId, _id: { $nin: incomingIds } });

    for (const char of charList) {
      if (char._id) {
        // 내 캐릭터인지 확인하며 업데이트
        await Character.findOneAndUpdate({ _id: char._id, userId }, char);
      } else {
        const { _id, ...newCharData } = char; 
        await new Character({ ...newCharData, userId }).save();
      }
    }
    res.json({ message: "저장 완료", count: charList.length });
  } catch (err) { res.status(500).json({ error: "저장 실패" }); }
});