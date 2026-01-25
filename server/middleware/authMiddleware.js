// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "로그인이 필요합니다." });

  const secretKey = process.env.MY_SECRET_KEY;
  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) return res.status(403).json({ error: "유효하지 않은 토큰입니다." });
    req.user = decoded; 
    next();
  });
};

const verifyAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (user && user.isAdmin) {
            next(); // 관리자 맞음! 통과
        } else {
            return res.status(403).json({ error: "🚨 관리자 권한이 없습니다." });
        }
    } catch (err) {
        res.status(500).json({ error: "서버 인증 오류" });
    }
};

module.exports = { verifyToken, verifyAdmin };