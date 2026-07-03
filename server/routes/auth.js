// server/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

function normalizeNickname(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

function publicUser(user) {
  return {
    id: user._id,
    _id: user._id,
    username: user.username,
    nickname: user.nickname || '',
    lp: Number(user.lp || 0),
    credits: Number(user.credits || 0),
    perks: Array.isArray(user.perks) ? user.perks : [],
    isAdmin: Boolean(user.isAdmin),
  };
}

router.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    const nickname = normalizeNickname(req.body?.nickname);
    if (nickname && (nickname.length < 2 || nickname.length > 20)) {
      return res.status(400).json({ error: '닉네임은 2~20자로 입력해주세요.' });
    }

    const user = new User({ username, password, nickname });
    await user.save();
    res.status(201).json({ message: '회원가입 성공' });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ error: '이미 존재하는 아이디입니다.' });
    }
    res.status(400).json({ error: `회원가입 실패: ${err.message}` });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: '존재하지 않는 아이디입니다.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });

    const token = jwt.sign({ id: user._id }, process.env.MY_SECRET_KEY, { expiresIn: '1d' });
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '로그인 실패' });
  }
});

module.exports = router;
