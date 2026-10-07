import { areSameTeam, getActorTeamId } from './teamRuntime';
import { estimateMovePower } from './movePowerRuntime';
import { getCombatSpaceId, shareCombatSpace } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';
import { captureMovementObjective } from './movementObjectiveRuntime.js';
import { chooseTeamResourceMove } from './teamResourceGoalRuntime.js';
import { chooseTeamPurchaseMove } from './teamPurchaseGoalRuntime.js';

const idOf = (actor) => String(actor?._id || actor?.id || '');
const alive = (actor) => actor && Number(actor.hp || 0) > 0 && !isDimensionRiftDefeated(actor);
const powerOf = (actor, estimatePower) => Math.max(1, Number(estimatePower(actor)) || 1);

function liveRoster(actor, roster) {
  const rows = new Map((Array.isArray(roster) ? roster : []).filter(alive).map((row) => [idOf(row), row]));
  // The active actor may have moved or healed since the phase snapshot.
  if (alive(actor)) rows.set(idOf(actor), actor);
  return [...rows.values()].filter((row) => idOf(row));
}

export function getLocalTeamCombatants(actor, roster, zoneId = actor?.zoneId) {
  const local = liveRoster(actor, roster).filter((row) => shareCombatSpace(actor, row) && String(row.zoneId || '') === String(zoneId || ''));
  const allies = local.filter((row) => areSameTeam(actor, row));
  if (alive(actor) && !allies.some((row) => idOf(row) === idOf(actor))) allies.push(actor);
  const enemies = local.filter((row) => !areSameTeam(actor, row));
  return { allies, enemies };
}

export function assessTeamCombat(actor, roster, { estimatePower = estimateMovePower, minRatio = 0.4, zoneId = actor?.zoneId } = {}) {
  const { allies, enemies } = getLocalTeamCombatants(actor, roster, zoneId);
  const allyPower = allies.reduce((sum, row) => sum + powerOf(row, estimatePower), 0);
  const enemyPower = enemies.reduce((sum, row) => sum + powerOf(row, estimatePower), 0);
  const powerRatio = enemyPower > 0 ? allyPower / Math.max(1, allyPower + enemyPower) : 1;
  const shouldAvoid = enemies.length > 0 && powerRatio < minRatio;
  return {
    allyCount: allies.length, enemyCount: enemies.length,
    allyPower: Math.round(allyPower), enemyPower: Math.round(enemyPower),
    powerRatio: Number(powerRatio.toFixed(3)), shouldAvoid,
    // Preserve the exact comparison used by the decision, before UI rounding.
    comparison: { scope: 'team', myP: allyPower, opP: enemyPower, ratio: powerRatio, minRatio },
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

// A known rally is a destination, not a search for a nearby retreat. Search
// the finite map for its safe route, but execute only the next adjacent step.
function regroupPathBlockReason(actor, target, zoneGraph, forbiddenIds) {
  const reachable = (forbidden) => {
    const queue = [String(actor.zoneId || '')], seen = new Set(queue);
    for (let i = 0; i < queue.length; i += 1) {
      if (queue[i] === target && !forbidden.has(target)) return true;
      for (const next of (zoneGraph[queue[i]] || []).map(String)) {
        if (!seen.has(next) && !forbidden.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    return false;
  };
  return reachable(forbiddenIds) ? 'enemy_path' : reachable(new Set()) ? 'forbidden_path' : 'disconnected';
}

// Enemy-free join routes can be checked with one bounded graph traversal per
// member. Do not repeatedly estimate combat power for every candidate/path.
// An unfinished farmer remains at its real recipe; this never orders it away.
function countRallyReachability(members, roster, zoneGraph, forbiddenIds, zones, stillGrowing) {
  const counts = new Map(zones.map(zone => [zone, 0]));
  if (zones.length < 2) return counts;
  const enemies = new Set(liveRoster(members[0], roster)
    .filter(row => shareCombatSpace(members[0], row) && !areSameTeam(members[0], row))
    .map(row => String(row.zoneId || '')));
  for (const actor of members) {
    const from = String(actor.zoneId || '');
    const queue = [from], seen = new Set(queue), growing = stillGrowing(actor);
    if (!zoneGraph[from]) continue;
    for (let i = 0; i < queue.length; i += 1) {
      const zone = queue[i];
      if (counts.has(zone) && !forbiddenIds.has(zone)) counts.set(zone, counts.get(zone) + 1);
      if (growing) break;
      for (const next of (zoneGraph[zone] || []).map(String)) {
        if (seen.has(next) || forbiddenIds.has(next) || enemies.has(next)) continue;
        seen.add(next); queue.push(next);
      }
    }
  }
  return counts;
}

export function buildTeamCoordination(options = {}) {
  const steps = buildTeamCoordinationSteps(options);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

// A squad shares a planning snapshot and remains one atomic decision. Yield
// between squads so a large roster cannot monopolize the browser task. The
// synchronous entry point drains these identical decisions in the same order.
export function* buildTeamCoordinationSteps({
  roster = [], zoneGraph = {}, forbiddenIds = new Set(), day = 1, phase = 'morning',
  estimatePower = estimateMovePower, chooseLeaderMove = () => null, maxDepth = 3, isSoloMatch = false,
  spawnState, ruleset, publicItems = [], getRotationHold = null,
  mapObj, kiosks = [],
} = {}) {
  const plans = new Map();
  const regroupDecisions = new Map();
  const result = { movementPlans: plans, regroupDecisions };
  if (isSoloMatch) return result;
  const groups = new Map();
  for (const actor of roster.filter(alive)) {
    const teamId = `${getCombatSpaceId(actor)}:${getActorTeamId(actor)}`;
    if (!groups.has(teamId)) groups.set(teamId, []);
    groups.get(teamId).push(actor);
  }
  const destinationDepth = Math.max(1, Object.keys(zoneGraph).length);
  for (const members of groups.values()) {
    yield;
    if (members.length < 2) continue;
    const managedGrowth = members.some((row) => row._growthPlan);
    const stillGrowing = (row) => row._growthPlan && !row._growthPlan.openingComplete && !row._growthPlan.blocked;
    // Managed actors use actual equipment readiness, not a day/index deadline.
    if (!managedGrowth && (Number(day) <= 1 || Number(day) === 2 && phase === 'morning' && members.some((row) =>
      Number(row.routePlanIndex || 0) < (row.routePlanZoneIds || []).length))) {
      for (const actor of members) regroupDecisions.set(idOf(actor), { version: 1, teamId: getActorTeamId(actor),
        memberCount: members.length, targetZoneId: '', atTargetCount: 0, nextStep: '', distance: null, stage: 'opening', blocked: '' });
      continue;
    }
    const ordered = [...members].sort((a, b) => Number(a.teamSlot || 99) - Number(b.teamSlot || 99) || idOf(a).localeCompare(idOf(b)));
    const safeMembers = ordered.filter((row) => !forbiddenIds.has(String(row.zoneId || '')));
    if (!safeMembers.length) continue;
    const zones = [...new Set(safeMembers.map((row) => String(row.zoneId)))];
    const metrics = new Map((zones.length > 1 ? zones : []).map(zone => [zone, {
      threat: assessTeamCombat(safeMembers[0], roster, { estimatePower, zoneId: zone }).enemyPower,
      farming: safeMembers.some(row => String(row.zoneId) === zone && stillGrowing(row)) ? 1 : 0,
      present: safeMembers.filter(row => String(row.zoneId) === zone).length,
      order: ordered.findIndex(row => String(row.zoneId) === zone),
    }]));
    const compare = (a, b, reachable, farmingRanks) => {
      const left = metrics.get(a), right = metrics.get(b);
      return left.threat - right.threat
        || (farmingRanks?.get(b) ?? right.farming) - (farmingRanks?.get(a) ?? left.farming)
        || (reachable?.get(b) || 0) - (reachable?.get(a) || 0)
        || right.present - left.present || left.order - right.order;
    };
    zones.sort((a, b) => compare(a, b));
    const previousRally = zones[0];
    const reachable = countRallyReachability(members, roster, zoneGraph, forbiddenIds, zones, stillGrowing);
    // Keep escorting an unfinished farmer whenever a teammate can safely
    // join it. An unreachable lone farmer must not prevent ready allies
    // from gathering elsewhere; its own real recipe is still left alone.
    // Compute ranks before sorting so the comparator never reads a changing array.
    const farmingRanks = zones.length > 1 ? new Map(zones.map(zone => [zone, metrics.get(zone).farming
      && ((reachable.get(zone) || 0) > 1 || !zones.some(candidate =>
        metrics.get(candidate).threat <= metrics.get(zone).threat && (reachable.get(candidate) || 0) > 1)) ? 1 : 0])) : null;
    zones.sort((a, b) => compare(a, b, reachable, farmingRanks));
    const rallyZone = zones[0];
    const rallySelection = rallyZone !== previousRally ? { reason: 'reachable_rendezvous',
      previousZoneId: previousRally, previousReachableCount: reachable.get(previousRally),
      reachableCount: reachable.get(rallyZone) } : null;
    const leader = safeMembers.find((row) => String(row.zoneId) === rallyZone);
    const separated = members.some((row) => String(row.zoneId) !== rallyZone);
    const grouped = !members.some(stillGrowing) && members.every((row) => String(row.zoneId) === rallyZone);
    // Synchronize only an already gathered, healthy squad in a safe region.
    // Opening farming, regrouping, danger/recovery and final-zone escape keep
    // their existing priorities; nobody is teleported or given a free action.
    const canWaitForRotation = grouped && getRotationHold && !spawnState?.endgame
      && members.every((row) => Number(row.hp) > Math.max(0, Number(ruleset?.ai?.recoverHpBelow ?? 38)))
      && assessTeamCombat(leader, roster, { estimatePower }).enemyCount === 0;
    const waitingFor = canWaitForRotation ? ordered.flatMap((row) => {
      const hold = getRotationHold(row);
      return hold ? [{ who: idOf(row), name: String(row.name || idOf(row)), ...hold }] : [];
    }) : [];
    const rotationWaiting = waitingFor.length > 0;
    const canPlanRecipe = grouped && !rotationWaiting && !spawnState?.endgame
      && members.every((row) => Number(row.hp) > Math.max(0, Number(ruleset?.ai?.recoverHpBelow ?? 38)))
      && !assessTeamCombat(leader, roster, { estimatePower, minRatio: Number(ruleset?.ai?.fightAvoidMinRatio ?? 0.4) }).shouldAvoid;
    const recipeRoute = (targetZoneId) => pickTeamSafeZone(leader, roster, zoneGraph, forbiddenIds,
      { estimatePower, maxDepth: destinationDepth, targetZoneId, travelParty: members });
    const teamResource = canPlanRecipe
      ? chooseTeamResourceMove({ members: ordered, spawnState, ruleset, publicItems,
        routeForZone: recipeRoute }) : null;
    const teamPurchase = canPlanRecipe && !teamResource
      ? chooseTeamPurchaseMove({ members: ordered, publicItems, ruleset, mapObj, kiosks, day, phase,
        forbiddenIds, routeForZone: recipeRoute }) : null;
    const proposed = grouped && !rotationWaiting ? teamResource || teamPurchase || chooseLeaderMove(leader) : null;
    const target = grouped && !rotationWaiting ? (proposed?.targets || []).find((zone) => !forbiddenIds.has(String(zone))) : rallyZone;
    if (!target) continue;
    const objective = grouped ? captureMovementObjective(proposed, target, { spawnState, ruleset, publicItems }) : null;
    for (const actor of members) {
      const decision = { version: 1, teamId: getActorTeamId(actor), memberCount: members.length,
        targetZoneId: rallyZone, atTargetCount: members.filter((row) => String(row.zoneId) === rallyZone).length,
        nextStep: '', distance: null, stage: rotationWaiting ? 'rotation_wait' : separated ? 'joining' : 'together', blocked: '',
        ...(rotationWaiting ? { waitingFor: waitingFor.map((row) => ({ ...row })) } : {}),
        ...(rallySelection ? { rallySelection: { ...rallySelection } } : {}) };
      // An unfinished farmer keeps its real recipe. Ready allies can join it;
      // the observer must be told why this actor is not following a rally yet.
      if (stillGrowing(actor)) {
        if (separated) decision.stage = 'growing';
        regroupDecisions.set(idOf(actor), decision);
        continue;
      }
      if (rotationWaiting) {
        regroupDecisions.set(idOf(actor), decision);
        continue;
      }
      // Recovery/forbidden-area escape are higher priorities at execution time.
      const route = pickTeamSafeZone(actor, roster, zoneGraph, forbiddenIds, {
        // A concrete spawned recipe source, like a rally, is a known destination.
        // Nearby retreat/wandering searches retain their configured depth.
        estimatePower, maxDepth: !grouped || teamResource || teamPurchase ? destinationDepth : maxDepth,
        targetZoneId: target, enemyFree: !grouped, travelParty: grouped ? members : [],
      });
      if (separated) {
        decision.stage = route ? (String(actor.zoneId) === rallyZone ? 'waiting' : 'joining') : 'path_blocked';
        decision.nextStep = route?.nextStep || '';
        decision.distance = route?.distance ?? null;
        if (!route) decision.blocked = regroupPathBlockReason(actor, rallyZone, zoneGraph, forbiddenIds);
      }
      regroupDecisions.set(idOf(actor), decision);
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
  return result;
}

// Preserve the movement-only API for callers that do not publish observation.
export function buildTeamMovementPlans(options) {
  return buildTeamCoordination(options).movementPlans;
}
