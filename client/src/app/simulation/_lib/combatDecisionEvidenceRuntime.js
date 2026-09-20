import { getLocalTeamCombatants } from './teamTacticsRuntime.js';
import { summarizeEquipTierForMovePower } from './movePowerRuntime.js';

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const idOf = (actor) => String(actor?._id || actor?.id || '');
const hpOf = (actor) => ({ hp: Math.max(0, finite(actor?.hp)), maxHp: Math.max(1, finite(actor?.maxHp || actor?.stats?.maxHp, 100)) });

function summarize(rows) {
  const result = { count: rows.length, ids: rows.map(idOf), hp: 0, maxHp: 0, hpRatioAverage: 0,
    weaponTierTotal: 0, armorTierTotal: 0, emptySlots: 0 };
  for (const row of rows) {
    const hp = hpOf(row);
    const gear = summarizeEquipTierForMovePower(row);
    result.hp += hp.hp;
    result.maxHp += hp.maxHp;
    result.hpRatioAverage += Math.min(1, hp.hp / hp.maxHp) / Math.max(1, rows.length);
    result.weaponTierTotal += gear.weaponTier;
    result.armorTierTotal += gear.armorTierSum;
    result.emptySlots += Math.max(0, 5 - gear.equippedCount);
  }
  return result;
}

// Capture only at an actual decision boundary, never in every safe-path search.
// The result owns scalar/array copies and never reads future actor state or RNG.
export function captureCombatDecisionEvidence({ actor, opponent, roster = [], reason = '', at = null,
  comparison = null, hpThreshold = null, thresholds = null } = {}) {
  const local = getLocalTeamCombatants(actor, roster);
  const scope = comparison?.scope || (comparison ? 'duel' : 'local');
  const allies = scope === 'duel' ? [actor].filter(Boolean) : local.allies;
  const enemies = scope === 'duel' ? [opponent].filter(Boolean) : local.enemies;
  return {
    version: 1, reason: String(reason), zoneId: String(actor?.zoneId || ''),
    at: at ? { day: finite(at.day), phase: String(at.phase || ''), sec: finite(at.sec) } : null,
    actor: { id: idOf(actor), ...hpOf(actor) }, scope,
    localAllyCount: local.allies.length, localEnemyCount: local.enemies.length,
    allies: summarize(allies), enemies: summarize(enemies),
    comparison: comparison ? Object.fromEntries(['myP', 'opP', 'ratio', 'minRatio', 'absDelta']
      .filter((key) => Number.isFinite(comparison[key])).map((key) => [key, comparison[key]])) : null,
    hpThreshold: Number.isFinite(hpThreshold) ? hpThreshold : null,
    thresholds: thresholds ? structuredClone(thresholds) : null,
  };
}

const value = (n) => Number(finite(n).toFixed(1));
export function describeCombatDecisionEvidence(evidence) {
  if (evidence?.version !== 1) return '';
  const { actor, allies, enemies, comparison } = evidence;
  const basis = ({ low_hp: '체력 부족', critical_flee: '피격 후 빈사', recover: '체력 회복',
    team_outnumbered: '현장 인원·전력 열세', team_power_gap: '현장 팀 전력 열세', power_gap: '전력 추정 열세',
    avoid_power: '전력 추정 열세', early_route_avoid: '초반 파밍 유지' })[evidence.reason];
  const parts = [basis ? `판단 근거: ${basis}` : '', `당시 현장 아군 ${evidence.localAllyCount}명 / 적군 ${evidence.localEnemyCount}명`,
    `내 HP ${value(actor.hp)}/${value(actor.maxHp)}${evidence.hpThreshold != null ? ` (체력 기준 ${value(evidence.hpThreshold)} 이하)` : ''}`];
  if (enemies.count) {
    const sides = evidence.scope === 'duel' ? '본인/비교 상대' : '아군/적군';
    const averageTier = (group) => value((group.weaponTierTotal + group.armorTierTotal) / Math.max(1, group.count * 5));
    parts.push(`${sides} 평균 잔여 체력 ${value(allies.hpRatioAverage * 100)}% / ${value(enemies.hpRatioAverage * 100)}%`);
    parts.push(`장비 등급 평균 ${averageTier(allies)} / ${averageTier(enemies)} (빈 슬롯 포함)`);
    if (comparison) parts.push(`전력 추정 ${value(comparison.myP)} / ${value(comparison.opP)}`);
  }
  return parts.filter(Boolean).join(' · ');
}

export function describeRetreatOutcome(outcome) {
  return ({ moved: '현재 지역 이탈', no_safe_path: '후퇴 보류: 안전한 이동 경로 없음',
    status_blocked: '후퇴 불가: 이동 제한 상태', cooldown_hold: '후퇴 보류: 직전 위험 지역 재진입 방지',
    escape_failed: '도주 실패: 현재 지역에 남음', escaped: '추격을 따돌림', caught: '지역은 벗어났지만 추격에 붙잡힘',
    rift_withdrawn: '차원의 틈 참가 포기·입구 복귀', declined: '불리하지만 교전 선택' })[outcome] || '';
}

export function describeCombatDecisionContext(evidence, outcome = '') {
  return [describeCombatDecisionEvidence(evidence), describeRetreatOutcome(outcome)].filter(Boolean).join(' · ');
}
