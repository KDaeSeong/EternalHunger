import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { normalizeHungerConfig, normalizeHungerEvent } from '../src/app/hungergames/_lib/hungerGameContract.js';
import { DEFAULT_HUNGER_EVENTS, PREVIOUS_HUNGER_EVENTS, defaultHungerConfig } from '../src/app/hungergames/_lib/hungerGamePresets.js';
import { advanceHungerRun, createHungerRun, getHungerHistoryView, inspectHungerEvent, resolveHungerEvent } from '../src/app/hungergames/_lib/hungerGameRuntime.js';
import { createHungerPack, restoreHungerPack } from '../src/app/hungergames/_lib/hungerGamePersistence.js';
import { createHungerPreview } from '../src/app/hungergames/_lib/hungerGamePreview.js';

let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log('PASS ' + name); };
const actor = (id, hungerTraits = [], extra = {}) => ({ id, name: id, hungerTraits, ...extra });
const role = (key, extra = {}) => ({ key, label: key, ...extra });
const event = (effects = [], extra = {}) => normalizeHungerEvent({ id: 'fixture', title: '시험 사건', roles: [role('actor')],
  outcomes: [{ label: '결과', text: '{' + (extra.roles?.[0]?.key || 'actor') + '}의 결과', weight: 1, effects }], ...extra });
const state = (roster, extra = {}) => ({ ...createHungerRun({ roster, events: [], seed: 'test', maxPhases: 12 }),
  day: 1, phase: 'day', phaseIndex: 0, weather: 'storm', location: 'forest', ...extra });
const finish = (config, rulesVersion) => { let run = createHungerRun(config, rulesVersion); while (!run.finished) run = advanceHungerRun(run); return run; };

await check('v2 replays preserve the released match fingerprint while only next-match presets upgrade', () => {
  const config = { ...defaultHungerConfig(), events: PREVIOUS_HUNGER_EVENTS }, run = finish(config, 2);
  const fingerprint = { actors: run.actors, rngState: run.rngState, phaseIndex: run.phaseIndex, usage: run.usage,
    relationships: run.relationships, winnerId: run.winnerId, history: run.history.map(phase => ({ ...phase, rows: phase.rows.map(({ text, ...row }) => row) })) };
  assert.equal(createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex'), '082170c80fec73cbe8410f422e925dd10656bd68ee5edded2ee20ea51b839f1f');
  const restored = restoreHungerPack(createHungerPack(config, run));
  assert.equal(restored.upgraded, true); assert.equal(restored.config.events.length, 55);
  assert.deepEqual(restored.run, run); assert.equal(restored.run.input.events.length, 43);
});

await check('districts do not form teams and solo finalists compete despite matching team metadata', () => {
  const duel = event([], { roles: [role('attacker'), role('victim')], phases: ['day'],
    relations: [{ left: 'attacker', right: 'victim', kind: 'not_teammate' }] });
  const roster = [actor('a', [], { districtId: '12', teamId: 'same' }), actor('b', [], { districtId: '12', teamId: 'same' })];
  const individual = state(roster); individual.input.matchMode = 'solo';
  assert.equal(inspectHungerEvent(individual, duel, { attacker: 'a', victim: 'b' }).eligible, true);
  individual.input.matchMode = 'team';
  assert.equal(inspectHungerEvent(individual, duel, { attacker: 'a', victim: 'b' }).eligible, false);
  individual.actors[1].teamId = 'other';
  assert.equal(inspectHungerEvent(individual, duel, { attacker: 'a', victim: 'b' }).eligible, true);
  const preview = createHungerPreview({ roster, matchMode: 'solo', event: duel, context: { day: 1, phase: 'day', weather: 'storm', location: 'forest' } });
  assert.equal(inspectHungerEvent(preview.state, duel, preview.assigned).eligible, true);
  assert.throws(() => normalizeHungerConfig({ roster, events: [], matchMode: 'unknown' }), /경기 방식/);
  const won = finish({ ...defaultHungerConfig(), roster, matchMode: 'solo', seed: 'same-district-final' });
  assert.equal(won.endReason, 'last_survivor'); assert.ok(won.history.length <= 8);
});

await check('team victory stops immediately before hazards can kill the surviving teammates', () => {
  const combat = event([{ type: 'death', target: 'victim', cause: 'physical', source: 'attacker' }], {
    roles: [role('attacker', { allTraits: ['striker'] }), role('victim', { allTraits: ['opponent'] })],
    relations: [{ left: 'attacker', right: 'victim', kind: 'not_teammate' }] });
  const danger = event([{ type: 'death', target: 'actor', cause: 'accident' }], { id: 'after-win-danger', minSurvivors: 2, maxSurvivors: 2 });
  const run = finish({ roster: [actor('a', ['striker'], { teamId: 't' }), actor('b', [], { teamId: 't' }), actor('c', ['opponent'], { teamId: 'enemy' })],
    events: [combat, danger], seed: 'last-team', matchMode: 'team', maxPhases: 60 });
  assert.equal(run.endReason, 'last_team'); assert.equal(run.history.length, 1);
  assert.deepEqual(run.winnerIds, ['a', 'b']); assert.equal(run.winnerTeamId, 't');
  assert.equal(run.history[0].rows.length, 1); assert.equal(run.actors[0].kills, 1);
  assert.deepEqual(restoreHungerPack(createHungerPack(run.input, run)).run, run);
});

await check('protected teammates finish across thirty seeds while v2 keeps its original end rule', () => {
  const immunity = ['lightning_immune', 'fire_immune', 'underwater_breathing', 'poison_immune', 'cold_immune'];
  const roster = [actor('a', immunity, { teamId: 't' }), actor('b', immunity, { teamId: 't' })];
  for (let index = 0; index < 30; index++) {
    const run = finish({ ...defaultHungerConfig(), matchMode: 'team', seed: 'protected-team-' + index, roster });
    assert.equal(run.endReason, 'last_team'); assert.equal(run.history.length, 1);
    assert.ok(run.actors.every(actor => actor.alive && !actor.injured && actor.kills === 0));
  }
  const legacy = finish({ ...defaultHungerConfig(), events: PREVIOUS_HUNGER_EVENTS, maxPhases: 6, roster }, 2);
  assert.equal(legacy.endReason, 'phase_limit'); assert.equal(legacy.history.length, 6);
});

await check('past views restore injuries, possessions, kills and relationships and hide later results', () => {
  const opening = event([{ type: 'injure', target: 'actor', cause: 'accident' }, { type: 'gain_item', target: 'actor', item: '식량' }],
    { id: 'past-opening', roles: [role('actor', { allTraits: ['marked_a'] })], phases: ['opening'] });
  const aid = event([{ type: 'heal', target: 'actor' }, { type: 'lose_item', target: 'actor', item: '밧줄' }, { type: 'ally', target: 'actor', other: 'partner' }],
    { id: 'past-aid', roles: [role('actor', { allTraits: ['marked_a'] }), role('partner', { allTraits: ['marked_b'] })], phases: ['day'] });
  const fatal = event([{ type: 'death', target: 'victim', cause: 'physical', source: 'attacker' }, { type: 'lose_item', target: 'victim', item: '식량' }, { type: 'enemy', target: 'attacker', other: 'victim' }],
    { id: 'past-fatal', roles: [role('attacker', { allTraits: ['marked_b'] }), role('victim', { allTraits: ['marked_a'] })], phases: ['night'] });
  const run = finish({ roster: [actor('a', ['marked_a'], { items: ['밧줄'] }), actor('b', ['marked_b']), actor('c')],
    events: [opening, aid, fatal], seed: 'history', maxPhases: 3 });
  const before = structuredClone(run), first = getHungerHistoryView(run, 0), second = getHungerHistoryView(run, 1), latest = getHungerHistoryView(run);
  assert.equal(first.actors[0].alive, true); assert.equal(first.actors[0].injured, true);
  assert.deepEqual(first.actors[0].items, ['밧줄', '식량']); assert.equal(first.actors[1].kills, 0);
  assert.equal(first.finished, false); assert.equal(first.winnerId, null); assert.deepEqual(first.relationships, []);
  assert.equal(second.actors[0].injured, false); assert.deepEqual(second.actors[0].items, ['식량']);
  assert.deepEqual(second.relationships, [{ leftId: 'a', rightId: 'b', kind: 'ally' }]);
  assert.deepEqual(latest.actors, run.actors); assert.deepEqual(latest.relationships, run.relationships);
  assert.equal(latest.finished, true); assert.deepEqual(run, before);
});

await check('rope stories spend real items once, create relationships and respect damage immunity', () => {
  const crossing = DEFAULT_HUNGER_EVENTS.find(row => row.id === 'rope-crossing');
  const before = state([actor('a', [], { items: ['밧줄'] }), actor('b'), actor('c')], { location: 'river' });
  const cast = { actor: 'a', partner: 'b', victim: 'c' }, result = resolveHungerEvent(before, crossing, cast);
  assert.ok(result.row); assert.deepEqual(result.state.actors[0].items, []); assert.equal(result.state.relationships.length, 3);
  assert.equal(resolveHungerEvent(result.state, crossing, cast).row, null);
  const ambush = DEFAULT_HUNGER_EVENTS.find(row => row.id === 'rope-ambush');
  before.actors[1].hungerTraits = ['physical_immune']; before.location = 'forest';
  assert.deepEqual(inspectHungerEvent(before, ambush, { attacker: 'a', victim: 'b', rescuer: 'c' }).outcomes.map(row => row.label), ['경고를 듣고 회피']);
  assert.deepEqual(before.actors[0].items, ['밧줄']);
});

await check('thirty ordinary matches use cooperation and ropes, with varied fatal causes', () => {
  const used = new Set(), causes = new Set(); let physical = 0, deaths = 0;
  for (let index = 0; index < 30; index++) {
    const run = finish({ ...defaultHungerConfig(), seed: 'audit-' + index,
      roster: Array.from({ length: 8 }, (_, offset) => actor('plain-' + offset)) });
    assert.equal(run.endReason, 'last_survivor');
    for (const phase of run.history) for (const row of phase.rows) {
      used.add(row.eventId);
      for (const effect of row.effects) if (effect.type === 'death') { deaths++; causes.add(effect.cause); if (effect.cause === 'physical') physical++; }
    }
  }
  assert.ok([...used].some(id => ['rope-climb', 'rope-crossing', 'rope-rescue', 'rope-ambush', 'rope-shelter'].includes(id)));
  assert.ok(used.has('three-watch') || used.has('food-bargain')); assert.ok(causes.size >= 4);
  assert.ok(physical / deaths < 0.85, `physical share ${physical}/${deaths}`);
  console.log('HUNGER_STORY_DISTRIBUTION ' + JSON.stringify({ runs: 30, physicalDeaths: physical, deaths, causes: [...causes], distinctEvents: used.size }));
});
console.log('Hunger Games improvement checks passed: ' + checks);
