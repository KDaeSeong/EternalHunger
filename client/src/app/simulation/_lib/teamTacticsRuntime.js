import { areSameTeam, getActorTeamId } from './teamRuntime';
import { estimateMovePower } from './movePowerRuntime';
import { getCombatSpaceId, shareCombatSpace } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';
import { captureMovementObjective } from './movementObjectiveRuntime.js';

const idOf = (actor) => String(actor?._id || actor?.id || '');
const alive = (actor) => actor && Number(actor.hp || 0) > 0 && !isDimensionRiftDefeated(actor);
const powerOf = (actor, estimatePower) => Math.max(1, Number(estimatePower(actor)) || 1);

function liveRoster(actor, roster) {
  const rows = new Map((Array.isArray(roster) ? roster : []).filter(alive).map((row) => [idOf(row), row]));
  // The active actor may have moved or healed since the phase snapshot.
  if (alive(actor)) rows.set(idOf(actor), actor);
  return [...rows.values()].filter((row) => idOf(row));
}

export function assessTeamCombat(actor, roster, { estimatePower = estimateMovePower, minRatio = 0.4, zoneId = actor?.zoneId } = {}) {
  const local = liveRoster(actor, roster).filter((row) => shareCombatSpace(actor, row) && String(row.zoneId || '') === String(zoneId || ''));
  const allies = local.filter((row) => areSameTeam(actor, row));
  if (alive(actor) && !allies.some((row) => idOf(row) === idOf(actor))) allies.push(actor);
  const enemies = local.filter((row) => !areSameTeam(actor, row));
  const allyPower = allies.reduce((sum, row) => sum + powerOf(row, estimatePower), 0);
  const enemyPower = enemies.reduce((sum, row) => sum + powerOf(row, estimatePower), 0);
  const powerRatio = enemyPower > 0 ? allyPower / Math.max(1, allyPower + enemyPower) : 1;
  const shouldAvoid = enemies.length > 0 && powerRatio < minRatio;
  return {
    allyCount: allies.length, enemyCount: enemies.length,
    allyPower: Math.round(allyPower), enemyPower: Math.round(enemyPower),
    powerRatio: Number(powerRatio.toFixed(3)), shouldAvoid,
    reason: shouldAvoid ? (enemies.length > allies.length ? 'team_outnumbered' : 'team_power_gap') : '',
  };
}

// Evaluate the path, not just its endpoint. A safe destination behind a more
// dangerous enemy zone is not a valid retreat. No synthetic teleport fallback.
export function pickTeamSafeZone(actor, roster, zoneGraph, forbiddenIds = new Set(), {
  estimatePower = estimateMovePower, maxDepth = 3, targetZoneId = '', enemyFree = false, travelParty = [], allowStay = true,
  excludedZoneIds = [],
} = {}) {
  const from = String(actor?.zoneId || '');
  const forbidden = forbiddenIds instanceof Set ? forbiddenIds : new Set(forbiddenIds || []);
  const excluded = excludedZoneIds instanceof Set ? excludedZoneIds : new Set(excludedZoneIds || []);
  if (!from || !zoneGraph?.[from]) return null;
  const current = assessTeamCombat(actor, roster, { estimatePower });
  const pressure = (info) => info.enemyPower / Math.max(1, info.allyPower);
  const maxPressure = enemyFree ? 0 : Math.max(1, pressure(current));
  const queue = [{ zoneId: from, nextStep: from, distance: 0, assessment: current }];
  const seen = new Set([from]);
  const candidates = [];
  for (let index = 0; index < queue.length; index += 1) {
    const row = queue[index];
    if (!forbidden.has(row.zoneId) && !excluded.has(row.zoneId) && (allowStay || row.distance > 0)) candidates.push(row);
    if (row.distance >= maxDepth) continue;
    for (const value of [...(zoneGraph[row.zoneId] || [])].map(String).sort()) {
      if (!value || seen.has(value) || forbidden.has(value) || excluded.has(value)) continue;
      const partyIds = new Set(travelParty.map(idOf));
      const arrivingRoster = partyIds.size ? roster.map((member) => partyIds.has(idOf(member)) ? { ...member, zoneId: value } : member) : roster;
      const assessment = assessTeamCombat(actor, arrivingRoster, { estimatePower, zoneId: value });
      if (pressure(assessment) > maxPressure) continue;
      seen.add(value);
      queue.push({ zoneId: value, nextStep: row.distance === 0 ? value : row.nextStep, distance: row.distance + 1, assessment });
    }
  }
  if (targetZoneId) return candidates.find((row) => row.zoneId === String(targetZoneId)) || null;
  candidates.sort((a, b) => pressure(a.assessment) - pressure(b.assessment)
    || b.assessment.allyCount - a.assessment.allyCount
    || a.distance - b.distance || a.zoneId.localeCompare(b.zoneId));
  return candidates[0] || null;
}

export function buildTeamMovementPlans({
  roster = [], zoneGraph = {}, forbiddenIds = new Set(), day = 1, phase = 'morning',
  estimatePower = estimateMovePower, chooseLeaderMove = () => null, maxDepth = 3, isSoloMatch = false,
  spawnState, ruleset, publicItems = [],
} = {}) {
  const plans = new Map();
  if (isSoloMatch) return plans;
  const groups = new Map();
  for (const actor of roster.filter(alive)) {
    const teamId = `${getCombatSpaceId(actor)}:${getActorTeamId(actor)}`;
    if (!groups.has(teamId)) groups.set(teamId, []);
    groups.get(teamId).push(actor);
  }
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const managedGrowth = members.some((row) => row._growthPlan);
    const stillGrowing = (row) => row._growthPlan && !row._growthPlan.openingComplete && !row._growthPlan.blocked;
    // Managed actors use actual equipment readiness, not a day/index deadline.
    if (!managedGrowth && Number(day) <= 1) continue;
    if (!managedGrowth && Number(day) === 2 && phase === 'morning' && members.some((row) =>
      Number(row.routePlanIndex || 0) < (row.routePlanZoneIds || []).length)) continue;
    const ordered = [...members].sort((a, b) => Number(a.teamSlot || 99) - Number(b.teamSlot || 99) || idOf(a).localeCompare(idOf(b)));
    const safeMembers = ordered.filter((row) => !forbiddenIds.has(String(row.zoneId || '')));
    if (!safeMembers.length) continue;
    const zones = [...new Set(safeMembers.map((row) => String(row.zoneId)))];
    zones.sort((a, b) => {
      const at = (zone) => safeMembers.filter((row) => String(row.zoneId) === zone).length;
      const threat = (zone) => assessTeamCombat(safeMembers[0], roster, { estimatePower, zoneId: zone }).enemyPower;
      const farmingAt = (zone) => safeMembers.some((row) => String(row.zoneId) === zone && stillGrowing(row)) ? 1 : 0;
      return threat(a) - threat(b) || farmingAt(b) - farmingAt(a) || at(b) - at(a)
        || zonesOrder(a) - zonesOrder(b);
    });
    function zonesOrder(zone) { return ordered.findIndex((row) => String(row.zoneId) === zone); }
    const rallyZone = zones[0];
    const leader = safeMembers.find((row) => String(row.zoneId) === rallyZone);
    const grouped = !members.some(stillGrowing) && members.every((row) => String(row.zoneId) === rallyZone);
    const proposed = grouped ? chooseLeaderMove(leader) : null;
    const target = grouped ? (proposed?.targets || []).find((zone) => !forbiddenIds.has(String(zone))) : rallyZone;
    if (!target) continue;
    const objective = grouped ? captureMovementObjective(proposed, target, { spawnState, ruleset, publicItems }) : null;
    for (const actor of members) {
      if (stillGrowing(actor)) continue;
      // Recovery/forbidden-area escape are higher priorities at execution time.
      const route = pickTeamSafeZone(actor, roster, zoneGraph, forbiddenIds, {
        estimatePower, maxDepth, targetZoneId: target, enemyFree: !grouped, travelParty: grouped ? members : [],
      });
      if (!route) continue;
      plans.set(idOf(actor), {
        mode: grouped ? 'team_rotate' : 'team_regroup', leaderId: idOf(leader),
        targetZoneId: String(target), nextStep: route.nextStep, memberCount: members.length,
        objectiveType: String(proposed?.objectiveType || ''),
        objectiveSubkind: String(proposed?.objectiveSubkind || ''),
        // Keep the leader's actual choice separate from the coordination mode.
        // This is presentation metadata, not an objective/action score flag.
        sourceReason: String(proposed?.reason || ''),
        objective,
        contestPressure: Math.max(0, Number(proposed?.contestPressure || 0)),
      });
    }
  }
  return plans;
}
