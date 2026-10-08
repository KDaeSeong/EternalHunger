# 병합 이후 실제 브라우저 검증 · 2026-10-08

## 병합과 배포

PR #14의 검증 보강을 PR #13의 작업 브랜치에 병합한 다음 PR #13을 main에 병합했다. 각각의 병합 커밋은 `5871f18179e08ae849cece999ebc873ccffa93ca`, `1667de82ad9f7ecb94f31f9e14b20f273bc14002`다. 두 커밋의 source tree는 기존 검사한 `1baaa0f9c415ed16bf8212ea0cec4079fe07c4bc`와 동일하다. 게임 진행·난수·양보 정책을 추가로 바꾸지 않았다.

Vercel의 main 배포 상태는 success이며, 공개 운영 `/eternalhunger?perfProbe=1`의 실제 UI에서 v3 계측과 엔진 `30b286b86a44a0b31177b170f79383b421653dd150b97c3bdb31fe5a2710eee4`를 확인했다. [병합 증거](artifacts/post-merge-20261008/merge-evidence.json)와 [엔진/API 사전 확인](artifacts/post-merge-20261008/preflight-engine-check.json)을 보존한다. 보호된 미리보기의 인증을 우회하지 않았다. 이전 로컬 접속 거부는 원격 브라우저에서의 시도에 한정되며 사용자의 PC나 앱 전체가 실패했다는 근거가 아니다. 정확한 원인은 확인하지 않았다.

기존 자동 검사의 범위와 115개 회귀, 62/62 production 빌드, 일반/협력 전체 경기 결정성 근거는 [PR #13 검증 보강 기록](observer-scheduling-audit-2026-10-08.md)에 있다. 이들은 실제 화면 성능의 합격 증거가 아니다.

## 측정 조건

[실측 전에 기록한 정책](artifacts/post-merge-20261008/measurement-policy.json)을 따른다. 최신 엔진에서 기본 24명·8팀 원본 경기를 완주·보관한 다음, 같은 입력의 동일 재경기를 같은 문서에서 x1 세 번→x8 세 번→x32 세 번 순서로 측정한다. 각 실행의 라벨 대신 v3의 실제 배속·원본 ID·시드·종료 비교·가시성·경계를 검증한다. 중간 새로고침·강제 GC·수동 정지·배속 변경을 하지 않는다.

Long Task의 기존 관문은 strict <200ms다. RAF p95·최대 간격·heap 증가의 새 합격 예산은 정하지 않았다. 수치 비교는 수행하되 예산 부재를 전체 성능 합격으로 바꾸지 않는다. RAF는 callback 간격이며 화면에 실제 제시된 FPS나 INP가 아니다. heap 한두 값으로 장기 누수 부재를 주장하지 않는다.

현재 원격 Chrome/154, 1363×936, DPR 1, hardwareConcurrency 5에서 Long Tasks·LoAF·RAF·performance.memory를 사용할 수 있다. 이는 해당 원격 환경의 관측이며 사용자의 실제 PC 성능을 대신하지 않는다.

## 요청된 전체 재경기

기준 원본이 게임 시각 1,257초에 2팀 3/3 생존으로 완주·보관됐다. [보관 UI](artifacts/post-merge-20261008/source-complete-ui.txt)와 [화면](artifacts/post-merge-20261008/source-complete.jpg)을 보존한다. 원본 ID `f0d5e466-58b0-4757-a15f-abef72e42a46`, 시드 `1791415353213`의 x1 첫 동일 재경기를 시작했고 실제 `day=0`, `matchSec=0`, `autoPlay=false`부터 계측했으며 100.7ms 안에 오토가 시작됐다. [시작 checkpoint](artifacts/post-merge-20261008/replay-x1-1-start.json)은 완주 표본이 아니다.

측정 진행 중이며 x1 재경기 2회를 자동 종료 결과까지 회수했다. 같은 원본의 세 번째 x1 재경기를 이어서 측정하고 있다. 부분 진단·사전 확인·live/start checkpoint·수집 도구 오류를 전체 재경기 9회에 포함하지 않는다. 전체 실행 JSON과 판정 도구의 출력이 확보되기 전에는 9회 완료나 전체 성능 합격을 표시하지 않는다. [실행 문맥](artifacts/post-merge-20261008/browser-execution-context.json)에 실제 원본과 환경 한계를 별도로 기록했다.

이 브라우저의 foreground 탭 설정 API는 지원되지 않았다. 기존 문서의 계측된 가시성을 사용하며 창 focus나 실제 화면 presentation을 확인했다고 주장하지 않는다. 백그라운드 UI helper는 실행 문맥을 유지할 수 없어 중단됐으나 경기·계측은 유지됐고 실제 배속 변경·pause는 0이었다. 수집을 활성 도구 호출 안에서 회차별로 확인하는 방식으로 바꿨다. 40초 간격의 완료 확인은 결과 회수 절차이며, 자동 중지의 종료 시각을 40초 늘리지 않는다.

### x1 첫 전체 재경기

[자동 종료한 원본 JSON](artifacts/post-merge-20261008/replay-x1-1.json), [완료 UI](artifacts/post-merge-20261008/replay-x1-1-complete-ui.txt), [1회 입력 판정](artifacts/post-merge-20261008/first-completed-report.json)을 보존했다. 종료 경계는 `settled`, 종료 사유는 `replay-complete`다. 게임 시각 1,257초에 원본의 사건 **17,847개**, 최종 상태·종료 판정·난수가 일치했다. 이 실제 경기의 사건 개수는 기존 seed 1101 자동 결정성 표본의 14,976개와 다르다. 브라우저의 종료 비교를 모든 프레임 비교로 확대 해석하지 않는다.

| 지표 | x1 첫 전체 재경기 |
|---|---:|
| 계측 경과 | 2,138,225.7ms (35.64분) |
| Long Task 개수 / 총 시간 / 최대 | 637 / 54,348ms / **318ms** |
| RAF callback 표본 / 중앙 간격 | 4,158 / 366.7ms |
| RAF p95 | null; overflow 범위 1,016.3–1,116.4ms |
| RAF 최대 간격 / 첫·마지막 경계 간격 | 1,116.4 / 55.8·157ms |
| heap 시작 / 종료 / 변화 | 37,172,993 / 245,584,766 / +208,411,773bytes |
| 가시성 전환 / 종료 회수 중 알림 | 0 / 0; 전체 visible |
| 배속·원본 변경 / 수동 pause | 모두 0 |
| 팀별 판단 / 성장 slice / 단일 actor 최대 | 139.7 / 242.1 / 241.4ms |
| 종료 결과 캡처 / 비교 단계 최대 | 88.9 / 219.8ms |

1회 입력의 유효성은 통과했으나 Long Task strict <200ms 관문은 실패했다. 판정 도구의 전체 상태는 아직 `unverified`(exit 2)다. 이는 9회 미완료와 RAF·메모리 예산 부재를 반영하며, 관측된 318ms 실패를 합격으로 덮지 않는다. heap 변화는 GC·종료 기록 캡처 등에 민감한 실제 샘플이며, 증가만으로 누수 원인을 단정하지 않는다. 종료 캡처와 비교 단계에도 큰 시간이 관측됐지만, Long Task 최대가 어느 단계인지 확인할 시간별 task 기록이나 전체 스택은 이 JSON에 없다.

이전 도구 호출이 사용자에 의해 중단된 뒤에도 첫 경기는 앱 안에서 자동 종료했다. 후속 지시에 따라 기존 문서의 종료 결과를 먼저 회수한 다음 두 번째 재경기를 시작했다. 회수 시각을 첫 실행의 종료 시각으로 대체하지 않았으며, 두 실행 사이에 다른 경기·새로고침·수동 배속 변경을 끼우지 않았다.

### x1 두 번째 전체 재경기

[두 번째 자동 종료 JSON](artifacts/post-merge-20261008/replay-x1-2.json)과 [종료 확인 요약](artifacts/post-merge-20261008/replay-x1-2-completion-summary.txt)을 보존했다. 같은 엔진·원본·시드에서 게임 시각 1,257초에 17,847개 사건과 최종 상태·종료 판정·난수가 다시 일치했다. 배속·원본 변경·pause·가시성 전환·종료 회수 중 알림은 모두 0이며, 종료 경계는 `settled/replay-complete`다. 전체 DOM의 외부 업로드는 참가자 정보·위치·거래·경기 로그 공유 범위에 대한 자동 승인 검토에서 거부돼, 원본 DOM은 로컬에 두고 GitHub에는 성능 JSON과 종료 확인 요약만 공개한다.

| 지표 | x1 첫 회차 | x1 두 번째 회차 |
|---|---:|---:|
| 계측 경과(ms) | 2,138,225.7 | 2,160,138.9 |
| Long Task 개수 / 총 시간 / 최대(ms) | 637 / 54,348 / **318** | 670 / 57,418 / **333** |
| RAF 중앙 간격(ms) | 366.7 | null; overflow 범위 1,016.3–1,116.5 |
| RAF p95(ms) | null; overflow 1,016.3–1,116.4 | null; overflow 1,016.3–1,116.5 |
| RAF 최대 간격(ms) | 1,116.4 | 1,116.5 |
| heap 시작(bytes) | 37,172,993 | 37,925,277 |
| heap 종료 / 변화(bytes) | 245,584,766 / +208,411,773 | 270,379,157 / +232,453,880 |
| 팀별 판단 / 성장 slice 최대(ms) | 139.7 / 242.1 | 198 / 312.3 |
| 종료 결과 캡처 / 비교 단계 최대(ms) | 88.9 / 219.8 | 83.4 / 243.9 |

두 회차 모두 기존 Long Task 관문을 넘었다. 두 번째 회차에서는 중앙 간격까지 histogram 상한 1초를 넘었으므로 null과 범위를 그대로 기록했다. 아직 세 회차의 baseline 추세나 x8·x32와의 비교가 없으며, 두 값의 heap 증가로 누수나 전체 품질 합격을 판정하지 않는다.

### x1 첫 회차에서 관문 초과를 관측한 checkpoint

[첫 관측 checkpoint](artifacts/post-merge-20261008/replay-x1-1-first-task-budget-exceedance.json)는 경기 시각 511.75초·계측 경과 1,064,541.9ms의 **완주 전** 기록이다. Long Task 최대 253ms가 이미 strict <200ms 관문을 넘었다. 가시성·배속 변경·pause는 모두 0이었으나, 이 checkpoint를 완주 1회나 9회 결과로 계산하지 않는다. 이전 189ms 중간값을 해당 회차의 최종 최대값으로 고정하지 않는다.

이 checkpoint의 계측 단계 최대는 growth.slice 140.8ms, growth.singleActor 140.7ms, growth.teamCoordination 139.7ms였다. LoAF의 큰 script 표본은 `Scheduler.yield.then`, 253.7ms, sourceCharPosition 508294를 보고했다. 공개 운영의 `7830-ae94843aa3eb7f13.js`와 같은 파일명의 로컬 production bundle에서 이 위치는 `requestSimulationMainThreadYield`의 scheduler utility 주변이다. 비동기 재개 entrypoint 어트리뷰션은 전체 호출 스택이나 GC 원인 분석이 아니므로, 253ms를 특정 팀의 판단이나 scheduler utility 자체의 계산 시간으로 단정하지 않는다. 단계별 최대의 시점도 동일하지 않으며 중첩 총합으로 원인을 추정하지 않는다.

## 원본 경기 중간 진단

원본 경기의 게임 시각 159.75초에서 357.75초까지 별도로 수집한 [부분 표본](artifacts/post-merge-20261008/source-partial-x32.json)은 수동 종료 경계가 settled인 155,932.9ms 진단이다. 재경기가 아니며 경기 시작·완주를 포함하지 않는다. x32가 유지됐고 가시성 알림 0, 전체 visible이었으나, 전체 경기 성능이나 수정 전/후 비교의 표본으로 사용하지 않는다.

| 지표 | 이 부분 표본에서 관측한 값 |
|---|---:|
| Long Task 개수 / 총 시간 / 최대 | 7 / 511ms / 136ms |
| RAF callback 표본 / 중앙 간격 | 507 / 33.3ms |
| RAF p95 | null; overflow 범위 1,016.3–1,033ms |
| RAF 최대 간격 | 1,033ms |
| 첫 RAF / 마지막 RAF→종료 간격 | 1.832ms / 15.4ms |
| heap 시작 / 종료 / 변화 | 96,188,374 / 98,907,385 / +2,719,011bytes |
| 가시성 전환 / 종료 회수 중 알림 | 0 / 0 |
| 팀별 판단 단계 최대 | 43.9ms |
| 성장 slice 최대 | 52.3ms |

계측한 성장 단계는 중첩 관계여서 총 시간을 합산하지 않는다. 이전의 8팀 일괄 판단 211.3ms와 현재 팀별 단계 최대는 같은 단위의 전후 비교가 아니다. 약 1초 간격의 원인은 아직 확인하지 않았다. 가시성과 Long Task 최대만으로 부드러운 화면이나 배속 달성을 선언하지 않는다. [중간 live 상태](artifacts/post-merge-20261008/source-partial-live.json)도 별도 보존하며 최종값으로 재사용하지 않는다.
