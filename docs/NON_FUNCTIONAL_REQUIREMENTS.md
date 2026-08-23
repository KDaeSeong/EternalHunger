# Eternal Hunger 비기능 요구사항

- 기준일: 2026-08-23 KST
- 기능 범위: [FUNCTIONAL_REQUIREMENTS.md](./FUNCTIONAL_REQUIREMENTS.md)
- 현재 현황: [CURRENT_STATUS.md](./CURRENT_STATUS.md)
- 결함 추적: [DEFECT_REGISTER.md](./DEFECT_REGISTER.md)

## 1. 적용 원칙

아래 수치는 초기 운영 기준선이다. 실제 운영 트래픽을 측정한 뒤 강화할 수 있지만, 검증 없이 완화해서는 안 된다. “현재 상태”는 이번 실코드 분석과 로컬 자동 검증을 기준으로 한다.

| 상태 | 의미 |
|---|---|
| 충족 | 현재 구현과 검증이 합격 조건을 만족 |
| 부분 충족 | 일부 보호/검증은 있으나 운영 합격 조건 미달 |
| 미충족 | 확인된 결함 또는 필수 운영 장치 부재 |
| 미측정 | 측정 장치나 실환경 결과가 없음 |

## 2. 보안

| ID | 요구사항/합격 기준 | 우선순위 | 현재 상태 | 근거/조치 |
|---|---|---:|---|---|
| NFR-SEC-001 | LP, 크레딧, 승패, 킬, 보상은 서버가 검증 가능한 런/거래 원장에서 계산하고 클라이언트가 증가량을 지정할 수 없어야 한다. | P0 | 미충족 | [DEF-001](./DEFECT_REGISTER.md#def-001) |
| NFR-SEC-002 | 가입·변경 비밀번호는 서버에서 6~72자 이상 정책을 적용하고 아이디도 길이·문자 집합을 제한해야 한다. | P0 | 미충족 | [DEF-002](./DEFECT_REGISTER.md#def-002) |
| NFR-SEC-003 | 로그인/가입/복구/AI 등 악용 가능한 API는 사용자·IP 기준 rate limit을 적용해야 한다. 다중 인스턴스에서는 공유 저장소를 사용해야 한다. | P0 | 부분 충족 | 복구/AI만 프로세스 메모리 Map 사용. [DEF-007](./DEFECT_REGISTER.md#def-007) |
| NFR-SEC-004 | 운영 인증 토큰은 JavaScript가 읽을 수 없는 `HttpOnly; Secure; SameSite` 쿠키 또는 동등한 방어 모델을 사용해야 한다. | P0 | 미충족 | localStorage와 JS 작성 쿠키에 동일 JWT 저장. [DEF-003](./DEFECT_REGISTER.md#def-003) |
| NFR-SEC-005 | 관리자·소유자·참가자 권한은 서버에서 객체 단위로 확인해야 한다. | P0 | 부분 충족 | 관리자/소유자 스코프는 대체로 구현, 비공개 방 join 예외 존재. [DEF-005](./DEFECT_REGISTER.md#def-005) |
| NFR-SEC-006 | 운영 CORS는 명시적 origin allowlist를 사용하고 wildcard와 credentials를 함께 설정하지 않아야 한다. | P0 | 미충족 | [DEF-009](./DEFECT_REGISTER.md#def-009) |
| NFR-SEC-007 | 전역 JSON/form body limit은 필요한 최댓값으로 제한하고 대용량 import는 관리자 전용 별도 경로를 사용해야 한다. | P1 | 미충족 | 현재 전역 50 MiB. [DEF-009](./DEFECT_REGISTER.md#def-009) |
| NFR-SEC-008 | 비밀값은 저장소에 커밋하지 않고 시작 시 필수 환경변수 존재와 최소 강도를 검증해야 한다. | P0 | 부분 충족 | `.env` ignore는 존재하나 시작 검증과 `.env.example`이 없음 |
| NFR-SEC-009 | 오류 응답은 비밀번호 해시, JWT, API key, DB URI, 내부 stack을 노출하지 않아야 한다. | P0 | 부분 충족 | 일반 API는 메시지를 정리하나 가입 실패에서 원본 `err.message`를 응답에 포함 |
| NFR-SEC-010 | 의존성 취약점 검사는 lockfile 기준 CI에서 실행하고 High/Critical 예외는 사유·만료일을 기록해야 한다. | P1 | 미충족 | CI/감사 게이트 확인 안 됨 |

## 3. 신뢰성·데이터 무결성

| ID | 요구사항/합격 기준 | 우선순위 | 현재 상태 | 근거/조치 |
|---|---|---:|---|---|
| NFR-REL-001 | 필수 DB 연결 실패 시 서버는 준비 완료가 되지 않거나 프로세스를 종료해야 한다. | P0 | 미충족 | 현재 오류를 로그만 남기고 `app.listen` 실행. [DEF-010](./DEFECT_REGISTER.md#def-010) |
| NFR-REL-002 | liveness와 readiness를 분리하고 readiness는 MongoDB 연결·필수 설정을 확인해야 한다. | P0 | 부분 충족 | `/api/public/ping`은 프로세스 생존만 반환 |
| NFR-REL-003 | 런 종료, 보상, 전적 저장은 idempotency key를 사용해 재시도에도 한 번만 반영되어야 한다. | P0 | 미충족 | 클라이언트 재호출로 누적 가능. [DEF-001](./DEFECT_REGISTER.md#def-001) |
| NFR-REL-004 | 게임방 revision 비교와 갱신은 하나의 조건부 DB 연산으로 수행되어야 한다. | P0 | 미충족 | [DEF-006](./DEFECT_REGISTER.md#def-006) |
| NFR-REL-005 | 인벤토리·재화·거래의 다중 문서 변경은 트랜잭션 또는 보상 가능한 원장으로 원자성을 보장해야 한다. | P0 | 미검증 | 일부 원자 update는 있으나 전체 경제 경로의 트랜잭션 보장은 확인되지 않음 |
| NFR-REL-006 | 저장 슬롯과 전적 payload는 크기·소유권·스키마 버전을 검증하고 구버전 migration을 제공해야 한다. | P1 | 부분 충족 | 크기/소유권/버전 문자열은 구현, 공통 스키마 migration 계약은 게임별 상이 |
| NFR-REL-007 | 서버는 SIGTERM/SIGINT 시 신규 요청 중단, 진행 요청 종료, Mongo 연결 종료를 수행해야 한다. | P1 | 미충족 | graceful shutdown 처리 없음 |
| NFR-REL-008 | 외부 AI 실패·timeout·파싱 오류는 성공 데이터와 구분되는 상태 코드와 재시도 가능 여부를 반환해야 한다. | P1 | 미충족 | [DEF-008](./DEFECT_REGISTER.md#def-008) |

## 4. 성능·확장성

| ID | 요구사항/합격 기준 | 우선순위 | 현재 상태 | 근거/조치 |
|---|---|---:|---|---|
| NFR-PERF-001 | 일반 공개 GET의 p95는 500 ms, 인증 쓰기 API의 p95는 1,000 ms 이하여야 한다(동일 리전, warmed DB 기준). | P1 | 미측정 | APM/부하 결과 없음 |
| NFR-PERF-002 | API 목록은 기본 limit와 최대 limit를 적용하고 payload 전체 문서를 불필요하게 반환하지 않아야 한다. | P1 | 부분 충족 | 주요 목록에 limit/select 존재; 149개 엔드포인트 전수 계약 검사는 없음 |
| NFR-PERF-003 | 클라이언트 API는 timeout과 사용자 구분 캐시 키를 사용하고 인증 변경 시 캐시를 비워야 한다. | P1 | 충족 | `api.js`: 기본 10초, 초기 45초, token hash scope, auth 변경 cache clear |
| NFR-PERF-004 | 50 MiB급 오디오/대형 게임 코드는 현재 경로에 필요한 청크·트랙만 지연 로드해야 한다. | P1 | 부분 충족 | route 기반 BGM과 캐시는 있으나 bundle/네트워크 budget 측정 없음 |
| NFR-PERF-005 | 메인 시뮬레이션은 개발자 패널을 닫았을 때 대량 요약·목록 렌더링을 제한하고 1초 tick에서 장시간 main-thread stall이 없어야 한다. | P1 | 부분 충족 | render limit와 모듈 분리는 존재; 브라우저 profile 미측정 |
| NFR-PERF-006 | rate limit과 세션성 상태는 수평 확장 시 인스턴스 간 일관되어야 한다. | P1 | 미충족 | 프로세스 로컬 Map 사용 |

## 5. 품질·테스트

| ID | 요구사항/합격 기준 | 우선순위 | 현재 상태 | 근거/조치 |
|---|---|---:|---|---|
| NFR-QLT-001 | 모든 변경은 전체 ESLint 0 error와 Next production build 성공을 유지해야 한다. | P0 | 충족 | 이번 검증 0 error/1 warning, build 성공 |
| NFR-QLT-002 | 서버 추적 JS는 전부 문법 검사를 통과해야 한다. | P0 | 충족 | 93개 `node --check` 성공 |
| NFR-QLT-003 | Eternal Hunger 변경은 `check:eternal-hunger` 전체 게이트를 통과해야 한다. | P0 | 충족 | 이번 검증 성공 |
| NFR-QLT-004 | 게임 공용 셸 변경은 orchestration, feedback shell, viewport 검사를 통과해야 한다. | P1 | 충족 | 이번 검증 성공 |
| NFR-QLT-005 | 계정·경제·저장·게임방 서버 API는 격리 MongoDB 통합 테스트를 가져야 한다. | P0 | 미충족 | 서버 `package.json`에 test 스크립트/테스트 프레임워크 없음 |
| NFR-QLT-006 | 핵심 사용자 여정은 실제 브라우저 E2E로 데스크톱과 375 px 모바일에서 검증해야 한다. | P1 | 부분 충족 | 정적 viewport 검사는 있으나 저장소 공통 E2E 게이트 없음 |
| NFR-QLT-007 | 테스트는 단순 소스 문자열 존재뿐 아니라 실제 상태 전이와 실패 경로를 검증해야 한다. | P1 | 부분 충족 | 여러 게임 검사는 엔진 전이를 수행하지만 정적 source assertion도 다수 사용 |
| NFR-QLT-008 | Node 검사에서 경고가 0개여야 하며 허용 경고는 사유와 만료일을 기록해야 한다. | P2 | 미충족 | ESM 모듈 타입 경고 반복, ESLint 경고 1개. [DEF-012](./DEFECT_REGISTER.md#def-012) |

## 6. 관측성·운영

| ID | 요구사항/합격 기준 | 우선순위 | 현재 상태 | 근거/조치 |
|---|---|---:|---|---|
| NFR-OBS-001 | 요청 로그는 timestamp, request ID, method, route, status, latency, user scope를 구조화 JSON으로 기록해야 한다. | P1 | 미충족 | 현재 `console.log/error` 중심 |
| NFR-OBS-002 | 클라이언트 런타임 오류와 unhandled rejection은 사용자 메시지와 운영 오류 수집으로 연결되어야 한다. | P1 | 부분 충족 | 브라우저 listener와 error boundary는 존재, 외부 수집기는 없음 |
| NFR-OBS-003 | AI, DB, import, 게임 종료 저장 실패는 원인별 metric과 알람을 제공해야 한다. | P1 | 미충족 | 중앙 metric/alert 없음 |
| NFR-OBS-004 | 로그에는 토큰, 비밀번호, 복구 코드, API key, 원문 개인정보를 기록하지 않아야 한다. | P0 | 미검증 | 공통 redaction 계층 없음 |
| NFR-OBS-005 | 배포는 readiness 실패, 5xx 비율, p95 latency, DB 연결 상태를 대시보드에서 확인할 수 있어야 한다. | P1 | 미충족 | 배포 관측 구성 없음 |

## 7. 접근성·반응형·사용성

| ID | 요구사항/합격 기준 | 우선순위 | 현재 상태 | 근거/조치 |
|---|---|---:|---|---|
| NFR-UX-001 | 모든 조작은 키보드로 접근 가능하고 아이콘 전용 버튼은 접근 가능한 이름을 가져야 한다. | P1 | 부분 충족 | 공용 아이콘/aria 적용은 광범위하나 axe/키보드 E2E 없음 |
| NFR-UX-002 | 상태 변화와 오류는 색상만으로 전달하지 않고 텍스트·아이콘·aria live를 함께 제공해야 한다. | P1 | 부분 충족 | 토스트/결과 패널/인증 메시지 구현, 전 화면 전수 감사 없음 |
| NFR-UX-003 | 375 px 이상 모바일에서 문서 전체 가로 overflow와 잘린 핵심 조작이 없어야 한다. | P1 | 부분 충족 | 정적 viewport 계약 통과, 실제 전 화면 브라우저 측정 필요 |
| NFR-UX-004 | `prefers-reduced-motion` 사용자는 이동 trail, ping, 전환 애니메이션을 비활성화할 수 있어야 한다. | P1 | 충족 | `ERSimulation.css`에 reduced-motion 처리 존재 |
| NFR-UX-005 | SFX와 BGM은 독립적으로 끌 수 있고 기본값·음량은 사용자 선택을 존중해야 한다. | P1 | 충족 | 공용 audio dock, theme별 SFX, 전역 BGM/volume 설정 |

## 8. 개인정보·준법

| ID | 요구사항/합격 기준 | 우선순위 | 현재 상태 | 근거/조치 |
|---|---|---:|---|---|
| NFR-PRV-001 | 가입 시 약관·개인정보 버전과 동의 시점을 저장해야 한다. | P0 | 충족 | User agreements와 가입 처리 |
| NFR-PRV-002 | 계정 비활성화 후 공개 노출, 로그인, 데이터 보존/삭제 정책이 일관되어야 한다. | P0 | 부분 충족 | 로그인 차단과 공개 필터는 존재; 보존 기간·완전 삭제 절차 문서 없음 |
| NFR-PRV-003 | 사용자는 자신의 프로필·전적·게시물·저장 데이터의 내보내기/삭제 범위를 확인할 수 있어야 한다. | P1 | 미충족 | 통합 데이터 export/delete 흐름 없음 |
| NFR-PRV-004 | AI 분석에 전달하는 텍스트와 보존 여부를 사용자에게 고지하고 서버 로그에 원문을 남기지 않아야 한다. | P1 | 미검증 | API 원문 보존 코드는 없으나 고지/운영 로그 정책 확인 안 됨 |

## 9. 배포·호환성·유지보수

| ID | 요구사항/합격 기준 | 우선순위 | 현재 상태 | 근거/조치 |
|---|---|---:|---|---|
| NFR-DEP-001 | `.env.example` 또는 동등 문서에 필수/선택 환경변수, 형식, 기본값, 비밀 여부를 기록해야 한다. | P0 | 미충족 | 현재 문서는 일부 변수만 기재. [DEF-011](./DEFECT_REGISTER.md#def-011) |
| NFR-DEP-002 | CI는 clean install, lint, 핵심 회귀, server test/check, production build를 수행해야 한다. | P0 | 미충족 | 저장소 CI 구성 확인 안 됨 |
| NFR-DEP-003 | 지원 브라우저는 최신 Chrome/Edge와 모바일 Chromium을 우선하며, proxy/API base 동작을 로컬·동일 오리진 배포에서 검증해야 한다. | P1 | 부분 충족 | 로컬 fallback과 same-origin proxy 구현, 브라우저 행렬 자동화 없음 |
| NFR-MNT-001 | 페이지는 입력/표현, hook은 orchestration, 순수 `_lib`는 규칙을 담당하고 순환 의존을 만들지 않아야 한다. | P1 | 부분 충족 | 메인 page 분리는 진전, 일부 게임 엔진 4천~6천 줄 |
| NFR-MNT-002 | 2,000줄을 넘는 엔진에 새 기능을 넣을 때는 순수 하위 모듈과 전용 회귀 검사를 함께 추가해야 한다. | P1 | 부분 충족 | 대형 엔진이 여러 개이며 분리 수준은 게임별로 다름 |
| NFR-MNT-003 | 요구사항 ID, 결함 ID, 검사 스크립트, 변경 파일이 PR/커밋 설명에서 추적 가능해야 한다. | P2 | 미충족 | 이번 문서에서 ID 기준선만 신설 |

## 10. 운영 전 필수 비기능 게이트

1. `NFR-SEC-001`부터 `NFR-SEC-007`까지 P0 미충족 항목을 해소한다.
2. DB readiness와 fail-fast를 구현하고 DB 장애 시 readiness가 실패하는지 검증한다.
3. 보상/전적 idempotency, 방 revision 경쟁, 비공개 방 권한 통합 테스트를 자동화한다.
4. CI에서 clean install → lint → 핵심 회귀 → server test/check → build 순서를 고정한다.
5. 375 px 모바일과 데스크톱에서 가입, 로그인, 1판, 저장/전적, 게임방, 관리자 핵심 여정을 E2E로 통과한다.
6. 배포 환경변수, 복구 절차, 로그/알람 대시보드와 롤백 절차를 문서화한다.
