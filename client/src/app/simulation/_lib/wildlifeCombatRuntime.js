import { updateEffects, canBasicAttackByStatus, canMoveByStatus, getStoredActiveStatusEffects,
  hasActionBlockStatus, isTargetableByStatus } from '../../../utils/statusLogic.js';
import { getActorDimensionRiftId, getCombatSpaceId, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';
import { getWildlifeSpeciesSpec, normalizeWildlifeSpeciesKey } from './wildlifeRuntime.js';
import { resolveCombatWinnerOutcome } from './phaseCombatDamageRuntime.js';
import { createPhaseCombatTacticalRuntime } from './phaseCombatTacticalRuntime.js';
import { cancelCharacterCast, findCharacterSkillChoice, finishCharacterCast, startCharacterCast } from './characterCastRuntime.js';
import { getBasicAttackIntervalSec, isBasicAttackReady, roundCombatTime } from './combatTimingRuntime.js';
import { getSpatialPosition, getSpatialStats, initializeSpatialPosition, isInBasicAttackRange,
  planSpatialApproach, spatialDistance } from './combatSpatialRuntime.js';
import { areSameTeam } from './teamRuntime.js';
import { getBossAssistAssignments, getBossAssistOwner, getBossHuntSuccessor } from './bossAssistRuntime.js';

const SPECIAL_COMBAT_SPECS = {
  mutant_wildlife: { label: '변이 야생동물', icon: '🧪', maxHp: 330, attackPower: 38, defense: 28,
    attackSpeed: 0.72, moveSpeed: 3.25, attackRange: 1.45, sightRange: 11 },
  alpha: { label: '알파', icon: '🐺', maxHp: 420, attackPower: 44, defense: 34,
    attackSpeed: 0.82, moveSpeed: 3.55, attackRange: 1.55, sightRange: 12 },
  omega: { label: '오메가', icon: '🧿', maxHp: 540, attackPower: 52, defense: 40,
    attackSpeed: 0.76, moveSpeed: 3.15, attackRange: 1.7, sightRange: 12 },
  weakline: { label: '위클라인', icon: '🧬', maxHp: 720, attackPower: 62, defense: 48,
    attackSpeed: 0.68, moveSpeed: 3.0, attackRange: 1.85, sightRange: 13 },
};

const idOf = (actor) => String(actor?._id || actor?.id || '');
const clampPoint = (value) => Math.max(0, Math.min(24, Number(value) || 0));
const finiteDuration = (effects) => (Array.isArray(effects) ? effects : []).reduce((value, effect) =>
  effect?.remainingDuration != null && Number.isFinite(Number(effect.remainingDuration)) && Number(effect.remainingDuration) > 1e-6
    ? Math.min(value, Number(effect.remainingDuration)) : value, Infinity);

function wildlifeSpec(kind, day = 1) {
  const key = normalizeWildlifeSpeciesKey(kind);
  const ordinary = key ? getWildlifeSpeciesSpec(key) : null;
  const base = ordinary ? { label: ordinary.label, icon: ordinary.icon, ...ordinary.combat }
    : SPECIAL_COMBAT_SPECS[String(kind || '')] || SPECIAL_COMBAT_SPECS.mutant_wildlife;
  const dayScale = 1 + Math.max(0, Math.min(0.35, (Number(day || 1) - 1) * 0.07));
  return {
    ...base,
    maxHp: Math.max(1, Math.round(Number(base.maxHp || 100) * dayScale)),
    attackPower: Math.max(1, Math.round(Number(base.attackPower || 10) * dayScale)),
  };
}

function encounterPosition(actor, targetId) {
  if (!getSpatialPosition(actor)) actor._spatial = initializeSpatialPosition(actor);
  const point = getSpatialPosition(actor) || { zoneId: String(actor?.zoneId || ''), x: 12, y: 12 };
  const hash = [...String(targetId || '')].reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 5381);
  const angle = (hash % 360) * Math.PI / 180;
  return {
    zoneId: String(actor?.zoneId || ''),
    x: Math.round(clampPoint(point.x + Math.cos(angle) * 3.5) * 1e6) / 1e6,
    y: Math.round(clampPoint(point.y + Math.sin(angle) * 3.5) * 1e6) / 1e6,
  };
}

export function createTimedWildlifeEncounter(actor, hunt, {
  nowSec = 0,
  phaseIdxNow = 0,
  nextDay = 1,
  actionKey = '',
} = {}) {
  if (!actor || !hunt?.pending || !hunt?.claim) return null;
  const claim = structuredClone(hunt.claim);
  const encounterId = String(claim.engagementId || `hunt:${idOf(actor)}:${phaseIdxNow}:${nowSec}`);
  const spec = wildlifeSpec(hunt.kind, nextDay);
  const targetId = `wildlife:${encounterId}`;
  const target = {
    _id: targetId,
    id: targetId,
    name: `${spec.icon || '🦌'} ${spec.label || '야생동물'}`,
    zoneId: String(actor.zoneId || ''),
    teamId: `wildlife:${encounterId}`,
    matchTeamId: `wildlife:${encounterId}`,
    hp: spec.maxHp,
    maxHp: spec.maxHp,
    stats: {
      maxHp: spec.maxHp,
      attackPower: spec.attackPower,
      defense: Number(spec.defense || 0),
      skillAmp: 0,
      attackSpeed: Number(spec.attackSpeed || 0.7),
      moveSpeed: Number(spec.moveSpeed || 3),
      attackRange: Number(spec.attackRange || 1.3),
      sightRange: Number(spec.sightRange || 10),
    },
    activeEffects: [],
    inventory: [],
    equipped: {},
    _wildlifeKind: String(hunt.kind || 'wildlife'),
    _wildlifeOwnerId: idOf(actor),
    _spatial: encounterPosition(actor, targetId),
    _actionReadyAtSec: roundCombatTime(nowSec),
    _basicAttackReadyAtSec: roundCombatTime(nowSec + 0.75),
    _combatInitiative: 0.5,
  };
  return {
    version: 1,
    id: encounterId,
    actionKey,
    zoneId: String(actor.zoneId || ''),
    phaseIdx: Number(phaseIdxNow || 0),
    startedAtSec: roundCombatTime(nowSec),
    startedHp: Math.max(0, Number(actor.hp || 0)),
    kind: String(hunt.kind || 'wildlife'),
    isBossReward: ['alpha', 'omega', 'weakline'].includes(String(hunt.kind || '')),
    isMutantReward: String(hunt.kind || '') === 'mutant_wildlife',
    claim,
    reward: { ...structuredClone(hunt), pending: false, defeated: true },
    target,
    damageDealt: 0,
    damageTaken: 0,
    lastActionAtSec: roundCombatTime(nowSec),
  };
}

function claimMatches(row, claim) {
  if (!row || !claim) return false;
  if (claim.engagementId && String(row.engagementId || '') !== String(claim.engagementId)) return false;
  return !claim.claimantId || String(row.engagedBy || '') === String(claim.claimantId);
}

export function settleWildlifeClaim(nextSpawn, encounter, {
  defeated = false,
  actor = null,
  at = null,
} = {}) {
  const claim = encounter?.claim;
  if (!nextSpawn || !claim) return false;
  if (claim.source === 'boss') {
    const row = nextSpawn?.bosses?.[String(claim.key || '')];
    if (!claimMatches(row, claim)) return false;
    delete row.engagedBy;
    delete row.engagementId;
    if (defeated) {
      row.alive = false;
      row.defeatedBy = String(actor?.name || '');
      row.defeatedAt = { day: Number(at?.day || 0), phase: String(at?.phase || ''), sec: Number(at?.sec || 0) };
    }
    return true;
  }
  if (claim.source === 'mutant') {
    const row = nextSpawn?.mutantWildlife;
    if (!claimMatches(row, claim)) return false;
    delete row.engagedBy;
    delete row.engagementId;
    if (defeated) {
      row.alive = false;
      row.defeatedBy = String(actor?.name || '');
      row.defeatedAt = { day: Number(at?.day || 0), phase: String(at?.phase || ''), sec: Number(at?.sec || 0) };
    }
    return true;
  }
  if (claim.source === 'wildlife') {
    if (!defeated) {
      const zid = String(claim.zoneId || encounter.zoneId || '');
      if (!nextSpawn.wildlife || typeof nextSpawn.wildlife !== 'object') nextSpawn.wildlife = {};
      if (claim.hadSpeciesList) {
        if (!nextSpawn.wildlifeSpecies || typeof nextSpawn.wildlifeSpecies !== 'object') nextSpawn.wildlifeSpecies = {};
        const list = Array.isArray(nextSpawn.wildlifeSpecies[zid]) ? nextSpawn.wildlifeSpecies[zid] : [];
        list.unshift(String(claim.speciesKey || encounter.kind || 'chicken'));
        nextSpawn.wildlifeSpecies[zid] = list;
        nextSpawn.wildlife[zid] = list.length;
      } else nextSpawn.wildlife[zid] = Math.max(0, Number(nextSpawn.wildlife[zid] || 0)) + 1;
    }
    return true;
  }
  return false;
}

export function releaseTimedWildlifeEncounter(actor, nextSpawn, reason, actions = {}, nowSec = 0) {
  const encounter = actor?._wildlifeHunt;
  if (!encounter) return null;
  settleWildlifeClaim(nextSpawn, encounter, { defeated: false, actor, at: actions.atNow?.() });
  actor._wildlifeHunt = null;
  if (String(actor?._spatialMotion?.targetId || '') === String(encounter?.target?._id || '')) actor._spatialMotion = null;
  actor._actionReadyAtSec = Math.max(Number(actor._actionReadyAtSec || 0), roundCombatTime(nowSec + 2));
  actions.addLog?.(`🏃 [${actor.name}] ${encounter.target?.name || '야생동물'} 사냥 중단: ${reason}`, 'system');
  actions.emitRunEvent?.('hunt_end', { who: idOf(actor), encounterId: encounter.id, kind: encounter.kind,
    zoneId: encounter.zoneId, wildlifeName: encounter.target?.name, outcome: 'retreat', reason, targetHp: Number(encounter.target?.hp || 0),
    damageDealt: Number(encounter.damageDealt || 0), damageTaken: Number(encounter.damageTaken || 0) }, actions.atNow?.());
  return encounter;
}

export function completeTimedWildlifeEncounter(actor, nextSpawn, actions = {}) {
  const encounter = actor?._wildlifeHunt;
  if (!encounter) return null;
  const settled = settleWildlifeClaim(nextSpawn, encounter, { defeated: true, actor, at: actions.atNow?.() });
  if (!settled) {
    actor._wildlifeHunt = null;
    actions.emitRunEvent?.('hunt_end', { who: idOf(actor), encounterId: encounter.id, kind: encounter.kind,
      zoneId: encounter.zoneId, wildlifeName: encounter.target?.name, outcome: 'invalid_claim',
      reason: '공유 대상 점유 정보 불일치', damageDealt: encounter.damageDealt, damageTaken: encounter.damageTaken }, actions.atNow?.());
    return null;
  }
  actor._wildlifeHunt = null;
  if (String(actor?._spatialMotion?.targetId || '') === String(encounter?.target?._id || '')) actor._spatialMotion = null;
  return encounter;
}

export function getActiveWildlifeTargets(roster) {
  const targets = new Map();
  for (const actor of Array.isArray(roster) ? roster : []) {
    const encounter = actor?._wildlifeHunt;
    if (!encounter?.id || !encounter?.target?._id) continue;
    targets.set(String(encounter.target._id), encounter.target);
  }
  return [...targets.values()];
}

export function getWildlifeCombatRoster(roster) {
  return [...(Array.isArray(roster) ? roster : []), ...getActiveWildlifeTargets(roster)];
}

export function getWildlifeOwnerDamageDealt(encounter) {
  const assisted = Object.values(encounter?.assistDamageDealt || {}).reduce((sum, damage) => sum + Number(damage || 0), 0);
  return Math.max(0, Number(encounter?.damageDealt || 0) - assisted);
}

export function getWildlifeOwnerDamageTaken(encounter) {
  const assisted = Object.values(encounter?.assistDamageTaken || {}).reduce((sum, damage) => sum + Number(damage || 0), 0);
  return Math.max(0, Number(encounter?.damageTaken || 0) - assisted);
}

export function transferTimedBossEncounter(owner, nextSpawn, roster, {
  nowSec = 0, phaseIdxNow = 0, reason = '', actions = {}, ...options
} = {}) {
  const encounter = owner?._wildlifeHunt;
  const claim = encounter?.claim;
  const row = claim?.source === 'boss' ? nextSpawn?.bosses?.[String(claim.key || '')] : null;
  if (!row?.alive || !claimMatches(row, claim) || String(claim.claimantId || '') !== idOf(owner)
    || String(row.zoneId || '') !== String(encounter.zoneId || '')) return null;
  const successor = getBossHuntSuccessor(owner, roster, { ...options, nowSec });
  if (!successor) return null;

  // Move one live encounter, not a freshly rolled boss. Rebase individual
  // contribution maps before changing ownership; totals and target clocks stay.
  const previousId = idOf(owner), nextId = idOf(successor);
  const dealt = getWildlifeOwnerDamageDealt(encounter), taken = getWildlifeOwnerDamageTaken(encounter);
  encounter.assistDamageDealt ||= {};
  encounter.assistDamageTaken ||= {};
  encounter.assistDamageDealt[previousId] = dealt;
  encounter.assistDamageTaken[previousId] = taken;
  delete encounter.assistDamageDealt[nextId];
  delete encounter.assistDamageTaken[nextId];
  encounter.startedHpByActor ||= {};
  encounter.startedHpByActor[previousId] = encounter.startedHp;
  encounter.startedHp = encounter.startedHpByActor[nextId] ?? Number(successor.hp || 0);
  owner._huntActionKey = encounter.actionKey;
  encounter.actionKey = `phase:${phaseIdxNow}:cycle:${successor._actionCycleKey ?? 'legacy'}`;
  claim.claimantId = nextId;
  if (encounter.reward?.claim) encounter.reward.claim.claimantId = nextId;
  row.engagedBy = nextId;
  encounter.target._wildlifeOwnerId = nextId;
  // Old pursuit must not drag the boss toward a dead or departed owner.
  encounter.target._spatialMotion = null;
  encounter.target._spatialLastSeen = null;
  owner._wildlifeHunt = null;
  for (const key of ['_spatialMotion', '_spatialLastSeen']) {
    if (String(owner[key]?.targetId || '') === idOf(encounter.target)) owner[key] = null;
  }
  // Install the successor before cancellation/log callbacks can observe state.
  successor._wildlifeHunt = encounter;
  successor.aiCurrentAction = 'hunt_combat';
  if (owner._pendingCharacterCast) cancelCharacterCast(owner, nowSec, 'hunt_end', actions);
  owner._actionReadyAtSec = Math.max(Number(owner._actionReadyAtSec || 0), roundCombatTime(nowSec + 2));
  actions.addLog?.(`🤝 [${successor.name}] ${encounter.target.name} 사냥 이어받기 · [${owner.name}] ${reason} · 남은 HP ${encounter.target.hp}/${encounter.target.maxHp}`, 'highlight');
  actions.emitRunEvent?.('hunt_transfer', { who: nextId, previousOwnerId: previousId, previousOwnerName: owner.name,
    encounterId: encounter.id, kind: encounter.kind, zoneId: encounter.zoneId, reason,
    wildlifeId: idOf(encounter.target), wildlifeName: encounter.target.name,
    wildlifeHp: Number(encounter.target.hp), wildlifeMaxHp: Number(encounter.target.maxHp) }, actions.atNow?.());
  return successor;
}

function recordWildlifeDamage(encounter, sourceId, damage) {
  encounter.damageDealt += damage;
  if (Object.hasOwn(encounter.assistDamageDealt || {}, sourceId)) encounter.assistDamageDealt[sourceId] += damage;
}

function joinBossAttack(actor, owner, encounter, actions) {
  if (idOf(actor) === idOf(owner)) return;
  encounter.assistDamageDealt ||= {};
  if (Object.hasOwn(encounter.assistDamageDealt, idOf(actor))) return;
  encounter.assistDamageDealt[idOf(actor)] = 0;
  actions.addLog?.(`🤝 [${actor.name}]이(가) [${owner.name}]과 ${encounter.target.name} 공동 사냥에 참여합니다.`, 'combat-detail');
  actions.emitRunEvent?.('hunt_assist', { who: idOf(actor), ownerId: idOf(owner), encounterId: encounter.id,
    kind: encounter.kind, zoneId: encounter.zoneId, wildlifeId: idOf(encounter.target), wildlifeName: encounter.target.name }, actions.atNow?.());
}

export function advanceTimedWildlifeEffects(roster, { elapsedSec = 0, startSec = 0 } = {}) {
  if (!(Number(elapsedSec) > 0)) return 0;
  let changed = 0;
  for (const actor of Array.isArray(roster) ? roster : []) {
    const encounter = actor?._wildlifeHunt;
    const target = encounter?.target;
    if (!target || Number(target.hp || 0) <= 0) continue;
    const before = Number(target.hp || 0);
    const result = updateEffects(target, { returnMeta: true, elapsedSec, startSec });
    if (result?.character) encounter.target = result.character;
    const after = Number(encounter.target?.hp || 0);
    if (after !== before || (result?.expired || []).length || (result?.ticks || []).length) changed += 1;
    if (after < before) {
      const loss = before - after;
      const ticks = (result?.ticks || []).filter((tick) => tick.type === 'damage' && Number(tick.amount) > 0);
      const total = ticks.reduce((sum, tick) => sum + Number(tick.amount), 0);
      // Attribute only actual HP lost, not overkill or healing-offset raw DoT.
      if (total > 0) for (const tick of ticks) recordWildlifeDamage(encounter, String(tick.sourceActorId || ''), loss * Number(tick.amount) / total);
      else recordWildlifeDamage(encounter, idOf(actor), loss);
    }
  }
  return changed;
}

export function collectTimedWildlifeOutcomes(roster) {
  const outcomes = [];
  const actors = Array.isArray(roster) ? roster : [];
  for (const actor of actors) {
    const encounter = actor?._wildlifeHunt;
    if (!encounter) continue;
    if (Number(actor.hp || 0) <= 0) outcomes.push({ type: 'hunter_defeated', actor, encounter });
    else if (Number(encounter.target?.hp || 0) <= 0) outcomes.push({ type: 'target_defeated', actor, encounter });
    else if (getActorDimensionRiftId(actor) || getCombatSpaceId(actor) !== WORLD_COMBAT_SPACE
      || String(actor.zoneId || '') !== String(encounter.zoneId || '')) outcomes.push({ type: 'cancel', reason: '전장 또는 지역 이탈', actor, encounter });
    else if (actor._combatIntent && actors.some((other) => other && idOf(other) !== idOf(actor)
      && Number(other.hp || 0) > 0 && !areSameTeam(actor, other)
      && String(other.zoneId || '') === String(actor.zoneId || '')
      && getCombatSpaceId(other) === getCombatSpaceId(actor))) {
      outcomes.push({ type: 'cancel', reason: '실험체 교전 개입', actor, encounter });
    }
  }
  return outcomes;
}

function chooseCandidate(current, candidate) {
  if (!candidate || !Number.isFinite(candidate.atSec)) return current;
  const priority = { hunt_flee: -2, hunt_status_boundary: -1, hunt_skill_release: 0, hunt_skill_start: 1,
    hunt_basic: 2, wildlife_basic: 2, hunt_approach: 3, wildlife_approach: 3 };
  if (!current || candidate.atSec < current.atSec || candidate.atSec === current.atSec && (
    priority[candidate.actionType] < priority[current.actionType]
    || priority[candidate.actionType] === priority[current.actionType]
      && String(candidate.actorId || '').localeCompare(String(current.actorId || '')) < 0)) return candidate;
  return current;
}

export function findNextWildlifeAction(survivorMap, nowSec, newDeadIds = [], settings = {}, ruleset = {}, options = {}) {
  const roster = [...survivorMap.values()].filter((row) => !newDeadIds.includes(idOf(row)) && Number(row?.hp || 0) > 0);
  const visionRoster = getWildlifeCombatRoster(roster);
  const assistOwners = options.assistOwners || getBossAssistAssignments(roster, { ...options, nowSec, ruleset });
  let next = null;
  for (const owner of roster) {
    const encounter = owner?._wildlifeHunt;
    const target = encounter?.target;
    if (!encounter?.id || !target || Number(target.hp || 0) <= 0 || owner._combatIntent) continue;
    const base = { encounterId: encounter.id, ownerId: idOf(owner), combatSpaceId: getCombatSpaceId(owner) };
    const targetStatus = finiteDuration(getStoredActiveStatusEffects(target));
    if (Number.isFinite(targetStatus)) next = chooseCandidate(next, { ...base, actorId: idOf(target),
      atSec: roundCombatTime(nowSec + targetStatus), actionType: 'hunt_status_boundary' });

    const hpRatio = Number(owner.hp || 0) / Math.max(1, Number(owner.maxHp || 1));
    const retreatRatio = Math.max(0.05, Math.min(0.8, Number(ruleset?.ai?.huntRetreatHpRatio ?? 0.22)));
    const retreatHp = Math.max(0, Number(ruleset?.ai?.escapeHpBelow ?? 0));
    if (canMoveByStatus(owner) && (hpRatio <= retreatRatio || retreatHp > 0 && Number(owner.hp || 0) <= retreatHp)) {
      next = chooseCandidate(next, { ...base, actorId: idOf(owner), atSec: roundCombatTime(nowSec), actionType: 'hunt_flee' });
      continue;
    }

    const attackers = [owner, ...roster.filter((row) => assistOwners.get(idOf(row)) === idOf(owner))];
    for (const actor of attackers) {
      const actorStatus = finiteDuration(getStoredActiveStatusEffects(actor));
      if (Number.isFinite(actorStatus)) next = chooseCandidate(next, { ...base, actorId: idOf(actor),
        atSec: roundCombatTime(nowSec + actorStatus), actionType: 'hunt_status_boundary' });
      if (actor._pendingCharacterCast) {
        next = chooseCandidate(next, { ...base, actorId: idOf(actor), targetId: actor._pendingCharacterCast.targetId,
          atSec: roundCombatTime(Math.max(nowSec, actor._pendingCharacterCast.releaseAtSec)), actionType: 'hunt_skill_release' });
      } else if (!hasActionBlockStatus(actor)) {
        const choice = findCharacterSkillChoice(actor, [target], visionRoster, nowSec, settings);
        if (choice) next = chooseCandidate(next, { ...base, actorId: idOf(actor), targetId: choice.targetId,
          atSec: choice.atSec, choice, actionType: 'hunt_skill_start' });
        if (canBasicAttackByStatus(actor, target) && isInBasicAttackRange(actor, target, visionRoster)) {
          actor._spatialMotion = null;
          next = chooseCandidate(next, { ...base, actorId: idOf(actor), targetId: idOf(target), actionType: 'hunt_basic',
            atSec: roundCombatTime(Math.max(nowSec, Number(actor._actionReadyAtSec || 0), Number(actor._basicAttackReadyAtSec || 0))) });
        } else {
          const approach = planSpatialApproach(actor, target, nowSec, visionRoster);
          if (approach) next = chooseCandidate(next, { ...base, ...approach, actionType: 'hunt_approach' });
        }
      }
    }

    if (!hasActionBlockStatus(target) && canBasicAttackByStatus(target, owner) && isTargetableByStatus(owner)) {
      if (isInBasicAttackRange(target, owner, visionRoster)) {
        next = chooseCandidate(next, { ...base, actorId: idOf(target), targetId: idOf(owner), actionType: 'wildlife_basic',
          atSec: roundCombatTime(Math.max(nowSec, Number(target._actionReadyAtSec || 0), Number(target._basicAttackReadyAtSec || 0))) });
      } else {
        const approach = planSpatialApproach(target, owner, nowSec, visionRoster);
        if (approach) next = chooseCandidate(next, { ...base, ...approach, actionType: 'wildlife_approach' });
      }
    }
  }
  return next;
}

export function resolveTimedWildlifeAction(candidate, {
  survivorMap,
  nowSec = 0,
  battleSettings = {},
  ruleset = {},
  isSoloMatch = false,
  forbiddenIds = new Set(),
  phaseIdxNow = 0,
  actions = {},
} = {}) {
  const owner = survivorMap?.get(String(candidate?.ownerId || ''));
  const encounter = owner?._wildlifeHunt;
  if (!owner || !encounter || String(encounter.id) !== String(candidate?.encounterId)) return { performed: false };
  const target = encounter.target;
  if (!target || Number(owner.hp || 0) <= 0 || Number(target.hp || 0) <= 0 || owner._combatIntent) return { performed: false };
  const roster = [...survivorMap.values()];
  const actor = candidate.actorId === idOf(target) ? owner : survivorMap.get(String(candidate.actorId || ''));
  if (!actor || actor !== owner && idOf(getBossAssistOwner(actor, roster,
    { nowSec, ruleset, isSoloMatch, forbiddenIds })) !== idOf(owner)) return { performed: false };
  if (candidate.actionType === 'hunt_flee') return { performed: false, fled: true };
  if (['hunt_approach', 'wildlife_approach', 'hunt_status_boundary'].includes(candidate.actionType)) return { performed: false };

  const visionRoster = getWildlifeCombatRoster(roster);
  if (candidate.actionType === 'hunt_skill_start') {
    const choice = findCharacterSkillChoice(actor, [target], visionRoster, nowSec, battleSettings);
    const performed = startCharacterCast(actor, choice, nowSec, battleSettings, actions);
    if (performed) {
      joinBossAttack(actor, owner, encounter, actions);
      if (actor !== owner) actor._pendingCharacterCast.bossAssistEncounterId = encounter.id;
    } else actor._actionReadyAtSec = Math.max(Number(actor._actionReadyAtSec || 0), roundCombatTime(nowSec + 0.01));
    return { performed, castStarted: true };
  }

  let striker = actor;
  let victim = target;
  let preparedSkill = null;
  let targetKind = 'wildlife';
  if (candidate.actionType === 'hunt_skill_release') {
    preparedSkill = finishCharacterCast(actor, nowSec, actions);
    victim = visionRoster.find((row) => idOf(row) === String(preparedSkill?.targetId || candidate.targetId || '')) || target;
    targetKind = victim === target ? 'wildlife' : 'experiment';
    if (!preparedSkill) {
      actor._actionReadyAtSec = Math.max(Number(actor._actionReadyAtSec || 0), roundCombatTime(nowSec + 0.01));
      return { performed: false };
    }
  } else if (candidate.actionType === 'wildlife_basic') {
    striker = target;
    victim = owner;
    targetKind = 'experiment';
  }

  const beforeOwnerHp = Number(owner.hp || 0);
  const beforeTargetHp = Number(target.hp || 0);
  const tactical = createPhaseCombatTacticalRuntime({
    state: { absNow: nowSec, ruleset },
    actions: {
      addLog: actions.addLog,
      atNow: actions.atNow,
      emitEffectRunEvents: actions.emitEffectRunEvents,
      emitRunEvent: actions.emitRunEvent,
    },
  });
  const emitRunEvent = (kind, payload, at) => actions.emitRunEvent?.(kind === 'battle' ? 'wildlife_battle' : kind,
    { ...payload, encounterId: encounter.id, wildlifeKind: encounter.kind }, at);
  const result = resolveCombatWinnerOutcome({
    state: {
      actor: striker,
      target: victim,
      battleSettings,
      currentActionSec: () => nowSec,
      phaseIdxNow,
      pvpCfg: { criticalFleeChance: 0, criticalFleeHpBelow: -1 },
      supportRoster: visionRoster,
      strikeOnly: true,
      preparedSkill,
      targetKind,
    },
    actions: {
      addLog: actions.addLog,
      applyErTraitAfterBattle: actions.applyErTraitAfterBattle,
      applyErWeaponSkillAfterCombat: actions.applyErWeaponSkillAfterCombat,
      atNow: actions.atNow,
      emitRunEvent,
      grantPvpDamageMastery: () => {},
    },
    tactical,
    combatElimination: { applyCombatElimination: () => null },
    flee: { resolveFleeSequence: () => null },
  });
  const ownerLoss = Math.max(0, beforeOwnerHp - Number(owner.hp || 0));
  const targetLoss = Math.max(0, beforeTargetHp - Number(target.hp || 0));
  encounter.damageTaken += ownerLoss;
  if (result?.performed && striker !== target) joinBossAttack(actor, owner, encounter, actions);
  recordWildlifeDamage(encounter, idOf(striker), targetLoss);
  encounter.lastActionAtSec = roundCombatTime(nowSec);
  if (!result?.performed) {
    if (striker === target) target._basicAttackReadyAtSec = Math.max(Number(target._basicAttackReadyAtSec || 0), roundCombatTime(nowSec + 0.01));
    else actor._actionReadyAtSec = Math.max(Number(actor._actionReadyAtSec || 0), roundCombatTime(nowSec + 0.01));
  }
  if (result?.performed) actions.emitRunEvent?.('hunt_exchange', {
    who: idOf(owner), encounterId: encounter.id, kind: encounter.kind, strikerId: idOf(striker), targetId: idOf(victim),
    wildlifeId: idOf(target), wildlifeName: target.name,
    damageDealt: targetLoss, damageTaken: ownerLoss, hunterHp: Number(owner.hp || 0), wildlifeHp: Number(target.hp || 0),
    attackerHp: Number(striker.hp || 0), ownerId: idOf(owner),
    distance: spatialDistance(actor, target), nextHunterAttackAtSec: Number(actor._basicAttackReadyAtSec || 0),
    nextWildlifeAttackAtSec: Number(target._basicAttackReadyAtSec || 0),
  }, actions.atNow?.());
  return { performed: Boolean(result?.performed), owner, target, targetLoss, ownerLoss, preparedSkill };
}

export function getTimedWildlifeCombatSummary(actor) {
  const encounter = actor?._wildlifeHunt;
  if (!encounter) return null;
  return {
    encounterId: encounter.id,
    kind: encounter.kind,
    zoneId: encounter.zoneId,
    hunterHp: Number(actor.hp || 0),
    wildlifeHp: Number(encounter.target?.hp || 0),
    wildlifeMaxHp: Number(encounter.target?.maxHp || 0),
    distance: spatialDistance(actor, encounter.target),
    hunterAttackIntervalSec: getBasicAttackIntervalSec(actor),
    wildlifeAttackIntervalSec: getBasicAttackIntervalSec(encounter.target),
    hunterReady: isBasicAttackReady(actor, encounter.lastActionAtSec),
    damageDealt: Number(encounter.damageDealt || 0),
    damageTaken: Number(encounter.damageTaken || 0),
    sameTeam: areSameTeam(actor, encounter.target),
    hunterRange: getSpatialStats(actor).attackRange,
  };
}
