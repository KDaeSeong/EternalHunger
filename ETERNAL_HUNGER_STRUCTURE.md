# Eternal Hunger 구조/실행 체크 메모

## 핵심 구조
- client/src/utils/api.js : 공용 API 베이스/토큰/요청 유틸
- client/src/app/login/page.js : 로그인
- client/src/app/signup/page.js : 회원가입
- client/src/app/simulation/page.js : 시뮬레이션 진입/초기 로드
- client/src/app/details/page.js : 캐릭터 상세/설정
- server/index.js : 서버 엔트리
- server/routes/auth.js : 인증 라우트

## 필요한 파일
- server/.env
- client/.env.local
- server/package.json
- client/package.json
- client/src/utils/api.js
- client/src/app/login/page.js
- client/src/app/signup/page.js
- client/src/app/simulation/page.js

## 환경값 예시
- server/.env
  - MONGO_URI=...
  - MY_SECRET_KEY=...
  - PORT=5000
- client/.env.local
  - NEXT_PUBLIC_API_BASE=http://localhost:5000/api

## 실행 순서
1. server에서 npm install / npm run dev
2. client에서 npm install / npm run dev
3. /signup → /login → /simulation 순서 확인


## 추가 문서
- ETERNAL_HUNGER_REMAINING_TASKS.md : 남은 작업 우선순위 목록


## 최근 STEP A 핫픽스
- `client/src/app/simulation/page.js`
  - `pickAutoTranscendOption` 문법 오류 복구 (`function scored...` → `const scored = ...`)
  - 목적: Vercel/Next.js Turbopack 파싱 에러 제거

## 이번 ZIP에서 바로 봐야 할 파일
- `client/src/app/simulation/page.js`
- `client/package.json`
- `client/scripts/fix-proxy-migration.js`
- `ETERNAL_HUNGER_STRUCTURE.md`
- `ETERNAL_HUNGER_REMAINING_TASKS.md`

- 2026-03-15 stepA115: simulation/page.js 키오스크 카탈로그 조회부의 문법 파손(`function kioskDoc(...).find`)을 `const kioskDoc = ...find(...)`로 복구.
