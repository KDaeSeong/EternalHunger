import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { captureSimulationReplayResult, cloneReplayData, compareSimulationReplay, semanticRunEvents } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');

let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };

// Frozen pre-optimization oracle. JSON normalization, timestamp exclusion and
// comparison of final state/random/ending remain part of the contract.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function legacyCompare(expected, actual) {
  const left = semanticRunEvents(expected.events), right = semanticRunEvents(actual.events);
  let firstDifference = -1;
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    if (canonical(left[index]) !== canonical(right[index])) { firstDifference = index; break; }
  }
  const sameFinalState = canonical(expected.finalFrame) === canonical(actual.finalFrame);
  const sameRandom = canonical(expected.random) === canonical(actual.random);
  const expectedHasEnding = expected?.summary && Object.hasOwn(expected.summary, 'ending');
  const actualHasEnding = actual?.summary && Object.hasOwn(actual.summary, 'ending');
  const sameEnding = expectedHasEnding === actualHasEnding
    && (!expectedHasEnding || canonical(expected.summary.ending) === canonical(actual.summary.ending));
  return { matched: firstDifference === -1 && sameFinalState && sameRandom && sameEnding, firstDifference,
    expectedEvents: left.length, actualEvents: right.length, sameFinalState, sameRandom, sameEnding };
}
const outcome = (events) => ({ events, finalFrame: { survivors: [{ hp: 12 }], dead: [] },
  random: { draws: 3 }, summary: { ending: { atSec: 10, outcome: 'last_team' } } });
const sameAsLegacy = (left, right) => assert.deepEqual(compareSimulationReplay(left, right), legacyCompare(left, right));

check('capture preserves JSON output and synchronously detaches every owned result field', () => {
  const input = { events: [{ kind: 'action', ts: 10, payload: { hp: 5, absent: undefined, number: NaN } }],
    finalFrame: { survivors: [{ inventory: [{ itemId: 'iron' }] }] }, random: { state: 2 },
    ending: { atSec: 3, date: new Date('2026-01-01T00:00:00Z') } };
  const expected = cloneReplayData({ events: semanticRunEvents(input.events), finalFrame: input.finalFrame,
    random: input.random, summary: { ending: input.ending } });
  const actual = captureSimulationReplayResult(input);
  assert.deepEqual(actual, expected);
  assert.equal(typeof actual?.then, 'undefined', 'Capture cannot yield before owning the final journal.');
  input.events[0].payload.hp = 100;
  input.finalFrame.survivors[0].inventory.length = 0;
  input.random.state = 99; input.ending.atSec = 999;
  assert.deepEqual(actual, expected);
});

check('capture serializes the full journal only once, not again inside the result object', () => {
  const original = JSON.stringify;
  let journalSerializations = 0;
  JSON.stringify = function (value, ...args) {
    if ((Array.isArray(value) && value[0]?.kind === 'action') || Array.isArray(value?.events)) journalSerializations += 1;
    return original.call(JSON, value, ...args);
  };
  try { captureSimulationReplayResult({ events: [{ kind: 'action', payload: [1, 2] }], finalFrame: {}, random: {}, ending: {} }); }
  finally { JSON.stringify = original; }
  assert.equal(journalSerializations, 1);
});

check('event comparison ignores only the top-level timestamp and object key insertion order', () => {
  const a = outcome([{ kind: 'move', ts: 10, payload: { to: 'b', from: 'a', ts: 3 } }]);
  const b = outcome([{ payload: { ts: 3, from: 'a', to: 'b' }, ts: 99, kind: 'move' }]);
  sameAsLegacy(a, b); assert.equal(compareSimulationReplay(a, b).matched, true);
  b.events[0].payload.ts = 4;
  sameAsLegacy(a, b); assert.equal(compareSimulationReplay(a, b).firstDifference, 0);
});

check('JSON scalar normalization, nested arrays and missing properties retain the old equivalence', () => {
  const values = [null, false, true, 0, -0, 12, '12', '', NaN, Infinity, undefined,
    { a: undefined }, {}, [], [undefined], [null], { a: [0, { b: false }] }, new Date('2026-01-01T00:00:00Z')];
  for (const left of values) for (const right of values) {
    sameAsLegacy(outcome([{ kind: 'test', value: left }]), outcome([{ kind: 'test', value: right }]));
  }
});

check('arrays, objects, lengths and own prototype-named keys cannot alias', () => {
  const values = [[], {}, [1], { 0: 1 }, [1, 2], [2, 1], { toString: 'x' },
    JSON.parse('{"__proto__":{"hp":1},"constructor":2}'), { constructor: 2 }];
  for (const left of values) for (const right of values) sameAsLegacy(outcome([{ value: left }]), outcome([{ value: right }]));
});

check('first differences, trailing events and an empty journal retain exact indexes/counts', () => {
  const base = outcome(Array.from({ length: 40 }, (_, i) => ({ kind: 'action', value: { i } })));
  for (const index of [0, 19, 39]) {
    const changed = cloneReplayData(base); changed.events[index].value.i += 1;
    sameAsLegacy(base, changed); assert.equal(compareSimulationReplay(base, changed).firstDifference, index);
  }
  for (const events of [[], base.events.slice(0, -1), [...base.events, { kind: 'end' }]]) sameAsLegacy(base, outcome(events));
  sameAsLegacy(outcome([]), outcome([]));
});

check('final state, random and absent/explicit ending semantics remain separate from events', () => {
  const base = outcome([{ kind: 'match_end' }]);
  const variants = [
    { ...base, finalFrame: { survivors: [], dead: [] } }, { ...base, random: { draws: 4 } },
    { ...base, summary: {} }, { ...base, summary: { ending: undefined } }, { ...base, summary: null },
    { ...base, finalFrame: undefined }, { ...base, random: { a: undefined } },
  ];
  for (const value of variants) { sameAsLegacy(base, value); sameAsLegacy(value, value); }
});

check('invalid non-JSON and malformed event input still rejects without modifying inputs', () => {
  const circular = {}; circular.self = circular;
  for (const events of [[{ value: 1n }], [{ value: circular }], [null]]) {
    assert.throws(() => legacyCompare(outcome(events), outcome([])));
    assert.throws(() => compareSimulationReplay(outcome(events), outcome([])));
  }
  const frozen = Object.freeze({ ...outcome(Object.freeze([Object.freeze({ kind: 'match_end', hp: 3 })])) });
  sameAsLegacy(frozen, frozen);
});

check('long journals compare all events, including changes after the 5000-row UI limit', () => {
  const base = outcome(Array.from({ length: 8000 }, (_, i) => ({ kind: 'action', ts: i, payload: { i, hp: [100, 90], zone: 'a' } })));
  const changed = cloneReplayData(base); changed.events[7999].payload.hp[1] = 89;
  sameAsLegacy(base, cloneReplayData(base)); sameAsLegacy(base, changed);
  assert.equal(compareSimulationReplay(base, changed).firstDifference, 7999);
});

check('the product completion path uses one synchronous owned capture and keeps diagnostics separate', () => {
  const source = readFileSync(new URL('../src/app/simulation/_lib/useSimulationReplay.js', import.meta.url), 'utf8');
  assert.match(source, /measureObserverWork\('replay\.captureResult', \(\) => captureSimulationReplayResult/);
  assert.match(source, /measureObserverWork\('replay\.compareResult', \(\) => compareSimulationReplay/);
  assert.doesNotMatch(source, /events:\s*semanticRunEvents\(events\)/);
});

console.log(`REPLAY_COMPARISON_CHECKS ${checks}/${checks} (semantic/ownership checks; not browser performance)`);
