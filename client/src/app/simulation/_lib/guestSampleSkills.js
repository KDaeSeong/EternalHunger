// 샘플 전용 스킬이다. 사용자 정의 캐릭터와 저장된 로컬 스킬에는 자동 적용하지 않는다.
const ROLE_PASSIVE_HP = { tank: 90, bruiser: 65, support: 50, duelist: 45, assassin: 35, mage: 30, scout: 30, marksman: 20 };
const MELEE_ROLES = new Set(['tank', 'bruiser', 'duelist', 'assassin']);

export function buildGuestSampleSkills(role, attackRange) {
  // 완전한 편집기 객체는 매 프레임 복제하지 않고, 런타임 정규화가 빈 필드를 채운다.
  const make = (slot, source) => ({ enabled: true, slot, castDelaySec: 0.15,
    recoveryDelaySec: 0.15, type: 'attack_skill', ...source });
  const melee = MELEE_ROLES.has(role);
  const mage = role === 'mage';
  const support = role === 'support';
  const attack = (name, flat, attackPowerScale, skillAmpScale, extra = {}) => ({
    name, flatDamage: flat, attackPowerScale, skillAmpScale, range: Math.max(attackRange, mage || support ? 6 : 0), ...extra,
  });
  const skills = {
    q: make('q', attack(mage ? 'VF 파동' : support ? '공명탄' : '집중 타격', [12, 16, 20, 24, 28],
      mage || support ? 0.1 : 0.3, mage ? 0.45 : support ? 0.3 : 0, { cooldownSec: mage ? 6 : 7 })),
    w: make('w', { name: support ? '회복의 선율' : '방어 태세', type: support ? 'heal_skill' : 'shield_skill',
      heal: support ? [18, 23, 28, 33, 38] : [0],
      shield: support ? [0] : role === 'tank' ? [35, 42, 49, 56, 63] : [20, 25, 30, 35, 40],
      skillAmpScale: mage || support ? 0.25 : 0, durationSec: 3, cooldownSec: 12,
      range: 7, maxTargetHpPct: 0.8, supportTargetScope: support ? 'team' : 'self' }),
    e: make('e', melee ? attack('진입', [4, 6, 8, 10, 12], 0.15, 0, {
      cooldownSec: 14, range: 6, includesMovement: true, movementMode: 'toward_target', movementDistance: 3.5,
    }) : mage ? attack('VF 충격', [8, 12, 16, 20, 24], 0, 0.25, { cooldownSec: 12 })
      : support ? { name: '수호의 화음', type: 'shield_skill', shield: [22, 28, 34, 40, 46],
        skillAmpScale: 0.3, cooldownSec: 16, durationSec: 3, range: 7, maxTargetHpPct: 0.85, supportTargetScope: 'team' }
        : { name: '거리 확보', flatDamage: [0], cooldownSec: 16, range: 6,
          includesMovement: true, movementMode: 'away_from_target', movementDistance: 2,
          maxCasterHpPct: 0.45, minExpectedDamage: 0 }),
    r: make('r', support ? { name: '합주의 울림', type: 'heal_skill', heal: [30, 38, 46, 54, 62],
      skillAmpScale: 0.5, cooldownSec: 40, range: 7, maxTargetHpPct: 0.5, supportTargetScope: 'team' }
      : attack(mage ? 'VF 폭발' : '결정타', [20, 26, 32, 38, 44], mage ? 0 : 0.5, mage ? 0.55 : 0,
        { cooldownSec: 40, maxTargetHpPct: 0.5, radius: mage ? 1.5 : 0 })),
    passive: make('passive', { name: '생존 훈련', type: 'passive_stat',
      statModifiers: { maxHp: ROLE_PASSIVE_HP[role] || 30 }, castDelaySec: 0, recoveryDelaySec: 0 }),
  };
  return skills;
}
