# Runtime Error Sweep Result

- 대상: `client`, `server`
- 기준 수정본: stepA128 workspace

## 실행 결과
- `client`: strict ESLint(`no-undef`, `no-use-before-define`, `no-shadow`, `no-redeclare`) 실행 결과 **error 0 / warning 21**
- `client`: `npm run build` **통과**
- `server`: `node --check` 전체 JS 파일 45개 통과

## 이번 턴 반영
- `client/src/app/simulation/page.js`
  - 상자/전설 드랍 계산의 지역 변수 shadow 제거 (`legendDropWeights` → `legendaryWeights`)
  - 변이 야생동물 스폰 day 변수 shadow 제거 (`d` → `nightDay`)
  - 발도 opener 인자 shadow 제거 (`settings` → `battleSettings`)
  - 서든데스/난전/교전 정리 구간의 shadow 변수 제거 (`winner`, `selectedChar`, `getEquipTierSummary` 등)
  - `applyCombatElimination` 내부 승자/패자 참조를 명시적 이름(`combatWinner`, `combatLoser`)으로 통일
- `scripts/check-runtime-errors.sh`
- `scripts/check-runtime-errors.cmd`
  - strict runtime risk 점검 규칙에 `no-shadow`, `no-redeclare` 추가

## 해석
- 이번 전수 체크 기준으로 `no-undef` / `no-use-before-define` / `no-shadow` / `no-redeclare` 계열의 런타임 위험 에러는 0건
- 남은 21건은 `react-hooks/exhaustive-deps` 및 `<img>` 경고이며, 즉시 `ReferenceError/TypeError`로 터지는 종류는 아님
