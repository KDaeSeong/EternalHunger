# Eternal Hunger 빌드 체크 가이드

## 목적
- 이 패키지에는 실제 빌드 체크 결과와 재현용 스크립트를 같이 포함했습니다.
- 우선순위는 `client` 빌드가 Vercel/로컬에서 같은 단계까지 도달하는지 확인하는 것입니다.

## 실제로 이번 턴에 실행한 명령
```bash
cd client
npm ci --no-audit --no-fund
npm run build
```

## 로컬 재현 명령
```bash
cd client
npm run check:build:local
```

## Vercel 유사 재현 명령
```bash
cd client
npm run check:build:vercel-like
```

## CI/초기 설치 포함 재현 명령
```bash
cd client
npm run check:build:ci
```

## 서버 기본 확인
```bash
cd server
npm install
node index.js
```

## 로그 확인 위치
- 클라이언트: `client/src/app/simulation/page.js`
- 클라이언트 빌드 스크립트: `client/package.json`, `client/scripts/fix-proxy-migration.js`, `client/scripts/check-build-local.sh`, `client/scripts/check-build-local.cmd`
- 서버 엔트리: `server/index.js`
- 이번 턴 빌드 체크 결과: `BUILD_CHECK_RESULT.md`, `BUILD_CHECK_LATEST_LOG_SNIPPET.txt`

## 최근 막힌 지점
- `simulation/page.js` 내부 선언부 파손
  - `function scored(...)`
  - `function kioskDoc(...).find(...)`
  - `function missNeedCount(...) => ...`
- `useMemo + safeRenderCompute` 닫힘 구문 파손
  - `}), [deps]);` / `});` / `}, [deps]);` 혼선
- 원격 구글 폰트 fetch 실패
  - `next/font/google` 제거로 대응 완료

## 이번 빌드 체크에서 확인한 상태
1. `npm ci --no-audit --no-fund` 정상 완료
2. `npm run build`에서 `Compiled successfully` 확인
3. 이후 `Collecting page data using 55 workers ...` 단계 진입 확인
4. 더 길게 대기할 때 이 샌드박스에서 `WaitPID EOF`가 발생해 최종 종료 코드 확보 실패

## 다음에 같은 류가 보이면 먼저 볼 것
1. `function 이름(표현식)` 형태로 깨진 선언
2. `useMemo(() => { ... }), [deps]);` 같이 닫힘 괄호가 어긋난 구간
3. `safeRenderCompute(() => { ... }, fallback)` 뒤에 `useMemo` 의존성 배열이 붙는 방식이 깨졌는지
4. page data 수집 단계에서 특정 route/server-side code가 과도하게 오래 걸리는지
