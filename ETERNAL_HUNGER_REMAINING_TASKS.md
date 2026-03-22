- 완료: 시뮬 종료 후 LP/랭킹/유저 저장 흐름과 결과 화면 반영 1차 정리
# Eternal Hunger 남은 작업 목록

## 최근 반영
- stepA128: simulation/page.js shadow 계열 runtime risk 10건 정리, strict runtime eslint(no-shadow/no-redeclare 포함) error 0, client build 통과
- strict runtime risk 체크(no-undef/no-use-before-define/build)는 stepA127 기준 0 error
- `rollKioskInteraction`의 `ruleset` 누락과 종료 저장 helper 블록 스코프 문제 수정
- 보스/변이/이벤트/사냥 드랍을 공용 reward 정규화로 묶고, 결과 모달에 특수 보상/획득 경로 요약 반영
- 관리자 가드(`AdminShell`)의 토큰/권한 확인을 공용 auth/API 유틸 기준으로 정리
- 관리자 이식 화면(`ImportClient`)의 API_BASE/토큰/캐릭터 이식 호출을 공용 API 유틸 기준으로 통일
- 이벤트 저장/수정/정렬을 현재 UI와 서버 스키마가 같이 맞도록 정리
- 시뮬 상점/교환 루프의 부분 로드(allSettled), 자기 오퍼 제외, 키오스크 null itemId 가드 반영
- 시뮬 초기 생존자 로드가 빈 배열로 잡히던 문제 수정, 런타임 survivor/inventory/equipped 정규화 추가
- 도주/빈사/부활/전투 직후 AI target 초기화와 recovery window를 추가해 같은 페이즈 재교전/상태 꼬임 완화
- 상태이상/효과 지속/면역 규칙 1차 정리(출혈/중독/화상/식중독, 정화, 저항/면역, 스택 표기)

## 1) 실행/배포 막힘 우선
- Vercel/클라이언트 빌드 재확인 후 다음 에러 1개씩 제거
- `client` 전역 하드코딩 API 주소/상대경로 혼용 잔여분 제거
- 인증 실패/토큰 만료/초기 로드 실패 문구 최종 정리
- 배포 환경변수 문서화 (`NEXT_PUBLIC_API_BASE`, `BACKEND_BASE_URL`, `MONGO_URI`, `MY_SECRET_KEY`)

## 2) 시뮬레이션 1판 안정화
- 보스/변이/이벤트/드랍 결과 요약 반영 1차 완료
- `/simulation` 첫 진입 후 이동 → 루팅 → 장착 → 제작 → 교전 → 종료까지 1사이클 점검
- 첫 런에서 막히는 API/상태 null 케이스 1개씩 수정
- 상점/교환 탭 이후 실제 1회 구매/조합/수락까지 확인
- 시뮬 종료 후 LP/랭킹/유저 저장 흐름 확인
- 특전 실제 효과(체력/시작 크레딧/드론·키오스크 할인/AI 목표 가중치) 1차 반영 완료
- 디버그 줄 기반으로 초기 의존 API 응답 누락 지점 정리

## 3) 아이템/데이터 파이프라인 안정화
- `report_item_coverage.js` 기준 누락 무기군/방어구군 재확인
- coverage seed 더미를 실데이터로 계속 치환
- OpenAPI importer의 `itemSubType / equipSlot / weaponType` 누락 케이스 추가 보정
- 나무위키 importer의 발견장소/무기군 정규화 잔여 별칭 보강
- `spawnZones / spawnCrateTypes` 누락 상위 source, subtype 1개씩 후처리 보강

## 4) 조달/제작/장착 루프 완성
- 드론 조달 → 인벤토리 반영 → 제작 재시도 루프 확인(1차 반영 완료)
- 키오스크 구매 → 크레딧 차감 → 목표 장비 재계산 확인(1차 반영 완료)
- 목표 장비(goalLoadout) 단계별 추적 로그 보강
- 특전 효과 키 확장(판매 보너스/루팅/전투 계열)
- 특전 구매 UI/효과 적용 확인(1차 반영 완료)
- 전설/초월 재료 보존 규칙 재점검

## 5) 전투/도주/부활 밸런스
- 상태이상/효과 지속/면역 규칙 1차 반영 완료
- 1초 tick 기준 행동 큐 충돌 케이스 정리
- 도주 인터럽트/빈사 도주/추격 종료 조건 정리 1차 완료(행동 큐/추격 결과 요약 포함)
- 2일차 밤까지 부활 규칙 실제 반영 재확인
- 전투 과속/과소 발생 시 확률, 피해, 탐색 밀도 보정
- 상태이상 발생원(이벤트/전술/아이템/야생) 공용 payload 경로 1차 통합 완료
- 보호막/재생/버프성 효과의 실제 전투 계산 연결 2차
- 소비 아이템/이벤트/전술 스킬 결과 요약 로그와 버프 UI 정리 2차(진행 중)
- 행동 큐 blocked reason/top conflict와 추격 결과를 실제 1판 로그 기준으로 추가 튜닝 1차 완료(점수 기반 candidate/deferred, 추격 확률·선타 피해 요약 추가)

## 6) 경제/콘텐츠 튜닝
- 핵심 재료 가격 기준 재점검
  - 포스 코어 350
  - 운석/생나/미스릴 200
  - VF 500
  - 드론 하급 재료 10
- 음식/재료 스택 규칙(재료 3, 음식 6) 점검
- 월드 스폰 타이밍과 실제 드랍 체감 재확인
- late-game 진입 시점(영웅/전설/초월) 밸런스 조정

## 7) 어드민/운영 도구
- importer 결과 확인용 coverage/spawn meta 리포트 사용 흐름 정리
- 어드민 아이템/레시피/맵 편집 후 시뮬 즉시 반영 여부 확인
- goalLoadout, 전술 스킬, 카탈로그 수정 UX 마무리

## 8) 마지막 정리
- 실행 가이드와 실제 배포 가이드 분리
- 남은 디버그 UI를 유지할지 숨길지 결정
- 행동 큐 점수 튜닝값과 추격 확률 지표를 실제 1판 로그 기준으로 2차 조정
- 최신 ZIP 기준 중복 파일/구버전 정리

## 최근 핫픽스 메모
- stepA121: 실제 빌드 실행 대신 BUILD_CHECK_GUIDE.md와 로컬 빌드 체크 스크립트(check-build-local.sh/.cmd), package.json 체크 스크립트 추가.

- stepA116: simulation/page.js 파싱 오류 2건(scored, kioskDoc) 복구

- stepA117: simulation/page.js 파싱 오류 1건(missNeedCount 선언부) 복구

- stepA118: simulation/page.js useMemo/safeRenderCompute 닫힘 구문 4건(gainSourceSummary, creditSourceSummary, gainDetailSummary, specialSourceSummary) 복구


- stepA119: simulation/page.js useMemo/safeRenderCompute 닫힘 구문 8건(runProgressSummary, runSupportSummary, runActionSummary, topRankedCharacters, zonePos, zoneEdges, recentPings, detonationRiskSummary) 복구

- stepA120: simulation/page.js detonationRiskSummary useMemo/safeRenderCompute closing parse hotfix (`});` + deps split -> `}), [deps]);`).
## stepA122
- verify page-data collection stage after font fetch issue removal
- inspect build-time heavy routes if page-data stage still stalls
- keep system-font fallback unless local font bundling is introduced



## stepA123
- compile 단계와 page-data collection 진입은 실제 빌드 체크로 재확인
- 다음 확인 축은 `Collecting page data` 이후 route별 정적/서버 코드 비용 좁히기
- build-check 스크립트는 `npm ci --no-audit --no-fund` 기준으로 재현성 보강

---

## stepA124
- 빌드 체킹 실제 시행: `client`에서 `npm ci --no-audit --no-fund` 후 `npm run build` 통과.
- 안정화 패치: `client/next.config.mjs`에 `experimental.cpus: 2` 추가.
- 효과: `Collecting page data using 55 workers` → `2 workers`로 줄어 빌드 완료.


## stepA125
- 빌드 기준 JS 문법 오류는 정리 완료, `client` 빌드 통과
- 남은 lint error 8건은 주로 `react-hooks/set-state-in-effect` 정리 작업
- 다음 소작업 추천 순서
  1) `AdminGuard.jsx` mounted/ready 처리 단순화
  2) `board/page.js`, `board/[id]/page.js`의 초기화 effect 분리
  3) `admin/credits`, `admin/drone`, `admin/kiosks`, `admin/perks`의 `load()` effect 패턴 정리
  4) `admin/import/_components/ImportClient.jsx`의 초기 state 세팅 effect 정리


## stepA126
- JS 오류 검증 재정리: lint error 8건 → 0건
- 실제 빌드 체킹 재실행: `client` build 통과, `server` JS 문법 체크 통과
- 다음 소작업 추천
  1) `simulation/page.js` exhaustive-deps 경고 2~4건씩 정리
  2) `characters/details/simulation`의 `<img>`를 `next/image` 또는 wrapper로 교체
  3) 필요 시 admin 화면 공통 load 훅으로 정리

## stepA129 follow-up
- simulation/page.js exhaustive-deps 경고 정리
- 필요 시 production runtime 재현 로그(CDP/headless) 추가
