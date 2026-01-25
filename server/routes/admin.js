const express = require('express');
const router = express.Router();
const User = require('../models/User');

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

module.exports = router;