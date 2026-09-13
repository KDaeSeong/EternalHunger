import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { buildTeamObserverModel, describeObserverReason, describeObserverEvent, observerEventActorIds, getObserverVisibleActors } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { getActorGrowthProgress, buildActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getEquipSummary } = await import('../src/app/simulation/_lib/survivorRuntime.js');
const { formatClock } = await import('../src/app/simulation/_lib/simulationFormattingRuntime.js');
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };
const actor = (id, team = 'team:1', extra = {}) => ({ _id: id, name: id, teamId: team, hp: 100, maxHp: 100, zoneId: 'a', inventory: [], ...extra });
const event = (kind, sec, payload = {}) => ({ kind, at: { sec, day: 1, phase: 'morning' }, ...payload });
const zoneName = (id) => ({ a: '공장', b: '학교' })[id] || id;
const freeze = (value) => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

check('fractional display times are padded and rounded without changing event ordering or timestamps', () => {
  for (const [seconds, text] of [[0, '00:00'], [0.005, '00:00.01'], [59.999, '01:00'], [845.916666, '14:05.92'],
    [1204.5, '20:04.5'], [1572.833333, '26:12.83'], [NaN, '00:00'], [Infinity, '00:00']]) assert.equal(formatClock(seconds), text);
  const events = [event('move', 1.001, { who: 'a', from: 'a', to: 'b' }), event('death', 1.002, { who: 'a', by: 'b', reason: 'combat' })];
  const before = structuredClone(events);
  const model = buildTeamObserverModel({ survivors: [actor('a')], matchSec: 1.001, events });
  assert.equal(model.recent.length, 1); assert.equal(model.recent[0].sec, 1.001);
  assert.deepEqual(events, before);
});

check('result and replay history displays use the same fractional clock formatter', () => {
  const component = (name) => readFileSync(new URL(`../src/app/simulation/_components/${name}.js`, import.meta.url), 'utf8');
  const result = component('SimulationResultModal');
  const history = component('SimulationReplayHistory');
  for (const source of [result, history]) {
    assert.match(source, /import \{ formatClock \} from ['"]\.\.\/_lib\/simulationFormattingRuntime['"]/);
    assert.doesNotMatch(source, /% 60/);
  }
  assert.match(result, /formatClock\(ending\.atSec\)/);
  assert.match(history, /formatClock\(run\.summary\?\.ending\?\.atSec\)/);
});

check('team selection includes dead teams, follows exact IDs and never loses a revived member', () => {
  const model = buildTeamObserverModel({ survivors: [actor('a'), actor('b', 'team:2', { name: '동명이인' })],
    dead: [actor('a', 'team:1', { hp: 0 }), actor('c', 'team:3', { hp: 0, name: '동명이인' })], teamId: 'team:3', matchSec: 12,
    events: [event('move', 5, { who: 'b', from: 'a', to: 'b' }), event('death', 9, { who: 'c', by: 'a', reason: 'combat' })] });
  assert.equal(model.teams[0].alive, 1);
  assert.equal(model.members.length, 1);
  assert.equal(model.members[0].id, 'c');
  assert.match(model.status, /부활 가능 여부/);
  assert.equal(model.recent.length, 1);
  assert.match(model.recent[0].text, /동명이인 사망/);
});

check('opponents, victims, helpers and actual engagement participants link events to the watched team', () => {
  const ids = observerEventActorIds({ who: 'a', a: 'b', b: 'c', by: 'd', targetId: 'e', victimId: 'f', chaserId: 'g',
    helpers: ['h'], assistIds: ['i'], participants: ['a', 'j'], teams: [['k'], ['l']] });
  assert.deepEqual(ids.sort(), 'abcdefghijkl'.split(''));
  const model = buildTeamObserverModel({ survivors: [actor('a'), actor('b', 'team:2')], teamId: 'team:1', matchSec: 10,
    events: [event('team_strike', 3, { who: 'b', targetId: 'a', damage: 12 }), event('team_cover', 4, { who: 'b', helpers: ['a'] })] });
  assert.equal(model.recent.length, 2);
  assert.match(model.recent[1].text, /HP 감소 12/);
});

check('future and un-timed events are hidden and same-second event order is preserved', () => {
  const model = buildTeamObserverModel({ survivors: [actor('a')], matchSec: 10, events: [
    event('craft', 10, { who: 'a', itemName: '완성품' }), event('death', 10, { who: 'a', cause: '출혈' }),
    event('revive', 11, { who: 'a', hp: 50 }), { kind: 'move', who: 'a' }, null,
  ] });
  assert.deepEqual(model.recent.map((row) => row.kind), ['death', 'craft']);
  assert.ok(model.recent.every((row) => row.sec <= 10));
});

check('planning is timestamped and action selection is not declared a success', () => {
  const model = buildTeamObserverModel({ survivors: [actor('a')], matchSec: 40, events: [event('queue', 20, { who: 'a', chosen: 'craft', blockedReasons: ['craft:missing_ing'] })] });
  assert.equal(model.members[0].decision.clock, '00:20');
  assert.match(model.members[0].decision.text, /제작 선택/);
  assert.match(model.members[0].decision.text, /재료 부족/);
  assert.doesNotMatch(model.members[0].decision.text, /제작 완료/);
  assert.equal(model.recent.length, 0);
});

check('low-HP rest is explained as waiting rather than a successful hunt or free heal', () => {
  const queueText = describeObserverEvent(event('queue', 20, {
    who: 'a', chosen: 'rest', reason: 'low_hp_recovery', blockedReasons: ['recovering'],
  }));
  assert.match(queueText, /휴식 선택 · 저체력으로 안전 대기/);
  assert.doesNotMatch(queueText, /사냥|회복 완료/);
  const model = buildTeamObserverModel({ survivors: [actor('a', 'team:1', { hp: 20 })], teamId: 'team:1', matchSec: 21,
    events: [event('rest', 21, { who: 'a', hp: 20, maxHp: 100, zoneId: 'a' })], zoneName });
  assert.match(model.recent[0].text, /안전 대기 · HP 20\/100/);
});

check('repeated decisions are condensed but changed destinations and goals remain visible', () => {
  const model = buildTeamObserverModel({ survivors: [actor('a')], matchSec: 60, events: [
    event('team_decision', 0, { who: 'a', reason: 'team_regroup', moved: false, targetZoneId: 'a' }),
    event('team_decision', 20, { who: 'a', reason: 'team_regroup', moved: false, targetZoneId: 'a' }),
    event('team_decision', 40, { who: 'a', reason: 'team_regroup', moved: true, targetZoneId: 'b' }),
  ], zoneName });
  assert.equal(model.recent.length, 2);
  assert.match(model.recent[0].text, /학교/);
  assert.match(model.recent[1].text, /합류 대기/);
});

check('the recorded local power assessment is explained without inventing a new decision', () => {
  const text = describeObserverReason({ reason: 'flee:team_outnumbered', teamAssessment: { allyCount: 1, enemyCount: 3 } });
  assert.match(text, /당시 현장 아군 1명 \/ 적군 3명/);
  assert.match(text, /후퇴/);
  assert.equal(describeObserverReason({ reason: 'unknown_future_rule' }), '상세 판단 기록 없음');
  assert.match(describeObserverReason({ blocked: 'no_material_source' }), /공급처 없음/);
  assert.equal(describeObserverReason({ reason: 'low_hp' }), '체력이 낮아 후퇴');
  assert.equal(describeObserverReason({ reason: 'forbidden' }), '금지구역에서 이탈');
  assert.equal(describeObserverReason({ reason: 'power_gap' }), '전력 열세로 후퇴');
  const interrupted = describeObserverReason({ reason: 'low_hp', blocked: 'no_material_source' });
  assert.match(interrupted, /체력이 낮아 후퇴/);
  assert.match(interrupted, /공급처 없음/);
});

check('growth progress reads current inventory, not the earlier plan or a fabricated guarantee', () => {
  const items = [{ _id: 'sword', name: '목표 검', type: 'equipment', equipSlot: 'weapon', tier: 3 }];
  const ready = actor('a', 'team:1', { routePlanTargetItemIds: ['sword'], inventory: [{ itemId: 'sword', qty: 1 }], _growthPlan: { completedSlots: 0, totalSlots: 1 } });
  assert.equal(getActorGrowthProgress(ready, items).completedSlots, 1);
  assert.equal(buildTeamObserverModel({ survivors: [ready], publicItems: items }).members[0].progress, '1/1');
  assert.equal(getActorGrowthProgress(actor('b'), items).totalSlots, 0);
  assert.equal(buildActorGrowthPlan(actor('b'), items, {}), null);
});

check('observation and equipment text do not mutate frozen actors or consume randomness', () => {
  const input = freeze({ survivors: [actor('a'), actor('b', 'team:2')], dead: [],
    events: [event('move', 2, { who: 'a', from: 'a', to: 'b', reason: 'growth_farm' })], matchSec: 3 });
  const before = JSON.stringify(input); const originalRandom = Math.random;
  Math.random = () => { throw new Error('Observation must never draw game randomness.'); };
  try {
    for (let i = 0; i < 5; i++) buildTeamObserverModel({ ...input, teamId: i % 2 ? 'team:1' : 'team:2' });
    getEquipSummary(input.survivors[0]);
  } finally { Math.random = originalRandom; }
  assert.equal(JSON.stringify(input), before);
});

check('tracked actors remain on crowded maps without removing unrelated actors from the match', () => {
  const roster = Array.from({ length: 24 }, (_, index) => actor(`a${index}`));
  const visible = getObserverVisibleActors(roster, ['a20', 'a21', 'a22']);
  assert.deepEqual(visible.slice(0, 3).map((row) => row._id), ['a20', 'a21', 'a22']);
  assert.equal(visible.length, 12); assert.equal(roster.length, 24); assert.equal(roster[0]._id, 'a0');
});

check('results retain death reasons and use real kill and assist totals without inferring a winner early', () => {
  const args = { survivors: [actor('a')], dead: [actor('b', 'team:1', { hp: 0, _deathCauseName: '출혈', _deathKillerId: 'c' }), actor('c', 'team:2', { hp: 0 })],
    killCounts: { a: 2, b: 1 }, assistCounts: { a: 1, b: 2 }, isGameOver: true };
  const model = buildTeamObserverModel(args);
  assert.equal(model.status, '최후 생존 팀');
  assert.equal(model.summary, '생존 1/2 · 3처치 · 3어시스트');
  assert.match(model.members[1].death, /출혈 · 처치자 c/);
  assert.notEqual(buildTeamObserverModel({ ...args, isGameOver: false }).status, '최후 생존 팀');
  assert.equal(buildTeamObserverModel().team, null);
});

check('revival, focus fire and paid cover explanations match event outcomes', () => {
  assert.match(describeObserverEvent(event('revive', 20, { who: 'a', by: 'b', hp: 65, paid: true, cost: 200 })), /HP 65 · 도움 b · 200Cr 소비/);
  assert.match(describeObserverEvent(event('team_strike', 20, { who: 'a', targetId: 'b', damage: 4, reason: 'focus_fire' })), /집중 공격 · HP 감소 4/);
  assert.match(describeObserverEvent(event('team_cover', 20, { who: 'a', helpers: ['b'] })), /행동 시간 소비/);
});
check('a revived actor cannot present a previous-life decision as its latest plan', () => {
  const events = [event('queue', 10, { who: 'a', chosen: 'craft' }), event('death', 15, { who: 'a' }), event('revive', 20, { who: 'a', hp: 65 })];
  const input = { survivors: [actor('a')], events, matchSec: 20 };
  assert.equal(buildTeamObserverModel(input).members[0].decision, null);
  events.push(event('queue', 20, { who: 'a', chosen: 'hunt' }));
  assert.match(buildTeamObserverModel(input).members[0].decision.text, /사냥 선택/);
});
check('team objectives cannot claim movement or arrival without a recorded move', () => {
  const queued = describeObserverEvent(event('queue', 20, { who: 'a', chosen: 'craft', reason: 'team_regroup' }));
  assert.match(queued, /제작 선택 · 팀 합류 목표/);
  assert.doesNotMatch(queued, /합류 이동|도착/);
  assert.match(describeObserverEvent(event('team_decision', 20, { who: 'a', reason: 'team_regroup', moved: false })), /합류 대기/);
  assert.match(describeObserverEvent(event('move', 20, { who: 'a', reason: 'team_regroup', from: 'a', to: 'b' })), /합류 이동/);
  assert.equal(describeObserverReason({ reason: 'team_rotate', moved: false }), '팀 공동 목표 지역 유지');
});
check('timed wildlife combat exposes the live target and explains start, exchanges and outcome', () => {
  const hunter = actor('a', 'team:1', { _spatial: { zoneId: 'a', x: 4, y: 4 },
    stats: { maxHp: 100, attackPower: 20, defense: 0, attackSpeed: 1, moveSpeed: 3, attackRange: 1.5, sightRange: 10 },
    _wildlifeHunt: { id: 'hunt:a', kind: 'bear', zoneId: 'a', damageDealt: 55, damageTaken: 12, lastActionAtSec: 4,
      target: { _id: 'wildlife:hunt:a', name: '🐻 곰', teamId: 'wildlife:hunt:a', zoneId: 'a', hp: 45, maxHp: 100,
        stats: { maxHp: 100, attackPower: 20, defense: 0, attackSpeed: 0.5, moveSpeed: 2, attackRange: 1.5, sightRange: 10 },
        activeEffects: [], inventory: [], _spatial: { zoneId: 'a', x: 5, y: 4 } } } });
  const events = [
    event('hunt_start', 1, { who: 'a', wildlifeName: '🐻 곰', wildlifeHp: 100, wildlifeMaxHp: 100, distance: 3.5, zoneId: 'a' }),
    event('hunt_exchange', 2, { who: 'a', strikerId: 'a', wildlifeName: '🐻 곰', damageDealt: 20, wildlifeHp: 80, zoneId: 'a' }),
    event('hunt_exchange', 3, { who: 'a', strikerId: 'wildlife:hunt:a', wildlifeName: '🐻 곰', damageTaken: 12, hunterHp: 88, zoneId: 'a' }),
    event('hunt_end', 4, { who: 'a', wildlifeName: '🐻 곰', outcome: 'victory', damageDealt: 100, damageTaken: 12, zoneId: 'a' }),
  ];
  const model = buildTeamObserverModel({ survivors: [hunter], events, matchSec: 4, zoneName });
  assert.match(model.members[0].hunt, /곰 사냥 중 · 대상 HP 45\/100/);
  assert.match(model.recent.find((row) => row.kind === 'hunt_start').text, /사냥 개시/);
  assert.ok(model.recent.filter((row) => row.kind === 'hunt_exchange').some((row) => /실제 피해 20/.test(row.text)));
  assert.match(model.recent.find((row) => row.kind === 'hunt_end').text, /사냥 완료/);
  const panel = readFileSync(new URL('../src/app/simulation/_components/SimulationTeamObserverPanel.js', import.meta.url), 'utf8');
  assert.match(panel, /actor\.hunt/);
});
console.log(`TEAM_OBSERVER_CHECKS ${checks}/${checks}`);
