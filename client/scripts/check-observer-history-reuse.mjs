import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const runtimeURL = new URL('../src/app/simulation/_lib/teamObserverRuntime.js', import.meta.url);
const { buildTeamObserverModel: model, buildTeamObserverEventWindow: windowFor } = await import(runtimeURL.href);
const { captureMovementObjective } = await import('../src/app/simulation/_lib/movementObjectiveRuntime.js');
const actor = (id, teamId = 'team:1', extra = {}) => ({ _id: id, name: id, teamId,
  hp: 100, maxHp: 100, zoneId: 'alpha', inventory: [], ...extra });
const event = (kind, sec, extra = {}) => ({ kind, at: { sec }, ...extra });
const roster = () => [actor('a'), actor('c', 'team:1', { teamSlot: 2 }), actor('b', 'team:2')];
const zoneName = id => ({ alpha: '공장', beta: '학교' })[id] || String(id);
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) {
  Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function pure(run) {
  const restore = [], forbidden = () => { throw Error('Observer query consumed randomness or device storage'); };
  const replace = (owner, key, value) => {
    const previous = Object.getOwnPropertyDescriptor(owner, key);
    Object.defineProperty(owner, key, { configurable: true, writable: true, value });
    restore.push(() => previous ? Object.defineProperty(owner, key, previous) : Reflect.deleteProperty(owner, key));
  };
  replace(Math, 'random', forbidden); replace(crypto, 'randomUUID', forbidden);
  replace(crypto.webcrypto, 'randomUUID', forbidden); replace(crypto.webcrypto, 'getRandomValues', forbidden);
  if (globalThis.crypto && globalThis.crypto !== crypto.webcrypto) {
    replace(globalThis.crypto, 'randomUUID', forbidden); replace(globalThis.crypto, 'getRandomValues', forbidden);
  }
  replace(globalThis, 'localStorage', new Proxy({}, { get: forbidden }));
  try { return run(); } finally { restore.reverse().forEach(fn => fn()); }
}
function references(output, survivors, dead = []) {
  const selected = new Map([...dead, ...survivors].map(row => [String(row._id || row.id), row]));
  if (output.team) assert.equal(output.team, output.teams.find(row => row.id === output.team.id));
  for (const team of output.teams) for (const member of team.members) assert.equal(member, selected.get(String(member._id || member.id)));
}
function compare({ survivors = roster(), dead = [], events = [], teamId = 'team:1', ...options } = {}) {
  const before = structuredClone({ survivors, dead, events });
  freeze(survivors); freeze(dead); freeze(events);
  const input = { survivors, dead, events, teamId, zoneName, ...options };
  const expected = pure(() => model(input));
  const window = pure(() => windowFor(events, expected.trackedActorIds));
  assert.equal(window.eventsRef, events); assert.ok(Object.isFrozen(window)); assert.ok(Object.isFrozen(window.rows));
  assert.deepEqual(Object.keys(window), ['eventsRef', 'memberKey', 'rows']);
  for (const row of window.rows) { assert.ok(Object.isFrozen(row)); assert.equal(row.event, events[row.index]); assert.deepEqual(Object.keys(row), ['event', 'index', 'sec']); }
  const indexed = pure(() => model({ ...input, eventWindow: window }));
  assert.deepEqual(indexed, expected); references(indexed, survivors, dead);
  assert.deepEqual({ survivors, dead, events }, before);
  return { input, expected, indexed, window };
}
const health = { version: 1,
  attacker: { id: 'a', before: { hp: 100, maxHp: 100 }, after: { hp: 100, maxHp: 100 } },
  target: { id: 'b', before: { hp: 100, maxHp: 100 }, after: { hp: 97, maxHp: 100 } } };
const tail = (start = 100) => [
  ...Array.from({ length: 8 }, (_, i) => event('team_engagement', start + i, { participants: ['a', 'b'], zoneId: 'alpha' })),
  ...Array.from({ length: 3 }, (_, i) => event('battle', start + 8 + i, { a: 'a', b: 'b', damage: 3, health, zoneId: 'alpha' })),
];
let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
check('empty and unknown requested teams retain exact current stateless model shape and references', () => {
  compare({ survivors: [], events: [] }); compare({ teamId: 'missing', events: [null] });
  compare({ survivors: [], dead: [actor('a', 'team:1', { hp: 0 })], events: [], matchSec: 0 });
});
check('public indexed rows retain original source order indices finite seconds frozen shape and event references', () => {
  const events = [event('craft', 10, { who: 'a', itemName: '열 시각' }), event('craft', 99, { who: 'a', itemName: '미래' }),
    event('death', 4, { who: 'a' }), event('revive', 4, { who: 'a' }), event('craft', NaN, { who: 'a' }),
    event('craft', Infinity, { who: 'a' }), event('craft', -1, { who: 'a' }), event('craft', null, { who: 'a' }),
    event('craft', undefined, { who: 'a' }), event('craft', '6', { who: 'a', itemName: '문자열 시각' })];
  const result = compare({ events, matchSec: 10 });
  assert.deepEqual(result.window.rows.map(row => row.index), [0, 1, 2, 3, 9]);
  assert.deepEqual(result.window.rows.map(row => row.sec), [10, 99, 4, 4, 6]);
  assert.deepEqual(result.indexed.recent.map(row => row.key), ['10:0', '6:9', '4:3', '4:2']);
});
check('numeric special horizons primitive coercions and rewind preserve whole outputs for the same source window', () => {
  const events = [event('craft', 0, { who: 'a' }), event('death', 5, { who: 'a' }), event('revive', 3, { who: 'a' }), ...tail(8)];
  const { input, window } = compare({ events, matchSec: 40 });
  for (const matchSec of [40, 3, 40, 0, -0, Infinity, -Infinity, NaN, '3', 'bad', null, true, false, undefined]) {
    const expected = pure(() => model({ ...input, matchSec }));
    assert.deepEqual(pure(() => model({ ...input, matchSec, eventWindow: window })), expected);
  }
});
check('all scalar array nested-team and rift member links are indexed once while unrelated memberIds stay excluded', () => {
  const scalar = ['who', 'a', 'b', 'by', 'targetId', 'target', 'victimId', 'chaserId', 'sourceActorId', 'opponentId', 'strikerId', 'previousOwnerId', 'continuedBy'];
  const events = scalar.map((key, i) => event('craft', i, { [key]: 'a', itemName: key }));
  events.push(...['assistIds', 'participants', 'helpers'].map((key, i) => event('team_engagement', 20 + i, { [key]: ['a', 'a'] })),
    event('team_engagement', 30, { teams: [['x'], ['a', 'a']] }), event('dimension_rift_reward_closed', 31, { memberIds: ['a'] }),
    event('craft', 32, { memberIds: ['a'] }), event('craft', 33, { who: 'outsider' }));
  const result = compare({ events, matchSec: 100 }); assert.equal(result.window.rows.length, scalar.length + 5);
  assert.equal(new Set(result.window.rows.map(row => row.index)).size, result.window.rows.length);
});
check('forged lookalike wrong-array and wrong-members windows safely fall back to current source evidence', () => {
  const events = [event('craft', 1, { who: 'a', itemName: '현재' })], oldEvents = [event('death', 0, { who: 'a' })];
  const { input, expected, window } = compare({ events, matchSec: 10 });
  for (const eventWindow of [{ ...window }, { eventsRef: events, memberKey: window.memberKey, rows: [] },
    windowFor(oldEvents, ['a']), windowFor(events, ['outsider']), windowFor([...events], ['a'])]) {
    assert.deepEqual(pure(() => model({ ...input, eventWindow })), expected);
  }
});
check('same-prefix warm queries skip reading old event kinds while cold queries and changed prefixes refold', () => {
  let reads = 0;
  const oldest = { who: 'a', at: { sec: 1 }, reason: 'team_regroup', moved: false, targetZoneId: 'alpha',
    get kind() { reads++; return 'team_decision'; } };
  const events = [oldest, event('team_decision', 2, { who: 'a', reason: 'team_regroup', moved: false, targetZoneId: 'beta' }), ...tail(10)]; freeze(events);
  const survivors = freeze([actor('a'), actor('b', 'team:2')]), window = windowFor(events, ['a']);
  const input = { survivors, events, teamId: 'team:1', zoneName, eventWindow: window };
  const query = matchSec => { reads = 0; const output = pure(() => model({ ...input, matchSec })); return { output, reads }; };
  const cold = query(30); assert.ok(cold.reads > 0);
  const warm = query(31); assert.equal(warm.reads, 0, 'Same prefix reuses history rather than folding the old decision');
  assert.deepEqual(warm.output, cold.output);
  const seekBack = query(19); assert.ok(seekBack.reads > 0);
  const seekForward = query(30); assert.ok(seekForward.reads > 0);
  assert.deepEqual(seekForward.output, cold.output); assert.equal(query(30).reads, 0);
  for (const row of window.rows) assert.equal(Object.hasOwn(row, 'previousDecision'), false);
  assert.equal(Object.hasOwn(oldest, 'previousDecision'), false);
});
check('nonnumeric horizons preserve each indexed row coercion and invalidate prior numeric warm history', () => {
  let reads = 0, coercions = 0;
  const oldest = { who: 'a', at: { sec: 1 }, get kind() { reads++; return 'craft'; }, itemName: '이전' };
  const events = freeze([oldest, ...tail(10)]), survivors = freeze([actor('a')]), window = windowFor(events, ['a']);
  const input = { survivors, events, eventWindow: window, teamId: 'team:1', zoneName };
  model({ ...input, matchSec: 30 });
  const horizon = Object.freeze({ valueOf() { coercions++; return 30; } });
  const result = pure(() => model({ ...input, matchSec: horizon }));
  assert.equal(coercions, window.rows.length + survivors.length, 'Original row comparisons plus each member ready-time subtraction remain observable');
  assert.deepEqual(result, pure(() => model({ ...input, eventWindow: null, matchSec: 30 })));
  reads = 0; pure(() => model({ ...input, matchSec: 30 })); assert.ok(reads > 0, 'Nonnumeric query invalidates the previous numeric snapshot');
  const irregular = freeze([event('craft', 5, { who: 'a' }), event('craft', 1, { who: 'a' }), event('craft', 3, { who: 'a' })]);
  const changing = () => {
    let count = 0;
    return { horizon: Object.freeze({ [Symbol.toPrimitive]() { return ++count <= 2 ? 2 : 10; } }), count: () => count };
  };
  const rawHorizon = changing(), indexedHorizon = changing(), base = { survivors, events: irregular, teamId: 'team:1', zoneName };
  const expected = pure(() => model({ ...base, matchSec: rawHorizon.horizon }));
  const indexed = pure(() => model({ ...base, matchSec: indexedHorizon.horizon, eventWindow: windowFor(irregular, ['a']) }));
  assert.deepEqual(indexed, expected); assert.deepEqual(indexed.recent.map(row => row.key), ['3:2', '1:1']);
  assert.equal(indexedHorizon.count(), 4); assert.equal(rawHorizon.count(), 4);
});
check('a 5000-event ordinary all-past history retains every source event and bounded visible groups', () => {
  const events = [...Array.from({ length: 4989 }, (_, i) => event('team_decision', i / 10, {
    who: 'a', reason: 'team_regroup', moved: false, targetZoneId: i % 2 ? 'alpha' : 'beta' })), ...tail(600)];
  const result = compare({ events, matchSec: 1000 });
  assert.equal(events.length, 5000); assert.equal(result.window.rows.length, 5000);
  assert.equal(result.indexed.recent.length, 10); assert.equal(result.indexed.turningPoints.length, 8); assert.equal(result.indexed.combat.length, 3);
  assert.equal(result.window.rows[0].event, events[0]); assert.equal(result.window.rows.at(-1).event, events.at(-1));
});
check('whole history decision links revival regroup clearing rift entry and hunt handoff match the stateless path', () => {
  const evidence = { version: 1, status: 'joining', targetZoneId: 'beta', companionsAtTarget: 1, combatSpaceId: 'world', memberCount: 2, distance: 1 };
  const events = [event('team_decision', 1, { who: 'a', reason: 'team_regroup', moved: false, targetZoneId: 'alpha' }),
    event('craft', 2, { who: 'a' }), event('team_decision', 3, { who: 'a', reason: 'team_regroup', moved: false, targetZoneId: 'alpha' }),
    event('team_regroup', 4, { who: 'a', regroupEvidence: evidence }), event('revive', 5, { who: 'a' }),
    event('team_regroup', 6, { who: 'c', regroupEvidence: evidence }), event('dimension_rift_space', 7, { who: 'c', direction: 'enter' }),
    event('team_regroup', 8, { who: 'a', regroupEvidence: evidence }), event('team_regroup', 9, { who: 'a', cleared: true }),
    event('hunt_transfer', 10, { who: 'c', previousOwnerId: 'a', wildlifeName: '검사 야생동물', wildlifeHp: 40, wildlifeMaxHp: 100 })];
  const { input, window } = compare({ events, matchSec: 10 });
  for (const matchSec of [4, 5, 7, 9, 10, 4, 10]) assert.deepEqual(model({ ...input, matchSec, eventWindow: window }), model({ ...input, matchSec }));
  assert.equal(model({ ...input, matchSec: 5, eventWindow: window }).members.find(row => row.id === 'a').decision, null);
});
check('mutating a returned model or procurement receipt cannot poison the next query snapshot', () => {
  const events = [event('queue', 0, { who: 'a', chosen: 'kioskBuy', actionKey: 'buy:1', itemId: 'ore', itemName: '광석' }),
    event('procurement', 1, { who: 'a', receiptVersion: 1, actionKey: 'buy:1', actionType: 'kioskBuy', itemId: 'ore', itemName: '광석',
      outcome: 'completed', paidCost: 12, gainedCredits: 0, beforeCredits: 30, afterCredits: 18, receivedQty: 1, qty: 1 }), ...tail(10)];
  const { input, expected, indexed, window } = compare({ events, matchSec: 30 });
  assert.equal(indexed.members.find(row => row.id === 'a').procurement.matchedChoice, true);
  indexed.members[0].procurement.result = 'poison'; indexed.members[0].name = 'poison';
  indexed.recent[0].text = 'poison'; indexed.recent.length = 0; indexed.turningPoints.reverse(); indexed.teams[0].name = 'poison';
  assert.deepEqual(pure(() => model({ ...input, eventWindow: window })), expected);
});
check('derived receipt copies preserve existing nested input references rather than deep-cloning the event evidence', () => {
  const actionKey = { key: 'source-owned-action' }, itemId = ['source-owned-item'];
  const events = [event('queue', 1, { who: 'a', chosen: 'kioskBuy', actionKey, itemId, itemName: '광석' })];
  const { input, expected, indexed, window } = compare({ survivors: [actor('a')], events, matchSec: 10 });
  const originalReceipt = expected.members[0].procurement, currentReceipt = indexed.members[0].procurement;
  assert.equal(originalReceipt.actionKey, actionKey); assert.equal(originalReceipt.itemId, itemId);
  assert.equal(currentReceipt.actionKey, actionKey); assert.equal(currentReceipt.itemId, itemId);
  currentReceipt.actionKey = { key: 'replacement-output-only' }; currentReceipt.itemId = ['replacement-output-only'];
  const fresh = pure(() => model({ ...input, eventWindow: window })).members[0].procurement;
  assert.equal(fresh.actionKey, actionKey); assert.equal(fresh.itemId, itemId);
  assert.equal(events[0].actionKey, actionKey); assert.equal(events[0].itemId, itemId);
});
check('same event window keeps current names health equipment zones goals and dead-roster replacement fresh', () => {
  const oldDead = actor('a', 'team:1', { hp: 0, name: '이전 사망 기록' });
  const current = actor('a', 'team:1', { name: '현재 대원' });
  const events = [event('craft', 0, { who: 'a', itemName: '도구' })], window = windowFor(events, ['a']);
  const initial = { survivors: [current, actor('b', 'team:2')], dead: [oldDead], events, teamId: 'team:1', matchSec: 2, zoneName };
  references(model({ ...initial, eventWindow: window }), initial.survivors, initial.dead);
  const latest = { ...current, name: '최신 이름', hp: 37, maxHp: 120, zoneId: 'beta',
    inventory: [{ itemId: 'new-weapon', name: '현재 무기', type: 'equipment', equipSlot: 'weapon', tier: 3 }], equipped: { weapon: 'new-weapon' } };
  const input = { ...initial, survivors: [latest, initial.survivors[1]], zoneName: id => '현재 지역 ' + id };
  const result = model({ ...input, eventWindow: window }); assert.deepEqual(result, model(input)); references(result, input.survivors, input.dead);
  assert.equal(result.members[0].name, '최신 이름'); assert.equal(result.members[0].hp, 37); assert.match(result.members[0].equipment, /현재 무기/);
  assert.equal(result.members[0].zone, '현재 지역 beta');
  const spawnState = { coreNodes: [{ id: 'source', kind: 'life_tree', zoneId: 'beta', picked: false }] };
  const goal = captureMovementObjective({ objectiveType: 'natural_core', objectiveSubkind: 'life_tree' }, 'beta', { spawnState });
  const objectiveActor = { ...latest, _movementObjective: { ...goal, atSec: 0 } };
  const goalInput = { ...input, survivors: [objectiveActor, input.survivors[1]], spawnState };
  const activeGoal = model({ ...goalInput, eventWindow: window }); assert.deepEqual(activeGoal, model(goalInput));
  assert.equal(activeGoal.objectives.length, 1);
  const unavailable = { ...goalInput, spawnState: { coreNodes: [{ ...spawnState.coreNodes[0], picked: true }] } };
  const changed = model({ ...unavailable, eventWindow: window }); assert.deepEqual(changed, model(unavailable)); assert.equal(changed.objectives.length, 0);
});
check('stateless and explicitly rebuilt windows observe mutable-source edits without promising stale owned-window support', () => {
  const events = [event('craft', 1, { who: 'a', itemName: '이전' })], survivors = roster();
  const before = model({ survivors, events, teamId: 'team:1', matchSec: 10 });
  events[0].at.sec = 3; events[0].itemName = '변경'; events.push(event('craft', 2, { who: 'a', itemName: '추가' }));
  const input = { survivors, events, teamId: 'team:1', matchSec: 10 }, expected = model(input);
  assert.notDeepEqual(expected, before); assert.deepEqual(model({ ...input, eventWindow: windowFor(events, ['a', 'c']) }), expected);
});
check('independent windows with identical members and times never mix their receipts or decisions across interleaved queries', () => {
  const survivors = freeze([actor('a'), actor('b', 'team:2')]);
  const makeInput = (paidCost, targetZoneId) => {
    const actionKey = `buy:${paidCost}`;
    const events = freeze([event('queue', 0, { who: 'a', chosen: 'kioskBuy', actionKey, itemId: 'ore', itemName: '광석' }),
      event('procurement', 1, { who: 'a', receiptVersion: 1, actionKey, actionType: 'kioskBuy', itemId: 'ore', itemName: '광석',
        outcome: 'completed', paidCost, gainedCredits: 0, beforeCredits: 30, afterCredits: 30 - paidCost, receivedQty: 1, qty: 1 }),
      event('team_decision', 2, { who: 'a', reason: 'team_regroup', moved: false, targetZoneId }), ...tail(10)]);
    const input = { survivors, events, teamId: 'team:1', zoneName, matchSec: 30 };
    return { input, window: windowFor(events, ['a']), expected: pure(() => model(input)) };
  };
  const first = makeInput(12, 'alpha'), second = makeInput(20, 'beta');
  assert.notDeepEqual(first.expected, second.expected);
  const read = (sample, matchSec = 30) => pure(() => model({ ...sample.input, matchSec, eventWindow: sample.window }));
  const outputFirst = read(first), outputSecond = read(second);
  assert.deepEqual(outputFirst, first.expected); assert.deepEqual(outputSecond, second.expected);
  assert.match(outputFirst.members[0].procurement.result, /-12Cr/); assert.match(outputSecond.members[0].procurement.result, /-20Cr/);
  outputFirst.members[0].procurement.result = 'poison-first'; outputFirst.members[0].decision.text = 'poison-first';
  outputSecond.members[0].procurement.result = 'poison-second'; outputSecond.recent[0].text = 'poison-second';
  for (const sample of [first, second, second, first]) {
    assert.deepEqual(read(sample), sample.expected);
    assert.deepEqual(read(sample, Object.freeze({ valueOf: () => 30 })), sample.expected);
    assert.deepEqual(read(sample), sample.expected);
    assert.ok(sample.window.rows.every(row => !Object.hasOwn(row, 'previousDecision')));
  }
});
console.log(JSON.stringify({ pass: true, checks, mode: 'current-source-stateless-and-indexed-contracts',
  scope: 'Fresh fixed histories and explicit expectations, full current-model equality, source references, purity and interleaved-window isolation. Getter counts verify prefix reuse and refolding; no actual GC or heap acceptance. No private original-source input, saved outcome, simulation, browser or G1-G5 acceptance claim.', resultFiles: 0 }));
