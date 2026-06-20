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
  const foodRule = ws.foodCrate || {};

  const coreKeepDays = Math.max(1, Number(coreRule?.keepDays ?? 2));

  const legGateDay = Number(legRule?.gateDay ?? 3);
  const legDiv = Math.max(1, Number(legRule?.scaleDiv ?? 6));
  const legMaxPerDay = Math.max(1, Number(legRule?.perDayMax ?? 3));
  const legKeepDays = Math.max(1, Number(legRule?.keepDays ?? 3));

  const foodKeepDays = Math.max(1, Number(foodRule?.keepDays ?? 2));

  const timeOfDay = getTimeOfDayFromPhase(curPhase);
  const d = Number(curDay || 0);
  const p = String(curPhase || '');
  const spawnKey = d + (p === 'night' ? 0.5 : 0.0);

  const eligible = getEligibleSpawnZoneIds(zones, forbiddenIds);
  if (!eligible.length) return { state: s, announcements };

  try {
    const wildRule = ws?.wildlife || {};
    const perZoneMinDay = Math.max(0, Number(wildRule?.perZoneMinDay ?? 2));
    const perZoneMinNight = Math.max(0, Number(wildRule?.perZoneMinNight ?? 2));
    const extraTotalDay = Math.max(0, Number(wildRule?.extraTotalDay ?? eligible.length));
    const extraTotalNight = Math.max(0, Number(wildRule?.extraTotalNight ?? eligible.length));

    const perZoneMin = (timeOfDay === 'day') ? perZoneMinDay : perZoneMinNight;
    const extraTotal = (timeOfDay === 'day') ? extraTotalDay : extraTotalNight;
    const targetTotal = Math.max(0, eligible.length * perZoneMin + extraTotal);

    if (Number(s?.spawnedDay?.wildlife) !== spawnKey) {
      if (!s.wildlife || typeof s.wildlife !== 'object') s.wildlife = {};

      const allow = new Set(eligible.map(String));
      Object.keys(s.wildlife).forEach((k) => {
        if (!allow.has(String(k))) delete s.wildlife[k];
      });

      for (const zid0 of eligible) {
        const zid = String(zid0 || '');
        if (!zid) continue;
        const cur = Math.max(0, Number(s.wildlife[zid] ?? 0));
        s.wildlife[zid] = Math.max(cur, perZoneMin);
      }

      const hotspot = (wildRule?.hotspotWeights && typeof wildRule.hotspotWeights === 'object') ? wildRule.hotspotWeights : {
        forest: 2.0,
        pond: 1.6,
        stream: 1.6,
        beach: 1.4,
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
        s.wildlife[zid] = Math.max(0, Number(s.wildlife[zid] ?? 0)) + 1;
      }

      s.spawnedDay.wildlife = spawnKey;
    }
  } catch {
    // ignore
  }

  const eligibleCore = getEligibleCoreSpawnZoneIds(zones, forbiddenIds, coreSpawnZoneIds);

  const wantMeteor = (d === 1 && p === 'night') || (d === 2 && (p === 'morning' || p === 'night')) || (d === 3 && p === 'morning');
  const wantTree = (d === 1 && p === 'night') ? 2 : (d === 2 && p === 'night') ? 2 : 0;

  if ((wantMeteor || wantTree > 0) && Number(s.spawnedDay.core) !== spawnKey && eligibleCore.length) {
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

    if (wantTree > 0) spawnCore('life_tree', wantTree);
    if (wantMeteor) spawnCore('meteor', 1);

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

  if (timeOfDay === 'day' && Number(curDay || 0) >= legGateDay && Number(s.spawnedDay.legendary) !== Number(curDay || 0)) {
    const alreadyToday = new Set(
      (Array.isArray(s.legendaryCrates) ? s.legendaryCrates : [])
        .filter((c) => Number(c?.spawnedDay) === Number(curDay || 0))
        .map((c) => String(c?.zoneId))
    );

    const maxNew = Math.min(legMaxPerDay, Math.max(1, Math.floor(eligible.length / legDiv) || 1));
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

    s.spawnedDay.legendary = Number(curDay || 0);
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
    const already = Number(s.spawnedDay.mutantWildlife || 0) === nightDay && s?.mutantWildlife?.alive;
    if (mutantEnabled && nightDay >= mutantGateDay && mutantIntervalOk && !already && Math.random() < mutantSpawnChance) {
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
        s.spawnedDay.mutantWildlife = nightDay;
        const zoneName = (Array.isArray(zones) ? zones : []).find((z) => String(z?.zoneId || '') === String(zid))?.name || zid;
        announcements.push(`🧪 변이 야생동물(${animal}) 출현: ${zoneName}`);
      }
    }
  }

  const keepFromLegendary = Math.max(0, Number(curDay || 0) - legKeepDays);
  s.legendaryCrates = (Array.isArray(s.legendaryCrates) ? s.legendaryCrates : [])
    .filter((c) => !c?.opened)
    .filter((c) => Number(c?.spawnedDay || 0) >= keepFromLegendary);

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
