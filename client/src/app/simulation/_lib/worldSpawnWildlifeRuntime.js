import { randInt } from './simulationCommon';
import {
  getRegionHotspotWeight,
  getRegionWildlifeSpeciesList,
} from './lumiaRegionData';

const DEFAULT_SPECIES_BY_TIME = {
  day: [
    { key: 'chicken', weight: 4 },
    { key: 'bat', weight: 2 },
    { key: 'boar', weight: 2 },
    { key: 'dog', weight: 2 },
    { key: 'wolf', weight: 1 },
  ],
  night: [
    { key: 'bat', weight: 2 },
    { key: 'boar', weight: 2 },
    { key: 'dog', weight: 1 },
    { key: 'wolf', weight: 2 },
    { key: 'bear', weight: 2 },
  ],
};

function buildSpeciesPool(wildRule, timeOfDay) {
  const speciesPoolRaw = Array.isArray(wildRule?.speciesByTimeOfDay?.[timeOfDay])
    ? wildRule.speciesByTimeOfDay[timeOfDay]
    : DEFAULT_SPECIES_BY_TIME[timeOfDay] || DEFAULT_SPECIES_BY_TIME.day;
  return speciesPoolRaw
    .map((row) => ({
      key: String(row?.key || row?.species || row?.name || '').trim().toLowerCase(),
      weight: Math.max(0, Number(row?.weight ?? 1)),
    }))
    .filter((row) => row.key && row.weight > 0);
}

function pickWeightedSpeciesKey(speciesPool) {
  const pool = speciesPool.length ? speciesPool : DEFAULT_SPECIES_BY_TIME.day;
  const total = pool.reduce((sum, row) => sum + Math.max(0, Number(row?.weight || 0)), 0);
  if (total <= 0) return String(pool[0]?.key || 'chicken');
  let r = Math.random() * total;
  for (const row of pool) {
    r -= Math.max(0, Number(row?.weight || 0));
    if (r <= 0) return String(row.key || 'chicken');
  }
  return String(pool[pool.length - 1]?.key || 'chicken');
}

function ensureSpeciesList(state, zoneId) {
  if (!state.wildlifeSpecies || typeof state.wildlifeSpecies !== 'object') state.wildlifeSpecies = {};
  const key = String(zoneId || '');
  const list = Array.isArray(state.wildlifeSpecies[key])
    ? state.wildlifeSpecies[key].map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  state.wildlifeSpecies[key] = list;
  return list;
}

function syncWildlifeCountFromSpecies(state, zoneId) {
  const key = String(zoneId || '');
  const list = ensureSpeciesList(state, key);
  state.wildlife[key] = Math.max(0, list.length);
}

function addWildlife(state, zoneId, pickSpeciesKey, speciesKey = '') {
  const key = String(zoneId || '');
  if (!key) return;
  const list = ensureSpeciesList(state, key);
  const regionSpecies = getRegionWildlifeSpeciesList(key);
  const pickedRegionSpecies = regionSpecies.length ? regionSpecies[randInt(0, Math.max(0, regionSpecies.length - 1))] : '';
  list.push(String(speciesKey || pickedRegionSpecies || pickSpeciesKey() || 'chicken'));
  syncWildlifeCountFromSpecies(state, key);
}

function pickWeightedZone(eligible, weightOf) {
  const ids = eligible.map(String).filter(Boolean);
  if (!ids.length) return '';
  const totalW = ids.reduce((acc, id) => acc + weightOf(id), 0);
  if (totalW <= 0) return ids[0];
  let r = Math.random() * totalW;
  for (const id of ids) {
    r -= weightOf(id);
    if (r <= 0) return id;
  }
  return ids[ids.length - 1];
}

export function ensureWildlifeSpawns({
  eligible = [],
  spawnKey = 0,
  state,
  timeOfDay = 'day',
  worldSpawnRules = {},
} = {}) {
  try {
    const s = state;
    if (!s || typeof s !== 'object') return;
    const wildRule = worldSpawnRules?.wildlife || {};
    const wildlifeEnabled = wildRule?.enabled !== false;
    const perZoneMinDay = Math.max(0, Number(wildRule?.perZoneMinDay ?? 2));
    const perZoneMinNight = Math.max(0, Number(wildRule?.perZoneMinNight ?? 2));
    const extraTotalDay = Math.max(0, Number(wildRule?.extraTotalDay ?? eligible.length));
    const extraTotalNight = Math.max(0, Number(wildRule?.extraTotalNight ?? eligible.length));

    const perZoneMin = (timeOfDay === 'day') ? perZoneMinDay : perZoneMinNight;
    const extraTotal = (timeOfDay === 'day') ? extraTotalDay : extraTotalNight;
    const regionPhaseMul = (timeOfDay === 'day') ? 0.28 : 0.36;
    const regionTargetTotal = eligible.reduce((sum, zid) => {
      const count = getRegionWildlifeSpeciesList(zid).length;
      return sum + Math.max(perZoneMin, Math.ceil(count * regionPhaseMul));
    }, 0);
    const targetTotal = Math.max(0, regionTargetTotal + extraTotal);
    const speciesPool = buildSpeciesPool(wildRule, timeOfDay);
    const pickSpeciesKey = () => pickWeightedSpeciesKey(speciesPool);

    if (wildlifeEnabled && Number(s?.spawnedDay?.wildlife) !== spawnKey) {
      if (!s.wildlife || typeof s.wildlife !== 'object') s.wildlife = {};
      if (!s.wildlifeSpecies || typeof s.wildlifeSpecies !== 'object') s.wildlifeSpecies = {};

      const allow = new Set(eligible.map(String));
      Object.keys(s.wildlife).forEach((k) => {
        if (!allow.has(String(k))) delete s.wildlife[k];
      });
      Object.keys(s.wildlifeSpecies).forEach((k) => {
        if (!allow.has(String(k))) delete s.wildlifeSpecies[k];
      });

      for (const zid0 of eligible) {
        const zid = String(zid0 || '');
        if (!zid) continue;
        const list = ensureSpeciesList(s, zid);
        const legacyCount = Math.max(0, Number(s.wildlife[zid] ?? 0));
        const regionSpecies = getRegionWildlifeSpeciesList(zid);
        const regionMin = regionSpecies.length
          ? Math.max(perZoneMin, Math.ceil(regionSpecies.length * regionPhaseMul))
          : perZoneMin;
        while (list.length < legacyCount) list.push(pickSpeciesKey());
        while (list.length < regionMin) {
          const idx = list.length % Math.max(1, regionSpecies.length);
          list.push(regionSpecies[idx] || pickSpeciesKey());
        }
        syncWildlifeCountFromSpecies(s, zid);
      }

      const hotspot = (wildRule?.hotspotWeights && typeof wildRule.hotspotWeights === 'object') ? wildRule.hotspotWeights : {
        forest: 2.0,
        stream: 1.6,
        beach: 1.4,
        cemetery: 1.3,
        park: 1.2,
        port: 1.2,
      };

      const weightOf = (zid) => {
        const k = String(zid || '');
        const v = Number(hotspot?.[k]);
        const regionW = getRegionHotspotWeight(k);
        if (Number.isFinite(v) && v > 0) return Math.max(v, regionW);
        return regionW;
      };

      const totalNow = eligible.reduce((sum, z) => sum + Math.max(0, Number(s.wildlife[String(z)] ?? 0)), 0);
      let add = Math.max(0, targetTotal - totalNow);

      const cap = Math.max(0, Number(wildRule?.topupCapPerPhase ?? (eligible.length * 4)));
      add = Math.min(add, cap);
      for (let i = 0; i < add; i++) {
        const zid = pickWeightedZone(eligible, weightOf);
        if (!zid) break;
        addWildlife(s, zid, pickSpeciesKey, pickSpeciesKey());
      }

      s.spawnedDay.wildlife = spawnKey;
    }
  } catch {
    // Wildlife spawning is non-critical; keep the phase running if region data is malformed.
  }
}
