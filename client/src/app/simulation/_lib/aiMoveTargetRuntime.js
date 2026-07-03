import {
  hash32,
} from './simulationCommon';
import { isAtOrAfterWorldTime } from './worldTime';
import {
  canUseKioskAtWorldTime,
} from './marketRuntime';
import {
  listKioskZoneIdsForMap,
  uniqStrings,
} from './mapTargeting';
import {
  classifySpecialByName,
} from './craftRuntime';
import { pickGoalResourceZoneTargets } from './resourceTargetingRuntime';
import {
  actorHasSpecialKind,
  markObjectiveTarget,
  scoreWildlifeZoneForActor,
} from './aiMoveTargetScoringRuntime';

export function chooseAiMoveTargets({ actor, craftGoal, upgradeNeed, mapObj, spawnState, forbiddenIds, day, phase, kiosks, itemMetaById = null, itemNameById = null }) {
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
  const shouldDeferVfForLegend = Number(up?.goalTier || 0) >= 6 && Math.max(0, Number(up?.minTier || 0)) < 5;
  const hasLegendMatAny = !!up?.hasLegendMatAny;
  const hasVfAny = !!up?.hasVf;
  const farmCredits = !!up?.farmCredits;
  const spendSurplus = !!up?.spendSurplus;

  const legendCost = Math.max(0, Number(up?.legendCost ?? 200));
  const mithrilCost = Math.max(0, Number(up?.mithrilCost ?? 250));
  const forceCost = Math.max(0, Number(up?.forceCost ?? 350));
  const transCost = Math.max(0, Number(up?.transCost ?? 500));

  const needKeys = new Set(
    miss
      .map((m) => String(m?.special || classifySpecialByName(m?.name) || ''))
      .filter(Boolean)
  );

  const needVf = (needKeys.has('vf') && !shouldDeferVfForLegend) || (wantTransAny && !hasVfAny);
  const needMeteor = needKeys.has('meteor');
  const needLife = needKeys.has('life_tree');
  const needMithril = needKeys.has('mithril');
  const needForce = needKeys.has('force_core');
  const hasMeteorInv = actorHasSpecialKind(actor, 'meteor', itemMetaById, itemNameById);
  const hasLifeInv = actorHasSpecialKind(actor, 'life_tree', itemMetaById, itemNameById);

  if (kioskZones.length) {
    if (needVf && isAtOrAfterWorldTime(day, phase, 4, 'day') && simCredits >= transCost) {
      result.targets = kioskZones;
      result.reason = 'VF(키오스크 구매)';
      return result;
    }

    const neededLegendCost = needForce
      ? ((hasMeteorInv || hasLifeInv) ? legendCost : forceCost)
      : needMithril
        ? mithrilCost
        : legendCost;
    if ((needMeteor || needLife || needMithril || needForce) && canUseKioskAtWorldTime(day, phase) && simCredits >= neededLegendCost) {
      result.targets = kioskZones;
      result.reason = needForce ? '포스코어(키오스크 구매)' : '전설 재료(키오스크 구매)';
      return result;
    }

    if (!shouldDeferVfForLegend && wantTransAny && !hasVfAny && isAtOrAfterWorldTime(day, phase, 4, 'day') && simCredits >= transCost) {
      result.targets = kioskZones;
      result.reason = '초월 목표 VF 구매';
      return result;
    }

    if (wantLegendAny && !hasLegendMatAny && canUseKioskAtWorldTime(day, phase) && simCredits >= Math.min(legendCost, mithrilCost, forceCost)) {
      result.targets = kioskZones;
      result.reason = '전설 목표 재료 구매';
      return result;
    }
  }

  if (wantTransAny && !shouldDeferVfForLegend) {
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

  if (spendSurplus && canUseKioskAtWorldTime(day, phase) && kioskZones.length && simCredits >= Math.min(legendCost, transCost || legendCost)) {
    result.targets = kioskZones;
    result.reason = 'surplus credits kiosk';
    return result;
  }

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

    if (canUseKioskAtWorldTime(day, phase) && kioskZones.length && simCredits >= legendCost) {
      result.targets = kioskZones;
      result.reason = '특수 재료(키오스크)';
      return result;
    }
  }

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

  if (hasGoal) {
    const zonesForGoal = pickGoalResourceZoneTargets(mapObj, s, forbiddenIds, miss, itemMetaById, itemNameById);
    if (zonesForGoal.length) {
      result.targets = zonesForGoal;
      result.reason = '재료 파밍(목표)';
      return result;
    }
  }

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
