import { getMutantWildlifeSpawnZoneId } from './localSimulationSettings';
import { randInt } from './simulationCommon';
import { cloneSpawnState } from './spawnStateRuntime';
import { getTimeOfDayFromPhase } from './worldTime';
import {
  getEligibleSpawnZoneIds,
} from './coreSpawnRuntime';
import { buildCoreSpawnPlan } from './specialResourceRuntime';
import {
  buildDimensionRiftSpawn,
} from './dimensionRiftRuntime';
import { ensureWildlifeSpawns } from './worldSpawnWildlifeRuntime';

function ensureWorldSpawns(prevState, zones, forbiddenIds, curDay, curPhase, mapId, coreSpawnZoneIds, ruleset, opts = {}) {
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

  const riftRes = buildDimensionRiftSpawn(s, zones, forbiddenIds, d, p, opts?.matchMode, mapId, ws?.dimensionRift || {});
  if (Array.isArray(riftRes?.announcements) && riftRes.announcements.length) {
    announcements.push(...riftRes.announcements);
  }

  ensureWildlifeSpawns({
    eligible,
    spawnKey,
    state: s,
    timeOfDay,
    worldSpawnRules: ws,
  });

  const usedMeteorZoneIds = [
    ...(Array.isArray(s?.coreZoneHistory?.meteor) ? s.coreZoneHistory.meteor : []),
    ...(Array.isArray(s?.coreNodes) ? s.coreNodes : [])
      .filter((n) => String(n?.kind || '') === 'meteor')
      .map((n) => String(n?.zoneId || '')),
  ];
  const corePlan = buildCoreSpawnPlan({
    zones,
    forbiddenIds,
    day: d,
    phase: p,
    usedMeteorZoneIds,
  });

  if (corePlan.length > 0 && Number(s.spawnedDay.core) !== spawnKey) {
    const alreadyAlive = new Set(
      (Array.isArray(s.coreNodes) ? s.coreNodes : [])
        .filter((n) => !n?.picked)
        .map((n) => `${String(n?.kind || '')}:${String(n?.zoneId || '')}`)
    );

    let spawned = 0;
    if (!s.coreZoneHistory || typeof s.coreZoneHistory !== 'object') s.coreZoneHistory = {};
    if (!Array.isArray(s.coreZoneHistory.meteor)) s.coreZoneHistory.meteor = [];
    if (!Array.isArray(s.coreZoneHistory.life_tree)) s.coreZoneHistory.life_tree = [];
    const historySets = {
      meteor: new Set(s.coreZoneHistory.meteor.map((x) => String(x || '').trim()).filter(Boolean)),
      life_tree: new Set(s.coreZoneHistory.life_tree.map((x) => String(x || '').trim()).filter(Boolean)),
    };

    for (const row of corePlan) {
      const kind = String(row?.kind || '');
      const zid = String(row?.zoneId || '');
      if (!kind || !zid) continue;
      if (alreadyAlive.has(`${kind}:${zid}`)) continue;
      s.counters.core = Number(s.counters.core || 0) + 1;
      s.coreNodes.push({
        id: `CORE_${String(d)}_${String(s.counters.core)}`,
        kind,
        zoneId: zid,
        spawnedDay: d,
        picked: false,
        pickedBy: null,
        pickedAt: null,
      });
      if (historySets[kind]) historySets[kind].add(zid);
      spawned++;
    }

    s.coreZoneHistory.meteor = [...historySets.meteor];
    s.coreZoneHistory.life_tree = [...historySets.life_tree];

    s.spawnedDay.core = spawnKey;
    if (spawned > 0) announcements.push(`🌠 오브젝트 등장: 운석/생명의 나무 (x${spawned})`);
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
    if (pickCount > 0) announcements.push(`🍱 음식 상자 보급 도착 (x${pickCount})`);
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
    if (pickCount > 0) announcements.push(`🟪 전설 보급 상자 도착 (x${pickCount})`);
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
    announcements.push(`⚠️ ${label} 출현! 위치를 확인하세요.`);
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
    if (pickCount > 0) announcements.push(`🎁 초월 보급 상자 도착 (x${pickCount})`);
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
        const animalPool = ['늑대', '곰'];
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
        announcements.push(`🧪 변이 ${animal} 출현: ${zoneName}`);
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
