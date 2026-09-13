# MyAnimecraft 64 경기 재구축 경계

이 문서는 구형 EXE의 정적 분석 결과 중 현재 MyAnimecraft 64 경기 코어에
반영한 범위와, 아직 원본과 다른 부분을 기록한다. 원본의 직접 증거와 함수 주소는
[`original-match-simulation.md`](./original-match-simulation.md)를 기준으로 한다.

## 현재 계산 순서

1. `playerForSimulation`이 `legacy-additive-offset: 816` 표지가 있는 선수의
   경기용 복제본에서만 `816`을 한 번 뺀다. Project64, Editor, CareerSave의
   raw 능력치는 바꾸지 않는다.
2. `applyOriginalMapPlayerAdjustment`가 원본 맵 계수와 물리 맵 공식을 한 번
   적용한다.
3. `levelAdvantageBonuses`가 높은 선수에게
   `(자기 레벨 - 상대 레벨) × 5`, 최대 25의 flat 능력점을 준다.
4. Editor/Project64의 `baseMatchupBias`는 맵 필드와 합치지 않고 별도 전역
   종족 상성 배수로 적용한다.
5. `simulateSet`과 `estimateWinProb`가 같은 맵 helper를 거친 선수를 사용한다.

## 원본 맵 계수의 Project64 대응

Project64의 `matchupBalance`는 원본의 100 중심 값을 -1..1 bias로 저장한다.
원본 P/T만 현재 스키마의 TvP와 관점이 반대다.

```text
strategy, sense = stat × (1 - TvP bias)
attack         = stat × (1 - TvZ bias)
macro          = stat × (1 + ZvP bias)
defense        = stat × (1 + TvZ bias)
```

컨트롤·견제·정찰에는 직접 맵 계수가 없지만, 견제와 정찰은 아래 물리 delta의
대상이다.

## 종족쌍별 물리 delta

```text
T vs Z = (rushDistance - 50) × 4
Z vs T = (50 - rushDistance) × 4
Z vs P = (resources - 50) × 4
P vs Z = (50 - resources) × 4
P vs T = (complexity - 50) × 4
T vs P = (50 - complexity) × 4
동족전 = 0
```

맵 계수가 적용된 전략 proxy를 `1..1000`으로 제한한 뒤 다음 값을 사용한다.

```text
strategyFactor = (strategy + 1000) / 1000

delta > 0이면 delta × strategyFactor
delta < 0이면 delta ÷ strategyFactor
```

이 delta는 공격·견제·물량·방어·정찰에 더한다. 맵 계산을 마친 컨트롤을
포함한 8능력치는 모두 원본의 최종 파생치 범위인 `1..1000`으로 제한한다.

## 의도적으로 분리한 규칙

- `baseMatchupBias`는 원본 맵의 T/Z·Z/P·P/T 필드가 아니다. 따라서 맵
  계수로 복원하지 않고 독립된 전역 상성 배수로만 사용한다.
- `mapDurationOffset`은 x64 서사용 경기시간 휴리스틱이다. 원본에서 확인된
  직접 시간 공식으로 취급하지 않는다.

## 재현 범위의 한계

원본은 위 계수를 매 논리 tick의 난수 폭에 적용하고, 종족별 AI와 5개 action
슬롯을 수천 tick 진행한다. 현재 x64판은 확인된 수식을 결정적 능력치 proxy로
투영한 뒤 기존 MVP/ADVANCED 확률 엔진에 넣는다. 따라서 이는 원본 수식의
재사용 가능한 결정적 재구축이지, 난수 호출 순서와 action 상태 전이까지 같은
cycle-accurate 포팅이 아니다.

정적 회귀는 다음 명령으로 확인한다.

```powershell
cmd /c npm run check:model64-sim
```
