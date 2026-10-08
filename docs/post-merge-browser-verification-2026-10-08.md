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

측정 진행 중이다. 부분 진단·사전 확인·live/start checkpoint·수집 도구 오류를 전체 재경기 9회에 포함하지 않는다. 전체 실행 JSON과 판정 도구의 출력이 확보되기 전에는 완료나 합격을 표시하지 않는다. [실행 문맥](artifacts/post-merge-20261008/browser-execution-context.json)에 실제 원본과 환경 한계를 별도로 기록했다.

이 브라우저의 foreground 탭 설정 API는 지원되지 않았다. 기존 문서의 계측된 가시성을 사용하며 창 focus나 실제 화면 presentation을 확인했다고 주장하지 않는다. 백그라운드 UI helper는 실행 문맥을 유지할 수 없어 중단됐으나 경기·계측은 유지됐고 실제 배속 변경·pause는 0이었다. 수집을 활성 도구 호출 안에서 회차별로 확인하는 방식으로 바꿨다. 40초 간격의 완료 확인은 결과 회수 절차이며, 자동 중지의 종료 시각을 40초 늘리지 않는다.

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
