import {
  EFFECT_AIRBORNE,
  EFFECT_BURN,
  EFFECT_COOLDOWN_DOWN,
  EFFECT_COOLDOWN_UP,
  EFFECT_FOCUS,
  EFFECT_HEAL_REDUCTION,
  EFFECT_HASTE,
  EFFECT_KNOCKBACK,
  EFFECT_LIFESTEAL,
  EFFECT_META,
  EFFECT_POISON,
  EFFECT_REGEN,
  EFFECT_SHIELD,
  EFFECT_STIM,
  EFFECT_SLOW,
  EFFECT_STUN,
  absorbShieldDamage,
  addOrRefreshEffect,
  canonicalizeEffectName,
  normalizeStatusEffectList,
  purgeNegativeEffects,
} from '../../../utils/statusLogic';
import { getErStatLabel } from '../../../utils/erStats';

const INTERNAL_BOARD_SOURCE_PREFIXES = [
  'micro_',
];

const GENERIC_STAT_EFFECT_NAMES = new Set([
  EFFECT_FOCUS,
  EFFECT_STIM,
  'adrenaline',
  'focus',
  'sprint',
  '무기 템포',
  '각성',
]);

const SOURCE_KIND_LABELS = [
  { test: (sourceId) => sourceId.startsWith('er_trait_'), label: '특성 효과', icon: '⭐' },
  { test: (sourceId) => sourceId.startsWith('er_weapon_skill_'), label: '무기 스킬', icon: '⚔️' },
  { test: (sourceId) => sourceId.includes('_capsule_'), label: '아이템 효과', icon: '💊' },
  { test: (sourceId) => sourceId.includes('_food') || sourceId.includes('_drink') || sourceId.includes('_heal') || sourceId.includes('_guard') || sourceId.includes('_book'), label: '아이템 효과', icon: '🍱' },
  { test: (sourceId) => sourceId.includes('_tenacity') || sourceId.includes('_haste_stats'), label: '전술 효과', icon: '🎯' },
];

export function normalizeRuntimeEffect(effect) {
  if (!effect || typeof effect !== 'object') return null;
  const next = { ...effect };
  if (next?.remainingDuration != null) {
    const dur = Number(next.remainingDuration);
    const alreadySeconds = next?.durationUnit === 'sec' || next?.durationSec != null || dur > 10;
    next.remainingDuration = Number.isFinite(dur) ? Math.max(0, Math.floor(alreadySeconds ? dur : dur * 10)) : 0;
    next.durationUnit = 'sec';
  }
  if (next?.dotDamage != null) {
    const dot = Number(next.dotDamage);
    next.dotDamage = Number.isFinite(dot) ? Math.max(0, Math.floor(dot)) : 0;
  }
  if (next?.recovery != null) {
    const rec = Number(next.recovery);
    next.recovery = Number.isFinite(rec) ? Math.max(0, Math.floor(rec)) : 0;
  }
  if (next?.shieldValue != null) {
    const shield = Number(next.shieldValue);
    next.shieldValue = Number.isFinite(shield) ? Math.max(0, Math.floor(shield)) : 0;
  }
  if (next?.healReductionPct != null) {
    const value = Number(next.healReductionPct);
    next.healReductionPct = Number.isFinite(value) ? Math.max(0, Math.min(0.95, value)) : 0;
  }
  if (next?.moveSpeedBonus != null) {
    const value = Number(next.moveSpeedBonus);
    next.moveSpeedBonus = Number.isFinite(value) ? Math.max(-0.75, Math.min(1.5, value)) : 0;
  }
  if (next?.lifestealPct != null) {
    const value = Number(next.lifestealPct);
    next.lifestealPct = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  }
  if (next?.cooldownRateBonus != null) {
    const value = Number(next.cooldownRateBonus);
    next.cooldownRateBonus = Number.isFinite(value) ? Math.max(0, Math.min(1.5, value)) : 0;
  }
  if (next?.cooldownRatePenalty != null) {
    const value = Number(next.cooldownRatePenalty);
    next.cooldownRatePenalty = Number.isFinite(value) ? Math.max(0, Math.min(1.5, value)) : 0;
  }
  if (next?.knockbackDistance != null) {
    const value = Number(next.knockbackDistance);
    next.knockbackDistance = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }
  if (next?.sourceId != null) next.sourceId = String(next.sourceId || '');
  return next;
}

export function getEffectIndex(character, effectName) {
  const list = Array.isArray(character?.activeEffects) ? character.activeEffects : [];
  const key = canonicalizeEffectName(effectName);
  return list.findIndex((e) => canonicalizeEffectName(e?.name) === key);
}

export function hasActiveEffect(character, effectName) {
  return getEffectIndex(character, effectName) >= 0;
}

export function removeActiveEffect(character, effectName) {
  const list = Array.isArray(character?.activeEffects) ? character.activeEffects : [];
  const key = String(effectName || '');
  const next = list.filter((e) => String(e?.name || '') !== key);
  const removed = next.length !== list.length;
  if (removed) character.activeEffects = next;
  return removed;
}

export function applyStatusEffect(actor, effect, opts = {}) {
  if (!actor || typeof actor !== 'object') return { applied: false, reason: 'invalid' };
  const res = addOrRefreshEffect(actor, effect, opts);
  actor.activeEffects = Array.isArray(res?.character?.activeEffects)
    ? res.character.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean)
    : [];
  return res;
}

export function clearNegativeStatusEffects(actor, opts = {}) {
  if (!actor || typeof actor !== 'object') return { changed: false, removed: [] };
  const res = purgeNegativeEffects(actor, opts);
  actor.activeEffects = Array.isArray(res?.character?.activeEffects)
    ? res.character.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean)
    : [];
  return { changed: !!res?.changed, removed: Array.isArray(res?.removed) ? res.removed : [] };
}

export function applyShieldEffect(actor, shieldValue, duration = 2, sourceId = '') {
  const shield = Math.max(0, Math.floor(Number(shieldValue || 0)));
  if (!actor || shield <= 0) return { applied: false, shield: 0 };
  const res = applyStatusEffect(actor, {
    name: EFFECT_SHIELD,
    shieldValue: shield,
    remainingDuration: Math.max(1, Math.floor(Number(duration || 1))),
    stacks: 1,
    sourceId: String(sourceId || ''),
  });
  return { applied: !!res?.applied, shield };
}

export function applyRegenEffect(actor, recovery, duration = 2, sourceId = '') {
  const rec = Math.max(0, Math.floor(Number(recovery || 0)));
  if (!actor || rec <= 0) return { applied: false, recovery: 0 };
  const res = applyStatusEffect(actor, {
    name: EFFECT_REGEN,
    recovery: rec,
    remainingDuration: Math.max(1, Math.floor(Number(duration || 1))),
    stacks: 1,
    sourceId: String(sourceId || ''),
  });
  return { applied: !!res?.applied, recovery: rec };
}

function getEffectSourceKind(effect) {
  const sourceId = String(effect?.sourceId || '');
  return SOURCE_KIND_LABELS.find((row) => row.test(sourceId)) || null;
}

function getEffectDurationSec(effect) {
  const value = Number(effect?.remainingDuration);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

function getEffectStackSuffix(effect) {
  const stacks = Math.max(1, Math.floor(Number(effect?.stacks || 1)));
  return stacks > 1 ? ` x${stacks}` : '';
}

function getEffectDisplayName(effect) {
  const eff = normalizeRuntimeEffect(effect);
  if (!eff) return '';
  const name = canonicalizeEffectName(eff?.name || '');
  const sourceKind = getEffectSourceKind(eff);
  if (sourceKind && GENERIC_STAT_EFFECT_NAMES.has(name)) return sourceKind.label;
  return name || String(eff?.name || '');
}

function getEffectDisplayIcon(effect, displayName) {
  const eff = normalizeRuntimeEffect(effect);
  const sourceKind = getEffectSourceKind(eff);
  if (sourceKind && GENERIC_STAT_EFFECT_NAMES.has(canonicalizeEffectName(eff?.name || ''))) return sourceKind.icon;
  return String(eff?.icon || EFFECT_META?.[canonicalizeEffectName(displayName)]?.icon || EFFECT_META?.[canonicalizeEffectName(eff?.name || '')]?.icon || '✨');
}

export function shouldShowRuntimeEffectOnBoard(effect) {
  const eff = normalizeRuntimeEffect(effect);
  if (!eff) return false;
  if (eff?.hiddenOnBoard || eff?.uiHidden || eff?.internal) return false;
  const sourceId = String(eff?.sourceId || '');
  if (INTERNAL_BOARD_SOURCE_PREFIXES.some((prefix) => sourceId.startsWith(prefix))) return false;
  return true;
}

export function getVisibleRuntimeEffects(effects) {
  return (Array.isArray(effects) ? effects : [])
    .map((effect) => normalizeRuntimeEffect(effect))
    .filter((effect) => shouldShowRuntimeEffectOnBoard(effect))
    .map((effect) => {
      const badge = formatRuntimeEffectBadge(effect);
      return badge
        ? { ...effect, name: badge.name, icon: badge.icon, _boardLabel: badge.label, _boardTitle: badge.title }
        : effect;
    });
}

export function formatRuntimeEffectBadge(effect) {
  const eff = normalizeRuntimeEffect(effect);
  if (!eff || !shouldShowRuntimeEffectOnBoard(eff)) return null;
  const displayName = getEffectDisplayName(eff);
  if (!displayName) return null;
  const icon = getEffectDisplayIcon(eff, displayName);
  const dur = getEffectDurationSec(eff);
  const stackSuffix = getEffectStackSuffix(eff);
  const durationSuffix = dur !== null ? ` ${dur}s` : '';
  const titleDuration = dur !== null ? ` (${dur}s)` : '';
  const sourceKind = getEffectSourceKind(eff);
  const rawName = String(eff?.name || '');
  const rawSuffix = sourceKind && rawName && rawName !== displayName ? ` · ${rawName}` : '';
  return {
    icon,
    name: displayName,
    label: `${icon} ${displayName}${stackSuffix}${durationSuffix}`,
    title: `${displayName}${stackSuffix}${titleDuration}${rawSuffix}`,
  };
}

export function describeRuntimeEffect(effect) {
  const eff = normalizeRuntimeEffect(effect);
  if (!eff) return '';
  const name = String(eff?.name || '효과');
  const durationText = Number(eff?.remainingDuration || 0) > 0
    ? ` (${Math.max(0, Math.floor(Number(eff?.remainingDuration || 0)))}초)`
    : '';
  if (name === EFFECT_SHIELD) return `보호막 +${Math.max(0, Number(eff?.shieldValue || 0))}${durationText}`;
  if (name === EFFECT_REGEN) return `재생 ${Math.max(0, Number(eff?.recovery || 0))}${durationText}`;
  if (name === EFFECT_HEAL_REDUCTION) return `치유 감소 ${Math.round(Math.max(0, Number(eff?.healReductionPct || 0)) * 100)}%${durationText}`;
  if (name === EFFECT_LIFESTEAL) return `흡혈 ${Math.round(Math.max(0, Number(eff?.lifestealPct || 0)) * 100)}%${durationText}`;
  if (name === EFFECT_SLOW || name === EFFECT_HASTE) return `${name} ${Number(eff?.moveSpeedBonus || 0) >= 0 ? '+' : ''}${Math.round(Number(eff?.moveSpeedBonus || 0) * 100)}%${durationText}`;
  if (name === EFFECT_COOLDOWN_DOWN) return `쿨다운 감소 속도 +${Math.round(Math.max(0, Number(eff?.cooldownRateBonus || 0)) * 100)}%${durationText}`;
  if (name === EFFECT_COOLDOWN_UP) return `쿨다운 회복 둔화 ${Math.round(Math.max(0, Number(eff?.cooldownRatePenalty || 0)) * 100)}%${durationText}`;
  if (name === EFFECT_KNOCKBACK) return `밀어짐${Number(eff?.knockbackDistance || 0) > 0 ? ` ${Math.max(0, Number(eff?.knockbackDistance || 0))}` : ''}${durationText}`;
  if (name === EFFECT_STUN || name === EFFECT_AIRBORNE) return `${name}${durationText}`;
  const statMods = eff?.statModifiers && typeof eff.statModifiers === 'object' ? eff.statModifiers : null;
  if (statMods && Object.keys(statMods).length) {
    const bits = Object.entries(statMods).map(([k, v]) => `${getErStatLabel(k)} ${Number(v) > 0 ? '+' : ''}${Number(v)}`);
    return `${name}${bits.length ? ` [${bits.join(', ')}]` : ''}${durationText}`;
  }
  return `${name}${durationText}`;
}

export function applyRuntimeEffectPayloads(actor, effects) {
  const list = normalizeStatusEffectList(effects).map((x) => normalizeRuntimeEffect(x)).filter(Boolean);
  const results = [];
  list.forEach((effect) => {
    const res = applyStatusEffect(actor, effect);
    results.push({ ...res, effect });
  });
  return {
    results,
    applied: results.some((x) => !!x?.applied),
  };
}

export function consumeShieldDamage(actor, rawDamage) {
  const result = absorbShieldDamage(actor, rawDamage);
  actor.activeEffects = Array.isArray(result?.character?.activeEffects)
    ? result.character.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean)
    : [];
  return result;
}

export function clearPostCombatEffects(actor) {
  if (!actor || typeof actor !== 'object') return false;
  const res = clearNegativeStatusEffects(actor, {
    names: [
      EFFECT_POISON,
      EFFECT_BURN,
      EFFECT_AIRBORNE,
      EFFECT_HEAL_REDUCTION,
      EFFECT_STUN,
      EFFECT_KNOCKBACK,
      EFFECT_SLOW,
      EFFECT_COOLDOWN_UP,
    ],
    removeAllNegative: false,
  });
  actor.activeEffects = Array.isArray(actor.activeEffects) ? actor.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean) : [];
  return !!res.changed;
}
