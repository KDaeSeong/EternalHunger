// server/middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // 헤더에서 토큰을 가져옵니다.
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }

  try {
    // 토큰이 진짜인지 검사 (비밀키는 auth.js에서 썼던 것과 같아야 합니다)
    const decoded = jwt.verify(token, process.env.MY_SECRET_KEY);
    req.user = decoded; // 유저 ID를 요청 객체에 심어줍니다.
    next(); // 통과!
  } catch (err) {
    res.status(401).json({ error: "유효하지 않은 토큰입니다." });
  }
};