import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { describeObserverEvent, buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { describeCombatDecisionContext } = await import('../src/app/simulation/_lib/combatDecisionEvidenceRuntime.js');

const seed = process.argv[2] || '1101';
const input = await createRandomIsolationInput(seed);
let frameChecks = 0;
const frameSamples = new Set();
const result = await runRandomIsolationMatch(input, { onFrame(frame, { publicItems, events }) {
  const latest = [...events].reverse().find((event) => event.decisionEvidence);
  if (!latest) return;
  const key = [latest.kind, latest.decisionEvidence.reason, latest.retreatOutcome].join(':');
  if (frameSamples.has(key)) return;
  const who = [...frame.survivors, ...frame.dead].find((row) => String(row._id) === String(latest.who));
  if (!who) return;
  const model = buildTeamObserverModel({ ...frame, publicItems, events, teamId: who.teamId });
  const member = model.members.find((row) => row.id === String(latest.who));
  // The newest event can have been followed by a different valid decision in
  // this frame. Never force a discarded event to remain the current decision.
  if (member?.decision?.text !== describeObserverEvent(latest, {
    nameOf: (id) => [...frame.survivors, ...frame.dead].find((row) => String(row._id) === id)?.name || id,
  })) return;
  assert.ok(member.decision.text.includes(describeCombatDecisionContext(latest.decisionEvidence, latest.retreatOutcome)));
  frameSamples.add(key); frameChecks += 1;
} });

assert.equal(result.events.at(-1).kind, 'match_end');
const decisions = result.events.filter((event) => event.decisionEvidence);
assert.ok(decisions.length > 0 && frameChecks > 0);
const counts = {}, samples = [];
for (const event of decisions) {
  const e = event.decisionEvidence;
  assert.equal(e.version, 1); assert.equal(e.actor.id, String(event.who));
  assert.ok(e.actor.hp > 0 && e.actor.maxHp > 0);
  assert.ok(e.at.sec <= event.at.sec, 'The decision snapshot cannot come from the future.');
  for (const side of [e.allies, e.enemies]) {
    assert.equal(side.count, side.ids.length); assert.equal(new Set(side.ids).size, side.count);
    assert.ok(Number.isFinite(side.hp) && side.hp >= 0);
  }
  assert.ok(describeObserverEvent(event).includes(`내 HP ${Number(e.actor.hp.toFixed(1))}/${Number(e.actor.maxHp.toFixed(1))}`));
  const key = [event.kind, e.reason, event.retreatOutcome].join(':');
  if (!counts[key] && samples.length < 10) samples.push({ sec: event.at.sec, key, text: describeObserverEvent(event) });
  counts[key] = (counts[key] || 0) + 1;
}
const executions = result.events.filter((event) => event.kind === 'chase' || event.kind === 'retreat'
  || event.kind === 'move' && (/^flee:(?!forbidden)/.test(event.reason) || ['avoid_power', 'critical_flee', 'tac_blink_escape'].includes(event.reason)));
assert.ok(executions.length > 0);
assert.equal(executions.filter((event) => !event.decisionEvidence).length, 0, 'Actual retreat paths must carry decision evidence.');
assert.ok(decisions.some((event) => event.kind === 'queue'), 'The real movement-to-queue pipeline must retain the evidence.');
console.log(JSON.stringify({ pass: true, seed, decisions: decisions.length, executions: executions.length, frameChecks,
  counts, samples, evidence: result.evidence,
  scope: 'actual fixture match and observer-model coverage; not browser readability, original evaluator reproduction or balance acceptance' }, null, 2));
