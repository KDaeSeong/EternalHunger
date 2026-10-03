import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { getActorGrowthProgress } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getRuleset, getPhaseDurationSec } = await import('../src/utils/rulesets.js');
const rules = getRuleset('ER_S11');
const firstDayEndSec = getPhaseDurationSec(rules, 1, 'morning') + getPhaseDurationSec(rules, 1, 'night');
const seeds = process.argv.find((arg) => arg.startsWith('--seeds='))?.slice(8).split(',') || ['1101', '2202', '3303'];

for (const seed of seeds) {
  console.log(`Running first-night deadline fixture ${seed} with its own initial roster/route seed.`);
  const input = await createRandomIsolationInput(seed, { initialRosterSeed: `FIRST-DAY:${seed}` });
  const fixture = JSON.parse(input);
  const completed = new Map();
  const result = await runRandomIsolationMatch(input, {
    stopAfterPhase: { day: 1, phase: 'night' },
    onFrame: (frame, { publicItems }) => {
      for (const actor of frame.survivors) {
        const progress = getActorGrowthProgress(actor, publicItems);
        if (progress.totalSlots === 5 && progress.remaining.length === 0 && !completed.has(actor._id)) {
          completed.set(actor._id, frame.matchSec);
        }
      }
    },
  });
  assert.equal(result.finalFrame.matchSec, firstDayEndSec);
  const pending = fixture.survivors.filter((actor) => !completed.has(actor._id)).map((actor) => actor.name);
  assert.deepEqual(pending, [], 'These canonical fixtures must reach every actual five-slot goal by the first-night deadline.');
  for (const sec of completed.values()) assert.ok(sec < firstDayEndSec);
  const fieldEvents = result.events.filter((event) => event.kind === 'field_resource');
  const remaining = new Map();
  for (const event of fieldEvents) {
    const key = `${event.zoneId}:${event.itemId}`;
    assert.equal(event.remaining, (remaining.get(key) ?? event.initial) - event.qty);
    assert.ok(event.remaining >= 0);
    remaining.set(key, event.remaining);
  }
  assert.ok(fieldEvents.length > 0);
  assert.ok(result.events.some((event) => event.kind === 'battle'), 'Do not replace competition with the safe training control.');
  console.log(JSON.stringify({ pass: true, seed, initialRosterSeed: fixture.initialRosterSeed,
    firstDayEndSec, complete: completed.size, total: fixture.survivors.length,
    completionSec: [...completed.values()].sort((a, b) => a - b),
    battles: result.events.filter((event) => event.kind === 'battle').length,
    eventCount: result.events.length,
    scope: 'current canonical competitive fixture, real recipes/stocks and two production phases; not exact reproduction of supplied battle-log-only exports or a guarantee for combat deaths/custom unavailable recipes' }));
}
