import { getCombatSpaceId } from '../../src/utils/combatSpaceLogic.js';
import { getActorGrowthProgress } from '../../src/app/simulation/_lib/growthPlanRuntime.js';

// Read-only frame diagnostics. Ending isolation is NOT synonymous with regroup:
// death, rift entry, and losing the last teammate must remain separate outcomes.
export function createTeamIsolationTracker({ items = [], zones = [], captureSnapshots = false } = {}) {
  const zoneNames = new Map(zones.map((zone) => [zone.zoneId, zone.name]));
  const itemNames = new Map(items.map((item) => [String(item._id), item.name]));
  const active = new Map(), finished = [];
  let lastSec = 0;
  const sameTeam = (a, b) => a.teamId === b.teamId && String(a._id) !== String(b._id);
  const describe = (actor) => {
    const progress = getActorGrowthProgress(actor, items), plan = actor._growthPlan;
    return { who: String(actor._id), name: actor.name, zone: actor.zoneId, zoneName: zoneNames.get(actor.zoneId),
      hp: actor.hp, maxHp: actor.maxHp, completed: progress.completedSlots, total: progress.totalSlots,
      emptySlots: ['weapon', 'head', 'clothes', 'arm', 'shoes'].filter((slot) => !actor.equipped?.[slot]),
      target: plan?.targetName || '', blocked: plan?.blocked || '', growthZone: plan?.targetZoneId || '',
      readyCraft: itemNames.get(plan?.readyCraftId) || '',
      missing: (plan?.missing || []).map((row) => ({ name: row.name, need: row.need,
        zones: (row.zones || []).map((id) => zoneNames.get(id) || id) })),
      regroup: actor._teamRegroup?.status || '', rally: actor._teamRegroup?.targetZoneId || '',
      action: actor.aiCurrentAction || '', growthReadyAt: actor._growthReadyAtSec, actionReadyAt: actor._actionReadyAtSec };
  };
  const finish = (period, sec, endReason, finalActor) => {
    const { lastKey, reasons, ...record } = period;
    return { ...record, reasons: [...reasons], end: sec,
      duration: Number((sec - period.start).toFixed(6)), endReason, finalActor };
  };
  function observe(frame) {
    lastSec = frame.matchSec;
    const allLiving = frame.survivors.filter((actor) => actor.hp > 0);
    const living = allLiving.filter((actor) => getCombatSpaceId(actor) === 'world');
    const isolated = new Set();
    for (const actor of living) {
      const allies = living.filter((row) => sameTeam(actor, row));
      if (!allies.length || allies.some((row) => row.zoneId === actor.zoneId)) continue;
      const id = String(actor._id), description = describe(actor);
      isolated.add(id);
      if (!active.has(id)) active.set(id, { who: id, name: actor.name, teamId: actor.teamId,
        start: frame.matchSec, initialActor: description, reasons: new Set(),
        ...(captureSnapshots ? { snapshots: [] } : {}), lastKey: '' });
      const period = active.get(id);
      period.lastActor = description;
      period.reasons.add(actor._teamRegroup?.status || 'no_current_regroup_record');
      if (captureSnapshots) {
        const row = { actor: description, allies: allies.map(describe) };
        // Discrete changes/20-second samples, not every combat HP sub-tick.
        const key = JSON.stringify([Math.floor(frame.matchSec / 20), actor.zoneId, description.completed,
          description.target, description.blocked, description.readyCraft, description.missing, description.regroup,
          row.allies.map((ally) => [ally.who, ally.zone, ally.completed, ally.regroup])]);
        if (key !== period.lastKey) { period.snapshots.push({ sec: frame.matchSec, ...row }); period.lastKey = key; }
      }
    }
    for (const [id, period] of active) if (!isolated.has(id)) {
      const actor = allLiving.find((row) => String(row._id) === id);
      const allies = actor ? allLiving.filter((row) => sameTeam(actor, row)) : [];
      const endReason = !actor ? 'death' : getCombatSpaceId(actor) !== 'world' ? 'space_change'
        : allies.some((row) => getCombatSpaceId(row) === 'world' && row.zoneId === actor.zoneId) ? 'contact'
          : allies.length ? 'teammates_outside_world' : 'last_living_member';
      const finalActor = actor || (frame.dead || []).find((row) => String(row._id) === id);
      finished.push(finish(period, frame.matchSec, endReason, finalActor ? describe(finalActor) : null));
      active.delete(id);
    }
  }
  function report(sec = lastSec) {
    return structuredClone({ finished, unfinished: [...active.values()]
      .map((period) => finish(period, sec, 'still_isolated', null)) });
  }
  return { observe, report, describe };
}
