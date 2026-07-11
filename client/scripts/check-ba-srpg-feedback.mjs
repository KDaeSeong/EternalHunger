import assert from 'node:assert/strict';
import {
  baSrpgFeedbackCue,
  baSrpgFeedbackPresentation,
  createBaSrpgFeedbackSnapshot,
} from '../src/app/games/ba-srpg/_lib/baSrpgFeedback.js';
import {
  createNewState,
  getBattleForecast,
} from '../src/app/games/ba-srpg/_lib/baSrpgEngine.js';

function state(overrides = {}) {
  return {
    runId: 'run-a',
    battleWins: 0,
    battle: {
      missionId: 'm001',
      phase: 'player',
      turn: 1,
      lastResult: '',
      units: [{ id: 'ally-a', hp: 30 }, { id: 'ally-b', hp: 25 }],
      enemies: [{ id: 'enemy-a', hp: 20 }, { id: 'enemy-b', hp: 20 }],
      ...overrides.battle,
    },
    ...overrides,
  };
}

const base = createBaSrpgFeedbackSnapshot(state());
assert.equal(base.aliveAllies, 2, '생존 아군 수를 계산해야 합니다.');
assert.equal(base.aliveEnemies, 2, '생존 적 수를 계산해야 합니다.');
assert.equal(baSrpgFeedbackCue(null, base), '', '첫 렌더에서는 결과음을 재생하면 안 됩니다.');
assert.equal(baSrpgFeedbackCue(base, { ...base }), '', '선택만 바뀐 상태는 결과음을 재생하면 안 됩니다.');

assert.equal(
  baSrpgFeedbackCue(base, { ...base, missionId: 'm002' }),
  'deploy',
  '새 미션 출정은 배치 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, aliveEnemies: 1, lastResult: '노아 -> 드론 12 피해 격파' }),
  'elimination',
  '적 생존 수 감소는 격파 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, aliveAllies: 1, lastResult: '저격수 -> 유우카 20 피해' }),
  'unitDown',
  '아군 생존 수 감소는 전투불능 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, phase: 'cleared', aliveEnemies: 0, lastResult: '승리' }),
  'victory',
  '클리어는 격파음보다 승리음을 우선해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, phase: 'failed', aliveAllies: 0, lastResult: '패배' }),
  'defeat',
  '전멸은 전투불능음보다 패배음을 우선해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '미카 공격 빗나감' }),
  'attackMiss',
  '빗나감은 전용 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '호시노 보호막 +18' }),
  'guard',
  '보호막은 방어 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '세리나 HP +16' }),
  'consume',
  '회복은 회복 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, lastResult: '노아 -> 드론 12 피해' }),
  'combat',
  '피해 발생은 교전 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, turn: 2 }),
  'turn',
  '다른 사건이 없는 턴 증가는 턴 효과음을 사용해야 합니다.',
);
assert.equal(
  baSrpgFeedbackCue(base, { ...base, runId: 'run-b', phase: 'cleared' }),
  '',
  '새 런을 불러올 때 이전 런과 비교해 결과음을 내면 안 됩니다.',
);

const clearPresentation = baSrpgFeedbackPresentation({ ...base, phase: 'cleared', lastResult: '승리' });
assert.deepEqual(
  { action: clearPresentation.action, label: clearPresentation.label, tone: clearPresentation.tone },
  { action: 'victory', label: '임무 클리어', tone: 'success' },
  '클리어 신호는 승리 아이콘과 성공 톤을 사용해야 합니다.',
);
const missPresentation = baSrpgFeedbackPresentation({ ...base, lastResult: '미카 공격 빗나감' });
assert.equal(missPresentation.action, 'miss', '빗나감 신호는 전용 아이콘을 사용해야 합니다.');

const initialForecast = getBattleForecast(createNewState({ runId: 'feedback-check' }));
assert.ok(initialForecast.actionRows.length > 0, '초기 전술 HUD에 행동 후보가 있어야 합니다.');
assert.ok(
  initialForecast.actionRows.every((row) => Number.isFinite(row.score)),
  '사거리 밖 행동을 포함한 모든 전술 HUD 점수는 유한값이어야 합니다.',
);

console.log('BA SRPG feedback checks passed.');
