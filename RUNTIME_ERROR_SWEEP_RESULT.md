# Runtime Error Sweep Result

- 대상: `client`, `server`
- 기준 수정본: stepA127 workspace

## 실행 결과
- `client`: strict ESLint(`no-undef`, `no-use-before-define`) 실행 결과 **error 0 / warning 21**
- `client`: `npm run build` **통과**
- `server`: `node --check` 전체 JS 파일 통과

## 이번 턴 반영
- `client/src/app/simulation/page.js`
  - `rollKioskInteraction(..., ruleset, ...)` 시그니처/호출부 정리
  - 키오스크 전술 모듈 판단 시 `ruleset` 미정의 참조 제거
  - `saveLocalHof`를 초기 로드 블록 밖 공용 helper(`saveLocalHallOfFameBackup`)로 승격
  - 종료 처리 시 블록 스코프 밖 helper를 호출하도록 수정
- `client/src/app/characters/page.js`
  - `fetchCharacters`를 함수 선언식으로 정리
- `client/src/app/events/page.js`
  - `fetchEvents`, `fetchMaps`를 함수 선언식으로 정리
- `scripts/check-runtime-errors.sh`
- `scripts/check-runtime-errors.cmd`
  - uncaught runtime risk 점검용 strict eslint + build + server syntax 체크 스크립트 추가

## 해석
- 이번 전수 체크 기준으로 `no-undef` / `no-use-before-define` 계열의 런타임 위험 에러는 0건
- 남은 21건은 `react-hooks/exhaustive-deps` 및 `<img>` 경고이며, 즉시 `ReferenceError/TypeError`로 터지는 종류는 아님
