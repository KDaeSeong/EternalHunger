import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { normalizeHungerTraits } from '../src/utils/hungerTraits.js';
import { compactCharacterForSave, findCharacterSaveMismatches } from '../src/utils/characterPayload.js';
import { normalizeHungerConfig, normalizeHungerEvent, normalizeHungerRoster } from '../src/app/hungergames/_lib/hungerGameContract.js';
import { DEFAULT_HUNGER_EVENTS, defaultHungerConfig, refreshHungerPresets, upgradeUntouchedHungerPresets } from '../src/app/hungergames/_lib/hungerGamePresets.js';
import { legacyHungerConfig } from '../src/app/hungergames/_lib/hungerGameLegacyPresets.js';
import { advanceHungerRun, createHungerRun, hungerEventSelectionWeight, hungerFinalDuelPressure, hungerProtection, inspectHungerEvent, replayHungerRun, resolveHungerEvent } from '../src/app/hungergames/_lib/hungerGameRuntime.js';
import { createHungerPack, restoreHungerPack, restoreHungerPackAsync } from '../src/app/hungergames/_lib/hungerGamePersistence.js';
import { hungerEffectLabel, koreanParticle, renderHungerText } from '../src/app/hungergames/_lib/hungerGameText.js';
import { createHungerPreview } from '../src/app/hungergames/_lib/hungerGamePreview.js';

const require = createRequire(import.meta.url);
const serverTraits = require('../../server/utils/hungerTraits.js');
let checks = 0;
const check = async (name, run) => { await run(); checks += 1; console.log('PASS ' + name); };
const role = (key, extra = {}) => ({ key, label: key, ...extra });
const event = (effects = [], extra = {}) => normalizeHungerEvent({ id: 'fixture', title: '시험 사건', roles: [role('actor')], outcomes: [{ label: '결과', text: '{actor}의 결과', weight: 1, effects }], ...extra });
const actor = (id, hungerTraits = [], extra = {}) => ({ id, name: id, hungerTraits, ...extra });
const state = (actors, events = [], extra = {}) => ({ ...createHungerRun({ roster: actors, events, seed: 'test', maxPhases: 12 }), day: 1, phase: 'day', phaseIndex: 0, weather: 'storm', location: 'forest', ...extra });
const lethal = event([{ type: 'death', target: 'actor', cause: 'lightning' }]);
const finish = (config, rulesVersion) => { let run = createHungerRun(config, rulesVersion); while (!run.finished) run = advanceHungerRun(run); return run; };

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
    static async deleteMany(query) { let deletedCount = 0; for (const [id, doc] of rows) if (String(doc.userId) === String(query.userId) && (query._id.$in ? query._id.$in.some((key) => String(key) === id) : !query._id.$nin.some((key) => String(key) === id))) { rows.delete(id); deletedCount++; } return { deletedCount }; }
    static async findOneAndUpdate(query, patch) { const doc = rows.get(String(query._id)); if (!doc || String(doc.userId) !== String(query.userId)) return null; Object.assign(doc, structuredClone(patch.$set)); return doc; }
    // The save route creates and updates inside one transaction (DEF-015).
    static async create(docs) { return Promise.all(docs.map(async (data) => { const doc = new Character(data); await doc.save(); return doc; })); }
    static db = { async transaction(run) { const snapshot = structuredClone([...rows]); try { return await run({ fixture: true }); } catch (error) { rows.clear(); for (const [id, doc] of snapshot) rows.set(id, doc); throw error; } } };
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
  const input = { id: 'new-actor', name: '시험 참가자', hungerTraits: ['lightning_immune', 'custom_power'], records: { totalWins: 9999, gamesPlayed: 9999 } };
  const payload = compactCharacterForSave(input);
  assert.equal(Object.hasOwn(payload, 'records'), false, 'character saves must exclude server-owned match records');
  assert.equal(input.records.totalWins, 9999, 'compaction must not mutate the editor source');
  const saved = await api.call('POST', '/save', { characters: [payload], deletedIds: [] }); assert.equal(saved.statusCode, 200, JSON.stringify(saved.body));
  assert.deepEqual(findCharacterSaveMismatches([payload], saved.body.characters, { saveResults: saved.body.saveResults }), []);
  for (const view of ['editor', 'stats', 'simulation']) {
    const listed = await api.call('GET', '/', null, { view }); assert.deepEqual(listed.body[0].hungerTraits, payload.hungerTraits);
  }
  const id = saved.body.characters[0]._id;
  const update = compactCharacterForSave({ ...saved.body.characters[0], hungerTraits: ['underwater_breathing'] });
  const changed = await api.call('POST', '/save', { characters: [update], deletedIds: [] }); assert.equal(changed.statusCode, 200);
  assert.deepEqual(changed.body.characters[0].hungerTraits, ['underwater_breathing']);
  const legacy = await api.call('POST', '/save', [{ _id: id, name: '옛 클라이언트' }]); assert.equal(legacy.statusCode, 200);
  assert.deepEqual(legacy.body.characters[0].hungerTraits, ['underwater_breathing']);
  const invalid = await api.call('POST', '/save', [{ _id: id, name: '잘못된 입력', hungerTraits: 'flight' }]);
  assert.equal(invalid.statusCode, 400); assert.equal(api.rows.get(id).name, '옛 클라이언트');
  assert.deepEqual(api.rows.get(id).hungerTraits, ['underwater_breathing']);
  const missing = structuredClone(changed.body.characters); missing[0].hungerTraits = [];
  assert.ok(findCharacterSaveMismatches([update], missing).some((row) => row.field === 'hungerTraits'));
});


await check('Korean particles agree with vowel, consonant and rieul endings', () => {
  const pairs = [['은','는'],['이','가'],['을','를'],['과','와'],['으로','로'],['이랑','랑'],['아','야']];
  for (const [name, closed, rieul] of [['야전 의사',false,false],['숲의 생존가',false,false],['라이덴 쇼군',true,false],['불꽃 정령',true,false],['노엘',true,true]]) {
    for (const [left,right] of pairs) {
      const expected = closed && !(left === '으로' && rieul) ? left : right;
      for (const form of [left,right,left+'('+right+')',right+'('+left+')',left+'/'+right,right+'/'+left]) assert.equal(koreanParticle(name,form),expected);
    }
  }
});
await check('pronunciation checks handle normalized Hangul, trailing marks, jamo and Korean digits', () => {
  assert.equal(koreanParticle('바바라'.normalize('NFD'),'은'),'는');
  for (const name of ['「바바라」','바바라 ⭐','바바라👩‍🚀','바바라!']) assert.equal(koreanParticle(name,'이'),'가');
  for (const digit of ['1','7','8']) assert.equal(koreanParticle('기계 '+digit,'으로'),'로');
  for (const digit of ['2','4','5','9']) assert.equal(koreanParticle('기계 '+digit,'은'),'는');
  for (const digit of ['0','3','6']) assert.equal(koreanParticle('기계 '+digit,'은'),'은');
  assert.equal(koreanParticle('ㄹ','으로'),'로'); assert.equal(koreanParticle('ㅏ','은'),'는');
  assert.equal(koreanParticle('Raiden','은'),'은(는)'); assert.equal(koreanParticle('','을'),'을(를)');
});
await check('template particles are local to placeholders and never rewrite names or ordinary words', () => {
  const cast = { actor:{name:'야전 의사'}, victim:{name:'라이덴 쇼군'} };
  assert.equal(renderHungerText('"{actor}"은(는) {victim}을(를) 돕고 {victim}과 {actor}으로부터 소식을 듣는다.',cast),'"야전 의사"는 라이덴 쇼군을 돕고 라이덴 쇼군과 야전 의사로부터 소식을 듣는다.');
  assert.equal(renderHungerText('{actor}은 {victim}과는 다르다.',cast),'야전 의사는 라이덴 쇼군과는 다르다.');
  assert.equal(renderHungerText('{actor}이름, {actor}가방, 이름은 그대로.',cast),'야전 의사이름, 야전 의사가방, 이름은 그대로.');
  assert.equal(renderHungerText('{actor}은 간다. {missing}은 남는다.',{actor:{name:'{victim}는'}}),'{victim}는은 간다. {missing}은 남는다.');
  assert.equal(renderHungerText('{constructor}은 간다.',{}),'{constructor}은 간다.');
});
await check('resolver output corrects multiple names while preserving atomic effects and kill credit', () => {
  const duel = event([], {roles:[role('attacker'),role('victim')],outcomes:[{text:'{attacker}은 {victim}을 쓰러뜨린다.',effects:[{type:'death',target:'victim',source:'attacker',cause:'physical'}]}]});
  const before = state([actor('doctor',[],{name:'야전 의사'}),actor('raiden',[],{name:'라이덴 쇼군'})]);
  const result = resolveHungerEvent(before,duel,{attacker:'doctor',victim:'raiden'});
  assert.equal(result.row.text,'야전 의사는 라이덴 쇼군을 쓰러뜨린다.');
  assert.equal(result.state.actors[0].kills,1); assert.equal(result.state.actors[1].alive,false); assert.equal(before.actors[1].alive,true);
});
await check('fallback rest corrects particles and distinguishes mechanical and elemental bodies', () => {
  const config = {roster:[actor('human',[],{name:'야전 의사'}),actor('robot',['mechanical']),actor('spirit',['elemental_body'])],events:[],seed:'rest',maxPhases:1};
  const run = advanceHungerRun(createHungerRun(config));
  const rows = new Map(run.history[0].rows.map(row=>[row.participants[0].id,row.text]));
  assert.equal(rows.get('human'),'야전 의사는 주변을 살피며 조용히 휴식한다.');
  assert.match(rows.get('robot'),/절전 모드/); assert.match(rows.get('spirit'),/기운/);
});
await check('outcome requirements combine traits, exclusions, injury and inventory before selection', () => {
  const repair = event([], {roles:[role('actor'),role('patient')],outcomes:[
    {label:'정비',text:'{actor}은 {patient}을 정비한다.',requirements:[{role:'patient',allTraits:['mechanical'],noneTraits:['elemental_body'],status:'injured',requiredItem:'배터리'}],effects:[{type:'heal',target:'patient'}]},
    {label:'대기',text:'{actor}은 대기한다.'},
  ]});
  const before = state([actor('a'),actor('b',['mechanical'],{items:['배터리']})]);
  const labels = () => inspectHungerEvent(before,repair,{actor:'a',patient:'b'}).outcomes.map(row=>row.label);
  assert.deepEqual(labels(),['대기']); before.actors[1].injured=true; assert.deepEqual(labels(),['정비','대기']);
  before.actors[1].items=[]; assert.deepEqual(labels(),['대기']); before.actors[1].items=['배터리']; before.actors[1].hungerTraits.push('elemental_body'); assert.deepEqual(labels(),['대기']);
});
await check('invalid outcome requirements and self-assigned damage sources are rejected', () => {
  for (const requirements of [[{role:'missing'}],[{role:'actor'},{role:'actor'}],[{role:'actor',allTraits:['flight'],noneTraits:['flight']}],[{role:'actor',status:'dead'}],'invalid']) {
    assert.throws(()=>event([],{outcomes:[{text:'{actor}은 기다린다.',requirements}]}));
  }
  assert.throws(()=>event([{type:'injure',target:'actor',source:'actor',cause:'physical'}]),/공격자/);
});
await check('physical immunity blocks death and injury while mechanical bodies gain no implicit immunity', () => {
  for (const type of ['death','injure']) {
    const hurt = event([{type,target:'actor',cause:'physical'}]);
    const before = state([actor('a',['physical_immune']),actor('b')]);
    assert.equal(resolveHungerEvent(before,hurt,{actor:'a'}).row,null);
    assert.ok(resolveHungerEvent(state([actor('a',['mechanical']),actor('b')]),hurt,{actor:'a'}).row);
  }
  const mixed = event([],{outcomes:[{label:'사망',text:'{actor}은 쓰러진다.',weight:10,effects:[{type:'death',target:'actor',cause:'physical'}]},{label:'회피',text:'{actor}은 피한다.',weight:10}]});
  assert.deepEqual(inspectHungerEvent(state([actor('a',['physical_resistant']),actor('b')]),mixed,{actor:'a'}).outcomes.map(row=>row.weight),[2,10]);
});
await check('environment immunity and elemental attack immunity remain distinct and cause-specific', () => {
  for (const [natural,attack] of [['lightning','lightning_attack'],['fire','fire_attack']]) {
    const environmentOnly = actor('a',[natural+'_immune']);
    assert.equal(hungerProtection(environmentOnly,natural),'immune'); assert.equal(hungerProtection(environmentOnly,attack),'normal');
    const attackOnly = actor('a',[attack+'_immune']);
    assert.equal(hungerProtection(attackOnly,attack),'immune'); assert.equal(hungerProtection(attackOnly,natural),'normal');
  }
});
await check('ability attacks and counters require their capabilities and physical immunity excludes knife damage', () => {
  const roster = defaultHungerConfig().roster;
  const before = state(roster);
  const lightning = DEFAULT_HUNGER_EVENTS.find(row=>row.id==='lightning-strike');
  assert.equal(inspectHungerEvent(before,lightning,{attacker:'demo-rookie',victim:'demo-medic'}).eligible,false);
  assert.equal(inspectHungerEvent(before,lightning,{attacker:'demo-raiden',victim:'demo-medic'}).eligible,true);
  before.actors.find(row=>row.id==='demo-rookie').items=['칼'];
  const knife = DEFAULT_HUNGER_EVENTS.find(row=>row.id==='knife-encounter');
  const flame = inspectHungerEvent(before,knife,{attacker:'demo-rookie',victim:'demo-flame'}).outcomes.map(row=>row.label);
  assert.ok(flame.includes('물리 면역')); assert.ok(flame.includes('불꽃 반격')); assert.ok(!flame.includes('결정타')); assert.ok(!flame.includes('손상')); assert.ok(!flame.includes('근접 반격'));
  const raiden = inspectHungerEvent(before,knife,{attacker:'demo-rookie',victim:'demo-raiden'}).outcomes.map(row=>row.label);
  assert.ok(raiden.includes('번개 반격')); assert.ok(!raiden.includes('근접 반격'));
});
await check('training, injury and flight adjust attack weights without guaranteeing victory', () => {
  const duel = event([],{roles:[role('attacker'),role('victim')],outcomes:[{label:'일격',weight:2,text:'{attacker}은 {victim}을 쓰러뜨린다.',effects:[{type:'death',target:'victim',cause:'physical',source:'attacker'}]},{label:'회피',weight:2,text:'{victim}은 달아난다.'}]});
  const before = state([actor('a'),actor('b')]);
  const weight = () => inspectHungerEvent(before,duel,{attacker:'a',victim:'b'}).outcomes[0].weight;
  assert.equal(weight(),2); before.actors[0].hungerTraits=['combat_training']; assert.equal(weight(),3.5);
  before.actors[1].hungerTraits=['combat_training']; assert.equal(weight(),2);
  before.actors[0].hungerTraits=[]; before.actors[1].hungerTraits=['flight']; assert.equal(weight(),1);
  before.actors[1].hungerTraits=[]; before.actors[0].injured=true; assert.equal(weight(),1.2);
  before.actors[1].injured=true; assert.ok(Math.abs(weight()-1.8)<1e-9);
  before.rulesVersion=1; assert.equal(weight(),2);
  assert.ok(inspectHungerEvent({...before,rulesVersion:2},duel,{attacker:'a',victim:'b'}).outcomes.some(row=>row.label==='회피'));
});
await check('nonlethal attacks record their source without awarding a kill', () => {
  const wound = event([],{roles:[role('attacker'),role('victim')],outcomes:[{text:'{attacker}은 {victim}을 공격한다.',effects:[{type:'injure',target:'victim',cause:'fire_attack',source:'attacker'}]}]});
  const result = resolveHungerEvent(state([actor('a'),actor('b')]),wound,{attacker:'a',victim:'b'});
  assert.equal(result.row.effects[0].sourceId,'a'); assert.equal(result.state.actors[0].kills,0); assert.equal(result.state.actors[1].injured,true);
});
await check('biological meals, recollections and first aid exclude mechanical and elemental bodies', () => {
  const before = state([actor('medic',['medic']),actor('robot',['mechanical'],{items:['식량']}),actor('spirit',['elemental_body'],{items:['식량']})],[],{phase:'night'});
  for (const id of ['robot','spirit']) {
    for (const eventId of ['meal','quiet-night']) assert.equal(inspectHungerEvent(before,DEFAULT_HUNGER_EVENTS.find(row=>row.id===eventId),{actor:id}).eligible,false);
    before.actors.find(row=>row.id===id).injured=true;
    assert.equal(inspectHungerEvent(before,DEFAULT_HUNGER_EVENTS.find(row=>row.id==='medical-help'),{rescuer:'medic',victim:id}).eligible,false);
  }
  assert.equal(hungerEffectLabel(before.actors[1],'death'),'작동 정지'); assert.equal(hungerEffectLabel(before.actors[2],'injure'),'형태 손상');
});
await check('hazard injuries use only the matching body narrative', () => {
  const cold = DEFAULT_HUNGER_EVENTS.find(row=>row.id==='cold-night');
  for (const [body,traits,match] of [['living',[],/몸을 다친다/],['mechanical',['mechanical'],/신체 부품/],['elemental',['elemental_body'],/기운이 불안정/]]) {
    const variant = normalizeHungerEvent({...cold,outcomes:cold.outcomes.filter(row=>row.label==='손상' && (body==='living'?row.requirements[0].noneTraits.includes('mechanical'):row.requirements[0].allTraits.includes(traits[0])))});
    const result = resolveHungerEvent(state([actor('a',traits),actor('b')],[],{phase:'night',weather:'cold'}),variant,{actor:'a'});
    assert.match(result.row.text,match); assert.equal(result.state.actors[0].injured,true);
  }
});
await check('recent repetition is reduced per participant without excluding a sole authored event', () => {
  const repeated = event([],{weight:4});
  const before = state([actor('a'),actor('b')]);
  const castA={actor:before.actors[0]}, castB={actor:before.actors[1]};
  const fresh=hungerEventSelectionWeight(before,repeated,castA);
  const previous={index:-1,rows:[{eventId:repeated.id,participants:[{id:'a'}]}]}; before.history=[previous];
  assert.ok(hungerEventSelectionWeight(before,repeated,castA)<hungerEventSelectionWeight(before,repeated,castB));
  assert.ok(hungerEventSelectionWeight(before,repeated,castB)<fresh);
  assert.ok(hungerEventSelectionWeight(before,repeated,castA,previous.rows)>0);
  assert.equal(hungerEventSelectionWeight({...before,rulesVersion:1},repeated,castA,previous.rows),fresh);
  const roster=Array.from({length:12},(_,index)=>actor('a'+index));
  const one=advanceHungerRun(createHungerRun({roster,events:[repeated],seed:'sole',maxPhases:1}));
  assert.equal(one.history[0].rows.length,12);
});
await check('automatic selection avoids immediate repeats when another valid event exists', () => {
  const roster=Array.from({length:20},(_,index)=>actor('a'+index));
  const run=advanceHungerRun(createHungerRun({roster,events:[event([],{id:'first'}),event([],{id:'second'})],seed:'varied',maxPhases:1}));
  const ids=run.history[0].rows.map(row=>row.eventId);
  assert.equal(ids.length,20); assert.ok(ids.every((id,index)=>!index||id!==ids[index-1]));
});
await check('allied actors use betrayal instead of ordinary attacks and teammates still cannot fight', () => {
  const before=state([actor('a',[],{items:['칼']}),actor('b')],[],{day:2,relationships:[{leftId:'a',rightId:'b',kind:'ally'}]});
  assert.equal(inspectHungerEvent(before,DEFAULT_HUNGER_EVENTS.find(row=>row.id==='knife-encounter'),{attacker:'a',victim:'b'}).eligible,false);
  const betrayal=DEFAULT_HUNGER_EVENTS.find(row=>row.id==='betrayal');
  assert.equal(inspectHungerEvent(before,betrayal,{attacker:'a',victim:'b'}).eligible,true);
  before.actors.forEach(row=>row.teamId='same');
  before.input.matchMode='team';
  assert.equal(inspectHungerEvent(before,betrayal,{attacker:'a',victim:'b'}).eligible,false);
});
await check('v1 replay preserves the exact pre-change winner, RNG and receipt fingerprint', () => {
  const config=legacyHungerConfig(); let run=createHungerRun(config,1); while(!run.finished)run=advanceHungerRun(run);
  const fingerprint={actors:run.actors,rngState:run.rngState,phaseIndex:run.phaseIndex,usage:run.usage,relationships:run.relationships,winnerId:run.winnerId,history:run.history.map(phase=>({...phase,rows:phase.rows.map(({text,...row})=>row)}))};
  assert.equal(createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex'),'c1de91201c45295b6ffb75dc6ca08bbf120654a6dcfe83acfc607d8635ba347b');
  assert.equal(run.winnerId,'demo-robot'); assert.equal(run.history.length,10);
});
await check('old checkpoints upgrade only the next match while preserving old progress and re-save rules', async () => {
  const old={version:'hunger-games.v1',config:legacyHungerConfig(),run:{phases:10}};
  const restored=restoreHungerPack(old); assert.equal(restored.upgraded,true);
  assert.equal(restored.config.events.length,55); assert.equal(restored.run.input.events.length,22); assert.equal(restored.run.rulesVersion,1); assert.equal(restored.run.winnerId,'demo-robot');
  assert.ok(restored.run.history.flatMap(phase=>phase.rows).some(row=>row.text.includes('야전 의사는')));
  assert.deepEqual((await restoreHungerPackAsync(old,async()=>{})).run,restored.run);
  const saved=createHungerPack(restored.config,restored.run); assert.equal(saved.run.rulesVersion,1); assert.equal(saved.run.config.events.length,22);
  assert.deepEqual(restoreHungerPack(saved).run,restored.run);
});
await check('customized events and participants survive automatic and explicit preset refreshes', () => {
  const config=normalizeHungerConfig(legacyHungerConfig());
  config.events[0].title='내 시작 사건'; config.roster[1].name='직접 만든 정령';
  const original=structuredClone(config);
  assert.equal(upgradeUntouchedHungerPresets(config).upgraded,false); assert.deepEqual(config,original);
  const custom=event([],{id:'custom-story'}); config.events.push(custom);
  const refreshed=refreshHungerPresets(config);
  assert.deepEqual(refreshed.events.find(row=>row.id==='custom-story'),custom);
  assert.deepEqual(refreshed.roster[1],config.roster[1]);
  assert.ok(refreshed.roster[0].hungerTraits.includes('combat_training'));
  const full={...config,events:Array.from({length:170},(_,index)=>event([],{id:'custom-'+index}))};
  assert.throws(()=>refreshHungerPresets(full),/200/); assert.equal(full.events.length,170);
});
await check('current checkpoints preserve rules and unsupported rule versions fail closed', async () => {
  const config=defaultHungerConfig(), run=replayHungerRun(config,5), pack=createHungerPack(config,run);
  assert.equal(pack.run.rulesVersion,3); assert.deepEqual(restoreHungerPack(pack).run,run);
  const invalid={...pack,run:{...pack.run,rulesVersion:4}};
  assert.throws(()=>restoreHungerPack(invalid),/규칙 버전/);
  await assert.rejects(restoreHungerPackAsync(invalid),/규칙 버전/);
  assert.throws(()=>createHungerRun(config,0),/규칙 버전/);
});
await check('expanded defaults deliver ability scenes and varied causes across deterministic matches', () => {
  const eventsSeen=new Set(),causes=new Set();
  for(let index=0;index<20;index++) {
    const run=finish({...defaultHungerConfig(),seed:'themes-'+index});
    for(const row of run.history.flatMap(phase=>phase.rows)) {
      eventsSeen.add(row.eventId);
      for(const effect of row.effects)if(effect.type==='death')causes.add(effect.cause);
      assert.doesNotMatch(row.text,/야전 의사은|숲의 생존가은|수중 탐험가은|참가자은|생존가을|탐험가을/);
    }
  }
  for(const id of ['lightning-strike','fire-strike','flight-escape','robot-night','spirit-night','robot-repair'])assert.ok(eventsSeen.has(id),id);
  for(const cause of ['physical','lightning_attack','fire_attack'])assert.ok(causes.has(cause),cause);
  assert.ok(eventsSeen.size>=30);
});


await check('final-duel pressure starts with the current pair and excludes opening, teams and old rules', () => {
  const before=state([actor('a'),actor('b'),actor('dead')],[],{phaseIndex:7});
  assert.equal(hungerFinalDuelPressure(before),0);
  before.actors[2].alive=false; before.actors[2].death={phaseIndex:5};
  assert.equal(hungerFinalDuelPressure(before),2);
  assert.equal(hungerFinalDuelPressure({...before,phase:'opening'}),0);
  assert.equal(hungerFinalDuelPressure({...before,rulesVersion:1}),0);
  before.actors[0].teamId='same'; before.actors[1].teamId='same';
  before.input.matchMode='team';
  assert.equal(hungerFinalDuelPressure(before),0);
});
await check('survivor-count and final-duel duration conditions gate authored events', () => {
  const final=DEFAULT_HUNGER_EVENTS.find(row=>row.id==='final-physical');
  const pair=state([actor('a'),actor('b')],[],{phaseIndex:1});
  assert.equal(inspectHungerEvent(pair,final,{attacker:'a',victim:'b'}).eligible,false);
  pair.phaseIndex=2; assert.equal(inspectHungerEvent(pair,final,{attacker:'a',victim:'b'}).eligible,true);
  pair.actors.push({...pair.actors[0],id:'third'}); assert.equal(inspectHungerEvent(pair,final,{attacker:'a',victim:'b'}).eligible,false);
  assert.throws(()=>event([],{minSurvivors:4,maxSurvivors:3}),/최대/);
  assert.throws(()=>event([],{minDuelPhases:2}),/2명/);
  assert.throws(()=>event([],{minSurvivors:2,maxSurvivors:2,minDuelPhases:Infinity}),/범위/);
});
await check('long final standoffs increase lethal odds and encounter weight while reducing avoidance', () => {
  const duel=event([],{roles:[role('attacker'),role('victim')],outcomes:[{label:'결정타',text:'{attacker}은 {victim}을 쓰러뜨린다.',effects:[{type:'death',target:'victim',cause:'physical',source:'attacker'}]},{label:'회피',text:'{victim}은 피한다.'}]});
  const early=state([actor('a'),actor('b')]), late={...early,phaseIndex:5};
  const weights=before=>inspectHungerEvent(before,duel,{attacker:'a',victim:'b'}).outcomes.map(row=>row.weight);
  const first=weights(early), last=weights(late);
  assert.ok(last[0]/last[1]>first[0]/first[1]*10);
  const cast={attacker:early.actors[0],victim:early.actors[1]};
  assert.ok(hungerEventSelectionWeight(late,duel,cast)>hungerEventSelectionWeight(early,duel,cast));
  const quiet=event([]); assert.ok(hungerEventSelectionWeight(late,quiet,{actor:early.actors[0]})<hungerEventSelectionWeight(early,quiet,{actor:early.actors[0]}));
  assert.deepEqual(weights({...late,rulesVersion:1}),first);
});
await check('final pressure preserves physical immunity and the resistance ratio', () => {
  const duel=event([],{roles:[role('attacker'),role('victim')],outcomes:[{label:'결정타',text:'{attacker}은 {victim}을 쓰러뜨린다.',effects:[{type:'death',target:'victim',cause:'physical',source:'attacker'}]},{label:'회피',text:'{victim}은 피한다.'}]});
  const before=state([actor('a'),actor('b')],[],{phaseIndex:10});
  const weights=()=>inspectHungerEvent(before,duel,{attacker:'a',victim:'b'}).outcomes;
  const unprotected=weights()[0].weight;
  before.actors[1].hungerTraits=['physical_resistant']; assert.ok(Math.abs(weights()[0].weight/unprotected-0.2)<1e-9);
  before.actors[1].hungerTraits=['physical_immune']; assert.deepEqual(weights().map(row=>row.label),['회피']);
});
await check('final encounters resolve an alliance explicitly and preserve same-team exclusions', () => {
  const final=DEFAULT_HUNGER_EVENTS.find(row=>row.id==='final-physical');
  const retreat=normalizeHungerEvent({...final,outcomes:final.outcomes.filter(row=>row.label==='퇴각')});
  const before=state([actor('a'),actor('b')],[],{phaseIndex:4,relationships:[{leftId:'a',rightId:'b',kind:'ally'}]});
  const result=resolveHungerEvent(before,retreat,{attacker:'a',victim:'b'});
  assert.ok(result.row); assert.deepEqual(result.state.relationships,[{leftId:'a',rightId:'b',kind:'enemy'}]);
  before.actors.forEach(row=>row.teamId='same');
  before.input.matchMode='team';
  assert.equal(inspectHungerEvent(before,final,{attacker:'a',victim:'b'}).eligible,false);
});
await check('thirty two-person matches including physical resistance finish within eight phases', () => {
  const samples=defaultHungerConfig().roster;
  for(let index=0;index<30;index++) {
    const run=finish({...defaultHungerConfig(),roster:[samples[4],samples[5]],seed:'pair-'+index,maxPhases:20});
    assert.equal(run.endReason,'last_survivor'); assert.ok(run.history.length<=8,run.history.length);
    assert.equal(run.actors.filter(row=>row.alive).length,1);
  }
});
await check('invulnerable or same-team finalists remain shared survivors without fabricated deaths', () => {
  const immune=['lightning_control','lightning_attack_immune','physical_immune'];
  const final=DEFAULT_HUNGER_EVENTS.find(row=>row.id==='final-lightning');
  const run=finish({roster:[actor('a',immune),actor('b',immune)],events:[final],seed:'immune-final',maxPhases:12});
  assert.equal(run.endReason,'phase_limit'); assert.equal(run.actors.filter(row=>row.alive).length,2);
  assert.equal(run.actors.reduce((sum,row)=>sum+row.kills,0),0);
  assert.ok(run.history.flatMap(phase=>phase.rows).every(row=>!row.effects.some(effect=>['death','injure'].includes(effect.type))));
  const teammates=finish({roster:[actor('a',[],{teamId:'t'}),actor('b',[],{teamId:'t'})],events:[DEFAULT_HUNGER_EVENTS.find(row=>row.id==='final-physical')],seed:'same-team',maxPhases:6});
  assert.equal(teammates.endReason,'last_team'); assert.equal(teammates.actors.filter(row=>row.alive).length,2);
  assert.equal(teammates.history.length,1); assert.deepEqual(teammates.winnerIds,['a','b']);
});

await check('editor previews simulate finalists and injury without changing the real roster', () => {
  const roster=normalizeHungerConfig(defaultHungerConfig()).roster, original=structuredClone(roster);
  const event=DEFAULT_HUNGER_EVENTS.find(row=>row.id==='final-physical');
  const preview=createHungerPreview({roster,event,casting:{attacker:'demo-robot',victim:'demo-medic'},context:{day:4,phase:'day',weather:'clear',location:'forest'},injuredByRole:{victim:true},survivors:2,duelPhases:3});
  assert.equal(preview.state.actors.filter(row=>row.alive).length,2); assert.equal(hungerFinalDuelPressure(preview.state),3);
  assert.equal(preview.state.actors.find(row=>row.id==='demo-medic').injured,true);
  assert.equal(inspectHungerEvent(preview.state,event,preview.assigned).eligible,true); assert.deepEqual(roster,original);
  assert.throws(()=>createHungerPreview({roster,event,context:{},survivors:1}),/시험 생존자/);
  assert.throws(()=>createHungerPreview({roster,event,context:{},duelPhases:121}),/대치 페이즈/);
});

console.log('Hunger Games checks passed: ' + checks);
