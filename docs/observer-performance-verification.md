# Eternal Hunger 관전자 성능 검증

기준일: 2026-09-12. G4의 화면 부하와 동기화 범위를 다룬다. 자동 방어선은 실제 브라우저 FPS·메모리·반응성 증거를 대신하지 않는다.

## 발견한 고비용 경로

- 사건 하나마다 최대 5,000개 화면 배열을 복사해 React 상태를 갱신하던 경로
- 팀 관전 모델이 전체 화면 사건을 정렬하고 팀원마다 마지막 판단을 다시 찾던 경로
- 킬·전투 상세 로그가 제한 없이 DOM 행을 만들던 경로
- 선택하지 않은 팀 관전·경기 현황·로그 탭까지 렌더 트리에 남던 경로
- 행동 프레임마다 생존자·사망자·장비·월드를 깊은 복사하는 경로

마지막 프레임 깊은 복사는 UI와 실행기가 같은 객체를 공유하지 않게 하는 정합성 경계이므로 정적 추측만으로 제거하지 않았다. 실제 프로파일에서 비용이 확인될 때 소유권 계약을 보존하는 별도 최적화를 설계한다.

## 적용한 완화

- `SimulationPageView.js`, `SimulationMainStage.js`: 숨은 생존자 보드·미니맵과 비활성 관전 패널을 조건부 mount하고, 지도 추적에 필요한 최소 ID 계산만 유지한다.
- `SimulationMinimapCanvas.js`, `customMapRenderGeometryRuntime.js`: 정적·사용자 지도 레이어와 추적 Set을 memoize·재사용한다.
- `teamObserverRuntime.js`: 이미 시간순인 사건을 다시 정렬하지 않고 한 번의 선형 순회로 마지막 판단을 모은다. 최근 사건 10개와 종료 주요 사건 8개만 반환한다.
- `logActionRuntime.js`, `useSimulationLogs.js`: 전체 재경기 로그는 보존하되 full-log 배열의 O(n²) spread를 `push`로 바꾸고, 화면 로그는 microtask 하나로 묶는다. 화면 run event는 최신 5,000개만 둔다.
- `phaseActorActionPipelineRuntime.js`: phase 계획 roster는 actor를 얕게 복제하고 planner가 변경하는 inventory만 깊게 복제한다. 공간·전투·상태 트리는 읽기 공유한다.
- `phaseActorActionPipelineRuntime.js`, `phaseActorMovementRuntime.js`: null/non-array roster는 빈 roster로 방어하고, 유효한 team movement plan이 있으면 개인 `chooseAiMoveTargets`·TTL 생성을 건너뛰고 팀 계획을 직접 사용한다.
- `logPresentation.js`, `SimulationLogPanel.js`: 킬·전투 상세를 뒤에서부터 읽고 한 번에 200행만 렌더한다. 전체 사건은 내보내기와 재경기 기록에 남는다.
- `observerPerformanceRuntime.js`, `SimulationObserverPerformancePanel.js`: `?perfProbe=1`에서만 RAF 간격/FPS, Long Task, 지원 시 JS heap 시작·종료·증감, DOM 노드 수를 수집한다. 측정 중 document capture click의 `event.timeStamp`부터 다음 `requestAnimationFrame`까지도 `inputResponse`로 기록한다. 이는 클릭 뒤 다음 프레임 기회까지의 지연이며 React commit, 실제 paint 완료나 사용자의 인지 시각을 뜻하지 않는다. 일반 주소에서는 패널·RAF·observer를 만들지 않으며 중지한 결과를 1초 갱신 타이머가 지우지 않는다.
- `simulationCooperativeYieldRuntime.js`, `simulationPhaseCycleRuntime.js`, `phasePvpActionLoopRuntime.js`: 브라우저에서만 phase 준비·마무리와 상태 확정→프레임 복제/게시 사이를 `scheduler.yield()` 또는 `setTimeout(0)`로 나눈다. generator 경계에서만 기다리므로 대기 중 match RNG는 해제되고, Node 검사는 timer를 만들지 않는다.

## 자동 검사 증거

`npm run check:observer-performance-guards`: 8/8, 종료 코드 0.

`check-phase-runtime-performance.mjs`: 4/4, 종료 코드 0. planner clone의 구 구현 결과 동등성·차원 균열 제외·변이 격리·null roster 방어와 full-log append·visible-log enqueue 계약을 확인했다.

`npm run check:observer-performance-probe`: 3/3, 종료 코드 0. RAF를 timer 지연으로 대체하지 않는 계산, 측정 시작 전 Long Task 제외, heap 미지원의 명시적 표시, query gating·접근성·중지 결과 보존을 확인했다. 입력 listener의 측정 중에만 등록, `event.timeStamp`→다음 RAF 계산, 중지·재시작·unmount 정리도 같은 정적 계약에 포함한다. 이 검사는 계측 구현 증거이지 실제 250ms 성능 합격 증거가 아니다.

1. 화면 사건 묶음의 순서·최신 5,000개 상한·입력 비변경
2. UI에는 한 묶음만 예약하면서 전체 재경기 사건은 빠짐없이 보존
3. 킬·전투 상세의 tail scan과 200행 DOM 상한
4. 긴 사건 창에서도 팀 관전 반환 배열 상한 유지
5. 비활성 관전 탭의 고비용 패널 트리 미보존
6. 숨은 생존자 보드가 문자 모달 밖에서 mount되지 않음
7. 미니맵·관전자 선택 경로의 반복 polygon·Set 할당 방지
8. 미니맵·관전자 static/custom layer 재사용과 observer model gating

같은 소스에서 팀 전술 29/29, 팀 관전 17/17, 실시간 프레임 10/10, 난수 격리 12/12, replay 14/14 exact, custom map/rules 7/7+9/9가 통과했다. `check-live-frames`는 `getRuleset(id, simulationRuleset)` 계약으로 10/10을 확인했다. 이 결과는 최적화가 사건 순서·프레임 소유권·난수·재경기를 깨뜨리지 않았다는 자동 증거다. 이는 브라우저 FPS·heap의 대체 증거가 아니다.

cooperative yield를 추가한 현재 엔진 hash는 `6dc2c59533dd9b2f9178edcd4ceeff5d7bfb25fcccbf3afca0346619422fb510`이다. 영향 범위의 난수 12/12·action timeline 10/10+diagnostics 9/9·replay 14/14 exact·대상 ESLint와 60/60 production build를 먼저 통과한 뒤, 같은 hash에서 `cmd /c npm run check:eternal-hunger` 단일 전체 체인을 새로 실행해 모든 하위 검사와 60/60 production pages build가 종료 코드 0임을 확인했다. 난수 complete matches는 seed 1101의 3경기에서 frames 6,505·events 7,076·ticks 1,273.75·draws 9,584·API 0을 확인했고 event digest `2a67a4...`, frame digest `2f89f6...`를 기록했다. action timeline seed 1101은 1,280.75초에 종료하며 frames 6,609·farming pickups 549·crafts 350·battles 101·API 0이었다.

로그인 없는 실제 브라우저에서 사용자 지도·규칙의 저장→새로고침→선택→재경기 snapshot 보존도 확인했다. 시드 `1789163312032`는 7팀·초롱 1명 생존, `1789163583099`는 6팀·새벽 3명 생존이었다. 이 표본은 사용자 지도/규칙 경로의 상태 보존 증거이며, 전체 x1/x8/x32 성능 합격 증거는 아니다.

## 최종 프로덕션 브라우저 표본

최종 프로덕션 built-in `guest-lumia-island` 18구역·24명·x32에서 같은 시드로 완주 표본을 남겼다. 각 화면은 30회·40ms timer를 사용하고 `Date.now()` 차이와 DOM을 표본화했다. 브라우저 heap·FPS는 측정할 수 없었다.

- built-in: 20:22에 `team6`·새벽 2/3명 생존으로 완주했다. 10개 표본에서 200ms 초과는 0회였고, 최대값은 초기 `186/193/157ms`, 이후 `132/166/116/151/133/121ms`, 종료 구간 최대 55ms였다.
- 사용자 6구역 지도: 같은 시드로 8:31.83에 `team4`·매화 2/3명 생존으로 완주했다. 표본 최대값은 `163/154/134/85ms`, 종료 구간 최대 48ms였고 200ms 초과는 0회였다.
- 비교 기준: 수정 전 built-in x32 표본은 팀 관전 최대 257ms, 경기 현황 최대 299ms, 전체 로그 최대 267ms였고 p95가 최대 226ms까지 올랐다.

위 결과는 **200ms stall sample gate 통과**만 뜻한다. x32 지속 구간 median은 대체로 58–62ms였으므로 부드러운 애니메이션, FPS, heap 안정성 또는 장시간 메모리 증거로 확장하지 않는다. x1/x8 전체 실행은 최종 최적화 전 표본이며, 최종 빌드의 worst-case 재실행은 x32만 확인했다.

### RAF·Long Task·heap 계측 표본

엔진 `3bea194628d10e9a7eb17446af7ee1891d622edb88d9bee2f23036ce3fe8ed50` 프로덕션 빌드에서 로그인하지 않고 사용자 6구역 지도, 24명·8팀, 시드 `1101`의 원본 x1과 그 저장 입력 x8 재경기를 완주했다. 두 경기는 모두 09:08.75에 6팀·새벽 포함 3/3명 생존으로 끝났고, x8 결과창은 **원본과 사건 3,721개·최종 상태·종료 판정 일치**를 표시했다.

| 화면·배속 | 벽시계 | RAF FPS | interval median / p95 / max | Long Task count / total / max | heap 시작 → 종료 (증감) | DOM |
| --- | ---: | ---: | --- | --- | --- | ---: |
| 팀 관전 x1 완주 | 605.740초 | 99.34 | 10 / 10.1 / 150ms | 26 / 2,885 / 165ms | 24,374,618 → 31,783,483B (+7,408,865B, +7.07MiB) | 743 |
| 팀 관전 x8 동일 재경기 완주 | 105.984초 | 97.09 | 10 / 10.1 / 180.1ms | 27 / 3,165 / 193ms | 30,103,652 → 47,237,968B (+17,134,316B, +16.34MiB) | 731 |
| 경기 현황 x8 구간 | 20.572초 | 95.614 | 10 / 10.1 / 160ms | 6 / 922 / 171ms | 38,306,195 → 52,350,891B (+14,044,696B, +13.39MiB) | 624 |
| 전투 상세 로그 x8 종료 구간 | 28.639초 | 98.851 | 10 / 10.1 / 120ms | 3 / 279 / 127ms | 35,851,179 → 33,834,667B (-2,016,512B, -1.92MiB) | 547 |

이 네 표본에서는 RAF interval과 Long Task 최대가 모두 200ms 미만이었다. 뒤의 전투 상세 표본에서 heap이 감소했으므로 앞선 양의 delta만으로 단조 누수를 선언할 근거는 없지만, 한 세션의 GC 시점에 민감한 수치이므로 장시간 안정성 통과로도 확대하지 않는다.

### strict-final 재측정과 cooperative yield 수정

평가 ID 난수를 분리한 엔진 `93212b54...583a`의 무간섭 재측정에서는 x8 Long Task 최대 168ms였지만 x1은 211ms로 strict 200ms gate를 실패했다. x8 heap delta는 +3.02MiB, 이어 실행한 x1은 +1.34MiB였고 두 실행 모두 사건 3,721개·최종 상태·종료 판정 exact였다. 약 13개 phase마다 반복되는 동기 구간을 분석한 뒤, RNG를 소비하지 않는 브라우저 cooperative yield를 phase 경계와 상태 확정→프레임 게시 경계에 추가했다.

현재 엔진 `6dc2c595...b510` 프로덕션 빌드에서 같은 사용자 6구역 지도·24명·8팀·시드 1101을 다시 측정했다. 첫 x8은 새 원본 경기였으며 측정 라벨에 `replay`가 들어갔지만 결과 UI는 새 기록 보관 성공을 표시했다. 이어 그 기록을 x1 동일 재경기로 실행했고 결과 UI는 **원본과 사건 3,721개·최종 상태·종료 판정 일치**를 표시했다. 두 측정은 완료를 polling하지 않고 나중에 패널을 중지했으므로 `elapsedMs`에는 완주 뒤 유휴 시간이 포함된다. 아래 측정 창 길이를 경기 완주 시간으로 사용하지 않는다.

| 화면·배속 | 측정 창(완주 후 유휴 포함) | RAF FPS | interval median / p95 / max | Long Task count / total / max | heap 시작 → 종료 (증감) | DOM |
| --- | ---: | ---: | --- | --- | --- | ---: |
| 팀 관전 x8 새 원본 | 171.838초 | 97.796 | 10 / 10.1 / 200ms | 26 / 3,061 / 187ms | 21,054,414 → 36,116,930B (+15,062,516B, +14.36MiB) | 746 |
| 팀 관전 x1 동일 재경기 | 795.493초 | 99.322 | 10 / 10.1 / 150ms | 27 / 3,224 / 165ms | 28,941,673 → 39,059,963B (+10,118,290B, +9.65MiB) | 726 |

수정 뒤 두 표본의 Long Task 최대는 모두 200ms 미만이고 x8의 RAF interval 최대는 정확히 200ms였다. 따라서 이전 x1 211ms 실패는 이 입력의 재측정에서 해소됐다. 다만 x8 종료 heap 36.12MB 뒤 새 replay page의 x1 시작 baseline이 28.94MB로 낮아져 단조 증가만 보이지 않았을 뿐, 같은 최종 hash의 3회 이상 연속 실행·GC 기준선은 아니므로 누수 합격으로 확대하지 않는다.

### 입력 반응·요약/킬 탭과 연속 heap 재측정

같은 hash·사용자 6구역 지도·24명·8팀·시드 1101의 x8 동일 재경기에서 성능 측정을 켠 채 경기 현황, 전체 로그, 요약, 킬, 팀 관전과 6팀 선택을 실제로 클릭했다. 종료 결과는 다시 09:08.75·6팀 3/3명·사건 3,721개·최종 상태·종료 판정 exact였다. 최종 측정은 97.880fps, interval 10/10.1/170ms, Long Task 27/2,855/165ms, heap 25,121,551→35,749,313B(+10,627,762B, +10.14MiB), DOM 729였다. 경기 현황·전체 로그·요약·킬 전환 중 DOM은 각각 630·673·695·605였고, 수집된 click→다음 RAF 표본 8개의 최대는 6.3ms였다. 250ms 초과 표본은 없었지만 표본 수가 작고 paint 완료를 재는 값이 아니므로 일반적인 입력 지연 분포나 p95/p99 증거로 확대하지 않는다.

그 직후 같은 page session에서 팀 관전 탭을 유지하고 DOM polling 없이 동일 입력 x8 replay를 세 번 연속 실행했다. 각 결과는 원본과 사건 3,721개·최종 상태·종료 판정 exact였다.

| 연속 run | RAF FPS | interval median / p95 / max | Long Task count / total / max | heap 시작 → 종료 (증감) | inputResponse samples / max | DOM |
| --- | ---: | --- | --- | --- | --- | ---: |
| 1 | 97.442 | 10 / 10.1 / 150.1ms | 27 / 3,083 / 162ms | 30,166,259 → 36,998,009B (+6,831,750B, +6.52MiB) | 2 / 6.7ms | 717 |
| 2 | 97.849 | 10 / 10.1 / 160ms | 27 / 3,086 / 165ms | 31,056,650 → 34,937,082B (+3,880,432B, +3.70MiB) | 2 / 6.4ms | 717 |
| 3 | 97.563 | 10 / 10.1 / 190ms | 28 / 3,166 / 199ms | 30,992,768 → 37,440,386B (+6,447,618B, +6.15MiB) | 2 / 6.1ms | 717 |

연속 시작 baseline은 30.17→31.06→30.99MB로 세 번째에 낮아져 단조 상승이 재현되지 않았다. 이 조건의 3회 표본에서는 지속 증가 징후가 없다는 판정까지 가능하다. 강제 GC나 종료 후 안정화 baseline을 직접 계측하지 않았으므로 `누수 없음`의 보편 증거로는 확대하지 않는다. 세 실행의 Long Task 최대는 162/165/199ms로 모두 200ms 미만이지만 마지막 표본은 문턱보다 1ms 낮은 경계값이다.

## 현재 브라우저 판정과 남은 범위

1. 확인한 PC·Chromium·사용자 6구역 지도·24명·8팀·시드 1101에서는 x1/x8 Long Task, 요약·킬 탭, 수집된 click→다음 RAF와 3회 연속 heap 추세가 현재 기준을 통과했다.
2. 프레임 정합성은 자동 `check:live-frames` 10/10과 브라우저 표본을 구분해 유지한다. 실제 paint 완료, 입력 p95/p99, 강제 GC 뒤 안정화, 장시간·다른 기기·더 큰 사용자 지도는 이번 표본이 증명하지 않는다.
3. 이후 현재 조건에서도 200ms를 넘는 Long Task, 계속 증가하는 시작 baseline, click 뒤 250ms를 넘는 반복 지연이 관측되면 합격을 철회하고 프로파일 근거로 병목을 수정한다.

현재 판정은 **정적 완화 8/8·phase 성능 회귀 4/4·probe 3/3·x32 timer stall·현재 hash x1/x8 strict Long Task·요약/킬 실시간 전환·수집 click→다음 RAF·3회 연속 heap 추세의 확인 조건 통과**다. 따라서 G4의 현재 사용자 지도 성능 관문은 닫는다. 위의 계측 한계는 그대로 유지하며, 물리 IndexedDB quota와 G5.3 실제 사용자 평가는 별도 잔여다.
