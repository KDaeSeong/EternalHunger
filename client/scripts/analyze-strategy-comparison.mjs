import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { buildSimulationDiagnostics } = await import('../src/app/simulation/_lib/simulationDiagnostics.js');
const { buildRunActionSummary } = await import('../src/app/simulation/_lib/runActionSummary.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  assert.match(arg, /^--(seeds|output)=.+$/);
  const split = arg.indexOf('='); return [arg.slice(2, split), arg.slice(split + 1)];
}));
const seeds = (options.seeds || '1101,2202,3303').split(',');
assert.ok(seeds.every(Boolean)); assert.equal(new Set(seeds).size, seeds.length);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rows = [];
const teamOf = actor => String(actor.matchTeamId || actor.teamId);
const resultSummary = (initial, match) => {
  const diagnostics = buildSimulationDiagnostics({ runEvents: match.events, ...match.finalFrame,
    itemMetaById: Object.fromEntries(initial.items.map(item => [String(item._id), item])) });
  const completed = new Set(match.events.filter(event => event.kind === 'growth_plan'
    && event.totalSlots > 0 && event.completedSlots === event.totalSlots).map(event => event.who));
  const completedBy250 = new Set(match.events.filter(event => event.kind === 'growth_plan'
    && event.at?.sec <= 250 && event.totalSlots > 0 && event.completedSlots === event.totalSlots).map(event => event.who));
  const actions = buildRunActionSummary(match.events);
  return { evidence: match.evidence, growthComplete: completed.size, growthCompleteBy250: completedBy250.size,
    heroGearReady: diagnostics.equipment.heroGearReadyCount,
    legendaryReady: diagnostics.equipment.legendaryReadyCount,
    emptySlots: diagnostics.equipment.actors.reduce((sum, actor) => sum + 5 - actor.equippedCount, 0),
    equipmentSnapshotScope: 'alive final state and latest death snapshot for finally dead participants',
    emptySlotActors: diagnostics.equipment.actors.filter(actor => actor.equippedCount < 5)
      .map(actor => ({ actorId: actor.id, source: actor.source, equippedCount: actor.equippedCount })),
    team: actions.team, growthActions: actions.growth,
    survival: initial.survivors.map(actor => {
      const death = match.finalFrame.dead.find(row => row._id === actor._id);
      const deathEvent = match.events.find(event => event.kind === 'death' && event.who === actor._id);
      return { actorId: actor._id, teamId: teamOf(actor), aliveAtEnd: !death,
        firstDeathAtSec: deathEvent?.at?.sec ?? null };
    }),
  };
};
const save = () => {
  if (options.output) writeFileSync(options.output, JSON.stringify({ engineVersion: SIMULATION_ENGINE_VERSION,
    seeds, expectedCases: seeds.length * 3, complete: rows.length === seeds.length * 3,
    rows, scope: 'paired ordinary guest inputs: unchanged credits, inventory, HP, map, catalog and rules; one tactical skill or one two-member formation swap; actual outcomes, not general win-rate or causal balance acceptance' }, null, 2));
};

for (const seed of seeds) {
  const original = JSON.parse(await createRandomIsolationInput(seed));
  const originalDigest = digest(original);
  for (const variant of ['baseline', 'one-tactical-skill', 'one-formation-swap']) {
    const input = structuredClone(original), changes = [];
    if (variant === 'one-tactical-skill') {
      const actor = input.survivors[0], before = actor.tacticalSkill;
      actor.tacticalSkill = before === '치유의 바람' ? '초월' : '치유의 바람';
      changes.push({ actorId: actor._id, field: 'tacticalSkill', before, after: actor.tacticalSkill });
    }
    if (variant === 'one-formation-swap') {
      const a = input.survivors[1], b = input.survivors[4];
      for (const [actor, other] of [[a, b], [b, a]]) changes.push({ actorId: actor._id,
        field: 'team', before: teamOf(actor), after: teamOf(other) });
      for (const field of ['teamId', 'matchTeamId', 'teamName', 'matchTeamName']) [a[field], b[field]] = [b[field], a[field]];
      assert.deepEqual(input.survivors.map(teamOf).sort(), original.survivors.map(teamOf).sort());
    }
    const before = digest(input);
    console.log(`STRATEGY_COMPARISON_START ${JSON.stringify({ seed, variant, changes })}`);
    const match = await runRandomIsolationMatch(JSON.stringify(input), { phaseOnly: true });
    assert.equal(digest(input), before); assert.equal(digest(original), originalDigest);
    const row = { seed, variant, inputDigest: before, changes, ...resultSummary(input, match),
      sharedPurchaseIntentions: match.events.filter(event => event.reason === 'team_rotate'
        && /키오스크|구매|교환|kiosk/.test(event.sharedGoalReason || '')).length };
    rows.push(row); save();
    console.log(`STRATEGY_COMPARISON_CASE ${JSON.stringify({ seed, variant,
      endingSec: row.evidence.ending.atSec, winnerTeamId: row.evidence.ending.winnerTeamId,
      growthCompleteBy250: row.growthCompleteBy250, emptySlots: row.emptySlots })}`);
  }
}
console.log(`STRATEGY_COMPARISON_RESULT ${JSON.stringify({ pass: true, engineVersion: SIMULATION_ENGINE_VERSION,
  matches: rows.length, seeds, scope: 'paired tactical/formation observations; no injected mid-match state or manufactured winner' })}`);
