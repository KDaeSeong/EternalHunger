import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { getCombatSpaceId } = await import('../src/utils/combatSpaceLogic.js');
const { getActorGrowthProgress } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

// Read-only diagnosis of real engine frames. An isolation period ends on
// contact, death, a space change, or loss of all living teammates; none of
// those endings is silently counted as a successful regroup.
const seed = process.argv[2] || '2202';
const input = await createRandomIsolationInput(seed);
const fixture = JSON.parse(input);
const zoneNames = new Map(fixture.map.zones.map((zone) => [zone.zoneId, zone.name]));
const itemNames = new Map(fixture.items.map((item) => [String(item._id), item.name]));
const active = new Map(), finished = [];
const sameTeam = (a, b) => a.teamId === b.teamId && a._id !== b._id;
const summary = (actor) => {
  const progress = getActorGrowthProgress(actor, fixture.items), plan = actor._growthPlan;
  return { who: actor._id, name: actor.name, zone: actor.zoneId, zoneName: zoneNames.get(actor.zoneId),
    hp: actor.hp, maxHp: actor.maxHp, completed: progress.completedSlots, total: progress.totalSlots,
    target: plan?.targetName || '', blocked: plan?.blocked || '',
    growthZone: plan?.targetZoneId || '', readyCraft: itemNames.get(plan?.readyCraftId) || '',
    missing: (plan?.missing || []).map((row) => ({ name: row.name, need: row.need, zones: row.zones.map((id) => zoneNames.get(id) || id) })),
    regroup: actor._teamRegroup?.status || '', rally: actor._teamRegroup?.targetZoneId || '',
    action: actor.aiCurrentAction || '', growthReadyAt: actor._growthReadyAtSec, actionReadyAt: actor._actionReadyAtSec };
};
const result = await runRandomIsolationMatch(input, { onFrame(frame) {
  const allLiving = frame.survivors.filter((actor) => actor.hp > 0);
  const living = allLiving.filter((actor) => getCombatSpaceId(actor) === 'world');
  const isolated = new Set();
  for (const actor of living) {
    const allies = living.filter((row) => sameTeam(actor, row));
    if (!allies.length || allies.some((row) => row.zoneId === actor.zoneId)) continue;
    isolated.add(actor._id);
    if (!active.has(actor._id)) active.set(actor._id, { who: actor._id, name: actor.name,
      teamId: actor.teamId, start: frame.matchSec, snapshots: [], lastKey: '' });
    const period = active.get(actor._id);
    const row = { actor: summary(actor), allies: allies.map(summary) };
    // Keep discrete movement/growth/decision changes, not every HP sub-tick.
    const key = JSON.stringify([Math.floor(frame.matchSec / 20), actor.zoneId,
      row.actor.completed, row.actor.target, row.actor.blocked, row.actor.readyCraft,
      row.actor.missing, row.actor.regroup,
      row.allies.map((ally) => [ally.who, ally.zone, ally.completed, ally.regroup])]);
    if (key !== period.lastKey) {
      period.snapshots.push({ sec: frame.matchSec, ...row }); period.lastKey = key;
    }
  }
  for (const [id, period] of active) if (!isolated.has(id)) {
    const actor = allLiving.find((row) => row._id === id);
    const allies = actor ? allLiving.filter((row) => sameTeam(actor, row)) : [];
    const endReason = !actor ? 'death' : getCombatSpaceId(actor) !== 'world' ? 'space_change'
      : allies.some((row) => getCombatSpaceId(row) === 'world' && row.zoneId === actor.zoneId) ? 'contact'
        : allies.length ? 'teammates_outside_world' : 'last_living_member';
    const { lastKey, ...record } = period;
    finished.push({ ...record, end: frame.matchSec, duration: frame.matchSec - period.start,
      endReason, finalActor: actor ? summary(actor) : null });
    active.delete(id);
  }
} });
assert.equal(result.events.at(-1).kind, 'match_end');
const selected = finished.sort((a, b) => b.duration - a.duration).slice(0, 3);
for (const period of selected) {
  const teamIds = new Set(fixture.survivors.filter((actor) => actor.teamId === period.teamId).map((actor) => actor._id));
  period.events = result.events.filter((event) => event.at?.sec >= period.start && event.at.sec <= period.end
    && teamIds.has(event.who) && ['move', 'craft', 'field_resource', 'resource_replan'].includes(event.kind));
}
console.log(JSON.stringify({ seed, engineVersion: SIMULATION_ENGINE_VERSION, periods: selected,
  unfinished: [...active.values()].map(({ lastKey, ...row }) => row), evidence: result.evidence,
  scope: 'diagnostic only; real fixture traces, not evaluator reproduction or a success threshold' }));
