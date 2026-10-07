import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const observerURL = new URL('../src/app/simulation/_lib/teamObserverRuntime.js', import.meta.url);
const { buildTeamObserverModel } = await import(observerURL.href);

// Test-only forward projection of the same complete event window. No past
// result files, Git revisions, browser state, saved logs or external calls.
// Unchanged formatting/actor helpers are shared; only the projection algorithm
// below is replaced so the full resulting model can be compared strictly.

const referenceLoop = [
  "  const recent = [];",
  "  const combat = [];",
  "  const turningPoints = [];",
  "  const previousDecision = new Map();",
  "  const lastDecisionByActor = new Map();",
  "  const lastRegroupByActor = new Map();",
  "  const lastProcurementByActor = new Map();",
  "  const appendRecent = (rows, row, limit) => {",
  "    rows.push(row);",
  "    if (rows.length > limit) rows.shift();",
  "  };",
  "  for (const row of timed) {",
  "    const whoId = String(row.event.who || '');",
  "    if (whoId && memberIds.has(whoId) && ['queue', 'procurement'].includes(row.event.kind)) {",
  "      const receipt = updateProcurementObservation(lastProcurementByActor.get(whoId), row.event, formatClock(row.sec));",
  "      if (receipt) lastProcurementByActor.set(whoId, receipt);",
  "    }",
  "    if (row.event.kind === 'revive' && whoId) { lastDecisionByActor.delete(whoId); lastRegroupByActor.delete(whoId); }",
  "    if (row.event.kind === 'dimension_rift_space' && whoId) lastRegroupByActor.delete(whoId);",
  "    if (row.event.kind === 'team_regroup' && whoId) {",
  "      if (row.event.cleared) lastRegroupByActor.delete(whoId);",
  "      else if (row.event.regroupEvidence?.version === 1) lastRegroupByActor.set(whoId, row);",
  "    }",
  "    if (decisionKinds.has(row.event.kind) && whoId) lastDecisionByActor.set(whoId, row);",
  "    if (row.event.kind === 'hunt_transfer' && row.event.previousOwnerId) lastDecisionByActor.set(String(row.event.previousOwnerId), row);",
  "    if (row.event.kind === 'queue') continue;",
  "    const text = describeObserverEvent(row.event, { nameOf, zoneName });",
  "    if (!text) continue;",
  "    if (['team_decision', 'growth_plan'].includes(row.event.kind)) {",
  "      const key = row.event.kind + ':' + row.event.who;",
  "      if (previousDecision.get(key) === text) continue;",
  "      previousDecision.set(key, text);",
  "    }",
  "    const formatted = { key: row.sec + ':' + row.index, sec: row.sec, clock: formatClock(row.sec), text, kind: row.event.kind };",
  "    appendRecent(recent, formatted, 10);",
  "    if (row.event.kind === 'battle') {",
  "      const health = presentCombatHealth(row.event, nameOf);",
  "      if (health) appendRecent(combat, { ...formatted, ...health, zone: zoneName(row.event.zoneId),",
  "        attack: row.event.subkind === 'equipment_effect' ? (row.event.itemName || '장비') + ' · 파열'",
  "          : row.event.subkind === 'character_skill_splash' ? '광역 스킬' : row.event.subkind === 'character_skill_direct' ? '스킬' : '공격' }, 3);",
  "    }",
  "    if (importantKinds.has(row.event.kind)) appendRecent(turningPoints, formatted, 8);",
  "  }",
  "  recent.reverse(); turningPoints.reverse(); combat.reverse();"
].join('\n') + '\n';

const referenceURL = observerURL.href + '?forward-window-reference';
const referenceHook = registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (url !== referenceURL) return loaded;
    const source = String(loaded.source);
    const functionStart = source.indexOf('export function buildTeamObserverModel(');
    const start = source.indexOf('  const recent = [];', functionStart);
    const end = source.indexOf('  const members = ', start);
    assert.ok(functionStart >= 0 && start > functionStart && end > start, 'projection boundary is present');
    const projected = source.slice(0, start) + referenceLoop + source.slice(end);
    return { ...loaded, source: projected.replace(
      'recent: recent.reverse(), turningPoints: turningPoints.reverse(), combat: combat.reverse(),',
      'recent, turningPoints, combat,') };
  },
});
let forwardModel;
try { ({ buildTeamObserverModel: forwardModel } = await import(referenceURL)); }
finally { referenceHook.deregister(); }

let checks = 0;
function check(name, run) { run(); checks += 1; console.log('PASS ' + name); }
const actor = (id, team = 'team:1', extra = {}) => ({
  _id: id, name: id, teamId: team, hp: 100, maxHp: 100, zoneId: 'alpha', inventory: [], ...extra,
});
const event = (kind, sec, extra = {}) => ({ kind, at: { sec }, ...extra });
const survivors = [actor('a'), actor('c', 'team:1', { teamSlot: 2 }), actor('b', 'team:2')];
const zoneName = id => ({ alpha: '공장', beta: '학교' })[id] || String(id);
function compare(input) {
  const { zoneName: inputZoneName, ...dataInput } = input;
  const before = structuredClone(dataInput);
  const expected = forwardModel({ survivors, zoneName, ...input });
  const actual = buildTeamObserverModel({ survivors, zoneName, ...input });
  assert.deepEqual(actual, expected);
  assert.deepEqual(dataInput, before, 'all source event/actor data remains unchanged');
  assert.equal(input.zoneName, inputZoneName, 'label callback is not replaced');
  return actual;
}
const health = {
  version: 1,
  attacker: { id: 'a', before: { hp: 100, maxHp: 100 }, after: { hp: 100, maxHp: 100 } },
  target: { id: 'b', before: { hp: 90, maxHp: 100 }, after: { hp: 80, maxHp: 100 } },
};
const mixed = Array.from({ length: 1800 }, (_, index) => {
  const kind = ['team_engagement', 'team_decision', 'growth_plan', 'queue', 'battle', 'craft',
    'rest', 'unsupported', 'hunt_start', 'hunt_end', 'use', 'effect'][index % 12];
  return event(kind, index / 4, { who: index % 5 === 0 ? 'b' : 'a', a: 'a', b: 'b',
    zoneId: 'alpha', participants: ['a', 'b'], reason: index % 9 ? 'team_regroup' : 'low_hp',
    moved: false, targetZoneId: index % 3 ? 'alpha' : 'beta', itemName: '장비 ' + index % 4,
    chosen: 'craft', hp: 55, maxHp: 100, health, source: 'character_skill',
    effect: '둔화', outcome: 'applied', skill: 'Q', sourceActorId: 'b' });
});

check('empty, null and untimed inputs retain the complete forward model', () => {
  compare({ events: [], matchSec: 0 });
  compare({ events: [null, {}, event('move', null, { who: 'a' })], matchSec: 10 });
});
check('long mixed history retains exact rows, member decisions, combat and keys', () => {
  const model = compare({ events: mixed, matchSec: 500 });
  assert.equal(model.recent.length, 10); assert.equal(model.combat.length, 3);
  assert.equal(model.turningPoints.length, 8);
});
check('out-of-order and same-second inputs retain stable original-index ordering', () => {
  compare({ events: [mixed[30], mixed[2], mixed[20], mixed[20], mixed[0], mixed[15]], matchSec: 10 });
});
check('time/member filters and a rewound clock are applied on each call', () => {
  const events = [event('craft', -1, { who: 'a' }), event('craft', Infinity, { who: 'a' }),
    event('craft', '2', { who: 'a' }), event('craft', 3, { who: 'unwatched' }), ...mixed.slice(0, 36)];
  for (const matchSec of [0, 1, 3, 10, 1]) compare({ events, matchSec });
});
check('duplicate decisions across other events and changed goals are condensed identically', () => {
  const events = Array.from({ length: 300 }, (_, index) => event(
    index % 4 === 1 ? 'craft' : index % 4 === 2 ? 'growth_plan' : 'team_decision', index,
    { who: index % 11 ? 'a' : 'c', reason: 'team_regroup', moved: false,
      targetZoneId: index < 160 ? 'alpha' : 'beta', itemName: '장비', targetName: index < 220 ? '검' : '갑옷' }));
  compare({ events, matchSec: 400 });
  compare({ events: events.slice(140), matchSec: 400 });
});
check('all health variants remain bounded without accepting invalid combat evidence', () => {
  const events = Array.from({ length: 80 }, (_, index) => event('battle', index, {
    a: 'a', b: 'b', zoneId: 'alpha', health: index % 5 ? health : { version: 1 },
    subkind: ['equipment_effect', 'character_skill_splash', 'character_skill_direct', 'basic'][index % 4],
    itemName: '파열 장비',
  }));
  compare({ events, matchSec: 100 });
});
check('revival, regroup clear, rift entry and hunt transfer retain current member state', () => {
  const evidence = { version: 1, status: 'joining', targetZoneId: 'beta', companionsAtTarget: 1,
    combatSpaceId: 'world', memberCount: 2, distance: 1 };
  const events = [
    event('team_regroup', 0, { who: 'a', regroupEvidence: evidence }),
    event('queue', 1, { who: 'a', chosen: 'moveTo', targetZoneId: 'beta' }),
    event('revive', 2, { who: 'a', hp: 50 }),
    event('team_regroup', 3, { who: 'c', regroupEvidence: evidence }),
    event('dimension_rift_space', 4, { who: 'c', direction: 'enter' }),
    event('team_regroup', 5, { who: 'a', regroupEvidence: evidence }),
    event('team_regroup', 6, { who: 'a', cleared: true }),
    event('hunt_transfer', 7, { who: 'b', previousOwnerId: 'a', wildlifeName: '알파', wildlifeHp: 40, wildlifeMaxHp: 100 }),
  ];
  for (const matchSec of [1, 2, 4, 5, 6, 8]) compare({ events, matchSec });
});
check('the last procurement choice/result still reads the whole retained window', () => {
  const choice = event('queue', 0, { who: 'a', chosen: 'kioskBuy', actionKey: 'buy:1', itemId: 'm', itemName: '운석' });
  const receipt = event('procurement', 1, { who: 'a', receiptVersion: 1, actionKey: 'buy:1', actionType: 'kioskBuy',
    itemId: 'm', itemName: '운석', outcome: 'completed', paidCost: 10, gainedCredits: 0,
    beforeCredits: 30, afterCredits: 20, receivedQty: 1, qty: 1 });
  const events = [choice, receipt, ...mixed.map(row => ({ ...row, at: { sec: row.at.sec + 2 } }))];
  const model = compare({ events, matchSec: 500 });
  assert.equal(model.members.find(row => row.id === 'a').procurement.matchedChoice, true);
});
check('same-array edits and current actor/zone labels do not reuse stale cached descriptions', () => {
  const events = structuredClone(mixed.slice(0, 36));
  const roster = structuredClone(survivors);
  compare({ events, survivors: roster, matchSec: 20 });
  events[0].zoneId = 'beta'; events[4].health.target.after.hp = 30;
  roster[0].name = '새 이름';
  compare({ events, survivors: roster, matchSec: 20, zoneName: id => '변경 지역 ' + id });
});
check('display formatting is bounded even while every original event remains available', () => {
  const events = Array.from({ length: 5000 }, (_, index) => event('team_engagement', index,
    { zoneId: 'alpha', participants: ['a', 'b'] }));
  let referenceCalls = 0; let currentCalls = 0;
  const expected = forwardModel({ survivors, events, matchSec: 6000,
    zoneName: id => { referenceCalls += 1; return zoneName(id); } });
  const actual = buildTeamObserverModel({ survivors, events, matchSec: 6000,
    zoneName: id => { currentCalls += 1; return zoneName(id); } });
  assert.deepEqual(actual, expected); assert.equal(events.length, 5000);
  assert.ok(referenceCalls >= 5000); assert.ok(currentCalls < 50);
  console.log(JSON.stringify({ scope: 'zone lookup count, not browser speed', referenceCalls, currentCalls }));
});
check('constructed input permutations strictly match the complete forward model', () => {
  let seed = 173;
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (let trial = 0; trial < 120; trial += 1) {
    const events = Array.from({ length: 45 }, () => structuredClone(mixed[next() % mixed.length]));
    const teamId = next() % 2 ? 'team:1' : 'team:2';
    compare({ events, teamId, matchSec: next() % 500 });
  }
});
console.log('OBSERVER_TAIL_PROJECTION ' + checks + '/' + checks);
