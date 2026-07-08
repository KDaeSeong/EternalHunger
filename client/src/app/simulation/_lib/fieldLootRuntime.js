import {
  clampTier4,
  pickWeighted,
  randInt,
  safeTags,
} from './simulationCommon';
import { isAtOrAfterWorldTime } from './worldTime';
import {
  applyPerkLootWeight,
  getPerkLootBias,
} from './perkRuntime';
import {
  inferItemCategory,
  markInventoryGoalItem,
} from './inventoryRules';
import { classifySpecialByName } from './craftRuntime';
import {
  getLegendaryCoreCandidates,
  resolveLegendaryDropWeights,
} from './legendaryRuntime';
import { pickRegionLootDrop } from './lumiaRegionData';
import { getLumiaZoneSearchDensityWeight } from './lumiaMapGeometryRuntime';
import { isItemExcludedFromFieldFarming } from '../../../utils/erItemFilters';
import { rollTranscendPickOptions } from './fieldTranscendLootRuntime';
import { rollEarlyRouteLoot } from './fieldRouteLootRuntime';

function clampDropTier(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(6, Math.floor(n)));
}

function rollFieldLoot(mapObj, zoneId, publicItems, ruleset, opts = {}) {
  const crates = Array.isArray(mapObj?.itemCrates) ? mapObj.itemCrates : [];
  const list = Array.isArray(publicItems) ? publicItems : [];
  const perkLootBias = getPerkLootBias(opts?.perkEffects || {});
  const goalItemIds = new Set(
    (Array.isArray(opts?.goalItemIds) ? opts.goalItemIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  );
  const routeItemIds = new Set(
    (Array.isArray(opts?.routeItemIds) ? opts.routeItemIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  );

  // 존별 상자 허용/금지(서버(DB) 저장)
  // - map.crateAllowDeny: { [zoneId]: ['legendary_material', 'transcend_pick', ...] }  // 금지 리스트
  // - legacy 호환: 서버 필드 자체가 없을 때(구버전)만 로컬 저장값을 fallback으로 사용
  const mapId = String(mapObj?._id || mapObj?.id || '');
  const hasServerCrateAllowDeny = (mapObj?.crateAllowDeny && typeof mapObj.crateAllowDeny === 'object' && !Array.isArray(mapObj.crateAllowDeny));
  let denyByZone = hasServerCrateAllowDeny ? mapObj.crateAllowDeny : {};
  if (typeof window !== 'undefined' && mapId && !hasServerCrateAllowDeny) {
    try {
      const raw = window.localStorage.getItem(`eh_map_zone_crate_rules_${mapId}`);
      const p = raw ? JSON.parse(raw) : null;
      if (p && typeof p === 'object' && !Array.isArray(p)) denyByZone = p;
    } catch {}
  }
  const deny = (denyByZone && Array.isArray(denyByZone[String(zoneId)]) ? denyByZone[String(zoneId)] : []).map((v) => String(v || '').toLowerCase());
  const isDenied = (crateTypeKey) => deny.includes(String(crateTypeKey || '').toLowerCase());

  const inZone = crates
    .filter((c) => String(c?.zoneId) === String(zoneId))
    .filter((c) => !isDenied(String(c?.crateType || 'food').toLowerCase()));

  const moved = !!opts.moved;

  // 룰셋에서 구역 상자 드랍 확률을 가져옵니다(없으면 기본값 사용)
  const field = ruleset?.drops?.fieldCrate || {};
  const fallbackMaxTier = Math.max(1, Number(field?.fallbackMaxTier ?? 2));
  const goalLootBoost = Math.max(0, Number(field?.goalLootBoost ?? 8));

  // 전설 재료 상자(필드) 게이트: 기본 2일차 밤 이후
  const curDay = Number(opts?.day ?? opts?.curDay ?? 0);
  const curPhase = String(opts?.phase ?? opts?.curPhase ?? '');
  const gate = field?.legendaryMaterialGate || field?.legendaryMaterial?.gate || null;
  const gateDay = Number(gate?.day ?? 2);
  const gateTodRaw = String(gate?.timeOfDay ?? gate?.phase ?? 'night');
  const gateTod = gateTodRaw === 'morning' ? 'day' : (gateTodRaw === 'day' ? 'day' : 'night');
  const legendEnabled = (curDay && curPhase) ? isAtOrAfterWorldTime(curDay, curPhase, gateDay, gateTod) : true;

  // 맵에 상자 데이터가 없거나(기본 구역만 적용한 경우), 현재 구역에 상자가 없으면
  // "최소 루프"가 끊기지 않도록 fallback 드랍을 허용합니다.
  // - 전설 재료 상자가 아직 열리면 안 되는 구간(게이트 이전)에서
  //   구역 상자가 전설 상자만 있는 경우도 fallback로 처리합니다.
  const legendOnly = !legendEnabled && inZone.length && inZone.every((c) => String(c?.crateType || '').toLowerCase() === 'legendary_material');
  const useFallback = !inZone.length || legendOnly;

  // 전설 재료(운석/생나/미스릴/포스코어) 드랍 가중치: ruleset(worldSpawns.legendaryCrate) 우선
  const legendDropWeights = (opts?.dropWeightsByKey && typeof opts.dropWeightsByKey === 'object')
    ? opts.dropWeightsByKey
    : ((opts?.weightsByKey && typeof opts.weightsByKey === 'object')
      ? opts.weightsByKey
      : (ruleset?.worldSpawns?.legendaryCrate?.dropWeightsByKey || null));

  const chanceBase = useFallback
    ? (moved ? Number(field?.fallbackChanceMoved ?? 0.20) : Number(field?.fallbackChanceStay ?? 0.08))
    : (moved ? Number(field?.chanceMoved ?? 0.28) : Number(field?.chanceStay ?? 0.12));
  const zoneDensityWeight = getLumiaZoneSearchDensityWeight(zoneId);
  const chance = Math.max(0.01, Math.min(0.98, (chanceBase * zoneDensityWeight) + Math.max(-0.05, Math.min(0.16, perkLootBias * 0.18))));

  const earlyRouteLoot = rollEarlyRouteLoot({
    curDay,
    curPhase,
    fallbackMaxTier,
    field,
    goalItemIds,
    list,
    moved,
    opts,
    perkLootBias,
    routeItemIds,
    zoneId,
  });
  if (earlyRouteLoot.handled) return earlyRouteLoot.loot;

  if (Math.random() >= chance) return null;

  // 1) 구역 상자 기반 드랍(맵에 crateType이 있으면 사용, 없으면 food)
  if (!useFallback) {
    const usable = legendEnabled ? inZone : inZone.filter((c) => String(c?.crateType || '').toLowerCase() !== 'legendary_material');
    if (!usable.length) return null;
    const crate = usable[Math.floor(Math.random() * usable.length)];
    const crateType = String(crate?.crateType || 'food');
    const ctLower = String(crateType).toLowerCase();

    // 전설 재료 상자라면: 룰셋 dropWeightsByKey 기준으로 운석/생나/미스릴/포스코어를 굴립니다.
    if (ctLower === 'legendary_material') {
      const legendaryWeights = resolveLegendaryDropWeights(opts, opts?.ruleset || null);
      const candidates = getLegendaryCoreCandidates(publicItems, legendaryWeights);
      const picked = pickWeighted(candidates);
      const item = picked?.item || null;
      if (item?._id) {
        return { item, itemId: String(item._id), qty: 1, crateId: crate?.crateId || '', crateType, zoneId: String(zoneId || '') };
      }
      // 후보를 찾지 못하면, 맵 lootTable로 fallback(있는 경우)
    }

    // 초월 장비 선택 상자라면: 아이템을 바로 주지 않고 후보를 반환합니다.
    const transWorldOnly = opts?.ruleset?.worldSpawns?.transcendCrate?.worldOnly !== false;
    if (ctLower === 'transcend_pick' && !transWorldOnly) {
      const optCount = Math.max(2, Math.min(3, Number(ruleset?.drops?.crateTypes?.transcend_pick?.optionsCount ?? 3)));
      const options = rollTranscendPickOptions(publicItems, optCount);
      if (!options.length) return null;
      return { item: null, itemId: '', qty: 1, crateId: crate?.crateId || '', crateType, options, zoneId: String(zoneId || '') };
    }

    const weightedLootTable = (Array.isArray(crate?.lootTable) ? crate.lootTable : []).map((entry) => {
      const itemId = String(entry?.itemId || '');
      const item = (Array.isArray(publicItems) ? publicItems : []).find((it) => String(it?._id) === itemId) || null;
      if (isItemExcludedFromFieldFarming(item)) return null;
      const special = classifySpecialByName(item?.name);
      const isEquip = inferItemCategory(item) === 'equipment';
      const baseWeight = Number(entry?.weight || 1) + (goalItemIds.has(itemId) ? goalLootBoost : 0);
      const weight = applyPerkLootWeight(baseWeight, opts?.perkEffects || {}, { rareBoost: special ? 0.7 : (isEquip ? 0.35 : 0) });
      return { ...entry, _item: item, weight };
    }).filter(Boolean);
    const entry = pickWeighted(weightedLootTable);
    if (!entry?.itemId) return null;

    const itemId = String(entry.itemId);
    const item = entry?._item || (Array.isArray(publicItems) ? publicItems : []).find((it) => String(it?._id) === itemId) || null;
    let qty = Math.max(1, randInt(entry?.minQty ?? 1, entry?.maxQty ?? 1));
    const itemCat = inferItemCategory(item);
    if ((itemCat === 'material' || itemCat === 'consumable') && Math.random() < Math.max(0, perkLootBias) * 0.45) {
      qty += 1;
    }

    return { item: markInventoryGoalItem(item, goalItemIds.has(itemId)), itemId, qty, crateId: crate?.crateId || '', crateType, zoneId: String(zoneId || '') };
  }

  // 2) fallback: 음식 상자 / 전설 재료 상자 / 초월 장비 선택 상자
  const ct = ruleset?.drops?.crateTypes || {};
  const wFood0 = Math.max(0, Number(ct?.food?.weight ?? ct?.food ?? 80));
  const wLegendBase0 = Number(field?.legendaryMaterialWeight ?? field?.legendaryMaterial?.weight ?? ct?.legendary_material?.weight ?? ct?.legendary_material ?? 15);
  const wLegend0 = legendEnabled ? Math.max(0, wLegendBase0) : 0;
  const transWorldOnly = opts?.ruleset?.worldSpawns?.transcendCrate?.worldOnly !== false;
  const wTrans0 = transWorldOnly ? 0 : Math.max(0, Number(ct?.transcend_pick?.weight ?? ct?.transcend_pick ?? 5));

  // 존 금지 타입은 fallback에서도 0 처리
  const rareCrateBonus = Math.max(0, perkLootBias);
  const wFood = isDenied('food') ? 0 : applyPerkLootWeight(wFood0, opts?.perkEffects || {}, { rareBoost: 0 });
  const wLegend = isDenied('legendary_material') ? 0 : applyPerkLootWeight(wLegend0, opts?.perkEffects || {}, { rareBoost: 0.5 + rareCrateBonus * 0.5 });
  const wTrans = isDenied('transcend_pick') ? 0 : applyPerkLootWeight(wTrans0, opts?.perkEffects || {}, { rareBoost: 0.4 + rareCrateBonus * 0.4 });

  const typeCandidates = [
    { item: 'food', weight: wFood },
    { item: 'legendary_material', weight: wLegend },
    { item: 'transcend_pick', weight: wTrans },
  ].filter((x) => Number(x?.weight || 0) > 0);

  if (!typeCandidates.length) return null;
  const pickedType = pickWeighted(typeCandidates)?.item || null;
  if (!pickedType) return null;

  if (pickedType === 'legendary_material') {
    const legendaryWeights = resolveLegendaryDropWeights(opts, opts?.ruleset || null);
    const candidates = getLegendaryCoreCandidates(publicItems, legendaryWeights);
    const picked = pickWeighted(candidates);
    const item = picked?.item || null;
    if (item?._id) return { item, itemId: String(item._id), qty: 1, crateId: 'fallback', crateType: 'legendary_material', zoneId: String(zoneId || '') };
  }

  if (pickedType === 'transcend_pick') {
    const optCount = Math.max(2, Math.min(3, Number(ct?.transcend_pick?.optionsCount ?? 3)));
    const options = rollTranscendPickOptions(publicItems, optCount);
    if (options.length) return { item: null, itemId: '', qty: 1, crateId: 'fallback', crateType: 'transcend_pick', options, zoneId: String(zoneId || '') };
  }

  const isDay1 = Number(curDay || 0) === 1;
  const regionDrop = pickRegionLootDrop(zoneId, publicItems, {
    crateType: 'region_loot',
    goalItemIds: [...goalItemIds],
    routeItemIds: [...routeItemIds],
    maxQty: isDay1 ? 2 : 1,
    filterItem: (it) => {
      if (!it?._id) return false;
      if (isItemExcludedFromFieldFarming(it)) return false;
      if (classifySpecialByName(it?.name)) return false;
      const tier = clampTier4(it?.tier || 1);
      const cat = inferItemCategory(it);
      if (cat === 'material') return tier <= fallbackMaxTier;
      if (cat === 'equipment') return tier <= 2;
      if (cat === 'consumable') return true;
      return false;
    },
  });
  if (regionDrop?.itemId) {
    return {
      ...regionDrop,
      item: markInventoryGoalItem(regionDrop.item, goalItemIds.has(String(regionDrop.itemId))),
    };
  }

  // food crate: 하급 재료 + 소모품(치유/음식)
  const pool = [];
  for (const it of list) {
    if (!it?._id) continue;
    if (isItemExcludedFromFieldFarming(it)) continue;
    const tier = clampTier4(it?.tier || 1);
    const cat = inferItemCategory(it);

    // 특수 재료는 food crate에선 제외(전설 재료 상자에서)
    const sp = classifySpecialByName(it?.name);
    if (sp) continue;

    if (cat === 'material') {
      if (tier > fallbackMaxTier) continue;

      const nm = String(it?.name || '').toLowerCase();
      const v = Number(it?.baseCreditValue ?? it?.value ?? 0);

      let w = 1;
      if (tier <= 1) w += 2;
      if (v > 0 && v <= 40) w += 1;
      if (nm.includes('천') || nm.includes('가죽') || nm.includes('돌') || nm.includes('나무') || nm.includes('철') || nm.includes('부품')) w += 1;

      // 1일차에는 하급 재료가 잘 보이게 하되, 장비를 직접 완성시키는 묶음 지급은 피합니다.
      const minQty = 1;
      const maxQty = (isDay1 && tier <= 1) ? 2 : 1;
      if (isDay1 && tier <= 1) w += 2; // 하급 재료 우선

      if (goalItemIds.has(String(it._id))) w += goalLootBoost;
      pool.push({ itemId: String(it._id), weight: applyPerkLootWeight(w, opts?.perkEffects || {}, { rareBoost: tier >= 2 ? 0.15 : 0 }), minQty, maxQty });
      continue;
    }

    if (cat === 'consumable') {
      const tags = safeTags(it);
      const t = String(it?.type || '').toLowerCase();
      const name = String(it?.name || it?.text || '').toLowerCase();
      // 음식 위주. 상태이상 회복/의료 아이템은 음식 상자 후보가 아니다.
      if (t === 'food' || tags.includes('food') || tags.includes('healthy') || name.includes('사과') || name.includes('apple') || name.includes('스테이크') || name.includes('steak')) {
        pool.push({ itemId: String(it._id), weight: applyPerkLootWeight(2, opts?.perkEffects || {}, { rareBoost: tags.includes('healthy') ? 0.1 : 0 }), minQty: 1, maxQty: 1 });
      }
    }
  }

  const entry = pickWeighted(pool);
  if (!entry?.itemId) return null;

  const itemId = String(entry.itemId);
  const item = list.find((it) => String(it?._id) === itemId) || null;
  let qty = Math.max(1, randInt(entry?.minQty ?? 1, entry?.maxQty ?? 1));
  if (Math.random() < Math.max(0, perkLootBias) * 0.45) qty += 1;
  return { item: markInventoryGoalItem(item, goalItemIds.has(itemId)), itemId, qty, crateId: 'fallback', crateType: 'food', zoneId: String(zoneId || '') };
}

export {
  rollFieldLoot,
};
export {
  pickAutoTranscendOption,
  rollTranscendPickOptions,
} from './fieldTranscendLootRuntime';
