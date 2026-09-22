import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createTeamIsolationTracker } = await import('./lib/team-isolation-tracker.mjs');
const actor = (id, zoneId) => ({ _id: id, name: id, teamId: 'team', hp: 100, maxHp: 100, zoneId,
  inventory: [], equipped: {}, routePlanTargetItemIds: ['hat'], _teamRegroup: { status: 'growing' } });
const frame = (matchSec, survivors, dead = []) => ({ matchSec, survivors, dead });
const items = [{ _id: 'hat', name: '목표 머리', equipSlot: 'head', tier: 4 }];
const start = () => {
  const tracker = createTeamIsolationTracker({ items, captureSnapshots: true });
  tracker.observe(frame(100, [actor('lone', 'hospital'), actor('ally', 'gas_station')]));
  return tracker;
};
let checks = 0;
for (const [expected, survivors, dead] of [
  ['contact', [actor('lone', 'gas_station'), actor('ally', 'gas_station')]],
  ['death', [actor('ally', 'gas_station')], [{ ...actor('lone', 'hospital'), hp: 0 }]],
  ['space_change', [{ ...actor('lone', 'hospital'), _combatSpaceId: 'dimension_rift:test' }, actor('ally', 'gas_station')]],
  ['teammates_outside_world', [actor('lone', 'hospital'), { ...actor('ally', 'gas_station'), _combatSpaceId: 'dimension_rift:test' }]],
  ['last_living_member', [actor('lone', 'hospital')], [{ ...actor('ally', 'gas_station'), hp: 0 }]],
]) {
  const tracker = start(); tracker.observe(frame(120, survivors, dead));
  const period = tracker.report().finished.find((row) => row.who === 'lone');
  assert.equal(period.endReason, expected); assert.equal(period.duration, 20);
  assert.equal(tracker.report().unfinished.some((row) => row.who === 'lone'), false);
  if (expected === 'death') assert.equal(period.finalActor.hp, 0);
  checks++; console.log(`PASS isolation termination distinguishes ${expected}`);
}
{
  const tracker = start();
  const report = tracker.report(180);
  assert.equal(report.finished.length, 0); assert.equal(report.unfinished.length, 2);
  assert.equal(report.unfinished[0].endReason, 'still_isolated'); assert.equal(report.unfinished[0].duration, 80);
  report.unfinished[0].initialActor.zone = 'corrupted';
  assert.equal(tracker.report().unfinished[0].initialActor.zone, 'hospital');
  checks++; console.log('PASS unfinished periods are retained without fake contact and reports own their data');
}
{
  const tracker = start();
  const ready = { ...actor('lone', 'hospital'), inventory: [{ itemId: 'hat', tier: 4, qty: 1 }], equipped: { head: 'hat' },
    _teamRegroup: { status: 'action_wait' }, _growthReadyAtSec: 140 };
  const input = frame(120, [ready, actor('ally', 'gas_station')]);
  const before = structuredClone(input);
  const freeze = (value) => { if (!value || typeof value !== 'object') return; Object.values(value).forEach(freeze); Object.freeze(value); };
  freeze(input); tracker.observe(input);
  assert.deepEqual(input, before);
  const period = tracker.report().unfinished.find((row) => row.who === 'lone');
  assert.equal(period.initialActor.completed, 0); assert.equal(period.lastActor.completed, 1);
  assert.ok(period.initialActor.emptySlots.includes('head')); assert.ok(!period.lastActor.emptySlots.includes('head'));
  assert.equal(period.lastActor.growthReadyAt, 140);
  assert.deepEqual(period.reasons, ['growing', 'action_wait']);
  checks++; console.log('PASS frozen frames retain real equipment progress and wait reasons without mutation');
}
console.log(`TEAM_ISOLATION_TRACKER_CHECKS ${checks}/${checks}`);
