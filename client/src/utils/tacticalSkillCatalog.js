// Season 11 regular tactical skills used by the simulation.
// Cobalt-only and removed/legacy skills are normalized to supported regular-game options.

export const TAC_SKILL_TABLE = {
  '블링크': {
    baseCdSec: 90,
    cooldownByLevel: { 1: 90, 2: 45 },
    summary: '지정한 위치로 3m 순간 이동합니다.',
    moduleUpgrade: '2.5초간 이동 속도가 15% 증가하며 충돌을 무시합니다.',
    guideStats: ['쿨다운: 90초 / 45초', '쿨다운 감소 스탯의 영향을 받지 않습니다.'],
    effects: { escapeBonus: { 1: 0.22, 2: 0.28 }, haste: { 1: 0, 2: 2 } },
    triggers: {
      flee: { priority: 100, applyBonus: true, useOnCommit: true },
    },
  },
  '치유의 바람': {
    baseCdSec: 50,
    cooldownByLevel: { 1: 50, 2: 40 },
    summary: '범위 내 아군 실험체의 체력을 회복합니다. 회복 후 15초 동안 치유의 바람 회복 효과는 50%만 적용됩니다.',
    moduleUpgrade: '바람에 휩싸인 대상은 4초간 150(+캐릭터 레벨*15)의 체력을 추가로 회복합니다.',
    guideStats: ['체력 회복량: 100(+캐릭터 레벨*10)', '범위: 반경 7m', '쿨다운: 50초 / 40초'],
    effects: { healCap: { 1: 22, 2: 30 }, regenRecovery: { 1: 4, 2: 6 }, regenDuration: { 1: 2, 2: 3 } },
    triggers: {
      flee: { priority: 80, hpBelow: 55 },
      combat: { priority: 62, hpBelow: 45 },
    },
  },
  '붉은 폭풍': {
    baseCdSec: 40,
    cooldownByLevel: { 1: 40, 2: 30 },
    summary: '커서 방향으로 0.1초간 2.5m 이동하고 일정 시간 동안 기본 공격 사거리가 10% 증가합니다.',
    moduleUpgrade: '사거리 증가 효과가 15%로 강화됩니다.',
    guideStats: ['유지 시간: 10초 / 12초', '쿨다운: 40초 / 30초'],
    effects: { escapeBonus: { 1: 0.10, 2: 0.14 }, chaseBonus: { 1: 0.05, 2: 0.08 }, openerFlatDmg: { 1: 2, 2: 4 }, haste: { 1: 1, 2: 2 } },
    triggers: {
      flee: { priority: 54, applyBonus: true },
      chase: { priority: 44, applyBonus: true },
      combat: { priority: 40 },
    },
  },
  '스트라이더 A-13': {
    baseCdSec: 40,
    cooldownByLevel: { 1: 40, 2: 30 },
    summary: '5초간 10m 근처 적 실험체를 향해 이동하는 속도가 증가하고, 지속 시간 중 피해를 입히면 추가 스킬 피해와 이동 속도 증가를 얻습니다.',
    moduleUpgrade: '피해를 입힌 대상의 이동 속도를 2초간 감소시킵니다. 근거리 50%, 원거리 30%.',
    guideStats: ['피해량: 100(+캐릭터 레벨*5) / 150(+캐릭터 레벨*10)', '근거리 이동 속도 증가: 30% / 40%', '원거리 이동 속도 증가: 20% / 30%', '쿨다운: 40초 / 30초'],
    effects: { escapeBonus: { 1: 0.18, 2: 0.23 }, chaseBonus: { 1: 0.10, 2: 0.14 }, openerFlatDmg: { 1: 8, 2: 13 }, slowPct: { 1: 0, 2: 0.30 } },
    triggers: {
      flee: { priority: 55, applyBonus: true },
      chase: { priority: 55, applyBonus: true, useOnCommit: true },
    },
  },
  '퀘이크': {
    baseCdSec: 40,
    cooldownByLevel: { 1: 40, 2: 30 },
    summary: '자신 주변 4m에 지진을 발생시켜 스킬 피해를 입히고 2초간 주변 적의 이동 속도를 감소시킵니다.',
    moduleUpgrade: '6초간 0.5초마다 주변 3.5m 적에게 10(+캐릭터 레벨*2)(+추가 체력의 2.5%) 스킬 피해를 입힙니다.',
    guideStats: ['피해량: 50(+캐릭터 레벨*10)(+추가 체력의 10%) / 100(+캐릭터 레벨*10)(+추가 체력의 10%)', '이동 속도 감소: 40% / 50%', '쿨다운: 40초 / 30초'],
    effects: { chaseBonus: { 1: 0.12, 2: 0.17 }, openerFlatDmg: { 1: 6, 2: 12 }, slowPct: { 1: 0.40, 2: 0.50 } },
    triggers: { chase: { priority: 68, applyBonus: true, useOnCommit: true }, combat: { priority: 58 } },
  },
  '프로토콜 위반': {
    baseCdSec: 50,
    cooldownByLevel: { 1: 50, 2: 40 },
    summary: '지정 위치에 E.M.O.T.E를 소환합니다. 2.2초 후 파괴되며 6초간 주변 아군 체력을 증가시키고 적에게 고정 피해를 입힙니다.',
    moduleUpgrade: '최대 체력 증가량과 고정 피해 효과가 크게 증가합니다.',
    guideStats: ['최대 체력 증가: 100(+캐릭터 레벨*15) / 150(+캐릭터 레벨*20)', '피해량: 캐릭터 레벨*5(+대상 최대 체력의 7%) / 캐릭터 레벨*8(+대상 최대 체력의 9%)', '사거리: 12m, 범위: 반경 5m', '쿨다운: 50초 / 40초'],
    effects: { openerFlatDmg: { 1: 6, 2: 10 }, selfHeal: { 1: 8, 2: 12 }, regenRecovery: { 1: 2, 2: 4 }, regenDuration: { 1: 2, 2: 2 }, lifestealPct: { 1: 0.08, 2: 0.12 } },
    triggers: { combat: { priority: 66, hpBelow: 70 } },
  },
  '초월': {
    baseCdSec: 40,
    cooldownByLevel: { 1: 40, 2: 30 },
    summary: '3초 동안 보호막을 획득합니다.',
    moduleUpgrade: '3초 동안 방해 효과 저항이 10(+추가 체력의 3%)% 증가합니다.',
    guideStats: ['보호막 흡수량: 150(+추가 체력의 80%) / 200(+추가 체력의 100%)', '쿨다운: 40초 / 30초'],
    effects: { block: { 1: 18, 2: 28 }, shieldValue: { 1: 18, 2: 28 }, shieldDuration: { 1: 3, 2: 3 }, tenacity: { 1: 0, 2: 4 } },
    triggers: { combatDefense: { priority: 82, minIncomingDmg: 8 } },
  },
  '아티팩트': {
    baseCdSec: 90,
    cooldownByLevel: { 1: 90, 2: 45 },
    summary: '2.5초간 경직 상태가 되어 행동할 수 없지만 큰 피해를 무효화하는 생존형 전술 스킬입니다.',
    moduleUpgrade: '아티팩트 경직 상태에서 쿨다운이 150% 빠르게 회복됩니다.',
    guideStats: ['지속 시간: 2.5초', '쿨다운: 90초 / 45초'],
    effects: { negateLethal: { 1: 1, 2: 1 }, block: { 1: 999, 2: 999 }, shieldValue: { 1: 20, 2: 28 }, shieldDuration: { 1: 2, 2: 3 }, cooldownDownPct: { 1: 0, 2: 1.5 } },
    triggers: { combatDefense: { priority: 90, minIncomingDmg: 12 }, flee: { priority: 76, applyBonus: true } },
  },
  '무효화': {
    baseCdSec: 40,
    cooldownByLevel: { 1: 40, 2: 30 },
    summary: '자신과 주변 아군에게 걸린 해로운 상태 이상을 즉시 해제하고 이동 속도가 1초간 증가합니다.',
    moduleUpgrade: '자신과 주변 아군의 방해 효과 저항이 3초 동안 60% 증가합니다.',
    guideStats: ['이동 속도 증가: 20% / 30%', '해로운 상태 이상 해제 시 추가 이동 속도 +30%', '범위: 6m', '쿨다운: 40초 / 30초'],
    effects: { escapeBonus: { 1: 0.10, 2: 0.14 }, block: { 1: 8, 2: 12 }, shieldValue: { 1: 8, 2: 12 }, shieldDuration: { 1: 2, 2: 2 }, tenacity: { 1: 0, 2: 6 } },
    triggers: {
      flee: { priority: 64, applyBonus: true, useOnCommit: true },
      combatDefense: { priority: 74, minIncomingDmg: 7 },
    },
  },
  '강한 결속': {
    baseCdSec: 60,
    cooldownByLevel: { 1: 60, 2: 45 },
    summary: '주변 12m 전투에서 잃은 체력에 따라 에너지를 얻고, 사용 시 모든 에너지를 소모해 주변 아군에게 이동 속도 증가와 모든 피해 흡혈을 부여합니다.',
    moduleUpgrade: '최대 에너지 보유량과 에너지 획득률이 증가합니다.',
    guideStats: ['최대 에너지: 70 / 99', '이동 속도 증가: 20% / 30%(+에너지*0.3)', '모든 피해 흡혈: 5% / 8%(+에너지*0.07)', '쿨다운: 60초 / 45초'],
    effects: { openerFlatDmg: { 1: 4, 2: 7 }, selfHeal: { 1: 10, 2: 14 }, escapeBonus: { 1: 0.08, 2: 0.12 }, regenRecovery: { 1: 3, 2: 5 }, regenDuration: { 1: 2, 2: 3 }, lifestealPct: { 1: 0.06, 2: 0.10 } },
    triggers: {
      combat: { priority: 60, hpBelow: 65 },
      flee: { priority: 44, applyBonus: true },
    },
  },
  '진실의 칼날': {
    baseCdSec: 10,
    cooldownByLevel: { 1: 10, 2: 8 },
    summary: '주변 2.5m 적에게 140(+캐릭터 레벨*20)의 스킬 피해를 입히고 2.5초간 이동 속도가 증가합니다.',
    moduleUpgrade: '진실의 칼날이 하나 더 소환되어 50(+캐릭터 레벨*10)의 추가 스킬 피해를 입힙니다.',
    guideStats: ['추가 피격 대상당 이동 속도 증가: 5% / 10%', '최대 이동 속도 증가: 30% / 40%', '쿨다운: 10초 / 8초'],
    effects: { openerFlatDmg: { 1: 8, 2: 12 }, chaseBonus: { 1: 0.08, 2: 0.12 }, haste: { 1: 1, 2: 2 } },
    triggers: { combat: { priority: 72 }, chase: { priority: 52, applyBonus: true } },
  },
  '라이트 윙': {
    baseCdSec: 50,
    cooldownByLevel: { 1: 50, 2: 40 },
    summary: '자신에게 걸린 이동 속도 감소 효과를 제거하고 7초 동안 이동 속도와 공격 속도가 증가합니다. 기본 공격 적중 시 적 이동 속도를 0.6초 동안 10% 감소시킵니다.',
    moduleUpgrade: '적 실험체에게 기본 공격 적중 시 지속 시간이 0.5초 증가합니다.',
    guideStats: ['이동 속도 증가: 15(+캐릭터 레벨*1)% / 20(+캐릭터 레벨*1)%', '공격 속도 증가: 20%', '쿨다운: 50초 / 40초'],
    effects: { escapeBonus: { 1: 0.12, 2: 0.18 }, chaseBonus: { 1: 0.06, 2: 0.10 }, haste: { 1: 2, 2: 4 }, slowPct: { 1: 0.10, 2: 0.10 } },
    triggers: {
      flee: { priority: 66, applyBonus: true },
      chase: { priority: 46, applyBonus: true },
    },
  },
  '리펄서 미사일': {
    baseCdSec: 50,
    cooldownByLevel: { 1: 50, 2: 40 },
    summary: '짧은 거리를 이동한 뒤 착지 지점 주변 가장 가까운 적 실험체에게 미사일 5발을 발사합니다.',
    moduleUpgrade: '미사일 3발을 추가로 발사합니다.',
    guideStats: ['발당 피해량: 10(+캐릭터 레벨*1)(+대상 최대 체력의 0.7%) 고정 피해', '이동 거리: 3m, 발사 사거리: 8.5m', '쿨다운: 50초 / 40초'],
    effects: { openerFlatDmg: { 1: 7, 2: 12 }, chaseBonus: { 1: 0.06, 2: 0.09 } },
    triggers: { chase: { priority: 64, applyBonus: true }, combat: { priority: 67 } },
  },
  '플라즈마 대시': {
    baseCdSec: 50,
    cooldownByLevel: { 1: 50, 2: 40 },
    summary: '짧은 거리를 이동하며 전방으로 플라즈마 에너지를 발사해 적중한 적에게 스킬 피해를 입히고 1초 동안 이동 속도를 30% 감소시킵니다.',
    moduleUpgrade: '투사체에 적중된 적의 방어력을 5초 동안 10% 감소시킵니다.',
    guideStats: ['피해량: 120(+캐릭터 레벨*5) / 150(+캐릭터 레벨*10)', '이동 거리: 2.5m, 투사체 사거리: 7m', '쿨다운: 50초 / 40초'],
    effects: { openerFlatDmg: { 1: 6, 2: 10 }, escapeBonus: { 1: 0.08, 2: 0.12 }, chaseBonus: { 1: 0.08, 2: 0.12 }, haste: { 1: 2, 2: 3 }, slowPct: { 1: 0.30, 2: 0.30 } },
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
  '스트라이더 - A13': '스트라이더 A-13',
  '스트라이더-A13': '스트라이더 A-13',
  '스트라이더 A13': '스트라이더 A-13',
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
  return getTacCooldownSec(skillName, 1);
}

export function getTacCooldownSec(skillName, lv = 1) {
  const skill = normalizeSupportedTacSkill(skillName);
  const row = TAC_SKILL_TABLE[skill];
  const level = Math.max(1, Math.min(2, Math.floor(Number(lv || 1))));
  const raw = row?.cooldownByLevel?.[level] ?? row?.baseCdSec ?? 45;
  return Math.max(8, Math.floor(Number(raw || 45)));
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
