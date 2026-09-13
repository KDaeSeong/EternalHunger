import { ACTIVE_CHARACTER_SKILL_SLOTS, PASSIVE_STAT_TYPE, areCharacterSkillsEnabled, getCharacterSkillDef,
  normalizeSkillState } from './characterSkillDefinitionRuntime.js';
import { previewCharacterSkill, applyPreparedCharacterSkill, hasSecondStagePayload } from './characterSkillRuntime.js';
import { canUseSkillByStatus, getActiveStatusEffects, isTargetableByStatus } from '../../../utils/statusLogic.js';
import { areSameTeam } from './teamRuntime.js';
import { canObserveActor, isInSpatialSkillRange, rememberSpatialContact } from './combatSpatialRuntime.js';
import { getCombatSpaceId, shareCombatSpace, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';
import { predictCooldownReadyAt, resolveCharacterSkillCooldownSec } from './cooldownRuntime.js';
import { canPaySkillResource, spendSkillResource } from './uniqueResourceRuntime.js';

const idOf = (actor) => String(actor?._id || actor?.id || '');
const roundTime = (value) => Math.round(Number(value) * 1e6) / 1e6;
const isEnhancement = (def) => ['basic_attack_enhance', 'basic_attack_recast'].includes(def?.type);
const releaseDelay = (actor, tags) => getActiveStatusEffects(actor).reduce((delay, effect) =>
  effect.tags.some((tag) => tags.includes(tag)) ? Math.max(delay, effect.remainingDuration == null ? Infinity : effect.remainingDuration) : delay, 0);
const reasons = { dead: '시전자 사망', status: '행동 제한 상태', moved: '시전자 지역 이탈', combat_space: '전장 경계 이탈',
  target_dead: '대상 사망', target_moved: '대상 지역 이탈', untargetable: '대상 지정 불가', disabled: '스킬 사용 꺼짐',
  target_team: '대상 팀 변경', out_of_sight: '대상 시야 이탈', out_of_range: '대상 사거리 이탈', expired: '강화 대기 시간 만료' };

export function findCharacterSkillChoice(actor, opponents, roster, nowSec, settings = {}) {
  if (!actor || actor._pendingCharacterCast || Number(actor.hp || 0) <= 0 || !areCharacterSkillsEnabled(settings)) return null;
  const state = normalizeSkillState(actor);
  const allies = roster.filter((row) => idOf(row) !== idOf(actor) && shareCombatSpace(actor, row) && areSameTeam(actor, row) && String(row.zoneId) === String(actor.zoneId));
  const candidates = [];
  for (const slot of ACTIVE_CHARACTER_SKILL_SLOTS) {
    const def = getCharacterSkillDef(actor, slot);
    if (!def || def.type === PASSIVE_STAT_TYPE || (isEnhancement(def) && actor._armedCharacterSkill)) continue;
    if (!canPaySkillResource(actor, def)) continue;
    const saved = state[slot];
    let recast = saved.stage === 'recast' && Number(saved.recastUntil || 0) > nowSec && hasSecondStagePayload(def);
    const tags = ['action_block', 'skill_block', ...(def.includesMovement ? ['move_block'] : [])];
    const cooldownReadyAt = recast ? nowSec : predictCooldownReadyAt(actor, saved.cooldownUntil, nowSec);
    let atSec = roundTime(Math.max(nowSec + releaseDelay(actor, tags), Number(actor._actionReadyAtSec || 0), cooldownReadyAt));
    if (!Number.isFinite(atSec)) continue;
    // If a waiting recast expires before this actor is free, use the ordinary
    // cooldown instead of granting a late second cast.
    if (recast && atSec >= Number(saved.recastUntil)) {
      recast = false; atSec = Math.max(atSec, predictCooldownReadyAt(actor, saved.cooldownUntil, nowSec));
    }
    const localOpponents = opponents.filter((row) => shareCombatSpace(actor, row));
    const defender = localOpponents.find(isTargetableByStatus) || localOpponents[0];
    if (!defender) continue;
    const plan = previewCharacterSkill(actor, defender, def, recast ? 2 : 1, {
      settings, splashTargets: localOpponents.filter((row) => idOf(row) !== idOf(defender)), supportTargets: allies,
      previewFuture: true, visionRoster: roster, nowSec,
    });
    if (plan) candidates.push({ ...plan, atSec });
  }
  candidates.sort((a, b) => a.atSec - b.atSec || Number(b.decision.targetScore || 0) - Number(a.decision.targetScore || 0)
    || ACTIVE_CHARACTER_SKILL_SLOTS.indexOf(a.def.slot) - ACTIVE_CHARACTER_SKILL_SLOTS.indexOf(b.def.slot));
  return candidates[0] || null;
}

function castEvent(kind, actor, cast, nowSec, actions, extra = {}) {
  const payload = { who: idOf(actor), targetId: cast.targetId, skill: cast.def.name, slot: cast.def.slot, stage: cast.stage,
    castId: cast.castId, zoneId: cast.zoneId, startedAtSec: cast.startedAtSec, releaseAtSec: cast.releaseAtSec,
    recoveryUntilSec: cast.recoveryUntilSec, ...extra };
  actions.emitRunEvent?.(kind, payload, actions.atNow?.() || { sec: nowSec });
  const text = kind === 'skill_cast' ? `시전 시작 → ${cast.releaseAtSec}초 발동 예정`
    : kind === 'skill_cancel' ? `시전 취소: ${reasons[extra.reason] || extra.reason}`
      : kind === 'skill_armed' ? '기본 공격 강화 준비 완료' : `강화 종료: ${reasons[extra.reason] || extra.reason}`;
  actions.addLog?.(`[${actor.name}] ${cast.def.name}: ${text}`, 'combat-detail');
}

export function startCharacterCast(actor, choice, nowSec, settings, actions = {}) {
  if (!choice || choice.atSec > nowSec || actor._pendingCharacterCast || actor._armedCharacterSkill && isEnhancement(choice.def)
    || actor.hp <= 0 || !canUseSkillByStatus(actor, choice.def) || Number(actor._actionReadyAtSec || 0) > nowSec
    || !areCharacterSkillsEnabled(settings)) return false;
  const state = normalizeSkillState(actor); const saved = state[choice.def.slot];
  if (choice.stage === 2 ? saved.stage !== 'recast' || Number(saved.recastUntil || 0) <= nowSec : Number(saved.cooldownUntil || 0) > nowSec) return false;
  const resourceSpend = spendSkillResource(actor, choice.def);
  if (!resourceSpend.paid) return false;
  const timing = choice.decision.timing;
  const cast = { ...structuredClone(choice), zoneId: String(actor.zoneId), combatSpaceId: getCombatSpaceId(actor), startedAtSec: nowSec,
    releaseAtSec: roundTime(nowSec + timing.castDelaySec), recoveryUntilSec: roundTime(nowSec + timing.actionLockSec),
    previousActionReadyAtSec: Number(actor._actionReadyAtSec || 0),
    castId: `${idOf(actor)}:${Number(actor._characterCastSequence || 0) + 1}` };
  actor._characterCastSequence = Number(actor._characterCastSequence || 0) + 1;
  actor._pendingCharacterCast = cast;
  actor._spatialMotion = null;
  actor._actionReadyAtSec = Math.max(cast.previousActionReadyAtSec, cast.recoveryUntilSec);
  if (choice.stage === 1) saved.cooldownUntil = roundTime(nowSec + resolveCharacterSkillCooldownSec(actor, choice.def, settings));
  saved.stage = 'casting'; saved.recastUntil = 0; saved.castId = cast.castId;
  actor.skillState = state;
  if (resourceSpend.changed) {
    actions.emitRunEvent?.('unique_resource', {
      who: idOf(actor),
      whoName: actor.name,
      skill: choice.def.name,
      slot: choice.def.slot,
      phase: 'cast_start',
      resourceName: resourceSpend.resource.name,
      delta: -resourceSpend.cost,
      before: resourceSpend.before,
      after: resourceSpend.after,
      maxValue: resourceSpend.resource.maxValue,
    }, actions.atNow?.() || { sec: nowSec });
    actions.addLog?.(`[${actor.name}] ${resourceSpend.resource.name} -${resourceSpend.cost} (${resourceSpend.after}/${resourceSpend.resource.maxValue})`, 'combat-detail');
  }
  castEvent('skill_cast', actor, cast, nowSec, actions);
  return true;
}

export function getCharacterCastInvalidReason(actor, cast, roster, settings = {}) {
  if (Number(actor?.hp || 0) <= 0) return 'dead';
  if (!areCharacterSkillsEnabled(settings)) return 'disabled';
  if (cast.statusInterrupt || !canUseSkillByStatus(actor, cast.def)) return 'status';
  if (String(actor.zoneId) !== cast.zoneId) return 'moved';
  if (String(cast.combatSpaceId || WORLD_COMBAT_SPACE) !== getCombatSpaceId(actor)) return 'combat_space';
  // A basic enhancement is cast on self. Losing the opponent does not cancel
  // the self buff; the next actual basic attack chooses its own valid target.
  if (isEnhancement(cast.def)) return '';
  const target = roster.find((row) => idOf(row) === cast.targetId);
  if (!target || Number(target.hp || 0) <= 0) return 'target_dead';
  if (String(target.zoneId) !== cast.zoneId) return 'target_moved';
  if (!shareCombatSpace(actor, target)) return 'combat_space';
  if (!isTargetableByStatus(target)) return 'untargetable';
  if (Boolean(cast.decision.supportTarget) !== areSameTeam(actor, target)) return 'target_team';
  if (idOf(actor) !== idOf(target) && !canObserveActor(actor, target, roster)) return 'out_of_sight';
  if (!isInSpatialSkillRange(actor, target, cast.def, settings, roster)) return 'out_of_range';
  return '';
}

export function reconcileCharacterCasts(roster, nowSec, settings, actions = {}) {
  for (const actor of roster) {
    const cast = actor._pendingCharacterCast;
    const reason = cast && getCharacterCastInvalidReason(actor, cast, roster, settings);
    if (cast && !reason) {
      const target = roster.find((row) => idOf(row) === cast.targetId);
      if (target && !areSameTeam(actor, target)) rememberSpatialContact(actor, target, nowSec, roster);
    }
    if (reason) {
      actor._pendingCharacterCast = null;
      if (actor._actionReadyAtSec === cast.recoveryUntilSec) actor._actionReadyAtSec = Math.max(nowSec, cast.previousActionReadyAtSec);
      const state = normalizeSkillState(actor); state[cast.def.slot].stage = 'cooldown'; actor.skillState = state;
      castEvent('skill_cancel', actor, cast, nowSec, actions, { reason });
    }
    const armed = actor._armedCharacterSkill;
    if (armed && (actor.hp <= 0 || armed.expiresAtSec <= nowSec || !areCharacterSkillsEnabled(settings))) {
      actor._armedCharacterSkill = null;
      const state = normalizeSkillState(actor); state[armed.def.slot].stage = 'cooldown'; actor.skillState = state;
      castEvent('skill_expired', actor, armed, nowSec, actions, { reason: actor.hp <= 0 ? 'dead' : !areCharacterSkillsEnabled(settings) ? 'disabled' : 'expired' });
    }
  }
}

export function finishCharacterCast(actor, nowSec, actions = {}) {
  const cast = actor?._pendingCharacterCast;
  if (!cast || cast.releaseAtSec > nowSec) return null;
  actor._pendingCharacterCast = null;
  const state = normalizeSkillState(actor);
  state[cast.def.slot].stage = isEnhancement(cast.def) ? 'armed' : 'cooldown';
  actor.skillState = state;
  if (isEnhancement(cast.def)) {
    actor._armedCharacterSkill = { ...cast, expiresAtSec: roundTime(nowSec + Math.max(1, cast.def.durationSec || 5)) };
    castEvent('skill_armed', actor, cast, nowSec, actions);
    return null;
  }
  return cast;
}

export function consumeArmedCharacterSkill(actor, target, baseDamage, opts = {}) {
  const cast = actor?._armedCharacterSkill;
  if (!cast || cast.expiresAtSec <= opts.nowSec || !areCharacterSkillsEnabled(opts.settings)) return null;
  actor._armedCharacterSkill = null;
  const state = normalizeSkillState(actor); const saved = state[cast.def.slot];
  const recast = cast.stage === 1 && cast.def.recastWindowSec > 0 && hasSecondStagePayload(cast.def);
  saved.stage = recast ? 'recast' : 'cooldown'; saved.recastUntil = recast ? roundTime(opts.nowSec + cast.def.recastWindowSec) : 0;
  actor.skillState = state;
  // A blind/evaded basic spends the armed attack without leaking skill damage.
  if (baseDamage <= 0) return null;
  return applyPreparedCharacterSkill(actor, target, { ...cast, decision: { ...cast.decision, supportTarget: false } }, opts);
}
