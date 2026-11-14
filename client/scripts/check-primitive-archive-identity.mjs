import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { engine, lineage, identityFixture, preparedIdentityFixture, chainIdentityFixture,
  naturalDeathIdentityFixture, cloneIdentityState as clone } from './lib/primitive-archive-identity-fixtures.mjs';
const { archiveIdentityIndex } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveIdentity.js');
import { resolveArchivePortrait } from '../src/app/games/primitive-archive/_lib/primitiveArchivePortraits.js';

const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function pureIndex(source) {
  const before = clone(source), restore = [];
  const forbid = () => { throw Error('Identity query touched randomness, clock or device storage'); };
  const replace = (target, key, value) => {
    const old = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
    restore.push(() => old ? Object.defineProperty(target, key, old) : Reflect.deleteProperty(target, key));
  };
  replace(Math, 'random', forbid); replace(Date, 'now', forbid); replace(crypto, 'randomUUID', forbid);
  replace(crypto.webcrypto, 'randomUUID', forbid); replace(crypto.webcrypto, 'getRandomValues', forbid);
  if (globalThis.crypto && globalThis.crypto !== crypto.webcrypto) {
    replace(globalThis.crypto, 'randomUUID', forbid); replace(globalThis.crypto, 'getRandomValues', forbid);
  }
  replace(globalThis, 'localStorage', new Proxy({}, { get: forbid }));
  try {
    const result = archiveIdentityIndex(freeze(source)); assert.deepEqual(source, before);
    assert.equal(Object.getPrototypeOf(result), null); assert.equal(Object.isFrozen(result), true);
    for (const row of Object.values(result)) {
      assert.equal(Object.isFrozen(row), true);
      assert.ok(['founder', 'successor', 'person', 'unknown'].includes(row.kind));
      assert.ok(['scout', 'hunt', 'craft', 'support', 'neutral'].includes(row.roleKey));
      if (row.mentor) assert.equal(Object.isFrozen(row.mentor), true);
      if (row.rootReference) assert.equal(Object.isFrozen(row.rootReference), true);
    }
    return result;
  } finally { restore.reverse().forEach(fn => fn()); }
}
let checks = 0;
function check(name, callback) { callback(); checks++; console.log(`PASS ${name}`); }
check('current founding people retain distinct names roles and generation zero without invented mentors', () => {
  const state = identityFixture(), index = pureIndex(state);
  for (const actor of state.party) {
    assert.equal(index[actor.id].actorId, actor.id); assert.equal(index[actor.id].name, actor.name);
    assert.equal(index[actor.id].kind, 'founder'); assert.equal(index[actor.id].generation, 0);
    assert.equal(index[actor.id].role, actor.role); assert.equal(index[actor.id].mentor, null); assert.equal(index[actor.id].rootReference, null);
  }
  assert.equal(new Set(Object.values(index).map(row => row.actorId)).size, state.party.length);
});
check('a real late recruit is a distinct generation-zero person and is never promoted to founder', () => {
  const source = identityFixture(), recruit = engine.recruitablePartyRows(source).find(row => row.canRecruit); assert.ok(recruit);
  const state = engine.recruitPartyMemberAction(source, recruit.id), index = pureIndex(state);
  assert.equal(lineage.isValidLineage(state.lineage, state), true);
  assert.equal(index[recruit.id].kind, 'person'); assert.equal(index[recruit.id].generation, 0);
  assert.equal(index[recruit.id].mentor, null); assert.equal(index[recruit.id].rootReference, null);
});
check('real prepared successor identifies its mentor and separately named root without borrowing the founder identity', () => {
  const { state, rootId, successorId } = preparedIdentityFixture(), index = pureIndex(state), row = index[successorId];
  assert.equal(row.kind, 'successor'); assert.equal(row.generation, 1); assert.equal(row.stageLabel, '준비된 후계');
  assert.equal(row.mentor.actorId, rootId); assert.equal(row.rootReference.actorId, rootId); assert.equal(row.rootReference.isFounder, true);
  assert.notEqual(row.actorId, rootId); assert.notEqual(row.name, index[rootId].name); assert.match(row.notice, /부모·친자 관계를 뜻하지/);
});
check('three actual paid preparations and retirements preserve one unique active person at each handover', () => {
  const { state, rootId, ids } = chainIdentityFixture(3), index = pureIndex(state);
  for (let generation = 1; generation < ids.length; generation++) {
    const row = index[ids[generation]]; assert.equal(row.kind, 'successor'); assert.equal(row.generation, generation);
    assert.equal(row.mentor.actorId, ids[generation - 1]); assert.equal(row.rootReference.actorId, rootId);
    assert.equal(row.stageLabel, generation === ids.length - 1 ? '활동 중' : '은퇴');
  }
  assert.equal(state.party.filter(row => ids.includes(row.id)).length, 1);
  assert.equal(state.party.filter(row => row.id === ids.at(-1)).length, 1);
});
check('actual natural death keeps the deceased successor separate from the retired root', () => {
  const { state, ids, rootId } = naturalDeathIdentityFixture(), index = pureIndex(state);
  assert.equal(index[ids[1]].kind, 'successor'); assert.equal(index[ids[1]].generation, 1);
  assert.equal(index[ids[1]].stageLabel, '사망'); assert.equal(index[ids[1]].rootReference.actorId, rootId);
});
check('legacy absent and wrong-run evidence never invents generations or root relationships', () => {
  for (const source of [identityFixture({ lineageMode: 'legacy' }), { ...identityFixture(), lineage: undefined, founderHistory: undefined },
    { ...identityFixture(), runId: 'different-run' }]) {
    const index = pureIndex(source);
    for (const row of Object.values(index)) { assert.equal(row.generation, null); assert.equal(row.mentor, null); assert.equal(row.rootReference, null); }
  }
});
check('missing duplicate and contradictory roots or generations are unknown instead of guessed kinship', () => {
  for (const corrupt of [
    (state, id) => { state.party.find(row => row.id === id).lineageGeneration = 99; },
    (state, id) => { state.party.find(row => row.id === id).lineageRootId = 'missing'; },
    (state, id) => { state.party.push(clone(state.party.find(row => row.id === id))); },
    state => { state.lineage.members = state.lineage.members.filter(row => row.generation !== 0); },
    state => { state.lineage.members.push(clone(state.lineage.members[0])); },
  ]) {
    const { state, ids } = chainIdentityFixture(1); corrupt(state, ids[1]); const row = pureIndex(state)[ids[1]];
    assert.equal(row.kind, 'unknown'); assert.equal(row.generation, null); assert.equal(row.mentor, null); assert.equal(row.rootReference, null);
  }
});
check('custom person and root portrait sources remain separate and the existing portrait resolver preserves each', () => {
  let state = identityFixture(); const rootId = state.party[0].id; state.party[0].portrait = '/custom/root-portrait.png';
  state = engine.prepareSuccessorAction(state, rootId, { rng: () => 0.5 });
  const candidate = state.lineage.prepared[0]; candidate.actor.portrait = '/custom/person-portrait.png';
  const row = pureIndex(state)[candidate.actor.id]; assert.equal(row.rootReference.portrait, '/custom/root-portrait.png');
  assert.equal(resolveArchivePortrait(candidate.actor).src, '/custom/person-portrait.png');
  assert.equal(resolveArchivePortrait({ id: rootId, portrait: row.rootReference.portrait }).src, '/custom/root-portrait.png');
});
check('prototype-like IDs remain safe own lookup keys without inherited people', () => {
  const source = identityFixture(); delete source.lineage; delete source.founderHistory;
  source.party = ['__proto__', 'constructor', 'toString'].map(id => ({ ...source.party[0], id, name: id }));
  const index = pureIndex(source);
  for (const id of ['__proto__', 'constructor', 'toString']) { assert.ok(Object.hasOwn(index, id)); assert.equal(index[id].actorId, id); assert.equal(index[id].kind, 'unknown'); }
  assert.equal(Object.keys(index).length, 3);
});
check('prototype-like roles stay neutral and unsafe generations never become confirmed generation zero', () => {
  for (const role of ['__proto__', 'constructor', 'toString']) {
    const source = identityFixture(); source.party[0].role = role;
    assert.equal(pureIndex(source)[source.party[0].id].roleKey, 'neutral');
  }
  for (const generation of [1e308, Infinity, NaN, -1]) {
    const initial = identityFixture(), recruit = engine.recruitablePartyRows(initial).find(row => row.canRecruit);
    assert.ok(recruit);
    const source = engine.recruitPartyMemberAction(initial, recruit.id), rootId = source.party[0].id,
      actor = source.party.find(row => row.id === recruit.id);
    actor.lineageRootId = rootId; actor.lineageGeneration = generation;
    const member = source.lineage.members.find(row => row.actorId === actor.id);
    member.founderId = rootId; member.generation = generation;
    const row = pureIndex(source)[actor.id];
    assert.equal(row.kind, 'unknown'); assert.equal(row.generation, null); assert.equal(row.generationLabel, '세대 미기록');
    assert.equal(row.rootReference, null); assert.equal(row.mentor, null);
  }
});
console.log(JSON.stringify({ pass: true, checks, mode: 'current-tracked-sources-and-real-bounded-lineage-fixtures',
  scope: 'Pure identity display evidence only. Actual preparations, recruitments, retirements and bounded lifecycle deaths; no historical outputs, searched seeds, full-game simulation, persistence or browser acceptance.', resultFiles: 0 }));
