import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { buildPhaseHighlights } = await import('../src/app/simulation/_lib/phaseHighlightsRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

let checks = 0;
const check = (name, run) => { run(); checks++; console.log('PASS ' + name); };
const actors = [{ _id: 'a', name: '야전 의사', teamId: 'team:1', hp: 80, maxHp: 100, inventory: [], equipped: {} },
  { _id: 'b', name: '동행자', teamId: 'team:1', hp: 60, maxHp: 100, inventory: [], equipped: {} },
  { _id: 'c', name: '다른 팀', teamId: 'team:2', hp: 100, maxHp: 100, inventory: [], equipped: {} }];
const stamp = (kind, sec, payload = {}, at = {}) => ({ kind, at: { day: 2, phase: 'morning', sec, ...at }, ...payload });
const rows = [stamp('craft', 10, { who: 'a', itemName: '새 모자', tier: 4, qty: 1 }),
  stamp('heal', 11, { who: 'a', heal: 7, name: '휴식 회복' }),
  stamp('retreat', 12, { who: 'b', reason: 'flee:low_hp', zoneId: '숲' })];
const model = buildTeamObserverModel({ survivors: actors, events: rows, teamId: 'team:1', matchSec: 20, day: 2, phase: 'morning' });
const base = { survivors: actors, events: rows, model, day: 2, phase: 'morning', matchSec: 20 };

check('the current phase explains actual crafting, healing and retreat decisions in three rows', () => {
  const highlighted = buildPhaseHighlights(base);
  assert.equal(highlighted.length, 3);
  assert.ok(highlighted.some(row => /새 모자.*제작/.test(row.text)));
  assert.ok(highlighted.some(row => /실제 회복 HP \+7/.test(row.text)));
  assert.ok(highlighted.some(row => /체력이 낮아 후퇴/.test(row.text)));
});

check('past, future and other-team events never leak into the selected phase summary', () => {
  const excluded = [stamp('death', 10, { who: 'c' }), stamp('death', 10, { who: 'a' }, { day: 1 }),
    stamp('death', 10, { who: 'a' }, { phase: 'night' }), stamp('death', 21, { who: 'a' }),
    { kind: 'death', who: 'a', at: { day: 2, phase: 'morning', sec: null } }];
  assert.deepEqual(buildPhaseHighlights({ ...base, events: [...rows, ...excluded] }), buildPhaseHighlights(base));
});

check('frequent heal receipts cannot crowd out survival, retreat and equipment news', () => {
  const events = [...rows, ...Array.from({ length: 50 }, (_, index) => stamp('heal', 13 + index / 100, { who: 'a', heal: 1 })),
    stamp('death', 15, { who: 'b', cause: '전투' })];
  const highlights = buildPhaseHighlights({ ...base, events });
  assert.equal(highlights.length, 3); assert.ok(highlights.some(row => row.label === '탈락'));
  assert.equal(highlights.filter(row => row.group === 'healing').length, 1);
});

check('team elimination and revival are explained even when a receipt only carries team membership', () => {
  const events = [stamp('team_status', 14, { teamId: 'team:1', teamName: '우리 팀', status: 'eliminated', aliveCount: 0, protectedCount: 0, participants: [] }),
    stamp('revive', 16, { who: 'a', hp: 50 })];
  const highlighted = buildPhaseHighlights({ ...base, events });
  assert.equal(highlighted[0].label, '부활'); assert.match(highlighted[0].text, /HP 50/);
  assert.match(buildPhaseHighlights({ ...base, events: events.slice(0, 1) })[0].text, /최종 탈락/);
});

check('current goals are explicitly separated from completed acquisitions and low HP is factual', () => {
  const current = { ...model, members: [{ id: 'a', name: '의사', alive: true, hp: 25, maxHp: 100,
    growth: { label: '전설 모자 재료 수집', status: 'growing', materials: '천 1개 부족' } }],
    objectives: [{ label: '생명의 나무', zone: '숲' }] };
  const highlights = buildPhaseHighlights({ ...base, model: current, events: [] });
  assert.equal(highlights.length, 3); assert.match(highlights[0].text, /HP 35% 이하/);
  assert.match(highlights[1].text, /천 1개 부족/); assert.match(highlights[2].text, /아직 획득 전/);
});

check('observing highlights changes neither actor state, event receipts, model nor RNG', () => {
  const before = structuredClone(base);
  withSimulationRandom(() => { throw new Error('observer cannot draw randomness'); }, () => buildPhaseHighlights(base));
  assert.deepEqual(base, before);
  assert.deepEqual(buildPhaseHighlights({ ...base, events: [] }), []);
});
console.log('Phase highlight checks passed: ' + checks);
