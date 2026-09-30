import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { normalizeHungerTraits } from '../src/utils/hungerTraits.js';
import { compactCharacterForSave, findCharacterSaveMismatches } from '../src/utils/characterPayload.js';
import { normalizeHungerConfig, normalizeHungerEvent, normalizeHungerRoster } from '../src/app/hungergames/_lib/hungerGameContract.js';
import { DEFAULT_HUNGER_EVENTS, defaultHungerConfig } from '../src/app/hungergames/_lib/hungerGamePresets.js';
import { advanceHungerRun, createHungerRun, hungerProtection, inspectHungerEvent, replayHungerRun, resolveHungerEvent } from '../src/app/hungergames/_lib/hungerGameRuntime.js';
import { createHungerPack, restoreHungerPack, restoreHungerPackAsync } from '../src/app/hungergames/_lib/hungerGamePersistence.js';

const require = createRequire(import.meta.url);
const serverTraits = require('../../server/utils/hungerTraits.js');
let checks = 0;
const check = async (name, run) => { await run(); checks += 1; console.log('PASS ' + name); };
const role = (key, extra = {}) => ({ key, label: key, ...extra });
const event = (effects = [], extra = {}) => normalizeHungerEvent({ id: 'fixture', title: '시험 사건', roles: [role('actor')], outcomes: [{ label: '결과', text: '{actor}의 결과', weight: 1, effects }], ...extra });
const actor = (id, hungerTraits = [], extra = {}) => ({ id, name: id, hungerTraits, ...extra });
const state = (actors, events = [], extra = {}) => ({ ...createHungerRun({ roster: actors, events, seed: 'test', maxPhases: 12 }), day: 1, phase: 'day', phaseIndex: 0, weather: 'storm', location: 'forest', ...extra });
const lethal = event([{ type: 'death', target: 'actor', cause: 'lightning' }]);
const finish = (config) => { let run = createHungerRun(config); while (!run.finished) run = advanceHungerRun(run); return run; };

await check('natural lightning immunity blocks both lethal and injury effects, without mutating state', () => {
  const before = state([actor('raiden', ['lightning_immune']), actor('other')]);
  const snapshot = structuredClone(before);
  for (const type of ['death', 'injure']) {
    const result = resolveHungerEvent(before, event([{ type, target: 'actor', cause: 'lightning' }]), { actor: 'raiden' });
    assert.equal(result.row, null); assert.strictEqual(result.state, before);
  }
  assert.deepEqual(before, snapshot);
});
await check('lightning control and names alone never manufacture immunity', () => {
  const before = state([actor('라이덴 쇼군', ['lightning_control']), actor('other')]);
  assert.equal(hungerProtection(before.actors[0], 'lightning'), 'normal');
  const result = resolveHungerEvent(before, lethal, { actor: '라이덴 쇼군' });
  assert.equal(result.state.actors[0].alive, false);
  assert.equal(before.actors[0].alive, true);
});
await check('the lightning preset selects only the immune narrative for a renamed protected actor', () => {
  const lightning = DEFAULT_HUNGER_EVENTS.find((row) => row.id === 'lightning');
  for (let index = 0; index < 50; index += 1) {
    const before = state([actor('renamed', ['lightning_immune', 'lightning_resistant']), actor('other')], [], { rngState: index });
    const result = resolveHungerEvent(before, lightning, { actor: 'renamed' });
    assert.equal(result.row.outcome, '면역'); assert.equal(result.state.actors[0].alive, true); assert.equal(result.state.actors[0].injured, false);
    assert.match(result.row.text, /renamed/); assert.equal(result.row.effects.length, 0);
  }
});
await check('resistance lowers lethal branch weight but retains nonlethal outcomes', () => {
  const mixed = event([], { outcomes: [
    { label: '사망', weight: 10, text: '{actor}은 죽는다.', effects: [{ type: 'death', target: 'actor', cause: 'lightning' }] },
    { label: '생존', weight: 10, text: '{actor}은 피한다.', effects: [] },
  ] });
  const protectedState = state([actor('a', ['lightning_resistant']), actor('b')]);
  assert.deepEqual(inspectHungerEvent(protectedState, mixed, { actor: 'a' }).outcomes, [{ label: '사망', weight: 2 }, { label: '생존', weight: 10 }]);
});
await check('protection is specific to its cause and underwater breathing blocks drowning', () => {
  const before = state([actor('a', ['lightning_immune', 'underwater_breathing']), actor('b')]);
  assert.equal(resolveHungerEvent(before, event([{ type: 'death', target: 'actor', cause: 'drowning' }]), { actor: 'a' }).row, null);
  assert.equal(resolveHungerEvent(before, event([{ type: 'death', target: 'actor', cause: 'combat' }]), { actor: 'a' }).state.actors[0].alive, false);
});
await check('unknown harmful causes and unknown effect types fail closed', () => {
  assert.throws(() => event([{ type: 'death', target: 'actor', cause: 'untyped' }]), /원인/);
  assert.throws(() => event([{ type: 'execute_script', target: 'actor' }]), /지원하지/);
});
await check('missing template roles, duplicates and conflicting trait requirements are rejected', () => {
  assert.throws(() => event([], { outcomes: [{ text: '{missing}이 죽는다.' }] }), /역할/);
  assert.throws(() => event([], { roles: [role('a'), role('a')] }), /중복/);
  assert.throws(() => event([], { roles: [role('actor', { allTraits: ['flight'], noneTraits: ['flight'] })] }), /동시에/);
  assert.throws(() => event([], { id: '__proto__' }), /ID/);
});
await check('stale casting is rechecked before state changes', () => {
  const before = state([actor('a'), actor('b'), actor('c')]);
  assert.equal(inspectHungerEvent(before, lethal, { actor: 'a' }).eligible, true);
  before.actors[0].alive = false;
  const result = resolveHungerEvent(before, lethal, { actor: 'a' });
  assert.equal(result.row, null); assert.equal(result.state.actors[1].alive, true);
});
await check('one participant cannot be assigned twice and team relations are enforced', () => {
  const pair = event([], { roles: [role('a'), role('b')], relations: [{ left: 'a', right: 'b', kind: 'not_teammate' }], outcomes: [{ text: '{a}과 {b}이 만난다.' }] });
  const before = state([actor('a', [], { teamId: 't' }), actor('b', [], { teamId: 't' }), actor('c')]);
  assert.equal(inspectHungerEvent(before, pair, { a: 'a', b: 'a' }).eligible, false);
  assert.equal(inspectHungerEvent(before, pair, { a: 'a', b: 'b' }).eligible, false);
  assert.equal(inspectHungerEvent(before, pair, { a: 'a', b: 'c' }).eligible, true);
});
await check('roles require traits, items and current injury state together', () => {
  const rescue = event([{ type: 'heal', target: 'patient' }], { roles: [role('medic', { allTraits: ['medic'], noneTraits: ['mechanical'], requiredItem: '붕대' }), role('patient', { status: 'injured' })], outcomes: [{ text: '{medic}은 {patient}을 치료한다.', effects: [{ type: 'heal', target: 'patient' }] }] });
  const before = state([actor('a', ['medic'], { items: ['붕대'] }), actor('b')]);
  assert.equal(inspectHungerEvent(before, rescue, { medic: 'a', patient: 'b' }).eligible, false);
  before.actors[1].injured = true;
  assert.equal(resolveHungerEvent(before, rescue, { medic: 'a', patient: 'b' }).state.actors[1].injured, false);
  before.actors[0].items = [];
  assert.equal(inspectHungerEvent(before, rescue, { medic: 'a', patient: 'b' }).eligible, false);
});
await check('impossible item spending rolls back the entire outcome', () => {
  const spend = event([{ type: 'lose_item', target: 'actor', item: '식량' }, { type: 'lose_item', target: 'actor', item: '식량' }, { type: 'death', target: 'actor', cause: 'poison' }]);
  const before = state([actor('a', [], { items: ['식량'] }), actor('b')]);
  const result = resolveHungerEvent(before, spend, { actor: 'a' });
  assert.equal(result.row, null); assert.deepEqual(before.actors[0].items, ['식량']); assert.equal(before.actors[0].alive, true);
});
await check('item transfer conserves inventory and logs actual affected participants', () => {
  const transfer = event([], { roles: [role('donor'), role('receiver')], outcomes: [{ text: '{donor}은 {receiver}에게 식량을 건넨다.', effects: [{ type: 'lose_item', target: 'donor', item: '식량' }, { type: 'gain_item', target: 'receiver', item: '식량' }] }] });
  const before = state([actor('a', [], { items: ['식량'] }), actor('b')]);
  const result = resolveHungerEvent(before, transfer, { donor: 'a', receiver: 'b' });
  assert.deepEqual(result.state.actors.map((row) => row.items), [[], ['식량']]);
  assert.deepEqual(result.row.effects.map((row) => row.actorId), ['a', 'b']);
});
await check('alliance and betrayal use one symmetric persistent relationship', () => {
  const pair = (kind) => event([], { id: 'relation-' + kind, roles: [role('a'), role('b')], outcomes: [{ text: '{a}과 {b}의 관계가 변한다.', effects: [{ type: kind, target: 'a', other: 'b' }] }] });
  const before = state([actor('a'), actor('b')]);
  const alliance = resolveHungerEvent(before, pair('ally'), { a: 'a', b: 'b' }).state;
  const alliedEvent = normalizeHungerEvent({ ...pair('enemy'), relations: [{ left: 'a', right: 'b', kind: 'ally' }] });
  const betrayed = resolveHungerEvent(alliance, alliedEvent, { a: 'b', b: 'a' }).state;
  assert.equal(betrayed.relationships.length, 1); assert.equal(betrayed.relationships[0].kind, 'enemy');
  assert.equal(inspectHungerEvent({ ...betrayed, phaseIndex: 1 }, alliedEvent, { a: 'a', b: 'b' }).eligible, false);
});
await check('a multi-role death cannot eliminate all remaining participants', () => {
  const extinction = event([], { roles: [role('a'), role('b')], outcomes: [{ text: '{a}과 {b}이 죽는다.', effects: [{ type: 'death', target: 'a', cause: 'combat' }, { type: 'death', target: 'b', cause: 'combat' }] }] });
  assert.equal(resolveHungerEvent(state([actor('a'), actor('b')]), extinction, { a: 'a', b: 'b' }).row, null);
});
await check('one survivor ends the phase immediately and records exactly one kill', () => {
  const duel = event([], { roles: [role('attacker'), role('victim')], outcomes: [{ text: '{attacker}은 {victim}을 죽인다.', effects: [{ type: 'death', target: 'victim', source: 'attacker', cause: 'combat' }] }] });
  const run = advanceHungerRun(createHungerRun({ roster: [actor('a'), actor('b')], events: [duel], seed: 'duel', maxPhases: 10 }));
  assert.equal(run.finished, true); assert.equal(run.endReason, 'last_survivor'); assert.equal(run.history[0].rows.length, 1);
  assert.equal(run.actors.reduce((sum, row) => sum + row.kills, 0), 1); assert.strictEqual(advanceHungerRun(run), run);
});
await check('empty or wholly incompatible pools fall back to harmless rest and finish as shared survivors', () => {
  for (const events of [[], [event([], { roles: [role('actor', { allTraits: ['missing_trait'] })] })]]) {
    const run = finish({ roster: [actor('a'), actor('b')], events, seed: 'fallback', maxPhases: 3 });
    assert.equal(run.history.length, 3); assert.equal(run.endReason, 'phase_limit'); assert.equal(run.winnerId, null);
    assert.equal(run.actors.filter((row) => row.alive).length, 2);
    assert.ok(run.history.every((phase) => phase.rows.every((row) => row.eventId === 'system-rest')));
  }
});
await check('event phase, weather, location, date and disabled flag all gate selection', () => {
  const limited = event([], { phases: ['night'], weather: ['storm'], locations: ['river'], minDay: 2, maxDay: 4 });
  const before = state([actor('a'), actor('b')], [], { phase: 'night', weather: 'storm', location: 'river', day: 2 });
  assert.equal(inspectHungerEvent(before, limited, { actor: 'a' }).eligible, true);
  for (const patch of [{ phase: 'day' }, { weather: 'clear' }, { location: 'forest' }, { day: 1 }, { day: 5 }]) assert.equal(inspectHungerEvent({ ...before, ...patch }, limited, { actor: 'a' }).eligible, false);
  assert.equal(inspectHungerEvent(before, { ...limited, enabled: false }, { actor: 'a' }).eligible, false);
});
await check('cooldowns prevent same-phase repeats and maximum usage is honored', () => {
  const limited = event([], { maxUses: 2, cooldownPhases: 1 });
  const before = state([actor('a'), actor('b')]);
  const once = resolveHungerEvent(before, limited, { actor: 'a' }).state;
  assert.equal(inspectHungerEvent(once, limited, { actor: 'b' }).eligible, false);
  assert.equal(inspectHungerEvent({ ...once, phaseIndex: 1 }, limited, { actor: 'b' }).eligible, false);
  const twice = resolveHungerEvent({ ...once, phaseIndex: 2 }, limited, { actor: 'b' }).state;
  assert.equal(inspectHungerEvent({ ...twice, phaseIndex: 10 }, limited, { actor: 'a' }).eligible, false);
});
await check('the full default run is deterministic and replay preserves all state and receipts', () => {
  const config = defaultHungerConfig(); const original = finish(config);
  assert.deepEqual(finish(config), original);
  assert.deepEqual(replayHungerRun(config, original.history.length), original);
  assert.notDeepEqual(finish({ ...config, seed: 'different' }).history, original.history);
});
await check('zero cooldown permits repeated events for different participants within a phase', () => {
  const repeated = event([], { id: 'toString', cooldownPhases: 0, maxUses: 2 });
  const before = state([actor('a'), actor('b'), actor('c')]);
  const once = resolveHungerEvent(before, repeated, { actor: 'a' }).state;
  const twice = resolveHungerEvent(once, repeated, { actor: 'b' });
  assert.ok(twice.row); assert.equal(twice.state.usage.toString.count, 2);
  assert.equal(inspectHungerEvent(twice.state, repeated, { actor: 'c' }).eligible, false);
});
await check('each participant appears at most once per phase and all fatal receipts agree with state', () => {
  for (let index = 0; index < 30; index += 1) {
    const run = finish({ ...defaultHungerConfig(), seed: 'distribution-' + index });
    const deaths = [];
    for (const phase of run.history) {
      const seen = phase.rows.flatMap((row) => row.participants.map((participant) => participant.id));
      assert.equal(new Set(seen).size, seen.length);
      for (const row of phase.rows) for (const effect of row.effects) {
        const who = run.actors.find((entry) => entry.id === effect.actorId);
        if (['death', 'injure'].includes(effect.type)) assert.notEqual(hungerProtection(who, effect.cause), 'immune');
        if (effect.type === 'death') { deaths.push(who.id); assert.equal(who.alive, false); assert.equal(who.death.eventId, row.eventId); }
      }
    }
    assert.equal(new Set(deaths).size, deaths.length);
    assert.equal(deaths.length, run.actors.filter((who) => !who.alive).length);
    assert.ok(run.actors.some((who) => who.alive));
  }
});
await check('a maximum-size protected roster with 200 incompatible multi-actor events completes safely', () => {
  const roster = Array.from({ length: 64 }, (_, index) => actor('protected-' + index, ['lightning_immune']));
  const events = Array.from({ length: 200 }, (_, index) => event([], { id: 'blocked-' + index,
    roles: ['a', 'b', 'c', 'd'].map((key) => role(key)), outcomes: [{ text: '{a}의 사건', effects: [{ type: 'death', target: 'd', cause: 'lightning' }] }] }));
  const started = performance.now(); const run = finish({ roster, events, seed: 'capacity', maxPhases: 4 });
  assert.equal(run.history.length, 4); assert.equal(run.actors.filter((who) => who.alive).length, 64);
  assert.equal(run.history.flatMap((phase) => phase.rows).length, 256);
  console.log('Capacity fixture: ' + Math.round(performance.now() - started) + ' ms');
});
await check('JSON checkpoints preserve a running match even when next-match configuration changes', () => {
  const config = defaultHungerConfig(); let run = createHungerRun(config);
  for (let index = 0; index < 4; index += 1) run = advanceHungerRun(run);
  const changed = { ...config, seed: 'next-match', events: [] };
  const restored = restoreHungerPack(JSON.stringify(createHungerPack(changed, run)));
  assert.equal(restored.config.seed, 'next-match'); assert.equal(restored.config.events.length, 0);
  assert.deepEqual(restored.run, run); assert.deepEqual(advanceHungerRun(restored.run), advanceHungerRun(run));
});
await check('unchanged checkpoint input is stored once and portraits are absent from per-event receipts', () => {
  const config = defaultHungerConfig(); config.roster[0].previewImage = 'data:image/png;base64,AA==';
  const run = advanceHungerRun(createHungerRun(config)); const pack = createHungerPack(config, run);
  assert.equal(pack.run.config, undefined);
  assert.deepEqual(restoreHungerPack(pack).run, run);
  assert.ok(run.history[0].rows.every((row) => row.participants.every((participant) => !Object.hasOwn(participant, 'previewImage'))));
});
await check('unsupported checkpoints, out-of-range progress and fabricated logs are not trusted', () => {
  const config = defaultHungerConfig(); const pack = createHungerPack(config, advanceHungerRun(createHungerRun(config)));
  assert.throws(() => restoreHungerPack({ ...pack, version: 'future' }), /버전/);
  assert.throws(() => restoreHungerPack({ ...pack, run: { phases: 121 } }), /진행/);
  const forged = structuredClone(pack); forged.run.actors = [{ alive: false }]; forged.run.history = ['fake'];
  assert.deepEqual(restoreHungerPack(forged).run, restoreHungerPack(pack).run);
  const finished = finish(config); assert.throws(() => replayHungerRun(config, finished.history.length + 1), /종료/);
});
await check('participant limits, duplicate IDs, invalid pictures and non-finite numeric inputs are rejected', () => {
  assert.throws(() => normalizeHungerRoster([actor('a'), actor('a')]), /중복/);
  assert.throws(() => normalizeHungerRoster([actor('a', [], { previewImage: 'javascript:alert(1)' })]), /이미지/);
  assert.throws(() => normalizeHungerRoster(Array.from({ length: 65 }, (_, index) => actor(String(index)))), /64/);
  assert.throws(() => normalizeHungerConfig({ ...defaultHungerConfig(), maxPhases: Infinity }), /범위/);
  assert.throws(() => event([], { weight: NaN }), /범위/);
});
await check('cooperative browser restoration yields while preserving exact deterministic state', async () => {
  const config = { ...defaultHungerConfig(), events: [], maxPhases: 10 };
  const run = replayHungerRun(config, 5); const pack = createHungerPack(config, run); let yields = 0;
  const restored = await restoreHungerPackAsync(pack, async () => { yields++; });
  assert.deepEqual(restored.run, run); assert.equal(yields, 2);
  await assert.rejects(restoreHungerPackAsync({ ...pack, version: 'unknown' }), /버전/);
});
await check('input configuration is isolated from the running simulation', () => {
  const config = defaultHungerConfig(); const run = createHungerRun(config);
  config.roster[0].hungerTraits.length = 0; config.events.length = 0;
  assert.ok(run.actors[0].hungerTraits.includes('lightning_immune')); assert.ok(run.input.events.length > 0);
});
await check('client and server normalize trait keys identically, including custom keys and caps', () => {
  for (const value of [null, 'flight', [' FLIGHT ', 'flight', 4, 'bad key', 'custom_power'], Array.from({ length: 40 }, (_, index) => 'custom_' + index)]) {
    assert.deepEqual(serverTraits.normalizeHungerTraits(value), normalizeHungerTraits(value));
  }
  assert.equal(normalizeHungerTraits(Array.from({ length: 40 }, (_, index) => 'custom_' + index)).length, 32);
});

function characterApiFixture() {
  const rows = new Map(); const handlers = {}; let nextId = 1;
  class ObjectId { constructor(value) { this.value = String(value); } toString() { return this.value; } static isValid(value) { return /^[a-f0-9]{24}$/.test(String(value)); } }
  const matches = (doc, query) => (!query.userId || String(doc.userId) === String(query.userId))
    && (!query._id?.$in || query._id.$in.some((id) => String(id) === String(doc._id)));
  class Character {
    constructor(data) { Object.assign(this, data); this._id = String(nextId++).padStart(24, '0'); }
    async save() { rows.set(this._id, structuredClone({ ...this, userId: String(this.userId) })); return this; }
    static find(query) {
      let selected = '';
      const cursor = { sort() { return cursor; }, select(value) { selected = value; return cursor; }, async lean() {
        return [...rows.values()].filter((doc) => matches(doc, query)).map((doc) => selected ? Object.fromEntries(Object.entries(doc).filter(([key]) => key === '_id' || selected.split(' ').includes(key))) : structuredClone(doc));
      } };
      return cursor;
    }
    static async deleteMany(query) { let deletedCount = 0; for (const [id, doc] of rows) if (String(doc.userId) === String(query.userId) && !query._id.$nin.some((key) => String(key) === id)) { rows.delete(id); deletedCount++; } return { deletedCount }; }
    static async findOneAndUpdate(query, patch) { const doc = rows.get(String(query._id)); if (!doc || String(doc.userId) !== String(query.userId)) return null; Object.assign(doc, structuredClone(patch.$set)); return doc; }
  }
  const router = { use() {}, get(path, handler) { handlers['GET ' + path] = handler; }, post(path, handler) { handlers['POST ' + path] = handler; } };
  const modules = {
    express: { Router: () => router }, mongoose: { Types: { ObjectId } }, '../models/Characters': Character,
    '../models/Item': { find: async () => [] }, '../utils/inventory': { buildItemNameMap: () => ({}), normalizeInventory: (value) => value },
    '../utils/requestScope': { scopedFilter: () => ({}) }, '../middleware/authMiddleware': { verifyToken() {} }, '../utils/hungerTraits': serverTraits,
  };
  vm.runInNewContext(readFileSync(new URL('../../server/routes/characters.js', import.meta.url), 'utf8'), { require: (key) => { if (!modules[key]) throw new Error('Unexpected route dependency: ' + key); return modules[key]; }, module: { exports: {} }, console }, { filename: 'characters.js' });
  return { rows, async call(method, path, body, query = {}) {
    const result = { statusCode: 200, body: null }; const response = { status(code) { result.statusCode = code; return response; }, json(data) { result.body = JSON.parse(JSON.stringify(data)); return response; } };
    await handlers[method + ' ' + path]({ body, query, user: { id: 'ffffffffffffffffffffffff' } }, response); return result;
  } };
}

await check('the real character save/list handlers round-trip Hunger traits through client verification', async () => {
  const api = characterApiFixture();
  const payload = compactCharacterForSave({ id: 'new-actor', name: '시험 참가자', hungerTraits: ['lightning_immune', 'custom_power'] });
  const saved = await api.call('POST', '/save', [payload]); assert.equal(saved.statusCode, 200, JSON.stringify(saved.body));
  assert.deepEqual(findCharacterSaveMismatches([payload], saved.body.characters, { saveResults: saved.body.saveResults }), []);
  for (const view of ['editor', 'stats', 'simulation']) {
    const listed = await api.call('GET', '/', null, { view }); assert.deepEqual(listed.body[0].hungerTraits, payload.hungerTraits);
  }
  const id = saved.body.characters[0]._id;
  const update = compactCharacterForSave({ ...saved.body.characters[0], hungerTraits: ['underwater_breathing'] });
  const changed = await api.call('POST', '/save', [update]); assert.equal(changed.statusCode, 200);
  assert.deepEqual(changed.body.characters[0].hungerTraits, ['underwater_breathing']);
  const legacy = await api.call('POST', '/save', [{ _id: id, name: '옛 클라이언트' }]); assert.equal(legacy.statusCode, 200);
  assert.deepEqual(legacy.body.characters[0].hungerTraits, ['underwater_breathing']);
  const invalid = await api.call('POST', '/save', [{ _id: id, name: '잘못된 입력', hungerTraits: 'flight' }]);
  assert.equal(invalid.statusCode, 400); assert.equal(api.rows.get(id).name, '옛 클라이언트');
  assert.deepEqual(api.rows.get(id).hungerTraits, ['underwater_breathing']);
  const missing = structuredClone(changed.body.characters); missing[0].hungerTraits = [];
  assert.ok(findCharacterSaveMismatches([update], missing).some((row) => row.field === 'hungerTraits'));
});

console.log('Hunger Games checks passed: ' + checks);
