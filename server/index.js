require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken'); 
const { GoogleGenerativeAI } = require("@google/generative-ai");



// ==================================================================
// 1. 모델 불러오기
// ==================================================================

// (1) 외부 파일 모델들 (제공해주신 파일명 기준)
const User = require('./models/User');
const Character = require('./models/Characters'); // 또는 Characters.js
// ★ [수정됨] 방금 만드신 고성능 설정 모델 연결!
const GameSettings = require('./models/GameSettings'); 

// (2) 인라인 모델 (파일이 없다면 유지)
const GameLogSchema = new mongoose.Schema({
  title: String, fullLog: [String], winnerName: String, participants: Array, date: { type: Date, default: Date.now }
});
const GameLog = mongoose.models.GameLog || mongoose.model('GameLog', GameLogSchema);

const EventSchema = new mongoose.Schema({ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 추가
    text: String, 
    type: { type: String, default: 'normal' }, 
    image: String 
});
const GameEvent = mongoose.models.GameEvent || mongoose.model('GameEvent', EventSchema);


// ==================================================================
// 2. 서버 설정
// ==================================================================
const app = express();
// Render/배포 환경에서는 PORT가 주입될 수 있으니 환경변수 우선
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*', // 일단 모든 곳에서 접속 허용 (보안을 위해 나중에 프론트 도메인으로 변경 추천)
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const DB_URI = process.env.MONGO_URI

mongoose.connect(DB_URI)
  .then(() => console.log('💾 MongoDB 연결 성공!'))
  .catch(err => console.log('⚠️ DB 연결 실패:', err.message));


// ==================================================================
// 4. API 라우트
// ==================================================================

// ★ [수정] 긴 코드를 지우고, 이렇게 한 줄로 불러옵니다!
// (verifyAdmin도 필요하면 같이 불러옵니다)
const { verifyToken } = require('./middleware/authMiddleware'); 

// ...
// 라우트 사용 부분
app.use('/api/admin', verifyToken, require('./routes/admin')); // 이제 잘 작동합니다.

app.use('/api/auth', require('./routes/auth')); 

// ✅ 이 코드를 추가해서 characters.js 파일을 활성화하세요!
app.use('/api/characters', require('./routes/characters'));

// (2) ★ [업그레이드] 개인별 게임 설정 API (GameSettings 모델 사용)
app.get('/api/settings', verifyToken, async (req, res) => {
  try {
    // 내 아이디로 된 설정이 있는지 찾습니다.
    let settings = await GameSettings.findOne({ userId: req.user.id });
    
    if (!settings) {
      // 없으면 기본값으로 새로 만들어줍니다.
      settings = new GameSettings({ userId: req.user.id });
      await settings.save();
    }
    res.json(settings);
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: "설정 로드 실패" }); 
  }
});

app.put('/api/settings', verifyToken, async (req, res) => {
  try {
    // 내 설정을 찾아서 업데이트합니다. (없으면 생성, 있으면 수정 - upsert)
    const updatedSettings = await GameSettings.findOneAndUpdate(
      { userId: req.user.id },
      { ...req.body, userId: req.user.id, updatedAt: Date.now() }, // 내용은 덮어쓰고, 주인은 나로 고정
      { new: true, upsert: true } // 옵션: 업데이트 후 새 값 리턴, 없으면 생성
    );
    res.json({ message: "설정 저장 완료", settings: updatedSettings });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: "설정 저장 실패" }); 
  }
});


// (3) 이벤트 API
app.get('/api/events', verifyToken, async (req, res) => {
  try { 
    // 내 아이디가 일치하는 이벤트만 가져오기
    res.json(await GameEvent.find({ userId: req.user.id })); 
  } catch (err) { res.status(500).json({ error: "로드 실패" }); }
});

app.post('/api/events/add', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = req.body;
    // 저장할 때 userId를 심어줍니다.
    if (Array.isArray(payload)) {
      const dataWithUser = payload.map(item => ({ ...item, userId }));
      await GameEvent.insertMany(dataWithUser);
    } else {
      await new GameEvent({ ...payload, userId }).save();
    }
    res.json({ message: "이벤트 추가 완료!" });
  } catch (err) { res.status(500).json({ error: "추가 실패" }); }
});

app.put('/api/events/reorder', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // ★ 전체 삭제({})가 아니라 내 것만 삭제({ userId }) 해야 합니다!
    await GameEvent.deleteMany({ userId }); 
    const cleanedEvents = req.body.map(evt => ({
      text: String(evt.text || ""), 
      type: evt.type || 'normal', 
      image: evt.image || null,
      userId: userId // 내 아이디 부여
    }));
    if (cleanedEvents.length > 0) await GameEvent.insertMany(cleanedEvents);
    res.json({ message: "순서 변경 완료" });
  } catch (err) { res.status(500).json({ error: "저장 실패" }); }
});

// (3-1) ★ [버그픽스] 이벤트 수정 API (프론트에서 PUT /api/events/:id 호출 중)
app.put('/api/events/:id', async (req, res) => {
  try {
    const { text, type, image } = req.body || {};

    const updated = await GameEvent.findByIdAndUpdate(
      req.params.id,
      {
        ...(text !== undefined ? { text: String(text) } : {}),
        ...(type !== undefined ? { type: String(type) } : {}),
        ...(image !== undefined ? { image: image ? String(image) : null } : {}),
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "이벤트 없음" });
    res.json({ message: "수정 완료", event: updated });
  } catch (err) {
    res.status(500).json({ error: "수정 실패" });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try { await GameEvent.findByIdAndDelete(req.params.id); res.json({ message: "삭제 완료" }); } 
  catch (err) { res.status(500).json({ error: "삭제 실패" }); }
});


// (4) AI 분석 API
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
app.post('/api/analyze', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.json({ name: "이름없음", gender: "남", stats: { str:50, agi:50, int:50, men:50, luk:50, dex:50, sht:50, end:50 } });
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `Analyze character: "${text}". Return JSON ONLY: { "name": "Name", "gender": "남/여", "stats": { "str":0-100,"agi":0-100,"int":0-100,"men":0-100,"luk":0-100,"dex":0-100,"sht":0-100,"end":0-100 } }`;
    const result = await model.generateContent(prompt);
    const textData = result.response.text().replace(/```json|```/g, "").trim();
    res.json(JSON.parse(textData));
  } catch (error) { res.json({ name: "분석실패", stats: { str:50, agi:50, int:50, men:50, luk:50, dex:50, sht:50, end:50 } }); }
});


// (5) 개인화 게임 결과 저장 API
app.post('/api/game/end', verifyToken, async (req, res) => {
  const { winnerId, killCounts, fullLogs, participants } = req.body;
  const userId = req.user.id; 

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "유저 없음" });

    // 내 도감 업데이트
    for (const p of participants) {
      if (!p._id) continue;
      const kills = killCounts[p._id] || 0;
      const isWin = p._id === winnerId;
      
      let historyEntry = user.personalHistory.find(h => h.charId === p._id);
      if (historyEntry) {
        historyEntry.totalKills += kills;
        historyEntry.gamesPlayed += 1;
        if (isWin) historyEntry.totalWins += 1;
        historyEntry.name = p.name; 
        historyEntry.image = p.image || p.previewImage;
      } else {
        user.personalHistory.push({
          charId: p._id, name: p.name, image: p.image || p.previewImage,
          totalKills: kills, totalWins: isWin ? 1 : 0, gamesPlayed: 1
        });
      }
    }
    await user.save();
    
    // 게임 로그 저장
    const logEntry = new GameLog({
      title: `제 ${Math.floor(Math.random() * 900) + 100}회 개인 아레나`,
      fullLog: fullLogs,
      winnerName: winnerId ? participants.find(p => p._id === winnerId)?.name : "없음",
      participants: participants
    });
    await logEntry.save();

    res.json({ success: true, personalHistory: user.personalHistory });

  } catch (error) {
    console.error("전적 저장 실패:", error);
    if (!res.headersSent) res.status(500).json({ error: "전적 저장 실패" });
  }
});

// (6) 명예의 전당 API
app.get('/api/rankings', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.json([]); 

    const secretKey = process.env.MY_SECRET_KEY || 'YOUR_SECRET_KEY';
    const decoded = jwt.verify(token, secretKey);
    
    const user = await User.findById(decoded.id);
    if (!user) return res.json([]);

    res.json(user.personalHistory || []); 
  } catch (err) { res.json([]); }
});

// (7) LP 수동 업데이트 API
app.post('/api/user/update-stats', verifyToken, async (req, res) => {
  try {
    const { lpEarned } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "유저 없음" });
    user.lp = (user.lp || 0) + lpEarned;
    await user.save();
    res.json({ newLp: user.lp });
  } catch (err) { res.status(500).json({ error: "LP 저장 실패" }); }
});

app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));