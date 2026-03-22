Uploaded page.js only check result

- 대상: user-uploaded /mnt/data/page.js 만 client/src/app/simulation/page.js에 반영해서 검사
- 수행:
  - npm ci --no-audit --no-fund
  - eslint -c eslint.runtime.config.mjs src/app/simulation/page.js
  - npm run build
- 결과:
  - strict runtime eslint: error 0 / warning 19
  - build: pass
- 이번 핫픽스:
  - init start-zone 추천 로직의 map+sort 체인을 단순 loop + try/catch fallback 으로 치환
  - 초기 survivor 셔플을 in-place sort 체인 대신 Fisher-Yates로 교체
  - useEffect init fetchData 호출부에 최종 .catch 가드 추가
