import { makeRegenEffect, makeShieldEffect } from '../../utils/statusLogic';

// 전술 스킬 테이블(시즌10 일반 게임)
// - 레벨별 수치/쿨다운 + 발동 조건/우선순위를 데이터로 분리
// - 스킬명은 UI에서 쓰는 한글 표기를 기본으로 유지

const TAC_SKILL_TABLE = {
  '블링크': {
    baseCdSec: 55,
    effects: {},
    triggers: {
      flee: { priority: 100 },
    },
  },
  '치유의 바람': {
    baseCdSec: 45,
    effects: { healCap: { 1: 22, 2: 28 }, regenRecovery: { 1: 4, 2: 6 }, regenDuration: { 1: 2, 2: 3 } },
    triggers: {
      flee: { priority: 80, hpBelow: 55 },
      combat: { priority: 65, hpBelow: 40 },
    },
  },
  '라이트닝 쉴드': {
    baseCdSec: 40,
    effects: { block: { 1: 14, 2: 18 }, shieldValue: { 1: 14, 2: 18 }, shieldDuration: { 1: 2, 2: 2 } },
    triggers: { combatDefense: { priority: 70, minIncomingDmg: 6 } },
  },
  '스트라이더 A-13': {
    baseCdSec: 50,
    effects: { escapeBonus: { 1: 0.18, 2: 0.22 } },
    triggers: {
      flee: { priority: 55, applyBonus: true },
      chase: { priority: 55, applyBonus: true, useOnCommit: true },
    },
  },
  '임펄스': {
    baseCdSec: 50,
    effects: { escapeBonus: { 1: 0.18, 2: 0.22 } },
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
    effects: { openerFlatDmg: { 1: 6, 2: 9 }, selfHeal: { 1: 8, 2: 12 }, regenRecovery: { 1: 2, 2: 4 }, regenDuration: { 1: 2, 2: 2 } },
    triggers: { combat: { priority: 66, hpBelow: 70 } },
  },
  '붉은 폭풍': {
    baseCdSec: 40,
    effects: { escapeBonus: { 1: 0.14, 2: 0.18 }, chaseBonus: { 1: 0.14, 2: 0.18 }, openerFlatDmg: { 1: 4, 2: 7 } },
    triggers: {
      flee: { priority: 62, applyBonus: true, useOnCommit: true },
      chase: { priority: 62, applyBonus: true, useOnCommit: true },
      combat: { priority: 56 },
    },
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
    effects: { escapeBonus: { 1: 0.10, 2: 0.14 }, block: { 1: 8, 2: 12 }, shieldValue: { 1: 8, 2: 12 }, shieldDuration: { 1: 2, 2: 2 } },
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
  '거짓 서약': {
    baseCdSec: 50,
    effects: { openerFlatDmg: { 1: 8, 2: 12 }, selfCost: { 1: 6, 2: 8 }, selfHeal: { 1: 6, 2: 10 }, regenRecovery: { 1: 2, 2: 3 }, regenDuration: { 1: 2, 2: 2 } },
    triggers: { combat: { priority: 74, hpBelow: 78 } },
  },
};

export const TACTICAL_SKILL_OPTIONS_KO = Object.keys(TAC_SKILL_TABLE);

const TAC_SKILL_ALIASES = {
  '블래스터 탄환': '블링크',
  '블레싱': '치유의 바람',
  '스트라이더': '스트라이더 A-13',
  'strider a13': '스트라이더 A-13',
  'strider a-13': '스트라이더 A-13',
};

export function normalizeSupportedTacSkill(skillName) {
  const raw = String(skillName || '').trim();
  if (!raw) return '블링크';
  if (TACTICAL_SKILL_OPTIONS_KO.includes(raw)) return raw;
  const alias = TAC_SKILL_ALIASES[raw] || TAC_SKILL_ALIASES[raw.toLowerCase?.() || raw];
  if (alias && TACTICAL_SKILL_OPTIONS_KO.includes(alias)) return alias;
  return '블링크';
}

export function getTacBaseCdSec(skillName) {
  const nm = String(skillName || '').trim();
  const row = TAC_SKILL_TABLE[nm];
  return Math.max(12, Math.floor(Number(row?.baseCdSec ?? 45)));
}

export function getTacEffectNumber(skillName, key, lv, fallback) {
  const nm = String(skillName || '').trim();
  const k = String(key || '').trim();
  const level = Math.max(1, Math.min(2, Math.floor(Number(lv || 1))));
  const row = TAC_SKILL_TABLE[nm];
  const byLv = row?.effects?.[k];
  if (byLv && typeof byLv === 'object' && byLv[level] != null) {
    const v = Number(byLv[level]);
    return Number.isFinite(v) ? v : fallback;
  }
  return fallback;
}

export function getTacTrigger(skillName, contextKey) {
  const nm = String(skillName || '').trim();
  const ctx = String(contextKey || '').trim();
  const row = TAC_SKILL_TABLE[nm];
  const t = row?.triggers?.[ctx];
  return (t && typeof t === 'object') ? t : null;
}

export function buildTacStatusEffects(skillName, lv, sourceId = '') {
  const skill = normalizeSupportedTacSkill(skillName);
  const level = Math.max(1, Math.min(2, Math.floor(Number(lv || 1))));
  const sid = String(sourceId || `tac_${String(skill || '').replace(/\s+/g, '_')}`);
  const shieldValue = getTacEffectNumber(skill, 'shieldValue', level, 0);
  const shieldDuration = getTacEffectNumber(skill, 'shieldDuration', level, 2);
  const regenRecovery = getTacEffectNumber(skill, 'regenRecovery', level, 0);
  const regenDuration = getTacEffectNumber(skill, 'regenDuration', level, 2);
  return [
    shieldValue > 0 ? makeShieldEffect(shieldValue, shieldDuration, `${sid}_shield`) : null,
    regenRecovery > 0 ? makeRegenEffect(regenRecovery, regenDuration, `${sid}_regen`) : null,
  ].filter(Boolean);
}
