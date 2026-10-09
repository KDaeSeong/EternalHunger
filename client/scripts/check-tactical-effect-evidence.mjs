import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import './lib/register-simulation-modules.mjs';

const { createPhaseCombatTacticalRuntime } = await import('../src/app/simulation/_lib/phaseCombatTacticalRuntime.js');
const { applyCombatHit } = await import('../src/app/simulation/_lib/combatImpactRuntime.js');
const { describeObserverEvent } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { resolveTacticalSkillCooldownSec } = await import('../src/app/simulation/_lib/cooldownRuntime.js');
const { makeShieldEffect, makeHealReductionEffect } = await import('../src/utils/statusEffectDefinitions.js');
const { readTacticalEffectReceipt, buildTacticalEffectSummary } = await import('../src/app/simulation/_lib/tacticalEffectEvidenceRuntime.js');
const { buildTacticalImpactEvidence } = await import('./lib/tactical-impact-evidence.mjs');

let checks = 0;
let failures = 0;
function check(name, run) {
  checks += 1;
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failures += 1; console.error(`FAIL ${name}: ${error.message}`); }
}
const actor = (id, extra = {}) => ({ _id: id, name: id, teamId: id, zoneId: 'z', hp: 60, maxHp: 100,
  inventory: [], simCredits: 17, stats: {}, activeEffects: [], ...extra });
function runtime(nowSec = 100) {
  const events = [];
  const at = { day: 1, phase: 'night', sec: nowSec };
  const emitRunEvent = (kind, payload, time) => events.push({ kind, ...structuredClone(payload), at: structuredClone(time) });
  const tactical = createPhaseCombatTacticalRuntime({ state: { absNow: nowSec },
    actions: { atNow: () => at, emitRunEvent } });
  return { events, at, emitRunEvent, tactical };
}
const skills = (events) => events.filter((event) => event.kind === 'skill');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

check('Artifact lethal prevention emits one activation and commits the same real HP loss', () => {
  const source = actor('source'); const target = actor('target', { tacticalSkill: '아티팩트' });
  const { events, at, emitRunEvent, tactical } = runtime();
  const impact = applyCombatHit(source, target, { type: 'skill', damage: 160 },
    { shieldBlock: tactical.shieldBlock, emitRunEvent, at });
  assert.equal(target.hp, 1); assert.equal(impact.hpDamage, 59);
  assert.equal(target._tacNextAbsSec, 100 + resolveTacticalSkillCooldownSec(target, '아티팩트', 1));
  assert.equal(skills(events).length, 1, 'A real lethal prevention must not disappear from the event journal.');
  const event = skills(events)[0]; const receipt = event.tacticalEffect;
  assert.equal(event.source, 'tactical'); assert.equal(event.mode, 'combat_defense');
  assert.equal(event.who, 'target'); assert.equal(event.targetId, 'target'); assert.equal(event.opponentId, 'source');
  assert.equal(receipt.lethalPrevented, true); assert.equal(receipt.damageBefore, 160);
  assert.equal(receipt.damageAfter, 59); assert.equal(receipt.damagePrevented, 101);
  assert.equal(receipt.hpBefore, 60); assert.equal(receipt.hpAfter, 60, 'Defense is recorded before downstream HP commitment.');
  assert.match(describeObserverEvent(event), /아티팩트.*치명타격 무효/);
});

check('an existing shield is not attributed to the newly activated tactical defense', () => {
  const target = actor('target', { tacticalSkill: '초월', activeEffects: [makeShieldEffect(5, 10, 'old-shield')] });
  const { events, tactical } = runtime();
  const remaining = tactical.shieldBlock(target, 30);
  const receipt = skills(events)[0]?.tacticalEffect;
  assert.ok(receipt, 'Tactical defense needs its own measured receipt.');
  assert.equal(receipt.existingShieldAbsorbed, 5); assert.equal(receipt.damageBefore, 25);
  assert.equal(receipt.damageAfter, remaining); assert.equal(receipt.damagePrevented, 18);
  assert.equal(receipt.damageBefore - receipt.damageAfter, receipt.damagePrevented);
  assert.equal(receipt.lethalPrevented, false);
});

check('an existing shield that absorbs the whole hit does not invent a tactical use', () => {
  const target = actor('target', { tacticalSkill: '초월', activeEffects: [makeShieldEffect(40, 10, 'old-shield')] });
  const { events, tactical } = runtime();
  assert.equal(tactical.shieldBlock(target, 30), 0); assert.equal(skills(events).length, 0);
  assert.equal(target._tacNextAbsSec, undefined);
});

check('a cooldown cannot rescue a second lethal hit or emit another activation', () => {
  const source = actor('source'); const target = actor('target', { tacticalSkill: '아티팩트' });
  const { events, at, emitRunEvent, tactical } = runtime();
  const hit = () => applyCombatHit(source, target, { type: 'skill', damage: 160 },
    { shieldBlock: tactical.shieldBlock, emitRunEvent, at });
  hit(); const cooldown = target._tacNextAbsSec; hit();
  assert.equal(target.hp, 0); assert.equal(skills(events).length, 1);
  assert.equal(target._tacNextAbsSec, cooldown);
});

check('silence and invulnerability do not fabricate a defensive activation', () => {
  for (const name of ['침묵', '무적']) {
    const source = actor('source'); const target = actor('target', { tacticalSkill: '아티팩트',
      activeEffects: [{ name, remainingDuration: 3, durationUnit: 'sec' }] });
    const { events, at, emitRunEvent, tactical } = runtime();
    applyCombatHit(source, target, { type: 'skill', damage: 160 }, { shieldBlock: tactical.shieldBlock, emitRunEvent, at });
    assert.equal(skills(events).length, 0); assert.equal(target._tacNextAbsSec, undefined);
  }
});

check('offensive healing records actual HP recovery and leaves inventory and credits untouched', () => {
  const source = actor('source', { tacticalSkill: '프로토콜 위반' }); const target = actor('target');
  const before = structuredClone({ inventory: source.inventory, credits: source.simCredits });
  const { events, tactical } = runtime();
  const damage = tactical.applyCombatTacAttack(source, target, 0);
  assert.equal(damage, 6); assert.equal(source.hp, 68);
  const event = skills(events)[0]; const receipt = event.tacticalEffect;
  assert.ok(receipt); assert.equal(event.targetId, 'target');
  assert.equal(receipt.hpBefore, 60); assert.equal(receipt.hpAfter, 68);
  assert.equal(receipt.hpRecovered, 8); assert.equal(receipt.hpSpent, 0);
  assert.equal(receipt.damageAdded, 6); assert.equal(receipt.damageAfter, damage);
  near(receipt.cooldownUntil, source._tacNextAbsSec);
  assert.deepEqual({ inventory: source.inventory, credits: source.simCredits }, before);
  assert.match(describeObserverEvent(event), /실제 회복 8/);
});

check('Healing Wind combat activation applies its catalog instant heal as well as ongoing regeneration', () => {
  const source = actor('source', { hp: 40, tacticalSkill: '치유의 바람' }); const target = actor('target');
  const { events, tactical } = runtime();
  assert.equal(tactical.applyCombatTacAttack(source, target, 0), 0);
  assert.equal(source.hp, 62, 'Combat must use the same configured healCap as the escape-heal path.');
  assert.equal(skills(events).length, 1);
  const receipt = skills(events)[0].tacticalEffect;
  assert.equal(receipt.hpBefore, 40); assert.equal(receipt.hpAfter, 62); assert.equal(receipt.hpRecovered, 22);
  assert.ok(source.activeEffects.some(effect => effect.recovery === 4));
  const savedCooldown = source._tacNextAbsSec;
  applyCombatHit(target, source, { type: 'basic', damage: 22 });
  tactical.applyCombatTacAttack(source, target, 0);
  assert.equal(source.hp, 40); assert.equal(skills(events).length, 1); assert.equal(source._tacNextAbsSec, savedCooldown);
});

check('Healing Wind respects healing reduction, max HP, module level and untouched inventory', () => {
  for (const [extra, expectedHp, expectedRecovery] of [
    [{ activeEffects: [makeHealReductionEffect(0.5, 10, 'anti-heal')] }, 51, 11],
    [{ maxHp: 45 }, 45, 5],
    [{ tacticalSkillLevel: 2 }, 70, 30],
  ]) {
    const source = actor('source', { hp: 40, tacticalSkill: '치유의 바람', ...extra }); const target = actor('target');
    const owned = structuredClone({ inventory: source.inventory, credits: source.simCredits });
    const { events, tactical } = runtime(); tactical.applyCombatTacAttack(source, target, 0);
    assert.equal(source.hp, expectedHp); assert.equal(skills(events)[0].tacticalEffect.hpRecovered, expectedRecovery);
    assert.ok(readTacticalEffectReceipt(skills(events)[0]));
    assert.deepEqual({ inventory: source.inventory, credits: source.simCredits }, owned);
  }
});

check('Healing Wind cannot heal a dead, silenced or above-threshold caster', () => {
  for (const extra of [{ hp: 0 }, { hp: 46 }, { activeEffects: [{ name: '침묵', remainingDuration: 3, durationUnit: 'sec' }] }]) {
    const source = actor('source', { hp: 40, tacticalSkill: '치유의 바람', ...extra }); const target = actor('target');
    const { events, tactical } = runtime(); const hpBefore = source.hp;
    tactical.applyCombatTacAttack(source, target, 0);
    assert.equal(source.hp, hpBefore); assert.equal(skills(events).length, 0); assert.equal(source._tacNextAbsSec, undefined);
  }
});

check('tactical bonus damage is an attack-stage amount, not a claim of committed HP damage', () => {
  const source = actor('source', { tacticalSkill: '진실의 칼날' }); const target = actor('target');
  const { events, tactical } = runtime();
  const damage = tactical.applyCombatTacAttack(source, target, 7);
  assert.equal(damage, 15); assert.equal(target.hp, 60);
  const receipt = skills(events)[0]?.tacticalEffect;
  assert.ok(receipt); assert.equal(receipt.damageBefore, 7); assert.equal(receipt.damageAfter, 15);
  assert.equal(receipt.damageAdded, 8); assert.equal(receipt.damagePrevented, 0);
  assert.match(describeObserverEvent(skills(events)[0]), /추가 원피해 8/);
  assert.doesNotMatch(describeObserverEvent(skills(events)[0]), /HP 감소 8/);
});

check('every real offensive and defensive receipt passes the same presentation validator', () => {
  for (const tac of ['아티팩트', '초월', '무효화', '프로토콜 위반', '진실의 칼날']) {
    const source = actor('source', { hp: 40, tacticalSkill: tac }); const target = actor('target');
    const { events, tactical } = runtime();
    if (['아티팩트', '초월', '무효화'].includes(tac)) tactical.shieldBlock(source, 160);
    else tactical.applyCombatTacAttack(source, target, 0);
    assert.equal(skills(events).length, 1);
    assert.ok(readTacticalEffectReceipt(skills(events)[0]), `Invalid actual receipt for ${tac}`);
  }
});

check('malformed or missing tactical evidence remains unknown instead of zero-effect proof', () => {
  const source = actor('source', { tacticalSkill: '프로토콜 위반' }); const target = actor('target');
  const { events, tactical } = runtime(); tactical.applyCombatTacAttack(source, target, 0);
  const valid = skills(events)[0];
  for (const alter of [
    (event) => { delete event.tacticalEffect; },
    (event) => { event.tacticalEffect.hpRecovered = null; },
    (event) => { event.tacticalEffect.hpRecovered = NaN; },
    (event) => { event.tacticalEffect.hpAfter += 1; },
    (event) => { event.tacticalEffect.damageAdded += 1; },
    (event) => { event.tacticalEffect.cooldownUntil = 99; },
    (event) => { event.tacticalEffect.cooldownBefore = 101; },
    (event) => { event.source = 'character_skill'; },
  ]) {
    const broken = structuredClone(valid); alter(broken);
    assert.equal(readTacticalEffectReceipt(broken), null);
    const out = buildTacticalEffectSummary([broken], 'source');
    assert.equal(out.uses, 1); assert.equal(out.recorded, 0); assert.equal(out.unrecorded, 1);
    assert.equal(out.hpRecovered, 0);
  }
});

check('malformed lethal-prevention claims cannot certify a living lethal hit or 1 HP remainder', () => {
  const valid = skills(actualDefenseJournal())[0];
  for (const alter of [
    (receipt) => { receipt.hpBefore = 0; receipt.hpAfter = 0; receipt.damageAfter = 0; receipt.damagePrevented = receipt.damageBefore; },
    (receipt) => { receipt.damageBefore = 59; receipt.damageAfter = 58; receipt.damagePrevented = 1; },
    (receipt) => { receipt.damageAfter = 58; receipt.damagePrevented = receipt.damageBefore - 58; },
  ]) {
    const broken = structuredClone(valid); alter(broken.tacticalEffect);
    assert.equal(readTacticalEffectReceipt(broken), null);
    const summary = buildTacticalEffectSummary([broken], 'target');
    assert.equal(summary.recorded, 0); assert.equal(summary.unrecorded, 1); assert.equal(summary.lethalPrevented, 0);
    assert.equal(describeObserverEvent(broken).includes('치명타격 무효'), false);
  }
});

check('real lethal-prevention accepts 1 HP and post-shield boundaries without inventing a lethal hit', () => {
  for (const [damage, extra, lethal, remaining] of [
    [12, { hp: 1 }, true, 0],
    [45, { hp: 30, activeEffects: [makeShieldEffect(5, 10, 'old-shield')] }, true, 29],
    [30, { hp: 30, activeEffects: [makeShieldEffect(5, 10, 'old-shield')] }, false, null],
  ]) {
    const events = actualDefenseJournal('아티팩트', damage, extra);
    const event = skills(events)[0]; const receipt = readTacticalEffectReceipt(event);
    assert.ok(receipt); assert.equal(receipt.lethalPrevented, lethal);
    if (remaining !== null) assert.equal(receipt.damageAfter, remaining);
    const impact = buildTacticalImpactEvidence(events);
    assert.equal(impact.defenses, 1); assert.equal(impact.matchedDefenses, 1); assert.equal(impact.unmatched.length, 0);
  }
});

check('summary only attributes actual direct receipts to the exact actor', () => {
  const source = actor('source', { tacticalSkill: '프로토콜 위반' }); const target = actor('target');
  const { events, tactical } = runtime(); tactical.applyCombatTacAttack(source, target, 0);
  const event = skills(events)[0];
  const out = buildTacticalEffectSummary([event, { ...event, who: 'other' },
    { ...event, mode: 'character_cast' }, { kind: 'effect', who: 'source', heal: 100 },
    { kind: 'skill', who: 'source', mode: 'flee', heal: 20 }], 'source');
  assert.equal(out.uses, 1); assert.equal(out.hpRecovered, 8); assert.equal(out.damageAdded, 6);
  assert.equal(out.recorded, 1); assert.equal(out.unrecorded, 0);
});

check('effect summary and description cannot mutate a frozen event or fabricate legacy details', () => {
  const source = actor('source', { tacticalSkill: '프로토콜 위반' }); const target = actor('target');
  const { events, tactical } = runtime(); tactical.applyCombatTacAttack(source, target, 0);
  const freeze = (value) => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const journal = freeze(structuredClone(events)); const before = JSON.stringify(journal);
  buildTacticalEffectSummary(journal, 'source'); describeObserverEvent(skills(journal)[0]);
  assert.equal(JSON.stringify(journal), before);
  const legacy = { kind: 'skill', who: 'source', skill: '기존 기술', targetId: 'target', heal: 3 };
  assert.match(describeObserverEvent(legacy), /기존 기술.*실제 회복 3/);
  assert.doesNotMatch(describeObserverEvent(legacy), /전술 단계 차단|재사용까지/);
});

function actualDefenseJournal(skill = '아티팩트', damage = 160, extra = {}) {
  const source = actor('source'); const target = actor('target', { tacticalSkill: skill, ...extra });
  const { events, at, emitRunEvent, tactical } = runtime();
  const packet = { type: 'skill', damage };
  const impact = applyCombatHit(source, target, packet, { shieldBlock: tactical.shieldBlock, emitRunEvent, at });
  emitRunEvent('damage', { who: 'source', targetId: 'target', ...impact.packet,
    hpBefore: impact.hpBefore, hpAfter: impact.hpAfter, hpDamage: impact.hpDamage, absorbed: impact.absorbed }, at);
  return events;
}

check('a real defensive activation joins its exact committed HP hit, including preexisting shields', () => {
  for (const [skill, damage] of [['아티팩트', 160], ['초월', 30]]) {
    const events = actualDefenseJournal(skill, damage, { activeEffects: [makeShieldEffect(5, 10, 'old-shield')] });
    const out = buildTacticalImpactEvidence(events, { actorIds: ['target'] });
    assert.equal(out.activations, 1); assert.equal(out.defenses, 1); assert.equal(out.matchedDefenses, 1);
    assert.equal(out.unmatched.length, 0); assert.equal(out.samples.length, 1);
    assert.equal(out.samples[0].damage.hpDamage, 60 - out.samples[0].damage.hpAfter);
  }
});

check('foreign attackers and nearby times cannot satisfy a defensive effect receipt', () => {
  for (const alter of [(event) => { event.who = 'other'; }, (event) => { event.at.sec += 0.001; }]) {
    const events = actualDefenseJournal(); alter(events.find(event => event.kind === 'damage'));
    const out = buildTacticalImpactEvidence(events);
    assert.equal(out.defenses, 1); assert.equal(out.matchedDefenses, 0); assert.equal(out.unmatched.length, 1);
  }
});

check('contradictory committed HP or overwritten activations fail the tactical impact audit', () => {
  const events = actualDefenseJournal();
  const brokenHp = structuredClone(events); brokenHp.find(event => event.kind === 'damage').hpAfter = 0;
  assert.throws(() => buildTacticalImpactEvidence(brokenHp), /committed HP loss/);
  const duplicated = [events[0], structuredClone(events[0]), ...events.slice(1)];
  assert.throws(() => buildTacticalImpactEvidence(duplicated), /overwrite an unobserved activation/);
});

function accountCompactors() {
  // Exercise the actual current save-path code, not archived output or an API mock.
  const server = readFileSync(new URL('../../server/routes/game.js', import.meta.url), 'utf8');
  const serverStart = server.indexOf('function compactRunEventsForStorage(');
  const serverEnd = server.indexOf('function buildRunSummary(', serverStart);
  assert.ok(serverStart >= 0 && serverEnd > serverStart, 'the actual server compactor must exist');
  const serverCompact = runInNewContext(`${server.slice(serverStart, serverEnd)}; compactRunEventsForStorage`);
  const finish = readFileSync(new URL('../src/app/simulation/_lib/finishGameRuntime.js', import.meta.url), 'utf8');
  const clientStart = finish.indexOf('const compactRunEvents =');
  const clientEnd = finish.indexOf('.filter(Boolean);', clientStart) + '.filter(Boolean);'.length;
  assert.ok(clientStart >= 0 && clientEnd > clientStart, 'the actual client compactor must exist');
  const clientCompact = (runEvents) => runInNewContext(
    `${finish.slice(clientStart, clientEnd)}; compactRunEvents`, { runEvents, readTacticalEffectReceipt });
  return { clientCompact, serverCompact };
}

function actualOffenseJournal(skill = '프로토콜 위반', extra = {}) {
  const source = actor('source', { hp: 40, tacticalSkill: skill, ...extra }); const target = actor('target');
  const { events, tactical } = runtime(); tactical.applyCombatTacAttack(source, target, 0);
  return events;
}
const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
const freezeTree = (value) => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeTree); Object.freeze(value); }
  return value;
};

check('actual tactical receipts survive client submission and server JSON storage with exact HP joins', () => {
  const { clientCompact, serverCompact } = accountCompactors();
  for (const journal of [actualDefenseJournal(), actualDefenseJournal('초월', 30),
    actualDefenseJournal('무효화', 30), actualOffenseJournal(), actualOffenseJournal('진실의 칼날'),
    actualOffenseJournal('치유의 바람'), actualOffenseJournal('치유의 바람', { tacticalSkillLevel: 2 })]) {
    const inputBefore = structuredClone(journal); const before = jsonCopy(journal); freezeTree(journal);
    const restored = jsonCopy(serverCompact(jsonCopy(clientCompact(journal))));
    assert.deepEqual(journal, inputBefore);
    assert.deepEqual(skills(restored), skills(before));
    for (const event of skills(restored)) assert.ok(readTacticalEffectReceipt(event));
    assert.deepEqual(buildTacticalImpactEvidence(restored), buildTacticalImpactEvidence(before));
    assert.equal(describeObserverEvent(skills(restored)[0]), describeObserverEvent(skills(before)[0]));
  }
});

check('each account compactor copies only the bounded tactical schema without nested aliases or secrets', () => {
  const { clientCompact, serverCompact } = accountCompactors();
  for (const compact of [clientCompact, serverCompact]) {
    const event = skills(actualDefenseJournal())[0];
    const expected = structuredClone(event.tacticalEffect);
    event.tacticalEffect.secret = { token: 'must-not-save' };
    event.tacticalEffect.extraNumbers = Array(1000).fill(1);
    freezeTree(event);
    const out = compact([event])[0];
    assert.notEqual(out.tacticalEffect, event.tacticalEffect);
    assert.deepEqual(jsonCopy(out.tacticalEffect), expected);
    out.tacticalEffect.damageBefore = 999;
    assert.equal(event.tacticalEffect.damageBefore, expected.damageBefore);
    assert.equal(event.tacticalEffect.secret.token, 'must-not-save');
    assert.equal(out.opponentId, 'source');
  }
});

check('both account compactors reject malformed tactical shapes and arithmetic instead of recording a zero', () => {
  const { clientCompact, serverCompact } = accountCompactors();
  for (const compact of [clientCompact, serverCompact]) {
    for (const alter of [
      (event) => { delete event.tacticalEffect; },
      (event) => { event.tacticalEffect.schema = 'unknown'; },
      (event) => { event.tacticalEffect.hpRecovered = null; },
      (event) => { event.tacticalEffect.damageBefore = Infinity; },
      (event) => { event.tacticalEffect.level = 3; },
      (event) => { event.tacticalEffect.lethalPrevented = 1; },
      (event) => { event.tacticalEffect.hpAfter += 1; },
      (event) => { event.tacticalEffect.damagePrevented += 1; },
      (event) => { event.tacticalEffect.cooldownUntil = 99; },
      (event) => { event.tacticalEffect.cooldownBefore = 101; },
      (event) => { event.at.sec = NaN; },
    ]) {
      const event = skills(actualDefenseJournal())[0]; alter(event); freezeTree(event);
      const restored = jsonCopy(compact([event]))[0];
      assert.equal(restored.tacticalEffect, undefined);
      assert.equal(restored.opponentId, undefined);
      const summary = buildTacticalEffectSummary([restored], 'target');
      assert.equal(summary.recorded, 0); assert.equal(summary.unrecorded, 1); assert.equal(summary.damagePrevented, 0);
    }
  }
});

check('account persistence does not upgrade a wrong-source event or a nonlethal hit into lethal prevention', () => {
  const { clientCompact, serverCompact } = accountCompactors();
  for (const compact of [clientCompact, serverCompact]) {
    for (const alter of [
      (event) => { event.kind = 'effect'; },
      (event) => { event.source = 'character_skill'; },
      (event) => { event.mode = 'escape_heal'; },
      (event) => { const r = event.tacticalEffect; r.hpBefore = 0; r.hpAfter = 0; r.damageAfter = 0; r.damagePrevented = r.damageBefore; },
      (event) => { const r = event.tacticalEffect; r.damageBefore = 59; r.damageAfter = 58; r.damagePrevented = 1; },
      (event) => { const r = event.tacticalEffect; r.damageAfter = 58; r.damagePrevented = r.damageBefore - 58; },
    ]) {
      const event = skills(actualDefenseJournal())[0]; alter(event); freezeTree(event);
      const restored = jsonCopy(compact([event]))[0];
      assert.equal(restored.tacticalEffect, undefined);
      assert.equal(restored.opponentId, undefined);
      assert.equal(describeObserverEvent(restored).includes('치명타격 무효'), false);
    }
  }
});

check('stored real 1 HP and existing-shield boundaries still retain the exact committed defense', () => {
  const { clientCompact, serverCompact } = accountCompactors();
  for (const [damage, extra] of [[12, { hp: 1 }],
    [45, { hp: 30, activeEffects: [makeShieldEffect(5, 10, 'old-shield')] }],
    [30, { hp: 30, activeEffects: [makeShieldEffect(5, 10, 'old-shield')] }]]) {
    const journal = actualDefenseJournal('아티팩트', damage, extra);
    const restored = jsonCopy(serverCompact(jsonCopy(clientCompact(freezeTree(journal)))));
    assert.ok(readTacticalEffectReceipt(skills(restored)[0]));
    const evidence = buildTacticalImpactEvidence(restored);
    assert.equal(evidence.defenses, 1); assert.equal(evidence.matchedDefenses, 1); assert.equal(evidence.unmatched.length, 0);
  }
});

check('account compaction retains its existing event caps rather than silently promising a full-match archive', () => {
  const { clientCompact, serverCompact } = accountCompactors();
  const journal = Array.from({ length: 2100 }, (_, index) => ({ kind: 'system', who: `actor-${index}` }));
  const submitted = jsonCopy(clientCompact(freezeTree(journal)));
  assert.equal(submitted.length, 1500); assert.equal(submitted[0].who, 'actor-600');
  const direct = jsonCopy(serverCompact(journal));
  assert.equal(direct.length, 2000); assert.equal(direct[0].who, 'actor-100');
  assert.equal(serverCompact(submitted).length, 1500);
});

console.log(`Tactical-effect evidence checks: ${checks - failures}/${checks}`);
if (failures) process.exitCode = 1;
