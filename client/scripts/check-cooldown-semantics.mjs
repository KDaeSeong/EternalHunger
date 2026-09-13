import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

// Written during the verification pause. No test/build/runtime execution yet.
const { normalizeErStats } = await import('../src/utils/erStats.js');
const { getEquipStatTotals } = await import('../src/utils/battleEquipmentLogic.js');
const { createDefaultCompiledSkill } = await import('../src/utils/characterSkillCompilerCore.js');
const {
  getActorCooldownReductions,
  getCooldownProgressSeconds,
  predictCooldownReadyAt,
  advanceActorCooldownClock,
  resolveCharacterSkillCooldownSec,
  resolveTacticalSkillCooldownSec,
  resolveWeaponSkillCooldownSec,
} = await import('../src/app/simulation/_lib/cooldownRuntime.js');

let checks = 0;
function check(name, run) { run(); checks += 1; console.log(`PASS ${name}`); }
const actor = (stats = {}, extra = {}) => ({ _id: 'actor', hp: 100, maxHp: 100, stats, inventory: [], ...extra });

check('cooldown stats normalize as ratios without inventing a bonus', () => {
  const defaults = normalizeErStats({});
  assert.equal(defaults.cooldownReduction, 0);
  assert.equal(defaults.ultimateCooldownReduction, 0);
  assert.equal(defaults.tacticalCooldownReduction, 0);
  const capped = normalizeErStats({ cooldownReduction: 2, ultimateCooldownReduction: -1, tacticalCooldownReduction: 0.25 });
  assert.equal(capped.cooldownReduction, 1); assert.equal(capped.ultimateCooldownReduction, 0);
  assert.equal(capped.tacticalCooldownReduction, 0.25);
});

check('ordinary character skills use general cooldown reduction', () => {
  const value = resolveCharacterSkillCooldownSec(actor({ cooldownReduction: 0.2 }), { slot: 'q', cooldownSec: 10 });
  assert.equal(value, 8);
});

check('ultimate reduction stacks multiplicatively only on R', () => {
  const unit = actor({ cooldownReduction: 0.2, ultimateCooldownReduction: 0.25 });
  assert.equal(resolveCharacterSkillCooldownSec(unit, { slot: 'q', cooldownSec: 10 }), 8);
  assert.equal(resolveCharacterSkillCooldownSec(unit, { slot: 'r', cooldownSec: 10 }), 6);
});

check('fixed character cooldown ignores both character reduction stats', () => {
  const unit = actor({ cooldownReduction: 0.8, ultimateCooldownReduction: 0.8 });
  assert.equal(resolveCharacterSkillCooldownSec(unit, { slot: 'r', cooldownSec: 10, cooldownFixed: true }), 10);
});

check('equipment CDR accepts percentage catalog values instead of turning 10 into 75 percent', () => {
  const unit = actor({}, { inventory: [{ itemId: 'weapon', type: 'weapon', tier: 1, stats: { cdr: 10 } }] });
  assert.equal(getEquipStatTotals(unit).cdr, 0.1);
  assert.equal(getActorCooldownReductions(unit).skill, 0.1);
  assert.equal(resolveWeaponSkillCooldownSec(unit, 20), 18);
});

check('passive cooldown stats join the same effective-stat path', () => {
  const unit = actor({ cooldownReduction: 0.1 }, { characterSkills: { passive: {
    enabled: true, statModifiers: { cooldownReduction: 0.2 },
  } } });
  assert.equal(resolveCharacterSkillCooldownSec(unit, { slot: 'w', cooldownSec: 10 }), 7);
});

check('tactical reduction is separate and Blink retains its fixed cooldown', () => {
  const unit = actor({ cooldownReduction: 0.8, tacticalCooldownReduction: 0.25 });
  assert.equal(resolveTacticalSkillCooldownSec(unit, '붉은 폭풍', 1), 30);
  assert.equal(resolveTacticalSkillCooldownSec(unit, '블링크', 1), 90);
});

check('authoring keeps the explicit fixed-cooldown flag', () => {
  const skill = createDefaultCompiledSkill({ slot: 'r', enabled: true, cooldownSec: 60, cooldownFixed: true }, 'r');
  assert.equal(skill.cooldownFixed, true);
});

check('cooldown-rate effects integrate their fractional expiry boundary', () => {
  const unit = actor({}, { activeEffects: [{ name: '가속', remainingDuration: 0.5, durationUnit: 'sec', cooldownRateBonus: 0.5 }] });
  assert.equal(getCooldownProgressSeconds(unit, 1), 1.25);
});

check('cooldown-rate penalties slow the same clock without reversing it', () => {
  const unit = actor({}, { activeEffects: [{ name: '둔화', remainingDuration: 2, durationUnit: 'sec', cooldownRatePenalty: 0.5 }] });
  assert.equal(getCooldownProgressSeconds(unit, 1), 0.5);
});

check('cooldown readiness predicts the exact boundary before an active rate effect expires', () => {
  const unit = actor({}, { activeEffects: [{ name: '가속', remainingDuration: 2, durationUnit: 'sec', cooldownRateBonus: 0.5 }] });
  assert.equal(predictCooldownReadyAt(unit, 4, 0), 3);
});

check('elapsed cooldown work updates character, weapon and tactical deadlines but not recast windows', () => {
  const unit = actor({}, { _weaponSkillNextAbsSec: 10, _tacNextAbsSec: 12,
    skillState: { q: { cooldownUntil: 8, recastUntil: 6 } },
    activeEffects: [{ name: '가속', remainingDuration: 2, durationUnit: 'sec', cooldownRateBonus: 0.5 }] });
  const out = advanceActorCooldownClock(unit, 0, 1);
  assert.equal(out.progressSec, 1.5); assert.equal(unit._weaponSkillNextAbsSec, 9.5);
  assert.equal(unit._tacNextAbsSec, 11.5); assert.equal(unit.skillState.q.cooldownUntil, 7.5);
  assert.equal(unit.skillState.q.recastUntil, 6);
});

check('ordinary time leaves absolute cooldown deadlines unchanged', () => {
  const unit = actor({}, { _tacNextAbsSec: 10, skillState: { r: { cooldownUntil: 12 } } });
  const out = advanceActorCooldownClock(unit, 2, 3);
  assert.equal(out.progressSec, 3); assert.equal(unit._tacNextAbsSec, 10);
  assert.equal(unit.skillState.r.cooldownUntil, 12);
});

console.log(`Cooldown-semantics checks: ${checks}`);
