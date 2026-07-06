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
app.use('/api/admin', require('./routes/admin'));  // 관리자 (아이템/맵/키오스크 등)
app.use('/api/characters', verifyToken, require('./routes/characters')); // 캐릭터
app.use('/api/settings', verifyToken, require('./routes/settings'));     // 게임 설정
app.use('/api/game', verifyToken, require('./routes/game'));             // 게임 로그
app.use('/api/game-saves', verifyToken, require('./routes/gameSaves'));  // 게임별 저장 슬롯
app.use('/api/game-records', verifyToken, require('./routes/gameRecords')); // 게임별 공통 기록
app.use('/api/game-rooms', require('./routes/gameRooms'));                // 게임별 공통 방/매치
app.use('/api/tcg', require('./routes/tcg'));                            // TCG cards/decks
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
app.use('/api/analyze', verifyToken, require('./routes/analyze'));         // AI 분석

app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));
