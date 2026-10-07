# PR #13 팀 판단·관전 성능 검증 보강 · 2026-10-08

후속 상태: PR #14→PR #13→main 병합과 최신 공개 운영 배포를 확인했다. 실제 브라우저의 후속 관측은 [병합 이후 검증](post-merge-browser-verification-2026-10-08.md)을 따른다. 아래 0개 표본과 인증/로컬 접근 한계는 보강 작업 당시의 이력이다.

검토 기준은 PR #13 HEAD `050000ea600db850a5d7939304350a129ed9b367`, 기존 엔진 `ea908055…`다. 보강 엔진은 `30b286b86a44a0b31177b170f79383b421653dd150b97c3bdb31fe5a2710eee4`다. 최신 브라우저 성능은 **미검증**이며 main 병합이나 성능 개선 달성을 뜻하지 않는다.

## 스케줄러 검토

`buildTeamCoordinationSteps`는 공유 계획용 로스터로 팀을 구성하고 팀 사이에서 yield한다. `runGrowthActionSteps`는 예산을 확인한 뒤 실제 브라우저 양보를 요청한다. 빠른 팀 여러 개가 한 slice에 들어갈 수 있으며, **8ms는 한 팀을 선점하거나 작업 시간을 8ms 이하로 제한하는 값이 아니다.** 한 팀의 판단이 길면 그 팀의 계산·난수 소비는 끝까지 원자적으로 진행된다. 추가한 합성 사례에서 한 팀의 모의 작업이 100ms여도 팀 하나를 완료한 뒤에 양보하는 계약을 확인했다. 이 100ms는 브라우저 측정값이 아니다.

게임의 팀/실험체 순서, 공유 스냅샷, 이동·전투 규칙, 난수 소스, 양보 정책은 변경하지 않았다. 실제 host wait 실패가 남은 팀 iterator를 닫고 난수 문맥을 해제하는 검사도 추가했다. 성능 수치가 없는 상태에서 팀 내부를 추가로 분할하거나 로직/난수 순서를 바꾸지 않았다.

## 검사로 확인할 수 있는 범위

| 항목 | 자동 회귀의 근거 | 실제 브라우저에서 필요한 근거 |
|---|---|---|
| 팀 판단 | 팀 순서·원자성·공유 스냅샷·취소·host wait 실패·난수 상태 | 팀 하나와 slice의 실제 최대 실행 시간 |
| 전체 경기 | 같은 입력의 사건·모든 프레임·최종 상태·종료·로그·난수 일치 | 실제 사용자 관전 시 동일 재경기 표시와 실시간 진행 |
| 긴 작업·RAF | 집계·overflow·첫/마지막 RAF 지연·미지원 API·종료 기록 회수의 합성 검사 | Long Tasks·LoAF·RAF 간격·초기/종료 지연의 실제 분포 |
| 가시성 | visible→hidden→visible, 같은 상태로 늦게 전달된 이벤트, 리스너 정리 | 측정 내내 탭이 가시적이었는지 |
| 메모리 | 선택한 객체 뿌리의 WeakRef 수명·소유권·구독 정리 | 동일 조건 연속 3회의 시작/종료 heap 및 GC/자료 수명 분석 |
| 렌더링·입력 | query gating·제한된 JSON·클릭/RAF 계약 | 실제 화면·조작·paint/presentation·INP; RAF/LoAF만으로 대체하지 않음 |

## 실제 수정과 판정 방어

1. Long Tasks는 `supportedEntryTypes`에 `longtask`가 있는지 확인한 뒤 관찰한다. `observe()`가 예외 없이 반환해도 미지원일 수 있으므로 지원으로 간주하지 않는다.
2. 시작/종료 경계에 겹치는 Long Task·LoAF는 전체 entry 시간으로 보존하고 범위를 JSON에 명시한다. 유효하지 않은 timestamp와 측정 밖 entry를 제외한다.
3. 첫 RAF까지의 지연과 마지막 RAF→중지의 미완료 간격을 별도로 기록한다. 건강한 p95만으로 경계의 284ms 정지를 숨길 수 없다. 일반 RAF p95는 기존 전체 측정 histogram이며 경계 간격은 p95 모집단에 임의로 섞지 않는다.
4. 완주 비교 뒤 `stopAfterFrame`은 한 RAF와 다음 task를 기다린 뒤 observer를 회수한다. 종료 시각·heap·DOM·가시성은 중지 요청 때 고정해 회수 대기 시간을 실행 시간으로 섞지 않는다. timeout/숨김/즉시 unmount·재시작은 `boundary.status=incomplete`이며 합격 근거가 아니다. 자동 중지 결과도 소유 복사로 보존한다.
5. 실제 배속·시드·엔진·재경기 원본 ID·진행 시각·완주 비교를 스칼라로 기록한다. 라벨은 성능 조건 증거가 아니다. 배속/원본 변경과 중간 수동 정지를 기록하고, 동일 재경기는 결과 비교 뒤 자동으로 중지한다.
6. 모든 `visibilitychange` 알림을 센다. hidden→visible 전환이 늦게 전달되어 callback에서 다시 visible만 보더라도 전체 가시성 합격을 표시하지 않는다. 종료 회수 대기 중 도착한 알림도 `boundaryNotifications`에 남기고 가시성 합격을 막되 종료 시각과 구간 시간은 늘리지 않는다. 알림 시점의 상태를 확인할 수 없었던 실제 hidden 지속시간까지 복원했다고 주장하지 않는다.
7. 잘못된 heap 숫자·baseline 부재·0개 RAF·미지원 API·옛 v2/옛 엔진·불완전한 9회·새로고침/환경 변경·시간 겹침은 근거 부족으로 남긴다. p95 overflow는 null/범위를 유지하고, 반올림한 p95의 상단 오차 범위까지 기준과 비교한다.

계측은 bounded histogram/단계·LoAF 상위 표본과 스칼라 문맥만 보유한다. replay 원본, 실험체 배열, Window/PerformanceEntry를 결과에 붙이지 않는다. 수집한 클릭→다음 RAF는 INP/presentation 측정이 아니다.

## 이번 실행 환경과 미측정 표

최신 Vercel 미리보기는 `Login – Vercel`로 이동했다. 로그인·인증 우회·보호 해제는 수행하지 않았다. 로컬 production 빌드는 62/62 페이지 생성과 종료 코드 0을 확인했다. 같은 실행 네트워크의 `/eternalhunger?perfProbe=1` HTTP smoke는 200이지만, 현재 cloud browser의 로컬 접속은 `ERR_CONNECTION_REFUSED`였다. HTTP/빌드를 브라우저 hydration·렌더링·성능 증거로 사용하지 않는다.

| 배속 | 요청된 연속 재경기 | 실제 최신 브라우저 표본 | 긴 작업·RAF·heap·가시성 비교 | 판정 |
|---|---:|---:|---|---|
| x1 | 3 | 0 | 미측정 | 미검증 |
| x8 | 3 | 0 | 미측정 | 미검증 |
| x32 | 3 | 0 | 미측정 | 미검증 |

수정 전 운영의 x32 Long Task 최대 284ms와 팀 판단 211.3ms, 중간 가시성이 없는 기존 v2 자료는 실패/한계 근거로 보존한다. 새 엔진의 수치로 재사용하지 않는다. 회귀 성공을 속도 개선이나 메모리 누수 부재로 바꾸지 않는다.

## 재측정 절차와 판정 도구

1. 인증 가능한 최신 배포 또는 브라우저가 접근할 수 있는 production 빌드에서 `?perfProbe=1`을 연다. 측정 전에 엔진 hash와 기기/브라우저/뷰포트·같은 관전 탭·조작 계획을 고정한다. 성능 검사/빌드를 측정과 동시에 실행하지 않는다.
2. 최신 엔진으로 원본을 한 번 완주·보관한다. 진단 파일도 엔진 hash에 포함되어 기존 hash 기록의 재경기 차단은 유지된다. 아래 9회는 모두 이 새 원본의 동일 재경기다.
3. x1 세 번→x8 세 번→x32 세 번을 같은 문서에서 실행한다. 새로고침·강제 GC·원본 변경을 하지 않는다. 각 복원 직후 배속을 설정하고 경기 시작 전에 계측을 시작한다. 5초 안에 오토를 시작하며, 중간 수동 정지·배속 변경 없이 완주한다. 결과 비교 뒤 자동 중지를 기다린다. 이 5초와 종료 뒤 1초는 유휴 구간을 제한하는 측정 절차이며 제품 성능 SLA가 아니다.
4. 다음 원본 복원 전에 `측정 JSON 보기`의 완성된 v3 JSON을 보존한다. 실패/숨김/부분 표본도 삭제하지 않고 모든 실행의 순서와 사유를 남긴다. 재시도가 필요하면 기존 묶음은 보존하고 별도 9회 묶음을 시작한다.
5. 9개 원본 JSON을 실행 순서대로 배열 파일로 묶어 아래 명령을 실행한다. Long Task 기존 기준은 strict **<200ms**다. RAF p95/최대 간격/heap 증가 예산은 이번에 임의 설정하지 않았다. 해당 예산은 실측 전에 명시해야 하며, 생략하면 전체 판정은 `unverified`다. 각 지표와 메모리 추세는 계속 출력한다.

```sh
cd client
npm run analyze:observer-performance -- nine-runs.json \
  --expected-engine=30b286b86a44a0b31177b170f79383b421653dd150b97c3bdb31fe5a2710eee4 \
  --output=observer-performance-report.json
```

사전 지정할 선택 인자는 `--max-raf-p95-ms`, `--max-raf-gap-ms`, `--max-baseline-heap-growth-bytes`이며 모두 `=숫자` 형식이다. 종료 코드는 **0=정해진 관측 관문 통과, 1=실측 관문 실패, 2=근거/기준 부족**이다. 시작 heap이 세 번 모두 증가하면 한 종료 표본의 감소나 느슨한 예산만으로 메모리 합격을 선언하지 않는다. 충분한 표본의 `pass`도 이 기기·입력의 관측 관문만 뜻하며, paint/INP·장기 누수 부재를 뜻하지 않는다.

## 실행 근거

계측 33·판정 13·팀 스케줄링 6·성장 스케줄링 18·양보 10·자료 수명 27·관전 방어선 8, 합계 115개가 통과했다. 변경 코드 10파일 runtime ESLint, production 빌드 62/62가 통과했다. 판정/계측 시간 검사에는 합성 clock/RAF/observer를 사용하며 실제 브라우저 성능으로 계산하지 않는다. 시드 1101·24명 fixture에서 계측을 켠 일반/협력 두 전체 경기 각각의 사건 14,976개·프레임 6,390개·종료 상태·로그·난수(10,672 draws)가 일치했다. 두 결과의 입력/사건/모든 프레임/최종 상태/종료/로그/난수는 PR #13의 보강 전 실행과도 정확히 일치했다. [결정성 요약](artifacts/observer-scheduling-20261008/determinism-summary.json)과 [원출력](artifacts/observer-scheduling-20261008/diagnostics-match-1101.ndjson), 그 밖의 [실행 근거](artifacts/observer-scheduling-20261008/)를 보존한다. 한 fixture의 근거이며 모든 입력의 보편적 증명은 아니다.

빈 실제 측정 목록으로 만든 `browser-matrix.json`은 의도적으로 `unverified`, 각 배속 표본 0이다. `environment-check.json`은 접근 한계와 HTTP smoke 범위다.

근거 명세: [W3C Performance Timeline](https://www.w3.org/TR/performance-timeline/#dom-performanceobserver-observe), [W3C Long Animation Frames](https://www.w3.org/TR/long-animation-frames/). observer task/entry와 RAF/render 단계의 명세가 실제 화면 presentation이나 모든 브라우저의 전달 완전성을 보증한다고 확대하지 않는다.
