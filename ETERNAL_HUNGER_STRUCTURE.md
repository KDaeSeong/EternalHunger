# Eternal Hunger 구조/실행 체크 메모

## 핵심 구조
- client/src/utils/api.js : 공용 API 베이스/토큰/요청 유틸
- client/src/utils/client-auth.js : auth/localStorage snapshot 훅(useSyncExternalStore)
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

- BUILD_CHECK_GUIDE.md : 로컬/Vercel 기준 빌드 체크 명령, 로그 확인 위치, 예상 에러 포인트
- client/scripts/check-build-local.sh : 로컬 빌드 체크용 셸 스크립트
- client/scripts/check-build-local.cmd : 윈도우 로컬 빌드 체크용 배치 스크립트

## 최근 핫픽스
- stepA116: client/src/app/simulation/page.js 내 파싱 오류 2건 복구(scored/kioskDoc 선언부)

- stepA117: simulation/page.js 파싱 오류 1건(missNeedCount 선언부) 복구

- stepA118: simulation/page.js useMemo/safeRenderCompute 닫힘 구문 4건(gainSourceSummary, creditSourceSummary, gainDetailSummary, specialSourceSummary) 복구


- stepA119: simulation/page.js useMemo/safeRenderCompute 닫힘 구문 8건(runProgressSummary, runSupportSummary, runActionSummary, topRankedCharacters, zonePos, zoneEdges, recentPings, detonationRiskSummary) 복구

- stepA120: simulation/page.js detonationRiskSummary useMemo/safeRenderCompute closing parse hotfix (`});` + deps split -> `}), [deps]);`).

- stepA121: 실제 빌드 실행 대신 BUILD_CHECK_GUIDE 및 로컬 빌드 체크 스크립트 추가(check:build:local / check-build-local.sh / .cmd).
## stepA122
- build check executed in container
- removed next/font/google dependency from client/src/app/layout.js
- defined CSS fallback vars in client/src/app/globals.css
- added BUILD_CHECK_RESULT.md with actual build-check findings



## stepA123
- build check re-executed
- `npm ci --no-audit --no-fund` + `npm run build` actual run confirmed compile success and page-data collection entry
- added `BUILD_CHECK_LATEST_LOG_SNIPPET.txt`
- improved local/ci build-check scripts in `client/package.json` and `client/scripts/check-build-local.*`

---

## stepA124
- 빌드 체킹 실제 시행: `client`에서 `npm ci --no-audit --no-fund` 후 `npm run build` 통과.
- 안정화 패치: `client/next.config.mjs`에 `experimental.cpus: 2` 추가.
- 효과: `Collecting page data using 55 workers` → `2 workers`로 줄어 빌드 완료.


## stepA125
- JS 오류 검증 실제 시행
- `client`: `npm run build` 통과, `npm run lint -- .`로 lint 현황 수집
- `server`: `node --check` 전체 JS 파일 45개 통과
- `client/src/app/simulation/page.js` 내부 helper `useTac` -> `applyTacUse` rename
- `client/eslint.config.mjs`에 generated preview file ignore 추가
- `client/src/app/admin/import/_components/ImportClient.jsx`의 `"data"` 텍스트 escape 처리
- `JS_VALIDATION_RESULT.md`, `JS_VALIDATION_LINT_SNIPPET.txt`, `scripts/check-js-errors.*` 추가


## stepA126
- `client/src/utils/client-auth.js` 추가
- AdminGuard/board/admin 초기화 effect의 sync setState 제거
- lint error 0건, `client` build 통과, `server` JS 문법 체크 통과

- scripts/check-runtime-errors.sh : strict eslint(no-undef/no-use-before-define) + client build + server syntax check
- scripts/check-runtime-errors.cmd : Windows용 runtime risk 체크 스크립트
- RUNTIME_ERROR_SWEEP_RESULT.md : uncaught runtime risk 전수 체크 결과


## stepA128
- simulation/page.js 런타임 shadow 변수 전수 정리(legendaryWeights/nightDay/battleSettings/lastWinner/summarizeEquipTier/skirmishWinner/combatWinner/hyperloopSelectedChar).
- strict runtime 체크 스크립트를 `no-shadow`, `no-redeclare` 포함 형태로 강화.
- `client` build 통과, `server` JS 문법 체크 통과.

## stepA129
- simulation/page.js: runtime error capture(window error/unhandledrejection), fetchData unhandled catch, early derived useMemo safeRenderCompute 보호 적용.
- runtime sweep/build result 문서 추가.
