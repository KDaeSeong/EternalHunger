import { applyErSubjectPreset } from '../../../utils/erMeta';
import { ER_STAT_KEYS, normalizeErStats } from '../../../utils/erStats';
import { createInitialMasteryState } from '../../../utils/masteryLogic';
import { getRuleset } from '../../../utils/rulesets';
import {
  applyPerkBundleToActor,
  buildDay1HeroRoutePlanDetails,
  buildEarlyRoutePlanDetails,
  buildPerkRuntimeBundle,
  ensureEquipped,
  normalizeRuntimeSurvivor,
  normalizeRuntimeSurvivorList,
} from './simulationEngine';
import {
  applyMatchTeams,
  pickParticipantsForRun,
} from './matchRosterRuntime';

function createEmptyRoutePlan() {
  return {
    zoneIds: [],
    itemIdsByZone: {},
    targetItemIds: [],
    requiredItemIds: [],
    requiredQtyById: {},
    droneItemIds: [],
    targetNamesBySlot: {},
    source: '',
  };
}

function pickRandom(pool) {
  const list = Array.isArray(pool) && pool.length ? pool : ['__default__'];
  return list[Math.floor(Math.random() * list.length)] || list[0] || '__default__';
}

export function pickInitialStartZoneIdForActor(actor, {
  initialMap = null,
  initialZoneIds = [],
} = {}) {
  try {
    const zonesArr = Array.isArray(initialMap?.zones) ? initialMap.zones : [];
    const fallbackPool = Array.isArray(initialZoneIds) && initialZoneIds.length ? initialZoneIds : ['__default__'];
    const fallback = () => pickRandom(fallbackPool);
    if (!zonesArr.length) return fallback();

    const texts = [];
    function addText(value) {
      if (value === null || value === undefined) return;
      const text = String(value).trim();
      if (text) texts.push(text.toLowerCase());
    }

    function addFromList(entries) {
      if (!Array.isArray(entries)) return;
      entries.forEach((gear) => {
        if (!gear) return;
        if (typeof gear === 'string') {
          addText(gear);
          return;
        }
        addText(gear.name);
        addText(gear.kind);
        addText(gear.category);
        addText(gear.type);
        if (Array.isArray(gear.tags)) gear.tags.forEach(addText);
      });
    }

    addFromList(actor?.recommendedHighGear);
    addFromList(actor?.recommendedAdvancedGear);
    addFromList(actor?.recommendedGear);
    addFromList(actor?.advancedGear);

    const stats = normalizeErStats(actor?.stats || actor?.stat || actor);
    const ranked = ER_STAT_KEYS.map((key) => [key, Number(stats?.[key] ?? stats?.[key.toUpperCase()] ?? 0)]);
    ranked.sort((a, b) => b[1] - a[1]);
    const topStat = ranked[0]?.[0];
    if (topStat) addText(topStat);

    const keywordMap = {
      keyboard: ['keyboard', '키보드', '키보'],
      mouse: ['mouse', '마우스'],
      monitor: ['monitor', '모니터'],
      weapon: ['weapon', '무기', 'armory', '병기'],
      armor: ['armor', '방어구', '갑옷'],
      food: ['food', '음식', '식당', '편의'],
      attackPower: ['attack', '공격', '무기', 'weapon', 'melee', 'shoot', 'gun'],
      skillAmp: ['skill', '스킬', '증폭', 'lab', '연구'],
      defense: ['defense', '방어', 'armor'],
      attackSpeed: ['speed', '공속', '기동'],
      attackRange: ['range', '사거리', '원거리'],
      sightRange: ['vision', '시야', '정찰'],
    };

    const expanded = new Set();
    texts.forEach((text) => {
      expanded.add(text);
      Object.entries(keywordMap).forEach(([key, synonyms]) => {
        const hit = text.includes(key) || synonyms.some((synonym) => text.includes(String(synonym).toLowerCase()));
        if (hit) synonyms.forEach((synonym) => expanded.add(String(synonym).toLowerCase()));
      });
    });

    const hints = [...expanded].filter(Boolean);
    if (!hints.length) return fallback();

    const candidates = [];
    for (const zone of zonesArr) {
      const name = String(zone?.name || '').toLowerCase();
      const tags = Array.isArray(zone?.tags) ? zone.tags.map((tag) => String(tag).toLowerCase()) : [];
      if (hints.some((hint) => name.includes(hint) || tags.includes(hint))) {
        candidates.push(String(zone?.zoneId || ''));
      }
    }

    const pool = candidates.filter(Boolean).length ? candidates.filter(Boolean) : fallbackPool;
    return pickRandom(pool);
  } catch (err) {
    console.error('[simulation:pickInitialStartZoneIdForActor]', err);
    return String(initialZoneIds?.[0] || '__default__');
  }
}

export function buildInitialFastRoutePlan(actor, initialMap, routeItems) {
  if (!Array.isArray(routeItems) || !routeItems.length) return createEmptyRoutePlan();
  try {
    const day1HeroRoutePlan = buildDay1HeroRoutePlanDetails(actor, initialMap, routeItems, {
      routeLength: 2,
      droneFallbackLimit: 1,
      candidateLimit: 6,
      beamLimit: 48,
      maxRoutes: 96,
    });
    if (day1HeroRoutePlan?.complete) return day1HeroRoutePlan;
    return buildEarlyRoutePlanDetails(actor, initialMap, routeItems, { routeLength: 4 }) || createEmptyRoutePlan();
  } catch (routeErr) {
    console.error('[simulation:initRoutePlan]', routeErr);
    return createEmptyRoutePlan();
  }
}

export function mergeInitialRoutePlanFields(actor, routePlan, sourceFallback = 'fast_start') {
  const plan = routePlan || createEmptyRoutePlan();
  const routePlanZoneIds = Array.isArray(plan.zoneIds) ? plan.zoneIds : [];
  return normalizeRuntimeSurvivor({
    ...actor,
    routePlanZoneIds,
    routePlanItemIdsByZone: plan.itemIdsByZone || {},
    routePlanTargetItemIds: Array.isArray(plan.targetItemIds) ? plan.targetItemIds : [],
    routePlanRequiredItemIds: Array.isArray(plan.requiredItemIds) ? plan.requiredItemIds : [],
    routePlanRequiredQtyById: plan.requiredQtyById || {},
    routePlanDroneItemIds: Array.isArray(plan.droneItemIds) ? plan.droneItemIds : [],
    routePlanTargetNamesBySlot: plan.targetNamesBySlot || {},
    routePlanSource: plan.source || (routePlanZoneIds.length ? 'recipe' : sourceFallback),
  });
}

export function enrichInitialRoutePlansForItems({
  list,
  routeItems,
  initialMap,
} = {}) {
  return normalizeRuntimeSurvivorList((Array.isArray(list) ? list : []).map((actor) => {
    const routeSource = String(actor?.routePlanSource || '');
    const alreadyRouted = routeSource && routeSource !== 'fast_start';
    const routeStarted = Math.max(0, Number(actor?.routePlanIndex || 0)) > 0 || actor?.day1HeroDone;
    const hasRoutePlan = Array.isArray(actor?.routePlanZoneIds) && actor.routePlanZoneIds.length > 0;
    const hasRouteTargets = Array.isArray(actor?.routePlanRequiredItemIds) && actor.routePlanRequiredItemIds.length > 0;
    if (alreadyRouted || (routeStarted && hasRoutePlan && hasRouteTargets)) return actor;

    const routePlan = buildInitialFastRoutePlan(actor, initialMap, routeItems);
    if (!Array.isArray(routePlan?.zoneIds) || !routePlan.zoneIds.length) return actor;
    return mergeInitialRoutePlanFields(actor, routePlan, routeSource || 'fast_start');
  }));
}

export function buildInitialSimulationRoster({
  charList = [],
  routeItems = [],
  initialMap = null,
  initialZoneIds = [],
  loadedSettings = {},
  participantPresets = [],
  selectedParticipantPresetId = '',
  viewerPerks = [],
  publicPerks = [],
} = {}) {
  const ruleset = getRuleset(loadedSettings?.rulesetId);
  const detonation = ruleset?.detonation;
  const energy = ruleset?.gadgetEnergy;
  const initPerkBundle = buildPerkRuntimeBundle(Array.isArray(viewerPerks) ? viewerPerks : [], publicPerks);
  const charsWithHp = [];

  (Array.isArray(charList) ? charList : []).forEach((character) => {
    const erSeed = applyErSubjectPreset(character, {
      replaceDefaultTactical: false,
      statBiasScale: Number(ruleset?.ai?.erPresetStatScale ?? 1),
    });
    const routePlan = buildInitialFastRoutePlan(erSeed, initialMap, routeItems);
    const routePlanZoneIds = Array.isArray(routePlan.zoneIds) ? routePlan.zoneIds : [];
    const startZoneId = routePlanZoneIds[0] || pickInitialStartZoneIdForActor(erSeed, { initialMap, initialZoneIds });
    const seedStats = normalizeErStats(erSeed?.stats);
    const seedMaxHp = Math.max(1, Math.round(Number(seedStats.maxHp || 100)));
    const seededBase = mergeInitialRoutePlanFields({
      ...erSeed,
      stats: seedStats,
      level: 1,
      erLevel: 1,
      masteryXp: 0,
      mastery: createInitialMasteryState(),
      weaponMasteryXp: 0,
      weaponMasteryLevel: 1,
      tacticalSkillLevel: Math.max(1, Math.min(2, Number(erSeed?.tacticalSkillLevel || 1))),
      hp: seedMaxHp,
      maxHp: seedMaxHp,
      zoneId: startZoneId,
      inventory: [],
      equipped: ensureEquipped({ inventory: [], equipped: {} }),
      day1Moves: 0,
      day1HeroDone: false,
      routePlanSearchCounts: {},
      routePlanIndex: 0,
      simCredits: Number(ruleset?.credits?.start ?? 15),
      droneLastOrderIndex: -9999,
      droneLastOrderAbsSec: -99999,
      kioskLastInteractAbsSec: -99999,
      detonationSec: detonation ? detonation.startSec : null,
      detonationMaxSec: detonation ? detonation.maxSec : null,
      gadgetEnergy: energy ? energy.start : 0,
      cooldowns: {
        portableSafeZone: 0,
        cnotGate: 0,
        weaponSkill: 0,
      },
      safeZoneUntil: 0,
    }, routePlan, 'fast_start');
    const seeded = applyPerkBundleToActor(seededBase, initPerkBundle, { initialFill: true, applyCredits: true });
    charsWithHp.push(seeded);
  });

  const candidateChars = normalizeRuntimeSurvivorList(charsWithHp);
  const selectedChars = pickParticipantsForRun(
    candidateChars,
    participantPresets,
    selectedParticipantPresetId,
    loadedSettings
  );
  const shuffledChars = applyMatchTeams(selectedChars, loadedSettings);

  return {
    candidateChars,
    selectedChars,
    shuffledChars,
  };
}
