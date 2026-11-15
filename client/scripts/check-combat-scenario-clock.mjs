import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { actor, runCombatScenario } from './lib/run-combat-scenario.mjs';

// Exercise the real combat scheduler and its event clock with fresh local actors.
// No match, source substitution, historical outcome, account or reward injection.
const roster = () => [actor('clock-a', { teamId: 'a', hp: 100, maxHp: 100 }),
  actor('clock-b', { teamId: 'b', hp: 100, maxHp: 100 })];
async function run(options = {}) {
  const settings = {};
  const result = await runCombatScenario(roster(), { duration: 1.25, startSec: 100,
    seed: 'combat-scenario-clock-v1', settings, ...options });
  assert.ok(result.events.length > 0);
  for (const id of ['clock-a', 'clock-b']) {
    assert.deepEqual(result.times(id), [100, 101], 'Real scheduled attacks retain their literal seconds.');
    assert.equal(result.survivorMap.get(id).hp, 98);
  }
  assert.equal(result.frames[0].sec, 100);
  assert.equal(result.frames.at(-1).sec, 101.25);
  return { result, settings };
}
function assertClock({ result, settings }, day, phase) {
  for (const event of result.events) {
    assert.ok(event.at, 'Every committed combat event owns its actual clock.');
    assert.equal(event.at.day, day);
    assert.equal(event.at.phase, phase);
    assert.ok(event.at.sec >= 100 && event.at.sec <= 101.25);
  }
  // The production loop sets this flag from state.nextPhase before scheduling.
  // Inspecting that real caller-owned settings object also detects label-only fixes.
  assert.equal(settings.battle.isNight, phase === 'night');
}
const withoutDate = event => ({ ...event, at: { ...event.at, day: 0, phase: '' } });
const outcome = ({ result }) => ({ events: result.events.map(withoutDate), frames: result.frames,
  actors: [...result.survivorMap.values()], randomState: result.randomState });
let passed = 0, failed = 0;
async function check(name, test) {
  try { await test(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
const defaults = await run();
await check('omitted clock options retain the actual first-morning default and exact explicit-default outcome', async () => {
  assertClock(defaults, 1, 'morning');
  const explicit = await run({ nextDay: 1, nextPhase: 'morning' });
  assertClock(explicit, 1, 'morning');
  assert.deepEqual(explicit.result.events, defaults.result.events);
  assert.deepEqual(outcome(explicit), outcome(defaults));
});
await check('an explicit later day retains morning state and stamps every delayed combat event with that day', async () => {
  const later = await run({ nextDay: 2 });
  assertClock(later, 2, 'morning');
  assert.deepEqual(outcome(later), outcome(defaults));
});
await check('an explicit night reaches production night state and agrees with every actual event timestamp', async () => {
  const night = await run({ nextDay: 2, nextPhase: 'night' });
  assertClock(night, 2, 'night');
  assert.deepEqual(outcome(night), outcome(defaults),
    'These plain already-engaged actors have identical seconds, HP, packets, frames and seeded RNG.');
  const repeat = await run({ nextDay: 2, nextPhase: 'night' });
  assert.deepEqual(repeat.result.events, night.result.events);
  assert.deepEqual(outcome(repeat), outcome(night));
});
console.log(`COMBAT_SCENARIO_CLOCK_CHECKS ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
