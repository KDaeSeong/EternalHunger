import { getMutantWildlifeSpawnZoneId } from './localSimulationSettings';
import { randInt } from './simulationCommon';
import { cloneSpawnState } from './spawnStateRuntime';
import { getTimeOfDayFromPhase } from './worldTime';
import {
  getEligibleCoreSpawnZoneIds,
  getEligibleSpawnZoneIds,
} from './coreSpawnRuntime';

function ensureWorldSpawns(prevState, zones, forbiddenIds, curDay, curPhase, mapId, coreSpawnZoneIds, ruleset) {
  const announcements = [];
  const s = cloneSpawnState(prevState, mapId);

  const ws = ruleset?.worldSpawns || {};
  const coreRule = ws.core || {};
  const legRule = ws.legendaryCrate || {};
  const transRule = ws.transcendCrate || {};
  const foodRule = ws.foodCrate || {};

  const coreKeepDays = Math.max(1, Number(coreRule?.keepDays ?? 2));

  const legGateDay = Number(legRule?.gateDay ?? 3);
  const legMaxPerDay = Math.max(1, Number(legRule?.perDayMax ?? 3));
  const legKeepDays = Math.max(1, Number(legRule?.keepDays ?? 3));
  const transKeepDays = Math.max(1, Number(transRule?.keepDays ?? 2));

  const foodKeepDays = Math.max(1, Number(foodRule?.keepDays ?? 2));

  const timeOfDay = getTimeOfDayFromPhase(curPhase);
  const d = Number(curDay || 0);
  const p = String(curPhase || '');
  const spawnKey = d + (p === 'night' ? 0.5 : 0.0);

  const eligible = getEligibleSpawnZoneIds(zones, forbiddenIds);
  if (!eligible.length) return { state: s, announcements };

  try {
    const wildRule = ws?.wildlife || {};
    const wildlifeEnabled = wildRule?.enabled !== false;
    const perZoneMinDay = Math.max(0, Number(wildRule?.perZoneMinDay ?? 2));
    const perZoneMinNight = Math.max(0, Number(wildRule?.perZoneMinNight ?? 2));
    const extraTotalDay = Math.max(0, Number(wildRule?.extraTotalDay ?? eligible.length));
    const extraTotalNight = Math.max(0, Number(wildRule?.extraTotalNight ?? eligible.length));

    const perZoneMin = (timeOfDay === 'day') ? perZoneMinDay : perZoneMinNight;
    const extraTotal = (timeOfDay === 'day') ? extraTotalDay : extraTotalNight;
    const targetTotal = Math.max(0, eligible.length * perZoneMin + extraTotal);

    const defaultSpeciesByTime = {
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
    const speciesPoolRaw = Array.isArray(wildRule?.speciesByTimeOfDay?.[timeOfDay])
      ? wildRule.speciesByTimeOfDay[timeOfDay]
      : defaultSpeciesByTime[timeOfDay] || defaultSpeciesByTime.day;
    const speciesPool = speciesPoolRaw
      .map((row) => ({
        key: String(row?.key || row?.species || row?.name || '').trim().toLowerCase(),
        weight: Math.max(0, Number(row?.weight ?? 1)),
      }))
      .filter((row) => row.key && row.weight > 0);

    const pickSpeciesKey = () => {
      const pool = speciesPool.length ? speciesPool : defaultSpeciesByTime.day;
      const total = pool.reduce((sum, row) => sum + Math.max(0, Number(row?.weight || 0)), 0);
      if (total <= 0) return String(pool[0]?.key || 'chicken');
      let r = Math.random() * total;
      for (const row of pool) {
        r -= Math.max(0, Number(row?.weight || 0));
        if (r <= 0) return String(row.key || 'chicken');
      }
      return String(pool[pool.length - 1]?.key || 'chicken');
    };

    const ensureSpeciesList = (zid) => {
      if (!s.wildlifeSpecies || typeof s.wildlifeSpecies !== 'object') s.wildlifeSpecies = {};
      const key = String(zid || '');
      const list = Array.isArray(s.wildlifeSpecies[key])
        ? s.wildlifeSpecies[key].map((x) => String(x || '').trim()).filter(Boolean)
        : [];
      s.wildlifeSpecies[key] = list;
      return list;
    };

    const setWildlifeCountFromSpecies = (zid) => {
      const key = String(zid || '');
      const list = ensureSpeciesList(key);
      s.wildlife[key] = Math.max(0, list.length);
    };

    const addWildlife = (zid, speciesKey = '') => {
      const key = String(zid || '');
      if (!key) return;
      const list = ensureSpeciesList(key);
      list.push(String(speciesKey || pickSpeciesKey() || 'chicken'));
      setWildlifeCountFromSpecies(key);
    };

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
        const list = ensureSpeciesList(zid);
        const legacyCount = Math.max(0, Number(s.wildlife[zid] ?? 0));
        while (list.length < legacyCount) list.push(pickSpeciesKey());
        while (list.length < perZoneMin) list.push(pickSpeciesKey());
        setWildlifeCountFromSpecies(zid);
      }

      const hotspot = (wildRule?.hotspotWeights && typeof wildRule.hotspotWeights === 'object') ? wildRule.hotspotWeights : {
        forest: 2.0,
        stream: 1.6,
        sandy_beach: 1.4,
        cemetery: 1.3,
        park: 1.2,
        port: 1.2,
      };

      const weightOf = (zid) => {
        const k = String(zid || '');
        const v = Number(hotspot?.[k]);
        if (Number.isFinite(v) && v > 0) return v;
        return 1.0;
      };

      const sumNow = () => eligible.reduce((sum, z) => sum + Math.max(0, Number(s.wildlife[String(z)] ?? 0)), 0);
      const totalNow = sumNow();
      let add = Math.max(0, targetTotal - totalNow);

      const pickZone = () => {
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
      };

      const cap = Math.max(0, Number(wildRule?.topupCapPerPhase ?? (eligible.length * 4)));
      add = Math.min(add, cap);
      for (let i = 0; i < add; i++) {
        const zid = pickZone();
        if (!zid) break;
        addWildlife(zid, pickSpeciesKey());
      }

      s.spawnedDay.wildlife = spawnKey;
    }
  } catch {
    // ignore
  }

  const eligibleCore = getEligibleCoreSpawnZoneIds(zones, forbiddenIds, coreSpawnZoneIds);

  const meteorCount = (d === 2 && p === 'morning') ? 2 : (d === 3 && p === 'morning') ? 2 : 0;
  const lifeTreeCount = (d === 2 && p === 'morning') ? 3 : (d === 3 && p === 'morning') ? 2 : 0;

  if ((meteorCount > 0 || lifeTreeCount > 0) && Number(s.spawnedDay.core) !== spawnKey && eligibleCore.length) {
    const alreadyAlive = new Set(
      (Array.isArray(s.coreNodes) ? s.coreNodes : [])
        .filter((n) => !n?.picked)
        .map((n) => String(n?.zoneId))
    );

    const zonePool = eligibleCore.filter((zid) => !alreadyAlive.has(String(zid)));
    let spawned = 0;

    function spawnCore(kind, count) {
      const c = Math.min(Math.max(0, Number(count || 0)), zonePool.length);
      for (let i = 0; i < c; i++) {
        const zid = zonePool.splice(randInt(0, Math.max(0, zonePool.length - 1)), 1)[0];
        s.counters.core = Number(s.counters.core || 0) + 1;
        s.coreNodes.push({
          id: `CORE_${String(d)}_${String(s.counters.core)}`,
          kind,
          zoneId: String(zid),
          spawnedDay: d,
          picked: false,
          pickedBy: null,
          pickedAt: null,
        });
        spawned++;
      }
    }

    if (lifeTreeCount > 0) spawnCore('life_tree', lifeTreeCount);
    if (meteorCount > 0) spawnCore('meteor', meteorCount);

    s.spawnedDay.core = spawnKey;
    if (spawned > 0) announcements.push(`🌠 희귀 재료 자연 스폰 발생! (x${spawned})`);
  }

  const foodCount = (d === 2 && p === 'morning') ? 3 : (d === 2 && p === 'night') ? 3 : (d === 3 && p === 'morning') ? 2 : (d === 3 && p === 'night') ? 1 : 0;

  if (foodCount > 0 && Number(s.spawnedDay.food) !== spawnKey) {
    const alreadyAlive = new Set(
      (Array.isArray(s.foodCrates) ? s.foodCrates : [])
        .filter((c) => !c?.opened)
        .map((c) => String(c?.zoneId))
    );

    const zonePool = eligible.filter((zid) => !alreadyAlive.has(String(zid)));
    const pickCount = Math.min(foodCount, zonePool.length);

    for (let i = 0; i < pickCount; i++) {
      const zid = zonePool.splice(randInt(0, Math.max(0, zonePool.length - 1)), 1)[0];
      s.counters.food = Number(s.counters.food || 0) + 1;
      s.foodCrates.push({
        id: `FCRATE_${String(d)}_${String(s.counters.food)}`,
        zoneId: String(zid),
        spawnedDay: d,
        opened: false,
        openedBy: null,
        openedAt: null,
      });
    }

    s.spawnedDay.food = spawnKey;
    if (pickCount > 0) announcements.push(`🍱 음식 상자 드랍 발생! (x${pickCount})`);
  }

  const legendaryCount = (d === 2 && p === 'night') ? 3
    : (d === 3 && (p === 'morning' || p === 'night')) ? 3
    : (d === 4 && p === 'morning') ? 3
    : 0;

  if (legendaryCount > 0 && Number(curDay || 0) >= legGateDay && Number(s.spawnedDay.legendary) !== spawnKey) {
    const alreadyToday = new Set(
      (Array.isArray(s.legendaryCrates) ? s.legendaryCrates : [])
        .filter((c) => Number(c?.spawnedDay) === Number(curDay || 0))
        .map((c) => String(c?.zoneId))
    );

    const maxNew = Math.min(legendaryCount, legMaxPerDay);
    const zonePool = eligible.filter((zid) => !alreadyToday.has(String(zid)));
    const pickCount = Math.min(maxNew, zonePool.length);

    for (let i = 0; i < pickCount; i++) {
      const zid = zonePool.splice(randInt(0, Math.max(0, zonePool.length - 1)), 1)[0];
      s.counters.crate = Number(s.counters.crate || 0) + 1;
      s.legendaryCrates.push({
        id: `LCRATE_${String(curDay || 0)}_${String(s.counters.crate)}`,
        zoneId: String(zid),
        spawnedDay: Number(curDay || 0),
        opened: false,
        openedBy: null,
        openedAt: null,
      });
    }

    s.spawnedDay.legendary = spawnKey;
    if (pickCount > 0) announcements.push(`🟪 전설 재료 상자 드랍 발생! (x${pickCount})`);
  }

  function spawnBossAt(kind, targetDay) {
    const k = String(kind);
    if (p !== 'night') return;
    if (d !== Number(targetDay || 0)) return;

    const existing = s?.bosses?.[k];
    if (existing) return;

    if (Number(s.spawnedDay?.[k]) === spawnKey) return;

    const zid = eligible[randInt(0, Math.max(0, eligible.length - 1))];
    s.bosses[k] = {
      kind: k,
      zoneId: String(zid),
      spawnedDay: d,
      alive: true,
      defeatedBy: null,
      defeatedAt: null,
    };
    s.spawnedDay[k] = spawnKey;

    const label = k === 'alpha' ? '알파' : k === 'omega' ? '오메가' : '위클라인';
    announcements.push(`⚠️ ${label}가 어딘가에 출현했다!`);
  }

  spawnBossAt('alpha', 2);
  spawnBossAt('omega', 3);
  spawnBossAt('weakline', 4);

  const transEnabled = transRule?.enabled !== false;
  const transGateDay = Number(transRule?.gateDay ?? 4);
  const transPhase = String(transRule?.phase ?? transRule?.timeOfDay ?? 'night');
  const transCount = Math.max(0, Math.floor(Number(transRule?.count ?? 2)));
  if (
    transEnabled &&
    transCount > 0 &&
    d === transGateDay &&
    p === transPhase &&
    Number(s.spawnedDay?.transcend ?? -1) !== spawnKey
  ) {
    const alreadyAlive = new Set(
      (Array.isArray(s.transcendCrates) ? s.transcendCrates : [])
        .filter((c) => !c?.opened)
        .map((c) => String(c?.zoneId))
    );
    const zonePool = eligible.filter((zid) => !alreadyAlive.has(String(zid)));
    const pickCount = Math.min(transCount, zonePool.length);
    if (!Array.isArray(s.transcendCrates)) s.transcendCrates = [];
    if (!s.counters || typeof s.counters !== 'object') s.counters = {};

    for (let i = 0; i < pickCount; i++) {
      const weaklineZone = String(s?.bosses?.weakline?.zoneId || '');
      const preferredIdx = weaklineZone ? zonePool.findIndex((zid) => String(zid) === weaklineZone) : -1;
      const pickIdx = preferredIdx >= 0 && i === 0
        ? preferredIdx
        : randInt(0, Math.max(0, zonePool.length - 1));
      const zid = zonePool.splice(pickIdx, 1)[0];
      s.counters.transcend = Number(s.counters.transcend || 0) + 1;
      s.transcendCrates.push({
        id: `TCRATE_${String(curDay || 0)}_${String(s.counters.transcend)}`,
        zoneId: String(zid),
        spawnedDay: Number(curDay || 0),
        opened: false,
        openedBy: null,
        openedAt: null,
      });
    }

    s.spawnedDay.transcend = spawnKey;
    if (pickCount > 0) announcements.push(`🎁 초월 장비 선택 상자 스폰! (x${pickCount})`);
  }

  if (String(curPhase || '') === 'morning') {
    if (s.mutantWildlife) s.mutantWildlife = null;
  }

  if (String(curPhase || '') === 'night') {
    const nightDay = Number(curDay || 0);
    const mutantRule = ws?.mutantWildlife || {};
    const mutantEnabled = mutantRule?.enabled !== false;
    const mutantGateDay = Math.max(1, Number(mutantRule?.gateDay ?? 2));
    const mutantIntervalNights = Math.max(1, Number(mutantRule?.intervalNights ?? 2));
    const mutantSpawnChance = Math.max(0, Math.min(1, Number(mutantRule?.spawnChance ?? 0.75)));
    const mutantIntervalOk = ((nightDay - mutantGateDay) % mutantIntervalNights) === 0;
    s.spawnedDay = s.spawnedDay || {};
    const attemptedThisNight = Number(s.spawnedDay.mutantWildlife ?? -1) === nightDay;
    if (mutantEnabled && nightDay >= mutantGateDay && mutantIntervalOk && !attemptedThisNight) {
      s.spawnedDay.mutantWildlife = nightDay;
    }
    if (mutantEnabled && nightDay >= mutantGateDay && mutantIntervalOk && !attemptedThisNight && Math.random() < mutantSpawnChance) {
      const cfgZid = String(getMutantWildlifeSpawnZoneId(mapId) || '').trim();
      const allZoneIdSet = new Set((Array.isArray(zones) ? zones : []).map((z) => String(z?.zoneId || '')).filter(Boolean));
      const zid = (cfgZid && allZoneIdSet.has(cfgZid))
        ? cfgZid
        : String(eligible[randInt(0, Math.max(0, eligible.length - 1))] || '');
      if (zid) {
        const animalPool = ['닭', '멧돼지', '곰', '늑대', '박쥐', '들개'];
        const animal = animalPool[randInt(0, animalPool.length - 1)] || '늑대';
        s.mutantWildlife = {
          zoneId: String(zid),
          animal,
          spawnedDay: d,
          alive: true,
          defeatedBy: null,
          defeatedAt: null,
        };
        const zoneName = (Array.isArray(zones) ? zones : []).find((z) => String(z?.zoneId || '') === String(zid))?.name || zid;
        announcements.push(`🧪 변이 야생동물(${animal}) 출현: ${zoneName}`);
      }
    }
  }

  const keepFromLegendary = Math.max(0, Number(curDay || 0) - legKeepDays);
  s.legendaryCrates = (Array.isArray(s.legendaryCrates) ? s.legendaryCrates : [])
    .filter((c) => !c?.opened)
    .filter((c) => Number(c?.spawnedDay || 0) >= keepFromLegendary);

  const keepFromTranscend = Math.max(0, Number(curDay || 0) - transKeepDays);
  s.transcendCrates = (Array.isArray(s.transcendCrates) ? s.transcendCrates : [])
    .filter((c) => !c?.opened)
    .filter((c) => Number(c?.spawnedDay || 0) >= keepFromTranscend);

  const keepFromCore = Math.max(0, Number(curDay || 0) - coreKeepDays);
  s.coreNodes = (Array.isArray(s.coreNodes) ? s.coreNodes : [])
    .filter((n) => !n?.picked)
    .filter((n) => Number(n?.spawnedDay || 0) >= keepFromCore);

  const keepFromFood = Math.max(0, Number(curDay || 0) - foodKeepDays);
  s.foodCrates = (Array.isArray(s.foodCrates) ? s.foodCrates : [])
    .filter((c) => !c?.opened)
    .filter((c) => Number(c?.spawnedDay || 0) >= keepFromFood);

  return { state: s, announcements };
}

export {
  ensureWorldSpawns,
};
