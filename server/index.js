require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { upsertDefaultItemTree } = require('./utils/defaultItemTree');
const { buildCorsOptions, getHttpConfig, validateRuntimeEnv } = require('./config/runtimeConfig');

const app = express();
const HTTP_CONFIG = getHttpConfig();
const PORT = HTTP_CONFIG.port;

// 미들웨어 설정
app.disable('x-powered-by');
app.set('trust proxy', HTTP_CONFIG.trustProxy);
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: HTTP_CONFIG.jsonBodyLimit }));
app.use(express.urlencoded({ limit: HTTP_CONFIG.jsonBodyLimit, extended: true }));

// 라우터 연결 (분업화)
const { verifyToken } = require('./middleware/authMiddleware');

app.use('/api/auth', require('./routes/auth'));                 // 로그인/회원가입
app.use('/api', require('./routes/securityGateway'));             // 클라이언트 보상 위조 차단/미검증 경기 멱등 저장
app.use('/api/admin', require('./routes/admin'));  // 관리자 (아이템/맵/키오스크 등)
app.use('/api/characters', verifyToken, require('./routes/characters')); // 캐릭터
app.use('/api/settings', verifyToken, require('./routes/settings'));     // 게임 설정
app.use('/api/game', verifyToken, require('./routes/game'));             // 게임 로그
app.use('/api/game-saves', verifyToken, require('./routes/gameSaves'));  // 게임별 저장 슬롯
app.use('/api/game-records', verifyToken, require('./routes/gameRecords')); // 게임별 공통 기록
app.use('/api/game-rooms', require('./routes/gameRoomSecurityOverrides')); // 비공개 초대/원자적 revision
app.use('/api/game-rooms', require('./routes/gameRooms'));                // 게임별 공통 방/매치
app.use('/api/tcg', require('./routes/tcg'));                            // TCG cards/decks
app.use('/api/records', verifyToken, require('./routes/records'));       // 기록소
app.use('/api/analytics', verifyToken, require('./routes/analytics'));   // 분석실
app.use('/api/user', verifyToken, require('./middleware/passwordPolicyGuard'), require('./routes/user')); // 유저
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
app.use('/api/public', require('./routes/readiness'));                    // DB readiness
app.use('/api/public', require('./routes/public'));                       // 아이템/맵/키오스크 조회
app.use('/api/twenty-questions', require('./routes/twentyQuestions'));     // 스무고개
app.use('/api/analyze', verifyToken, require('./routes/analyze'));         // AI 분석

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.code === 'CORS_ORIGIN_DENIED') {
    return res.status(403).json({ error: error.message, code: error.code });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: '요청 본문이 허용 크기를 초과했습니다.', code: 'BODY_TOO_LARGE' });
  }
  console.error('요청 처리 실패:', error);
  return res.status(500).json({ error: '서버 요청 처리에 실패했습니다.' });
});

async function startServer() {
  validateRuntimeEnv();
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 10000),
  });
  console.log('MongoDB 연결 성공');
  await upsertDefaultItemTree({ mode: 'missing' });
  console.log('기본 아이템 트리 시드 완료');
  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  return server;
}

if (require.main === module) {
  startServer()
    .then((server) => {
      const shutdown = () => {
        server.close(async () => {
          await mongoose.disconnect();
          process.exit(0);
        });
      };
      process.once('SIGTERM', shutdown);
      process.once('SIGINT', shutdown);
    })
    .catch(async (error) => {
      console.error('서버 기동 실패:', error?.message || error);
      await mongoose.disconnect().catch(() => {});
      process.exitCode = 1;
    });
}

module.exports = { app, startServer };
