import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

const input = await createRandomIsolationInput('1101', { initialRosterSeed: 'HF4:roster-A' });
const original = await runRandomIsolationMatch(input);
const repeated = await runRandomIsolationMatch(JSON.stringify(JSON.parse(input)));
assert.deepEqual(repeated.evidence, original.evidence);
assert.deepEqual(repeated.finalFrame, original.finalFrame);
assert.deepEqual(repeated.events, original.events);
const transfers = original.events.filter((event) => event.kind === 'hunt_transfer');
for (const transfer of transfers) {
  assert.ok(transfer.previousOwnerId && transfer.who !== transfer.previousOwnerId);
  assert.ok(transfer.wildlifeHp > 0 && transfer.wildlifeHp <= transfer.wildlifeMaxHp);
  assert.ok(original.events.some((event) => event.kind === 'hunt_start' && event.encounterId === transfer.encounterId
    && event.wildlifeId === transfer.wildlifeId && event.at.sec <= transfer.at.sec));
}
const paid = original.events.filter((event) => event.kind === 'hunt_settlement' && event.defeated && event.encounterId);
assert.equal(new Set(paid.map((event) => event.encounterId)).size, paid.length);
console.log(JSON.stringify({ pass: true, engineVersion: SIMULATION_ENGINE_VERSION,
  initialRosterSeed: 'HF4:roster-A', evidence: original.evidence, transfers,
  successfulHuntSettlements: paid.length,
  scope: 'two model completions with identical JSON input, events, frames, RNG and ending; not browser or human acceptance' }));
