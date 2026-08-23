# Eternal Hunger 기능 요구사항

- 기준일: 2026-08-23 KST
- 상위 현황: [CURRENT_STATUS.md](./CURRENT_STATUS.md)
- 비기능 기준: [NON_FUNCTIONAL_REQUIREMENTS.md](./NON_FUNCTIONAL_REQUIREMENTS.md)
- 결함 추적: [DEFECT_REGISTER.md](./DEFECT_REGISTER.md)

## 1. 상태와 우선순위

| 값 | 의미 |
|---|---|
| 충족 | 실코드가 요구사항을 구현하고 이번 정적/자동 검증에서 모순을 찾지 못함 |
| 부분 충족 | 핵심 흐름은 있으나 합격 조건 일부가 누락됨 |
| 미충족 | 요구사항을 막는 확인된 결함 또는 구현 부재가 있음 |
| 미검증 | 구현은 보이나 실제 DB·브라우저·다중 사용자 검증이 필요함 |
| P0 | 공개 운영 전에 반드시 해결 |
| P1 | 베타 운영 안정성에 필수 |
| P2 | 기능 확장 또는 품질 개선 |

요구사항의 “서버는”은 Express API와 MongoDB 저장 계층을, “클라이언트는”은 Next.js 화면과 공용 API 유틸을 뜻한다.

## 2. 계정과 인증

| ID | 요구사항 | 우선순위 | 현재 상태 | 실코드/합격 조건 |
|---|---|---:|---|---|
| FR-AUTH-001 | 사용자는 아이디, 선택 닉네임, 비밀번호, 약관·개인정보 동의로 가입할 수 있어야 한다. | P0 | 부분 충족 | `signup/page.js`, `routes/auth.js`; 비밀번호 6~72자와 아이디 길이/문자 정책을 서버에서도 거부해야 함. [DEF-002](./DEFECT_REGISTER.md#def-002) |
| FR-AUTH-002 | 사용자는 아이디/비밀번호로 로그인하고 만료 시간이 있는 JWT 세션을 받아야 한다. | P0 | 충족 | `routes/auth.js`; 기본 TTL 30일, `check:auth-session` 통과 |
| FR-AUTH-003 | 정지·비활성 계정은 로그인과 보호 API 사용이 차단되어야 한다. | P0 | 충족 | `authMiddleware.js`가 매 요청 사용자 상태를 재확인 |
| FR-AUTH-004 | 만료·변조 토큰은 일관된 401 코드로 처리되고 클라이언트 저장 세션이 정리되어야 한다. | P0 | 충족 | `auth-session.js`, `api.js`, `check:auth-session` |
| FR-AUTH-005 | 사용자는 1회용 복구 코드를 발급하고 새 비밀번호로 재설정할 수 있어야 한다. | P1 | 부분 충족 | 코드 해시와 사용 후 폐기는 구현됨. 코드 만료 정책은 정의되지 않음 |
| FR-AUTH-006 | 사용자는 비밀번호 변경, 프로필 수정, 계정 비활성화를 수행할 수 있어야 한다. | P1 | 충족 | `routes/user.js`, `/account` |
| FR-AUTH-007 | 관리자 권한은 서버의 `verifyAdmin`을 통과한 요청에만 부여되어야 한다. | P0 | 충족 | `/api/admin` 라우터 전체 보호, 일부 운영 API별 추가 보호 |

## 3. 사용자·커뮤니티

| ID | 요구사항 | 우선순위 | 현재 상태 | 실코드/합격 조건 |
|---|---|---:|---|---|
| FR-COM-001 | 사용자는 공개 프로필과 전적 요약을 조회하고 다른 사용자를 팔로우/해제할 수 있어야 한다. | P1 | 충족 | `routes/user.js`, `publicModules/users.js`, `/users/[id]` |
| FR-COM-002 | 사용자는 게시글을 작성·수정·삭제하고 목록/상세/검색으로 조회할 수 있어야 한다. | P1 | 충족 | `routes/posts.js`, `/board`, `/search` |
| FR-COM-003 | 사용자는 댓글, 반응, 북마크를 관리할 수 있어야 한다. | P1 | 충족 | `routes/posts.js`, `/bookmarks` |
| FR-COM-004 | 공지 지정은 관리자만 수행할 수 있어야 한다. | P0 | 충족 | `POST /posts/:id/notice` 내부 관리자 확인 |
| FR-COM-005 | 사용자는 콘텐츠/사용자를 신고하고 자신의 신고 상태를 조회할 수 있어야 한다. | P1 | 충족 | `routes/reports.js`, `/reports` |
| FR-COM-006 | 관리자는 신고 처리, 대상 정지, 사용자 정지/해제와 운영 알림 발송을 수행할 수 있어야 한다. | P0 | 충족 | `routes/reports.js`, `routes/admin/users.js` |
| FR-COM-007 | 사용자는 알림 목록, 개별 읽음, 전체 읽음을 관리할 수 있어야 한다. | P1 | 충족 | `routes/notifications.js`, `/notifications` |

## 4. 캐릭터·아이템·성장

| ID | 요구사항 | 우선순위 | 현재 상태 | 실코드/합격 조건 |
|---|---|---:|---|---|
| FR-CHAR-001 | 인증 사용자는 자신의 캐릭터 목록과 기본 능력치/전적을 관리할 수 있어야 한다. | P0 | 충족 | `routes/characters.js`, `/characters`, `/details` |
| FR-CHAR-002 | 캐릭터는 패시브/Q/W/E/R 스킬 원문과 컴파일된 동작을 저장·미리보기할 수 있어야 한다. | P1 | 충족 | `characterSkillCompiler.js`, 캐릭터 스킬 편집 컴포넌트, `check:skills` |
| FR-CHAR-003 | 장비·인벤토리는 중복 재료 병합, 보호 재료 보존, 장착 슬롯, 제작 소비를 일관되게 처리해야 한다. | P0 | 충족 | `inventoryRules.js`, `craftRuntime.js`, 메인 회귀 검사 |
| FR-CHAR-004 | 특전은 목록 조회, 구매, 런타임 효과 적용을 지원해야 한다. | P1 | 충족 | `routes/perks.js`, `perkRuntime.js`, `/perks` |
| FR-CHAR-005 | 서버는 아이템 제작·키오스크·드론·거래 결과를 사용자 소유 인벤토리와 재화에 반영해야 한다. | P0 | 부분 충족 | 기능은 구현됐으나 전체 경제가 클라이언트 자기지급 API로 우회 가능. [DEF-001](./DEFECT_REGISTER.md#def-001) |

## 5. 메인 Eternal Hunger 시뮬레이션

| ID | 요구사항 | 우선순위 | 현재 상태 | 실코드/합격 조건 |
|---|---|---:|---|---|
| FR-SIM-001 | 사용자는 랜덤 또는 커스텀 24인/8개 분대 로스터와 매치 모드를 설정해 런을 시작할 수 있어야 한다. | P0 | 충족 | `customRosterRuntime.js`, `SimulationPregameRosterSetup.js`, `check:custom-roster` |
| FR-SIM-002 | 런은 seed, 낮/밤, 페이즈, 속도, 생존자와 팀 상태를 결정적으로 관리해야 한다. | P0 | 충족 | `randomSeedRuntime.js`, `simulationPhaseCycleRuntime.js`, `useSimulationMatchState.js` |
| FR-SIM-003 | 캐릭터는 21개 루미아 구역과 연결 통로를 이동하고 하이퍼루프를 사용할 수 있어야 한다. | P0 | 충족 | `mapActionRuntime.js`, `pathfindingRuntime.js`, `SimulationMinimapCanvas.js`; 21구역/43통로 검사 통과 |
| FR-SIM-004 | 필드 루팅, 루트 파밍, 상자, 야생동물, 보스, 차원의 틈과 특수 자원이 실제 인벤토리 보상으로 연결되어야 한다. | P0 | 충족 | loot/world spawn/dimension rift 관련 `_lib` 모듈과 메인 회귀 검사 |
| FR-SIM-005 | 제작·장착·소비·목표 장비·전설/초월 장비 진행이 동일한 아이템 규칙을 사용해야 한다. | P0 | 충족 | gear/craft/inventory 런타임 모듈 |
| FR-SIM-006 | 전투는 장비, 상태이상, 전술/캐릭터 스킬, 치명타, 흡혈, 방어, 도주를 반영해야 한다. | P0 | 충족 | `battleLogic.js`, `combatRuntime.js`, phase combat 모듈, `check:skills` |
| FR-SIM-007 | 부활은 날짜/시간대, 팀 전멸, 시체 시간, 키오스크 비용 규칙에 따라 처리되어야 한다. | P0 | 충족 | `phaseRevivalRuntime.js`, `phaseFinalizationRuntime.js`, 6개 회귀 사례 통과 |
| FR-SIM-008 | 금지구역, 서든데스, 코어 목표, 변이 야생동물/보스가 런 상태와 종료 조건에 반영되어야 한다. | P0 | 충족 | forbidden/sudden death/world spawn 런타임 모듈 |
| FR-SIM-009 | 키오스크, 드론, 유저 거래는 실제 결제/수령 성공 시에만 비용과 획득을 반영해야 한다. | P0 | 부분 충족 | 런타임 가드는 존재하나 서버 재화 자기지급 우회가 남음. [DEF-001](./DEFECT_REGISTER.md#def-001) |
| FR-SIM-010 | 주요 사건은 구조화 이벤트, 지속 결과 바, 의미 아이콘과 중복 억제된 SFX로 표시되어야 한다. | P1 | 충족 | 주요 이벤트 38개, 전용 cue 36개 검사 통과 |
| FR-SIM-011 | 런 상황에 맞는 9개 BGM 장면과 사용자 음량/활성 설정을 제공해야 한다. | P2 | 충족 | `eternalHungerSoundtrack.js`, rendered audio 검사 통과 |
| FR-SIM-012 | 런 종료 시 결과 요약, 로그, 승자/팀 기록과 보상을 한 번만 저장해야 한다. | P0 | 미충족 | 결과 UI/저장은 구현됐으나 보상 산정과 멱등성이 서버 권위형이 아님. [DEF-001](./DEFECT_REGISTER.md#def-001) |
| FR-SIM-013 | 개발자 도구로 조작된 런은 보상과 명예의 전당에 들어가면 안 된다. | P0 | 부분 충족 | 클라이언트 회귀 가드는 통과하나 서버가 런 진위를 검증하지 않음 |
| FR-SIM-014 | 런 로그를 JSON/Markdown으로 내보내고 고정 seed 진단 CLI로 분석할 수 있어야 한다. | P1 | 충족 | `logExportRuntime.js`, `simulation-diagnostics.mjs`, `docs/SIMULATION_DIAGNOSTICS.md` |

## 6. 공용 게임 플랫폼과 부가 게임

| ID | 요구사항 | 우선순위 | 현재 상태 | 실코드/합격 조건 |
|---|---|---:|---|---|
| FR-GAME-001 | 게임 허브는 정적 카탈로그와 관리자 등록 후보를 함께 표시하고 게임별 상세/플레이/게시판/기록으로 연결해야 한다. | P1 | 충족 | `gameCatalog.js`, `/games`, `/myanime`, `/srpg` |
| FR-GAME-002 | 등록된 모든 게임은 경로별 6단계 튜토리얼을 제공해야 한다. | P1 | 충족 | 카탈로그 14개와 튜토리얼 14개가 1:1 일치 |
| FR-GAME-003 | 지원 게임은 사용자별 저장 슬롯 생성·조회·덮어쓰기·삭제와 payload 크기 제한을 제공해야 한다. | P0 | 충족 | `routes/gameSaves.js`, 1 MiB 기본 제한, 게임별 20개 기본 제한 |
| FR-GAME-004 | 지원 게임은 사용자별 전적 생성·조회·삭제와 payload 크기 제한을 제공해야 한다. | P0 | 부분 충족 | CRUD는 구현됨. 점수/결과의 서버 검증 정책은 없음. [DEF-001](./DEFECT_REGISTER.md#def-001) |
| FR-GAME-005 | 게임방은 생성, 참가, 퇴장, 준비, 상태 전환, 상태 저장, 결과 기록을 지원해야 한다. | P0 | 충족 | `routes/gameRooms.js` 9개 엔드포인트 |
| FR-GAME-006 | 비공개 게임방은 초대/승인된 사용자만 참가·조회할 수 있어야 한다. | P0 | 미충족 | ID를 아는 인증 사용자가 join 가능. [DEF-005](./DEFECT_REGISTER.md#def-005) |
| FR-GAME-007 | 방 상태 갱신은 expected revision을 원자적으로 비교하여 충돌 시 409를 반환해야 한다. | P0 | 부분 충족 | 비교 로직은 있으나 read-check-save라 동시 요청 경쟁을 막지 못함. [DEF-006](./DEFECT_REGISTER.md#def-006) |
| FR-GAME-008 | 공용 결과/피드백 셸은 게임별 행동 의미, cue, 아이콘, BGM 전환과 사용자 설정을 제공해야 한다. | P1 | 충족 | 행동 337개, cue 316개, 결과 패널 42개, BGM 테마 14개 검사 통과 |
| FR-GAME-009 | 14개 게임 화면은 데스크톱 고정 플레이 셸과 모바일 document-flow fallback을 제공해야 한다. | P1 | 충족(정적) | 공용 셸 11개와 전용 셸 3개 계약 검사 통과; 실제 기기 smoke는 별도 |
| FR-GAME-010 | 카탈로그 진행률은 적용 가능한 체크 항목만 분모로 사용하고 선언값과 계산값을 일관되게 표시해야 한다. | P1 | 미충족 | `null -> 0%`, N/A 항목과 고정 100% 충돌. [DEF-004](./DEFECT_REGISTER.md#def-004) |

## 7. 스무고개

| ID | 요구사항 | 우선순위 | 현재 상태 | 실코드/합격 조건 |
|---|---|---:|---|---|
| FR-20Q-001 | 방장은 정답/힌트/질문 제한을 설정해 방을 만들고 정답 노출을 통제해야 한다. | P1 | 충족 | `routes/twentyQuestions.js` |
| FR-20Q-002 | 질문과 정답 도전은 공용 시도 횟수를 사용하고 마지막 오답은 방을 종료해야 한다. | P1 | 충족 | 규칙 검사 통과: shared attempts, final wrong guess close |
| FR-20Q-003 | 방장만 힌트와 질문 판정을 수행하고 참가 presence는 TTL로 관리되어야 한다. | P1 | 충족 | 방장 가드 2종, presence TTL 20초 검사 통과 |
| FR-20Q-004 | 탐색/좁히기/최종/판정대기/해결 상태와 결과 cue를 제공해야 한다. | P2 | 충족 | 피드백 31사례 검사 통과 |

## 8. 관리자·데이터 파이프라인·AI

| ID | 요구사항 | 우선순위 | 현재 상태 | 실코드/합격 조건 |
|---|---|---:|---|---|
| FR-ADM-001 | 관리자는 사용자, 신고, LP/크레딧, 게임 후보를 관리할 수 있어야 한다. | P0 | 충족 | `/admin/users`, `/admin/reports`, `/admin/credits`, `/admin/games` |
| FR-ADM-002 | 관리자는 아이템, 맵/구역/연결, 키오스크, 드론 오퍼, 특전을 계정 스코프로 CRUD할 수 있어야 한다. | P0 | 충족 | `routes/admin/*`, `requestScope.js` |
| FR-ADM-003 | 중복 제거·기본 트리·맵 정규화 등 대량 작업은 대상 수와 결과를 보고해야 한다. | P1 | 부분 충족 | 결과 요약은 있으나 공통 dry-run/작업 큐/재시도 모델은 불완전 |
| FR-DATA-001 | 서버는 ER OpenAPI와 붙여넣은 Namu 원본을 정규화·중복 제거·coverage 보고할 수 있어야 한다. | P1 | 충족 | `server/scripts/import_*`, `report_item_coverage.js` |
| FR-DATA-002 | 서버 시작 시 빈 DB의 기본 아이템 트리를 보충할 수 있어야 한다. | P1 | 충족 | `upsertDefaultItemTree({ mode: 'missing' })` |
| FR-AI-001 | 인증 사용자는 제한된 길이와 호출 빈도로 캐릭터 텍스트 분석을 요청할 수 있어야 한다. | P1 | 충족 | 3,000자, 기본 10분/12회, JWT 보호 |
| FR-AI-002 | AI 공급자·JSON 파싱 실패는 성공 응답과 구분되는 오류 상태로 반환되어야 한다. | P1 | 미충족 | 현재 모든 실패를 200 fallback으로 반환. [DEF-008](./DEFECT_REGISTER.md#def-008) |

## 9. 릴리스 기능 합격 게이트

기능 릴리스는 최소한 다음 조건을 만족해야 한다.

1. P0 기능 요구사항에 `미충족`이 없어야 한다.
2. [DEFECT_REGISTER.md](./DEFECT_REGISTER.md)의 P0/P1 결함에 소유자와 목표 버전이 지정되어야 한다.
3. `check:eternal-hunger`, 전체 ESLint, Next build, 서버 전체 `node --check`가 성공해야 한다.
4. 격리 DB에서 가입 → 로그인 → 1판 종료 → 보상/전적 저장 → 재로그인 조회 E2E가 중복 저장 없이 성공해야 한다.
5. 두 클라이언트가 같은 방 revision을 동시에 저장했을 때 하나만 성공하고 다른 하나는 409를 받아야 한다.
6. 비공개 방의 비초대 사용자가 조회·참가하지 못해야 한다.
