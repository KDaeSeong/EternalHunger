import { getActorTeamId, getActorTeamName } from './teamRuntime';
import { getActorGrowthProgress } from './growthPlanRuntime';
import { getEquipSummary } from './survivorRuntime';
import { formatClock } from './simulationFormattingRuntime';
import { formatMoveIntentLabel } from './moveIntentRuntime';
import { getSpatialPosition, getSpatialStats, getForcedControlMotion, isInBasicAttackRange } from './combatSpatialRuntime.js';
import { canMoveByStatus, canBasicAttackByStatus } from '../../../utils/statusLogic.js';
import { getActionStatePresentation } from './runtimeStatusDisplay.js';
import { describeDimensionRiftRewardClosure } from './dimensionRiftRewardPresentation.js';
import { getTimedWildlifeCombatSummary } from './wildlifeCombatRuntime.js';
import { describeMovementObjective, getAvailableMovementObjective, movementObjectivesOverlap } from './movementObjectiveRuntime.js';
import { getCombatSpaceId, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';

const list = (value) => Array.isArray(value) ? value : [];
const idOf = (actor) => String(actor?._id || actor?.id || '');
const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const decisionKinds = new Set(['move', 'team_decision', 'growth_plan', 'queue', 'hunt_start', 'hunt_end', 'dimension_rift_space']);
const importantKinds = new Set(['death', 'revive', 'elimination', 'team_engagement', 'team_cover', 'chase', 'resource_replan', 'rest', 'hunt_start', 'hunt_end', 'skill_cancel', 'forced_control', 'sleep_break', 'effect', 'dimension_rift_space', 'dimension_rift_defeat', 'dimension_rift_reward_closed', 'spatial_displacement', 'spatial_displacement_pending', 'movement_goal', 'objective']);
const observerScalarActorKeys = ['who', 'a', 'b', 'by', 'targetId', 'target', 'victimId', 'chaserId', 'sourceActorId', 'opponentId', 'strikerId'];
const observerArrayActorKeys = ['assistIds', 'participants', 'helpers'];

export function observerEventActorIds(event) {
  return [...new Set([event.who, event.a, event.b, event.by, event.targetId, event.target, event.victimId, event.chaserId, event.sourceActorId, event.opponentId, event.strikerId,
    ...list(event.assistIds), ...list(event.participants), ...list(event.helpers), ...list(event.teams).flatMap(list),
    ...(event.kind === 'dimension_rift_reward_closed' ? list(event.memberIds) : [])]
    .filter((id) => typeof id === 'string' || typeof id === 'number').map(String).filter(Boolean))];
}

function observerEventInvolvesMember(event, memberIds) {
  for (const key of observerScalarActorKeys) {
    const value = event?.[key];
    if ((typeof value === 'string' || typeof value === 'number') && memberIds.has(String(value))) return true;
  }
  for (const key of observerArrayActorKeys) {
    for (const value of list(event?.[key])) {
      if ((typeof value === 'string' || typeof value === 'number') && memberIds.has(String(value))) return true;
    }
  }
  for (const team of list(event?.teams)) {
    for (const value of list(team)) {
      if ((typeof value === 'string' || typeof value === 'number') && memberIds.has(String(value))) return true;
    }
  }
  if (event?.kind === 'dimension_rift_reward_closed') {
    for (const value of list(event?.memberIds)) {
      if ((typeof value === 'string' || typeof value === 'number') && memberIds.has(String(value))) return true;
    }
  }
  return false;
}

export function getObserverVisibleActors(actors, trackedIds = [], limit = 12) {
  const rows = list(actors);
  if (!rows.length || limit <= 0) return [];
  const tracked = trackedIds instanceof Set ? trackedIds : new Set(list(trackedIds));
  if (!tracked.size) return rows.length > limit ? rows.slice(0, limit) : rows;
  const prioritized = [];
  const remainder = [];
  rows.forEach((actor) => (tracked.has(idOf(actor)) ? prioritized : remainder).push(actor));
  if (!prioritized.length) return rows.length > limit ? rows.slice(0, limit) : rows;
  return prioritized.concat(remainder).slice(0, limit);
}

export function describeObserverReason(event = {}) {
  const raw = String(event.reason || '').replace(/:ttl|:priority/g, '');
  const recordsMove = event.moved === true || event.kind === 'move';
  const labels = {
    'flee:low_hp': '체력이 낮아 후퇴', 'flee:forbidden': '금지구역에서 이탈',
    'flee:team_outnumbered': '현장 인원·전력 열세로 후퇴', 'flee:team_power_gap': '현장 팀 전력 열세로 후퇴',
    'flee:power_gap': '전력 열세로 후퇴', low_hp: '체력이 낮아 후퇴', forbidden: '금지구역에서 이탈',
    power_gap: '전력 열세로 후퇴', team_outnumbered: '현장 인원·전력 열세로 후퇴',
    team_power_gap: '현장 팀 전력 열세로 후퇴', avoid_power: '불리한 교전 회피',
    avoid_low_hp: '체력을 보존하며 교전 회피', escape: '위험에서 이탈',
    chase: '상대 추격', tac_blink_escape: '블링크로 이탈', knockback: '넉백으로 밀려남',
    retreat_cooldown: '직전 위험 지역 즉시 복귀 보류',
    team_regroup: event.moved === false ? '팀원 합류 대기' : recordsMove ? '팀원에게 합류 이동' : '팀 합류 목표',
    team_rotate: event.moved === false ? '팀 공동 목표 지역 유지' : recordsMove ? '팀 공동 목표로 이동' : '팀 공동 목표',
    recover: '회복 우선', low_hp_recovery: '저체력으로 안전 대기', growth_farm: '목표 장비 재료 탐색',
    growth_craft: '목표 장비 제작 준비', growth_ready: '성장 완료·다음 행동 검토',
    growth_blocked: '성장 경로 재검토', endgame_rotate: '최종 안전구역으로 이동', wander: '지역 탐색',
    status_move_block: '상태 이상으로 이동 보류',
  };
  const knownIntent = /^(early_route|dimension_rift)/.test(raw) || raw === 'surplus credits kiosk' || !!event.objectiveType || /[가-힣]/.test(raw);
  let text = labels[raw] || (knownIntent ? formatMoveIntentLabel(raw, event.objectiveType, event.objectiveSubkind, event.movementObjective) : '상세 판단 기록 없음');
  const objectiveLabel = describeMovementObjective(event.movementObjective);
  if (labels[raw] && objectiveLabel) text += ` · ${objectiveLabel}`;
  if (raw === 'team_rotate' && !objectiveLabel && event.sharedGoalReason) text += ` · ${formatMoveIntentLabel(event.sharedGoalReason)}`;
  if (event.blocked) {
    const blockage = ({ no_material_source: '필요한 재료의 공급처 없음', no_safe_path: '안전한 재료 경로 없음', invalid_recipe: '제작법 연결 확인 필요' })[event.blocked] || '성장 계획 막힘';
    text = text === '상세 판단 기록 없음' ? blockage : `${text} · ${blockage}`;
  }
  const assessment = event.teamAssessment || event;
  if (Number.isFinite(assessment.allyCount) && Number.isFinite(assessment.enemyCount)) {
    text += ` · 당시 현장 아군 ${assessment.allyCount}명 / 적군 ${assessment.enemyCount}명`;
  }
  return text;
}

const deathReasons = { combat: '교전', character_skill_splash: '스킬 피해', detonation: '폭발 타이머 만료', forbidden: '금지구역 피해', status: '상태 효과', bleed: '출혈', poison: '중독' };
export function describeObserverDeath(actor, nameOf) {
  const cause = String(actor?._deathCauseName || actor?.deathCauseName || deathReasons[actor?._deathBy || actor?.deathReason] || '원인 미기록');
  const by = String(actor?._deathKillerId || actor?.deathKillerId || '');
  return `${cause}${by ? ` · 처치자 ${nameOf(by)}` : ''}`;
}

export function describeObserverEvent(event, { nameOf = String, zoneName = String } = {}) {
  const who = nameOf(String(event.who || event.a || ''));
  const where = event.zoneId ? ` · ${zoneName(event.zoneId)}` : '';
  switch (event.kind) {
    case 'movement_goal': return event.objective
      ? `${who}: ${event.objective.shared ? '팀 공동 목표' : '목표'} 지정 · ${describeMovementObjective(event.objective)} · ${zoneName(event.objective.targetZoneId)} (아직 획득 전)`
      : event.previousObjective ? `${who}: ${describeMovementObjective(event.previousObjective)} 목표 해제 · 다음 판단으로 전환` : '';
    case 'objective': {
      if (event.objective === 'boss') return `${who}: ${describeMovementObjective({ type: 'boss', subkind: event.subkind })} · ${event.success ? '처치 완료' : '처치 실패'}${where}`;
      if (['natural_core', 'legendary_crate'].includes(event.objective)) return `${who}: ${event.itemName || '오브젝트 보상'} ${event.success && num(event.qty) > 0 ? `${num(event.qty)}개 획득` : '획득 실패'}${where}`;
      return '';
    }
    case 'move': return `${who}: ${zoneName(event.from)} → ${zoneName(event.to)} · ${describeObserverReason(event)}${event.targetZoneId && event.targetZoneId !== event.to ? ` · 목적지 ${zoneName(event.targetZoneId)}` : ''}${event.etaSec ? ` · 이동 ${event.etaSec}초` : ''}`;
    case 'team_decision': return `${who}: ${describeObserverReason(event)}${event.targetZoneId ? ` · 목표 ${zoneName(event.targetZoneId)}` : ''}`;
    case 'growth_plan': return `${who}: ${describeObserverReason(event)}${event.targetName ? ` · 목표 ${event.targetName}` : ''}`;
    case 'queue': {
      const action = ({ routeFarm: '루트 탐색', craft: '제작', hunt: '사냥', moveTo: '이동', flee: '후퇴', kioskBuy: '키오스크 주문', kioskExchange: '키오스크 교환', kioskSell: '키오스크 판매', droneBuy: '드론 주문', droneOrder: '드론 주문', gather: '채집', rest: '휴식' })[event.chosen] || '다음 행동';
      const reason = describeObserverReason(event);
      return `${who}: ${action} 선택${event.itemName ? ` · ${event.itemName}` : ''}${reason !== '상세 판단 기록 없음' ? ` · ${reason}` : ''}${event.targetZoneId ? ` · 이동 목표 ${zoneName(event.targetZoneId)}` : ''}${list(event.blockedReasons).some((blockedReason) => blockedReason === 'craft:missing_ing') ? ' · 제작 재료 부족' : ''} (성공 여부는 후속 기록)`;
    }
    case 'craft': return `${who}: ${event.itemName || '아이템'} 제작 완료${where}`;
    case 'resource_replan': return `${who}: ${zoneName(event.from)} 재료 소진 · ${event.to ? `${zoneName(event.to)} 재탐색` : '성장 목표 재검토'}`;
    case 'rest': return `${who}: 저체력으로 안전 대기 · HP ${num(event.hp)}/${num(event.maxHp)}${where}`;
    case 'hunt_start': return `${who}: ${event.wildlifeName || event.subkind || '야생동물'} 사냥 개시 · 대상 HP ${num(event.wildlifeHp)}/${num(event.wildlifeMaxHp)} · 거리 ${num(event.distance).toFixed(1)}m${where}`;
    case 'hunt_exchange': {
      const hunterStruck = String(event.strikerId || '') === String(event.who || '');
      return hunterStruck
        ? `${who} → ${event.wildlifeName || '야생동물'}: 실제 피해 ${num(event.damageDealt)} · 대상 HP ${num(event.wildlifeHp)}${where}`
        : `${event.wildlifeName || '야생동물'} → ${who}: 실제 피해 ${num(event.damageTaken)} · HP ${num(event.hunterHp)}${where}`;
    }
    case 'hunt_end': return `${who}: ${event.wildlifeName || event.subkind || '야생동물'} 사냥 ${event.outcome === 'victory' ? '완료' : event.outcome === 'hunter_defeated' ? '중 사망' : '중단'} · 가한 피해 ${num(event.damageDealt)} / 받은 피해 ${num(event.damageTaken)}${event.reason ? ` · ${event.reason}` : ''}${where}`;
    case 'dimension_rift_defeat': return `${who}: 차원의 틈 전투 불능 · 경기 사망/처치 보상 없음${event.by ? ` · 공격자 ${nameOf(event.by)}` : ''}${where}`;
    case 'spatial_displacement': {
      if (event.sourceKind === 'character_skill' || event.reason === 'character_skill_movement') {
        const action = event.movementMode === 'away_from_target' ? '후퇴' : '돌진';
        return `${who}: ${event.skill || '캐릭터 스킬'} ${action} ${num(event.actualDistance)}m${event.stoppedAtTarget ? ' · 대상 위치에서 멈춤' : event.clipped ? ' · 전장 경계에서 멈춤' : ''}${event.targetId ? ` · 기준 대상 ${nameOf(event.targetId)}` : ''}${where}`;
      }
      return event.reason === 'tactical_movement'
        ? `${who}: 틈 내부 전술 이동${event.skill ? `(${event.skill})` : ''} ${num(event.actualDistance)}m${event.stoppedAtTarget ? ' · 대상 위치에서 멈춤' : ''}${event.targetId ? ` · 대상 ${nameOf(event.targetId)}` : ''}${where}`
        : `${who}: 틈 내부 넉백 ${num(event.actualDistance)}m${event.clipped ? ' · 전장 경계에서 멈춤' : ''}${event.sourceActorId ? ` · 시전자 ${nameOf(event.sourceActorId)}` : ''}${where}`;
    }
    case 'spatial_displacement_pending': return `${who}: 틈 내부 넉백 보류 · ${{ source_position_unknown: '시전자 위치 미확인',
      target_position_unknown: '현재 위치 미확인', impact_position_unknown: '피격 위치 미확인', invalid_distance: '이동 거리 오류' }[event.reason] || '적용 정보 미확인'}`;
    case 'dimension_rift_reward_closed': return `${describeDimensionRiftRewardClosure(event)}${where}`;
    case 'dimension_rift_space': {
      if (event.direction === 'enter') return `${who}: 차원의 틈 입장 · 필드 파밍 중단${where}`;
      const reason = ({ withdrawn: '참가 포기 · 입구 복귀', defeated: '전투 불능 후 입구 복귀 · HP 보충 없음 · 복귀 보호 3초', zone_closed: '입구 금지구역 전환 · 틈 종료',
        window_expired: '개방 시간 종료', no_decisive_result: '시간 내 결판 없음',
        uncontested: '참가 마감 후 단독 점거', last_present_team: '마지막 참가 팀 결정',
        membership_closed: '종료된 참가 정보 정리', membership_invalid: '손상된 참가 기록 격리 · 보상 제외',
        invalid_timing: '손상된 전장 시계로 승자 없이 종료', match_end: '경기 종료 · 입구 복귀',
        disabled: '틈 비활성화', eliminated: '참가자 사망' })[event.reason] || '전장 이탈';
      return `${who}: 차원의 틈 ${reason}${where}`;
    }
    case 'team_engagement': return `${zoneName(event.zoneId)} 팀 교전 · 실제 행동 참가 ${list(event.participants).map(nameOf).join(', ') || '없음'}`;
    case 'team_strike': return `${who} → ${nameOf(event.targetId)}: ${({ focus_fire: '같은 표적 집중 공격', taunted_target: '도발 시전자에게 기본 공격' })[event.reason] || '공격'} · HP 감소 ${num(event.damage)}`;
    case 'forced_control': return `${who}: ${event.effect} · ${event.reason || '강제 행동'} · 시전자 ${nameOf(event.sourceActorId || '미확인')}${where}`;
    case 'forced_control_end': return `${who}: ${event.effect} 강제 행동 종료${where}`;
    case 'sleep_break': return `${who}: ${nameOf(event.by || '상대')}에게 피격되어 수면 해제 · 추가 피해 ${num(event.bonusDamage)} (보호막 적용 전)${where}`;
    case 'effect': {
      if (event.source !== 'character_skill') return '';
      const source = `${nameOf(event.sourceActorId)}의 ${event.skill}`;
      const outcome = event.removedEffects ? `정화 · 제거: ${event.removedEffects.join(', ') || '없음'}`
        : event.outcome === 'applied' ? `${event.effect} 부여 ${num(event.duration)}초${event.suppressedBy ? ` · ${event.suppressedBy}로 일시 무시` : ''}`
          : `${event.effect} 차단 · ${event.immunityType || ({ resisted: '확률 저항', skipped: '적용 조건 불충족' })[event.outcome] || event.outcome}`;
      const reduction = event.durationAdjustment ? ` · 지속 시간 ${num(event.durationAdjustment.originalSec)}→${num(event.durationAdjustment.appliedSec)}초` : '';
      return `${who}: ${source} · ${outcome}${reduction}${where}`;
    }
    case 'team_cover': return `${list(event.helpers).map(nameOf).join(', ')}: ${who}의 퇴로 엄호 · 행동 시간 소비${where}`;
    case 'skill_cast': return `${who}: ${event.skill} 시전 → ${nameOf(event.targetId)} · ${Math.max(0, num(event.releaseAtSec) - num(event.startedAtSec)).toFixed(2)}초 후 발동${where}`;
    case 'skill_cancel': return `${who}: ${event.skill} 취소 · ${({ dead: '시전자 사망', status: '행동 제한 상태', moved: '지역 이탈', target_dead: '대상 사망', target_moved: '대상 지역 이탈', untargetable: '대상 지정 불가', target_team: '대상 팀 변경', out_of_range: '대상 사거리 이탈', out_of_sight: '대상 시야 이탈', disabled: '스킬 꺼짐' })[event.reason] || '시전 조건 해제'}${where}`;
    case 'skill_armed': return `${who}: ${event.skill} 강화 준비 · 다음 기본 공격에 적용${where}`;
    case 'skill_expired': return `${who}: ${event.skill} 강화 종료${where}`;
    case 'skill': return `${who}: ${event.skill} 발동 → ${nameOf(event.targetId || event.target)}${event.heal ? ` · 실제 회복 ${event.heal}` : ''}${event.shield ? ` · 보호막 ${event.shield}` : ''}${event.movementDistance ? ` · ${event.movementMode === 'away_from_target' ? '후퇴' : '돌진'} ${num(event.movementDistance)}m` : ''}${where}`;
    case 'battle': return `${nameOf(event.a)} ↔ ${nameOf(event.b)} 교전${where}`;
    case 'elimination': return `${who} → ${nameOf(event.victimId)} 처치${list(event.assistIds).length ? ` · 지원 ${event.assistIds.map(nameOf).join(', ')}` : ''}${where}`;
    case 'death': return `${who} 사망 · ${event.cause || deathReasons[event.reason] || '원인 미기록'}${event.by ? ` · 처치자 ${nameOf(event.by)}` : ''}${where}`;
    case 'revive': return `${who} 부활 · HP ${num(event.hp)}${event.by ? ` · 도움 ${nameOf(event.by)}` : ' · 자동 부활'}${event.paid ? ` · ${num(event.cost)}Cr 소비` : ''}${where}`;
    case 'chase': return `${who} / 추격자 ${nameOf(event.chaserId)} · ${({ escape_fail: '도주 실패', escape_no_chase: '추격 없이 이탈', escaped_after_chase: '추격을 따돌림', blink_escape: '블링크로 이탈', caught_after_chase: '추격에 붙잡힘' })[event.outcome] || (event.caught ? '추격에 붙잡힘' : event.escaped ? '교전에서 이탈' : '추격 결과 확인 중')}${where}`;
    default: return '';
  }
}

// Presentation only: no planner, random source, inventory normalization or game
// setters. Names are labels; exact participant IDs determine event membership.
export function buildTeamObserverModel({ survivors = [], dead = [], events = [], teamId = '', matchSec = 0,
  publicItems = [], killCounts = {}, assistCounts = {}, isGameOver = false, zoneName = String, spawnState, forbiddenIds = [] } = {}) {
  const actors = new Map();
  for (const actor of [...list(dead), ...list(survivors)]) if (idOf(actor)) actors.set(idOf(actor), actor);
  const nameOf = (id) => actors.get(String(id))?.name || String(id || '참가자 미상');
  const grouped = new Map();
  for (const actor of actors.values()) {
    const id = getActorTeamId(actor);
    if (!grouped.has(id)) grouped.set(id, { id, name: getActorTeamName(actor), members: [] });
    grouped.get(id).members.push(actor);
  }
  const teams = [...grouped.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
    .map((team) => ({ ...team, alive: team.members.filter((actor) => num(actor.hp) > 0).length }));
  const team = teams.find((row) => row.id === teamId) || teams[0];
  if (!team) return { teams, team: null, members: [], recent: [], turningPoints: [], trackedActorIds: [], objectives: [] };
  const memberIds = new Set(team.members.map(idOf));
  const allActors = [...actors.values()];
  const objectiveHolders = isGameOver ? [] : allActors.filter((actor) => num(actor.hp) > 0 && getCombatSpaceId(actor) === WORLD_COMBAT_SPACE
    && actor._movementObjective && Number.isFinite(actor._movementObjective.atSec) && actor._movementObjective.atSec <= matchSec)
    .map((actor) => ({ ...actor, _movementObjective: getAvailableMovementObjective(actor._movementObjective,
      { spawnState, forbiddenIds, nowSec: matchSec, teamId: getActorTeamId(actor), actor }) })).filter((actor) => actor._movementObjective);
  const objectiveGroups = new Map();
  for (const actor of objectiveHolders.filter((row) => memberIds.has(idOf(row)))) {
    const goal = actor._movementObjective;
    const key = JSON.stringify([goal.type, goal.subkind, goal.targetZoneId, goal.sourceIds]);
    if (!objectiveGroups.has(key)) objectiveGroups.set(key, { key, objective: goal, label: describeMovementObjective(goal),
      zone: zoneName(goal.targetZoneId), members: [], competingTeams: 0 });
    objectiveGroups.get(key).members.push(actor.name || idOf(actor));
  }
  const objectives = [...objectiveGroups.values()].map((group) => ({ ...group,
    competingTeams: new Set(objectiveHolders.filter((actor) => !memberIds.has(idOf(actor))
      && movementObjectivesOverlap(group.objective, actor._movementObjective)).map(getActorTeamId)).size,
  }));
  const timed = [];
  let ordered = true;
  let previousSec = -Infinity;
  list(events).forEach((event, index) => {
    const sec = event?.at?.sec == null ? NaN : Number(event.at.sec);
    if (!Number.isFinite(sec) || sec < 0 || sec > matchSec
      || !observerEventInvolvesMember(event, memberIds)) return;
    if (sec < previousSec) ordered = false;
    previousSec = sec;
    timed.push({ event, index, sec });
  });
  if (!ordered) timed.sort((a, b) => a.sec - b.sec || a.index - b.index);

  const recent = [];
  const turningPoints = [];
  const previousDecision = new Map();
  const lastDecisionByActor = new Map();
  const appendRecent = (rows, row, limit) => {
    rows.push(row);
    if (rows.length > limit) rows.shift();
  };
  for (const row of timed) {
    const whoId = String(row.event.who || '');
    if (row.event.kind === 'revive' && whoId) lastDecisionByActor.delete(whoId);
    if (decisionKinds.has(row.event.kind) && whoId) lastDecisionByActor.set(whoId, row);
    if (row.event.kind === 'queue') continue;
    const text = describeObserverEvent(row.event, { nameOf, zoneName });
    if (!text) continue;
    if (['team_decision', 'growth_plan'].includes(row.event.kind)) {
      const key = `${row.event.kind}:${row.event.who}`;
      if (previousDecision.get(key) === text) continue;
      previousDecision.set(key, text);
    }
    const formatted = { key: `${row.sec}:${row.index}`, sec: row.sec, clock: formatClock(row.sec), text, kind: row.event.kind };
    appendRecent(recent, formatted, 10);
    if (importantKinds.has(row.event.kind)) appendRecent(turningPoints, formatted, 8);
  }
  const members = [...team.members].sort((a, b) => num(a.matchTeamSlot || a.teamSlot) - num(b.matchTeamSlot || b.teamSlot) || idOf(a).localeCompare(idOf(b))).map((actor) => {
    const id = idOf(actor);
    const lastDecision = lastDecisionByActor.get(id);
    const progress = getActorGrowthProgress(actor, publicItems);
    const readyIn = Math.max(0, Math.ceil(num(actor._actionReadyAtSec) - matchSec));
    const position = getSpatialPosition(actor); const spatialStats = getSpatialStats(actor);
    const hunt = getTimedWildlifeCombatSummary(actor);
    const motion = actor._spatialMotion;
    const forced = num(actor.hp) > 0 ? getForcedControlMotion(actor, allActors) : null;
    const forcedText = forced ? `${forced.control.name}: 시전자 ${nameOf(forced.control.sourceActorId || '미확인')} · ${
      !forced.sourcePosition ? '위치 미확인으로 대기' : !canMoveByStatus(actor, { forced: true })
        ? forced.control.mode === 'taunt' && canBasicAttackByStatus(actor) ? '이동 불가 · 사거리 안에서만 기본 공격' : '이동 제한으로 강제 보행 중단'
        : forced.control.mode === 'taunt' && forced.source && isInBasicAttackRange(actor, forced.source, [...actors.values()])
          ? '사거리 안 · 시전자 기본 공격 대기'
          : ({ fear: '반대 방향으로 보행', charm: '시전자 방향으로 보행', taunt: '기본 공격 사거리까지 접근' })[forced.control.mode]}` : '';
    return { id, name: actor.name || id, alive: num(actor.hp) > 0, zone: zoneName(actor.zoneId),
      hp: Math.max(0, Math.floor(num(actor.hp))), maxHp: Math.max(1, Math.floor(num(actor.maxHp))),
      progress: `${progress.completedSlots}/${progress.totalSlots}`, hasGoals: progress.totalSlots > 0,
      equipment: getEquipSummary(actor).full, goal: progress.remaining[0]?.name || '', readyIn,
      spatial: position ? `지역 내 (${position.x.toFixed(1)}, ${position.y.toFixed(1)})m · 평타 ${spatialStats.attackRange.toFixed(1)}m / 시야 ${spatialStats.sightRange.toFixed(1)}m / 이속 ${spatialStats.moveSpeed.toFixed(1)}m/s` : '',
      motion: [getActionStatePresentation(actor).text, forcedText || (motion && position && motion.zoneId === position.zoneId
        ? `이동 계획: ${({ patrol: '지역 내부 탐색', approach: '공격 사거리까지 접근', last_seen: '마지막 목격 위치 탐색' })[motion.reason] || '이동'}` : '')].filter(Boolean).join(' · '),
      casting: actor._pendingCharacterCast ? `${actor._pendingCharacterCast.def.name} 시전 중 · ${Math.max(0, actor._pendingCharacterCast.releaseAtSec - matchSec).toFixed(2)}초 후 발동` : '',
      armed: actor._armedCharacterSkill ? `${actor._armedCharacterSkill.def.name} 강화 준비 · 다음 기본 공격 대기` : '',
      hunt: hunt ? `${actor._wildlifeHunt?.target?.name || '야생동물'} 사냥 중 · 대상 HP ${Math.max(0, Math.ceil(hunt.wildlifeHp))}/${Math.max(1, Math.ceil(hunt.wildlifeMaxHp))} · 거리 ${Number.isFinite(hunt.distance) ? hunt.distance.toFixed(1) : '?'}m · 가한 피해 ${Math.round(hunt.damageDealt)} / 받은 피해 ${Math.round(hunt.damageTaken)}` : '',
      kills: num(killCounts[id]), assists: num(assistCounts[id]),
      death: describeObserverDeath(actor, nameOf),
      decision: lastDecision ? { text: describeObserverEvent(lastDecision.event, { nameOf, zoneName }), clock: formatClock(lastDecision.sec), sec: lastDecision.sec } : null };
  });
  const totalKills = members.reduce((sum, actor) => sum + actor.kills, 0);
  const totalAssists = members.reduce((sum, actor) => sum + actor.assists, 0);
  const allDead = team.alive === 0;
  const aliveTeams = teams.filter((row) => row.alive > 0).length;
  return { teams, team, members, trackedActorIds: [...memberIds],
    objectives,
    status: isGameOver ? (team.alive > 0 && aliveTeams === 1 ? '최후 생존 팀' : '경기 종료') : allDead ? '현재 전원 사망 · 부활 가능 여부는 경기 규칙에 따름' : '관전 중',
    summary: `생존 ${team.alive}/${members.length} · ${totalKills}처치 · ${totalAssists}어시스트`,
    recent: recent.reverse(), turningPoints: turningPoints.reverse(),
    historyNote: '현재 보존된 경기 기록 기준 · 시각은 게임 내 경과 시간' };
}
