// Season 10 regular tactical skills used by the simulation.
// Cobalt-only and removed/legacy skills are normalized to supported regular-game options.

export const TAC_SKILL_TABLE = {
  '블링크': {
    baseCdSec: 55,
    effects: { escapeBonus: { 1: 0.22, 2: 0.28 } },
    triggers: {
      flee: { priority: 100, applyBonus: true, useOnCommit: true },
    },
  },
  '치유의 바람': {
    baseCdSec: 45,
    effects: { healCap: { 1: 22, 2: 30 }, regenRecovery: { 1: 4, 2: 6 }, regenDuration: { 1: 2, 2: 3 } },
    triggers: {
      flee: { priority: 80, hpBelow: 55 },
      combat: { priority: 62, hpBelow: 45 },
    },
  },
  '붉은 폭풍': {
    baseCdSec: 40,
    effects: { escapeBonus: { 1: 0.10, 2: 0.14 }, chaseBonus: { 1: 0.05, 2: 0.08 }, openerFlatDmg: { 1: 2, 2: 4 } },
    triggers: {
      flee: { priority: 54, applyBonus: true },
      chase: { priority: 44, applyBonus: true },
      combat: { priority: 40 },
    },
  },
  '스트라이더 A-13': {
    baseCdSec: 50,
    effects: { escapeBonus: { 1: 0.18, 2: 0.23 }, chaseBonus: { 1: 0.10, 2: 0.14 } },
    triggers: {
      flee: { priority: 55, applyBonus: true },
      chase: { priority: 55, applyBonus: true, useOnCommit: true },
    },
  },
  '퀘이크': {
    baseCdSec: 40,
    effects: { chaseBonus: { 1: 0.12, 2: 0.17 }, openerFlatDmg: { 1: 6, 2: 10 } },
    triggers: { chase: { priority: 68, applyBonus: true, useOnCommit: true }, combat: { priority: 58 } },
  },
  '프로토콜 위반': {
    baseCdSec: 50,
    effects: { openerFlatDmg: { 1: 6, 2: 10 }, selfHeal: { 1: 8, 2: 12 }, regenRecovery: { 1: 2, 2: 4 }, regenDuration: { 1: 2, 2: 2 } },
    triggers: { combat: { priority: 66, hpBelow: 70 } },
  },
  '초월': {
    baseCdSec: 42,
    effects: { block: { 1: 18, 2: 28 }, shieldValue: { 1: 18, 2: 28 }, shieldDuration: { 1: 2, 2: 3 } },
    triggers: { combatDefense: { priority: 82, minIncomingDmg: 8 } },
  },
  '아티팩트': {
    baseCdSec: 70,
    effects: { negateLethal: { 1: 1, 2: 1 }, block: { 1: 999, 2: 999 }, shieldValue: { 1: 20, 2: 28 }, shieldDuration: { 1: 2, 2: 3 } },
    triggers: { combatDefense: { priority: 90, minIncomingDmg: 12 }, flee: { priority: 76, applyBonus: true } },
  },
  '무효화': {
    baseCdSec: 45,
    effects: { escapeBonus: { 1: 0.10, 2: 0.14 }, block: { 1: 8, 2: 12 }, shieldValue: { 1: 8, 2: 12 }, shieldDuration: { 1: 2, 2: 2 }, tenacity: { 1: 2, 2: 4 } },
    triggers: {
      flee: { priority: 64, applyBonus: true, useOnCommit: true },
      combatDefense: { priority: 74, minIncomingDmg: 7 },
    },
  },
  '강한 결속': {
    baseCdSec: 50,
    effects: { openerFlatDmg: { 1: 4, 2: 7 }, selfHeal: { 1: 10, 2: 14 }, escapeBonus: { 1: 0.08, 2: 0.12 }, regenRecovery: { 1: 3, 2: 5 }, regenDuration: { 1: 2, 2: 3 } },
    triggers: {
      combat: { priority: 60, hpBelow: 65 },
      flee: { priority: 44, applyBonus: true },
    },
  },
  '진실의 칼날': {
    baseCdSec: 48,
    effects: { openerFlatDmg: { 1: 8, 2: 12 }, chaseBonus: { 1: 0.08, 2: 0.12 } },
    triggers: { combat: { priority: 72 }, chase: { priority: 52, applyBonus: true } },
  },
  '라이트 윙': {
    baseCdSec: 48,
    effects: { escapeBonus: { 1: 0.12, 2: 0.18 }, chaseBonus: { 1: 0.06, 2: 0.10 }, haste: { 1: 2, 2: 4 } },
    triggers: {
      flee: { priority: 66, applyBonus: true },
      chase: { priority: 46, applyBonus: true },
    },
  },
  '리펄서 미사일': {
    baseCdSec: 44,
    effects: { openerFlatDmg: { 1: 7, 2: 12 }, chaseBonus: { 1: 0.06, 2: 0.09 } },
    triggers: { chase: { priority: 64, applyBonus: true }, combat: { priority: 67 } },
  },
  '플라즈마 대시': {
    baseCdSec: 42,
    effects: { openerFlatDmg: { 1: 6, 2: 10 }, escapeBonus: { 1: 0.08, 2: 0.12 }, chaseBonus: { 1: 0.08, 2: 0.12 } },
    triggers: {
      flee: { priority: 60, applyBonus: true },
      chase: { priority: 60, applyBonus: true },
      combat: { priority: 58 },
    },
  },
};

export const LEGACY_OR_COBALT_TAC_SKILLS = new Set([
  '라이트닝 쉴드',
  '블래스터',
  '거짓 서약',
  '빛의 수호',
  '아스테니아',
  '부착 / 추적',
  '부착/추적',
  '힘껏펀치',
  '임펄스',
  '메테오',
  '중력장',
  '롤링썬더',
  '블래스터 탄환',
]);

const TAC_SKILL_REPLACEMENTS = {
  '라이트닝 쉴드': '초월',
  블래스터: '진실의 칼날',
  '블래스터 탄환': '진실의 칼날',
  '거짓 서약': '진실의 칼날',
  '빛의 수호': '라이트 윙',
  아스테니아: '플라즈마 대시',
  '부착 / 추적': '블링크',
  '부착/추적': '블링크',
  힘껏펀치: '퀘이크',
  임펄스: '블링크',
  메테오: '진실의 칼날',
  중력장: '퀘이크',
  롤링썬더: '스트라이더 A-13',
};

const TAC_SKILL_ALIASES = {
  blink: '블링크',
  블링크: '블링크',
  '치유 바람': '치유의 바람',
  healingwind: '치유의 바람',
  'healing wind': '치유의 바람',
  'red storm': '붉은 폭풍',
  'electric shift': '붉은 폭풍',
  'lightning shield': '라이트닝 쉴드',
  shield: '라이트닝 쉴드',
  'strider a13': '스트라이더 A-13',
  'strider a-13': '스트라이더 A-13',
  'strider - a13': '스트라이더 A-13',
  strider: '스트라이더 A-13',
  blaster: '블래스터',
  quake: '퀘이크',
  'protocol violation': '프로토콜 위반',
  'false oath': '거짓 서약',
  artifact: '아티팩트',
  nullification: '무효화',
  transcendence: '초월',
  'wings of light': '라이트 윙',
  'light wing': '라이트 윙',
  'repulsor missiles': '리펄서 미사일',
  'plasma dash': '플라즈마 대시',
  asthenia: '아스테니아',
  'attach track': '블링크',
  'attach / track': '블링크',
  impulse: '블링크',
  meteor: '진실의 칼날',
  gravity: '퀘이크',
  'gravity field': '퀘이크',
  'rolling thunder': '스트라이더 A-13',
};

export const TACTICAL_SKILL_OPTIONS_KO = Object.keys(TAC_SKILL_TABLE)
  .filter((name) => !LEGACY_OR_COBALT_TAC_SKILLS.has(name));

export function normalizeSupportedTacSkill(skillName) {
  const raw = String(skillName || '').trim();
  if (!raw) return '블링크';
  const rawReplacement = TAC_SKILL_REPLACEMENTS[raw];
  if (rawReplacement && TACTICAL_SKILL_OPTIONS_KO.includes(rawReplacement)) return rawReplacement;
  if (TACTICAL_SKILL_OPTIONS_KO.includes(raw)) return raw;
  const key = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  const alias = TAC_SKILL_ALIASES[raw] || TAC_SKILL_ALIASES[key] || TAC_SKILL_ALIASES[key.replace(/[-_]/g, ' ')];
  if (alias) {
    const aliasReplacement = TAC_SKILL_REPLACEMENTS[alias] || alias;
    if (TACTICAL_SKILL_OPTIONS_KO.includes(aliasReplacement)) return aliasReplacement;
  }
  return '블링크';
}

export function getTacBaseCdSec(skillName) {
  const skill = normalizeSupportedTacSkill(skillName);
  const row = TAC_SKILL_TABLE[skill];
  return Math.max(12, Math.floor(Number(row?.baseCdSec ?? 45)));
}

export function getTacEffectNumber(skillName, key, lv, fallback) {
  const skill = normalizeSupportedTacSkill(skillName);
  const effectKey = String(key || '').trim();
  const level = Math.max(1, Math.min(2, Math.floor(Number(lv || 1))));
  const byLevel = TAC_SKILL_TABLE[skill]?.effects?.[effectKey];
  if (byLevel && typeof byLevel === 'object' && byLevel[level] != null) {
    const value = Number(byLevel[level]);
    return Number.isFinite(value) ? value : fallback;
  }
  return fallback;
}

export function getTacTrigger(skillName, contextKey) {
  const skill = normalizeSupportedTacSkill(skillName);
  const ctx = String(contextKey || '').trim();
  const trigger = TAC_SKILL_TABLE[skill]?.triggers?.[ctx];
  return trigger && typeof trigger === 'object' ? trigger : null;
}
