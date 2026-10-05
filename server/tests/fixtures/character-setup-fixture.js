// Independent constructed inputs: no user match, prior test output or live API.
function makeSetup(name = '검사 캐릭터') {
  const attack = (slot, extra = {}) => ({ enabled: true, name: `${slot} 기술`, type: 'attack_skill',
    sourceText: '독립 검사 설명', cooldownSec: 9, firstFlat: [4, 6, 8, 10, 12], ...extra });
  return { name, gender: '여', summary: '수치 단위와 안전한 적용을 확인하는 독립 입력',
    stats: { maxHp: 110, hpGrowth: 3, attackPower: 20, attackPowerGrowth: 1, skillAmp: 5, skillAmpGrowth: 2,
      defense: 14, defenseGrowth: 1, attackSpeed: 0.8, attackSpeedGrowth: 0.01,
      attackRange: 2, sightRange: 10, moveSpeed: 3.5 }, erWeapons: ['글러브'],
    characterSkills: {
      q: attack('Q', { damageType: 'true', firstFlat: [0, 0, 0, 0, 0], maxHpPct: [0.2, 0.25, 0.5, 1, 4] }),
      w: attack('W', { type: 'shield_skill', firstFlat: [0], shield: [10, 15, 20, 25, 30],
        supportTargetScope: 'self', statusEffects: [{ name: '무적', target: 'self', durationSec: 1 }] }),
      e: attack('E', { includesMovement: true, movementDistance: 2, movementMode: 'away_from_target' }),
      r: attack('R', { cooldownSec: 45, firstFlat: [15, 20, 25, 30, 35],
        statusEffects: [{ name: '기절', target: 'target', durationSec: 0.5 }] }),
      passive: { enabled: true, type: 'passive_stat', name: '항상 튼튼', sourceText: '방어력 +2',
        cooldownSec: 0, statModifiers: { defense: 2 } },
    }, uniqueResource: { enabled: false }, warnings: ['검사용 추정 수치입니다.'] };
}
function makeErDetail(row = { name: '검사 실험체', objectId: 'CH_AD_670_999991' }) {
  return { intro: { gameId: 'GM_670', ...row, description: '독립 <br/>자료',
    filters: [{ name: '무기', value: '글러브' }] }, videoWithStats: { stats: [{ name: '체력', value: '100 (3)' }] },
  skill: ['T', 'Q', 'W', 'E', 'R'].map(slot => ({ dataType: 'skill', name: `${slot} - 검사 ${slot}`,
    description: '10/20/30/40/50 피해<br/>쿨다운 9초' })) };
}
module.exports = { makeSetup, makeErDetail };
