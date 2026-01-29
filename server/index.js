require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어 설정
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// DB 연결
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('💾 MongoDB 연결 성공!'))
  .catch(err => console.log('⚠️ DB 연결 실패:', err.message));

// 라우터 연결 (분업화)
const { verifyToken } = require('./middleware/authMiddleware');

app.use('/api/auth', require('./routes/auth'));                 // 로그인/회원가입
app.use('/api/admin', verifyToken, require('./routes/admin'));  // 관리자 (아이템/맵/키오스크 등)
app.use('/api/characters', verifyToken, require('./routes/characters')); // 캐릭터
app.use('/api/events', verifyToken, require('./routes/events'));         // 이벤트
app.use('/api/settings', verifyToken, require('./routes/settings'));     // 게임 설정
app.use('/api/game', verifyToken, require('./routes/game'));             // 게임 로그
app.use('/api/user', verifyToken, require('./routes/user'));             // 유저 (보상/전적/크레딧 등)
app.use('/api/credits', verifyToken, require('./routes/credits'));         // 크레딧
app.use('/api/perks', verifyToken, require('./routes/perks'));             // 특전 구매/관리

// ✅ 아이템/거래/상점 행동(로드맵 1,3,4)
app.use('/api/items', verifyToken, require('./routes/items'));             // 조합 등
app.use('/api/kiosks', verifyToken, require('./routes/kiosks'));           // 키오스크 거래
app.use('/api/drone', verifyToken, require('./routes/drone'));             // 드론 구매
app.use('/api/trades', verifyToken, require('./routes/trades'));           // 아이템 교환

// ✅ 공개 API(비로그인 허용) — 메인 화면 랭킹/게시판 조회 등에 사용
app.use('/api/rankings', require('./routes/rankings'));                   // 랭킹
app.use('/api/posts', require('./routes/posts'));                         // 게시판
app.use('/api/public', require('./routes/public'));                       // 아이템/맵/키오스크 조회
// AI 분석 (공용 서비스라 여기 둠)
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

app.post('/api/analyze', async (req, res) => {
  try {
    const { text } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `Analyze character: "${text}". Return JSON ONLY: { "name": "Name", "gender": "남/여", "stats": { "str":0-100,"agi":0-100,"int":0-100,"men":0-100,"luk":0-100,"dex":0-100,"sht":0-100,"end":0-100 } }`;
    const result = await model.generateContent(prompt);
    res.json(JSON.parse(result.response.text().replace(/```json|```/g, "").trim()));
  } catch (error) { res.json({ name: "분석실패", stats: { str:50, agi:50, int:50, men:50, luk:50, dex:50, sht:50, end:50 } }); }
});

app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));
