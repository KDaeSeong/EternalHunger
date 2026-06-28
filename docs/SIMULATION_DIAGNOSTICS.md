# Simulation Diagnostics

## 고정 seed 운영안

회귀 테스트용 기본 seed는 다음 10개를 사용합니다.

```text
1101, 1102, 1103, 1104, 1105, 2101, 2102, 2103, 3101, 4101
```

권장 절차:

1. 개발자 도구에서 seed를 적용합니다.
2. 같은 캐릭터 프리셋과 같은 룰셋으로 게임을 끝까지 진행합니다.
3. `로그 JSON`으로 내보냅니다.
4. 아래 명령으로 결과를 분석합니다.

```bash
cmd /c npm run diagnose:simulation -- --file path/to/export.json
```

여러 파일을 비교할 때:

```bash
cmd /c npm run diagnose:simulation -- --dir path/to/exports
```

## 우선 확인할 수치

- `earlyDeaths`: 1일차~2일차 낮 사망 수
- `midDeaths`: 2일차 밤~5일차 밤 사망 수
- `endDeaths`: 6일차 이후 사망 수
- `pvpDeathRate`: 전체 사망 중 전투 사망 비율
- `escapePressure`: 추격/도주 이벤트 중 붙잡힘 비율
- `heroGearReadyCount`: 영웅 이상 장비 5부위 이상 보유 캐릭터 수
- `legendaryReadyCount`: 전설 이상 장비 3부위 이상 보유 캐릭터 수

## 해석 기준

- 중반 사망이 너무 낮으면 `pvp.midgameEncounterBonus`, `pvp.midgameLowHpEncounterMult`, `ai.fightAvoidChance`를 조정합니다.
- 1일차 낮 장비 완성이 낮으면 `drops.fieldCrate.earlyRoute`와 `ai.earlyRouteFarmAttempts`를 먼저 봅니다.
- 서든데스까지 생존자가 과도하게 많으면 `suddenDeath.forceClashMaxRounds`보다 중반 교전 확률을 먼저 조정합니다.

