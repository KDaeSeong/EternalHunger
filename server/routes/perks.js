// server/routes/perks.js
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Perk = require('../models/Perk');

/**
 * 🎖️ 특전 시스템(로드맵 7번)
 * - lp를 소모해 특전(버프/꾸미기)을 구매
 */

// 전체 특전 목록(로그인 유저 UI에서 사용)
router.get('/available', async (req, res) => {
  try {
    const perks = await Perk.find({ isActive: true }).sort({ lpCost: 1 });
    res.json(perks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '특전 로드 실패' });
  }
});

// 구매
router.post('/purchase', async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim();
    if (!code) return res.status(400).json({ error: 'code가 필요합니다.' });

    const perk = await Perk.findOne({ code, isActive: true });
    if (!perk) return res.status(404).json({ error: '특전을 찾을 수 없습니다.' });

    // 이미 구매했는지 확인 + LP 차감
    const user = await User.findOne({ _id: req.user.id });
    if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });

    if (user.perks?.includes(code)) {
      return res.json({ message: '이미 구매한 특전입니다.', lp: user.lp, perks: user.perks });
    }

    if (user.lp < perk.lpCost) {
      return res.status(400).json({ error: 'LP가 부족합니다.' });
    }

    user.lp -= perk.lpCost;
    user.perks = [...(user.perks || []), code];
    await user.save();

    res.json({ message: '특전 구매 완료', lp: user.lp, perks: user.perks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '특전 구매 실패' });
  }
});

module.exports = router;
