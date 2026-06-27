import {
  clampTier4,
  findItemByKeywords,
  hash32,
  pickWeighted,
  randInt,
  shuffleArray,
} from './simulationCommon';
import { EQUIP_SLOTS } from './simulationConstants';
import { isAtOrAfterWorldTime } from './worldTime';
import { applyPerkDiscount, getActorPerkEffects, perkNumber } from './perkRuntime';
import { invQty } from './inventoryRules';
import {
  canUseKioskAtWorldTime,
  hasKioskAtZone,
  kioskLegendaryPrice,
} from './marketRuntime';
import { roughPower } from './combatRuntime';
import {
  listKioskZoneIdsForMap,
  uniqStrings,
} from './mapTargeting';
import { ensureEquipped } from './survivorRuntime';
import {
  classifySpecialByName,
  getOneSpecialShortMissing,
  isSpecialCoreKind,
  normalizeGoalTier,
} from './craftRuntime';
import { getLegendaryCoreCandidates } from './legendaryRuntime';
import { pickFromAllCrates } from './lootRuntime';
import { pickGoalResourceZoneTargets } from './resourceTargetingRuntime';
import { getRegionZoneWeightsForItem } from './lumiaRegionData';

const WILDLIFE_HUNT_VALUE = {
  chicken: 1.0,
  bat: 1.1,
  boar: 1.8,
  dog: 1.7,
  wolf: 2.4,
  bear: 3.0,
};

function clampGearTier(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(6, Math.floor(n)));
}

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

function scoreWildlifeZoneForActor(spawnState, zoneId, actor) {
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

function objectiveContestPressure(actor, objectiveType = '', subkind = '') {
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

function markObjectiveTarget(result, actor, objectiveType, subkind = '') {
  if (!result || !objectiveType) return result;
  result.objectiveType = String(objectiveType || '');
  result.objectiveSubkind = String(subkind || '');
  result.contestPressure = objectiveContestPressure(actor, objectiveType, subkind);
  return result;
}

function chooseAiMoveTargets({ actor, craftGoal, upgradeNeed, mapObj, spawnState, forbiddenIds, day, phase, kiosks, itemMetaById = null, itemNameById = null }) {
  const miss = Array.isArray(craftGoal?.missing) ? craftGoal.missing : [];
  const hasGoal = !!craftGoal?.target && miss.length > 0;

  const s = spawnState && typeof spawnState === 'object' ? spawnState : null;
  const bosses = s?.bosses || {};
  const coreNodes = Array.isArray(s?.coreNodes) ? s.coreNodes : [];
  const crates = Array.isArray(s?.legendaryCrates) ? s.legendaryCrates : [];
  const transcendCrates = Array.isArray(s?.transcendCrates) ? s.transcendCrates : [];

  const result = { targets: [], reason: '' };

  const simCredits = Math.max(0, Number(actor?.simCredits || 0));
  const kioskZones = listKioskZoneIdsForMap(mapObj, kiosks, forbiddenIds);

  const up = (upgradeNeed && typeof upgradeNeed === 'object') ? upgradeNeed : null;
  const wantLegendAny = !!up?.wantLegend;
  const wantTransAny = !!up?.wantTrans;
  const hasLegendMatAny = !!up?.hasLegendMatAny;
  const hasVfAny = !!up?.hasVf;
  const farmCredits = !!up?.farmCredits;

  const legendCost = Math.max(0, Number(up?.legendCost ?? 200));
  const forceCost = Math.max(0, Number(up?.forceCost ?? 350));
  const transCost = Math.max(0, Number(up?.transCost ?? 500));

  const needKeys = new Set(
    miss
      .map((m) => String(m?.special || classifySpecialByName(m?.name) || ''))
      .filter(Boolean)
  );

  const needVf = needKeys.has('vf') || (wantTransAny && !hasVfAny);
  const needMeteor = needKeys.has('meteor');
  const needLife = needKeys.has('life_tree');
  const needMithril = needKeys.has('mithril');
  const needForce = needKeys.has('force_core');

  if (wantTransAny) {
    const transTargets = uniqStrings(
      transcendCrates
        .filter((c) => c && !c.opened && c.zoneId)
        .map((c) => String(c.zoneId))
        .filter((zid) => zid && !forbiddenIds.has(String(zid)))
    );
    if (isAtOrAfterWorldTime(day, phase, 4, 'night') && transTargets.length) {
      result.targets = transTargets;
      result.reason = '초월 장비 선택 상자';
      markObjectiveTarget(result, actor, 'transcend_crate', 'transcend_pick');
      return result;
    }
  }

  // 0) 특수 재료 오브젝트 우선: 운석/생명의 나무 스폰이 떠 있으면 크레딧 파밍보다 먼저 이동
  const activeCoreZones = uniqStrings(
    coreNodes
      .filter((n) => n && !n.picked && n.zoneId)
      .map((n) => String(n.zoneId))
      .filter((zid) => zid && !forbiddenIds.has(String(zid)))
  );
  if (isAtOrAfterWorldTime(day, phase, 1, 'night') && activeCoreZones.length) {
    const key = String(actor?._id || actor?.id || actor?.name || '');
    const roll = (hash32(key) % 100) / 100;
    const forceContest = (wantLegendAny && !hasLegendMatAny) || needMeteor || needLife || needMithril || needForce || needVf;
    const contest = forceContest || roll < 0.78;
    if (contest) {
      result.targets = activeCoreZones;
      result.reason = '특수 재료 오브젝트';
      markObjectiveTarget(result, actor, 'natural_core', 'core');
      return result;
    }
  }

  // 0) 크레딧 파밍(야생동물 밀집 존): 키오스크 구매/후반 제작이 막힐 때 우선
  if (farmCredits && s?.wildlife && typeof s.wildlife === 'object') {
    const entries = Object.entries(s.wildlife)
      .map(([z, c]) => ({
        z: String(z),
        c: Math.max(0, Number(c || 0)),
        score: scoreWildlifeZoneForActor(s, z, actor),
      }))
      .filter((x) => x.z && !forbiddenIds.has(String(x.z)) && (x.c > 0 || x.score > 0))
      .sort((a, b) => (b.score - a.score) || (b.c - a.c) || a.z.localeCompare(b.z));
    const top = entries.slice(0, 6).map((x) => x.z).filter(Boolean);
    if (top.length) {
      result.targets = top;
      result.reason = '크레딧 파밍(야생동물)';
      return result;
    }
  }

  // 1) VF: 위클라인(5일차) 우선, 그 다음 키오스크 구매(4일차)
  if (needVf) {
    if (isAtOrAfterWorldTime(day, phase, 5, 'day') && bosses?.weakline?.alive && bosses.weakline.zoneId && !forbiddenIds.has(String(bosses.weakline.zoneId))) {
      result.targets = [String(bosses.weakline.zoneId)];
      result.reason = 'VF(위클라인)';
      markObjectiveTarget(result, actor, 'boss', 'weakline');
      return result;
    }
    if (isAtOrAfterWorldTime(day, phase, 4, 'day') && simCredits >= transCost && kioskZones.length) {
      result.targets = kioskZones;
      result.reason = 'VF(키오스크)';
      return result;
    }
  }

  // 1.5) 전설 재료(아무거나): 목표가 없어도 후반 세팅을 위해 '특수재료'를 우선 확보
  if (wantLegendAny && !hasLegendMatAny) {
    const crateTargetsAny = uniqStrings(
      crates
        .filter((c) => c && !c.opened && c.zoneId)
        .map((c) => String(c.zoneId))
        .filter((zid) => zid && !forbiddenIds.has(String(zid)))
    );
    if (isAtOrAfterWorldTime(day, phase, 3, 'day') && crateTargetsAny.length) {
      result.targets = crateTargetsAny;
      result.reason = '특수재료(전설상자)';
      markObjectiveTarget(result, actor, 'legendary_crate', 'legendary_material');
      return result;
    }

    const coreTargetsAny = uniqStrings(
      coreNodes
        .filter((n) => n && !n.picked && n.zoneId)
        .map((n) => String(n.zoneId))
        .filter((zid) => zid && !forbiddenIds.has(String(zid)))
    );
    if (isAtOrAfterWorldTime(day, phase, 1, 'night') && coreTargetsAny.length) {
      result.targets = coreTargetsAny;
      result.reason = '특수 재료 오브젝트';
      markObjectiveTarget(result, actor, 'natural_core', 'core');
      return result;
    }

    if (isAtOrAfterWorldTime(day, phase, 3, 'day') && bosses?.alpha?.alive && bosses.alpha.zoneId && !forbiddenIds.has(String(bosses.alpha.zoneId))) {
      result.targets = [String(bosses.alpha.zoneId)];
      result.reason = '특수재료(알파)';
      markObjectiveTarget(result, actor, 'boss', 'alpha');
      return result;
    }
    if (isAtOrAfterWorldTime(day, phase, 4, 'day') && bosses?.omega?.alive && bosses.omega.zoneId && !forbiddenIds.has(String(bosses.omega.zoneId))) {
      result.targets = [String(bosses.omega.zoneId)];
      result.reason = '특수재료(오메가)';
      markObjectiveTarget(result, actor, 'boss', 'omega');
      return result;
    }

    if (canUseKioskAtWorldTime(day, phase) && kioskZones.length && simCredits >= legendCost) {
      result.targets = kioskZones;
      result.reason = '특수재료(키오스크)';
      return result;
    }
  }

  // 2) 자연 코어(운석/생나): 2일차부터 스폰 → 해당 구역 진입
  if (needMeteor || needLife) {
    const kinds = [];
    if (needMeteor) kinds.push('meteor');
    if (needLife) kinds.push('life_tree');

    const targets = coreNodes
      .filter((n) => n && !n.picked && kinds.includes(String(n.kind)) && n.zoneId)
      .map((n) => String(n.zoneId))
      .filter((zid) => zid && !forbiddenIds.has(String(zid)));
    const uniq = uniqStrings(targets);

    if (uniq.length) {
      result.targets = uniq;
      result.reason = needMeteor && needLife ? '특수 재료(운석/생명의 나무)' : needMeteor ? '특수 재료(운석)' : '특수 재료(생명의 나무)';
      markObjectiveTarget(result, actor, 'natural_core', needMeteor && needLife ? 'core' : needMeteor ? 'meteor' : 'life_tree');
      return result;
    }

    // 키오스크 구매/교환이 가능한 시점이면 키오스크도 후보로
    if (canUseKioskAtWorldTime(day, phase) && kioskZones.length && simCredits >= legendCost) {
      result.targets = kioskZones;
      result.reason = '특수 재료(키오스크)';
      return result;
    }
  }

  // 3) 미스릴: 알파(3일차) → 전설 재료 상자(3일차) → 키오스크(2일차)
  if (needMithril) {
    if (isAtOrAfterWorldTime(day, phase, 3, 'day') && bosses?.alpha?.alive && bosses.alpha.zoneId && !forbiddenIds.has(String(bosses.alpha.zoneId))) {
      result.targets = [String(bosses.alpha.zoneId)];
      result.reason = '미스릴(알파)';
      markObjectiveTarget(result, actor, 'boss', 'alpha');
      return result;
    }

    const crateTargets = uniqStrings(
      crates
        .filter((c) => c && !c.opened && c.zoneId)
        .map((c) => String(c.zoneId))
        .filter((zid) => zid && !forbiddenIds.has(String(zid)))
    );
    if (isAtOrAfterWorldTime(day, phase, 3, 'day') && crateTargets.length) {
      result.targets = crateTargets;
      result.reason = '미스릴(전설상자)';
      markObjectiveTarget(result, actor, 'legendary_crate', 'legendary_material');
      return result;
    }

    if (canUseKioskAtWorldTime(day, phase) && kioskZones.length && simCredits >= legendCost) {
      result.targets = kioskZones;
      result.reason = '미스릴(키오스크)';
      return result;
    }
  }

  // 4) 포스 코어: 오메가(4일차) → 전설 재료 상자(3일차) → 키오스크(2일차)
  if (needForce) {
    if (isAtOrAfterWorldTime(day, phase, 4, 'day') && bosses?.omega?.alive && bosses.omega.zoneId && !forbiddenIds.has(String(bosses.omega.zoneId))) {
      result.targets = [String(bosses.omega.zoneId)];
      result.reason = '포스코어(오메가)';
      markObjectiveTarget(result, actor, 'boss', 'omega');
      return result;
    }

    const crateTargets = uniqStrings(
      crates
        .filter((c) => c && !c.opened && c.zoneId)
        .map((c) => String(c.zoneId))
        .filter((zid) => zid && !forbiddenIds.has(String(zid)))
    );
    if (isAtOrAfterWorldTime(day, phase, 3, 'day') && crateTargets.length) {
      result.targets = crateTargets;
      result.reason = '포스코어(전설상자)';
      markObjectiveTarget(result, actor, 'legendary_crate', 'legendary_material');
      return result;
    }

    if (canUseKioskAtWorldTime(day, phase) && kioskZones.length && simCredits >= forceCost) {
      result.targets = kioskZones;
      result.reason = '포스코어(키오스크)';
      return result;
    }
  }

  // 5) 목표가 있으면, 부족한 일반 재료가 들어있는 상자 구역으로 이동
  if (hasGoal) {
    const zonesForGoal = pickGoalResourceZoneTargets(mapObj, s, forbiddenIds, miss, itemMetaById, itemNameById);
    if (zonesForGoal.length) {
      result.targets = zonesForGoal;
      result.reason = '재료 파밍(목표)';
      return result;
    }
  }

  // 6) 기회주의: 전설 재료 상자/자연 코어가 있으면 약간의 확률로 향함(루프 가속)
  const crateTargets = uniqStrings(
      crates
        .filter((c) => c && !c.opened && c.zoneId)
        .map((c) => String(c.zoneId))
        .filter((zid) => zid && !forbiddenIds.has(String(zid)))
    );
  if (isAtOrAfterWorldTime(day, phase, 3, 'day') && crateTargets.length && Math.random() < 0.18) {
    result.targets = crateTargets;
    result.reason = '전설상자 탐색';
    markObjectiveTarget(result, actor, 'legendary_crate', 'legendary_material');
    return result;
  }

  const coreTargets = uniqStrings(
    coreNodes
      .filter((n) => n && !n.picked && n.zoneId)
      .map((n) => String(n.zoneId))
      .filter((zid) => zid && !forbiddenIds.has(String(zid)))
  );
  if (isAtOrAfterWorldTime(day, phase, 1, 'night') && coreTargets.length && Math.random() < 0.22) {
    result.targets = coreTargets;
    result.reason = '특수 재료 탐색';
    markObjectiveTarget(result, actor, 'natural_core', 'core');
    return result;
  }

  return result;
}


function pickMissingBasicItemId(craftGoal) {
  const miss = Array.isArray(craftGoal?.missing) ? craftGoal.missing : [];
  const hit = miss.find((m) => m?.itemId && !m?.special);
  return hit?.itemId ? String(hit.itemId) : '';
}

function rollKioskInteraction(mapObj, zoneId, kiosks, publicItems, curDay, curPhase, actor, craftGoal, itemNameById, marketRules, ruleset = null, upgradeNeed = null, absSecNow = 0) {
  const mr = marketRules?.kiosk || {};
  const perkFx = getActorPerkEffects(actor);
  const perkChanceBonus = Math.max(0, perkNumber(perkFx.kioskChancePlus || 0)) + Math.max(0, perkNumber(perkFx.goalWeightPlus || 0)) * 0.01;
  const applyKioskCost = (value) => applyPerkDiscount(value, perkFx.kioskDiscountPct, perkFx.marketDiscountPct);
  // 실제 ER 일반 Kiosk는 시작부터 접근 가능하고, 시뮬은 위치/크레딧 조건으로만 제어합니다.
  if (!canUseKioskAtWorldTime(curDay, curPhase)) return null;

  // 위치 게이트: 키오스크는 특정 시설(병원/성당/경찰서/소방서/양궁장/절/창고/연구소/호텔/학교) 구역에만 존재
  if (!hasKioskAtZone(kiosks, mapObj, zoneId)) return null;

  const simCredits = Math.max(0, Number(actor?.simCredits || 0));
  // 실제 ER 일반 Kiosk는 별도 사용 쿨다운보다 크레딧/행동 점유로 제어된다.
  // 시뮬도 1 tick 1 행동 규칙만 적용하고, 별도 cooldown gate는 두지 않는다.
  const items = Array.isArray(publicItems) ? publicItems : [];
  const findById = (id) => items.find((x) => String(x?._id) === String(id)) || null;

  const miss = Array.isArray(craftGoal?.missing) ? craftGoal.missing : [];
  const up = (upgradeNeed && typeof upgradeNeed === 'object') ? upgradeNeed : null;
  const oneSpecialShort = getOneSpecialShortMissing(craftGoal);
  const hasNeed = miss.length > 0;
  const hasUpgradeNeed = !!up?.wantLegend || !!up?.wantTrans || !!up?.farmCredits;
  const legendOverdue = !!up?.legendOverdue;
  const transOverdue = !!up?.transOverdue;
  const nearLegend = !!up?.nearLegend;
  const nearTrans = !!up?.nearTrans;
  const hasMeaningfulNeed = hasNeed || hasUpgradeNeed;
  const cats = mr?.categories || {};
  const allowVf = cats?.vf !== false;
  const allowLegendary = cats?.legendary !== false;
  const allowBasic = cats?.basic !== false;


  // 목표(조합) 기반이면 더 적극적으로 이용(룰셋)
  const chanceNeed = Number(mr?.chanceNeed ?? 0.42);
  const chanceIdle = Number(mr?.chanceIdle ?? 0.16);
  const needCount = Math.max(0, miss.length);
  const earlyProcureBonus = (curDay <= 2) ? 0.08 : 0;
  const savedPlanLegendBonus = oneSpecialShort ? (oneSpecialShort?.special === 'vf' ? 0.18 : 0.15) : 0;
  const pacingPressure = (legendOverdue ? 0.14 : (nearLegend ? 0.05 : 0)) + (transOverdue ? 0.18 : (nearTrans ? 0.06 : 0));
  const urgencyBonus = hasMeaningfulNeed
    ? Math.min(0.24,
        needCount * 0.04
        + (up?.wantLegend ? 0.03 : 0)
        + (up?.wantTrans ? 0.05 : 0)
        + (up?.farmCredits ? 0.02 : 0)
      )
    : 0;
  const affordableNeedBonus = hasMeaningfulNeed
    ? (simCredits >= Number(mr?.prices?.basic ?? 10) ? 0.12 : 0)
    : 0;
  const chance = hasMeaningfulNeed
    ? Math.min(0.995, chanceNeed + earlyProcureBonus + urgencyBonus + affordableNeedBonus + savedPlanLegendBonus + pacingPressure + perkChanceBonus)
    : Math.min(0.55, chanceIdle + ((curDay <= 2 && simCredits >= Number(mr?.prices?.basic ?? 10)) ? 0.04 : 0) + (legendOverdue ? 0.04 : 0) + perkChanceBonus);

  // ✅ 서버(어드민)에서 편집한 키오스크 카탈로그가 있으면 그대로 사용(우선)
  // - 카탈로그는 각 키오스크 문서(Kiosk.catalog)에 저장되며, /public/kiosks로 내려옵니다.
  const kioskDoc = (Array.isArray(kiosks) ? kiosks : []).find((k) => {
    const mid = String(k?.mapId?._id || k?.mapId || '').trim();
    const zid = String(k?.zoneId || '').trim();
    return mid && String(mapObj?._id || '').trim() === mid && String(zoneId || '').trim() === zid;
  });
  let catalog = Array.isArray(kioskDoc?.catalog) ? kioskDoc.catalog : [];

  // 카탈로그 가격이 과도하게 크면(예: 800~1200) 시뮬 기본 규칙으로 fallback
  if (catalog.length && catalog.some((r) => Number(r?.priceCredits || 0) > 650)) catalog = [];

  function pickFromCatalog() {
    if (!catalog.length) return null;

    const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
    const credits = Math.max(0, Number(actor?.simCredits || 0));
    const missIds = new Set((Array.isArray(miss) ? miss : []).map((m) => String(m?.itemId || '')).filter(Boolean));

    const normId = (v) => String(v?._id || v || '').trim();

    // 1) 목표 기반: 부족한 아이템(정확히 itemId 매칭)이 카탈로그에 있으면 우선 수행
    for (const row of catalog) {
      const itemId = normId(row?.itemId);
      if (!itemId || !missIds.has(itemId)) continue;

      const mode = String(row?.mode || 'sell');
      if (mode === 'sell') {
        const cost = applyKioskCost(Math.max(0, Number(row?.priceCredits || 0)));
        if (credits >= cost) return { kind: 'buy', item: findById(itemId) || row.itemId, itemId, qty: 1, cost, label: '카탈로그 구매' };
      }
      if (mode === 'exchange') {
        const giveId = normId(row?.exchange?.giveItemId);
        const giveQty = Math.max(1, Number(row?.exchange?.giveQty || 1));
        if (giveId && invQty(inv, giveId) >= giveQty) {
          return { kind: 'exchange', item: findById(itemId) || row.itemId, itemId, qty: 1, consume: [{ itemId: giveId, qty: giveQty }], label: '카탈로그 교환' };
        }
      }
    }

    // 2) 교환 우선: 가진 재료로 가능한 exchange를 실행(경제 안정화 위해 확률 게이트)
    const exch = catalog.filter((r) => String(r?.mode) === 'exchange');
    if (exch.length && Math.random() < (hasMeaningfulNeed ? 0.82 : 0.60)) {
      const shuffled = shuffleArray(exch);
      for (const row of shuffled) {
        const itemId = normId(row?.itemId);
        const giveId = normId(row?.exchange?.giveItemId);
        const giveQty = Math.max(1, Number(row?.exchange?.giveQty || 1));
        if (!itemId || !giveId) continue;
        if (invQty(inv, giveId) >= giveQty) {
          return { kind: 'exchange', item: findById(itemId) || row.itemId, itemId, qty: 1, consume: [{ itemId: giveId, qty: giveQty }], label: '카탈로그 교환' };
        }
      }
    }

    // 3) 환급(키오스크 buy = 유저 sell): 가진 아이템을 credits로 환전(낮은 확률)
    const refunds = catalog.filter((r) => String(r?.mode) === 'buy');
    if (refunds.length && Math.random() < (hasMeaningfulNeed ? 0.10 : 0.18)) {
      const shuffled = shuffleArray(refunds);
      for (const row of shuffled) {
        const itemId = normId(row?.itemId);
        const gain = Math.max(0, Number(row?.priceCredits || 0));
        if (!itemId || gain <= 0) continue;
        if (invQty(inv, itemId) >= 1) return { kind: 'sell', item: findById(itemId) || row.itemId, itemId, qty: 1, credits: gain, label: '카탈로그 환급' };
      }
    }

    // 4) 구매(sell = 유저 buy): 저가 항목만 가끔 구매
    const buys = catalog.filter((r) => String(r?.mode) === 'sell');
    if (buys.length && Math.random() < (hasMeaningfulNeed ? 0.34 : 0.18)) {
      const isLvMax = (String(ruleset?.ai?.tacModuleUpgradeMode || 'level') === 'level') && (Number(actor?.tacticalSkillLevel || 1) >= 2);
      const shuffled = shuffleArray(buys);
      for (const row of shuffled) {
        const itemId = normId(row?.itemId);
        const cost = applyKioskCost(Math.max(0, Number(row?.priceCredits || 0)));
        if (!itemId) continue;
        // (level 모드) 전술 스킬 레벨이 MAX면 모듈을 랜덤 구매하지 않음(낭비 방지)
        if (isLvMax) {
          const it = findById(itemId) || row?.itemId;
          const nm = String(it?.name || '');
          const tags = Array.isArray(it?.tags) ? it.tags : [];
          const isTacModule = nm.includes('전술 강화 모듈') || tags.some((t) => String(t).toLowerCase().includes('tac_skill_module'));
          if (isTacModule) continue;
        }
        if (cost <= 0 || credits >= cost) return { kind: 'buy', item: findById(itemId) || row.itemId, itemId, qty: 1, cost, label: '카탈로그 구매' };
      }
    }

    return null;
  };

  const hasCatalogNeed = catalog.some((r) => {
    const itemId = String(r?.itemId?._id || r?.itemId || '').trim();
    return itemId && miss.some((m) => String(m?.itemId || '') === itemId);
  });
  if (!hasCatalogNeed) {
    // 업그레이드 목표(전설/초월)만 있어도 키오스크를 '조금 더 자주' 사용
    if (Math.random() >= chance) return null;
  }
  const pickedByCatalog = pickFromCatalog();
  if (pickedByCatalog) return pickedByCatalog;

  // --- 우선 교환/환급 규칙(키오스크 핵심) ---
  // - 포스 코어 → 미스릴
  // - 미스릴 → 전술 강화 모듈
  // - 전술 강화 모듈 → 크레딧 환급
  // - 운석 ↔ 생명의 나무 (상호 교환)
  const findByTag = (tagKey) => items.find((x) => Array.isArray(x?.tags) && x.tags.some((t) => String(t).toLowerCase() == String(tagKey).toLowerCase())) || null;
  const meteorItem = findByTag('meteor') || findItemByKeywords(items, ['운석', 'meteor']);
  const lifeTreeItem = findByTag('life_tree') || findItemByKeywords(items, ['생명의 나무', 'tree of life', 'life tree']);
  const mithrilItem = findByTag('mithril') || findItemByKeywords(items, ['미스릴', 'mythril', 'mithril']);
  const forceCoreItem = findByTag('force_core') || findItemByKeywords(items, ['포스 코어', 'force core']);
  const tacModuleItem = findByTag('tac_skill_module') || findItemByKeywords(items, ['전술 강화 모듈', 'tac. skill module', 'tactical']);

  const tacUpgradeMode = String(ruleset?.ai?.tacModuleUpgradeMode || 'level'); // 'level' | 'stack'
  const TAC_MAX_LV = 2;
  const tacSkillLv = Math.max(1, Math.min(TAC_MAX_LV, Math.floor(Number(actor?.tacticalSkillLevel || 1))));
  const tacIsLvMax = (tacUpgradeMode === 'level') && (tacSkillLv >= TAC_MAX_LV);

  function getPrice(it, fallback) {
    const v = Number(it?.baseCreditValue ?? it?.value ?? it?.price ?? fallback);
    return (Number.isFinite(v) && v > 0) ? v : Math.max(0, Number(fallback || 0));
  };

  const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const has = (it, q=1) => (it?._id ? invQty(inv, String(it._id)) : 0) >= Math.max(1, Number(q||1));
  const missNeedCount = (specialKey) => (Array.isArray(miss) ? miss : []).reduce((sum, m) => {
    const key = String(m?.special || classifySpecialByName(m?.name) || '');
    if (key !== String(specialKey || '')) return sum;
    return sum + Math.max(0, Number(m?.need || 1) - Number(m?.have || 0));
  }, 0);
  const preserveNeededSpecials = mr?.exchange?.preserveNeededSpecials !== false;
  const spareForceNeed = Math.max(0, Number(mr?.exchange?.spareForceCoreToMithril ?? 1));
  const spareMithrilNeed = Math.max(0, Number(mr?.exchange?.spareMithrilToTacModule ?? 2));

  // 0-A) 즉시 교환: 포코→미스릴, 미스릴→모듈, 모듈→크레딧(환급)
  // - 관전 템포를 위해 교환은 확률로 과도한 반복을 줄입니다.
  const forceCoreHave = forceCoreItem?._id ? invQty(inv, String(forceCoreItem._id)) : 0;
  const mithrilHave = mithrilItem?._id ? invQty(inv, String(mithrilItem._id)) : 0;
  const needForceCount = missNeedCount('force_core');
  const needMithrilCount = missNeedCount('mithril');
  const canExchangeForceCore = forceCoreItem && mithrilItem && has(forceCoreItem, 1)
    && (!preserveNeededSpecials || (!up?.wantLegend && !up?.wantTrans) || (forceCoreHave - needForceCount) >= spareForceNeed);
  if (canExchangeForceCore && Math.random() < 0.42) {
    return { kind: 'exchange', item: mithrilItem, itemId: String(mithrilItem._id), qty: 1, consume: [{ itemId: String(forceCoreItem._id), qty: 1 }], label: '포스 코어→미스릴' };
  }
  // (level 모드) 전술 스킬 레벨이 MAX면 미스릴→모듈 교환을 중단(낭비 방지)
  const canExchangeMithril = mithrilItem && tacModuleItem && !tacIsLvMax && has(mithrilItem, 1)
    && (!preserveNeededSpecials || (!up?.wantLegend && !up?.wantTrans) || (mithrilHave - needMithrilCount) >= spareMithrilNeed);
  if (canExchangeMithril && Math.random() < 0.38) {
    return { kind: 'exchange', item: tacModuleItem, itemId: String(tacModuleItem._id), qty: 1, consume: [{ itemId: String(mithrilItem._id), qty: 1 }], label: '미스릴→전술 강화 모듈' };
  }

  // 전술 강화 모듈: (level 모드) 전술 스킬 레벨업 재료 / (stack 모드) 보유 스택 기반 강화
  const tacModuleHave = tacModuleItem?._id ? invQty(inv, String(tacModuleItem._id)) : 0;
  if (tacUpgradeMode !== 'level') {
    // stack 모드에서만 환급을 적극 허용
    if (tacModuleItem && tacModuleHave >= 2 && Math.random() < 0.55) {
      const gain = getPrice(tacModuleItem, 100);
      return { kind: 'sell', item: tacModuleItem, itemId: String(tacModuleItem._id), qty: 1, credits: gain, label: '전술 강화 모듈 환급' };
    }
  } else {
    // level 모드에서는 레벨업이 끝나기 전까지 환급을 거의 하지 않음
    if (tacModuleItem && tacSkillLv >= TAC_MAX_LV && tacModuleHave >= 1 && Math.random() < 0.25) {
      const gain = getPrice(tacModuleItem, 100);
      return { kind: 'sell', item: tacModuleItem, itemId: String(tacModuleItem._id), qty: 1, credits: gain, label: '전술 강화 모듈 환급(레벨MAX)' };
    }
  }

  // 0-B) 목표 기반 상호 교환: 운석↔생나
  const needMeteor = miss.some((m) => (m?.special === 'meteor' || classifySpecialByName(m?.name) === 'meteor'));
  const needTree = miss.some((m) => (m?.special === 'life_tree' || classifySpecialByName(m?.name) === 'life_tree'));
  if (meteorItem && lifeTreeItem) {
    if (needTree && has(meteorItem, 1) && Math.random() < 0.75) {
      return { kind: 'exchange', item: lifeTreeItem, itemId: String(lifeTreeItem._id), qty: 1, consume: [{ itemId: String(meteorItem._id), qty: 1 }], label: '운석→생명의 나무' };
    }
    if (needMeteor && has(lifeTreeItem, 1) && Math.random() < 0.75) {
      return { kind: 'exchange', item: meteorItem, itemId: String(meteorItem._id), qty: 1, consume: [{ itemId: String(lifeTreeItem._id), qty: 1 }], label: '생명의 나무→운석' };
    }
  }

  // 0-C-0) Saved Plan식 추천: 목표 상위 장비가 '특수 재료 1개만 부족'하면 그 재료를 최우선 구매
  if (oneSpecialShort) {
    const key = String(oneSpecialShort.special || '');
    const onePick = (key === 'meteor') ? meteorItem : (key === 'life_tree') ? lifeTreeItem : (key === 'mithril') ? mithrilItem : (key === 'force_core') ? forceCoreItem : (key === 'vf' ? findItemByKeywords(items, ['vf', '혈액', '샘플', 'blood sample']) : tacModuleItem);
    const oneCost = (key === 'vf')
      ? applyKioskCost(Number(mr?.prices?.vf ?? 500))
      : ((key === 'meteor' || key === 'life_tree' || key === 'mithril' || key === 'force_core')
        ? applyKioskCost(kioskLegendaryPrice(String(key), mr?.prices?.legendaryByKey))
        : applyKioskCost(Number(mr?.prices?.tacModule ?? 10)));
    const oneOk = key === 'vf'
      ? Number(mr?.buySuccess?.vf ?? 0.95)
      : Number(mr?.buySuccess?.legendary ?? 0.95);
    if (onePick?._id && simCredits >= oneCost && Math.random() < Math.min(0.995, oneOk + 0.06)) {
      return { kind: 'buy', item: onePick, itemId: String(onePick._id), qty: 1, cost: oneCost, label: `추천 특수재료(${key})` };
    }
  }

  // 0-C) 목표 기반 구매: 운석/생나/미스릴/포코/모듈
  // - 가격은 아이템 baseCreditValue를 우선 사용(없으면 기존 룰셋 fallback).
  const tacModuleTargetMin = (tacUpgradeMode === 'level') ? (tacSkillLv >= TAC_MAX_LV ? 0 : 1) : 1;
  const tacModuleWant = tacModuleItem && (tacModuleHave < tacModuleTargetMin) && (simCredits >= Number(mr?.prices?.tacModule ?? 10)) && (Math.random() < 0.35);
  const wantSpecial = tacModuleWant
    ? ({ name: '전술 강화 모듈', special: 'tac_skill_module' })
    : miss.find((m) => isSpecialCoreKind(m?.special) || isSpecialCoreKind(classifySpecialByName(m?.name)) || (!tacIsLvMax && String(m?.name||'').includes('전술 강화 모듈')));
  if (wantSpecial) {
    const key = wantSpecial.special || classifySpecialByName(wantSpecial.name);
    const pick = (key === 'meteor') ? meteorItem : (key === 'life_tree') ? lifeTreeItem : (key === 'mithril') ? mithrilItem : (key === 'force_core') ? forceCoreItem : tacModuleItem;
    if (pick && pick._id) {
      const cost = (key === 'meteor' || key === 'life_tree' || key === 'mithril' || key === 'force_core')
        ? applyKioskCost(kioskLegendaryPrice(String(key), mr?.prices?.legendaryByKey))
        : Number(mr?.prices?.tacModule ?? 10);
      const ok = Number(mr?.buySuccess?.legendary ?? 0.85);
      const pressureOk = Math.min(0.995, ok + (legendOverdue ? 0.08 : 0) + (transOverdue ? 0.08 : 0) + (oneSpecialShort ? 0.03 : 0));
      if (simCredits >= cost && Math.random() < pressureOk) {
        return { kind: 'buy', item: pick, itemId: String(pick._id), qty: 1, cost, label: '특수재료 구매' };
      }
    }
  }

  // 0-D) 업그레이드 목표(전설/초월) 기반 구매: 목표 레시피가 없어도 후반 세팅을 위해 특수재료를 확보
  // - ER 참고: 크레딧으로 키오스크에서 특수 재료 구매 가능
  // - 우선순위: 초월 목표면 VF → 전설 재료(아무거나)
  if (up && isAtOrAfterWorldTime(curDay, curPhase, 2, 'day')) {
    const buyOkLegend = Number(mr?.buySuccess?.legendary ?? 0.85);
    const buyOkVf = Number(mr?.buySuccess?.vf ?? 0.85);

    // (A) 초월: VF 혈액 샘플
    if (allowVf && up.wantTrans && !up.hasVf && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day')) {
      const vfItem2 = findItemByKeywords(items, ['vf', '혈액', '샘플', 'blood sample']);
      const cost = applyKioskCost(Number(mr?.prices?.vf ?? 500));
      if (vfItem2?._id && simCredits >= cost && Math.random() < buyOkVf) {
        return { kind: 'buy', item: vfItem2, itemId: String(vfItem2._id), qty: 1, cost, label: 'VF 혈액 샘플(업그레이드)' };
      }
    }

    // (B) 전설: 4대 전설 재료 중 "가장 싼" 것부터 확보
    if (allowLegendary && up.wantLegend && !up.hasLegendMatAny) {
      const cand = [];
      if (meteorItem?._id) cand.push({ key: 'meteor', it: meteorItem, cost: applyKioskCost(kioskLegendaryPrice('meteor', mr?.prices?.legendaryByKey)) });
      if (lifeTreeItem?._id) cand.push({ key: 'life_tree', it: lifeTreeItem, cost: applyKioskCost(kioskLegendaryPrice('life_tree', mr?.prices?.legendaryByKey)) });
      if (mithrilItem?._id) cand.push({ key: 'mithril', it: mithrilItem, cost: applyKioskCost(kioskLegendaryPrice('mithril', mr?.prices?.legendaryByKey)) });
      if (forceCoreItem?._id) cand.push({ key: 'force_core', it: forceCoreItem, cost: applyKioskCost(kioskLegendaryPrice('force_core', mr?.prices?.legendaryByKey)) });
      cand.sort((a, b) => (a.cost - b.cost) || String(a.key).localeCompare(String(b.key)));
      const pick = cand[0] || null;
      const legendBuyBias = (curDay <= 3 ? 0.06 : 0) + (miss.length >= 2 ? 0.04 : 0) + (legendOverdue ? 0.08 : 0) + (nearLegend ? 0.03 : 0);
      if (pick?.it?._id && simCredits >= pick.cost && Math.random() < Math.min(0.99, buyOkLegend + legendBuyBias)) {
        return { kind: 'buy', item: pick.it, itemId: String(pick.it._id), qty: 1, cost: Math.max(0, Number(pick.cost || 0)), label: `특수재료(${pick.key})` };
      }
    }
  }

  // 1) 목표 기반: VF 혈액 샘플 (룰셋 가격/성공률)
  const needVf = miss.find((m) => m?.special === 'vf' || classifySpecialByName(m?.name) === 'vf');
  if (needVf && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day')) {
    const vfItem = findById(needVf.itemId) || findItemByKeywords(items, ['vf', '혈액', '샘플', 'sample']);
    const cost = applyKioskCost(Number(mr?.prices?.vf ?? 500));
    const ok = Number(mr?.buySuccess?.vf ?? 0.85);
    if (allowVf && vfItem && simCredits >= cost && Math.random() < ok) {
      return { kind: 'buy', item: vfItem, itemId: String(vfItem._id), qty: 1, cost, label: 'VF 혈액 샘플' };
    }
  }

  // 2) 목표 기반: 전설 재료(룰셋 가격/성공률)
  const needCore = miss.find((m) => isSpecialCoreKind(m?.special) || isSpecialCoreKind(classifySpecialByName(m?.name)));
  if (needCore) {
    const key = needCore.special || classifySpecialByName(needCore.name);
    const coreNameMap = { meteor: '운석', life_tree: '생명의 나무', mithril: '미스릴', force_core: '포스 코어' };
    const label = coreNameMap[key] || '전설 재료';

    const candidates = getLegendaryCoreCandidates(items);
    const found = findById(needCore.itemId) || (candidates.find((c) => c.key === key)?.item || null);
    const cost = applyKioskCost(kioskLegendaryPrice(key, mr?.prices?.legendaryByKey));

    if (found) {
      // 구매 우선
      const ok = Number(mr?.buySuccess?.legendary ?? 0.85);
      const needBuyOk = Math.min(0.995, ok + (legendOverdue ? 0.08 : 0) + (transOverdue ? 0.05 : 0));
      if (allowLegendary && simCredits >= cost && Math.random() < needBuyOk) {
        return { kind: 'buy', item: found, itemId: String(found._id), qty: 1, cost, label };
      }
    }
  }

  // 3) 목표 기반: 일반 재료(맵 상자풀에 존재하는 재료만 구매)
  const needBasic = miss.find((m) => {
    if (!m?.itemId || m?.special) return false;
    const it = findById(m.itemId) || { _id: String(m.itemId), name: String(m?.name || '') };
    return getRegionZoneWeightsForItem(it, mapObj?.zones, new Set()).size > 0;
  });
  if (needBasic) {
    const it = findById(needBasic.itemId);
    const cost = applyKioskCost(Number(mr?.prices?.basic ?? 10));
    const ok = Number(mr?.buySuccess?.basic ?? 0.75);
    if (allowBasic && it && simCredits >= cost && Math.random() < ok) {
      const needQty = Math.max(1, Math.min(3, Math.max(1, Number(needBasic.need || 1) - Number(needBasic.have || 0))));
      return { kind: 'buy', item: it, itemId: String(it._id), qty: needQty, cost, label: '재료 보급' };
    }
  }

  // 4) fallback: 기존 랜덤 로직 (VF/전설 재료/기본 보급)

  // 4-1) 4일차 낮 이후: VF 혈액 샘플(500 크레딧) 구매 가능
  if (isAtOrAfterWorldTime(curDay, curPhase, 4, 'day')) {
    const vfChance = Number(mr?.fallback?.vfChance ?? 0.25);
    if (allowVf && Math.random() < vfChance) {
      const vf = findItemByKeywords(items, ['vf', '혈액', '샘플', 'sample']);
      const cost = applyKioskCost(Number(mr?.prices?.vf ?? 500));
      if (vf && simCredits >= cost) return { kind: 'buy', item: vf, itemId: String(vf._id), qty: 1, cost, label: 'VF 혈액 샘플' };
    }
  }

  // 4-2) 2일차 낮 이후: 운석/생나 키오스크 구매/교환 가능(미스릴/포스코어도 포함)
  const lgChance = Number(mr?.fallback?.legendaryChance ?? 0.20);
  if (allowLegendary && Math.random() < lgChance) {
    const cores = getLegendaryCoreCandidates(items);
    if (cores.length) {
      const picked = cores[Math.floor(Math.random() * cores.length)];
      const cost = applyKioskCost(kioskLegendaryPrice(picked.key, mr?.prices?.legendaryByKey));

      // 구매
      const ok = Number(mr?.buySuccess?.legendaryFallback ?? mr?.buySuccess?.legendary ?? 0.7);
      if (simCredits >= cost && Math.random() < ok) {
        return { kind: 'buy', item: picked.item, itemId: String(picked.item._id), qty: 1, cost, label: picked.label };
      }
    }
  }

  // 4-3) 기본 보급(하급 재료)
  const basicChance = Number(mr?.fallback?.basicChance ?? 0.35);
  if (allowBasic && Math.random() < basicChance) {
    const entry = pickFromAllCrates(mapObj, publicItems);
    if (entry?.itemId) {
      const it = findById(entry.itemId);
      const cost = applyKioskCost(Number(mr?.prices?.basic ?? 10));
      if (it && simCredits >= cost) {
        const qty = Math.max(1, randInt(entry?.minQty ?? 1, entry?.maxQty ?? 1));
        return { kind: 'buy', item: it, itemId: String(it._id), qty, cost, label: '보급품' };
      }
    }
  }

  return null;
}


// --- 전송 드론(하급 아이템) 호출: 즉시 지급 ---
function lowestEquippedTier(actor, publicItems = []) {
  const eq = ensureEquipped(actor);
  const items = Array.isArray(publicItems) ? publicItems : [];
  const tiers = EQUIP_SLOTS.map((slot) => {
    const itemId = String(eq?.[slot] || '');
    if (!itemId) return 0;
    const item = items.find((it) => String(it?._id || '') === itemId) || null;
    return clampGearTier(Number(item?.tier || 0));
  }).filter((v) => Number.isFinite(v) && v > 0);
  return tiers.length ? Math.min(...tiers) : 0;
}

function rollDroneOrder(droneOffers, mapObj, publicItems, curDay, curPhase, actor, phaseIdxNow, craftGoal, itemNameById, marketRules, absSecNow = 0) {
  // 드론은 언제든 호출 가능(하급 아이템 보급용). 캐릭터가 자동으로 호출하며, '즉시 지급' 규칙을 따른다.
  // 너무 잦으면 재미가 깨지므로 확률 + 초 단위 쿨다운으로 제어한다.
  const dm = marketRules?.drone || {};
  if (dm?.enabled === false) return null;
  const perkFx = getActorPerkEffects(actor);
  const perkChanceBonus = Math.max(0, perkNumber(perkFx.droneChancePlus || 0)) + Math.max(0, perkNumber(perkFx.craftChancePlus || 0)) * 0.01;
  const applyDroneCost = (value) => applyPerkDiscount(value, perkFx.droneDiscountPct, perkFx.marketDiscountPct);

  const invCount = Array.isArray(actor?.inventory) ? actor.inventory.length : 0;

  // 실제 ER Remote Drone은 credits만 있으면 anytime, anywhere 호출 가능하다.
  // 시뮬은 1 tick 1 행동 규칙과 비용 조건만 유지하고, 인위적 cooldown gate는 제거한다.
  const absNow = Number(absSecNow || 0);

  const credits = Math.max(0, Number(actor?.simCredits || 0));
  const items = Array.isArray(publicItems) ? publicItems : [];
  const needId = pickMissingBasicItemId(craftGoal);
  const hasNeed = !!needId;
  const goalTier = normalizeGoalTier(actor?.goalGearTier ?? 6);
  const legendOverdue = goalTier >= 5 && isAtOrAfterWorldTime(curDay, curPhase, 2, 'night') && lowestEquippedTier(actor, publicItems) < 5;
  const transOverdue = goalTier >= 6 && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day') && lowestEquippedTier(actor, publicItems) < 6;

  // 목표(조합)에서 부족한 하급 재료가 있으면 조금 더 자주 호출
  const needLow = Number(dm?.chanceNeedLowInv ?? 0.55);
  const needDef = Number(dm?.chanceNeedDefault ?? 0.38);
  const lowInv = Number(dm?.chanceLowInv ?? 0.30);
  const inv2 = Number(dm?.chanceInv2 ?? 0.20);
  const def = Number(dm?.chanceDefault ?? 0.10);
  const droneBaseChance = hasNeed ? (invCount <= 2 ? needLow : needDef) : (invCount <= 1 ? lowInv : invCount == 2 ? inv2 : def);
  const droneUrgency = hasNeed
    ? Math.min(0.24, ((curDay <= 2) ? 0.08 : 0) + ((credits >= Number(dm?.price ?? 10)) ? 0.10 : 0) + (invCount <= 2 ? 0.06 : 0))
    : ((curDay <= 2 && invCount <= 1) ? 0.05 : 0);
  const pacingPressure = (legendOverdue ? 0.12 : 0) + (transOverdue ? 0.16 : 0) + ((goalTier >= 5 && hasNeed && curDay <= 2) ? 0.04 : 0);
  const baseChance = Math.min(0.98, droneBaseChance + droneUrgency + pacingPressure + perkChanceBonus);
  if (Math.random() >= baseChance) return null;

  const pool = [];
  function isSpecialName(name) {
    const kind = classifySpecialByName(name);
    return kind === 'vf' || isSpecialCoreKind(kind);
  };

  // 1) droneOffers(있으면)에서 뽑기: 특수 재료(운석/생나/미스릴/포스코어/VF)는 제외
  if (Array.isArray(droneOffers) && droneOffers.length) {
    for (const offer of droneOffers) {
      const price = applyDroneCost(Math.max(0, Number(offer?.price ?? offer?.cost ?? 0)));
      const itemId = String(offer?.itemId ?? offer?.item?._id ?? '');
      const item = offer?.item || (itemId ? items.find((x) => String(x?._id) === itemId) : null);
      if (!itemId || !item) continue;

      const nm = String(item?.name || '');
      if (isSpecialName(nm)) continue;
      if (credits < price) continue;

      let weight = Math.max(1, Number(offer?.weight ?? 1));

      // 목표에 필요한 재료면 가중치 크게
      const mul = Math.max(1, Number(dm?.needWeightMul ?? 8));
      if (hasNeed && String(itemId) === String(needId)) weight *= (mul + (legendOverdue ? 4 : 0) + (transOverdue ? 6 : 0));

      pool.push({ kind: 'offer', offerId: offer?.offerId ?? offer?._id ?? null, item, itemId, price, weight });
    }
  }

  // 1-1) 목표 재료가 있는데, offer에 없거나(혹은 전부 비쌈) pool이 비었으면 fallback로 해당 아이템을 직접 구매하는 형태(가격 고정)
  if (hasNeed && !pool.some((p) => String(p?.itemId) === String(needId))) {
    const it = items.find((x) => String(x?._id) === String(needId));
    const nfPrice = applyDroneCost(Math.max(0, Number(dm?.needFallbackPrice ?? 10)));
    if (it && !isSpecialName(it?.name) && credits >= nfPrice) {
      const w = Math.max(1, Number(dm?.needFallbackWeight ?? 5));
      pool.push({ kind: 'needFallback', offerId: null, item: it, itemId: String(it._id), price: nfPrice, weight: w });
    }
  }

  // 2) fallback: 공용 아이템 중 하급 재료 느낌(가격 고정)에서 뽑기
  if (!pool.length && items.length) {
    const fallbackKeywords = Array.isArray(dm?.fallbackKeywords) ? dm.fallbackKeywords : ['천', '가죽', '철', '돌', '나뭇', 'wood', 'leather', 'fabric', 'iron', 'stone'];
    for (const it of items) {
      const name = String(it?.name || '');
      if (!name) continue;
      if (isSpecialName(name)) continue;

      const low = name.toLowerCase();
      const ok = fallbackKeywords.some((k) => low.includes(String(k).toLowerCase()));
      if (!ok) continue;

      const price = applyDroneCost(Math.max(0, Number(dm?.price ?? 10)));
      if (credits >= price) {
        pool.push({ kind: 'fallback', offerId: null, item: it, itemId: String(it._id), price, weight: 1 });
      }
    }
  }

  if (!pool.length) return null;
  const picked = pickWeighted(pool);
  if (!picked?.itemId) return null;

  const qty = 1;
  return {
    kind: 'drone',
    offerId: picked.offerId,
    item: picked.item,
    itemId: String(picked.itemId),
    qty,
    cost: Math.max(0, Number(picked.price || 0)),
  };
}

export {
  chooseAiMoveTargets,
  pickMissingBasicItemId,
  rollKioskInteraction,
  lowestEquippedTier,
  rollDroneOrder,
};
