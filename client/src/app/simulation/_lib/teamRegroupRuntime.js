import { getCombatSpaceId } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';

const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function describeTeamRegroupDecision(evidence, zoneName = String) {
  if (evidence?.version !== 1 || evidence.cleared) return '';
  const goal = evidence.targetZoneId ? `${zoneName(evidence.targetZoneId)} · 현장 동료 ${evidence.companionsAtTarget}명` : '';
  const labels = {
    together: `동료 ${evidence.memberCount}명이 같은 지역에서 공동 행동 계획`,
    arrived: '합류 지점 도착', waiting: '동료 합류 대기', joining: '팀원에게 합류 이동',
    opening: '초기 분산 파밍 유지', growing: '목표 장비 파밍·제작 우선',
    enemy_path: '합류 보류: 경로에 적이 있음', forbidden_path: '합류 보류: 금지구역이 경로를 막음',
    disconnected: '합류 보류: 지도상 연결 경로 없음', recovery: '합류 보류: 체력 회복 우선',
    threat: '합류 보류: 현재 교전 위험에서 이탈', status: '합류 보류: 행동·이동 제한',
    combat: '합류 보류: 교전 중', hunt: '합류 보류: 진행 중인 사냥', cast: '합류 보류: 스킬 시전 중',
    action_wait: '합류 보류: 이동·행동 시간 대기', forbidden: '합류 보류: 금지구역 탈출 우선',
    endgame: '합류보다 최종 안전구역 진입 우선', reentry: '합류 보류: 직전 위험 지역 재진입 방지',
    replanned: '합류 계획 재검토',
  };
  const parts = [labels[evidence.status] || '합류 판단 기록', evidence.status === 'together' ? '' : goal];
  if (evidence.status === 'joining' && evidence.distance != null) parts.push(`결정 당시 ${evidence.distance}구역 거리`);
  if (evidence.status === 'growing' && evidence.growth) {
    const growth = evidence.growth;
    parts.push(`${growth.targetName || '목표 장비'} · 확보 ${growth.completedSlots}/${growth.totalSlots}`);
    if (growth.readyCraftId) parts.push('필요 재료 확보·제작 대기');
    else if (growth.missing.length) parts.push(`부족: ${growth.missing.slice(0, 3).map((row) => `${row.name || row.itemId} ×${row.need}`).join(', ')}${growth.missing.length > 3 ? ' 외' : ''}`);
  }
  if (evidence.status === 'recovery') parts.push(`당시 HP ${evidence.hp}/${evidence.maxHp} · 회복 기준 ${evidence.recoverHpBelow} 이하`);
  return parts.filter(Boolean).join(' · ');
}

// Observation of actual planning/execution, never a movement/loot command.
// Emit only semantic changes, not one log for every scheduler/frame tick.
export function publishTeamRegroupDecision(actor, planned, { from = actor?.zoneId, to = actor?.zoneId,
  reason = '', status = '', growthPlan = actor?._growthPlan, recoverHpBelow = 38,
  at = null, emitRunEvent = () => {}, addLog = () => {}, zoneName = String } = {}) {
  if (!actor) return;
  const previous = actor._teamRegroup;
  const alive = num(actor.hp) > 0 && !isDimensionRiftDefeated(actor);
  if (!planned || !alive) {
    if (previous != null) actor._teamRegroup = null;
    if (previous && alive) emitRunEvent('team_regroup', { who: String(actor._id || actor.id || ''), cleared: true }, at);
    return;
  }
  // Ordinary travel/action cooldown is already shown by the actor's timer.
  // Do not alternate "joining" and "waiting" logs every scheduler tick.
  if (status === 'action_wait' && previous && previous.targetZoneId === planned.targetZoneId
    && previous.to === String(to) && previous.combatSpaceId === getCombatSpaceId(actor)
    && ['joining', 'arrived', 'waiting', 'growing', 'recovery', 'threat', 'forbidden', 'endgame', 'reentry'].includes(previous.status)) return;
  const overrides = { 'flee:forbidden': 'forbidden', recover: 'recovery', 'flee:low_hp': 'recovery',
    status_move_block: 'status', retreat_cooldown: 'reentry', endgame_rotate: 'endgame' };
  let outcome = status || overrides[reason] || (reason.startsWith('flee:') ? 'threat' : '');
  if (!outcome) {
    if (planned.stage === 'path_blocked') outcome = planned.blocked;
    else if (growthPlan && !growthPlan.openingComplete && !growthPlan.blocked) outcome = 'growing';
    else if (planned.stage === 'growing') outcome = 'replanned';
    else if (planned.stage === 'joining') outcome = reason === 'team_regroup'
      ? String(to) === planned.targetZoneId ? 'arrived' : String(from) !== String(to) ? 'joining' : 'waiting'
      : 'replanned';
    else outcome = planned.stage;
  }
  // There is no outstanding join delay when the pre-action roster is together.
  if (planned.stage === 'together') outcome = 'together';
  const growth = outcome === 'growing' && growthPlan ? {
    targetId: String(growthPlan.targetId || ''), targetName: String(growthPlan.targetName || ''),
    completedSlots: num(growthPlan.completedSlots), totalSlots: num(growthPlan.totalSlots), readyCraftId: String(growthPlan.readyCraftId || ''),
    missing: (growthPlan.missing || []).map((row) => ({ itemId: String(row.itemId), name: String(row.name || ''), need: num(row.need) })),
  } : null;
  const evidence = { version: 1, teamId: String(planned.teamId), combatSpaceId: getCombatSpaceId(actor),
    memberCount: planned.memberCount, targetZoneId: String(planned.targetZoneId || ''),
    companionsAtTarget: Math.max(0, num(planned.atTargetCount) - (String(from) === planned.targetZoneId ? 1 : 0)),
    from: String(from || ''), to: String(to || ''), distance: planned.distance ?? null, status: outcome, growth,
    hp: Math.max(0, num(actor.hp)), maxHp: Math.max(1, num(actor.maxHp)), recoverHpBelow,
  };
  const semanticKey = (row) => JSON.stringify(row && { teamId: row.teamId, combatSpaceId: row.combatSpaceId,
    status: row.status, memberCount: row.memberCount,
    ...(row.status !== 'together' ? { targetZoneId: row.targetZoneId, companionsAtTarget: row.companionsAtTarget,
      from: row.from, to: row.to, distance: row.distance, growth: row.growth } : {}) });
  if ((!previous && outcome === 'together') || semanticKey(previous) === semanticKey(evidence)) return;
  actor._teamRegroup = { ...evidence, at: at ? { ...at } : null };
  emitRunEvent('team_regroup', { who: String(actor._id || actor.id || ''), regroupEvidence: structuredClone(actor._teamRegroup) }, at);
  addLog(`🤝 [${actor.name || actor._id}] ${describeTeamRegroupDecision(evidence, zoneName)}`, 'normal');
}
