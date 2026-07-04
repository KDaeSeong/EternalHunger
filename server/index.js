require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { upsertDefaultItemTree } = require('./utils/defaultItemTree');

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어 설정
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// DB 연결
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('💾 MongoDB 연결 성공!');
    try {
      // ✅ 기본 아이템/레시피 트리 자동 시드(빈 DB 대비)
      await upsertDefaultItemTree({ mode: 'missing' });
      console.log('🌱 기본 아이템 트리 시드 완료');
    } catch (e) {
      console.log('⚠️ 기본 아이템 트리 시드 실패:', e?.message || e);
    }
  })
  .catch(err => console.log('⚠️ DB 연결 실패:', err.message));

// 라우터 연결 (분업화)
const { verifyToken } = require('./middleware/authMiddleware');

app.use('/api/auth', require('./routes/auth'));                 // 로그인/회원가입
app.use('/api/admin', verifyToken, require('./routes/admin'));  // 관리자 (아이템/맵/키오스크 등)
app.use('/api/characters', verifyToken, require('./routes/characters')); // 캐릭터
app.use('/api/settings', verifyToken, require('./routes/settings'));     // 게임 설정
app.use('/api/game', verifyToken, require('./routes/game'));             // 게임 로그
app.use('/api/game-saves', verifyToken, require('./routes/gameSaves'));  // 게임별 저장 슬롯
app.use('/api/game-records', verifyToken, require('./routes/gameRecords')); // 게임별 공통 기록
app.use('/api/records', verifyToken, require('./routes/records'));       // 기록소
app.use('/api/analytics', verifyToken, require('./routes/analytics'));   // 분석실
app.use('/api/user', verifyToken, require('./routes/user'));             // 유저 (보상/전적/크레딧 등)
app.use('/api/achievements', verifyToken, require('./routes/achievements')); // 업적/시즌
app.use('/api/credits', verifyToken, require('./routes/credits'));         // 크레딧
app.use('/api/perks', verifyToken, require('./routes/perks'));             // 특전 구매/관리
app.use('/api/reports', verifyToken, require('./routes/reports'));         // 신고/관리
app.use('/api/notifications', verifyToken, require('./routes/notifications')); // 알림

// ✅ 아이템/거래/상점 행동(로드맵 1,3,4)
app.use('/api/items', verifyToken, require('./routes/items'));             // 조합 등
app.use('/api/kiosks', verifyToken, require('./routes/kiosks'));           // 키오스크 거래
app.use('/api/drone', verifyToken, require('./routes/drone'));             // 드론 구매
app.use('/api/trades', verifyToken, require('./routes/trades'));           // 아이템 교환

// ✅ 공개 API(비로그인 허용) — 메인 화면 랭킹/게시판 조회 등에 사용
app.use('/api/rankings', require('./routes/rankings'));                   // 랭킹
app.use('/api/posts', require('./routes/posts'));                         // 게시판
app.use('/api/public', require('./routes/public'));                       // 아이템/맵/키오스크 조회
app.use('/api/twenty-questions', require('./routes/twentyQuestions'));     // 스무고개
// AI 분석 (공용 서비스라 여기 둠)
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const analyzeRateBuckets = new Map();
const ANALYZE_WINDOW_MS = toPositiveInt(process.env.ANALYZE_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);
const ANALYZE_MAX_REQUESTS = toPositiveInt(process.env.ANALYZE_RATE_LIMIT_MAX, 12);
const ANALYZE_MAX_TEXT_LENGTH = toPositiveInt(process.env.ANALYZE_MAX_TEXT_LENGTH, 3000);

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function cleanAnalyzeText(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim();
}

function pruneAnalyzeBuckets(now) {
  if (analyzeRateBuckets.size < 500) return;
  for (const [key, bucket] of analyzeRateBuckets.entries()) {
    if (!bucket || bucket.resetAt <= now) analyzeRateBuckets.delete(key);
  }
}

function checkAnalyzeRateLimit(req) {
  const now = Date.now();
  const key = `user:${req.user?.id || req.user?._id || req.ip || 'unknown'}`;
  let bucket = analyzeRateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + ANALYZE_WINDOW_MS };
    analyzeRateBuckets.set(key, bucket);
  }
  pruneAnalyzeBuckets(now);
  if (bucket.count >= ANALYZE_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

app.post('/api/analyze', verifyToken, async (req, res) => {
  try {
    const text = cleanAnalyzeText(req.body?.text);
    if (!text) {
      return res.status(400).json({ error: '분석할 텍스트를 입력해주세요.' });
    }
    if (text.length > ANALYZE_MAX_TEXT_LENGTH) {
      return res.status(413).json({ error: `분석 텍스트는 ${ANALYZE_MAX_TEXT_LENGTH.toLocaleString('ko-KR')}자 이내로 입력해주세요.` });
    }

    const rate = checkAnalyzeRateLimit(req);
    if (!rate.allowed) {
      res.set('Retry-After', String(rate.retryAfterSec));
      return res.status(429).json({
        error: `AI 분석 요청이 너무 잦습니다. ${rate.retryAfterSec}초 후 다시 시도해주세요.`,
        retryAfterSec: rate.retryAfterSec,
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `Analyze character: "${text}". Return JSON ONLY: { "name": "Name", "gender": "남/여", "stats": { "maxHp":1-999,"hpGrowth":0-20,"attackPower":0-200,"attackPowerGrowth":0-20,"skillAmp":0-200,"skillAmpGrowth":0-20,"defense":0-200,"defenseGrowth":0-20,"attackSpeed":0.1-3,"attackSpeedGrowth":0-1,"attackRange":0.5-10,"sightRange":1-20 } }`;
    const result = await model.generateContent(prompt);
    res.json(JSON.parse(result.response.text().replace(/```json|```/g, "").trim()));
  } catch (error) { res.json({ name: "분석실패", stats: { maxHp:100, hpGrowth:4, attackPower:24, attackPowerGrowth:1.4, skillAmp:0, skillAmpGrowth:1.1, defense:14, defenseGrowth:0.8, attackSpeed:0.72, attackSpeedGrowth:0.015, attackRange:1.5, sightRange:8 } }); }
});

app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));
