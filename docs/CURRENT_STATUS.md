# Eternal Hunger 현재 구현 현황

- 기준일: 2026-08-23 KST
- 기준 브랜치/커밋: `main` / `00d534fa`
- 분석 범위: Git이 추적하는 `client`, `server`, `client/scripts`, 루트 및 `docs` 문서
- 제외 범위: 추적되지 않은 `myanime/`, 실제 MongoDB 데이터 품질, 외부 배포 환경, 실사용 부하
- 연계 문서: [기능 요구사항](./FUNCTIONAL_REQUIREMENTS.md), [비기능 요구사항](./NON_FUNCTIONAL_REQUIREMENTS.md), [결함대장](./DEFECT_REGISTER.md)


## 0. 결함 수정 후 최신 판정

아래 1절 이후의 내용은 최초 실코드 분석 스냅샷이며, 이 절과 최신 [결함대장](./DEFECT_REGISTER.md)이 후속 수정 결과를 우선합니다.

| 영역 | 최신 상태 |
|---|---|
| P0 경제 무결성 | 클라이언트 직접 크레딧·전적 API 선차단, 미검증 경기 보상 0, `clientRunId` 12중 병렬 멱등 저장을 실제 MongoDB·2인스턴스에서 검증 |
| 계정 정책 | 아이디 4~32자, 비밀번호 10~72자·문자/숫자/특수문자, MongoDB 공유 Rate Limit 구현 및 Express 2인스턴스 공유 검증 |
| 세션 저장 | HttpOnly JWT 쿠키, CSRF 이중 제출, 서버 로그아웃/세션 확인 구현. 운영 자격증명 Origin은 별도 allowlist로 잠금 |
| 게임방 | private 초대 코드 해시 검증과 원자적 revision 갱신을 실제 MongoDB·Express 2인스턴스에서 검증 |
| AI/API | AI 실패 502/미설정 503, Origin allowlist, 기본 2 MiB body limit 구현 |
| 서버 기동 | 필수 환경 검증, DB 연결·시드 성공 후 listen, DB readiness 503, graceful shutdown 구현 |
| 배포 문서 | 서버·클라이언트 env example과 배포 변수 문서 추가 |
| 이식 진행률 | 적용 가능한 체크리스트 기반 단일 계산기를 다섯 표시 화면에 연결하고 고정 퍼센트 덮어쓰기를 제거 |
| 도구 경고 | 전체 ESLint 0 error/0 warning. client 명시적 ESM과 `.cjs` prebuild 전환 완료 |
| 세션 통합 검증 | 격리 MongoDB에서 직접·Next 프록시 로그인, HttpOnly/SameSite, CSRF, 새 요청 유지, 로그아웃, 1초 만료 통과. UI 자동화 연결만 ACL로 미수행 |
| 보안 동시성 통합 검증 | 실제 MongoDB와 Express 2인스턴스에서 `clientRunId` 멱등성, private 초대, revision 원자성, 공유 rate limit 통과 |

최신 검증은 서버 보안 계약 9개, 실제 로컬 MongoDB 세션 E2E, Next 프록시 세션 E2E, 1초 만료 E2E, 실제 MongoDB·Express 2인스턴스 보안 동시성 E2E, `check:auth-session`, 전체 Eternal Hunger 검사, 전체 ESLint, Next production build 60페이지를 통과했습니다. 코드로 재현된 13개 결함은 모두 `Fixed` 또는 `Verified`이며, 인터넷 공개 운영의 남은 조건은 실제 배포 Origin·AI 공급자·브라우저 UI 환경 검증입니다.

## 1. 종합 판정

현재 저장소는 단순 프로토타입을 넘어선 **기능 폭이 넓은 베타 서비스**다. 메인 Eternal Hunger 시뮬레이션, 계정/커뮤니티, 공용 게임 저장·전적·게임방, 관리자 도구, 13개 부가 게임을 하나의 Next.js/Express 서비스에 통합했다.

메인 게임 회귀와 프로덕션 빌드, 계정 보안·방 접근·원자적 revision 수정은 현재 통과한다. 목표 MongoDB 병렬 요청과 Express 다중 인스턴스 공유 제한도 실제 통합 검증을 통과했다. 다만 실제 배포 Origin, AI 공급자 장애, 브라우저 UI 환경 검증은 남아 있으므로 **인터넷 공개 운영은 조건부 상태**로 판정한다.

| 관점 | 판정 | 근거 |
|---|---|---|
| 기능 범위 | 높음 | 68개 Next 페이지, 149개 Express 엔드포인트, 14개 등록 게임 |
| 메인 게임 자동 회귀 | 통과 | `npm run check:eternal-hunger` 성공 |
| 클라이언트 정적 품질 | 통과 | 전체 ESLint 0 error/0 warning; Next 프로덕션 빌드 성공 |
| 서버 문법 | 통과 | 추적 중인 서버 JS 93개 `node --check` 성공 |
| 보안/경제 무결성 | 실DB·다중 인스턴스 E2E 통과 | 보상 선차단, 멱등 저장, private 초대, 원자적 revision, 공유 rate limit, HttpOnly/CSRF 검증 |
| 운영성/관측성 | 구현 | DB readiness, fail-fast 기동, graceful shutdown, 제한된 payload와 Origin allowlist 적용 |
| 브라우저·실DB E2E | DB 통과·UI 부분 확인 | 실제 로컬 MongoDB/HTTP 쿠키·Next 프록시 세션·DB 병렬 요청·2인스턴스 공유 제한 통과; 브라우저 UI 연결만 잔여 |

## 2. 저장소 규모와 구조

### 2.1 현재 계층

```text
Browser
  -> Next.js 16.1.4 / React 19.2.3 client
     -> same-origin /api/proxy 또는 NEXT_PUBLIC_API_BASE
        -> Express 5.2.1 server
           -> Mongoose 9.1.5 / MongoDB
           -> Gemini 분석 API
```

### 2.2 실코드 지표

| 지표 | 값 | 비고 |
|---|---:|---|
| JS/JSX/MJS/CJS 파일 | 744 | `client/src`, `server`, `client/scripts`의 추적 파일 |
| 코드 줄 수 | 약 180,721 | 빈 줄/주석 포함 단순 행 집계 |
| Next `page.js`/`page.jsx` | 68 | 빌드 결과는 정적/동적 라우트 60개 정적 페이지 생성을 포함 |
| 서버 라우트 파일 | 41 | 관리자 하위 라우트 포함 |
| Express 엔드포인트 | 149 | `router.get/post/put/patch/delete` 집계 |
| 클라이언트 검사 스크립트 | 58 | `client/scripts/check-*.mjs` |
| 시뮬레이션 관련 JS | 235개 / 약 38,819줄 | `simulation`과 공용 `utils` 집계 |

가장 큰 파일은 `myAnimeCraftEngine.js` 6,206줄, `primitiveArchiveEngine.js` 6,113줄, `useGameSfx.js` 4,715줄, `baSrpgEngine.js` 4,171줄이다. 메인 시뮬레이션 진입점 `simulation/page.js`는 17줄의 얇은 셸로 축소되었고, 상태 조정은 `useSimulationPageController.js`, 규칙은 다수의 `_lib` 모듈, 화면은 `_components`로 분리되었다. 기존 `docs/ARCHITECTURE_AUDIT.md`의 “page.js 단일 거대 컴포넌트” 진단은 현재 코드에는 더 이상 그대로 적용되지 않는다.

## 3. 도메인별 진행 상태

| 도메인 | 상태 | 실제 구현 근거 | 남은 핵심 작업 |
|---|---|---|---|
| 계정/인증 | 구현 | 강한 가입 정책, HttpOnly 세션/CSRF, MongoDB 공유 rate limit, 복구·변경·비활성화·제재 확인 | 목표 브라우저와 배포 Origin E2E |
| 프로필/소셜 | 구현 | 닉네임·소개, 팔로우/해제, 공개 프로필, 알림 | 개인정보 보존/삭제 정책 검증 |
| 게시판/운영 | 구현 | 글·댓글·반응·북마크·공지·신고·검색·활동 피드 | 서버 E2E와 악용 방지 부하 검증 |
| 캐릭터/메타 | 구현 | 캐릭터 편집, 장비, 스킬 컴파일, ER 메타/아이템 import | 실데이터 coverage와 운영 마이그레이션 반복 검증 |
| Eternal Hunger | 자동 회귀 통과 | 이동, 루팅, 제작, 장착, 전투, 도주, 부활, 금지구역, 하이퍼루프, 상점/드론/거래, 특전, 이벤트, 결과 요약 | 서버 권위형 결과/보상, 실제 DB 1판 smoke, 장기 밸런스 |
| 공용 게임 플랫폼 | 실DB 검증 | 카탈로그, 상세 허브, 저장/전적, 초대 코드 비공개 방, 원자적 revision, 단일 진행률 계산, 14개 튜토리얼 | 브라우저 초대 UI와 장기 플레이 E2E |
| 부가 게임 | playable slice 12개 | 게임별 엔진·페이지·저장/전적, 공용 피드백/BGM/SFX 셸 | 각 원본의 전체 콘텐츠 이식과 실브라우저 장기 플레이는 별도 |
| 스무고개 | 자동 회귀 통과 | 방 생성, 질문/정답 시도, 힌트, presence, 종료 | 운영 부하·다중 사용자 E2E |
| 관리자 | 구현 | 사용자 제재, LP/크레딧 관리, 아이템/맵/키오스크/특전/드론/게임 후보 CRUD, 감사 | destructive 작업 dry-run/작업 큐/감사 로그 강화 |
| 배포/운영 | 구현 | Next webpack build, 자격증명 Origin 잠금 API proxy, DB readiness/fail-fast, env example, graceful shutdown | CI 연결과 구조화 로그 고도화는 개선 과제 |

## 4. 게임 카탈로그 현황

카탈로그에는 총 14개 게임이 있다. `GAME_CATALOG`의 Eternal Hunger와 스무고개는 `live`, `GAME_ROADMAP`의 12개 게임은 `playable`로 선언되어 있다. 14개 모두 전용 튜토리얼 키와 플레이 진입 경로를 가진다.

| 게임 | 카탈로그 상태 | 공용 방/상태 동기화 | 저장/전적 | 현재 해석 |
|---|---|---|---|---|
| Eternal Hunger | 운영 | 없음/없음 | 공용 저장 없음/전적 있음 | 메인 단독 시뮬레이션 |
| 스무고개 | 운영 | 전용 방/전용 상태 | 없음/없음 | 전용 커뮤니티 게임 |
| Dual Academy TCG | 플레이 가능 | 있음/있음 | 있음/있음 | 공용 게임방 연동 카드 게임 |
| BA Vanguard | 플레이 가능 | 있음/있음 | 있음/있음 | 공용 게임방 연동 카드 게임 |
| Civilization Archive | 플레이 가능 | 없음/없음 | 있음/있음 | 단독 생존·문명 루프 |
| 돈까스 사장 선생님 | 플레이 가능 | 없음/없음 | 있음/있음 | 단독 경영 루프 |
| Schale Idle RPG | 플레이 가능 | 없음/없음 | 있음/있음 | 계정 성장형 루프 |
| BA SRPG | 플레이 가능 | 없음/없음 | 있음/있음 | 단독 전술 미션 |
| Starleague Sim | 플레이 가능 | 없음/없음 | 있음/있음 | 단독 리그 시뮬레이션 |
| 학교 운영 시뮬레이터 | 플레이 가능 | 없음/없음 | 있음/있음 | 단독 학교 운영 |
| SI 코딩 시뮬레이터 | 플레이 가능 | 없음/없음 | 있음/있음 | 단독 챌린지 |
| Rail 3D Sim | 플레이 가능 | 없음/없음 | 있음/있음 | 2D 운행 로직 playable slice; 실제 Three.js는 후속 범위 |
| 회사 리포트 시뮬레이터 | 플레이 가능 | 없음/없음 | 있음/있음 | 단독 사업 장부 |
| Racing Logos | 플레이 가능 | 없음/없음 | 있음/있음 | 경주 playable slice; 육성/시즌 확장은 후속 범위 |

이식 완성도는 적용 가능한 체크리스트의 완료 수로 계산한다. 방이 없는 게임의 방·동기화 항목은 분모에서 제외되며, 카탈로그의 고정 `completionPct`는 표시값을 덮어쓰지 않는다.

## 5. 이번 기준선 검증 결과

| 명령 | 결과 | 핵심 출력 |
|---|---|---|
| `cmd /c npm run check:eternal-hunger` | 성공 | 메인 회귀, 부활 6사례, 24인 로스터, 21구역/43통로, 30개 무기군, 스킬, 38개 주요 이벤트, 9개 BGM, 런타임 lint, build |
| `cmd /c npm run check:auth-session` | 성공 | HttpOnly 쿠키 세션, credential 포함 요청, CSRF, 로그아웃 회귀 통과 |
| 실제 로컬 세션 E2E | 성공 | 직접·Next 프록시 로그인, HttpOnly/SameSite, CSRF 403/200, 유지, 로그아웃 204/401, 1초 만료 401 |
| `cmd /c npm run test:integration:security` | 성공 | 격리 MongoDB·Express 2인스턴스에서 DEF-001·005·006·007 실경합 통과, 테스트 DB 자동 폐기 |
| `cmd /c npm run check:game-porting-progress` | 성공 | 비적용 항목 제외와 고정 퍼센트 무시 계약 통과 |
| `cmd /c npm run check:twenty-questions` | 성공 | 규칙/피드백 31사례 통과 |
| `cmd /c npm run check:game-orchestration` | 성공 | BGM 프로필 120개, 역할 31개 |
| `cmd /c npm run check:game-feedback-shell` | 성공 | 피드백 행동 337개, cue 316개, 결과 패널 42개 |
| `cmd /c npm run check:game-viewport` | 성공 | 공용 셸 11개 + 전용 셸 3개 |
| `cmd /c npm run lint -- .` | 성공 | 0 error, 0 warning |
| `cmd /c npm run build` | 성공 | Next 16.1.4 webpack production build, 정적 페이지 60개 생성 |
| 서버 전체 `node --check` | 성공 | 추적 서버 JS 93개 |
| `git diff --check` | 성공 | 검증으로 인한 추적 파일 변경 없음 |

`client/package.json`은 명시적 ESM이며 CommonJS prebuild는 `.cjs`로 격리되어 typeless 재파싱 경고가 제거되었다.

## 6. 다음 진행 순서

코드로 재현된 13개 결함의 수정은 모두 반영되었다. 세션 프로토콜과 보안 동시성 E2E도 실제 로컬 MongoDB, Next 프록시, Express 2인스턴스에서 통과했다.

1. 실제 AI 공급자 오류와 잘못된 Mongo URI를 주입해 502/503 및 fail-fast 운영 동작을 확인한다.
2. 브라우저 UI 제어 연결의 Windows 작업경로 ACL이 해소되면 로그인·비공개 방 초대 화면 smoke를 추가한다.
3. 배포 환경의 실제 Origin·비밀값·TLS 조건으로 세션과 CORS 최종 smoke를 수행한다.
4. CI에서 서버 단위 검사, `test:integration:security`, 클라이언트 lint/build를 자동 실행한다.