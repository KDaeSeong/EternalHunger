require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어 설정
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));

// DB 연결
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('💾 MongoDB 연결 성공!'))
  .catch(err => console.log('⚠️ DB 연결 실패:', err.message));

// 라우터 연결 (분업화)
const { verifyToken } = require('./middleware/authMiddleware');

app.use('/api/auth', require('./routes/auth'));           // 로그인/회원가입
app.use('/api/admin', verifyToken, require('./routes/admin')); // 관리자 (맵, 아이템)
app.use('/api/characters', verifyToken, require('./routes/characters')); // 캐릭터
app.use('/api/events', verifyToken, require('./routes/events')); // ★ 신규 이벤트 라우터
app.use('/api/settings', verifyToken, require('./routes/settings')); // 보정치

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