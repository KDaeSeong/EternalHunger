import assert from 'node:assert/strict';
import { summarizeTeamRetreats } from './lib/match-distribution-diagnostics.mjs';

const move = (who, from, to, reason = 'flee:team_outnumbered', sec = 10) =>
  ({ kind: 'move', who, from, to, reason, at: { sec } });
let checks = 0;
const failures = [];
function check(name, run) {
  try { run(); checks++; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: String(error) }); console.error(`FAIL ${name}: ${error}`); }
}

check('both explicit team flee reasons form a real adjacent reversal', () => {
  const result = summarizeTeamRetreats([
    move('a', 'A', 'B', 'flee:team_power_gap', 10),
    { kind: 'team_decision', who: 'a', reason: 'team_outnumbered', at: { sec: 15 } },
    move('a', 'B', 'A', 'flee:team_outnumbered', 20),
  ]);
  assert.equal(result.total, 2);
  assert.equal(result.reversals, 1);
  assert.equal(result.uniqueActors, 1);
  assert.equal(result.byReason.team_power_gap, 1);
  assert.equal(result.byReason.team_outnumbered, 1);
  assert.deepEqual(result.reversalSamples[0], { actorId: 'a', previousAtSec: 10, atSec: 20,
    from: 'B', to: 'A', previousReason: 'team_power_gap', reason: 'team_outnumbered' });
});

for (const kind of ['death', 'revive', 'dimension_rift_space']) {
  check(`${kind} separates otherwise opposite retreats for the same actor`, () => {
    const result = summarizeTeamRetreats([
      move('a', 'A', 'B'), { kind, who: 'a', at: { sec: 15 } }, move('a', 'B', 'A', undefined, 20),
    ]);
    assert.equal(result.total, 2, 'real retreat edges remain in the total');
    assert.equal(result.reversals, 0, 'different lifecycle/space segments cannot be adjacent');
    assert.deepEqual(result.reversalSamples, []);
  });
}

check('another actor lifecycle event cannot erase a real reversal', () => {
  const result = summarizeTeamRetreats([
    move('a', 'A', 'B'), move('b', 'C', 'D'), { kind: 'death', who: 'b' }, move('a', 'B', 'A'),
  ]);
  assert.equal(result.total, 3);
  assert.equal(result.reversals, 1);
  assert.equal(result.reversalSamples[0].actorId, 'a');
});

check('ordinary actual movement interrupts the adjacent team retreat pair', () => {
  const result = summarizeTeamRetreats([
    move('a', 'A', 'B'), move('a', 'B', 'C', 'growth_farm'), move('a', 'C', 'B', 'growth_farm'),
    move('a', 'B', 'A'), move('generic', 'A', 'B', 'avoid_power'),
    { kind: 'queue', who: 'a', chosen: 'moveTo', reason: 'team_outnumbered', from: 'A', to: 'B' },
  ]);
  assert.equal(result.total, 2);
  assert.equal(result.reversals, 0);
});

check('same-region notices are not retreat edges and cannot hide real adjacency', () => {
  const result = summarizeTeamRetreats([
    move('a', 'A', 'B'), move('a', 'B', 'B'), move('a', 'B', 'A'),
    move('missing', '', 'A'), { kind: 'move', from: 'A', to: 'B', reason: 'flee:team_outnumbered' },
  ]);
  assert.equal(result.total, 2);
  assert.equal(result.reversals, 1);
  assert.equal(result.maxPerActor, 2);
});

check('actor IDs which resemble object prototype names keep independent counts', () => {
  const events = ['__proto__', 'constructor', 'toString'].flatMap((id) =>
    [move(id, 'A', 'B'), move(id, 'B', 'A')]);
  const result = summarizeTeamRetreats(events);
  assert.equal(result.total, 6);
  assert.equal(result.uniqueActors, 3);
  assert.equal(result.maxPerActor, 2);
  assert.equal(result.reversals, 3);
  assert.equal(result.topActors.length, 3);
  for (const [, count] of result.topActors) assert.equal(count, 2);
});

check('frozen events stay unchanged and returned reports own their samples', () => {
  const events = Object.freeze([move('a', 'A', 'B'), move('a', 'B', 'A')]
    .map((event) => Object.freeze({ ...event, at: Object.freeze(event.at) })));
  const before = JSON.stringify(events);
  const first = summarizeTeamRetreats(events);
  first.reversalSamples[0].actorId = 'changed'; first.topActors[0][1] = 999;
  const second = summarizeTeamRetreats(events);
  assert.equal(JSON.stringify(events), before);
  assert.equal(second.reversalSamples[0].actorId, 'a');
  assert.equal(second.topActors[0][1], 2);
});

console.log(`TEAM_RETREAT_DIAGNOSTIC_CHECKS ${checks}/${checks + failures.length}`);
assert.deepEqual(failures, [], 'Current-source retreat diagnostics must respect actual edge/lifecycle boundaries.');
