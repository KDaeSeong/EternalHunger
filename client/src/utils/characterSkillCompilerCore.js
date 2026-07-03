const SKILL_LEVEL_COUNT = 5;

export const ACTIVE_CHARACTER_SKILL_SLOTS = ['q', 'w', 'e', 'r'];
export const CHARACTER_SKILL_SLOTS = [...ACTIVE_CHARACTER_SKILL_SLOTS, 'passive'];
export const CHARACTER_SKILL_SLOT_LABELS = {
  q: 'Q',
  w: 'W',
  e: 'E',
  r: 'R',
  passive: 'Passive',
};

export function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeSlot(slot) {
  const key = String(slot || 'q').trim().toLowerCase();
  return CHARACTER_SKILL_SLOTS.includes(key) ? key : 'q';
}

export function normalizeSkillText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumberList(value) {
  return String(value || '')
    .split('/')
    .map((part) => cleanNumber(String(part).trim(), NaN))
    .filter((n) => Number.isFinite(n));
}

export function toLevelArray(value, fallback = 0, opts = {}) {
  const raw = Array.isArray(value) ? value : parseNumberList(value);
  const src = raw.length ? raw : [fallback];
  const out = [];
  for (let i = 0; i < SKILL_LEVEL_COUNT; i += 1) {
    const picked = src[i] ?? src[src.length - 1] ?? fallback;
    const n = cleanNumber(picked, fallback);
    out.push(opts.integer ? Math.max(0, Math.round(n)) : Math.max(0, Number(n.toFixed(3))));
  }
  return out;
}

function defaultCooldownForSlot(slot) {
  if (slot === 'r') return 60;
  if (slot === 'e') return 18;
  if (slot === 'w') return 12;
  if (slot === 'passive') return 0;
  return 7;
}

export function normalizePctInput(value, fallback = 0) {
  const n = cleanNumber(value, fallback);
  if (n <= 0) return 0;
  return n > 1 ? n / 100 : n;
}

export function createDefaultCompiledSkill(base = {}, slot = 'q') {
  const skillSlot = normalizeSlot(base.slot || slot);
  const defaultType = skillSlot === 'passive'
    ? 'passive_stat'
    : skillSlot === 'q'
      ? 'basic_attack_recast'
      : 'combat_effect';
  const cooldown = defaultCooldownForSlot(skillSlot);
  const rawStatModifiers = base.statModifiers && typeof base.statModifiers === 'object'
    ? base.statModifiers
    : {};
  return {
    enabled: base.enabled === true,
    slot: skillSlot,
    type: String(base.type || defaultType),
    trigger: String(base.trigger || (skillSlot === 'passive' ? 'always' : 'basic_attack')),
    name: String(base.name || ''),
    sourceText: String(base.sourceText || ''),
    cooldownSec: Math.max(skillSlot === 'passive' ? 0 : 1, cleanNumber(base.cooldownSec, cooldown)),
    recastWindowSec: Math.max(0, cleanNumber(base.recastWindowSec, skillSlot === 'q' ? 5 : 0)),
    range: Math.max(0, cleanNumber(base.range, 0)),
    castDelaySec: Math.max(0, cleanNumber(base.castDelaySec, 0)),
    recoveryDelaySec: Math.max(0, cleanNumber(base.recoveryDelaySec, 0)),
    useCondition: String(base.useCondition || 'auto'),
    targetPriority: String(base.targetPriority || 'auto'),
    minExpectedDamage: Math.max(0, cleanNumber(base.minExpectedDamage, 1)),
    minSplashTargets: Math.max(0, Math.floor(cleanNumber(base.minSplashTargets, 0))),
    minCasterHpPct: normalizePctInput(base.minCasterHpPct, 0),
    maxCasterHpPct: normalizePctInput(base.maxCasterHpPct, 0),
    minTargetHpPct: normalizePctInput(base.minTargetHpPct, 0),
    maxTargetHpPct: normalizePctInput(base.maxTargetHpPct, 0),
    radius: Math.max(0, cleanNumber(base.radius, 0)),
    durationSec: Math.max(0, cleanNumber(base.durationSec, 0)),
    firstFlat: toLevelArray(base.firstFlat, 0, { integer: true }),
    secondFlat: toLevelArray(base.secondFlat, 0, { integer: true }),
    flatDamage: toLevelArray(base.flatDamage ?? base.firstFlat, 0, { integer: true }),
    maxHpPct: toLevelArray(base.maxHpPct, 0),
    currentHpPct: toLevelArray(base.currentHpPct, 0),
    secondMaxHpPct: toLevelArray(base.secondMaxHpPct, 0),
    secondCurrentHpPct: toLevelArray(base.secondCurrentHpPct, 0),
    heal: toLevelArray(base.heal, 0, { integer: true }),
    shield: toLevelArray(base.shield, 0, { integer: true }),
    firstSkillAmpScale: Math.max(0, cleanNumber(base.firstSkillAmpScale, 0)),
    secondSkillAmpScale: Math.max(0, cleanNumber(base.secondSkillAmpScale, 0)),
    skillAmpScale: Math.max(0, cleanNumber(base.skillAmpScale ?? base.firstSkillAmpScale, 0)),
    statModifiers: Object.fromEntries(
      Object.entries(rawStatModifiers)
        .map(([key, value]) => [key, cleanNumber(value, 0)])
        .filter(([, value]) => Number.isFinite(value) && value !== 0)
    ),
    tags: Array.isArray(base.tags) ? base.tags.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 16) : [],
  };
}
