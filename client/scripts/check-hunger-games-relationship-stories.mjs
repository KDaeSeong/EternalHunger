import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { HUNGER_RULES_VERSION, normalizeHungerConfig, normalizeHungerEvent } from '../src/app/hungergames/_lib/hungerGameContract.js';
import { DEFAULT_HUNGER_EVENTS, PREVIOUS_HUNGER_EVENTS, PRE_RELATIONSHIP_HUNGER_EVENTS,
  defaultHungerConfig, refreshHungerPresets, upgradeUntouchedHungerPresets } from '../src/app/hungergames/_lib/hungerGamePresets.js';
import { STORY_HUNGER_EVENTS } from '../src/app/hungergames/_lib/hungerGameStoryPresets.js';
import { RELATIONSHIP_HUNGER_EVENTS } from '../src/app/hungergames/_lib/hungerGameRelationshipPresets.js';
import { advanceHungerRun, createHungerRun, getHungerHistoryView, inspectHungerEvent, replayHungerRun,
  resolveHungerEvent } from '../src/app/hungergames/_lib/hungerGameRuntime.js';
import { createHungerPack, restoreHungerPack, restoreHungerPackAsync } from '../src/app/hungergames/_lib/hungerGamePersistence.js';

const clone = value => structuredClone(value);
const actor = (id, extras = {}) => ({ id, name: id === 'a' ? '민수' : id === 'b' ? '지영' : '관찰자',
  hungerTraits: [], items: [], ...extras });
const event = id => RELATIONSHIP_HUNGER_EVENTS.find(row => row.id === id);
const single = (source, label) => normalizeHungerEvent({ ...source,
  outcomes: source.outcomes.filter(row => row.label === label) });
function state(roster, kind = '', extra = {}) {
  const run = createHungerRun({ roster, events: RELATIONSHIP_HUNGER_EVENTS,
    seed: 'fresh-relationship-stories', matchMode: 'solo', maxPhases: 6 });
  return { ...run, day: 2, phase: 'day', phaseIndex: 3, weather: 'clear', location: 'forest',
    relationships: kind ? [{ leftId: roster[0].id, rightId: roster[1].id, kind }] : [], ...extra };
}
function rejectUnchanged(before, source, casting) {
  const snapshot = clone(before);
  assert.equal(inspectHungerEvent(before, source, casting).eligible, false);
  const result = resolveHungerEvent(before, source, casting);
  assert.equal(result.state, before);
  assert.equal(result.row, null);
  assert.deepEqual(before, snapshot);
}
let checks = 0;
const failures = [];
async function check(name, run) {
  try { await run(); checks++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${String(error.message).slice(0, 700)}`); }
}

await check('four new relationship events preserve the exact reconstructable 55-event baseline and rule version', () => {
  assert.equal(HUNGER_RULES_VERSION, 3);
  assert.equal(RELATIONSHIP_HUNGER_EVENTS.length, 4);
  assert.equal(PRE_RELATIONSHIP_HUNGER_EVENTS.length, 55);
  assert.deepEqual(PRE_RELATIONSHIP_HUNGER_EVENTS, [...PREVIOUS_HUNGER_EVENTS, ...STORY_HUNGER_EVENTS]);
  assert.equal(DEFAULT_HUNGER_EVENTS.length, 59);
  assert.deepEqual(DEFAULT_HUNGER_EVENTS.slice(0, 55), PRE_RELATIONSHIP_HUNGER_EVENTS);
  assert.equal(new Set(DEFAULT_HUNGER_EVENTS.map(row => row.id)).size, 59);
  assert.ok(RELATIONSHIP_HUNGER_EVENTS.every(row => row.outcomes.length <= 12
    && row.outcomes.every(outcome => outcome.effects.length <= 12)));
});

await check('new relationship stories stop at two living finalists without replacing the existing final encounters', () => {
  const casts = {
    'ally-supply-support': { donor: 'a', partner: 'b' },
    'ally-supply-dispute': { holder: 'a', partner: 'b' },
    'enemy-reencounter': { attacker: 'a', victim: 'b' },
    'enemy-food-reconciliation': { donor: 'a', partner: 'b' },
  };
  for (const source of RELATIONSHIP_HUNGER_EVENTS) {
    assert.equal(source.minSurvivors, 3);
    assert.equal(source.maxUses, 3);
    const kind = source.relations.find(row => ['ally', 'enemy'].includes(row.kind)).kind;
    rejectUnchanged(state([actor('a', { items: ['식량'] }), actor('b')], kind), source, casts[source.id]);
    const three = state([actor('a', { items: ['식량'] }), actor('b'), actor('c')], kind);
    const eliminateThird = normalizeHungerEvent({ id: 'fresh-finalist-transition', title: '세 번째 참가자 탈락',
      roles: [{ key: 'actor' }], outcomes: [{ text: '{actor}은 사고로 탈락한다.',
        effects: [{ type: 'death', target: 'actor', cause: 'accident' }] }] });
    const finalists = resolveHungerEvent(three, eliminateThird, { actor: 'c' }).state;
    assert.equal(finalists.actors.filter(row => row.alive).length, 2);
    rejectUnchanged(finalists, source, casts[source.id]);
  }
});

await check('relationship scenes have a real three-use match cap rather than endlessly passing food between the same allies', () => {
  const alliance = normalizeHungerEvent({ ...PRE_RELATIONSHIP_HUNGER_EVENTS.find(row => row.id === 'alliance'),
    id: 'fresh-cap-alliance', phases: ['opening'], maxDay: 0, maxUses: 1,
    roles: [{ key: 'actor', allTraits: ['cap_a'] }, { key: 'partner', allTraits: ['cap_b'] }] });
  const config = { roster: [actor('a', { items: ['식량'], hungerTraits: ['cap_a'] }),
    actor('b', { hungerTraits: ['cap_b'] }), actor('c')], events: [alliance, event('ally-supply-support')],
    seed: 'fresh-real-support-cap', matchMode: 'solo', maxPhases: 9 };
  let run = createHungerRun(config);
  while (!run.finished) run = advanceHungerRun(run);
  const supports = run.history.flatMap(phase => phase.rows).filter(row => row.eventId === 'ally-supply-support');
  assert.equal(supports.length, 3);
  assert.equal(run.usage['ally-supply-support'].count, 3);
  assert.ok(run.history.slice(6).every(phase => phase.rows.every(row => row.eventId === 'system-rest')));
  assert.equal(run.actors.reduce((sum, row) => sum + row.items.filter(item => item === '식량').length, 0), 1);
});

await check('existing alliance is required for real support and only a medic can heal an injured living ally', () => {
  const support = event('ally-supply-support');
  const cast = { donor: 'a', partner: 'b' };
  rejectUnchanged(state([actor('a', { items: ['식량'] }), actor('b'), actor('c')]), support, cast);
  const before = state([actor('a', { items: ['식량'] }), actor('b'), actor('c')], 'ally');
  const transferred = resolveHungerEvent(before, single(support, '동맹의 보급 전달'), cast);
  assert.deepEqual(transferred.state.actors.slice(0, 2).map(row => row.items), [[], ['식량']]);
  assert.deepEqual(transferred.state.relationships, before.relationships);
  assert.deepEqual(transferred.row.effects.map(row => row.actorId), ['a', 'b']);
  const aid = single(support, '응급 처치와 보급');
  const unskilled = clone(before); unskilled.actors[1].injured = true;
  rejectUnchanged(unskilled, aid, cast);
  const medic = state([actor('a', { items: ['식량'], hungerTraits: ['medic'] }), actor('b'), actor('c')], 'ally');
  rejectUnchanged(medic, aid, cast);
  medic.actors[1].injured = true;
  const healed = resolveHungerEvent(medic, aid, cast);
  assert.equal(healed.state.actors[1].injured, false);
  assert.deepEqual(healed.state.actors.slice(0, 2).map(row => row.items), [[], ['식량']]);
  assert.equal(medic.actors[1].injured, true);
});

await check('distribution conflict changes a proven alliance and theft conserves food with the correct attacker', () => {
  const dispute = event('ally-supply-dispute'), cast = { holder: 'a', partner: 'b' };
  rejectUnchanged(state([actor('a', { items: ['식량'] }), actor('b'), actor('c')]), dispute, cast);
  const before = state([actor('a', { items: ['식량'] }), actor('b'), actor('c')], 'ally');
  const split = resolveHungerEvent(before, single(dispute, '분배 거부와 결별'), cast);
  assert.deepEqual(split.state.actors.slice(0, 2).map(row => row.items), [['식량'], []]);
  assert.equal(split.state.relationships[0].kind, 'enemy');
  const theft = resolveHungerEvent(before, single(dispute, '식량을 빼앗긴 결별'), cast);
  assert.deepEqual(theft.state.actors.slice(0, 2).map(row => row.items), [[], ['식량']]);
  assert.equal(theft.state.actors[0].injured, true);
  assert.equal(theft.state.relationships[0].kind, 'enemy');
  const injury = theft.row.effects.find(row => row.type === 'injure');
  assert.equal(injury.actorId, 'a'); assert.equal(injury.sourceId, 'b');
  assert.deepEqual(before.actors.slice(0, 2).map(row => row.items), [['식량'], []]);
});

await check('hostile follow-ups require real hostility and healthy body-specific injury while retreat stays available', () => {
  const encounter = event('enemy-reencounter'), cast = { attacker: 'a', victim: 'b' };
  rejectUnchanged(state([actor('a'), actor('b'), actor('c')], 'ally'), encounter, cast);
  for (const [hungerTraits, label] of [[[], '충돌과 부상'], [['mechanical'], '충돌과 기계 손상'], [['elemental_body'], '충돌과 형태 손상']]) {
    const before = state([actor('a'), actor('b', { hungerTraits }), actor('c')], 'enemy');
    const result = resolveHungerEvent(before, single(encounter, label), cast);
    assert.equal(result.state.actors[1].injured, true);
    assert.deepEqual(result.state.relationships, before.relationships);
    assert.equal(result.row.effects[0].sourceId, 'a');
    const hurt = clone(before); hurt.actors[1].injured = true;
    assert.deepEqual(inspectHungerEvent(hurt, encounter, cast).outcomes.map(row => row.label), ['경계하며 후퇴']);
  }
});

await check('same-team and physical immunity protect hostile branches without disabling legitimate allied support', () => {
  const roster = [actor('a', { items: ['식량'], teamId: 't' }), actor('b', { teamId: 't' }), actor('c', { teamId: 'other' })];
  const team = state(roster, 'ally'); team.input.matchMode = 'team';
  rejectUnchanged(team, event('ally-supply-dispute'), { holder: 'a', partner: 'b' });
  assert.equal(inspectHungerEvent(team, event('ally-supply-support'), { donor: 'a', partner: 'b' }).eligible, true);
  const enemyTeam = clone(team); enemyTeam.relationships[0].kind = 'enemy';
  rejectUnchanged(enemyTeam, event('enemy-reencounter'), { attacker: 'a', victim: 'b' });
  const solo = clone(team); solo.input.matchMode = 'solo';
  assert.equal(inspectHungerEvent(solo, event('ally-supply-dispute'), { holder: 'a', partner: 'b' }).eligible, true);
  const immune = state([actor('a', { items: ['식량'], hungerTraits: ['physical_immune'] }), actor('b'), actor('c')], 'ally');
  const theft = single(event('ally-supply-dispute'), '식량을 빼앗긴 결별');
  rejectUnchanged(immune, theft, { holder: 'a', partner: 'b' });
  assert.deepEqual(inspectHungerEvent(immune, event('ally-supply-dispute'), { holder: 'a', partner: 'b' }).outcomes.map(row => row.label), ['분배 거부와 결별']);
  const encounter = state([actor('a'), actor('b', { hungerTraits: ['physical_immune'] }), actor('c')], 'enemy');
  assert.deepEqual(inspectHungerEvent(encounter, event('enemy-reencounter'), { attacker: 'a', victim: 'b' }).outcomes.map(row => row.label), ['경계하며 후퇴']);
});

await check('reconciliation consumes real food and changes hostility only when the full transfer can commit', () => {
  const truce = event('enemy-food-reconciliation'), cast = { donor: 'a', partner: 'b' };
  rejectUnchanged(state([actor('a', { items: ['식량'] }), actor('b'), actor('c')], 'ally'), truce, cast);
  rejectUnchanged(state([actor('a'), actor('b'), actor('c')], 'enemy'), truce, cast);
  rejectUnchanged(state([actor('a', { items: ['식량'] }), actor('b', { items: ['식량'] }), actor('c')], 'enemy'), truce, cast);
  rejectUnchanged(state([actor('a', { items: ['식량'] }), actor('b', { items: Array.from({ length: 12 }, (_, index) => '물품' + index) }), actor('c')], 'enemy'), truce, cast);
  const before = state([actor('a', { items: ['식량'] }), actor('b'), actor('c')], 'enemy');
  before.relationships[0] = { leftId: 'b', rightId: 'a', kind: 'enemy' };
  const result = resolveHungerEvent(before, truce, cast);
  assert.deepEqual(result.state.actors.slice(0, 2).map(row => row.items), [[], ['식량']]);
  assert.equal(result.state.relationships.length, 1);
  assert.equal(result.state.relationships[0].kind, 'ally');
  assert.deepEqual(result.row.effects.map(row => row.type), ['lose_item', 'gain_item', 'ally']);
  assert.deepEqual(before.relationships, [{ leftId: 'b', rightId: 'a', kind: 'enemy' }]);
});

await check('one short fresh authored sequence has alliance, support, betrayal, hostile injury and paid reconciliation with matching history', () => {
  const restrict = (source, roleTraits, extras) => normalizeHungerEvent({ ...source, ...extras,
    roles: source.roles.map(row => ({ ...row, allTraits: [...row.allTraits, roleTraits[row.key]] })) });
  const alliance = restrict(PRE_RELATIONSHIP_HUNGER_EVENTS.find(row => row.id === 'alliance'), { actor: 'chain_a', partner: 'chain_b' },
    { id: 'chain-alliance', phases: ['opening'], maxDay: 0, maxUses: 1 });
  const support = restrict(single(event('ally-supply-support'), '동맹의 보급 전달'), { donor: 'chain_a', partner: 'chain_b' },
    { phases: ['day'], minDay: 1, maxDay: 1 });
  const dispute = restrict(single(event('ally-supply-dispute'), '식량을 빼앗긴 결별'), { holder: 'chain_b', partner: 'chain_a' },
    { phases: ['day'], minDay: 2, maxDay: 2 });
  const encounter = restrict(single(event('enemy-reencounter'), '충돌과 부상'), { attacker: 'chain_b', victim: 'chain_a' },
    { phases: ['night'], minDay: 2, maxDay: 2 });
  const truce = restrict(event('enemy-food-reconciliation'), { donor: 'chain_a', partner: 'chain_b' },
    { phases: ['day'], minDay: 3, maxDay: 3 });
  const config = { roster: [actor('a', { hungerTraits: ['chain_a'], items: ['식량'] }),
    actor('b', { hungerTraits: ['chain_b'] }), actor('c')], events: [alliance, support, dispute, encounter, truce],
    seed: 'fresh-authorized-story-sequence', matchMode: 'solo', maxPhases: 6 };
  let run = createHungerRun(config);
  while (!run.finished) run = advanceHungerRun(run);
  assert.deepEqual(run.history.flatMap(phase => phase.rows).filter(row => row.eventId !== 'system-rest').map(row => row.eventId),
    ['chain-alliance', 'ally-supply-support', 'ally-supply-dispute', 'enemy-reencounter', 'enemy-food-reconciliation']);
  assert.deepEqual(run.actors.slice(0, 2).map(row => row.items), [[], ['식량']]);
  assert.ok(run.actors.slice(0, 2).every(row => row.injured && row.alive));
  assert.equal(run.relationships[0].kind, 'ally');
  assert.equal(getHungerHistoryView(run, 3).relationships[0].kind, 'enemy');
  assert.equal(getHungerHistoryView(run, 3).actors[0].injured, false);
  assert.deepEqual(getHungerHistoryView(run).relationships, run.relationships);
  assert.deepEqual(restoreHungerPack(createHungerPack(config, run)).run, run);
});

await check('only an exactly untouched old 55-event config upgrades automatically, without mutating inputs', () => {
  const config = normalizeHungerConfig({ ...defaultHungerConfig(), events: PRE_RELATIONSHIP_HUNGER_EVENTS });
  const before = clone(config);
  const upgraded = upgradeUntouchedHungerPresets(config);
  assert.equal(upgraded.upgraded, true);
  assert.equal(upgraded.config.events.length, 59);
  assert.deepEqual(config, before);
  assert.equal(upgradeUntouchedHungerPresets(upgraded.config).upgraded, false);
  const edited = clone(config); edited.events[0].title = '사용자가 수정한 이름';
  const editedResult = upgradeUntouchedHungerPresets(edited);
  assert.equal(editedResult.upgraded, false); assert.equal(editedResult.config, edited);
  const extra = normalizeHungerEvent({ ...config.events[0], id: 'user-extra', title: '추가 사건' });
  const augmented = { ...clone(config), events: [...config.events, extra] };
  assert.equal(upgradeUntouchedHungerPresets(augmented).upgraded, false);
  assert.equal(augmented.events.length, 56);
  const explicit = refreshHungerPresets({ ...edited, events: [...edited.events, extra] });
  assert.equal(explicit.events.length, 60);
  assert.deepEqual(explicit.events.at(-1), extra);
  assert.equal(edited.events[0].title, '사용자가 수정한 이름');
});

await check('fresh v1-v3 old-input runs preserve their exact progress, RNG, receipts and 55-event snapshot through next-match upgrades', async () => {
  const config = normalizeHungerConfig({ roster: [actor('a'), actor('b'), actor('c'), actor('d')],
    events: PRE_RELATIONSHIP_HUNGER_EVENTS, seed: 'fresh-old-input-roundtrip', matchMode: 'solo', maxPhases: 4 });
  for (const version of [1, 2, 3]) {
    let run = createHungerRun(config, version);
    while (!run.finished && run.history.length < 3) run = advanceHungerRun(run);
    const before = clone(run);
    const restored = restoreHungerPack(createHungerPack(config, run));
    assert.equal(restored.upgraded, true);
    assert.equal(restored.config.events.length, 59);
    assert.equal(restored.run.input.events.length, 55);
    assert.equal(restored.run.rulesVersion, version);
    assert.deepEqual(restored.run, before);
    assert.deepEqual(run, before);
    assert.deepEqual(replayHungerRun(config, run.history.length, version), before);
    const savedAgain = createHungerPack(restored.config, restored.run);
    assert.equal(savedAgain.run.config.events.length, 55);
    let yields = 0;
    const asyncRestored = await restoreHungerPackAsync(savedAgain, async () => { yields++; });
    assert.deepEqual(asyncRestored.run, before);
    assert.equal(asyncRestored.config.events.length, 59);
    assert.ok(yields <= 2);
  }
});

await check('the unchanged thirty ordinary seeds finish with one survivor and expose all four bounded new scenes', () => {
  const totals = Object.fromEntries(RELATIONSHIP_HUNGER_EVENTS.map(source => [source.id, 0]));
  for (let index = 0; index < 30; index++) {
    let run = createHungerRun({ ...defaultHungerConfig(), seed: 'audit-' + index,
      roster: Array.from({ length: 8 }, (_, offset) => actor('plain-' + offset, { name: 'plain-' + offset })) });
    while (!run.finished) run = advanceHungerRun(run);
    assert.equal(run.endReason, 'last_survivor', `audit-${index} must retain the existing ending requirement.`);
    let living = 8;
    const counts = Object.fromEntries(RELATIONSHIP_HUNGER_EVENTS.map(source => [source.id, 0]));
    for (const phase of run.history) for (const row of phase.rows) {
      if (Object.hasOwn(counts, row.eventId)) {
        assert.ok(living >= 3, 'New scenes must leave the last two survivors to the existing encounter pool.');
        counts[row.eventId]++; totals[row.eventId]++;
      }
      living -= row.effects.filter(effect => effect.type === 'death').length;
    }
    assert.equal(living, 1);
    assert.ok(Object.values(counts).every(count => count <= 3));
  }
  assert.ok(Object.values(totals).every(count => count > 0), 'Each of the four new scenes must remain observable in the bounded cohort.');
  console.log('HUNGER_RELATIONSHIP_DISTRIBUTION ' + JSON.stringify({ runs: 30, totals }));
});

console.log(JSON.stringify({ passed: failures.length === 0, checks, failures,
  scope: 'Fresh deterministic relationship event transactions, a six-phase authored sequence and short v1-v3 snapshot replays. No historical fixture import, engine/rule changes, browser, account writes or broad balance claim.' }));
if (failures.length) process.exitCode = 1;
