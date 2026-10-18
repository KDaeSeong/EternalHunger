import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { createRandomIsolationInput } = await import('./lib/run-random-isolation-match.mjs');
const { assertFormationRosterConsistency, buildFormationExposure, buildTacticalExposure, buildTacticalExposurePair, createFormationSwapInput,
  validateStrategyVariants } = await import('./lib/strategy-comparison-contracts.mjs');
const { TACTICAL_EFFECT_SCHEMA } = await import('../src/app/simulation/_lib/tacticalEffectEvidenceRuntime.js');
const { runPhaseCombatEncounter } = await import('../src/app/simulation/_lib/phaseCombatEncounterRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');

let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };
const checkAsync = async (name, run) => { await run(); checks += 1; console.log(`PASS ${name}`); };
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const actors = Array.from({ length: 6 }, (_, index) => ({ _id: `actor-${index}`, name: `대원${index}`,
  teamId: `team:${Math.floor(index / 3) + 1}`, teamName: `${Math.floor(index / 3) + 1}팀`,
  matchTeamId: `team:${Math.floor(index / 3) + 1}`, matchTeamName: `${Math.floor(index / 3) + 1}팀`,
  teamSlot: index % 3 + 1, matchTeamSlot: index % 3 + 1, matchTeamSize: 3, teamOriginalSize: 3,
  matchTeamCapacity: 3, tacticalSkill: '치유의 바람', hp: 70 + index, zoneId: `zone-${index}`,
  simCredits: 10 + index, inventory: [{ itemId: `material-${index}`, qty: index + 1 }],
  stats: { attackPower: 20 + index }, _customState: { value: index },
}));
for (const actor of actors) {
  const members = actors.filter(other => other.teamId === actor.teamId);
  actor.matchTeamRosterIds = members.map(other => other._id);
  actor.matchTeamRosterNames = members.map(other => other.name);
}
const input = freeze({ runSeed: 'owned-seed', map: { zones: [{ zoneId: 'zone-0' }] },
  publicItems: [{ _id: 'owned-catalog' }], initialFrame: { survivors: actors, spawnState: { preserved: true } } });

check('baseline-only, duplicate and unknown variants cannot pass a strategy comparison', () => {
  for (const variants of [['baseline'], ['baseline', 'baseline'], ['baseline', 'unknown'], ['one-tactical-skill', 'baseline']]) {
    assert.throws(() => validateStrategyVariants(variants));
  }
  validateStrategyVariants(['baseline', 'one-tactical-skill', 'one-formation-swap']);
});
check('strategy runner forwards an explicit roster seed and records the actual generated seed', () => {
  const source = readFileSync(new URL('./analyze-strategy-comparison.mjs', import.meta.url), 'utf8');
  assert.match(source, /\^--\(seeds\|output\|variants\|repeats\|roster-seed\)=/,
    'The CLI contract must admit the explicit --roster-seed=<identifier> option.');
  assert.match(source, /createRandomIsolationInput\(seed,\s*options\.rosterSeed === undefined \? \{\} : \{ initialRosterSeed: options\.rosterSeed \}\)/,
    'The selected roster seed must be passed into the actual fresh-input generator; omission must keep generator defaults.');
  assert.match(source, /rosterSeed:\s*options\.rosterSeed \?\? null/,
    'The selected CLI value must be included in incremental output and the final result.');
  assert.match(source, /startingInputs\.push\(\{ seed, initialRosterSeed, inputDigest/,
    'Each starting input must record the generator-returned roster seed.');
  assert.match(source, /const observation = \{ seed, initialRosterSeed, variant/,
    'Each actual execution must record the generator-returned roster seed.');
});
await checkAsync('distinct roster seeds reach the fresh roster generator while the unspecified default stays intact', async () => {
  const runSeed = 'same-in-match-seed';
  const generated = await Promise.all([
    createRandomIsolationInput(runSeed),
    createRandomIsolationInput(runSeed, { initialRosterSeed: 'strategy-roster-axis-a' }),
    createRandomIsolationInput(runSeed, { initialRosterSeed: 'strategy-roster-axis-b' }),
  ]).then(rows => rows.map(JSON.parse));
  assert.equal(generated[0].initialRosterSeed, 'FIXTURE:initial-roster');
  assert.equal(generated[1].initialRosterSeed, 'strategy-roster-axis-a');
  assert.equal(generated[2].initialRosterSeed, 'strategy-roster-axis-b');
  assert.ok(new Set(generated.map(row => JSON.stringify(row.survivors.map(actor => actor._id)))).size > 1,
    'The explicit roster seed must reach roster generation, not just be copied into metadata.');
  assert.deepEqual(generated.map(row => row.runSeed), [runSeed, runSeed, runSeed],
    'Changing the roster seed must not alter the in-match random seed.');
});
check('formation swaps rebuild snapshots for every affected teammate', () => {
  const out = createFormationSwapInput(input);
  assert.equal(out.changes.length, 2); assert.equal(out.derivedChanges.length, 12);
  assertFormationRosterConsistency(out.input);
  assert.deepEqual(out.input.initialFrame.survivors[0].matchTeamRosterIds, ['actor-0', 'actor-2', 'actor-4']);
  assert.deepEqual(out.input.initialFrame.survivors[3].matchTeamRosterIds, ['actor-1', 'actor-3', 'actor-5']);
  assert.deepEqual(input.initialFrame.survivors[0].matchTeamRosterIds, ['actor-0', 'actor-1', 'actor-2']);
});
check('formation changes preserve all owned non-team starting data and do not alias input', () => {
  const out = createFormationSwapInput(input);
  for (const [index, actor] of out.input.initialFrame.survivors.entries()) {
    for (const key of ['hp', 'zoneId', 'simCredits', 'inventory', 'stats', '_customState', 'teamSlot', 'matchTeamSlot']) {
      assert.deepEqual(actor[key], actors[index][key]);
    }
  }
  out.input.publicItems[0]._id = 'changed-copy';
  assert.equal(input.publicItems[0]._id, 'owned-catalog');
});
check('stale snapshots, same-team swaps and mismatched slots are rejected', () => {
  const stale = structuredClone(input); stale.initialFrame.survivors[0].matchTeamRosterIds = ['actor-4'];
  assert.throws(() => createFormationSwapInput(stale));
  assert.throws(() => createFormationSwapInput(input, 0, 1));
  assert.throws(() => createFormationSwapInput(input, 0, 4));
});
check('implicit solo IDs, conflicting team labels or decision/display slots are rejected', () => {
  for (const alter of [
    actor => { delete actor.teamId; delete actor.matchTeamId; },
    actor => { actor.matchTeamName = '다른 이름'; },
    actor => { actor.matchTeamSlot = 3; },
    actor => { actor.teamSlot = 0; actor.matchTeamSlot = 0; },
    actor => { actor.teamSlot = 2; actor.matchTeamSlot = 2; },
  ]) {
    const malformed = structuredClone(input); alter(malformed.initialFrame.survivors[0]);
    assert.throws(() => assertFormationRosterConsistency(malformed));
  }
});

const activation = (extra = {}) => ({ kind: 'skill', source: 'tactical', who: 'actor-0', skill: '치유의 바람',
  mode: 'combat_attack', at: { sec: 10 }, tacticalEffect: { schema: TACTICAL_EFFECT_SCHEMA, level: 1,
    hpBefore: 70, hpAfter: 78, hpSpent: 0, hpRecovered: 8, cooldownBefore: 0, cooldownUntil: 60,
    damageBefore: 10, damageAfter: 10, damagePrevented: 0, damageAdded: 0, existingShieldAbsorbed: 0,
    movementDistance: 0, lethalPrevented: false }, ...extra });
check('zero uses and other actors or chase actions cannot count as tactical exposure', () => {
  for (const events of [[], [activation({ who: 'actor-1' })], [activation({ mode: 'chase' })],
    [activation({ source: 'character' })]]) {
    const out = buildTacticalExposure(events, actors[0]);
    assert.equal(out.ready, false); assert.equal(out.recorded, 0); assert.equal(out.status, 'no_recorded_activation');
  }
});
check('configured skill mismatch and missing receipts remain explicit non-exposure', () => {
  assert.equal(buildTacticalExposure([activation({ skill: '초월' })], actors[0]).status, 'skill_mismatch');
  const out = buildTacticalExposure([activation(), activation({ tacticalEffect: null })], actors[0]);
  assert.equal(out.ready, false); assert.equal(out.recorded, 1); assert.equal(out.unrecorded, 1);
});
check('valid configured-skill activations are counted without mutating frozen records', () => {
  const event = freeze(activation()); const out = buildTacticalExposure([event], actors[0]);
  assert.equal(out.ready, true); assert.equal(out.recorded, 1); assert.equal(out.combatAttack, 1);
  assert.equal(event.tacticalEffect.hpAfter, 78);
});
check('a changed tactical skill requires valid exposure on both sides, not just the candidate', () => {
  const afterActor = { ...actors[0], tacticalSkill: '프로토콜 위반' };
  const afterEvent = activation({ skill: '프로토콜 위반' });
  assert.equal(buildTacticalExposurePair([], actors[0], [afterEvent], afterActor).ready, false);
  assert.equal(buildTacticalExposurePair([activation()], actors[0], [], afterActor).ready, false);
  const out = buildTacticalExposurePair([activation()], actors[0], [afterEvent], afterActor);
  assert.equal(out.ready, true); assert.equal(out.baseline.configuredSkill, '치유의 바람');
  assert.equal(out.candidate.configuredSkill, '프로토콜 위반');
  assert.throws(() => buildTacticalExposurePair([activation()], actors[0], [activation()], actors[0]));
});
const swappedActors = createFormationSwapInput(input).input.initialFrame.survivors;
const hit = (who, targetId, hpDamage = 10, extra = {}) => ({ kind: 'damage', who, targetId,
  at: { sec: 20 }, zoneId: 'shared-zone', hpBefore: 100, hpAfter: 100 - hpDamage, hpDamage, ...extra });
const engagement = (encounterId, who, buddy, targetId) => ({ kind: 'team_engagement', encounterId,
  at: { sec: 20 }, atSec: 20, zoneId: 'shared-zone', teams: [[who, buddy], [targetId]], participants: [who] });
const strike = (encounterId, who, targetId, teamId, extra = {}) => ({ kind: 'team_strike', encounterId,
  who, targetId, teamId, damage: 10, at: { sec: 20 }, zoneId: 'shared-zone', ...extra });
const groupAttack = (encounterId, who, buddy, targetId, teamId) => [engagement(encounterId, who, buddy, targetId),
  hit(who, targetId), strike(encounterId, who, targetId, teamId)];
const exposed = (events, current = actors, other = swappedActors, actorIds = ['actor-1', 'actor-4']) =>
  buildFormationExposure(events, current, actorIds, other);

check('independent PvP hits alone do not prove changed formation reached a team action', () => {
  const out = exposed([hit('actor-1', 'actor-3'), hit('actor-4', 'actor-0')]);
  assert.equal(out.ready, false); assert.deepEqual(out.participants.map(row => row.committedHits), [1, 1]);
  assert.ok(out.participants.every(row => row.teamActions === 0));
});
check('formation HP evidence rejects wildlife, friendly fire and inconsistent HP arithmetic', () => {
  for (const event of [hit('actor-1', 'actor-0'), hit('animal', 'actor-1'),
    hit('actor-1', 'actor-3', 0), hit('actor-1', 'actor-3', 10, { hpAfter: 95 }),
    hit('actor-1', 'actor-3', 10, { hpAfter: Infinity })]) {
    assert.equal(exposed([event], actors, swappedActors, ['actor-1']).ready, false);
  }
  const out = exposed([hit('actor-1', 'actor-3', 10, { hpAfter: 95 })], actors, swappedActors, ['actor-1']);
  assert.equal(out.participants[0].committedHits, 0); assert.equal(out.participants[0].invalidHpHits, 1);
});
check('current formation must reach a successful exact team strike with changed teammates', () => {
  const baseline = freeze([...groupAttack('one', 'actor-1', 'actor-0', 'actor-3', 'team:1'),
    ...groupAttack('two', 'actor-4', 'actor-3', 'actor-0', 'team:2')]);
  const candidate = freeze([...groupAttack('one', 'actor-1', 'actor-3', 'actor-0', 'team:2'),
    ...groupAttack('two', 'actor-4', 'actor-0', 'actor-3', 'team:1')]);
  assert.equal(exposed(baseline).ready, true);
  assert.equal(exposed(candidate, swappedActors, actors).ready, true);
  assert.deepEqual(exposed(candidate, swappedActors, actors).participants.map(row => row.changedTeammateIds),
    [['actor-3', 'actor-5'], ['actor-0', 'actor-2']]);
  assert.equal(baseline[0].participants.length, 1, 'The shared clock may permit only one actor turn.');
});
check('a changed teammate who dies before the strike cannot count from a stale round roster', () => {
  const events = freeze([engagement('one', 'actor-1', 'actor-0', 'actor-3'),
    { kind: 'death', who: 'actor-0', by: 'actor-3', zoneId: 'shared-zone', at: { sec: 20 } },
    hit('actor-1', 'actor-3'), strike('one', 'actor-1', 'actor-3', 'team:1')]);
  const out = exposed(events, actors, swappedActors, ['actor-1']);
  assert.equal(out.ready, false); assert.equal(out.participants[0].teamActions, 0);
  assert.equal(out.participants[0].committedHits, 1, 'The real solo hit remains valid HP evidence.');
  assert.equal(out.participants[0].diagnostics.rejectedStrikes.changed_teammates_unavailable, 1);
});
check('a committed zero-HP packet invalidates teammate presence even before a death event', () => {
  for (const source of ['actor-3', 'animal']) {
    const events = freeze([engagement('one', 'actor-1', 'actor-0', 'actor-3'),
      hit(source, 'actor-0', 100), hit('actor-1', 'actor-3'),
      strike('one', 'actor-1', 'actor-3', 'team:1')]);
    const out = exposed(events, actors, swappedActors, ['actor-1']);
    assert.equal(out.ready, false); assert.equal(out.participants[0].teamActions, 0);
  }
});
check('revival alone cannot restore old combat-space evidence but a fresh engagement can', () => {
  const before = [engagement('one', 'actor-1', 'actor-0', 'actor-3'),
    { kind: 'death', who: 'actor-0', at: { sec: 20 } },
    { kind: 'revive', who: 'actor-0', hp: 100, zoneId: 'other-zone', at: { sec: 20 } },
    hit('actor-1', 'actor-3'), strike('one', 'actor-1', 'actor-3', 'team:1')];
  assert.equal(exposed(freeze(before), actors, swappedActors, ['actor-1']).ready, false);
  const fresh = groupAttack('one', 'actor-1', 'actor-0', 'actor-3', 'team:1');
  for (const event of fresh) {
    event.at.sec = 21;
    if (event.kind === 'team_engagement') event.atSec = 21;
  }
  const out = exposed(freeze([...before, ...fresh]), actors, swappedActors, ['actor-1']);
  assert.equal(out.ready, true); assert.equal(out.participants[0].teamActions, 1);
  assert.equal(out.participants[0].samples[0].atSec, 21);
  const reviveOnly = [engagement('one', 'actor-1', 'actor-0', 'actor-3'), before[2],
    hit('actor-1', 'actor-3'), strike('one', 'actor-1', 'actor-3', 'team:1')];
  assert.equal(exposed(freeze(reviveOnly), actors, swappedActors, ['actor-1']).ready, false);
});
check('nonlethal teammate damage and deaths after a committed strike keep valid exposure', () => {
  const events = freeze([engagement('one', 'actor-1', 'actor-0', 'actor-3'),
    hit('actor-3', 'actor-0', 1, { hpBefore: 10, hpAfter: 9 }),
    hit('actor-1', 'actor-3'), strike('one', 'actor-1', 'actor-3', 'team:1'),
    { kind: 'death', who: 'actor-0', at: { sec: 20 } }]);
  const out = exposed(events, actors, swappedActors, ['actor-1']);
  assert.equal(out.ready, true); assert.equal(out.participants[0].teamActions, 1);
});
check('one live changed teammate is sufficient and dead teammates are excluded from samples', () => {
  const round = engagement('one', 'actor-1', 'actor-0', 'actor-3');
  round.teams[0].push('actor-2');
  const events = freeze([round, { kind: 'death', who: 'actor-0', at: { sec: 20 } },
    hit('actor-1', 'actor-3'), strike('one', 'actor-1', 'actor-3', 'team:1')]);
  const out = exposed(events, actors, swappedActors, ['actor-1']);
  assert.equal(out.ready, true);
  assert.deepEqual(out.participants[0].samples[0].changedAllyIds, ['actor-2']);
});
check('enemy deaths and kill rewards are not misread as teammate deaths', () => {
  const events = freeze([engagement('one', 'actor-1', 'actor-0', 'actor-3'),
    hit('actor-1', 'actor-3', 10, { hpBefore: 10, hpAfter: 0 }),
    { kind: 'death', who: 'actor-3', by: 'actor-0', at: { sec: 20 } },
    { kind: 'elimination', who: 'actor-0', victimId: 'actor-3', at: { sec: 20 } },
    strike('one', 'actor-1', 'actor-3', 'team:1')]);
  assert.equal(exposed(events, actors, swappedActors, ['actor-1']).ready, true);
});
check('a claimed team strike cannot reuse unrelated, later or differently timed HP evidence', () => {
  const base = groupAttack('one', 'actor-1', 'actor-0', 'actor-3', 'team:1');
  for (const alter of [
    events => { events[1].who = 'actor-2'; },
    events => { events[1].at.sec = 20.1; },
    events => { events[1].zoneId = 'other-zone'; },
    events => { events[2].encounterId = 'unknown'; },
    events => { events[2].teamId = 'team:2'; },
    events => { events[2].damage = 11; },
    events => { events[0].participants = []; },
    events => { events[0].teams[0] = ['actor-1']; },
    events => { events[0].teams[0] = ['actor-1', 'actor-3']; },
    events => { [events[1], events[2]] = [events[2], events[1]]; },
  ]) {
    const malformed = structuredClone(base); alter(malformed);
    assert.equal(exposed(malformed, actors, swappedActors, ['actor-1']).ready, false);
  }
});
check('team strikes sum real packets but unchanged relationships and absent counterpart inputs cannot pass', () => {
  const events = [engagement('one', 'actor-1', 'actor-0', 'actor-3'),
    hit('actor-1', 'actor-3', 4), hit('actor-1', 'actor-3', 6, { hpBefore: 96, hpAfter: 90 }),
    strike('one', 'actor-1', 'actor-3', 'team:1')];
  const out = exposed(freeze(events), actors, swappedActors, ['actor-1']);
  assert.equal(out.ready, true); assert.equal(out.participants[0].committedHits, 2);
  assert.equal(exposed(events, actors, actors, ['actor-1']).ready, false);
  assert.throws(() => buildFormationExposure(events, actors, ['actor-1']));
  const brokenChain = structuredClone(events);
  brokenChain[2].hpBefore = 100; brokenChain[2].hpAfter = 94;
  assert.equal(exposed(brokenChain, actors, swappedActors, ['actor-1']).ready, false);
});
check('positive retreat cover from changed teammates is real team action, not proof of escape success', () => {
  const cover = { kind: 'team_cover', who: 'actor-1', chaserId: 'actor-3', helpers: ['actor-0'],
    escapeBonus: 0.12, zoneId: 'shared-zone', at: { sec: 20 } };
  const out = exposed(freeze([hit('actor-1', 'actor-3'), cover]), actors, swappedActors, ['actor-1']);
  assert.equal(out.ready, true); assert.equal(out.participants[0].coverActions, 1);
  assert.equal(exposed([hit('actor-1', 'actor-3'), { ...cover, escapeBonus: 0.24 }], actors, swappedActors, ['actor-1']).ready, true);
  for (const extra of [{ helpers: ['actor-3'] }, { chaserId: 'actor-0' }, { escapeBonus: 0 },
    { escapeBonus: 0.25 }, { escapeBonus: Infinity }, { helpers: ['actor-0', 'actor-0'] }]) {
    assert.equal(exposed([hit('actor-1', 'actor-3'), { ...cover, ...extra }], actors, swappedActors, ['actor-1']).ready, false);
  }
});
check('bounded exposure diagnostics explain rejections without changing readiness or retaining events', () => {
  const events = freeze(Array.from({ length: 20 }, (_, index) =>
    strike(`missing-${index}`, 'actor-1', 'actor-3', 'team:1')));
  const before = JSON.stringify(events);
  const out = exposed(events, actors, swappedActors, ['actor-1']);
  assert.equal(out.ready, false);
  const row = out.participants[0];
  assert.equal(row.teamActions, 0); assert.equal(row.diagnostics.strikeCandidates, 20);
  assert.equal(row.diagnostics.rejectedStrikes.missing_engagement, 20);
  assert.equal(row.diagnostics.rejectedStrikeSamples.length, 6);
  row.diagnostics.rejectedStrikeSamples[0].changedTeammateIds.push('not-an-input');
  assert.equal(JSON.stringify(events), before);
  assert.deepEqual(row.changedTeammateIds, ['actor-0', 'actor-2']);
  const grouped = exposed(freeze(groupAttack('grouped', 'actor-1', 'actor-0', 'actor-3', 'team:1')),
    actors, swappedActors, ['actor-1']);
  assert.equal(grouped.ready, true);
  assert.equal(grouped.participants[0].diagnostics.changedTeammateEngagements, 1);
  assert.equal(grouped.participants[0].diagnostics.activeEngagementTurns, 1);
  assert.equal(grouped.participants[0].diagnostics.outgoingHpHits, 1);
});
check('actual shared-clock team combat reaches changed relations in both controlled formations', () => {
  const baseRules = getRuleset('ER_S11');
  const ruleset = { ...baseRules, ai: { ...baseRules.ai, escapeHpBelow: 0 },
    pvp: { ...baseRules.pvp, criticalFleeHpBelow: 0, earlyLethalFinishMax: 0, postBattleMoveChance: 0,
      restHealMax: 0, postBattleRestExtraHealMax: 0 } };
  const prepare = current => structuredClone(current).map(actor => ({ ...actor, zoneId: 'shared-zone',
    _spatial: { zoneId: 'shared-zone', x: 4, y: 4 }, hp: 500, maxHp: 500, inventory: [],
    stats: { attackPower: 20, defense: 10 }, _tacNextAbsSec: 9999 }));
  const baseline = freeze(prepare(actors)), candidate = freeze(prepare(swappedActors));
  const beforeInputs = JSON.stringify({ baseline, candidate });
  for (const [initial, counterpart, targetId] of [[baseline, candidate, 'actor-3'], [candidate, baseline, 'actor-0']]) {
    const rows = structuredClone(initial), events = [], survivorMap = new Map(rows.map(actor => [actor._id, actor]));
    const state = { actor: survivorMap.get('actor-1'), target: survivorMap.get(targetId), survivorMap,
      newDeadIds: [], roundKills: {}, roundAssists: {}, phaseSurvivors: rows, todaysSurvivors: [...rows],
      currentActionSec: () => 20, phaseIdxNow: 4, nextDay: 3, estimatePower: () => 100,
      ruleset, publicItems: [], craftables: [], assistWindowPhases: 2 };
    const actions = { atNow: () => ({ day: 3, phase: 'morning', sec: 20 }),
      emitRunEvent: (kind, payload, at) => events.push({ kind, ...payload, at }) };
    const outcome = runPhaseCombatEncounter({ state, actions });
    assert.equal(outcome.teamRound.strikes.length, 6);
    const out = exposed(freeze(events), initial, counterpart);
    assert.equal(out.ready, true); assert.ok(out.participants.every(row => row.engagementActions > 0));
    assert.equal(JSON.stringify({ baseline, candidate }), beforeInputs);
  }
});
console.log(JSON.stringify({ pass: true, checks, scope: 'Fresh independent formation and exposure contracts; not actual match or browser proof.' }));
