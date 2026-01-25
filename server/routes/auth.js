// server/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// 1. 회원가입
router.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = new User({ username, password });
        await user.save();
        res.status(201).json({ message: "회원가입 성공!" });
    } catch (err) {
        console.error(err);
        // 에러 원인을 더 구체적으로 보내줍니다.
        if (err.code === 11000) {
            return res.status(400).json({ error: "이미 존재하는 아이디입니다." });
        }
        res.status(400).json({ error: "서버 오류: " + err.message });
    }
});

// 2. 로그인
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. 유저 찾기
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "존재하지 않는 아이디입니다." });
    }

    // 2. 비밀번호 비교 (입력값 vs DB 암호화값)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "비밀번호가 일치하지 않습니다." });
    }

    // 3. 토큰 생성 (보안상 YOUR_SECRET_KEY는 나중에 .env 파일로 빼는 게 좋습니다)
    const token = jwt.sign({ id: user._id }, process.env.MY_SECRET_KEY, { expiresIn: '1d' });

    console.log("== [로그인 시도] ==");
    console.log("아이디:", user.username);
    console.log("DB isAdmin 값:", user.isAdmin);
    // 4. 성공 응답
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        lp: user.lp || 0,
        isAdmin: user.isAdmin // ★ 이 줄을 꼭 추가해야 합니다!
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

module.exports = router;