import assert from 'node:assert/strict';
import {
  createSimulationFeedbackSnapshot,
  getSimulationFeedbackCue,
} from '../src/app/simulation/_lib/simulationFeedbackRuntime.js';

function snapshot(overrides = {}) {
  return createSimulationFeedbackSnapshot({
    autoPlay: false,
    day: 1,
    dead: [],
    forbiddenAddedNow: [],
    isGameOver: false,
    phase: 'morning',
    winner: null,
    ...overrides,
  });
}

const base = snapshot();
assert.equal(getSimulationFeedbackCue(null, base), '', '첫 렌더에서는 효과음을 재생하면 안 됩니다.');
assert.equal(
  getSimulationFeedbackCue(base, snapshot({ phase: 'night' })),
  'phaseNight',
  '수동 밤 전환은 밤 효과음을 사용해야 합니다.',
);
assert.equal(
  getSimulationFeedbackCue(snapshot({ phase: 'night' }), snapshot({ day: 2, phase: 'morning' })),
  'phaseDay',
  '수동 낮 전환은 낮 효과음을 사용해야 합니다.',
);
assert.equal(
  getSimulationFeedbackCue(base, snapshot({ autoPlay: true, phase: 'night' })),
  '',
  '자동 진행 중에는 매 페이즈 효과음을 반복하면 안 됩니다.',
);
assert.equal(
  getSimulationFeedbackCue(base, snapshot({ dead: [{ id: 'actor-b' }] })),
  'elimination',
  '사망자 증가는 처치 효과음을 사용해야 합니다.',
);
assert.equal(
  getSimulationFeedbackCue(snapshot({ dead: [{ id: 'actor-b' }] }), base),
  'revive',
  '사망자 감소는 부활 효과음을 사용해야 합니다.',
);

const forbidden = snapshot({ forbiddenAddedNow: new Set(['hospital', 'school']) });
assert.equal(forbidden.forbiddenSignature, 'hospital|school', '금지구역 서명은 순서와 자료형에 흔들리면 안 됩니다.');
assert.equal(
  getSimulationFeedbackCue(base, forbidden),
  'zoneLock',
  '신규 금지구역은 경고 효과음을 사용해야 합니다.',
);
assert.equal(
  getSimulationFeedbackCue(base, snapshot({ isGameOver: true, winner: { id: 'actor-a' } })),
  'victory',
  '승자가 있는 게임 종료는 승리 효과음을 사용해야 합니다.',
);
assert.equal(
  getSimulationFeedbackCue(base, snapshot({ isGameOver: true })),
  'defeat',
  '전멸 종료는 패배 효과음을 사용해야 합니다.',
);
assert.equal(
  getSimulationFeedbackCue(snapshot({ day: 5, dead: [{ id: 'actor-b' }] }), snapshot({ day: 0 })),
  '',
  '새 게임 초기화는 부활 효과음으로 오인하면 안 됩니다.',
);

console.log('Eternal Hunger feedback checks passed.');
