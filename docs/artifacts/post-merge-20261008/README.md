# 병합 후 브라우저 성능 자료

`measurement-policy.json`은 전체 재경기 측정 전에 기록한 정책이다. 게임 코드·난수·진행 순서를 바꾸지 않고, 하나의 보관 원본을 같은 문서에서 x1 세 번, x8 세 번, x32 세 번 순서로 실행한다. 자동 종료 경계를 회수한 뒤에만 다음 실행을 시작한다. 늦은 결과 회수 시각을 실제 종료 시각으로 바꾸지 않는다.

전체 판정 입력은 다음 **완료된 원본 JSON 9개만** 순서대로 사용한다. 아직 없는 파일을 빈 객체나 합격한 과거 표본으로 채우지 않는다.

```
replay-x1-1.json
replay-x1-2.json
replay-x1-3.json
replay-x8-1.json
replay-x8-2.json
replay-x8-3.json
replay-x32-1.json
replay-x32-2.json
replay-x32-3.json
```

`current-replay-live.json`, `*-start.json`, `*-handoff-live.json`, `*-first-task-budget-exceedance.json`, `source-partial*.json`, `preflight-engine-check.json`, `replay-collection-progress.json`, 환경/병합/정책 자료와 판정 도구의 출력은 전체 회차 입력이 아니다. 이 폴더의 `*.json` wildcard를 판정 도구에 넘기지 않는다. 모든 실패·무효 표본은 보존하고 가장 좋은 세 표본만 고르지 않는다. 실제 engine·배속·원본 ID·시드·초기/종료 상태·비교·정지/변경 횟수·문서 시계·가시성·경계를 검증하며 자유 입력 라벨만 믿지 않는다.

기존 Long Task 관문은 strict <200ms다. RAF p95·최대 간격·heap 증가의 새 예산을 관측 뒤에 만들지 않는다. histogram 상한을 넘으면 null과 범위를 그대로 기록하며 0이나 상한값으로 대체하지 않는다. API 미지원·종료 회수 불완전·가시성 전환은 합격 근거가 아니다. 전체 입력이 없으면 전체 상태는 `unverified`이고, 개별 관문 초과는 별도의 `fail`로 남긴다.

RAF는 callback 간격으로 실제 화면 제시 FPS나 INP를 측정하지 않는다. heap은 GC에 민감한 시작·종료 샘플이며 강제 GC를 하지 않았다. 같은 배속 세 실행의 시작 baseline도 비교하되 누수 부재로 확대하지 않는다. 팀/actor 단계는 중첩되므로 총 시간을 합산하지 않으며 LoAF는 진입점 귀속으로 전체 스택이 아니다.

이후 회차의 전체 DOM은 참가자 정보·HP·위치·거래·경기 로그의 외부 공유에 대한 자동 승인 검토에서 거부돼 로컬에 보존한다. GitHub에는 성능 JSON과 해당 로그를 제외한 `*-completion-summary.txt`만 공개한다. 결과 요약은 관측한 종료 UI와 JSON에서 확인한 값이며, 가공한 새 경기 데이터가 아니다.
