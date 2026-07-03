import { roughPower } from './combatRuntime';
import { classifySpecialByName } from './craftRuntime';

const WILDLIFE_HUNT_VALUE = {
  chicken: 1.0,
  bat: 1.1,
  boar: 1.8,
  dog: 1.7,
  wolf: 2.4,
  bear: 3.0,
};

const WILDLIFE_RISK_POWER = {
  chicken: 18,
  bat: 24,
  boar: 34,
  dog: 34,
  wolf: 46,
  bear: 58,
};

function normalizeWildlifeKey(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === '닭' || raw === 'chicken') return 'chicken';
  if (raw === '박쥐' || raw === 'bat') return 'bat';
  if (raw === '멧돼지' || raw === 'boar') return 'boar';
  if (raw === '들개' || raw === 'dog') return 'dog';
  if (raw === '늑대' || raw === 'wolf') return 'wolf';
  if (raw === '곰' || raw === 'bear') return 'bear';
  return raw;
}

export function scoreWildlifeZoneForActor(spawnState, zoneId, actor) {
  const zid = String(zoneId || '');
  if (!zid) return 0;

  const fallbackCount = Math.max(0, Number(spawnState?.wildlife?.[zid] ?? 0));
  const speciesList = Array.isArray(spawnState?.wildlifeSpecies?.[zid])
    ? spawnState.wildlifeSpecies[zid]
    : [];
  if (!fallbackCount && !speciesList.length) return 0;

  const power = Math.max(1, roughPower(actor));
  const list = speciesList.length
    ? speciesList.map(normalizeWildlifeKey).filter(Boolean)
    : Array.from({ length: fallbackCount }, () => 'boar');

  const score = list.reduce((sum, speciesKey) => {
    const value = Math.max(0.5, Number(WILDLIFE_HUNT_VALUE[speciesKey] || 1.4));
    const riskPower = Math.max(1, Number(WILDLIFE_RISK_POWER[speciesKey] || 36));
    const riskMul = power >= riskPower
      ? 1 + Math.min(0.22, (power - riskPower) / 260)
      : Math.max(0.38, power / riskPower);
    return sum + value * riskMul;
  }, 0);

  return Math.max(score, fallbackCount * 0.6);
}

function hpRatio(actor) {
  return Math.max(0, Math.min(1, Number(actor?.hp || 0) / Math.max(1, Number(actor?.maxHp || 100))));
}

export function objectiveContestPressure(actor, objectiveType = '', subkind = '') {
  const type = String(objectiveType || '');
  const sub = String(subkind || '').toLowerCase();
  const power = Math.max(1, roughPower(actor));
  const hp = hpRatio(actor);
  const base = type === 'boss'
    ? (sub.includes('weak') || sub.includes('wick') ? 0.28 : sub.includes('omega') ? 0.24 : 0.21)
    : type === 'legendary_crate'
      ? 0.18
      : type === 'natural_core'
        ? 0.16
        : 0.10;
  const gate = type === 'boss'
    ? (sub.includes('weak') || sub.includes('wick') ? 82 : sub.includes('omega') ? 68 : 56)
    : type === 'legendary_crate'
      ? 46
      : type === 'natural_core'
        ? 36
        : 34;
  const powerMul = power >= gate ? Math.min(1.18, 1 + (power - gate) / 260) : Math.max(0.28, power / Math.max(1, gate));
  const hpMul = hp <= 0.28 ? 0.22 : hp <= 0.42 ? 0.48 : hp <= 0.60 ? 0.78 : 1;
  return Math.max(0, Math.min(0.32, base * powerMul * hpMul));
}

export function markObjectiveTarget(result, actor, objectiveType, subkind = '') {
  if (!result || !objectiveType) return result;
  result.objectiveType = String(objectiveType || '');
  result.objectiveSubkind = String(subkind || '');
  result.contestPressure = objectiveContestPressure(actor, objectiveType, subkind);
  return result;
}

export function actorHasSpecialKind(actor, kind, itemMetaById, itemNameById) {
  const target = String(kind || '');
  if (!target) return false;
  return (Array.isArray(actor?.inventory) ? actor.inventory : []).some((entry) => {
    const id = String(entry?.itemId || entry?.id || entry?._id || '');
    const qty = Math.max(0, Number(entry?.qty ?? 1));
    if (qty <= 0) return false;
    const name = String(entry?.name || entry?.text || itemNameById?.[id] || itemMetaById?.[id]?.name || '');
    return classifySpecialByName(name) === target;
  });
}
