import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

const args = process.argv.slice(2);
assert.ok(args.every((arg) => arg === '--lifecycle-regression'), 'Only --lifecycle-regression is supported.');
const cases = [
  ...(!args.includes('--lifecycle-regression') ? [{ seed: '1101', initialRosterSeed: 'HF4:roster-A' }] : []),
  { seed: '4402', initialRosterSeed: 'FIXTURE:initial-roster' },
];

function assertHuntLifecycle(events) {
  const byKind = (kind) => events.filter((event) => event.kind === kind && event.encounterId);
  const starts = byKind('hunt_start'), ends = byKind('hunt_end'), settlements = byKind('hunt_settlement');
  const duplicateIds = (rows) => [...new Set(rows.filter((row, index) =>
    rows.findIndex((candidate) => candidate.encounterId === row.encounterId) !== index).map((row) => row.encounterId))];
  const duplicates = [...new Set([duplicateIds(starts), duplicateIds(ends), duplicateIds(settlements)].flat())];
  if (duplicates.length) console.error(`HUNT_LIFECYCLE_DUPLICATES ${JSON.stringify({
    encounterIds: duplicates,
    events: events.filter((event) => duplicates.includes(event.encounterId)
      && ['hunt_start', 'hunt_transfer', 'hunt_participant_end', 'hunt_participant_settlement', 'hunt_settlement', 'hunt_end'].includes(event.kind)),
  })}`);
  for (const [kind, rows] of [['start', starts], ['end', ends], ['settlement', settlements]]) {
    assert.equal(new Set(rows.map((row) => row.encounterId)).size, rows.length, `One ${kind} per encounter.`);
  }
  assert.deepEqual(ends.map((row) => row.encounterId).sort(), starts.map((row) => row.encounterId).sort(),
    'Every started encounter ends exactly once.');
  assert.deepEqual(settlements.map((row) => row.encounterId).sort(), ends
    .filter((row) => ['victory', 'hunter_defeated'].includes(row.outcome)).map((row) => row.encounterId).sort(),
  'Only terminal victories or wildlife defeats settle the encounter, exactly once.');
  const participants = byKind('hunt_participant_end');
  const contributions = byKind('hunt_participant_settlement');
  for (const event of participants) {
    assert.ok(['hunter_defeated', 'interrupted_by_death'].includes(event.outcome));
    assert.ok(event.continuedBy && event.who !== event.continuedBy);
    const index = events.indexOf(event);
    assert.ok(events.slice(0, index).some((row) => row.kind === 'hunt_transfer'
      && row.encounterId === event.encounterId && row.previousOwnerId === event.who && row.who === event.continuedBy));
    assert.ok(events.slice(index + 1).some((row) => row.kind === 'hunt_end' && row.encounterId === event.encounterId),
      'A departing owner cannot terminate the transferred encounter.');
  }
  assert.equal(contributions.length, participants.filter((row) => row.outcome === 'hunter_defeated').length);
  for (const receipt of contributions) {
    assert.equal(receipt.settlement, 'participant_contribution');
    assert.equal(receipt.died, true);
    assert.equal(receipt.defeated, false);
    assert.equal(receipt.hpAfter, 0);
    assert.equal(receipt.credits, 0);
    assert.deepEqual(receipt.receivedDrops, []);
    assert.ok(participants.some((row) => row.encounterId === receipt.encounterId && row.who === receipt.who
      && row.outcome === 'hunter_defeated' && row.at.sec === receipt.at.sec));
  }
  return { starts: starts.length, ends: ends.length, settlements: settlements.length,
    participantEnds: participants.length, participantContributions: contributions.length };
}

for (const { seed, initialRosterSeed } of cases) {
  console.log(`BOSS_HANDOFF_MATCH_START ${JSON.stringify({ seed, initialRosterSeed })}`);
  const input = await createRandomIsolationInput(seed, { initialRosterSeed });
  const original = await runRandomIsolationMatch(input);
  const lifecycle = assertHuntLifecycle(original.events);
  console.log(`BOSS_HANDOFF_MATCH_ORIGINAL ${JSON.stringify({ seed, evidence: original.evidence, lifecycle })}`);
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
    seed, initialRosterSeed, evidence: original.evidence, lifecycle, transfers,
    successfulHuntSettlements: paid.length,
    scope: 'two model completions with identical JSON input, events, frames, RNG and ending; not browser or human acceptance' }));
}
