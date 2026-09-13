import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { actor, effect, skill } = await import('./lib/run-combat-scenario.mjs');
const {
  getCharacterSkillMovementEstimate,
  resolveCharacterSkillMovement,
} = await import('../src/app/simulation/_lib/characterSkillMovementRuntime.js');
const { selectCharacterSkillAiDecision } = await import('../src/app/simulation/_lib/characterSkillAiRuntime.js');
const { findCharacterSkillChoice, finishCharacterCast, startCharacterCast } = await import('../src/app/simulation/_lib/characterCastRuntime.js');
const { applyPreparedCharacterSkill } = await import('../src/app/simulation/_lib/characterSkillRuntime.js');
const { createDefaultCompiledSkill, getCharacterSkillMovementError } = await import('../src/utils/characterSkillCompilerCore.js');
const { saveGuestCharacterProfile } = await import('../src/app/simulation/_lib/guestCharacterProfileRuntime.js');
const { compactCharacterForSave, findCharacterSaveMismatches } = await import('../src/utils/characterPayload.js');
const { describeObserverEvent } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { enterDimensionRiftSpace } = await import('../src/app/simulation/_lib/dimensionRiftSpaceRuntime.js');

let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };
const stats = { maxHp: 1000, attackPower: 1, defense: 0, attackSpeed: 1, attackRange: 2, sightRange: 20, moveSpeed: 3 };
const row = (id, x, extra = {}) => actor(id, { stats, _spatial: { zoneId: 'zone', x, y: 4 }, ...extra });
const movementSkill = (extra = {}) => skill({ flatDamage: [0], range: 12, castDelaySec: 0.5, recoveryDelaySec: 0.25,
  includesMovement: true, movementMode: 'toward_target', movementDistance: 3, ...extra });
const riftPair = (enteredAtSec = 100) => {
  const a = row('rift-a', 4); const b = row('rift-b', 10);
  const rift = { id: 'r1', zoneId: 'zone', resolved: false };
  assert.ok(enterDimensionRiftSpace(a, rift, enteredAtSec));
  assert.ok(enterDimensionRiftSpace(b, rift, enteredAtSec));
  return { a, b };
};

check('authoring normalizes an explicit direction and bounded distance', () => {
  const normalized = createDefaultCompiledSkill(movementSkill({ movementDistance: 20 }), 'q');
  assert.equal(normalized.movementMode, 'toward_target');
  assert.equal(normalized.movementDistance, 10);
  assert.equal(getCharacterSkillMovementError(movementSkill(), 'q'), '');
  assert.match(getCharacterSkillMovementError(movementSkill({ movementDistance: 0 }), 'q'), /0보다 크고/);
  assert.match(getCharacterSkillMovementError(movementSkill({ movementMode: 'teleport' }), 'q'), /이동 방향/);
  assert.match(getCharacterSkillMovementError({ enabled: true, includesMovement: true, movementDistance: 1 }, 'passive'), /패시브/);
});

check('toward movement changes the live coordinate without overshooting its target', () => {
  const a = row('a', 4); const b = row('b', 10);
  const first = resolveCharacterSkillMovement(a, b, movementSkill(), { nowSec: 10, castId: 'a:1' });
  assert.equal(first.actualDistance, 3); assert.deepEqual(a._spatial, { zoneId: 'zone', x: 7, y: 4 });
  a._spatial = { zoneId: 'zone', x: 4, y: 4 };
  const stop = resolveCharacterSkillMovement(a, b, movementSkill({ movementDistance: 10 }), { nowSec: 11, castId: 'a:2' });
  assert.equal(stop.actualDistance, 6); assert.equal(stop.stoppedAtTarget, true); assert.equal(a._spatial.x, 10);
});

check('away movement follows the opposite ray and clips at the first arena edge', () => {
  const a = row('a', 23); const b = row('b', 20);
  const result = resolveCharacterSkillMovement(a, b, movementSkill({ movementMode: 'away_from_target', movementDistance: 4 }),
    { nowSec: 10, castId: 'a:1' });
  assert.equal(result.actualDistance, 1); assert.equal(result.clipped, true); assert.equal(a._spatial.x, 24);
});

check('one cast receipt cannot move the actor twice', () => {
  const a = row('a', 4); const b = row('b', 12); const def = movementSkill();
  assert.ok(resolveCharacterSkillMovement(a, b, def, { nowSec: 10, castId: 'a:1' }));
  assert.equal(resolveCharacterSkillMovement(a, b, def, { nowSec: 10, castId: 'a:1' }), null);
  assert.equal(a._spatial.x, 7);
});

check('movement refuses roots, foreign regions and foreign combat spaces', () => {
  const b = row('b', 10);
  assert.equal(getCharacterSkillMovementEstimate(row('rooted', 4, { activeEffects: [effect('속박', 2)] }), b, movementSkill()), null);
  assert.equal(getCharacterSkillMovementEstimate(row('remote', 4, { zoneId: 'other', _spatial: { zoneId: 'other', x: 4, y: 4 } }), b, movementSkill()), null);
  const rift = row('rift', 4, { _combatSpaceId: 'dimension_rift:r1', _spatial: { zoneId: 'zone', combatSpaceId: 'dimension_rift:r1', x: 4, y: 4 } });
  assert.equal(getCharacterSkillMovementEstimate(rift, b, movementSkill()), null);
});

check('movement-only AI closes a real attack gap but does not spam inside attack range', () => {
  const a = row('a', 4); const far = row('b', 10);
  const def = movementSkill();
  const use = selectCharacterSkillAiDecision({ attacker: a, defender: far, def, estimateDamage: () => ({ damage: 0 }), opts: { visionRoster: [a, far] } });
  assert.equal(use.shouldUse, true); assert.equal(use.reason, 'movement_toward_target');
  const near = row('near', 5);
  assert.equal(selectCharacterSkillAiDecision({ attacker: a, defender: near, def, estimateDamage: () => ({ damage: 0 }), opts: { visionRoster: [a, near] } }).shouldUse, false);
});

check('movement-only retreat AI waits for low health and a direction with room', () => {
  const def = movementSkill({ movementMode: 'away_from_target' }); const b = row('b', 10);
  const healthy = row('a', 4, { hp: 900 });
  const low = row('low', 4, { hp: 500 });
  assert.equal(selectCharacterSkillAiDecision({ attacker: healthy, defender: b, def, estimateDamage: () => ({ damage: 0 }), opts: { visionRoster: [healthy, b] } }).shouldUse, false);
  const decision = selectCharacterSkillAiDecision({ attacker: low, defender: b, def, estimateDamage: () => ({ damage: 0 }), opts: { visionRoster: [low, b] } });
  assert.equal(decision.shouldUse, true); assert.equal(decision.reason, 'movement_away_from_target');
});

check('scheduled movement happens at release, emits evidence and keeps the same combat space', () => {
  const a = row('a', 4, { characterSkills: { q: movementSkill() } }); const b = row('b', 10); const events = [];
  const choice = findCharacterSkillChoice(a, [b], [a, b], 100, {});
  assert.ok(choice); assert.equal(startCharacterCast(a, choice, 100, {}, {}), true); assert.equal(a._spatial.x, 4);
  const prepared = finishCharacterCast(a, 100.5, {});
  const result = applyPreparedCharacterSkill(a, b, prepared, { nowSec: 100.5, settings: {}, visionRoster: [a, b],
    emitRunEvent: (kind, data) => events.push({ kind, ...data }) });
  assert.equal(a._spatial.x, 7); assert.equal(result.movement.actualDistance, 3);
  assert.equal(events.find((event) => event.kind === 'spatial_displacement').sourceKind, 'character_skill');
  assert.equal(a._combatSpaceId, undefined);
});

check('scheduled movement uses metres inside one valid rift without changing admission or field region', () => {
  const { a, b } = riftPair(); a.characterSkills = { q: movementSkill() };
  const entry = structuredClone(a._dimensionRiftEntry); const events = [];
  const choice = findCharacterSkillChoice(a, [b], [a, b], 110, {});
  assert.ok(choice); assert.equal(startCharacterCast(a, choice, 110, {}, {}), true);
  const prepared = finishCharacterCast(a, 110.5, {});
  const result = applyPreparedCharacterSkill(a, b, prepared, { nowSec: 110.5, settings: {}, visionRoster: [a, b],
    emitRunEvent: (kind, data) => events.push({ kind, ...data }) });
  assert.equal(result.movement.actualDistance, 3); assert.equal(a._spatial.x, 7);
  assert.equal(a.zoneId, 'zone'); assert.equal(a._combatSpaceId, 'dimension_rift:r1');
  assert.deepEqual(a._dimensionRiftEntry, entry);
  assert.equal(events.filter((event) => event.kind === 'spatial_displacement').length, 1);
});

check('rift movement fails closed before a future admission and starts exactly at its admission boundary', () => {
  const { a, b } = riftPair(110); const def = movementSkill();
  const before = structuredClone(a);
  assert.equal(getCharacterSkillMovementEstimate(a, b, def, { nowSec: 109.999 }), null);
  assert.equal(resolveCharacterSkillMovement(a, b, def, { nowSec: 109.999, castId: 'too-early' }), null);
  assert.deepEqual(a, before);
  const atBoundary = resolveCharacterSkillMovement(a, b, def, { nowSec: 110, castId: 'at-entry' });
  assert.equal(atBoundary.actualDistance, 3); assert.equal(a._spatial.x, 7);

  const malformed = riftPair(); malformed.b._dimensionRiftEntry = null;
  assert.equal(getCharacterSkillMovementEstimate(malformed.a, malformed.b, def, { nowSec: 110 }), null);
  assert.equal(findCharacterSkillChoice(malformed.a, [malformed.b], [malformed.a, malformed.b], 110, {}), null);
});

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

check('guest and account save contracts round-trip movement fields', () => {
  const raw = { id: 'guest-survivor-01', name: '이동가', tacticalSkill: '블링크', characterSkills: { q: movementSkill() } };
  const guest = saveGuestCharacterProfile(raw, new MemoryStorage());
  assert.equal(guest.ok, true); assert.equal(guest.profile.characterSkills.q.movementDistance, 3);
  assert.equal(saveGuestCharacterProfile({ ...raw, characterSkills: { q: movementSkill({ movementDistance: 11 }) } }, new MemoryStorage()).ok, false);
  const compact = compactCharacterForSave({ _id: '1234567890abcdef12345678', name: 'A', stats: {}, characterSkills: raw.characterSkills });
  assert.equal(compact.characterSkills.q.movementMode, 'toward_target');
  assert.deepEqual(findCharacterSaveMismatches([compact], [structuredClone(compact)]), []);
});

check('observer and server history distinguish character movement from rift movement and knockback', () => {
  const text = describeObserverEvent({ kind: 'spatial_displacement', who: 'a', targetId: 'b', sourceKind: 'character_skill',
    reason: 'character_skill_movement', skill: '돌진', movementMode: 'toward_target', actualDistance: 3 }, { nameOf: String, zoneName: String });
  assert.match(text, /돌진 3m/); assert.doesNotMatch(text, /틈 내부 넉백/);
  const route = readFileSync(new URL('../../server/routes/characters.js', import.meta.url), 'utf8');
  const finish = readFileSync(new URL('../src/app/simulation/_lib/finishGameRuntime.js', import.meta.url), 'utf8');
  assert.match(route, /movementDistance/); assert.match(route, /away_from_target/);
  assert.match(finish, /'actualDistance'/); assert.match(finish, /'movementMode'/);
});

console.log(`CHARACTER_SKILL_MOVEMENT_CHECKS ${checks}/${checks}`);
