import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { getTeamSurvivalContext, getTeamSurvivalStates } = await import('../src/app/simulation/_lib/teamSurvivalObservationRuntime.js');
const { presentCombatHealth } = await import('../src/app/simulation/_lib/combatObservationRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

const seeds = process.argv.slice(2).length ? process.argv.slice(2) : ['2202', '1101'];
for (const seed of seeds) {
  const input = await createRandomIsolationInput(seed), fixture = JSON.parse(input);
  let inspected = 0, previousTeams = new Map(), transitions = 0, healthModelChecks = 0;
  const result = await runRandomIsolationMatch(input, { onFrame(frame, { publicItems, events }) {
    const states = getTeamSurvivalStates({ ...frame, ...getTeamSurvivalContext(fixture.settings, frame.day, frame.phase) });
    const fresh = events.slice(inspected); inspected = events.length;
    for (const state of states) {
      const previous = previousTeams.get(state.teamId);
      if (previous && previous.status !== state.status && state.participants.length >= 2) {
        const event = fresh.find((row) => row.kind === 'team_status' && row.teamId === state.teamId);
        assert.ok(event, `Missing team transition at ${frame.matchSec}: ${state.teamId} ${state.status}`);
        assert.equal(event.status, state.status); assert.equal(event.at.sec, frame.matchSec); transitions++;
      }
    }
    for (const event of fresh.filter((row) => row.kind === 'team_status')) {
      const state = states.find((row) => row.teamId === event.teamId);
      assert.equal(event.aliveCount, state.aliveCount); assert.equal(event.protectedCount, state.protectedCount);
      assert.equal(event.status, state.status); assert.equal(event.at.sec, frame.matchSec);
      const model = buildTeamObserverModel({ ...frame, settings: fixture.settings, events, publicItems, teamId: event.teamId });
      assert.ok(model.turningPoints.some((row) => row.kind === 'team_status' && row.sec === event.at.sec));
      if (event.status === 'revival_pending') assert.match(model.status, /부활 대기/);
      if (event.status === 'eliminated') assert.match(model.status, /최종 탈락/);
    }
    const latestBattle = fresh.findLast((row) => row.kind === 'battle');
    if (latestBattle && healthModelChecks < 12) {
      const member = [...frame.survivors, ...frame.dead].find((row) => row._id === latestBattle.a);
      const model = buildTeamObserverModel({ ...frame, settings: fixture.settings, events, publicItems, teamId: member.teamId });
      assert.ok(model.combat.some((row) => row.sec === latestBattle.at.sec)); healthModelChecks++;
    }
    previousTeams = new Map(states.map((row) => [row.teamId, row]));
  } });
  const battles = result.events.filter((row) => row.kind === 'battle');
  const damages = result.events.filter((row) => row.kind === 'damage');
  const teamEvents = result.events.filter((row) => row.kind === 'team_status');
  assert.ok(battles.length > 0 && damages.length > 0 && transitions > 0 && healthModelChecks > 0);
  for (const battle of battles) assert.ok(presentCombatHealth(battle), `Missing battle health ${battle.a} → ${battle.b}`);
  for (const damage of damages) {
    assert.ok(Number.isFinite(damage.hpBefore) && Number.isFinite(damage.hpAfter));
    assert.ok(damage.maxHpBefore > 0 && damage.maxHpAfter > 0);
    assert.ok(Math.abs(damage.hpBefore - damage.hpAfter - damage.hpDamage) < 1e-6);
  }
  const teamStates = {};
  for (const row of teamEvents) teamStates[row.status] = (teamStates[row.status] || 0) + 1;
  console.log(JSON.stringify({ pass: true, engineVersion: SIMULATION_ENGINE_VERSION, seed,
    battles: battles.length, damagePackets: damages.length, healthModelChecks, transitions, teamStates,
    evidence: result.evidence,
    scope: 'Actual deterministic fixture matches, committed frame/team-event agreement and observer model. Not original evaluator reproduction, human readability or browser rendering evidence.' }));
}
