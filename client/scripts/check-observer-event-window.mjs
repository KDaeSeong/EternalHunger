import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { buildTeamObserverModel, buildTeamObserverEventWindow } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { captureMovementObjective } = await import('../src/app/simulation/_lib/movementObjectiveRuntime.js');
assert.equal(typeof buildTeamObserverEventWindow, 'function', 'product event-window API must exist before these regressions run');

let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };
const actor = (id, teamId = 'team:1', extra = {}) => ({ _id: id, name: id, teamId, hp: 100, maxHp: 100,
  zoneId: 'a', inventory: [], ...extra });
const event = (kind, sec, payload = {}) => ({ kind, at: sec === undefined ? {} : { sec }, ...payload });
const names = { a: '가공장', b: '학교' };
const zoneName = (id) => names[id] || String(id);
const survivors = [actor('a'), actor('b', 'team:2')];
const checkedModel = ({ events, ...options }) => {
  const input = { survivors, teamId: 'team:1', zoneName, events, ...options };
  const expected = buildTeamObserverModel(input);
  const window = buildTeamObserverEventWindow(events, new Set(expected.trackedActorIds));
  assert.strictEqual(window.eventsRef, events);
  assert.ok(Object.isFrozen(window.rows));
  assert.ok(window.rows.every(Object.isFrozen));
  const indexed = buildTeamObserverModel({ ...input, eventWindow: window });
  assert.deepEqual(indexed, expected);
  return { expected, window, input };
};

check('window rows cover scalar, array, nested team and rift-only member links once', () => {
  const events = [
    event('team_engagement', 1, { who: 'a', a: 1, b: 'a', by: 'b', targetId: 'b', target: 'x', victimId: 'a',
      chaserId: 'x', sourceActorId: 'a', opponentId: 'b', strikerId: 'a', previousOwnerId: 'b', continuedBy: 'a',
      assistIds: ['a', 'x'], participants: ['b', 'a'], helpers: ['b'], teams: [['x', 'a'], ['b']] }),
    event('dimension_rift_reward_closed', 2, { memberIds: ['a', 'b'] }),
    event('ordinary_event', 3, { memberIds: ['a'] }),
    event('ordinary_event', 4, { who: 'x' }),
  ];
  const { window } = checkedModel({ events });
  assert.deepEqual(window.rows.map((row) => row.index), [0, 1]);
  assert.deepEqual(window.rows.map((row) => row.sec), [1, 2]);
});

check('invalid and future times are indexed by validity, then filtered per horizon with stable ties', () => {
  const events = [event('craft', 10, { who: 'a', itemName: '끝 시각' }),
    event('death', 4, { who: 'a', cause: 'combat' }), event('revive', 4, { who: 'a', hp: 60 }),
    event('craft', -1, { who: 'a' }), event('craft', Infinity, { who: 'a' }), event('craft', NaN, { who: 'a' }),
    event('craft', null, { who: 'a' }), event('craft', undefined, { who: 'a' }),
    event('craft', '6', { who: 'a', itemName: '숫자 문자열' }), event('craft', 11, { who: 'a', itemName: '미래' })];
  const full = checkedModel({ events, matchSec: 10 });
  assert.deepEqual(full.window.rows.map((row) => row.index), [0, 1, 2, 8, 9]);
  assert.deepEqual(full.window.rows.map((row) => row.sec), [10, 4, 4, 6, 11]);
  assert.deepEqual(full.expected.recent.map((row) => row.kind), ['craft', 'craft', 'revive', 'death']);
  for (const matchSec of [10, 3, 10, 0]) checkedModel({ events, matchSec });
});

check('replacement, truncation and cross-match source mismatches fall back without stale rows', () => {
  const first = [event('death', 1, { who: 'a', cause: 'combat' })];
  const firstWindow = buildTeamObserverEventWindow(first, new Set(['a']));
  const replacement = [event('craft', 2, { who: 'a', itemName: '새 창' })];
  const replacementExpected = buildTeamObserverModel({ survivors, teamId: 'team:1', events: replacement, matchSec: 5 });
  const replacementActual = buildTeamObserverModel({ survivors, teamId: 'team:1', events: replacement, matchSec: 5, eventWindow: firstWindow });
  assert.deepEqual(replacementActual, replacementExpected);
  assert.deepEqual(replacementActual.recent.map((row) => row.kind), ['craft']);

  const extended = [...first, event('craft', 3, { who: 'a', itemName: '추가 기록' })];
  const extendedExpected = buildTeamObserverModel({ survivors, teamId: 'team:1', events: extended, matchSec: 5 });
  assert.deepEqual(buildTeamObserverModel({ survivors, teamId: 'team:1', events: extended, matchSec: 5, eventWindow: firstWindow }), extendedExpected);

  const wrongMembers = buildTeamObserverEventWindow(replacement, new Set(['outsider']));
  assert.deepEqual(buildTeamObserverModel({ survivors, teamId: 'team:1', events: replacement, matchSec: 5, eventWindow: wrongMembers }), replacementExpected);
});

check('default stateless path and a rebuilt index both observe same-array edits without mutating source', () => {
  const events = [event('team_decision', 1, { who: 'a', reason: 'team_regroup', moved: false, targetZoneId: 'a' })];
  const initial = checkedModel({ events, matchSec: 10 });
  events[0].at.sec = 2;
  events[0].targetZoneId = 'b';
  events.push(event('growth_plan', 3, { who: 'a', targetName: '새 목표', reason: 'growth_farm' }));
  const stateless = buildTeamObserverModel({ survivors, teamId: 'team:1', events, matchSec: 10, zoneName });
  const rebuilt = buildTeamObserverModel({ survivors, teamId: 'team:1', events, matchSec: 10, zoneName,
    eventWindow: buildTeamObserverEventWindow(events, new Set(['a'])) });
  assert.notDeepEqual(initial.expected, stateless);
  assert.deepEqual(rebuilt, stateless);
  assert.equal(events[0].at.sec, 2);
  assert.equal(events[0].targetZoneId, 'b');
});

check('procurement choice and settlement refresh after a same-source edit and index rebuild', () => {
  const events = [event('queue', 1, { who: 'a', chosen: 'kioskBuy', actionKey: 'purchase:1', itemId: 'ore', itemName: '광석' }),
    event('procurement', 2, { who: 'a', receiptVersion: 1, actionKey: 'purchase:1', actionType: 'kioskBuy',
      itemId: 'ore', itemName: '광석', outcome: 'completed', paidCost: 12, gainedCredits: 0,
      beforeCredits: 30, afterCredits: 18, receivedQty: 1, qty: 1 })];
  const originalWindow = buildTeamObserverEventWindow(events, new Set(['a']));
  const input = { survivors, teamId: 'team:1', events, eventWindow: originalWindow, matchSec: 5, zoneName };
  const before = buildTeamObserverModel(input).members[0].procurement;
  assert.equal(before.outcome, 'completed');
  assert.equal(before.matchedChoice, true);
  assert.match(before.result, /-12Cr/);
  events[1].paidCost = 20;
  events[1].afterCredits = 10;
  const rebuiltWindow = buildTeamObserverEventWindow(events, new Set(['a']));
  const fresh = buildTeamObserverModel({ ...input, eventWindow: rebuiltWindow }).members[0].procurement;
  assert.equal(fresh.outcome, 'completed');
  assert.match(fresh.result, /-20Cr/);
  assert.equal(fresh.matchedChoice, true);
});

check('repeated indexed queries do not leak previous-decision wrappers across calls', () => {
  const events = [event('team_decision', 1, { who: 'a', reason: 'team_regroup', moved: false, targetZoneId: 'a' }),
    event('team_decision', 2, { who: 'a', reason: 'team_regroup', moved: false, targetZoneId: 'a' }),
    event('craft', 3, { who: 'a', itemName: '중간 사건' }),
    event('team_decision', 4, { who: 'a', reason: 'team_regroup', moved: false, targetZoneId: 'b' })];
  const window = buildTeamObserverEventWindow(events, new Set(['a']));
  const input = { survivors, teamId: 'team:1', events, eventWindow: window, matchSec: 10, zoneName };
  const before = structuredClone(events);
  const first = buildTeamObserverModel(input);
  for (let i = 0; i < 4; i++) assert.deepEqual(buildTeamObserverModel(input), first);
  assert.deepEqual(events, before);
  assert.ok(window.rows.every(Object.isFrozen));
});

check('live actor labels, health, equipment and goal-source availability remain fresh with the same event window', () => {
  const spawnState = { coreNodes: [{ id: 'fresh-tree', kind: 'life_tree', zoneId: 'b', picked: false }] };
  const goal = captureMovementObjective({ objectiveType: 'natural_core', objectiveSubkind: 'life_tree' }, 'b', { spawnState });
  const liveActor = actor('a', 'team:1', { _movementObjective: { ...goal, atSec: 1 },
    inventory: [{ itemId: 'old-weapon', name: '기존 무기', type: 'equipment', equipSlot: 'weapon', tier: 1 }],
    equipped: { weapon: 'old-weapon' } });
  const events = [event('growth_plan', 1, { who: 'a', targetName: '새 장비', reason: 'growth_farm' })];
  const window = buildTeamObserverEventWindow(events, new Set(['a']));
  const input = { survivors: [liveActor], teamId: 'team:1', events, eventWindow: window, matchSec: 2,
    spawnState, zoneName };
  const first = buildTeamObserverModel(input);
  assert.equal(first.objectives.length, 1);
  assert.equal(first.members[0].name, 'a');
  assert.match(first.members[0].equipment, /기존 무기/);
  liveActor.name = '최신 이름'; liveActor.hp = 37; liveActor.maxHp = 120;
  liveActor.inventory = [{ itemId: 'new-weapon', name: '현재 무기', type: 'equipment', equipSlot: 'weapon', tier: 3 }];
  liveActor.equipped = { weapon: 'new-weapon' };
  const fresh = buildTeamObserverModel(input);
  assert.equal(fresh.members[0].name, '최신 이름');
  assert.equal(fresh.members[0].hp, 37);
  assert.equal(fresh.members[0].maxHp, 120);
  assert.match(fresh.members[0].equipment, /현재 무기/);
  spawnState.coreNodes[0].picked = true;
  const unavailable = buildTeamObserverModel(input);
  assert.equal(unavailable.objectives.length, 0);
});

console.log(`OBSERVER_EVENT_WINDOW ${checks}/${checks}`);
