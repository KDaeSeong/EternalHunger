import { simulationRandom } from './simulationRandom.js';
import { commitRuntimeHpDamage, isDimensionRiftDefeated } from './dimensionRiftDefeatLogic.js';
import { getActorDimensionRiftId, getCombatSpaceId, shareCombatSpace, WORLD_COMBAT_SPACE } from './combatSpaceLogic.js';
import {
  EFFECT_SHIELD,
  EFFECT_CLEANSE,
  EFFECT_UNSTOPPABLE,
  EFFECT_SLOW,
  EFFECT_KNOCKBACK,
  canonicalizeEffectName,
  effectMetaByName,
  getActiveStatusEffects,
  getStoredActiveStatusEffects,
  getStatusProtectionReason,
  isHarmfulStatusEffect,
  canReduceControlDuration,
  normalizeStatusEffect,
  safeTags,
} from './statusEffectDefinitions.js';
import { applyHealingModifier, getDamageBlockReason, isTargetableByStatus } from './statusEffectSelectors.js';
import { getEffectiveStats } from './statusEffectiveStats.js';
import { getCombatEquipment } from './battleEquipmentLogic.js';

function collectImmunities(character) {
  const out = new Set();
  const fromActor = Array.isArray(character?.statusImmunities) ? character.statusImmunities : [];
  fromActor.forEach((key) => {
    const canon = canonicalizeEffectName(key);
    if (canon) out.add(canon);
  });
  getActiveStatusEffects(character).forEach((eff) => {
    (Array.isArray(eff?.grantsImmunity) ? eff.grantsImmunity : []).forEach((key) => {
      const canon = canonicalizeEffectName(key);
      if (canon) out.add(canon);
    });
  });
  return out;
}

function getStatusResist(character, effectName) {
  const key = canonicalizeEffectName(effectName);
  const map = character?.statusResists && typeof character.statusResists === 'object'
    ? character.statusResists
    : {};
  const raw = Number(map?.[key] || 0);
  if (!Number.isFinite(raw)) return 0;
  const ratio = Math.abs(raw) > 1 ? raw / 100 : raw;
  return Math.max(0, Math.min(0.95, ratio));
}

export function hasEffectImmunity(character, effectLike, opts = {}) {
  const key = canonicalizeEffectName(effectLike?.name || effectLike);
  if (!key) return { immune: false, resisted: false, resistRoll: 0 };
  const immunities = collectImmunities(character);
  if (immunities.has(key)) return { immune: true, resisted: false, resistRoll: 1 };
  const effect = typeof effectLike === 'object' ? effectLike : { name: key };
  const protection = getStatusProtectionReason(character, effect);
  if (protection && protection !== EFFECT_UNSTOPPABLE) return { immune: true, resisted: false, resistRoll: 1, immunityType: protection };
  const resist = getStatusResist(character, key);
  const rng = typeof opts?.random === 'function' ? opts.random : simulationRandom;
  if (resist > 0 && rng() < resist) return { immune: false, resisted: true, resistRoll: resist };
  return { immune: false, resisted: false, resistRoll: resist };
}

export function getStatusDurationAdjustment(character, effect) {
  const originalSec = effect.remainingDuration;
  if (originalSec == null || !Number.isFinite(originalSec) || !canReduceControlDuration(effect)) return null;
  const stats = getEffectiveStats(character);
  const ratio = (key) => Math.max(0, Math.min(1, Number(stats[key] || 0) + getCombatEquipment(character)
    .reduce((total, item) => total + (Number.isFinite(Number(item.stats?.[key])) ? Number(item.stats[key]) : 0), 0)));
  const ccReduction = ratio('ccDurationReduction');
  const slowReduction = canonicalizeEffectName(effect.name) === EFFECT_SLOW ? ratio('slowDurationReduction') : 0;
  if (!ccReduction && !slowReduction) return null;
  return { originalSec, appliedSec: Math.round(originalSec * (1 - ccReduction) * (1 - slowReduction) * 1e6) / 1e6,
    ccReduction, slowReduction };
}

export function addOrRefreshEffect(character, effect, opts = {}) {
  let normalized = normalizeStatusEffect(effect);
  const baseList = getStoredActiveStatusEffects(character);
  if (isDimensionRiftDefeated(opts.sourceActor)) {
    return { character: { ...(character || {}), activeEffects: baseList }, applied: false, reason: 'rift_defeated', effect: normalized };
  }
  if (opts.sourceActor && !shareCombatSpace(opts.sourceActor, character)) {
    return { character: { ...(character || {}), activeEffects: baseList }, applied: false, reason: 'combat_space', effect: normalized };
  }
  if (!normalized?.name || (normalized.name !== EFFECT_CLEANSE && normalized.remainingDuration != null && normalized.remainingDuration <= 0)) {
    return { character: { ...(character || {}), activeEffects: baseList }, applied: false, reason: 'invalid' };
  }

  if (!isTargetableByStatus(character)) {
    return { character: { ...(character || {}), activeEffects: baseList }, applied: false, reason: 'untargetable', effect: normalized };
  }
  if (normalized.name === EFFECT_CLEANSE) {
    const cleared = purgeNegativeEffects(character, { removeAllNegative: true });
    return { ...cleared, applied: true, reason: 'cleansed', effect: normalized };
  }
  const immunity = hasEffectImmunity(character, normalized, opts);
  if (immunity.immune) {
    return { character: { ...(character || {}), activeEffects: baseList }, applied: false, reason: 'immune',
      effect: normalized, immunityType: immunity.immunityType || normalized.name };
  }

  const durationAdjustment = getStatusDurationAdjustment(character, normalized);
  if (durationAdjustment) {
    normalized = { ...normalized, remainingDuration: durationAdjustment.appliedSec, durationUnit: 'sec' };
    if (normalized.remainingDuration <= 0) return { character: { ...(character || {}), activeEffects: baseList },
      applied: false, reason: 'duration_reduced', effect: normalized, durationAdjustment };
  }
  if (immunity.resisted) {
    return {
      character: { ...(character || {}), activeEffects: baseList },
      applied: false,
      reason: 'resisted',
      effect: normalized,
      resistRoll: immunity.resistRoll,
    };
  }

  if (effectMetaByName(normalized.name)?.forcedControl || normalized.name === EFFECT_KNOCKBACK) {
    const source = opts.sourceActor;
    const sourceActorId = String(source?._id || source?.id || normalized.sourceActorId || '');
    const position = source?._spatial || normalized.sourcePosition;
    normalized = { ...normalized, sourceActorId,
      sourcePosition: position && Number.isFinite(position.x) && Number.isFinite(position.y)
        ? { zoneId: String(position.zoneId || source?.zoneId || ''), x: position.x, y: position.y,
          combatSpaceId: source ? getCombatSpaceId(source) : String(position.combatSpaceId || WORLD_COMBAT_SPACE) } : null,
      controlSerial: baseList.reduce((max, row) => Math.max(max, Number.isSafeInteger(row.controlSerial) ? row.controlSerial : 0), 0) + 1 };
  }
  if (normalized.name === EFFECT_KNOCKBACK) {
    const previousSerial = character?._lastRiftKnockbackReceipt?.serial;
    const serial = baseList.reduce((max, row) => Math.max(max,
      Number.isSafeInteger(row.knockbackSerial) ? row.knockbackSerial : 0),
    Number.isSafeInteger(previousSerial) ? Math.max(0, previousSerial) : 0) + 1;
    const appliedAtSec = opts.nowSec ?? opts.at?.sec;
    const targetPosition = character?._spatial;
    normalized = { ...normalized, knockbackSerial: serial, knockbackConsumed: false,
      knockbackOutcome: '', knockbackTargetSpaceId: getCombatSpaceId(character),
      knockbackTargetPosition: targetPosition && Number.isFinite(targetPosition.x) && Number.isFinite(targetPosition.y)
        ? { zoneId: String(targetPosition.zoneId || character?.zoneId || ''), x: targetPosition.x, y: targetPosition.y,
          combatSpaceId: getCombatSpaceId(character) } : null,
      knockbackTargetEntryAtSec: getActorDimensionRiftId(character) ? character._dimensionRiftEntry.enteredAtSec : null,
      knockbackAppliedAtSec: Number.isFinite(appliedAtSec) && appliedAtSec >= 0 ? appliedAtSec : null };
  }

  const idx = baseList.findIndex((eff) => canonicalizeEffectName(eff?.name) === normalized.name);
  let activeEffects = baseList;
  let applied = false;
  let stacked = false;
  let refreshed = false;
  const longestDuration = (previous, incoming) => previous == null || incoming == null
    ? undefined : Math.max(previous, incoming);

  if (idx >= 0) {
    const prev = baseList[idx];
    const next = { ...prev, ...normalized };
    switch (normalized.stackMode) {
      case 'refresh_max':
        next.remainingDuration = longestDuration(prev.remainingDuration, normalized.remainingDuration);
        next.stacks = Math.min(Number(prev?.maxStacks || normalized.maxStacks || 1), Math.max(Number(prev?.stacks || 1), Number(normalized?.stacks || 1)));
        refreshed = true;
        break;
      case 'stack_refresh':
        next.remainingDuration = longestDuration(prev.remainingDuration, normalized.remainingDuration);
        next.stacks = Math.min(Number(prev?.maxStacks || normalized.maxStacks || 1), Number(prev?.stacks || 1) + Math.max(1, Number(normalized?.stacks || 1)));
        stacked = next.stacks > Number(prev?.stacks || 1);
        refreshed = true;
        break;
      case 'refresh_only':
        next.remainingDuration = longestDuration(prev.remainingDuration, normalized.remainingDuration);
        next.stacks = Math.max(1, Number(prev?.stacks || 1));
        refreshed = true;
        break;
      default:
        refreshed = true;
        break;
    }
    activeEffects = [...baseList];
    activeEffects[idx] = normalizeStatusEffect(next);
    applied = true;
  } else {
    activeEffects = [...baseList, normalized];
    applied = true;
    stacked = Number(normalized?.stacks || 1) > 1;
  }

  return {
    character: { ...(character || {}), activeEffects },
    applied,
    refreshed,
    stacked,
    ...(durationAdjustment ? { durationAdjustment } : {}),
    ...(getStatusProtectionReason(character, normalized) === EFFECT_UNSTOPPABLE ? { suppressedBy: EFFECT_UNSTOPPABLE } : {}),
    effect: activeEffects.find((eff) => canonicalizeEffectName(eff?.name) === normalized.name) || normalized,
  };
}

export function absorbShieldDamage(character, rawDamage) {
  const incoming = Math.max(0, Math.floor(Number(rawDamage || 0)));
  const list = getStoredActiveStatusEffects(character);
  const blockedReason = getDamageBlockReason(null, character);
  if (incoming > 0 && blockedReason) return {
    character: { ...(character || {}), activeEffects: list }, damage: 0,
    absorbed: 0, prevented: incoming, blockedReason, broken: false, depleted: [],
  };
  if (incoming <= 0 || !list.length) {
    return {
      character: { ...(character || {}), activeEffects: list },
      damage: incoming,
      absorbed: 0,
      broken: false,
      depleted: [],
    };
  }

  let remain = incoming;
  let absorbed = 0;
  let broken = false;
  const depleted = [];
  const nextEffects = [];

  list.forEach((eff) => {
    if (!eff) return;
    if (canonicalizeEffectName(eff?.name) !== EFFECT_SHIELD || getStatusProtectionReason(character, eff, list)) {
      nextEffects.push(eff);
      return;
    }
    const cur = Math.max(0, Number(eff?.shieldValue || 0));
    if (cur <= 0) return;
    if (remain <= 0) {
      nextEffects.push(eff);
      return;
    }
    const soak = Math.min(cur, remain);
    remain -= soak;
    absorbed += soak;
    const left = cur - soak;
    if (left > 0) nextEffects.push(normalizeStatusEffect({ ...eff, shieldValue: left }));
    else {
      broken = true;
      depleted.push(eff);
    }
  });

  return {
    character: { ...(character || {}), activeEffects: nextEffects },
    damage: remain,
    absorbed,
    broken,
    depleted,
  };
}

export function purgeNegativeEffects(character, opts = {}) {
  const names = new Set(
    (Array.isArray(opts?.names) ? opts.names : [])
      .map((x) => canonicalizeEffectName(x))
      .filter(Boolean)
  );
  const removeAllNegative = opts?.removeAllNegative === true;
  const list = Array.isArray(character?.activeEffects)
    ? character.activeEffects.map((eff) => normalizeStatusEffect(eff)).filter(Boolean)
    : [];
  const removed = [];
  const kept = list.filter((eff) => {
    const isNegative = isHarmfulStatusEffect(eff);
    const shouldRemove = names.has(canonicalizeEffectName(eff?.name)) || (removeAllNegative && isNegative);
    if (shouldRemove) removed.push(eff);
    return !shouldRemove;
  });
  return {
    character: { ...(character || {}), activeEffects: kept },
    removed,
    changed: removed.length > 0,
  };
}

export function updateEffects(character, opts = {}) {
  const activeEffects = Array.isArray(character?.activeEffects)
    ? character.activeEffects.map((eff) => normalizeStatusEffect(eff)).filter(Boolean)
    : [];

  const roundValue = (value) => Math.round(value * 1e6) / 1e6;
  const elapsedSec = roundValue(Math.max(0, Number(opts?.elapsedSec ?? opts?.deltaSec ?? 1) || 0));
  // An effect expiring inside the interval may change healing, immunity or
  // the net HP rate. Integrate each constant-rate segment just as the combat
  // clock would, so adding more attack frames cannot change status outcomes.
  const boundaries = [...new Set(activeEffects.map((effect) => Number(effect.remainingDuration))
    .filter((seconds) => seconds > 0 && seconds < elapsedSec)), elapsedSec].sort((a, b) => a - b);
  if (boundaries.length > 1) {
    let current = character; let cursor = 0; let hpChange = 0;
    const ticks = []; const expired = [];
    for (const boundary of boundaries) {
      const result = updateEffects(current, { ...opts,
        startSec: Number.isFinite(opts.startSec) ? roundValue(opts.startSec + cursor) : undefined,
        elapsedSec: roundValue(boundary - cursor), returnMeta: true });
      current = result.character; cursor = boundary; hpChange += result.hpChange;
      ticks.push(...result.ticks); expired.push(...result.expired);
    }
    return opts?.returnMeta ? { character: current, hpChange: roundValue(hpChange), ticks, expired } : current;
  }
  let hpChange = 0;
  const ticks = [];
  const expired = [];
  const tickCount = elapsedSec;
  // Invulnerability protects only its remaining portion of a batched tick.
  // Untargetability does not remove or suspend an already attached DOT.
  const damageImmuneSec = getActiveStatusEffects(character).reduce((max, effect) => {
    if (!effect.tags.includes('damage_immune')) return max;
    return Math.max(max, effect.remainingDuration == null ? elapsedSec : Math.min(elapsedSec, effect.remainingDuration));
  }, 0);

  const nextEffects = activeEffects
    .map((eff) => {
      const meta = effectMetaByName(eff?.name);
      const tags = new Set([...(meta?.tags || []), ...safeTags(eff?.tags)]);
      const stacks = Math.max(1, Number(eff?.stacks || 1));
      const dotDamage = Math.max(0, Number(eff?.dotDamage || meta?.defaultDotDamage || 0));
      const recovery = Math.max(0, Number(eff?.recovery || meta?.defaultRecovery || 0));
      const remainingBefore = eff.remainingDuration == null ? Infinity : Number(eff.remainingDuration);
      const activeSec = Number.isFinite(remainingBefore)
        ? Math.max(0, Math.min(elapsedSec, remainingBefore))
        : tickCount;
      const suppressed = getStatusProtectionReason(character, eff);

      if (!suppressed && !isDimensionRiftDefeated(character) && Number(character?.hp || 0) > 0 && activeSec > 0 && dotDamage > 0 && tags.has('dot')) {
        const damageSec = Math.max(0, activeSec - damageImmuneSec);
        const dmg = roundValue(dotDamage * stacks * damageSec);
        hpChange -= dmg;
        if (dmg > 0) ticks.push({ type: 'damage', name: eff.name, amount: dmg, stacks, seconds: damageSec,
          ...(eff.sourceActorId ? { sourceActorId: String(eff.sourceActorId) } : {}) });
      }
      if (!suppressed && Number(character?.hp || 0) > 0 && activeSec > 0 && recovery > 0 && tags.has('regen')) {
        // Preserve the established integer healing rate per second, then
        // integrate that rate. Splitting a second into attacks cannot lose HP.
        const heal = roundValue(applyHealingModifier(character, recovery * stacks) * activeSec);
        hpChange += heal;
        ticks.push({ type: 'heal', name: eff.name, amount: heal, stacks, seconds: activeSec });
      }

      if (eff?.remainingDuration == null) return eff;
      const remainingDuration = Math.max(0, Math.round((Number(eff.remainingDuration || 0) - elapsedSec) * 1e6) / 1e6);
      const next = normalizeStatusEffect({ ...eff, remainingDuration, durationUnit: 'sec' });
      if (remainingDuration <= 0) expired.push(next);
      return next;
    })
    .filter((eff) => Number(eff?.remainingDuration ?? 1) > 0);

  const maxHp = Math.max(1, Number(character?.maxHp || character?.hp || 100));
  const nextCharacter = {
    ...(character || {}),
    activeEffects: nextEffects,
    hp: Number(character?.hp || 0),
  };
  if (hpChange < 0) {
    const before = nextCharacter.hp;
    const damageTicks = ticks.filter((tick) => tick.type === 'damage');
    const sources = [...new Set(damageTicks.map((tick) => tick.sourceActorId).filter(Boolean))];
    const crossingOffset = Math.min(elapsedSec, before / (-hpChange / elapsedSec));
    const result = commitRuntimeHpDamage(nextCharacter, -hpChange, {
      atSec: Number.isFinite(opts.startSec) ? roundValue(opts.startSec + crossingOffset) : null,
      cause: damageTicks.length === 1 ? damageTicks[0].name : 'status_effect',
      by: sources.length === 1 && damageTicks.every((tick) => tick.sourceActorId === sources[0]) ? sources[0] : '', sourceActorIds: sources,
    });
    if (result.defeat) hpChange = -result.hpDamage;
  } else {
    nextCharacter.hp = Math.max(0, Math.min(maxHp, roundValue(nextCharacter.hp + hpChange)));
  }

  if (!opts?.returnMeta) return nextCharacter;
  return {
    character: nextCharacter,
    hpChange: roundValue(hpChange),
    ticks,
    expired,
  };
}
