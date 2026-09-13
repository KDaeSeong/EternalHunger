import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { summarizeTeamRetreats } from './lib/match-distribution-diagnostics.mjs';

const { buildSimulationDiagnostics } = await import('../src/app/simulation/_lib/simulationDiagnostics.js');
const { buildRunActionSummary } = await import('../src/app/simulation/_lib/runActionSummary.js');
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');

const requestedSeeds = process.argv.slice(2).map(String).filter(Boolean);
const seeds = requestedSeeds.length ? requestedSeeds : ['1101', '1102', '1103'];

function ratio(part, total) {
  return total > 0 ? Math.round(part / total * 1000) / 1000 : 0;
}

function summarizeMovement(initialActors, events) {
  const paths = new Map((initialActors || []).map((actor) => [String(actor._id || ''), [String(actor.zoneId || '')]]));
  const reversalsByReason = {};
  const reversalsByActor = {};
  const reversalPairs = {};
  const reversalSamples = [];
  const lastMoveByActor = new Map();
  let reversals = 0;
  let moves = 0;
  for (const event of events) {
    if (event?.kind !== 'move' || !event?.who || !event?.to) continue;
    const id = String(event.who);
    const path = paths.get(id) || [String(event.from || '')];
    const previous = path[path.length - 1] || String(event.from || '');
    const beforePrevious = path[path.length - 2] || '';
    const next = String(event.to || '');
    if (beforePrevious && next === beforePrevious && previous !== next) {
      reversals += 1;
      const reason = String(event?.reason || 'unknown');
      const priorReason = String(lastMoveByActor.get(id)?.reason || 'unknown');
      reversalsByReason[reason] = (reversalsByReason[reason] || 0) + 1;
      reversalsByActor[id] = (reversalsByActor[id] || 0) + 1;
      const pair = `${priorReason}->${reason}`;
      reversalPairs[pair] = (reversalPairs[pair] || 0) + 1;
      if (reversalSamples.length < 8) reversalSamples.push({
        actorId: id,
        atSec: Number(event?.at?.sec ?? event?.sec ?? 0),
        from: String(event.from || previous),
        to: next,
        priorReason,
        reason,
      });
    }
    path.push(next);
    paths.set(id, path);
    lastMoveByActor.set(id, event);
    moves += 1;
  }
  return {
    moves,
    reversals,
    reversalShare: ratio(reversals, moves),
    reversalsByReason,
    reversalPairs,
    reversalSamples,
    topReversalActors: Object.entries(reversalsByActor).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5),
  };
}

function summarizeHunts(events) {
  const starts = events.filter((event) => event?.kind === 'hunt_start');
  const ends = events.filter((event) => event?.kind === 'hunt_end');
  const settlements = events.filter((event) => event?.kind === 'hunt_settlement');
  const outcomes = {};
  for (const event of ends) {
    const key = String(event?.outcome || 'unknown');
    outcomes[key] = (outcomes[key] || 0) + 1;
  }
  const idsOf = (rows) => rows.map((event) => String(event.encounterId || '')).filter(Boolean);
  const startIdList = idsOf(starts);
  const endIdList = idsOf(ends);
  const settlementIdList = idsOf(settlements);
  const startIds = new Set(startIdList);
  const endIds = new Set(endIdList);
  const settlementIds = new Set(settlementIdList);
  assert.equal(startIdList.length, starts.length, 'Every hunt_start must carry an encounterId.');
  assert.equal(endIdList.length, ends.length, 'Every hunt_end must carry an encounterId.');
  assert.equal(settlementIdList.length, settlements.length, 'Every hunt_settlement must carry an encounterId.');
  assert.equal(startIds.size, starts.length, 'Each encounter may emit hunt_start only once.');
  assert.equal(endIds.size, ends.length, 'Each encounter may emit hunt_end only once.');
  assert.equal(settlementIds.size, settlements.length, 'Each encounter may settle only once.');
  assert.deepEqual([...endIds].filter((id) => !startIds.has(id)), [], 'hunt_end must reference a started encounter.');
  assert.deepEqual([...settlementIds].filter((id) => !startIds.has(id)), [], 'hunt_settlement must reference a started encounter.');
  const expectedSettlementIds = new Set(ends.filter((event) => ['victory', 'hunter_defeated'].includes(String(event?.outcome || '')))
    .map((event) => String(event.encounterId || '')).filter(Boolean));
  assert.deepEqual([...settlementIds].sort(), [...expectedSettlementIds].sort(),
    'Only completed victories and hunter defeats settle, exactly once.');
  const unfinished = [...startIds].filter((id) => !endIds.has(id));
  assert.deepEqual(unfinished, [], 'Every started hunt must end before the match snapshot closes.');
  return {
    starts: starts.length,
    ends: ends.length,
    settlements: settlements.length,
    outcomes,
    unfinished: unfinished.length,
    integrity: 'pass',
  };
}

function summarizeGrowth(events, participantCount) {
  const completeIds = new Set(events.filter((event) => event?.kind === 'growth_plan'
    && Number(event.totalSlots || 0) > 0 && Number(event.completedSlots || 0) === Number(event.totalSlots || 0))
    .map((event) => String(event.who || '')).filter(Boolean));
  const crafts = events.filter((event) => event?.kind === 'craft').length;
  return { complete: completeIds.size, total: participantCount, completeShare: ratio(completeIds.size, participantCount), crafts };
}

function summarizeEquipment(equipment) {
  const actors = Array.isArray(equipment?.actors) ? equipment.actors : [];
  const tierCounts = equipment?.tierCounts || {};
  const tierParts = [1, 2, 3, 4, 5, 6].reduce((sum, tier) => sum + Number(tierCounts[`t${tier}`] || 0), 0);
  const tierScore = [1, 2, 3, 4, 5, 6].reduce((sum, tier) => sum + tier * Number(tierCounts[`t${tier}`] || 0), 0);
  return {
    totalEquipped: Number(equipment?.totalEquipped || 0),
    fullLoadouts: actors.filter((actor) => Number(actor?.equippedCount || 0) >= 5).length,
    heroParts: actors.reduce((sum, actor) => sum + Number(actor?.heroOrBetter || 0), 0),
    legendaryParts: actors.reduce((sum, actor) => sum + Number(actor?.legendOrBetter || 0), 0),
    averageTier: tierParts ? Math.round(tierScore / tierParts * 1000) / 1000 : 0,
    tierCounts,
  };
}

const rows = [];
for (const seed of seeds) {
  const input = await createRandomIsolationInput(seed);
  const initial = JSON.parse(input);
  const match = await runRandomIsolationMatch(input, { phaseOnly: true });
  const frame = match.finalFrame || {};
  const diagnostics = buildSimulationDiagnostics({
    runEvents: match.events,
    survivors: frame.survivors,
    dead: frame.dead,
    itemMetaById: Object.fromEntries((initial.items || []).map((item) => [String(item._id || ''), item])),
  });
  const actions = buildRunActionSummary(match.events);
  const row = {
    seed,
    phases: match.evidence.phases,
    endingAtSec: match.evidence.ending.atSec,
    outcome: match.evidence.ending.outcome,
    winnerTeamId: match.evidence.ending.winnerTeamId,
    events: match.events.length,
    participants: diagnostics.participants,
    deaths: diagnostics.deaths,
    heroGearReady: diagnostics.equipment.heroGearReadyCount,
    legendaryReady: diagnostics.equipment.legendaryReadyCount,
    equipment: summarizeEquipment(diagnostics.equipment),
    growth: summarizeGrowth(match.events, diagnostics.participants.total),
    actionMix: actions.growth,
    team: actions.team,
    teamRetreats: summarizeTeamRetreats(match.events),
    teamCombat: actions.teamCombat,
    chase: diagnostics.chase,
    resources: actions.fieldResources,
    movement: summarizeMovement(initial.survivors, match.events),
    hunts: summarizeHunts(match.events),
  };
  rows.push(row);
  console.log(`MATCH_DISTRIBUTION_ROW ${JSON.stringify(row)}`);
}

const total = (pick) => rows.reduce((sum, row) => sum + Number(pick(row) || 0), 0);
const aggregate = {
  seeds,
  matches: rows.length,
  endingAtSec: {
    min: Math.min(...rows.map((row) => row.endingAtSec)),
    max: Math.max(...rows.map((row) => row.endingAtSec)),
    avg: Math.round(total((row) => row.endingAtSec) / rows.length * 1000) / 1000,
  },
  deaths: {
    total: total((row) => row.deaths.total),
    pvp: total((row) => row.deaths.pvp),
    wildlife: total((row) => row.deaths.wildlife),
    environment: total((row) => row.deaths.environment),
    opening: total((row) => row.deaths.byBand?.opening),
    early: total((row) => row.deaths.byBand?.early),
    mid: total((row) => row.deaths.byBand?.mid),
    end: total((row) => row.deaths.byBand?.end),
  },
  growthCompleteShare: ratio(total((row) => row.growth.complete), total((row) => row.growth.total)),
  heroGearReadyShare: ratio(total((row) => row.heroGearReady), total((row) => row.participants.total)),
  teamCombatRounds: total((row) => row.teamCombat.rounds),
  regroupMoves: total((row) => row.team.regroupMoves),
  regroupHolds: total((row) => row.team.regroupHolds),
  retreats: total((row) => row.team.retreats),
  teamRetreatEvents: total((row) => row.teamRetreats.total),
  teamRetreatReversals: total((row) => row.teamRetreats.reversals),
  restActions: total((row) => row.actionMix.rest),
  chaseCaughtShare: ratio(total((row) => row.chase.caught), total((row) => row.chase.total)),
  movementReversalShare: ratio(total((row) => row.movement.reversals), total((row) => row.movement.moves)),
  huntStarts: total((row) => row.hunts.starts),
  huntUnfinished: total((row) => row.hunts.unfinished),
};
console.log(`MATCH_DISTRIBUTION_AGGREGATE ${JSON.stringify(aggregate)}`);
