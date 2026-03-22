[stepA129]
- 대상: client/src/app/simulation/page.js
- 조치:
  - 전역 runtime error / unhandledrejection 캡처 추가
  - 초기 로드 fetchData unhandled catch 추가
  - 비보호 useMemo 파생값(activeMap/zones/hyperloop/item meta/inventory) safeRenderCompute 래핑
  - strict runtime eslint(no-undef/no-use-before-define/no-shadow/no-redeclare) error 0 확인
  - npm run build 통과 확인
- 비고:
  - strict runtime sweep 기준 warning은 react-hooks exhaustive-deps / img 최적화 위주로 남음

## stepA130 runtime guard sweep
- restored runtime error/unhandledrejection listeners in simulation page
- added fireAndReport guard for fetch/init, market/trade refresh, finishGame, manual action buttons
- wrapped pickStartZoneIdForChar / charsWithHp.init / shuffledChars.init with safe fallbacks
- build/runtime checks executed: strict runtime eslint pass, next build pass, server node --check pass

## stepA130 runtime/build verification
- restored simulation window runtime listeners and async fireAndReport guards
- guarded init path pickStartZoneIdForChar / charsWithHp.init / shuffledChars.init
- verified: runtime eslint pass, next build pass, server syntax pass
