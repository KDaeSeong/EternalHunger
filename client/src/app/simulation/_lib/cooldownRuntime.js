import { getEquipStatTotals } from '../../../utils/battleEquipmentLogic.js';
import { getActiveStatusEffects, getEffectiveStats } from '../../../utils/statusLogic.js';
import { getTacCooldownSec, isTacCooldownFixed } from '../../../utils/tacticalSkillCatalog.js';

const roundTime = (value) => Math.round(Number(value) * 1e6) / 1e6;
const reduction = (value) => Math.max(0, Math.min(0.95, Number(value) || 0));

function cooldownRateAt(effects, elapsedFromSnapshot) {
  const offset = Math.max(0, Number(elapsedFromSnapshot) || 0);
  let bonus = 0; let penalty = 0;
  for (const effect of effects) {
    const remaining = effect?.remainingDuration == null ? Infinity : Number(effect.remainingDuration);
    if (!(remaining > offset)) continue;
    const stacks = Math.max(1, Number(effect?.stacks || 1));
    bonus += Math.max(0, Number(effect?.cooldownRateBonus || 0)) * stacks;
    penalty += Math.max(0, Number(effect?.cooldownRatePenalty || 0)) * stacks;
  }
  return Math.max(0.25, Math.min(2.5, 1 + bonus - penalty));
}

function cooldownBoundaries(effects, start, end = Infinity) {
  return [...new Set(effects.map((effect) => Number(effect?.remainingDuration))
    .filter((remaining) => Number.isFinite(remaining) && remaining > start && remaining < end))].sort((a, b) => a - b);
}

export function getCooldownProgressSeconds(effectSource, elapsedSec, elapsedFromSnapshot = 0) {
  const duration = Math.max(0, Number(elapsedSec) || 0);
  if (duration <= 0) return 0;
  const effects = getActiveStatusEffects(effectSource);
  const start = Math.max(0, Number(elapsedFromSnapshot) || 0);
  const end = start + duration;
  let cursor = start; let progress = 0;
  for (const boundary of [...cooldownBoundaries(effects, start, end), end]) {
    const segment = boundary - cursor;
    if (segment > 0) progress += segment * cooldownRateAt(effects, cursor + segment / 2);
    cursor = boundary;
  }
  return roundTime(progress);
}

export function predictCooldownReadyAt(effectSource, cooldownUntil, nowSec, elapsedFromSnapshot = 0) {
  const now = Number(nowSec) || 0;
  let work = Math.max(0, Number(cooldownUntil || 0) - now);
  if (work <= 0) return now;
  const effects = getActiveStatusEffects(effectSource);
  const start = Math.max(0, Number(elapsedFromSnapshot) || 0);
  let cursor = start; let duration = 0;
  for (const boundary of cooldownBoundaries(effects, start)) {
    const segment = boundary - cursor;
    const rate = cooldownRateAt(effects, cursor + segment / 2);
    const capacity = segment * rate;
    if (work <= capacity) return roundTime(now + duration + work / rate);
    work -= capacity; duration += segment; cursor = boundary;
  }
  return roundTime(now + duration + work / cooldownRateAt(effects, cursor + 1e-6));
}

export function advanceActorCooldownClock(actor, startSec, elapsedSec, options = {}) {
  if (!actor) return { progressSec: 0, ready: [] };
  const start = Number(startSec) || 0;
  const elapsed = Math.max(0, Number(elapsedSec) || 0);
  const end = roundTime(start + elapsed);
  const effectSource = options.effectSource || actor;
  const effectAge = Math.max(0, Number(options.effectElapsedSec) || 0);
  const progressSec = getCooldownProgressSeconds(effectSource, elapsed, effectAge);
  const ready = [];
  const advanceDeadline = (owner, key, label) => {
    const deadline = Number(owner?.[key]);
    if (!owner || !Number.isFinite(deadline) || deadline <= start) return;
    const work = deadline - start;
    if (progressSec >= work) {
      owner[key] = predictCooldownReadyAt(effectSource, deadline, start, effectAge);
      ready.push(label);
      return;
    }
    owner[key] = roundTime(end + work - progressSec);
  };
  advanceDeadline(actor, '_weaponSkillNextAbsSec', 'weapon');
  advanceDeadline(actor, '_tacNextAbsSec', 'tactical');
  for (const [slot, state] of Object.entries(actor.skillState && typeof actor.skillState === 'object' ? actor.skillState : {})) {
    if (!state || typeof state !== 'object') continue;
    advanceDeadline(state, 'cooldownUntil', `character:${slot}`);
  }
  return { progressSec, ready };
}

function settingsCooldownScale(settings = {}) {
  const skills = settings?.skills && typeof settings.skills === 'object' ? settings.skills : {};
  return Math.max(0.25, Math.min(4, Number(skills.cooldownScale ?? 1) || 1));
}

export function getActorCooldownReductions(actor) {
  const stats = getEffectiveStats(actor);
  const equipment = getEquipStatTotals(actor);
  return {
    skill: reduction(Number(stats.cooldownReduction || 0) + Number(equipment.cdr || 0)),
    ultimate: reduction(stats.ultimateCooldownReduction),
    tactical: reduction(stats.tacticalCooldownReduction),
  };
}

export function resolveCharacterSkillCooldownSec(actor, def, settings = {}) {
  const base = Math.max(0.25, Number(def?.cooldownSec || 1));
  let scale = settingsCooldownScale(settings);
  if (def?.cooldownFixed !== true) {
    const reductions = getActorCooldownReductions(actor);
    scale *= 1 - reductions.skill;
    if (String(def?.slot || '').toLowerCase() === 'r') scale *= 1 - reductions.ultimate;
  }
  return Math.max(0.25, roundTime(base * scale));
}

export function resolveWeaponSkillCooldownSec(actor, baseCooldownSec) {
  const reductions = getActorCooldownReductions(actor);
  const base = Math.max(1, Number(baseCooldownSec || 1));
  return Math.max(1, roundTime(base * (1 - reductions.skill)));
}

export function resolveTacticalSkillCooldownSec(actor, skillName, level = 1) {
  const base = getTacCooldownSec(skillName, level);
  if (isTacCooldownFixed(skillName)) return base;
  const reductions = getActorCooldownReductions(actor);
  return Math.max(1, roundTime(base * (1 - reductions.tactical)));
}
