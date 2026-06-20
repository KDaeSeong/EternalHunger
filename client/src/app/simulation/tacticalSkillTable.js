import { makeRegenEffect, makeShieldEffect, makeStatBuffEffect } from '../../utils/statusLogic';

// Spectator-simulation abstraction of Eternal Return tactical skills.
// The real game has detailed targeting and cooldown rules; here we model
// the decision hooks that this project can simulate: flee, chase, opener,
// defense, heal, and module-enhanced effects.
const TAC_SKILL_TABLE = {
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
  '라이트닝 쉴드': {
    baseCdSec: 40,
    effects: { block: { 1: 14, 2: 19 }, shieldValue: { 1: 14, 2: 19 }, shieldDuration: { 1: 2, 2: 2 } },
    triggers: { combatDefense: { priority: 72, minIncomingDmg: 6 } },
  },
  '스트라이더 A-13': {
    baseCdSec: 50,
    effects: { escapeBonus: { 1: 0.18, 2: 0.23 }, chaseBonus: { 1: 0.10, 2: 0.14 } },
    triggers: {
      flee: { priority: 55, applyBonus: true },
      chase: { priority: 55, applyBonus: true, useOnCommit: true },
    },
  },
  '블래스터': {
    baseCdSec: 50,
    effects: { escapeBonus: { 1: 0.17, 2: 0.22 }, openerFlatDmg: { 1: 3, 2: 5 } },
    triggers: {
      flee: { priority: 55, applyBonus: true },
      combat: { priority: 52 },
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
  '거짓 서약': {
    baseCdSec: 50,
    effects: { openerFlatDmg: { 1: 8, 2: 13 }, selfCost: { 1: 6, 2: 8 }, selfHeal: { 1: 6, 2: 10 }, regenRecovery: { 1: 2, 2: 3 }, regenDuration: { 1: 2, 2: 2 } },
    triggers: { combat: { priority: 74, hpBelow: 78 } },
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
  '빛의 수호': {
    baseCdSec: 48,
    effects: { escapeBonus: { 1: 0.12, 2: 0.18 }, shieldValue: { 1: 12, 2: 18 }, shieldDuration: { 1: 2, 2: 2 }, haste: { 1: 2, 2: 4 } },
    triggers: {
      flee: { priority: 66, applyBonus: true },
      combatDefense: { priority: 68, minIncomingDmg: 6 },
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
  '아스테니아': {
    baseCdSec: 46,
    effects: { openerFlatDmg: { 1: 4, 2: 7 }, block: { 1: 4, 2: 7 }, chaseBonus: { 1: 0.04, 2: 0.07 } },
    triggers: { combat: { priority: 59 }, chase: { priority: 58, applyBonus: true } },
  },
};

export const TACTICAL_SKILL_OPTIONS_KO = Object.keys(TAC_SKILL_TABLE);

const TAC_SKILL_ALIASES = {
  blink: '블링크',
  블링크: '블링크',
  '치유 바람': '치유의 바람',
  healingwind: '치유의 바람',
  'healing wind': '치유의 바람',
  'lightning shield': '라이트닝 쉴드',
  shield: '라이트닝 쉴드',
  'strider a13': '스트라이더 A-13',
  'strider a-13': '스트라이더 A-13',
  strider: '스트라이더 A-13',
  blaster: '블래스터',
  quake: '퀘이크',
  'protocol violation': '프로토콜 위반',
  'false oath': '거짓 서약',
  artifact: '아티팩트',
  nullification: '무효화',
  transcendence: '초월',
  'wings of light': '빛의 수호',
  'repulsor missiles': '리펄서 미사일',
  'plasma dash': '플라즈마 대시',
  asthenia: '아스테니아',
};

export function normalizeSupportedTacSkill(skillName) {
  const raw = String(skillName || '').trim();
  if (!raw) return '블링크';
  if (TACTICAL_SKILL_OPTIONS_KO.includes(raw)) return raw;
  const key = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  const alias = TAC_SKILL_ALIASES[raw] || TAC_SKILL_ALIASES[key] || TAC_SKILL_ALIASES[key.replace(/[-_]/g, ' ')];
  if (alias && TACTICAL_SKILL_OPTIONS_KO.includes(alias)) return alias;
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

export function buildTacStatusEffects(skillName, lv, sourceId = '') {
  const skill = normalizeSupportedTacSkill(skillName);
  const level = Math.max(1, Math.min(2, Math.floor(Number(lv || 1))));
  const sid = String(sourceId || `tac_${String(skill || '').replace(/\s+/g, '_')}`);
  const shieldValue = getTacEffectNumber(skill, 'shieldValue', level, 0);
  const shieldDuration = getTacEffectNumber(skill, 'shieldDuration', level, 2);
  const regenRecovery = getTacEffectNumber(skill, 'regenRecovery', level, 0);
  const regenDuration = getTacEffectNumber(skill, 'regenDuration', level, 2);
  const tenacity = getTacEffectNumber(skill, 'tenacity', level, 0);
  const haste = getTacEffectNumber(skill, 'haste', level, 0);

  return [
    shieldValue > 0 ? makeShieldEffect(shieldValue, shieldDuration, `${sid}_shield`) : null,
    regenRecovery > 0 ? makeRegenEffect(regenRecovery, regenDuration, `${sid}_regen`) : null,
    tenacity > 0 ? makeStatBuffEffect('집중', { end: tenacity, men: tenacity }, 2, `${sid}_tenacity`, { tags: ['positive', 'tenacity'] }) : null,
    haste > 0 ? makeStatBuffEffect('각성', { agi: haste, dex: Math.max(1, Math.floor(haste / 2)) }, 2, `${sid}_haste`, { tags: ['positive', 'haste'] }) : null,
  ].filter(Boolean);
}
