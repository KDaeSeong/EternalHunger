// client/src/utils/eventLogic.js
// ER-style micro action generator used when the second-by-second simulation
// needs a small solo action between route, object, wildlife, and combat logic.
import { makeRegenEffect, makeShieldEffect, makeStatBuffEffect } from './statusLogic';

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function randInt(min, max) {
  const a = Math.ceil(Number(min) || 0);
  const b = Math.floor(Number(max) || a);
  return a + Math.floor(Math.random() * (b - a + 1));
}

function pickWeighted(list) {
  const rows = (Array.isArray(list) ? list : []).filter(Boolean);
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row?.weight ?? row?.w ?? 1)), 0);
  if (total <= 0) return rows[0] || null;
  let roll = Math.random() * total;
  for (const row of rows) {
    roll -= Math.max(0, Number(row?.weight ?? row?.w ?? 1));
    if (roll <= 0) return row;
  }
  return rows[rows.length - 1] || null;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function safeTags(item) {
  return Array.isArray(item?.tags) ? item.tags.map((x) => String(x || '').toLowerCase()) : [];
}

function readStat(actor, names) {
  const stats = actor?.stats && typeof actor.stats === 'object' ? actor.stats : {};
  for (const name of names) {
    const direct = Number(actor?.[name]);
    if (Number.isFinite(direct)) return direct;
    const v = Number(stats?.[name] ?? stats?.[String(name).toLowerCase()]);
    if (Number.isFinite(v)) return v;
  }
  return 0;
}

function roughPower(actor) {
  const str = readStat(actor, ['STR', 'str']);
  const agi = readStat(actor, ['AGI', 'agi']);
  const sht = readStat(actor, ['SHT', 'sht', 'SHOOT', 'shoot']);
  const end = readStat(actor, ['END', 'end']);
  const men = readStat(actor, ['MEN', 'men']);
  const dex = readStat(actor, ['DEX', 'dex']);
  return str + agi + sht + end * 0.8 + men * 0.45 + dex * 0.35;
}

function inferItemCategory(item) {
  const tags = safeTags(item);
  const type = normalizeText(item?.type).toLowerCase();
  const category = normalizeText(item?.category).toLowerCase();
  const name = normalizeText(item?.name).toLowerCase();
  const equipSlot = normalizeText(item?.equipSlot);

  if (equipSlot) return 'equipment';
  if (category.includes('material') || type.includes('material') || tags.includes('material') || tags.includes('basic')) return 'material';
  if (
    category.includes('food') ||
    type.includes('food') ||
    type.includes('consumable') ||
    tags.includes('food') ||
    tags.includes('drink') ||
    tags.includes('healthy') ||
    tags.includes('heal') ||
    tags.includes('medical') ||
    name.includes('빵') ||
    name.includes('물') ||
    name.includes('스테이크') ||
    name.includes('치킨') ||
    name.includes('초콜릿') ||
    name.includes('붕대')
  ) {
    return 'consumable';
  }
  return 'misc';
}

function itemTier(item) {
  return clamp(item?.tier ?? item?.grade ?? 1, 1, 9);
}

function itemRarity(item) {
  return normalizeText(item?.rarity || item?.gradeName).toLowerCase();
}

function isSpecialMaterial(item) {
  const name = normalizeText(item?.name).toLowerCase();
  const key = normalizeText(item?.key || item?.itemKey || item?.code).toLowerCase();
  return (
    name.includes('운석') ||
    name.includes('생명의 나무') ||
    name.includes('미스릴') ||
    name.includes('포스 코어') ||
    name.includes('vf') ||
    key.includes('meteor') ||
    key.includes('life_tree') ||
    key.includes('mithril') ||
    key.includes('force_core') ||
    key.includes('vf')
  );
}

function findItems(publicItems, predicate) {
  return (Array.isArray(publicItems) ? publicItems : []).filter((item) => item && item._id && predicate(item));
}

function pickRouteMaterial(publicItems, actor) {
  const goalIds = new Set(
    [
      ...(Array.isArray(actor?.routeMissingItemIds) ? actor.routeMissingItemIds : []),
      ...(Array.isArray(actor?.missingItemIds) ? actor.missingItemIds : []),
    ].map((x) => String(x || '')).filter(Boolean)
  );
  const materials = findItems(publicItems, (item) => {
    if (inferItemCategory(item) !== 'material') return false;
    if (isSpecialMaterial(item)) return false;
    return itemTier(item) <= 2;
  });
  if (!materials.length) return null;

  const weighted = materials.map((item) => {
    let weight = 1;
    if (goalIds.has(String(item._id))) weight += 7;
    if (itemTier(item) === 1) weight += 1.4;
    if (itemRarity(item) === 'common') weight += 0.5;
    return { item, weight };
  });
  return pickWeighted(weighted)?.item || materials[0];
}

function pickFood(publicItems) {
  const foods = findItems(publicItems, (item) => {
    if (inferItemCategory(item) !== 'consumable') return false;
    const tags = safeTags(item);
    const name = normalizeText(item?.name).toLowerCase();
    if (tags.includes('medical') || name.includes('붕대')) return false;
    return tags.includes('food') || tags.includes('drink') || name.includes('빵') || name.includes('물') || name.includes('스테이크') || name.includes('치킨');
  });
  if (!foods.length) return null;
  return pickWeighted(foods.map((item) => ({ item, weight: itemTier(item) + (safeTags(item).includes('food') ? 1 : 0) })))?.item || foods[0];
}

function pickMedical(publicItems) {
  const meds = findItems(publicItems, (item) => {
    if (inferItemCategory(item) !== 'consumable') return false;
    const tags = safeTags(item);
    const name = normalizeText(item?.name).toLowerCase();
    return tags.includes('medical') || tags.includes('heal') || name.includes('붕대') || name.includes('응급');
  });
  if (!meds.length) return null;
  return meds[Math.floor(Math.random() * meds.length)] || null;
}

function phaseKind(day, phase) {
  const d = Math.max(1, Number(day || 1));
  const p = String(phase || 'morning') === 'night' ? 'night' : 'day';
  if (d <= 1) return p === 'day' ? 'early_route' : 'early_wildlife';
  if (d === 2) return p === 'day' ? 'object_setup' : 'alpha_timing';
  if (d === 3) return p === 'day' ? 'mid_object' : 'omega_timing';
  if (d === 4) return p === 'day' ? 'legendary_upgrade' : 'weakline_timing';
  if (d <= 6) return 'late_rotation';
  return 'final_zone';
}

function hpPercent(actor) {
  const maxHp = clamp(actor?.maxHp ?? 100, 1, 9999);
  const hp = clamp(actor?.hp ?? maxHp, 0, maxHp);
  return (hp / maxHp) * 100;
}

function inventoryPressure(actor) {
  const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const max = Number(actor?.inventoryLimit || actor?.bagLimit || 10);
  if (!Number.isFinite(max) || max <= 0) return 0;
  return clamp(inv.length / max, 0, 1);
}

function zoneLabel(actor) {
  return normalizeText(actor?.zoneName || actor?.zone || actor?.zoneId || '현재 구역');
}

function silentResult() {
  return { silent: true, log: '', damage: 0, recovery: 0, drop: null };
}

function buildActionPool(actor, day, phase, opts) {
  const kind = phaseKind(day, phase);
  const hpPct = hpPercent(actor);
  const invPressure = inventoryPressure(actor);
  const farmFocus = opts?.farmFocus === true;
  const power = roughPower(actor);
  const lowHp = hpPct < 52;
  const veryLowHp = hpPct < 32;
  const fullInv = invPressure >= 0.9;

  const earlyRouteWeight = kind === 'early_route' ? 7 : 1.2;
  const objectWeight = ['object_setup', 'alpha_timing', 'mid_object', 'omega_timing', 'weakline_timing'].includes(kind) ? 3.6 : 0.9;
  const combatPrepWeight = ['late_rotation', 'final_zone'].includes(kind) ? 3.8 : 1.2;

  return [
    { key: 'route_material', weight: (farmFocus ? 6 : earlyRouteWeight) * (fullInv ? 0.25 : 1) },
    { key: 'food_supply', weight: (farmFocus ? 2.8 : 1.5) * (fullInv ? 0.35 : 1) + (hpPct < 75 ? 0.9 : 0) },
    { key: 'medical_reset', weight: (lowHp ? 5.5 : 0.9) + (veryLowHp ? 3 : 0) },
    { key: 'vision_control', weight: objectWeight + (phase === 'night' ? 0.8 : 0) },
    { key: 'wildlife_track', weight: (kind === 'early_wildlife' ? 5.2 : 1.7) + Math.min(1.8, power / 80) },
    { key: 'object_hold', weight: objectWeight + (kind.includes('timing') ? 1.4 : 0) },
    { key: 'combat_reposition', weight: combatPrepWeight + (hpPct < 65 ? 1.1 : 0) },
    { key: 'inventory_tune', weight: fullInv ? 5 : 0.7 },
    { key: 'quiet_rotation', weight: 1.1 + (phase === 'night' ? 0.9 : 0) },
    { key: 'silent', weight: 3.8 },
  ];
}

function routeMaterialAction(actor, publicItems, day) {
  const item = pickRouteMaterial(publicItems, actor);
  if (!item?._id) {
    return {
      log: `🧭 [${actor.name}] ${zoneLabel(actor)} 루트 상자를 훑었지만 필요한 재료가 없었습니다.`,
      pvpBonusNext: 0.04,
    };
  }
  return {
    log: `🧭 [${actor.name}] ${zoneLabel(actor)} 루트 파밍: [${item.name}] x1 확보`,
    drop: { item, itemId: String(item._id), qty: 1 },
    pvpBonusNext: day <= 1 ? 0.04 : 0.08,
  };
}

function foodSupplyAction(actor, publicItems) {
  const item = pickFood(publicItems);
  if (!item?._id) {
    return {
      log: `🍱 [${actor.name}] 식량 동선을 점검했지만 바로 챙길 음식은 없었습니다.`,
      newEffects: [makeStatBuffEffect('집중', { men: 1 }, 20, 'micro_food_scan', { tags: ['positive', 'focus'] })],
    };
  }
  return {
    log: `🍱 [${actor.name}] 보급 상자에서 [${item.name}] x1을 챙겼습니다.`,
    drop: { item, itemId: String(item._id), qty: 1 },
    newEffects: [makeStatBuffEffect('집중', { men: 1, end: 1 }, 20, 'micro_food_supply', { tags: ['positive', 'food', 'focus'] })],
    pvpBonusNext: 0.06,
  };
}

function medicalResetAction(actor, publicItems) {
  const item = pickMedical(publicItems);
  const missingHp = Math.max(0, Number(actor?.maxHp || 100) - Number(actor?.hp || 0));
  const recovery = clamp(Math.floor(Math.min(16, missingHp * 0.28) + randInt(4, 8)), 4, 18);
  const effects = [
    makeRegenEffect(4, 30, 'micro_medical_reset'),
    makeShieldEffect(5, 20, 'micro_medical_guard'),
  ];

  if (item?._id) {
    return {
      log: `🚑 [${actor.name}] 응급 키트를 확보하고 전투 복귀 준비를 마쳤습니다. ([${item.name}] x1)`,
      recovery,
      drop: { item, itemId: String(item._id), qty: 1 },
      newEffects: effects,
    };
  }
  return {
    log: `🚑 [${actor.name}] 안전한 엄폐 지점에서 빠르게 응급 정비했습니다. (HP +${recovery})`,
    recovery,
    newEffects: effects,
  };
}

function visionControlAction(actor, day, phase) {
  const isNight = phase === 'night';
  const credits = day >= 2 ? randInt(1, 3) : 0;
  return {
    log: `📡 [${actor.name}] ${zoneLabel(actor)} 시야를 장악하고 ${isNight ? '야간 오브젝트 동선' : '다음 오브젝트 진입로'}를 확인했습니다.${credits ? ` (크레딧 +${credits})` : ''}`,
    earnedCredits: credits,
    newEffects: [makeStatBuffEffect('시야 확보', { dex: 1, men: 1 }, 30, 'micro_vision_control', { tags: ['positive', 'vision'] })],
    pvpBonusNext: 0.12,
  };
}

function wildlifeTrackAction(actor, day, phase) {
  const isBearWindow = day >= 1 && phase === 'night';
  const isMutantWindow = day >= 2;
  const credits = randInt(isMutantWindow ? 3 : 1, isMutantWindow ? 7 : 4);
  const damage = clamp(randInt(1, 4) - Math.floor(roughPower(actor) / 75), 0, 5);
  const target = isMutantWindow ? '변이 야생동물' : isBearWindow ? '곰/늑대 캠프' : '닭/박쥐 캠프';
  return {
    log: `🐺 [${actor.name}] ${target}를 추적해 숙련도와 크레딧을 챙겼습니다.${damage ? ` (피해 -${damage})` : ''} (크레딧 +${credits})`,
    damage,
    earnedCredits: credits,
    newEffects: [makeStatBuffEffect('사냥 리듬', { agi: 1, sht: 1 }, 20, 'micro_wildlife_track', { tags: ['positive', 'wildlife'] })],
    pvpBonusNext: 0.10,
  };
}

function objectHoldAction(actor, day, phase) {
  const objectName = day >= 4 && phase === 'night'
    ? '위클라인'
    : day >= 3 && phase === 'night'
      ? '오메가'
      : day >= 2 && phase === 'night'
        ? '알파'
        : '운석/생명의 나무';
  return {
    log: `🎯 [${actor.name}] ${objectName} 타이밍을 보고 진입 각을 잡았습니다.`,
    newEffects: [makeShieldEffect(4, 20, 'micro_object_hold'), makeStatBuffEffect('교전 준비', { men: 1, dex: 1 }, 30, 'micro_object_focus', { tags: ['positive', 'object'] })],
    pvpBonusNext: 0.18,
  };
}

function combatRepositionAction(actor, day) {
  const hpPct = hpPercent(actor);
  const credits = day >= 5 ? randInt(1, 2) : 0;
  return {
    log: `🏃 [${actor.name}] 교전 소음을 피해 포지션을 다시 잡았습니다.${hpPct < 55 ? ' 체력이 낮아 전면전은 피합니다.' : ''}${credits ? ` (크레딧 +${credits})` : ''}`,
    earnedCredits: credits,
    newEffects: [makeStatBuffEffect('가속', { agi: 1 }, 20, 'micro_combat_reposition', { tags: ['positive', 'move'] })],
    pvpBonusNext: hpPct < 55 ? 0.04 : 0.12,
  };
}

function inventoryTuneAction(actor) {
  const credits = randInt(1, 4);
  return {
    log: `🎒 [${actor.name}] 가방을 정리해 루트 재료 우선순위를 다시 잡았습니다. (크레딧 +${credits})`,
    earnedCredits: credits,
    newEffects: [makeStatBuffEffect('정리 완료', { dex: 1 }, 20, 'micro_inventory_tune', { tags: ['positive', 'inventory'] })],
  };
}

function quietRotationAction(actor, phase) {
  return {
    log: `🧭 [${actor.name}] ${phase === 'night' ? '야간' : '낮'} 로테이션을 조용히 이어가며 위험 구역을 피했습니다.`,
    newEffects: [makeShieldEffect(3, 20, 'micro_quiet_rotation')],
    pvpBonusNext: 0.05,
  };
}

export function generateDynamicEvent(char, currentDay, ruleset, currentPhase = 'morning', publicItems = [], opts = {}) {
  const actor = { ...(char || {}), name: normalizeText(char?.name || '생존자') };
  const day = Math.max(1, Math.floor(Number(currentDay || 1)));
  const phase = String(currentPhase || 'morning') === 'night' ? 'night' : 'morning';
  const picked = pickWeighted(buildActionPool(actor, day, phase, opts));
  const action = picked?.key || 'silent';

  if (action === 'silent') return silentResult();
  if (action === 'route_material') return routeMaterialAction(actor, publicItems, day, ruleset);
  if (action === 'food_supply') return foodSupplyAction(actor, publicItems, day, ruleset);
  if (action === 'medical_reset') return medicalResetAction(actor, publicItems, ruleset);
  if (action === 'vision_control') return visionControlAction(actor, day, phase, ruleset);
  if (action === 'wildlife_track') return wildlifeTrackAction(actor, day, phase, ruleset);
  if (action === 'object_hold') return objectHoldAction(actor, day, phase, ruleset);
  if (action === 'combat_reposition') return combatRepositionAction(actor, day, phase, ruleset);
  if (action === 'inventory_tune') return inventoryTuneAction(actor, ruleset);
  if (action === 'quiet_rotation') return quietRotationAction(actor, phase, ruleset);

  return silentResult();
}
