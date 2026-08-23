# Eternal Hunger 결함대장

- 기준일: 2026-08-23 KST
- 기준 브랜치/커밋: `main` / `00d534fa`
- 현재 현황: [CURRENT_STATUS.md](./CURRENT_STATUS.md)
- 요구사항: [FUNCTIONAL_REQUIREMENTS.md](./FUNCTIONAL_REQUIREMENTS.md), [NON_FUNCTIONAL_REQUIREMENTS.md](./NON_FUNCTIONAL_REQUIREMENTS.md)

## 1. 등급과 상태

| 값 | 의미 |
|---|---|
| P0 Critical | 재화/권한/데이터 무결성을 직접 파괴하며 공개 운영을 차단 |
| P1 High | 악용 가능 보안 결함, 동시성 데이터 손실, 핵심 운영 장애 |
| P2 Medium | 사용자 오판, 오류 의미 훼손, 배포/운영 누락 |
| P3 Low | 기능은 동작하나 경고·유지보수 비용을 유발 |
| Open | 확인됐고 수정되지 않음 |
| Implemented | 코드 수정 완료, 목표 DB/브라우저 통합 검증 대기 |
| Partial | 일부 원인만 수정되고 잔여 작업 존재 |
| Blocked | 외부 선택/명시 승인 없이는 진행 불가 |
| Fixed | 코드 수정과 회귀 검증 완료 |
| Verified | 실제 목표 환경에서 재검증 완료 |

## 2. 요약 대장

| ID | 제목 | 등급 | 유형 | 상태 | 소유자 | 목표 버전 |
|---|---|---:|---|---|---|---|
| [DEF-001](#def-001) | 인증 사용자가 LP·크레딧·전적을 임의 증가 가능 | P0 | 보안/경제 무결성 | Verified | 미지정 | 긴급 |
| [DEF-002](#def-002) | 가입 비밀번호·아이디 서버 정책 누락 | P1 | 보안/입력 검증 | Fixed | 미지정 | 미정 |
| [DEF-003](#def-003) | JWT를 localStorage와 JS-readable cookie에 저장 | P1 | 보안/세션 | Fixed | 미지정 | 미정 |
| [DEF-004](#def-004) | 게임 이식 완성도 0%/100% 계산이 체크리스트와 모순 | P2 | 기능/표시 | Fixed | 미지정 | 미정 |
| [DEF-005](#def-005) | 비공개 게임방을 ID만 알면 참가 가능 | P1 | 권한/개인정보 | Verified | 미지정 | 미정 |
| [DEF-006](#def-006) | 게임방 revision 비교가 비원자적이라 동시 저장 유실 가능 | P1 | 동시성/데이터 | Verified | 미지정 | 미정 |
| [DEF-007](#def-007) | 로그인·가입 rate limit 부재, 일부 제한은 인스턴스 로컬 | P1 | 보안/확장성 | Verified | 미지정 | 미정 |
| [DEF-008](#def-008) | AI 분석 실패를 HTTP 200 가짜 결과로 반환 | P2 | API/오류 처리 | Fixed | 미지정 | 미정 |
| [DEF-009](#def-009) | wildcard CORS+credentials와 전역 50 MiB body limit | P1 | 보안/설정 | Fixed | 미지정 | 미정 |
| [DEF-010](#def-010) | MongoDB 연결 실패 뒤에도 서버가 포트를 열고 ping 성공 | P1 | 신뢰성/운영 | Fixed | 미지정 | 미정 |
| [DEF-011](#def-011) | 배포 환경변수 기준 문서와 `.env.example` 부재 | P2 | 배포/문서 | Fixed | 미지정 | 미정 |
| [DEF-012](#def-012) | Node ESM typeless 경고와 ESLint 경고 반복 | P3 | 도구/유지보수 | Fixed | 미지정 | 미정 |
| [DEF-013](#def-013) | Next 프록시가 정상 204 응답을 500으로 변환 | P1 | API/세션 신뢰성 | Fixed | 미지정 | 즉시 |

## 3. 처리 결과 (2026-08-23)

| ID | 처리 결과 | 자동 검증 | 잔여 위험 |
|---|---|---|---|
| DEF-001 | 일반 사용자 `/credits/earn`, `/user/update-stats` 선차단. `game/end`는 `clientRunId` 멱등 키와 `trustedOutcome=false`를 저장하고 영구 보상을 0으로 고정 | 서버 보안 계약과 실제 MongoDB·Express 2인스턴스 12중 동시 요청: 1건 생성, 11건 멱등 응답, 보상·전적 불변 | 없음 |
| DEF-002 | 아이디 4~32자 및 허용문자, 비밀번호 10~72자·문자/숫자/특수문자 정책을 가입·복구·계정 변경 앞단과 UI에 적용 | 정책 단위 테스트, `check:auth-session`, UI ESLint | 기존 계정의 약한 비밀번호 강제 교체 정책은 별도 운영 결정 |
| DEF-003 | 로그인 JWT를 HttpOnly 쿠키로 이전하고 CSRF 이중 제출 검증, 서버 로그아웃, 쿠키 포함 API 요청을 연결. 프록시 자격증명 목적지는 별도 allowlist로 제한 | 격리 MongoDB 직접·Next 프록시 세션 E2E, 1초 만료 E2E, `check:auth-session`, lint/build | 브라우저 UI 자동화 연결은 Windows ACL 문제로 미수행; 프로토콜 계약은 실제 서버에서 통과 |
| DEF-004 | 체크리스트 기반 단일 계산기를 다섯 표시 화면에 연결하고 방/동기화 비적용 항목을 분모에서 제외. 고정 `completionPct`는 표시값을 덮어쓰지 않음 | `check:game-porting-progress`, 전체 lint/build | 없음 |
| DEF-005 | 비공개 방 생성 시 192-bit 초대 코드를 발급하고 해시만 저장. 조회·참가에서 코드/멤버 권한 검사 | 실제 MongoDB·Express 2인스턴스에서 무코드 조회 404, 무효 코드 참가 403, 정상 초대 참가 200, 원문 미저장 확인 | 없음 |
| DEF-006 | `{ _id, revision, participant, status }` 조건의 `findOneAndUpdate`와 `$inc`로 상태 저장을 단일 연산화 | 실제 MongoDB에서 서로 다른 Express 인스턴스가 같은 revision을 동시 갱신해 정확히 1건 200, 1건 409 및 revision 1회 증가 확인 | 없음 |
| DEF-007 | 로그인·가입·복구·AI 요청을 MongoDB TTL 버킷으로 공유 제한 | 같은 MongoDB를 쓰는 Express 2인스턴스를 번갈아 로그인 요청해 401, 401, 429와 단일 공유 버킷 count 3 확인 | 없음 |
| DEF-008 | 미설정은 503, 공급자/JSON 실패는 502로 반환하고 가짜 능력치 200 응답 제거 | 서버 문법·보안 계약 | 실제 AI 공급자 장애 주입 검증 필요 |
| DEF-009 | credentialed CORS 정확한 allowlist, 기본 body limit 2 MiB, 413 오류 처리 적용 | 실제 HTTP CORS 거부·대형 JSON 413 테스트 | 관리자 대용량 import가 필요하면 별도 인증 라우트 한도 설계 |
| DEF-010 | 필수 환경 검증, Mongo 연결·시드 성공 이후 listen, DB 기반 readiness, graceful shutdown 적용 | DB 미연결 ping 503 HTTP 테스트 | 실제 잘못된 URI 프로세스 종료 smoke test 권장 |
| DEF-011 | 서버·클라이언트 예시 환경파일과 배포 변수 문서 추가 | 파일·설정 검토 | 운영 비밀값과 실제 Origin은 배포자가 주입 |
| DEF-012 | ESLint config에 이름을 부여하고 client를 명시적 ESM으로 전환. CommonJS prebuild는 `.cjs`로 격리 | 전체 lint 0경고, `.cjs` prebuild, production build | 없음 |
| DEF-013 | 204/205/304 응답을 `null` 본문으로 재구성하고 Content-Type도 본문이 있을 때만 전달 | 실제 Next→Express 프록시 로그아웃 E2E, `check-proxy-session-contract`, lint/build | 없음 |

## 4. 상세 결함

### DEF-001

**인증 사용자가 LP·크레딧·전적을 임의 증가 가능**

- 등급/상태: P0 Critical / Verified
- 관련 요구사항: FR-CHAR-005, FR-SIM-009, FR-SIM-012, FR-GAME-004, NFR-SEC-001, NFR-REL-003
- 정적 증거:
  - `server/routes/credits.js`의 `POST /earn`은 클라이언트가 보낸 `amount`를 요청당 최대 100,000까지 그대로 `$inc`한다.
  - `server/routes/user.js`의 `POST /update-stats`는 `kills`, `isWin`, `lpEarned`, `creditsEarned`를 클라이언트에서 받아 그대로 누적한다.
  - `server/routes/game.js`의 `POST /end`는 승자, 킬, 어시스트, 참가자, 로그를 클라이언트 payload에서 구성한다.
- 재현 절차(정적 확인, 운영 DB에서는 실행하지 않음):
  1. 일반 계정으로 로그인한다.
  2. `POST /api/credits/earn`에 `{ "amount": 100000 }`을 반복 전송한다.
  3. 또는 `POST /api/user/update-stats`에 큰 `lpEarned`, `creditsEarned`, `kills`를 반복 전송한다.
  4. 서버 코드상 런 ID, 서명, 중복 key, 서버 계산 결과 검증 없이 누적된다.
- 영향: 재화 인플레이션, LP/랭킹 조작, 업적/특전 경제 붕괴, 로그 신뢰 상실
- 기대 결과: 클라이언트는 행동/런 식별자만 전송하고 서버가 원장·룰로 보상을 계산하며 동일 idempotency key는 한 번만 반영해야 한다.
- 권장 수정:
  1. 단기: 일반 사용자용 `/credits/earn`, `/user/update-stats`를 비활성화하거나 내부 전용으로 전환한다.
  2. `game/end`에 서버 생성 run ID와 idempotency unique index를 도입한다.
  3. 보상 계산을 서버로 이동하고 전적/보상/로그를 하나의 트랜잭션으로 기록한다.
  4. 임의 적립·재전송·동시 전송 통합 테스트를 추가한다.
- 통합 검증: `npm run test:integration:security`에서 임의 적립 API 410, 동일 `clientRunId` 12중 병렬 요청의 1건 생성·11건 멱등 응답, 사용자 LP·크레딧·전적 불변을 실제 MongoDB에서 확인
- 완료 조건: 임의 수치 요청이 거부되고 동일 런 재전송이 누적되지 않으며 정상 런 보상만 정확히 한 번 지급됨

### DEF-002

**가입 비밀번호·아이디 서버 정책 누락**

- 등급/상태: P1 High / Fixed
- 관련 요구사항: FR-AUTH-001, NFR-SEC-002
- 정적 증거:
  - `client/src/app/signup/page.js`는 비밀번호 일치와 동의만 검사하며 `minLength`/`maxLength`가 없다.
  - `server/routes/auth.js`의 가입 경로는 닉네임 길이와 동의만 검사한다.
  - `server/models/User.js`의 `username`, `password`는 `required`만 있고 길이 제한이 없다.
- 재현 절차: 가입 API에 1자 아이디와 1자 비밀번호를 보내면 다른 DB 제약이 없는 한 저장 경로에 진입한다.
- 영향: 약한 계정 생성, 과도한 입력 저장/해시 비용, 변경·복구 비밀번호 정책(6~72자)과 불일치
- 기대 결과: 서버가 아이디 3~32자와 허용 문자, 비밀번호 6~72자 이상의 확정 정책을 검증하고 클라이언트도 같은 안내를 제공해야 한다.
- 완료 조건: 경계값과 우회 API 테스트가 모두 통과함

### DEF-003

**JWT를 localStorage와 JavaScript-readable cookie에 저장**

- 등급/상태: P1 High / Fixed
- 관련 요구사항: FR-AUTH-002, FR-AUTH-004, NFR-SEC-004
- 발견 근거:
  - 기존 `saveAuth`가 JWT를 `localStorage.token`과 JavaScript-readable cookie에 중복 저장했다.
- 수정 결과:
  - 서버가 `token`을 HttpOnly 쿠키로, `eh_csrf`를 이중 제출용 쿠키로 발급한다.
  - 브라우저 API 요청은 `withCredentials`와 변경 요청의 `X-CSRF-Token`을 사용하며 JWT를 읽거나 저장하지 않는다.
  - Next 프록시는 `BACKEND_BASE_URL`만 사용하고, 루프백 외 자격증명 목적지는 `AUTH_PROXY_CREDENTIAL_ORIGINS`에 별도 등록된 Origin만 허용한다.
  - 로그인 응답에서 JWT 본문을 제거하고 서버 로그아웃·세션 확인 경로를 추가했다.
- 자동 검증: `check:auth-session`, 전체 ESLint, Next production build
- 통합 검증: 격리 MongoDB에서 직접·Next 프록시 로그인, HttpOnly/SameSite, CSRF 403/200, 새 요청 유지, 로그아웃 204/401, 1초 만료 401을 통과
- 잔여 운영 검증: 목표 배포 Origin의 수동 브라우저 UI 확인
### DEF-004

**게임 이식 완성도 0%/100% 계산이 체크리스트와 모순**

- 등급/상태: P2 Medium / Fixed
- 관련 요구사항: FR-GAME-010
- 발견 근거:
  - `Number(null)`이 0으로 평가되고 고정 `completionPct: 100`이 실제 체크리스트를 덮어썼다.
  - 방이 없는 게임도 방·동기화 항목이 분모에 들어가 의미가 다른 수치가 비교됐다.
- 수정 결과:
  - `gamePortingProgress.mjs`에서 완료 체크 수로만 백분율을 계산한다.
  - 방 없음은 `room`, 공용 게임방이 아님은 `sync`를 비적용 항목으로 분모에서 제외한다.
  - 상세·허브·MyAnime·SRPG·관리자 화면 다섯 곳이 같은 계산기를 사용한다.
- 자동 검증: `check:game-porting-progress`, 전체 ESLint, Next production build
- 잔여 위험: 없음
### DEF-005

**비공개 게임방을 ID만 알면 참가 가능**

- 등급/상태: P1 High / Verified
- 관련 요구사항: FR-GAME-006, NFR-SEC-005
- 정적 증거:
  - `GET /game-rooms/:id`는 비공개 방의 비참가자를 404로 차단한다.
  - 그러나 `POST /game-rooms/:id/join`은 `visibility === 'private'`를 검사하지 않고 정원/상태만 검사한다.
- 재현 절차:
  1. 사용자 A가 private 방을 만든다.
  2. 방 ID를 아는 사용자 B가 join 엔드포인트를 호출한다.
  3. 코드상 초대 토큰/승인 목록 없이 참가자로 추가된다.
- 영향: 비공개 의미 훼손, 방 state와 참가자 정보 노출
- 기대 결과: private 방은 초대 토큰, 초대 목록 또는 방장 승인 중 하나를 서버에서 검증해야 한다.
- 통합 검증: `npm run test:integration:security`에서 무초대 조회 404, 무효 코드 참가 403, 정상 초대 참가 200과 MongoDB SHA-256 해시 저장을 확인
- 완료 조건: 비초대 사용자의 조회·참가가 모두 거부되고 초대 사용자의 정상 참가가 통과함

### DEF-006

**게임방 revision 비교가 비원자적이라 동시 저장 유실 가능**

- 등급/상태: P1 High / Verified
- 관련 요구사항: FR-GAME-007, NFR-REL-004
- 정적 증거: `POST /game-rooms/:id/state`가 문서를 읽은 뒤 메모리에서 expected revision을 비교하고 `room.save()`한다.
- 재현 절차:
  1. revision N을 가진 동일 방에 두 클라이언트가 서로 다른 state와 expected revision N을 동시에 전송한다.
  2. 두 요청이 저장 전에 N을 읽으면 모두 비교를 통과한다.
  3. 둘 다 N+1로 저장할 수 있어 마지막 쓰기가 앞선 state를 덮고도 409가 발생하지 않는다.
- 영향: 카드/턴/방 상태 유실, 클라이언트별 상태 분기
- 기대 결과: `{ _id, revision: N }` 조건의 `findOneAndUpdate`와 `$inc: { revision: 1 }`를 한 연산으로 수행하고 미일치 시 409를 반환해야 한다.
- 통합 검증: `npm run test:integration:security`에서 두 Express 인스턴스의 같은 revision 동시 저장 중 정확히 하나만 성공하고 다른 요청은 409, DB revision은 한 번만 증가함
- 완료 조건: 동시 저장 통합 테스트에서 정확히 하나만 성공함

### DEF-007

**로그인·가입 rate limit 부재, 일부 제한은 인스턴스 로컬**

- 등급/상태: P1 High / Verified
- 관련 요구사항: NFR-SEC-003, NFR-PERF-006
- 정적 증거:
  - 가입/로그인에는 rate limit이 없다.
  - 비밀번호 복구와 AI 분석은 `Map` 기반 프로세스 로컬 bucket을 사용한다.
  - 재시작 또는 여러 서버 인스턴스로 제한 상태가 공유되지 않는다.
- 영향: 비밀번호 대입, 계정 생성 남용, AI 비용 우회, 수평 확장 시 정책 불일치
- 기대 결과: reverse proxy 또는 Redis 기반 공유 limiter를 로그인/가입/복구/AI에 적용하고 신뢰할 proxy IP 설정을 고정해야 한다.
- 통합 검증: `LOGIN_RATE_LIMIT_MAX=2`인 Express 두 인스턴스를 교대로 호출해 401, 401, 429와 MongoDB 공유 버킷 count 3을 확인
- 완료 조건: 제한·Retry-After·인스턴스 간 공유를 통합 테스트로 검증함

### DEF-008

**AI 분석 실패를 HTTP 200 가짜 결과로 반환**

- 등급/상태: P2 Medium / Fixed
- 관련 요구사항: FR-AI-002, NFR-REL-008
- 정적 증거: `server/routes/analyze.js`의 catch가 공급자 오류, timeout, JSON 파싱 오류를 모두 삼키고 `{ name: '분석실패', stats: ... }`를 기본 200으로 반환한다.
- 영향: 클라이언트가 실패를 성공 캐릭터로 저장할 수 있고 장애율/공급자 오류를 관측할 수 없다.
- 기대 결과: 입력 오류 4xx, rate limit 429, 공급자/파싱 실패 502/503을 반환하고 fallback 사용은 명시적 필드와 사용자 선택으로 분리해야 한다.
- 완료 조건: 공급자 오류와 비JSON 응답 테스트가 실패 상태와 재시도 안내를 확인함

### DEF-009

**wildcard CORS+credentials와 전역 50 MiB body limit**

- 등급/상태: P1 High / Fixed
- 관련 요구사항: NFR-SEC-006, NFR-SEC-007
- 정적 증거: `server/index.js`가 `cors({ origin: '*', credentials: true })`, `express.json/urlencoded({ limit: '50mb' })`를 모든 라우트 앞에 적용한다.
- 영향:
  - credentialed CORS 응답 규칙과 모순되고 의도한 cookie 요청이 브라우저에서 거부될 수 있다.
  - 인증 전 대형 JSON 파싱으로 메모리/CPU 고갈 공격 표면이 커진다.
- 기대 결과: 환경별 allowlist, 필요한 경우에만 credentials, 일반 API 1 MiB 이하, 관리자 import 전용 제한과 인증 선행 적용
- 완료 조건: 허용/비허용 origin 통합 테스트와 대형 body 413 테스트 통과

### DEF-010

**MongoDB 연결 실패 뒤에도 서버가 포트를 열고 ping 성공**

- 등급/상태: P1 High / Fixed
- 관련 요구사항: NFR-REL-001, NFR-REL-002
- 정적 증거:
  - `mongoose.connect(...).catch(...)`는 로그만 남긴다.
  - `app.listen`은 연결 Promise와 독립적으로 즉시 실행된다.
  - `/api/public/ping`은 DB 상태를 확인하지 않고 `{ ok: true }`를 반환한다.
- 영향: 배포 플랫폼이 장애 인스턴스를 정상으로 판단하고 실제 요청은 timeout/500을 낸다.
- 기대 결과: liveness와 DB readiness 분리, 필수 설정/DB 실패 시 readiness 실패 및 선택한 정책에 따른 종료
- 완료 조건: 잘못된 URI에서 readiness 실패, 정상 DB에서 준비 완료, 종료 신호 graceful 처리 검증

### DEF-011

**배포 환경변수 기준 문서와 `.env.example` 부재**

- 등급/상태: P2 Medium / Fixed
- 관련 요구사항: NFR-SEC-008, NFR-DEP-001
- 정적 증거:
  - 저장소에는 ignore된 `server/.env`만 있고 example 파일이 없다.
  - `ETERNAL_HUNGER_STRUCTURE.md`는 `MONGO_URI`, `MY_SECRET_KEY`, `PORT`, `NEXT_PUBLIC_API_BASE`만 예시한다.
  - 코드가 사용하는 `BACKEND_BASE_URL`, `GOOGLE_API_KEY`, 인증 TTL, rate limit, payload limit 변수가 빠져 있다.
- 영향: 새 환경에서 조용한 오동작, 약한 기본값, AI/프록시 실패, 운영자별 설정 편차
- 기대 결과: 비밀값 없는 `.env.example`과 변수 표, 시작 시 schema 검증
- 완료 조건: 빈 환경에서 누락 목록을 명확히 출력하고 example만으로 로컬 구성이 가능함

### DEF-012

**Node ESM typeless 경고와 ESLint 경고 반복**

- 등급/상태: P3 Low / Fixed
- 관련 요구사항: NFR-QLT-008
- 발견 근거:
  - client 패키지에 모듈 타입이 없어 ESM `.js` 검사가 재파싱 경고를 냈고 ESLint config도 익명 export 경고를 냈다.
- 수정 결과:
  - `client/package.json`에 `"type": "module"`을 선언했다.
  - CommonJS 전처리기를 `fix-proxy-migration.cjs`로 옮기고 prebuild 경로를 갱신했다.
  - ESLint runtime config의 default export에 이름을 부여했다.
- 자동 검증: 전체 ESLint 0경고, `.cjs` prebuild 실행, Next production build
- 잔여 위험: 없음
### DEF-013

**Next 프록시가 정상 204 응답을 500으로 변환**

- 등급/상태: P1 High / Fixed
- 관련 요구사항: FR-AUTH-004, NFR-REL-003, NFR-QLT-008
- 발견 근거:
  - 실제 Next→Express 로그아웃 E2E에서 백엔드는 204를 반환했지만 Next 라우트가 `new NextResponse('', { status: 204 })`를 호출해 `Invalid response status code 204` 예외와 HTTP 500을 만들었다.
- 영향: same-origin 프록시 배포에서 로그아웃 응답이 실패하며 클라이언트의 세션 종료 확인을 왜곡한다.
- 수정 결과:
  - 204·205·304는 `null` 본문으로 재구성하고 본문 없는 응답에는 Content-Type을 강제로 붙이지 않는다.
  - 정상 로그아웃의 Set-Cookie 삭제 헤더는 그대로 브라우저 측으로 전달한다.
- 자동 검증: `check-proxy-session-contract`, 전체 ESLint, Next production build
- 통합 검증: 프록시 로그인 → CSRF 변경 → 로그아웃 204 → 세션 재조회 401 통과
- 잔여 위험: 없음
## 5. 검증으로 확인한 비결함

다음 항목은 과거 문서나 이전 작업 기록에서 위험이었지만 현재 기준선에서는 통과했다.

| 항목 | 현재 결과 |
|---|---|
| BA Vanguard 피드백/BGM 통합 | 현재 파일·검사·빌드에 통합되어 이전 “부분 완료” 기록은 만료됨 |
| 공개 AI 분석 API | 현재 `/api/analyze`는 `verifyToken`으로 보호되고 길이/rate 제한이 있음. 실패 의미 문제만 DEF-008로 잔존 |
| 거대 `simulation/page.js` | 현재 17줄 진입 셸로 축소되고 controller/lib/components로 분리됨 |
| 메인 런타임/빌드 | `check:eternal-hunger`와 production build 성공 |
| 서버 JS 파싱 | 추적 서버 JS 93개 모두 `node --check` 성공 |
| 미니맵 시각화 | 이동 trail, 하이퍼루프, 이벤트 ping, 캐릭터 토큰과 reduced-motion 처리 존재 |

## 6. 결함 처리 규칙

1. 수정 PR/커밋에 결함 ID와 관련 요구사항 ID를 기록한다.
2. P0/P1은 unit/static 검사만으로 닫지 않고 격리 DB 또는 실제 브라우저 통합 검증을 포함한다.
3. `Fixed`는 코드와 자동 회귀가 반영된 상태, `Verified`는 목표 실행 환경에서 재현 불가를 확인한 상태로 구분한다.
4. 보안 결함 재현에는 운영 DB나 실제 사용자 데이터를 사용하지 않는다.
5. 결함을 닫을 때 발견 근거, 수정 커밋, 검증 명령, 결과와 잔여 위험을 상세 기록에 추가한다.
