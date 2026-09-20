import { findSpecialResourceItem, getSpecialDropRules } from './specialResourceRuntime.js';

const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value || '');
const resourceLabels = { meteor: '운석', life_tree: '생명의 나무', mithril: '미스릴', force_core: '포스 코어', vf_blood_sample: 'VF 혈액 샘플', vf: 'VF 혈액 샘플' };
const bossLabels = { alpha: '알파', omega: '오메가', weakline: '위클라인' };
const sourceId = (row) => text(row?.id || row?.crateId);
const bossSourceId = (kind, boss) => `${kind}:${text(boss?.spawnedDay)}:${text(boss?.spawnedPhase)}`;

// Capture the concrete source AFTER a destination has been selected. A list of
// candidate regions (or a generic "core") is not a particular resource target.
// No random draw, new destination choice, reward, or input mutation occurs here.
export function captureMovementObjective(plan, targetZoneId, { spawnState, ruleset, publicItems = [] } = {}) {
  const type = text(plan?.objectiveType);
  const subkind = text(plan?.objectiveSubkind);
  const zoneId = text(targetZoneId);
  if (!type || !zoneId || !spawnState) return null;
  let sources = [];
  let resourceKinds = [];
  if (type === 'natural_core') {
    sources = list(spawnState.coreNodes).filter((row) => !row.picked && text(row.zoneId) === zoneId
      && (!['meteor', 'life_tree'].includes(subkind) || row.kind === subkind));
    resourceKinds = [...new Set(sources.map((row) => text(row.kind)))];
  } else if (type === 'boss') {
    const boss = spawnState.bosses?.[subkind];
    if (boss?.alive && text(boss.zoneId) === zoneId) sources = [{ id: bossSourceId(subkind, boss) }];
    resourceKinds = getSpecialDropRules(subkind, ruleset)
      .filter((row) => Number(row.chance) > 0 && findSpecialResourceItem(publicItems, row.key)?._id)
      .map((row) => text(row.key));
  } else if (type === 'legendary_crate' || type === 'transcend_crate') {
    sources = list(type === 'legendary_crate' ? spawnState.legendaryCrates : spawnState.transcendCrates)
      .filter((row) => !row.opened && text(row.zoneId) === zoneId);
  } else if (type === 'dimension_rift') {
    sources = list(spawnState.dimensionRifts).filter((row) => !row.resolved && text(row.zoneId) === zoneId);
  }
  if (!sources.length) return null;
  return { type, subkind, targetZoneId: zoneId, sourceIds: sources.map(sourceId).filter(Boolean),
    resourceKinds: [...new Set(resourceKinds)].sort(),
  };
}

// Read the SAME frame's world state, never the live engine behind a delayed UI.
// Once a particular source is gone, another spawn in that region is not silently
// substituted for the old decision. A new planning cycle must select it.
export function getAvailableMovementObjective(objective, { spawnState, forbiddenIds = [], nowSec = 0, teamId = '', actor } = {}) {
  if (!objective?.targetZoneId || !spawnState || !list(objective.sourceIds).length) return null;
  const forbidden = forbiddenIds instanceof Set ? forbiddenIds : new Set(list(forbiddenIds));
  if (forbidden.has(objective.targetZoneId)) return null;
  const matches = (row) => text(row?.zoneId) === objective.targetZoneId
    && objective.sourceIds.includes(sourceId(row));
  let sources = [];
  if (objective.type === 'natural_core') sources = list(spawnState.coreNodes).filter((row) => matches(row) && !row.picked
    && (!list(objective.resourceKinds).length || objective.resourceKinds.includes(text(row.kind))));
  if (objective.type === 'boss') {
    const row = spawnState.bosses?.[objective.subkind];
    return row?.alive && text(row.zoneId) === objective.targetZoneId
      && objective.sourceIds.includes(bossSourceId(objective.subkind, row)) ? objective : null;
  }
  if (objective.type === 'legendary_crate' || objective.type === 'transcend_crate') {
    sources = list(objective.type === 'legendary_crate' ? spawnState.legendaryCrates : spawnState.transcendCrates)
      .filter((row) => matches(row) && !row.opened);
  }
  if (objective.type === 'dimension_rift') sources = list(spawnState.dimensionRifts).filter((row) => matches(row) && !row.resolved
    && text(actor?._lastDimensionRiftExit?.riftId) !== sourceId(row)
    && (row.entryClosesAtSec == null || Number(nowSec) < Number(row.entryClosesAtSec))
    && (list(row.entrantTeamIds).includes(teamId) || list(row.entrantTeamIds).length < Number(row.maxTeams || 2)));
  if (!sources.length) return null;
  return { ...objective, sourceIds: sources.map(sourceId), resourceKinds: objective.type === 'natural_core'
    ? [...new Set(sources.map((row) => text(row.kind)))].sort() : list(objective.resourceKinds) };
}

export function isMovementObjectiveAvailable(objective, context) {
  return !!getAvailableMovementObjective(objective, context);
}

export function describeMovementObjective(objective) {
  if (!objective) return '';
  const resources = list(objective.resourceKinds).map((key) => resourceLabels[key]).filter(Boolean);
  if (objective.type === 'natural_core') return `${resources.join('·') || '특수 재료'} 확보`;
  if (objective.type === 'boss') return `${bossLabels[objective.subkind] || '보스'} 공략${resources.length ? ` · ${resources.join('·')} 노림` : ''}`;
  if (objective.type === 'legendary_crate') return '전설 상자 확보';
  if (objective.type === 'transcend_crate') return '초월 장비 선택 상자 확보';
  if (objective.type === 'dimension_rift') return '차원의 틈 공략';
  return '';
}

export function movementObjectivesOverlap(left, right) {
  if (!left || !right || left.type !== right.type || left.targetZoneId !== right.targetZoneId) return false;
  return list(left.sourceIds).some((id) => list(right.sourceIds).includes(id));
}

// Stable identity ignores observation time, so repeated decisions do not spam
// the log. The snapshot is owned by the actor, not the team's shared plan.
export function publishMovementObjective(actor, objective, { at, emitRunEvent = () => {}, addLog = () => {}, zoneName = String, teamId = '', shared = false } = {}) {
  const previous = actor._movementObjective || null;
  const signature = (value) => JSON.stringify(value ? { ...value, atSec: undefined } : null);
  const next = objective ? { ...structuredClone(objective), shared, atSec: Number(at?.sec || 0) } : null;
  actor._movementObjective = next;
  if (signature(previous) === signature(next)) return;
  emitRunEvent('movement_goal', { who: text(actor._id || actor.id), teamId,
    objective: next ? structuredClone(next) : null, previousObjective: previous ? structuredClone(previous) : null,
  }, at);
  if (next) addLog(`🎯 [${actor.name}] ${shared ? '팀 공동 목표' : '목표'}: ${describeMovementObjective(next)} · ${zoneName(next.targetZoneId)} (아직 획득 전)`, 'highlight');
}
