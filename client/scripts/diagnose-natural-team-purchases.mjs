import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const { createRandomIsolationInput, runRandomIsolationMatch, buildIsolationNavigation } = await import('./lib/run-random-isolation-match.mjs');
const { chooseTeamPurchaseMove } = await import('../src/app/simulation/_lib/teamPurchaseGoalRuntime.js');
const { chooseTeamResourceMove } = await import('../src/app/simulation/_lib/teamResourceGoalRuntime.js');
const { pickTeamSafeZone, assessTeamCombat } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { getActorTeamId } = await import('../src/app/simulation/_lib/teamRuntime.js');
const { getCombatSpaceId, WORLD_COMBAT_SPACE } = await import('../src/utils/combatSpaceLogic.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { getActiveSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  assert.match(arg, /^--(seed|roster|output)=.+$/); const split = arg.indexOf('=');
  return [arg.slice(2, split), arg.slice(split + 1)];
}));
const input = await createRandomIsolationInput(options.seed || '1101', { initialRosterSeed: options.roster || 'FIXTURE:initial-roster' });
const initial = JSON.parse(input), navigation = buildIsolationNavigation(initial.map);
const ruleset = getRuleset(initial.settings.rulesetId, initial.settings.simulationRuleset);
const counts = {}, samples = [];
let previousSample = '';
const count = reason => { counts[reason] = (counts[reason] || 0) + 1; };
const result = await runRandomIsolationMatch(input, { phaseOnly: true, onFrame(frame) {
  // These are sampled committed frames, not the exact planner invocation log.
  // Do not reinterpret the counts as an exhaustive rejection trace.
  const key = `${frame.day}:${frame.phase}:${Math.floor(frame.matchSec / 20)}`;
  if (key === previousSample) return;
  previousSample = key;
  const source = getActiveSimulationRandom(), before = source?.getState();
  const roster = frame.survivors.filter(actor => actor.hp > 0 && getCombatSpaceId(actor) === WORLD_COMBAT_SPACE);
  const groups = new Map();
  for (const actor of roster) {
    const teamId = getActorTeamId(actor); if (!groups.has(teamId)) groups.set(teamId, []);
    groups.get(teamId).push(actor);
  }
  const forbiddenIds = new Set(frame.forbiddenZoneIds);
  for (const members of groups.values()) {
    if (members.length < 2) { count('single_living_world_member'); continue; }
    const ordered = [...members].sort((a, b) => a.teamSlot - b.teamSlot || a._id.localeCompare(b._id));
    const leader = ordered[0];
    const routeForZone = targetZoneId => pickTeamSafeZone(leader, roster, navigation.zoneGraph, forbiddenIds,
      { maxDepth: initial.map.zones.length, targetZoneId, travelParty: ordered });
    const purchase = chooseTeamPurchaseMove({ members: ordered, publicItems: initial.items, ruleset,
      mapObj: initial.map, kiosks: [], day: frame.day, phase: frame.phase, forbiddenIds, routeForZone });
    if (purchase) count('quote_available_before_coordination_gates');
    let reason;
    if (members.some(actor => !actor._growthPlan?.openingComplete)) reason = 'opening_or_recovery';
    else if (members.some(actor => actor.zoneId !== leader.zoneId)) reason = 'not_gathered';
    else if (forbiddenIds.has(leader.zoneId)) reason = 'forbidden_region';
    else if (frame.spawnState?.endgame) reason = 'endgame';
    else if (members.some(actor => actor.hp <= (ruleset.ai?.recoverHpBelow ?? 38))) reason = 'recovery_health';
    else if (members.some(actor => actor._wildlifeHunt || actor._pendingCharacterCast
      || actor._growthReadyAtSec > frame.matchSec || actor._actionReadyAtSec > frame.matchSec)) reason = 'action_or_hunt_hold';
    else if (assessTeamCombat(leader, roster, { minRatio: ruleset.ai?.fightAvoidMinRatio ?? 0.4 }).shouldAvoid) reason = 'local_power_danger';
    else {
      const resource = chooseTeamResourceMove({ members: ordered, publicItems: initial.items,
        spawnState: frame.spawnState, ruleset, routeForZone });
      reason = resource ? 'live_resource_preferred' : purchase ? 'payable_shared_candidate' : 'no_immediately_completable_quote';
    }
    count(reason);
    if (purchase && samples.length < 12) samples.push({ atSec: frame.matchSec, teamId: getActorTeamId(leader),
      reason, quotedReason: purchase.reason, members: ordered.map(actor => ({ who: actor._id,
        zoneId: actor.zoneId, credits: actor.simCredits, target: actor._growthPlan?.targetName,
        missing: actor._growthPlan?.missing })) });
  }
  assert.deepEqual(source?.getState(), before, 'Read-only purchase diagnostics cannot draw match randomness.');
} });
const plans = result.events.filter(event => event.reason === 'team_rotate' && /키오스크|구매|교환|kiosk/.test(event.sharedGoalReason || ''));
const report = { engineVersion: SIMULATION_ENGINE_VERSION, seed: initial.runSeed,
  initialRosterSeed: initial.initialRosterSeed, counts, samples, actualSharedPurchaseIntentions: plans.length,
  evidence: result.evidence, scope: 'unchanged ordinary guest match; read-only 20-second committed-frame samples, not exhaustive production planner rejections or forced natural coverage' };
if (options.output) writeFileSync(options.output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
