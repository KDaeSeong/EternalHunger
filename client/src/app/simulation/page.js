'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { AUTH_SYNC_EVENT, INIT_API_TIMEOUT_MS, apiGet, apiPost, apiPut, clearAuth, getApiBase, getToken, getUser, updateStoredUser } from '../../utils/api';
import { LEGACY_HOF_KEY, emitHallOfFameSync, writeHallOfFameState } from '../../utils/hallOfFame';
import { calculateBattle } from '../../utils/battleLogic';
import { generateDynamicEvent } from '../../utils/eventLogic';
import {
  EFFECT_BLEED,
  EFFECT_BURN,
  EFFECT_FOOD_POISON,
  EFFECT_POISON,
  EFFECT_REGEN,
  EFFECT_SHIELD,
  absorbShieldDamage,
  addOrRefreshEffect,
  getRegenValue,
  getShieldValue,
  normalizeStatusEffectList,
  purgeNegativeEffects,
  updateEffects,
} from '../../utils/statusLogic';
import { applyItemEffect } from '../../utils/itemLogic';
import { createEquipmentItem, normalizeWeaponType } from '../../utils/equipmentCatalog';
import { getRuleset, getPhaseDurationSec, getFogLocalTimeSec } from '../../utils/rulesets';
import { buildTacStatusEffects, getTacBaseCdSec, getTacEffectNumber, getTacTrigger } from './tacticalSkillTable';
import '../../styles/ERSimulation.css';

function safeTags(item) {
  return Array.isArray(item?.tags) ? item.tags : [];
}

function itemDisplayName(item) {
  return item?.name || item?.text || item?.itemId?.name || '알 수 없는 아이템';
}

function resolveRewardDropEntry(entry, publicItems, itemNameById) {
  const raw = entry && typeof entry === 'object' ? entry : null;
  if (!raw) return null;
  const rawItem = raw?.item && typeof raw.item === 'object' ? raw.item : null;
  const itemId = String(raw?.itemId || raw?.id || raw?._id || rawItem?._id || '');
  if (!itemId) return null;
  const catalogItem = (Array.isArray(publicItems) ? publicItems : []).find((x) => String(x?._id || '') === itemId) || null;
  const qty = Math.max(1, Number(raw?.qty || raw?.count || 1));
  return {
    itemId,
    qty,
    item: catalogItem || rawItem || {
      _id: itemId,
      name: String(raw?.name || itemNameById?.[itemId] || '아이템'),
      type: String(raw?.type || rawItem?.type || '재료'),
      tags: Array.isArray(rawItem?.tags) ? rawItem.tags : [],
    },
  };
}

function normalizeRewardDropEntries(entries, publicItems, itemNameById) {
  const rawList = Array.isArray(entries) ? entries : (entries ? [entries] : []);
  return rawList
    .map((entry) => resolveRewardDropEntry(entry, publicItems, itemNameById))
    .filter(Boolean);
}

function itemIcon(item) {
  const t = String(item?.type || '').toLowerCase();
  const tags = safeTags(item);
  if (tags.includes('heal') || tags.includes('medical')) return '🚑';
  if (tags.includes('meat')) return '🥩';
  if (String(item?.name || '').includes('치킨')) return '🍗';
  if (t === 'food' || tags.includes('food') || tags.includes('healthy')) return '🍎';
  if (t === 'weapon' || item?.type === '무기') return '⚔️';
  if (item?.type === '방어구') return '🛡️';
  return '📦';
}

const EQUIP_SLOTS = ['weapon', 'head', 'clothes', 'arm', 'shoes'];

// 시작 장비(1일차 낮): 무기 타입(요청 목록)
const START_WEAPON_TYPES = [
  '권총', '돌격소총', '돌소총', '저격총', '장갑', '톤파', '쌍절곤', '아르카나', '검', '쌍검', '망치',
  '방망이', '채찍', '투척', '암기', '활', '석궁', '도끼', '단검', '창', '레이피어',
];

const INIT_DEPENDENCY_PATHS = [
  '/characters',
  '/events',
  '/settings',
  '/user/me',
  '/public/items',
  '/public/maps',
  '/public/kiosks',
  '/public/drone-offers',
  '/public/perks',
  '/trades',
  '/trades?mine=true',
];

function normalizeUserStatistics(stats) {
  const src = stats && typeof stats === 'object' ? stats : {};
  const totalGames = Number(src?.totalGames || 0);
  const totalKills = Number(src?.totalKills || 0);
  const totalWins = Number(src?.totalWins || 0);
  return {
    totalGames: Number.isFinite(totalGames) && totalGames > 0 ? Math.floor(totalGames) : 0,
    totalKills: Number.isFinite(totalKills) && totalKills > 0 ? Math.floor(totalKills) : 0,
    totalWins: Number.isFinite(totalWins) && totalWins > 0 ? Math.floor(totalWins) : 0,
  };
}

function mergeStoredUserProgress(currentUser, patch = {}) {
  const baseUser = currentUser && typeof currentUser === 'object' ? currentUser : {};
  const next = { ...baseUser, ...patch };
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'lp')) {
    const lp = Number(patch.lp || 0);
    next.lp = Number.isFinite(lp) ? lp : Number(baseUser?.lp || 0) || 0;
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'credits')) {
    const credits = Number(patch.credits || 0);
    next.credits = Number.isFinite(credits) ? credits : Number(baseUser?.credits || 0) || 0;
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'statistics')) {
    next.statistics = normalizeUserStatistics(patch.statistics);
  } else if (baseUser?.statistics) {
    next.statistics = normalizeUserStatistics(baseUser.statistics);
  }
  return next;
}

const PERK_EFFECT_DEFAULTS = {
  hpPlus: 0,
  maxHpPlus: 0,
  startCreditsPlus: 0,
  creditsPlus: 0,
  atkPlus: 0,
  defPlus: 0,
  moveSpeedPlus: 0,
  strPlus: 0,
  agiPlus: 0,
  intPlus: 0,
  menPlus: 0,
  lukPlus: 0,
  dexPlus: 0,
  shtPlus: 0,
  endPlus: 0,
  kioskDiscountPct: 0,
  droneDiscountPct: 0,
  marketDiscountPct: 0,
  kioskChancePlus: 0,
  droneChancePlus: 0,
  craftChancePlus: 0,
  goalWeightPlus: 0,
  lootWeightPlus: 0,
  aggressionPlus: 0,
  saleBonusPct: 0,
  wildlifeCreditsPct: 0,
  wildlifeDamageMinus: 0,
  wildlifeLootPlus: 0,
  eventCreditsPct: 0,
  eventRecoveryPlus: 0,
  eventItemPlus: 0,
  bleedResistPct: 0,
  poisonResistPct: 0,
  burnResistPct: 0,
  bleedImmune: 0,
  poisonImmune: 0,
  burnImmune: 0,
  cleanseHealPlus: 0,
};

const PERK_EFFECT_ALIASES = {
  hpPlus: ['hpPlus', 'healthPlus', 'maxHpPlusFlat', 'hp_flat'],
  maxHpPlus: ['maxHpPlus', 'maxHealthPlus'],
  startCreditsPlus: ['startCreditsPlus', 'simCreditsPlus', 'startingCreditsPlus'],
  creditsPlus: ['creditsPlus'],
  atkPlus: ['atkPlus', 'attackPlus', 'attackFlat'],
  defPlus: ['defPlus', 'defensePlus', 'armorPlus'],
  moveSpeedPlus: ['moveSpeedPlus', 'movePlus', 'msPlus'],
  strPlus: ['strPlus'],
  agiPlus: ['agiPlus'],
  intPlus: ['intPlus'],
  menPlus: ['menPlus'],
  lukPlus: ['lukPlus'],
  dexPlus: ['dexPlus'],
  shtPlus: ['shtPlus'],
  endPlus: ['endPlus'],
  kioskDiscountPct: ['kioskDiscountPct', 'kioskDiscount', 'shopDiscountPct'],
  droneDiscountPct: ['droneDiscountPct', 'droneDiscount'],
  marketDiscountPct: ['marketDiscountPct', 'marketDiscount', 'discountPct'],
  kioskChancePlus: ['kioskChancePlus', 'shopChancePlus'],
  droneChancePlus: ['droneChancePlus'],
  craftChancePlus: ['craftChancePlus', 'craftBias'],
  goalWeightPlus: ['goalWeightPlus', 'goalBias', 'goalPriorityPlus'],
  lootWeightPlus: ['lootWeightPlus', 'lootBiasPlus'],
  aggressionPlus: ['aggressionPlus', 'combatAggroPlus'],
  saleBonusPct: ['saleBonusPct', 'sellBonusPct'],
  wildlifeCreditsPct: ['wildlifeCreditsPct', 'huntCreditsPct', 'animalCreditsPct'],
  wildlifeDamageMinus: ['wildlifeDamageMinus', 'huntDamageMinus', 'animalDamageMinus'],
  wildlifeLootPlus: ['wildlifeLootPlus', 'huntLootPlus', 'animalLootPlus'],
  eventCreditsPct: ['eventCreditsPct', 'scenarioCreditsPct'],
  eventRecoveryPlus: ['eventRecoveryPlus', 'scenarioRecoveryPlus'],
  eventItemPlus: ['eventItemPlus', 'scenarioItemPlus', 'eventLootPlus'],
  bleedResistPct: ['bleedResistPct', 'bleedResist', 'bleedAvoidPct'],
  poisonResistPct: ['poisonResistPct', 'poisonResist', 'poisonAvoidPct', 'foodPoisonResistPct'],
  burnResistPct: ['burnResistPct', 'burnResist', 'burnAvoidPct'],
  bleedImmune: ['bleedImmune', 'immuneBleed'],
  poisonImmune: ['poisonImmune', 'immunePoison', 'foodPoisonImmune'],
  burnImmune: ['burnImmune', 'immuneBurn'],
  cleanseHealPlus: ['cleanseHealPlus', 'cleanseRecoveryPlus', 'medicalRecoveryPlus'],
};

function perkNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizePerkPct(value) {
  const n = perkNumber(value);
  const ratio = Math.abs(n) > 1 ? (n / 100) : n;
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(-0.95, Math.min(0.95, ratio));
}

function normalizePerkEffects(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = { ...PERK_EFFECT_DEFAULTS };
  Object.entries(PERK_EFFECT_ALIASES).forEach(([targetKey, aliases]) => {
    for (const alias of aliases) {
      if (!Object.prototype.hasOwnProperty.call(src, alias)) continue;
      const value = src[alias];
      out[targetKey] = targetKey.endsWith('Pct') ? normalizePerkPct(value) : perkNumber(value);
      break;
    }
  });
  out.kioskDiscountPct = normalizePerkPct(out.kioskDiscountPct + out.marketDiscountPct);
  out.droneDiscountPct = normalizePerkPct(out.droneDiscountPct + out.marketDiscountPct);
  out.marketDiscountPct = normalizePerkPct(out.marketDiscountPct);
  out.saleBonusPct = normalizePerkPct(out.saleBonusPct);
  out.bleedResistPct = normalizePerkPct(out.bleedResistPct);
  out.poisonResistPct = normalizePerkPct(out.poisonResistPct);
  out.burnResistPct = normalizePerkPct(out.burnResistPct);
  out.bleedImmune = out.bleedImmune ? 1 : 0;
  out.poisonImmune = out.poisonImmune ? 1 : 0;
  out.burnImmune = out.burnImmune ? 1 : 0;
  return out;
}

function buildPerkRuntimeBundle(codes, perks) {
  const ownedCodes = Array.isArray(codes) ? codes.map((x) => String(x || '').trim()).filter(Boolean) : [];
  const ownedSet = new Set(ownedCodes);
  const perkDocs = (Array.isArray(perks) ? perks : []).filter((perk) => ownedSet.has(String(perk?.code || '').trim()));
  const effects = { ...PERK_EFFECT_DEFAULTS };
  perkDocs.forEach((perk) => {
    const fx = normalizePerkEffects(perk?.effects);
    Object.keys(effects).forEach((key) => {
      effects[key] += perkNumber(fx[key]);
    });
  });
  effects.kioskDiscountPct = normalizePerkPct(effects.kioskDiscountPct);
  effects.droneDiscountPct = normalizePerkPct(effects.droneDiscountPct);
  effects.marketDiscountPct = normalizePerkPct(effects.marketDiscountPct);
  effects.saleBonusPct = normalizePerkPct(effects.saleBonusPct);
  return {
    codes: ownedCodes,
    docs: perkDocs,
    effects,
    summary: perkDocs.map((perk) => String(perk?.name || perk?.code || '').trim()).filter(Boolean).join(', '),
  };
}

function getActorPerkEffects(actor) {
  return actor?._perkRuntime && typeof actor._perkRuntime === 'object' ? actor._perkRuntime : PERK_EFFECT_DEFAULTS;
}

function applyPerkDiscount(cost, ...pctList) {
  const base = Math.max(0, Math.round(perkNumber(cost)));
  const totalPct = pctList.reduce((sum, pct) => sum + normalizePerkPct(pct), 0);
  const ratio = Math.max(0.05, 1 - Math.max(0, totalPct));
  return Math.max(0, Math.round(base * ratio));
}

function getPerkLootBias(actorOrEffects) {
  const fx = actorOrEffects && typeof actorOrEffects === 'object' && Object.prototype.hasOwnProperty.call(actorOrEffects, 'lootWeightPlus')
    ? actorOrEffects
    : getActorPerkEffects(actorOrEffects);
  return Math.max(-0.6, Math.min(1.2, normalizePerkPct(fx?.lootWeightPlus || 0)));
}

function getPerkAggressionBias(actorOrEffects) {
  const fx = actorOrEffects && typeof actorOrEffects === 'object' && Object.prototype.hasOwnProperty.call(actorOrEffects, 'aggressionPlus')
    ? actorOrEffects
    : getActorPerkEffects(actorOrEffects);
  return Math.max(-0.5, Math.min(1.0, normalizePerkPct(fx?.aggressionPlus || 0)));
}

function applyPerkLootWeight(weight, actorOrEffects, opts = {}) {
  const baseWeight = Math.max(0, Number(weight || 0));
  if (!(baseWeight > 0)) return 0;
  const lootBias = getPerkLootBias(actorOrEffects);
  const rareBoost = Math.max(0, Number(opts?.rareBoost || 0));
  const ratio = Math.max(0.15, 1 + lootBias + Math.max(0, lootBias) * rareBoost);
  return Math.max(0.01, baseWeight * ratio);
}

function getPerkWildlifeLootBias(actorOrEffects) {
  const fx = actorOrEffects && typeof actorOrEffects === 'object' && Object.prototype.hasOwnProperty.call(actorOrEffects, 'wildlifeLootPlus')
    ? actorOrEffects
    : getActorPerkEffects(actorOrEffects);
  const base = normalizePerkPct(fx?.lootWeightPlus || 0);
  const extra = normalizePerkPct(fx?.wildlifeLootPlus || 0);
  return Math.max(-0.6, Math.min(1.4, base + extra));
}

function getPerkEventItemBias(actorOrEffects) {
  const fx = actorOrEffects && typeof actorOrEffects === 'object' && Object.prototype.hasOwnProperty.call(actorOrEffects, 'eventItemPlus')
    ? actorOrEffects
    : getActorPerkEffects(actorOrEffects);
  const base = Math.max(0, normalizePerkPct(fx?.lootWeightPlus || 0));
  const extra = Math.max(0, normalizePerkPct(fx?.eventItemPlus || 0));
  return Math.max(0, Math.min(1.2, base * 0.4 + extra));
}

function applyPerkCreditBonus(amount, ...pctList) {
  const base = Math.max(0, perkNumber(amount));
  if (!(base > 0)) return 0;
  const totalPct = pctList.reduce((sum, pct) => sum + normalizePerkPct(pct), 0);
  return Math.max(0, Math.round(base * Math.max(0, 1 + totalPct)));
}

function applyPerkDamageReduction(amount, ...minusList) {
  const base = Math.max(0, perkNumber(amount));
  if (!(base > 0)) return 0;
  const totalMinus = minusList.reduce((sum, v) => sum + Math.max(0, perkNumber(v)), 0);
  return Math.max(0, Math.round(base - totalMinus));
}

function maybeBoostDropQty(qty, chance, maxExtra = 1) {
  let next = Math.max(1, Math.round(perkNumber(qty) || 1));
  const extraCap = Math.max(0, Math.round(perkNumber(maxExtra) || 0));
  const rollChance = Math.max(0, Math.min(0.95, Number(chance || 0)));
  for (let i = 0; i < extraCap; i += 1) {
    if (Math.random() < rollChance) next += 1;
  }
  return next;
}

function applyPerkBundleToActor(actor, bundle, opts = {}) {
  if (!actor || typeof actor !== 'object') return actor;
  const perkBundle = bundle && typeof bundle === 'object' ? bundle : { codes: [], docs: [], effects: { ...PERK_EFFECT_DEFAULTS }, summary: '' };
  const fx = perkBundle.effects && typeof perkBundle.effects === 'object' ? perkBundle.effects : PERK_EFFECT_DEFAULTS;
  const next = actor;

  const baseStats = next._perkBaseStats && typeof next._perkBaseStats === 'object'
    ? { ...next._perkBaseStats }
    : { ...(next?.stats && typeof next.stats === 'object' ? next.stats : {}) };
  next._perkBaseStats = { ...baseStats };
  const statKeys = ['str', 'agi', 'int', 'men', 'luk', 'dex', 'sht', 'end'];
  const updatedStats = { ...baseStats };
  statKeys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(updatedStats, key)) updatedStats[key] = 0;
    updatedStats[key] = perkNumber(updatedStats[key]);
  });
  updatedStats.str += perkNumber(fx.strPlus) + perkNumber(fx.atkPlus);
  updatedStats.sht += perkNumber(fx.shtPlus) + perkNumber(fx.atkPlus);
  updatedStats.end += perkNumber(fx.endPlus) + perkNumber(fx.defPlus);
  updatedStats.agi += perkNumber(fx.agiPlus);
  updatedStats.int += perkNumber(fx.intPlus);
  updatedStats.men += perkNumber(fx.menPlus);
  updatedStats.luk += perkNumber(fx.lukPlus);
  updatedStats.dex += perkNumber(fx.dexPlus);
  next.stats = updatedStats;

  const baseMaxHp = perkNumber(next._perkBaseMaxHp ?? next.maxHp ?? 100) || 100;
  next._perkBaseMaxHp = baseMaxHp;
  const prevMaxHp = Math.max(1, perkNumber(next.maxHp || baseMaxHp) || baseMaxHp);
  const hpBonus = Math.max(0, perkNumber(fx.maxHpPlus) + perkNumber(fx.hpPlus));
  const desiredMaxHp = Math.max(1, Math.round(baseMaxHp + hpBonus));
  const currentHp = perkNumber(next.hp != null ? next.hp : prevMaxHp);
  const hpDelta = desiredMaxHp - prevMaxHp;
  next.maxHp = desiredMaxHp;
  if (opts.initialFill) next.hp = desiredMaxHp;
  else if (currentHp <= 0) next.hp = 0;
  else next.hp = Math.max(1, Math.min(desiredMaxHp, currentHp + Math.max(0, hpDelta)));

  const baseGrant = Math.max(0, Math.round(perkNumber(fx.startCreditsPlus) + perkNumber(fx.creditsPlus)));
  const prevGrant = Math.max(0, Math.round(perkNumber(next._perkGrantedCreditsTotal || 0)));
  const delta = Math.max(0, baseGrant - prevGrant);
  if (opts.applyCredits !== false && delta > 0) next.simCredits = Math.max(0, perkNumber(next.simCredits || 0) + delta);
  next._perkGrantedCreditsTotal = baseGrant;

  next._perkRuntime = { ...fx };
  next._perkCodes = Array.isArray(perkBundle.codes) ? perkBundle.codes.slice() : [];
  next._perkSummary = String(perkBundle.summary || '');
  return next;
}


function ensureEquipped(obj) {
  const eq = obj?.equipped;
  if (eq && typeof eq === 'object') {
    return {
      weapon: eq.weapon ?? null,
      head: eq.head ?? null,
      clothes: eq.clothes ?? null,
      arm: eq.arm ?? null,
      shoes: eq.shoes ?? null,
    };
  }
  return { weapon: null, head: null, clothes: null, arm: null, shoes: null };
}

function normalizeRuntimeInventory(list) {
  return (Array.isArray(list) ? list : [])
    .filter((it) => it && typeof it === 'object')
    .map((it) => {
      const next = { ...it };
      const qty = Number(next?.qty ?? 1);
      next.qty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
      const itemId = String(next?.itemId || next?.id || next?._id || '').trim();
      if (itemId) next.itemId = itemId;
      if (next?.equipSlot != null) next.equipSlot = String(next.equipSlot || '').toLowerCase();
      if (next?.weaponType != null) next.weaponType = normalizeWeaponType(next.weaponType) || String(next.weaponType || '');
      if (!Array.isArray(next?.tags)) next.tags = safeTags(next);
      return next;
    });
}

function normalizeRuntimeEffect(effect) {
  if (!effect || typeof effect !== 'object') return null;
  const next = { ...effect };
  if (next?.remainingDuration != null) {
    const dur = Number(next.remainingDuration);
    next.remainingDuration = Number.isFinite(dur) ? Math.max(0, Math.floor(dur)) : 0;
  }
  if (next?.dotDamage != null) {
    const dot = Number(next.dotDamage);
    next.dotDamage = Number.isFinite(dot) ? Math.max(0, Math.floor(dot)) : 0;
  }
  if (next?.recovery != null) {
    const rec = Number(next.recovery);
    next.recovery = Number.isFinite(rec) ? Math.max(0, Math.floor(rec)) : 0;
  }
  if (next?.shieldValue != null) {
    const shield = Number(next.shieldValue);
    next.shieldValue = Number.isFinite(shield) ? Math.max(0, Math.floor(shield)) : 0;
  }
  if (next?.sourceId != null) next.sourceId = String(next.sourceId || '');
  return next;
}

function normalizeRuntimeSurvivorList(list, opts = {}) {
  return (Array.isArray(list) ? list : [])
    .map((it) => normalizeRuntimeSurvivor(it, opts))
    .filter((it) => it && typeof it === 'object' && String(it?._id || '').trim());
}

function buildRuntimeSurvivorMap(list, opts = {}) {
  const map = new Map();
  normalizeRuntimeSurvivorList(list, opts).forEach((it) => {
    map.set(String(it._id), it);
  });
  return map;
}

function upsertRuntimeSurvivor(runtimeMap, survivor, opts = {}) {
  if (!(runtimeMap instanceof Map)) return null;
  const next = normalizeRuntimeSurvivor(survivor, opts);
  const id = String(next?._id || '').trim();
  if (!id) return null;
  runtimeMap.set(id, next);
  return next;
}

function normalizeRuntimeSurvivor(obj, opts = {}) {
  const base = obj && typeof obj === 'object' ? obj : {};
  const hpDefault = opts.hpDefault != null ? Number(opts.hpDefault) : 100;
  const maxHpDefault = opts.maxHpDefault != null ? Number(opts.maxHpDefault) : 100;
  const hpRaw = Number(base?.hp);
  const maxHpRaw = Number(base?.maxHp);
  const hp = Number.isFinite(hpRaw) ? hpRaw : hpDefault;
  const maxHp = Number.isFinite(maxHpRaw) && maxHpRaw > 0 ? maxHpRaw : maxHpDefault;
  const perkFx = getActorPerkEffects(base);
  const statusImmunities = new Set(
    Array.isArray(base?.statusImmunities)
      ? base.statusImmunities.map((x) => String(x || '').trim()).filter(Boolean)
      : []
  );
  if (perkNumber(perkFx?.bleedImmune || 0) > 0) statusImmunities.add(EFFECT_BLEED);
  if (perkNumber(perkFx?.poisonImmune || 0) > 0) {
    statusImmunities.add(EFFECT_POISON);
    statusImmunities.add(EFFECT_FOOD_POISON);
  }
  if (perkNumber(perkFx?.burnImmune || 0) > 0) statusImmunities.add(EFFECT_BURN);

  const statusResists = {
    ...(base?.statusResists && typeof base.statusResists === 'object' ? base.statusResists : {}),
  };
  statusResists[EFFECT_BLEED] = Math.max(0, Number(statusResists[EFFECT_BLEED] || 0), Number(perkFx?.bleedResistPct || 0));
  statusResists[EFFECT_POISON] = Math.max(0, Number(statusResists[EFFECT_POISON] || 0), Number(perkFx?.poisonResistPct || 0));
  statusResists[EFFECT_FOOD_POISON] = Math.max(0, Number(statusResists[EFFECT_FOOD_POISON] || 0), Number(perkFx?.poisonResistPct || 0));
  statusResists[EFFECT_BURN] = Math.max(0, Number(statusResists[EFFECT_BURN] || 0), Number(perkFx?.burnResistPct || 0));

  return {
    ...base,
    inventory: normalizeRuntimeInventory(base?.inventory),
    equipped: ensureEquipped(base),
    activeEffects: Array.isArray(base?.activeEffects) ? base.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean) : [],
    cooldowns: base?.cooldowns && typeof base.cooldowns === 'object' ? { ...base.cooldowns } : { portableSafeZone: 0, cnotGate: 0 },
    hp: Math.max(0, Math.min(maxHp, hp)),
    maxHp,
    simCredits: Number.isFinite(Number(base?.simCredits)) ? Number(base.simCredits) : 0,
    tacticalSkillLevel: Math.max(1, Math.min(2, Number(base?.tacticalSkillLevel || 1))),
    zoneId: String(base?.zoneId || ''),
    mapId: base?.mapId != null ? String(base.mapId || '') : '',
    day1Moves: Math.max(0, Number(base?.day1Moves || 0)),
    day1HeroDone: !!base?.day1HeroDone,
    droneLastOrderIndex: Number.isFinite(Number(base?.droneLastOrderIndex)) ? Number(base.droneLastOrderIndex) : -9999,
    droneLastOrderAbsSec: Number.isFinite(Number(base?.droneLastOrderAbsSec)) ? Number(base.droneLastOrderAbsSec) : -99999,
    kioskLastInteractAbsSec: Number.isFinite(Number(base?.kioskLastInteractAbsSec)) ? Number(base.kioskLastInteractAbsSec) : -99999,
    safeZoneUntil: Number.isFinite(Number(base?.safeZoneUntil)) ? Number(base.safeZoneUntil) : 0,
    aiTargetZoneId: base?.aiTargetZoneId != null ? String(base.aiTargetZoneId || '') : '',
    aiTargetTTL: Math.max(0, Number(base?.aiTargetTTL || 0)),
    _recentCombatUntil: Number.isFinite(Number(base?._recentCombatUntil)) ? Number(base._recentCombatUntil) : 0,
    _recentCombatWith: String(base?._recentCombatWith || ''),
    _recentCombatReason: String(base?._recentCombatReason || ''),
    detonationSec: Number.isFinite(Number(base?.detonationSec)) ? Number(base.detonationSec) : undefined,
    detonationMaxSec: Number.isFinite(Number(base?.detonationMaxSec)) ? Number(base.detonationMaxSec) : undefined,
    statusImmunities: Array.from(statusImmunities),
    statusResists,
  };
}

function getInvItemId(it) {
  return String(it?.itemId || it?.id || it?._id || '');
}

// ✅ 시뮬에서 랜덤 생성된 장비(weapon/armor)를 DB에 저장할 때 사용하는 외부 ID
// - equipmentCatalog.js에서 생성되는 id가 wpn_... / eq_... 형태
function getSimEquipExternalId(it) {
  const id = String(it?.itemId || it?.id || '').trim();
  return id;
}

function isSimGeneratedEquipment(it) {
  if (!it || typeof it !== 'object') return false;
  const extId = getSimEquipExternalId(it);
  if (!extId) return false;
  // equipmentCatalog에서 생성되는 prefix로 필터(불필요한 업서트/중복 저장 방지)
  if (!extId.startsWith('wpn_') && !extId.startsWith('eq_')) return false;

  const cat = String(it?.category || '').toLowerCase();
  const slot = String(it?.equipSlot || '').toLowerCase();
  const tags = safeTags(it).map((t) => String(t).toLowerCase());
  const hasStats = it?.stats && typeof it.stats === 'object';

  // category/slot/tags 중 하나라도 장비로 보이면 OK
  const isEquip = cat === 'equipment' || slot === 'weapon' || tags.includes('equipment') || tags.includes('weapon') || tags.includes('armor');
  return isEquip && hasStats;
}


// 장착 장비에서 이동속도(moveSpeed) 합산(신발 중심)
// - equipmentCatalog.js에서 shoes에 stats.moveSpeed를 부여
function getEquipMoveSpeed(actor) {
  const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const eq = ensureEquipped(actor);
  const ids = [eq.weapon, eq.head, eq.clothes, eq.arm, eq.shoes].map((x) => String(x || '')).filter(Boolean);
  const used = new Set();

  function sumFromItem(it) {
    if (!it || typeof it !== 'object') return 0;
    const st = it.stats && typeof it.stats === 'object' ? it.stats : {};
    const v = Number(st.moveSpeed || 0);
    return Number.isFinite(v) ? v : 0;
  };

  let ms = 0;

  // 1) equipped id 우선
  for (const id of ids) {
    const it = inv.find((x) => String(getInvItemId(x)) === id);
    if (it) {
      used.add(String(getInvItemId(it)));
      ms += sumFromItem(it);
    }
  }

  // 2) fallback: equipSlot=shoes
  const shoes = inv.find((x) => String(x?.equipSlot || '') === 'shoes' && !used.has(String(getInvItemId(x))));
  if (shoes) ms += sumFromItem(shoes);

  const perkMs = perkNumber(getActorPerkEffects(actor)?.moveSpeedPlus || 0);
  return Math.max(0, ms + perkMs);
}


const SLOT_ICON = { weapon: '⚔️', head: '🪖', clothes: '👕', arm: '🦾', shoes: '👟' };

// 🗺️ 루미아 섬(존 기반) 감성 배치(미니맵 앵커 좌표, viewBox 0..100)
// - 실제 맵 이미지는 어드민에서 교체 가능하므로, 이 값은 "기본" 레이아웃용입니다.
const LUMIA_ZONE_POS = {
  archery: { x: 18, y: 24 },
  forest: { x: 26, y: 40 },
  temple: { x: 40, y: 26 },
  pond: { x: 52, y: 38 },
  lab: { x: 62, y: 30 },
  school: { x: 76, y: 24 },
  hotel: { x: 84, y: 38 },
  residential: { x: 86, y: 52 },
  hospital: { x: 74, y: 60 },
  police: { x: 60, y: 54 },
  cathedral: { x: 48, y: 48 },
  alley: { x: 52, y: 62 },
  gas_station: { x: 34, y: 68 },
  stream: { x: 40, y: 78 },
  beach: { x: 26, y: 86 },
  port: { x: 50, y: 88 },
  warehouse: { x: 62, y: 84 },
  factory: { x: 70, y: 74 },
  firestation: { x: 78, y: 78 },
};

// 🧭 기본 동선(인접 이동) - 하이퍼루프 맵 레이아웃 기준
// - 어드민 zoneConnections가 비어 있을 때만 사용
const LUMIA_DEFAULT_EDGES = [
  ['gas_station', 'alley'],
  ['gas_station', 'school'],
  ['gas_station', 'archery'],

  ['archery', 'hotel'],
  ['archery', 'school'],
  ['hotel', 'school'],
  ['hotel', 'beach'],

  ['school', 'firestation'],
  ['school', 'forest'],
  ['firestation', 'police'],
  ['firestation', 'lab'],
  ['firestation', 'pond'],

  ['police', 'alley'],
  ['police', 'pond'],
  ['alley', 'temple'],

  ['temple', 'stream'],
  ['stream', 'pond'],
  ['stream', 'hospital'],

  ['pond', 'hospital'],
  ['pond', 'lab'],
  ['pond', 'cathedral'],

  ['lab', 'cathedral'],
  ['forest', 'lab'],
  ['forest', 'beach'],

  ['beach', 'residential'],
  ['residential', 'warehouse'],
  ['warehouse', 'cathedral'],
  ['warehouse', 'port'],

  ['cathedral', 'port'],
  ['cathedral', 'factory'],
  ['factory', 'hospital'],
];


function shortText(s, maxLen = 8) {
  const str = String(s || '');
  if (str.length <= maxLen) return str;
  return str.slice(0, Math.max(0, maxLen - 1)) + '…';
}

function hash32(str) {
  const s = String(str || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}


function extractActorNameFromLog(text) {
  const t = String(text || '');
  const m = t.match(/\[([^\]]+)\]/);
  return m ? String(m[1] || '').trim() : '';
}

function getEquipSummary(char) {
  const eq = ensureEquipped(char);
  const inv = Array.isArray(char?.inventory) ? char.inventory : [];
  const parts = EQUIP_SLOTS.map((slot) => {
    const icon = SLOT_ICON[slot] || '🧩';
    const id = String(eq?.[slot] || '');
    if (!id) return { full: `${icon} -`, short: `${icon} -` };
    const it = inv.find((x) => getInvItemId(x) === id);
    const name = it ? itemDisplayName(it) : '?';
    return { full: `${icon} ${name}`, short: `${icon} ${shortText(name)}` };
  });
  return { full: parts.map((p) => p.full).join(' | '), short: parts.map((p) => p.short).join(' | ') };
}

function compactIO(list) {
  const map = new Map();
  (Array.isArray(list) ? list : []).forEach((x) => {
    if (!x?.itemId) return;
    const id = String(x.itemId);
    const qty = Math.max(1, Number(x.qty || 1));
    map.set(id, (map.get(id) || 0) + qty);
  });
  return [...map.entries()].map(([itemId, qty]) => ({ itemId, qty }));
}

function isEnabledScenarioEvent(ev) {
  return ev?.enabled !== false;
}

function getScenarioEventTimeOfDay(ev) {
  const raw = String(ev?.timeOfDay || ev?.time || 'both').toLowerCase();
  if (raw === 'day' || raw === 'night' || raw === 'both') return raw;
  if (raw === 'any') return 'both';
  return 'both';
}

// --- 로컬 설정: 맵 하이퍼루프 목적지(어드민 로컬 저장) ---
function localKeyHyperloops(mapId) {
  const id = String(mapId || '').trim();
  return id ? `eh_map_hyperloops_${id}` : '';
}

// --- 로컬 설정: 하이퍼루프 장치(패드) 구역 ---
function localKeyHyperloopDeviceZone(mapId) {
  const id = String(mapId || '').trim();
  return id ? `eh_hyperloop_zone_${id}` : '';
}

function readLocalJsonArray(key) {
  const k = String(key || '').trim();
  if (!k) return [];
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(k);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function uniqStr(list) {
  const out = [];
  const s = new Set();
  for (const v of (Array.isArray(list) ? list : [])) {
    const k = String(v || '').trim();
    if (!k) continue;
    if (s.has(k)) continue;
    s.add(k);
    out.push(k);
  }
  return out;
}

// --- 필드 파밍(이벤트 외): 맵의 itemCrates(lootTable)에서 아이템을 획득 ---
function randInt(min, max) {
  const a = Math.floor(Number(min || 0));
  const b = Math.floor(Number(max || 0));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  if (b <= a) return a;
  return a + Math.floor(Math.random() * (b - a + 1));
}

function pickWeighted(list) {
  const arr = Array.isArray(list) ? list : [];
  const total = arr.reduce((sum, x) => sum + Math.max(0, Number(x?.weight || 1)), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const x of arr) {
    r -= Math.max(0, Number(x?.weight || 1));
    if (r <= 0) return x;
  }
  return arr[arr.length - 1] || null;
}

// --- 티어(장비 등급): 1=일반, 2=고급, 3=희귀, 4=영웅, 5=전설, 6=초월 ---
// ※ 함수명은 기존 호환을 위해 유지(실제 상한은 6)
function clampTier4(v) {
  const n = Math.floor(Number(v || 1));
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(6, Math.max(1, n));
}

function tierLabelKo(tier) {
  const t = clampTier4(tier);
  if (t === 6) return '초월';
  if (t === 5) return '전설';
  if (t === 4) return '영웅';
  if (t === 3) return '희귀';
  if (t === 2) return '고급';
  return '일반';
}

function crateTypeLabel(crateType) {
  const k = String(crateType || '').toLowerCase();
  if (k === 'food') return '음식 상자';
  if (k === 'legendary_material') return '전설 재료 상자';
  if (k === 'transcend_pick') return '초월 장비 선택 상자';
  // legacy/기타
  if (k.includes('legendary')) return '전설 재료 상자';
  return '상자';
}

// 🎁 초월 장비 선택 상자: 후보 2~3개를 뽑아 "선택"하게 하는 최소 구현
function rollTranscendPickOptions(publicItems, count = 3) {
  const list = Array.isArray(publicItems) ? publicItems : [];
  const equipT4 = list
    .filter((it) => it?._id)
    .filter((it) => inferItemCategory(it) === 'equipment')
    .filter((it) => clampTier4(it?.tier || 1) >= 6);
  if (!equipT4.length) return [];

  // 슬롯 다양성 우선(가능하면 서로 다른 슬롯)
  const bySlot = {};
  for (const it of equipT4) {
    const slot = String(it?.equipSlot || inferEquipSlot(it) || '').toLowerCase() || 'etc';
    if (!bySlot[slot]) bySlot[slot] = [];
    bySlot[slot].push(it);
  }

  const slots = Object.keys(bySlot);
  for (let i = slots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = slots[i];
    slots[i] = slots[j];
    slots[j] = tmp;
  }

  const picked = [];
  const used = new Set();

  for (const s of slots) {
    if (picked.length >= count) break;
    const arr = bySlot[s] || [];
    if (!arr.length) continue;
    const it = arr[Math.floor(Math.random() * arr.length)];
    const id = String(it?._id || '');
    if (!id || used.has(id)) continue;
    used.add(id);
    picked.push(it);
  }

  if (picked.length < Math.min(count, equipT4.length)) {
    const rest = equipT4.filter((it) => !used.has(String(it?._id || '')));
    for (let i = rest.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = rest[i];
      rest[i] = rest[j];
      rest[j] = tmp;
    }
    for (const it of rest) {
      if (picked.length >= count) break;
      const id = String(it?._id || '');
      if (!id || used.has(id)) continue;
      used.add(id);
      picked.push(it);
    }
  }

  return picked.map((it) => ({
    itemId: String(it._id),
    name: String(it?.name || ''),
    tier: clampTier4(it?.tier || 4),
    slot: String(it?.equipSlot || inferEquipSlot(it) || ''),
  }));
}

function pickAutoTranscendOption(options, publicItems) {
  const list = Array.isArray(publicItems) ? publicItems : [];
  const scored = (Array.isArray(options) ? options : []).map((o) => {
    const it = list.find((x) => String(x?._id) === String(o?.itemId)) || null;
    const tier = clampTier4(it?.tier ?? o?.tier ?? 4);
    const v = Number(it?.baseCreditValue ?? it?.value ?? 0);
    const score = tier * 100000 + v;
    return { ...o, _score: score };
  });
  scored.sort((a, b) => Number(b?._score || 0) - Number(a?._score || 0));
  return scored[0] || null;
}


function rollFieldLoot(mapObj, zoneId, publicItems, ruleset, opts = {}) {
  const crates = Array.isArray(mapObj?.itemCrates) ? mapObj.itemCrates : [];
  const perkLootBias = getPerkLootBias(opts?.perkEffects || {});

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
  const chance = Math.max(0.01, Math.min(0.98, chanceBase + Math.max(-0.05, Math.min(0.16, perkLootBias * 0.18))));
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
      const legendDropWeights = resolveLegendaryDropWeights(opts, opts?.ruleset || null);
  const candidates = getLegendaryCoreCandidates(publicItems, legendDropWeights);
      const picked = pickWeighted(candidates);
      const item = picked?.item || null;
      if (item?._id) {
        return { item, itemId: String(item._id), qty: 1, crateId: crate?.crateId || '', crateType, zoneId: String(zoneId || '') };
      }
      // 후보를 찾지 못하면, 맵 lootTable로 fallback(있는 경우)
    }

    // 초월 장비 선택 상자라면: 아이템을 바로 주지 않고 후보를 반환합니다.
    if (ctLower === 'transcend_pick') {
      const optCount = Math.max(2, Math.min(3, Number(ruleset?.drops?.crateTypes?.transcend_pick?.optionsCount ?? 3)));
      const options = rollTranscendPickOptions(publicItems, optCount);
      if (!options.length) return null;
      return { item: null, itemId: '', qty: 1, crateId: crate?.crateId || '', crateType, options, zoneId: String(zoneId || '') };
    }

    const weightedLootTable = (Array.isArray(crate?.lootTable) ? crate.lootTable : []).map((entry) => {
      const itemId = String(entry?.itemId || '');
      const item = (Array.isArray(publicItems) ? publicItems : []).find((it) => String(it?._id) === itemId) || null;
      const special = classifySpecialByName(item?.name);
      const isEquip = inferItemCategory(item) === 'equipment';
      const weight = applyPerkLootWeight(entry?.weight || 1, opts?.perkEffects || {}, { rareBoost: special ? 0.7 : (isEquip ? 0.35 : 0) });
      return { ...entry, _item: item, weight };
    });
    const entry = pickWeighted(weightedLootTable);
    if (!entry?.itemId) return null;

    const itemId = String(entry.itemId);
    const item = entry?._item || (Array.isArray(publicItems) ? publicItems : []).find((it) => String(it?._id) === itemId) || null;
    let qty = Math.max(1, randInt(entry?.minQty ?? 1, entry?.maxQty ?? 1));
    const itemCat = inferItemCategory(item);
    if ((itemCat === 'material' || itemCat === 'consumable') && Math.random() < Math.max(0, perkLootBias) * 0.45) {
      qty += 1;
    }

    return { item, itemId, qty, crateId: crate?.crateId || '', crateType, zoneId: String(zoneId || '') };
  }

  // 2) fallback: 음식 상자 / 전설 재료 상자 / 초월 장비 선택 상자
  const list = Array.isArray(publicItems) ? publicItems : [];

  const ct = ruleset?.drops?.crateTypes || {};
  const wFood0 = Math.max(0, Number(ct?.food?.weight ?? ct?.food ?? 80));
  const wLegendBase0 = Number(field?.legendaryMaterialWeight ?? field?.legendaryMaterial?.weight ?? ct?.legendary_material?.weight ?? ct?.legendary_material ?? 15);
  const wLegend0 = legendEnabled ? Math.max(0, wLegendBase0) : 0;
  const wTrans0 = Math.max(0, Number(ct?.transcend_pick?.weight ?? ct?.transcend_pick ?? 5));

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
    const legendDropWeights = resolveLegendaryDropWeights(opts, opts?.ruleset || null);
  const candidates = getLegendaryCoreCandidates(publicItems, legendDropWeights);
    const picked = pickWeighted(candidates);
    const item = picked?.item || null;
    if (item?._id) return { item, itemId: String(item._id), qty: 1, crateId: 'fallback', crateType: 'legendary_material', zoneId: String(zoneId || '') };
  }

  if (pickedType === 'transcend_pick') {
    const optCount = Math.max(2, Math.min(3, Number(ct?.transcend_pick?.optionsCount ?? 3)));
    const options = rollTranscendPickOptions(publicItems, optCount);
    if (options.length) return { item: null, itemId: '', qty: 1, crateId: 'fallback', crateType: 'transcend_pick', options, zoneId: String(zoneId || '') };
  }

  // food crate: 하급 재료 + 소모품(치유/음식)
  const pool = [];
  const isDay1 = Number(curDay || 0) === 1;
  for (const it of list) {
    if (!it?._id) continue;
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

      // ✅ 1일차 템포 튜닝: 하급 재료는 한 번에 2~3개 나오도록(영웅 세팅 목표)
      // - 인벤 재료 스택 상한(기본 3)을 넘기지 않게 maxQty=3 유지
      const minQty = (isDay1 && tier <= 1) ? 2 : 1;
      const maxQty = (isDay1 && tier <= 1) ? 3 : 1;
      if (isDay1 && tier <= 1) w += 3; // 하급 재료 우선

      pool.push({ itemId: String(it._id), weight: applyPerkLootWeight(w, opts?.perkEffects || {}, { rareBoost: tier >= 2 ? 0.15 : 0 }), minQty, maxQty });
      continue;
    }

    if (cat === 'consumable') {
      const tags = safeTags(it);
      const t = String(it?.type || '').toLowerCase();
      // 음식/치유 위주
      if (t === 'food' || tags.includes('food') || tags.includes('heal') || tags.includes('medical')) {
        pool.push({ itemId: String(it._id), weight: applyPerkLootWeight(2, opts?.perkEffects || {}, { rareBoost: tags.includes('medical') ? 0.1 : 0 }), minQty: 1, maxQty: 1 });
      }
    }
  }

  const entry = pickWeighted(pool);
  if (!entry?.itemId) return null;

  const itemId = String(entry.itemId);
  const item = list.find((it) => String(it?._id) === itemId) || null;
  let qty = Math.max(1, randInt(entry?.minQty ?? 1, entry?.maxQty ?? 1));
  if (Math.random() < Math.max(0, perkLootBias) * 0.45) qty += 1;
  return { item, itemId, qty, crateId: 'fallback', crateType: 'food', zoneId: String(zoneId || '') };
}


// --- 전설 재료 상자(필드 드랍): 3일차 '낮' 이후부터 맵 곳곳에서 발견 가능 ---
function normalizeMatchKey(v) {
  // NOTE: 정규식 문자 클래스 내 '-'는 범위로 해석될 수 있으니 끝으로 옮기거나 이스케이프한다.
  return String(v || '').toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·・_.(),-]/g, '');
}

function findItemByKeywords(publicItems, keywords) {
  const list = Array.isArray(publicItems) ? publicItems : [];
  const keys = (Array.isArray(keywords) ? keywords : [])
    .map((k) => normalizeMatchKey(k))
    .filter(Boolean);
  if (!keys.length) return null;
  return (
    list.find((it) => {
      const name = normalizeMatchKey(it?.name || it?.text || '');
      return keys.some((k) => name.includes(k));
    }) || null
  );
}

// --- 🧾 장비 티어 요약(공용) ---
// NOTE:
// - 여러 로직(야생동물 크레딧 언더독 보정, AI 교전 회피 등)에서 공통으로 사용한다.
// - equipped가 있으면 그 슬롯 기준으로, 없으면 inventory의 equipSlot/type 힌트로 추정한다.
function getEquipTierSummary(c) {
  const inv = Array.isArray(c?.inventory) ? c.inventory : [];
  const eq = c?.equipped || null;

  function pickById(id) {
    if (!id) return null;
    const sid = String(id);
    return inv.find((it) => {
      const iid = String(it?.itemId || it?.id || it?._id || '');
      return iid && iid === sid;
    }) || null;
  };

  function readTier(it) {
    const t = Number(it?.tier ?? it?.t ?? 1);
    return Number.isFinite(t) ? Math.max(1, Math.floor(t)) : 1;
  };

  // 1) equipped 기반
  if (eq && typeof eq === 'object') {
    const w = pickById(eq.weapon);
    const h = pickById(eq.head);
    const c2 = pickById(eq.clothes);
    const a = pickById(eq.arm);
    const s = pickById(eq.shoes);

    const weaponTier = w ? readTier(w) : 0;
    const armorTierSum = (h ? readTier(h) : 0) + (c2 ? readTier(c2) : 0) + (a ? readTier(a) : 0) + (s ? readTier(s) : 0);
    return { weaponTier, armorTierSum };
  }

  // 2) fallback: inventory 힌트 기반(구형 데이터)
  let weaponTier = 0;
  let armorTierSum = 0;
  const armorSlots = new Set(['head', 'clothes', 'arm', 'shoes']);
  for (const it of inv) {
    const slot = String(it?.equipSlot || '');
    const tp = String(it?.type || '').toLowerCase();
    const t = readTier(it);
    if (slot === 'weapon' || tp === 'weapon' || tp === '무기') weaponTier = Math.max(weaponTier, t);
    else if (armorSlots.has(slot)) armorTierSum += t;
  }
  return { weaponTier, armorTierSum };
}


function getLegendaryCoreCandidates(publicItems, weightsByKey = null) {
  const w = (weightsByKey && typeof weightsByKey === 'object') ? weightsByKey : {};

  const meteor = findItemByKeywords(publicItems, ['운석', 'meteor']);
  const tree = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);
  const mithril = findItemByKeywords(publicItems, ['미스릴', 'mithril']);
  const forceCore = findItemByKeywords(publicItems, ['포스 코어', 'force core', 'forcecore']);

  const out = [];
  if (meteor?._id) out.push({ key: 'meteor', item: meteor, weight: Math.max(0.01, Number(w.meteor ?? 3)) });
  if (tree?._id) out.push({ key: 'life_tree', item: tree, weight: Math.max(0.01, Number(w.life_tree ?? 3)) });
  if (mithril?._id) out.push({ key: 'mithril', item: mithril, weight: Math.max(0.01, Number(w.mithril ?? 2)) });
  if (forceCore?._id) out.push({ key: 'force_core', item: forceCore, weight: Math.max(0.01, Number(w.force_core ?? 1)) });
  return out;
}

function resolveLegendaryDropWeights(opts = {}, ruleset = null) {
  if (opts?.dropWeightsByKey && typeof opts.dropWeightsByKey === 'object') return opts.dropWeightsByKey;
  if (opts?.weightsByKey && typeof opts.weightsByKey === 'object') return opts.weightsByKey;
  return ruleset?.worldSpawns?.legendaryCrate?.dropWeightsByKey || null;
}

function rollLegendaryCrateLoot(mapObj, zoneId, publicItems, curDay, curPhase, opts = {}) {
  // 게이트: 3일차 '낮' 이후부터
  if (!isAtOrAfterWorldTime(curDay, curPhase, 3, 'day')) return null;

  const moved = !!opts.moved;
  // 전설 재료 상자는 자주 나오면 밸런스가 무너져서, 이동 시에도 낮은 확률로만 발견
  const chance = moved ? 0.09 : 0.03;
  if (Math.random() >= chance) return null;

  const legendDropWeights = resolveLegendaryDropWeights(opts, opts?.ruleset || null);
  const candidates = getLegendaryCoreCandidates(publicItems, legendDropWeights);
  if (!candidates.length) return null;

  const picked = pickWeighted(candidates);
  const item = picked?.item || null;
  if (!item?._id) return null;

  return { item, itemId: String(item._id), qty: 1, crateType: 'legendary_material', zoneId: String(zoneId || '') };
}

// --- 키오스크(구매/교환): 2일차 '낮' 이후부터 이용 가능 ---
// 목표: 이벤트 없이도 "상자/키오스크/사냥/드론" 루프가 돌아가도록, 최소 동작(구매/교환)을 시뮬에 연결합니다.
// NOTE: 서버(/kiosks API)와 별개로, "시뮬 전용" 규칙 기반으로 작동합니다.

function pickFromAllCrates(mapObj, publicItems) {
  const crates = Array.isArray(mapObj?.itemCrates) ? mapObj.itemCrates : [];
  const pool = [];
  crates.forEach((c) => {
    const lt = Array.isArray(c?.lootTable) ? c.lootTable : [];
    lt.forEach((e) => {
      if (!e?.itemId) return;
      pool.push({ itemId: String(e.itemId), weight: Math.max(0, Number(e?.weight || 1)), minQty: e?.minQty, maxQty: e?.maxQty });
    });
  });

  // 상자 데이터가 없으면 fallback: 재료(티어1~2) 위주
  if (!pool.length) {
    const list = Array.isArray(publicItems) ? publicItems : [];
    for (const it of list) {
      if (!it?._id) continue;
      if (String(it?.type || '') !== '재료') continue;
      const tier = Number(it?.tier || 1);
      if (tier > 2) continue;
      if (classifySpecialByName(it?.name)) continue;

      const nm = String(it?.name || '').toLowerCase();
      const v = Number(it?.baseCreditValue ?? it?.value ?? 0);
      let w = 1;
      if (tier <= 1) w += 2;
      if (v > 0 && v <= 40) w += 1;
      if (nm.includes('천') || nm.includes('가죽') || nm.includes('돌') || nm.includes('나무') || nm.includes('철') || nm.includes('부품')) w += 1;

      pool.push({ itemId: String(it._id), weight: w, minQty: 1, maxQty: 1 });
    }
  }

  if (!pool.length) return null;
  return pickWeighted(pool);
}

function pickUnitsFromInventory(inventory, n) {
  const list = Array.isArray(inventory) ? inventory.map((x) => ({ ...x })) : [];
  const picked = [];
  for (let k = 0; k < n; k++) {
    const total = list.reduce((sum, x) => sum + Math.max(0, Number(x?.qty || 0)), 0);
    if (total <= 0) break;
    let r = Math.random() * total;
    let idx = -1;
    for (let i = 0; i < list.length; i++) {
      r -= Math.max(0, Number(list[i]?.qty || 0));
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    if (idx < 0) idx = 0;
    const it = list[idx];
    const id = String(it?.itemId || it?.id || '');
    if (!id) break;
    picked.push({ itemId: id, qty: 1 });
    const nextQty = Math.max(0, Number(it?.qty || 0) - 1);
    if (nextQty <= 0) list.splice(idx, 1);
    else list[idx] = { ...it, qty: nextQty };
  }
  return picked;
}

function removePickedUnitsFromInventory(inventory, picked) {
  const list = Array.isArray(inventory) ? inventory.map((x) => ({ ...x })) : [];
  const need = compactIO(Array.isArray(picked) ? picked : []);
  for (const row of need) {
    const itemId = String(row?.itemId || '');
    let remaining = Math.max(0, Number(row?.qty || 0));
    if (!itemId || remaining <= 0) continue;
    for (let i = 0; i < list.length && remaining > 0; i += 1) {
      const curId = String(list[i]?.itemId || list[i]?.id || '');
      if (curId !== itemId) continue;
      const have = Math.max(0, Number(list[i]?.qty || 1));
      const take = Math.min(have, remaining);
      const nextQty = have - take;
      remaining -= take;
      if (nextQty <= 0) {
        list.splice(i, 1);
        i -= 1;
      } else {
        list[i] = { ...list[i], qty: nextQty };
      }
    }
  }
  return list;
}

function pruneEquippedAgainstInventory(actor) {
  if (!actor || typeof actor !== 'object') return actor;
  const invIds = new Set((Array.isArray(actor?.inventory) ? actor.inventory : []).map((x) => String(getInvItemId(x) || '')).filter(Boolean));
  const eq = ensureEquipped(actor);
  const nextEq = { ...eq };
  for (const slot of EQUIP_SLOTS) {
    const curId = String(eq?.[slot] || '');
    if (curId && !invIds.has(curId)) nextEq[slot] = null;
  }
  actor.equipped = nextEq;
  return actor;
}

function clearRuntimeCombatFields(actor) {
  if (!actor || typeof actor !== 'object') return actor;
  actor.lastDamagedBy = '';
  actor.lastDamagedPhaseIdx = -9999;
  actor._deathAt = undefined;
  actor._deathBy = undefined;
  actor._detLogLastMilestone = null;
  actor._gatherPvpBonus = 0;
  actor._gatherPvpBonusUntilPhaseIdx = -9999;
  actor._immediateDanger = 0;
  actor._immediateDangerUntilPhaseIdx = -9999;
  actor.aiTargetZoneId = '';
  actor.aiTargetTTL = 0;
  actor.safeZoneUntil = 0;
  actor._recentCombatUntil = 0;
  actor._recentCombatWith = '';
  actor._recentCombatReason = '';
  return actor;
}

function applyAiRecoveryWindow(actor, absSec, opts = {}) {
  if (!actor || typeof actor !== 'object') return actor;
  const now = Number.isFinite(Number(absSec)) ? Number(absSec) : 0;
  const recoverSec = Math.max(0, Number(opts?.recoverSec ?? 0));
  const safeZoneSec = Math.max(0, Number(opts?.safeZoneSec ?? 0));
  const reason = String(opts?.reason || '');
  const opponentId = String(opts?.opponentId || '');
  const retargetZoneId = String(opts?.retargetZoneId || '');
  const retargetTtl = Math.max(0, Math.floor(Number(opts?.retargetTtl ?? 0)));
  actor.aiTargetZoneId = retargetZoneId || '';
  actor.aiTargetTTL = retargetZoneId ? retargetTtl : 0;
  actor._recentCombatUntil = Math.max(0, now + recoverSec, Number(actor?._recentCombatUntil || 0));
  actor._recentCombatWith = opponentId;
  actor._recentCombatReason = reason;
  if (safeZoneSec > 0) {
    actor.safeZoneUntil = Math.max(Number(actor?.safeZoneUntil || 0), now + safeZoneSec);
  }
  return actor;
}

function isAiRecoveryLocked(actor, absSec) {
  return Number(actor?._recentCombatUntil || 0) > Number(absSec || 0);
}

function normalizeDeadSnapshot(actor, ruleset) {
  if (!actor || typeof actor !== 'object') return actor;
  const dead = normalizeRuntimeSurvivor(actor);
  dead.inventory = normalizeInventory(dead.inventory, ruleset);
  pruneEquippedAgainstInventory(dead);
  clearRuntimeCombatFields(dead);
  dead.hp = 0;
  return dead;
}

function normalizeRevivedSurvivor(actor, revivedHp, zoneId, phaseIdxNow, ruleset, absSec = 0, reviveKit = null) {
  if (!actor || typeof actor !== 'object') return actor;
  const revived = normalizeRuntimeSurvivor(actor);
  revived.inventory = normalizeInventory(revived.inventory, ruleset);
  pruneEquippedAgainstInventory(revived);
  clearRuntimeCombatFields(revived);
  revived.hp = Math.max(1, Math.min(Number(revived.maxHp || revivedHp || 1), Number(revivedHp || 1)));
  revived.zoneId = String(zoneId || revived.zoneId || '');
  revived.activeEffects = [];
  revived.statusImmunities = Array.isArray(revived.statusImmunities) ? [...revived.statusImmunities] : [];
  revived.statusResists = revived.statusResists && typeof revived.statusResists === 'object' ? { ...revived.statusResists } : {};
  revived.revivedOnce = true;
  revived.revivedAtPhaseIdx = phaseIdxNow;
  revived.deadAtPhaseIdx = undefined;
  revived.reviveEligible = false;
  applyAiRecoveryWindow(revived, absSec, { reason: 'revive', recoverSec: 8, safeZoneSec: 10 });
  if (reviveKit && reviveKit._id) {
    revived.inventory = addItemToInventory(revived.inventory, reviveKit, String(reviveKit._id), 1, 1, ruleset);
  }
  pruneEquippedAgainstInventory(revived);
  return revived;
}

function applyStatusEffect(actor, effect, opts = {}) {
  if (!actor || typeof actor !== 'object') return { applied: false, reason: 'invalid' };
  const res = addOrRefreshEffect(actor, effect, opts);
  actor.activeEffects = Array.isArray(res?.character?.activeEffects)
    ? res.character.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean)
    : [];
  return res;
}

function clearNegativeStatusEffects(actor, opts = {}) {
  if (!actor || typeof actor !== 'object') return { changed: false, removed: [] };
  const res = purgeNegativeEffects(actor, opts);
  actor.activeEffects = Array.isArray(res?.character?.activeEffects)
    ? res.character.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean)
    : [];
  return { changed: !!res?.changed, removed: Array.isArray(res?.removed) ? res.removed : [] };
}

function applyShieldEffect(actor, shieldValue, duration = 2, sourceId = '') {
  const shield = Math.max(0, Math.floor(Number(shieldValue || 0)));
  if (!actor || shield <= 0) return { applied: false, shield: 0 };
  const res = applyStatusEffect(actor, {
    name: EFFECT_SHIELD,
    shieldValue: shield,
    remainingDuration: Math.max(1, Math.floor(Number(duration || 1))),
    stacks: 1,
    sourceId: String(sourceId || ''),
  });
  return { applied: !!res?.applied, shield };
}

function applyRegenEffect(actor, recovery, duration = 2, sourceId = '') {
  const rec = Math.max(0, Math.floor(Number(recovery || 0)));
  if (!actor || rec <= 0) return { applied: false, recovery: 0 };
  const res = applyStatusEffect(actor, {
    name: EFFECT_REGEN,
    recovery: rec,
    remainingDuration: Math.max(1, Math.floor(Number(duration || 1))),
    stacks: 1,
    sourceId: String(sourceId || ''),
  });
  return { applied: !!res?.applied, recovery: rec };
}

function describeRuntimeEffect(effect) {
  const eff = normalizeRuntimeEffect(effect);
  if (!eff) return '';
  const name = String(eff?.name || '효과');
  if (name === EFFECT_SHIELD) return `보호막 +${Math.max(0, Number(eff?.shieldValue || 0))}${Number(eff?.remainingDuration || 0) > 0 ? ` (${Math.max(0, Number(eff?.remainingDuration || 0))}턴)` : ''}`;
  if (name === EFFECT_REGEN) return `재생 ${Math.max(0, Number(eff?.recovery || 0))}${Number(eff?.remainingDuration || 0) > 0 ? ` (${Math.max(0, Number(eff?.remainingDuration || 0))}턴)` : ''}`;
  const statMods = eff?.statModifiers && typeof eff.statModifiers === 'object' ? eff.statModifiers : null;
  if (statMods && Object.keys(statMods).length) {
    const bits = Object.entries(statMods).map(([k, v]) => `${String(k)} ${Number(v) > 0 ? '+' : ''}${Number(v)}`);
    return `${name}${bits.length ? ` [${bits.join(', ')}]` : ''}${Number(eff?.remainingDuration || 0) > 0 ? ` (${Math.max(0, Number(eff?.remainingDuration || 0))}턴)` : ''}`;
  }
  return `${name}${Number(eff?.remainingDuration || 0) > 0 ? ` (${Math.max(0, Number(eff?.remainingDuration || 0))}턴)` : ''}`;
}

function applyRuntimeEffectPayloads(actor, effects) {
  const list = normalizeStatusEffectList(effects).map((x) => normalizeRuntimeEffect(x)).filter(Boolean);
  const results = [];
  list.forEach((effect) => {
    const res = applyStatusEffect(actor, effect);
    results.push({ ...res, effect });
  });
  return {
    results,
    applied: results.some((x) => !!x?.applied),
  };
}

function consumeShieldDamage(actor, rawDamage) {
  const result = absorbShieldDamage(actor, rawDamage);
  actor.activeEffects = Array.isArray(result?.character?.activeEffects)
    ? result.character.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean)
    : [];
  return result;
}

function clearPostCombatEffects(actor) {
  if (!actor || typeof actor !== 'object') return false;
  const res = clearNegativeStatusEffects(actor, { names: [EFFECT_BLEED, EFFECT_POISON, EFFECT_BURN], removeAllNegative: false });
  actor.activeEffects = Array.isArray(actor.activeEffects) ? actor.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean) : [];
  return !!res.changed;
}

function countInventoryUnits(inventory) {
  return (Array.isArray(inventory) ? inventory : []).reduce((sum, x) => sum + Math.max(0, Number(x?.qty ?? 1)), 0);
}

function kioskLegendaryPrice(key, priceByKey) {
  const table = priceByKey && typeof priceByKey === 'object' ? priceByKey : {};
  const v = Number(table?.[key]);
  if (Number.isFinite(v) && v > 0) return v;

  // fallback: 기본 아이템 트리(baseCreditValue) 기준
  if (key === 'force_core') return 1200;
  if (key === 'mithril') return 900;
  return 800; // meteor / life_tree
}


function zoneNameHasKiosk(name) {
  const nm = String(name || '').toLowerCase();
  // 키오스크 위치: 병원, 성당, 경찰서, 소방서, 양궁장, 절, 창고, 연구소, 호텔
  const keywords = [
    '병원', 'hospital',
    '성당', 'cathedral', 'church',
    '경찰서', 'police',
    '소방서', 'fire station', 'firestation', 'fire',
    '양궁장', '양궁', 'archery',
    '절', 'temple',
    '창고', 'warehouse', 'storage',
    '연구소', 'lab', 'research',
    '호텔', 'hotel',
    '학교', 'school', 'academy',
  ];
  return keywords.some((k) => nm.includes(String(k).toLowerCase()));
}

function hasKioskAtZone(kiosks, mapObj, zoneId) {
  const zId = String(zoneId || '');
  if (!zId) return false;

  // 1) 서버에서 내려오는 실제 키오스크 배치(/public/kiosks)가 있으면, 그걸 우선으로 사용합니다.
  if (Array.isArray(kiosks) && kiosks.length) {
    const mapId = String(mapObj?._id || mapObj?.id || '');
    const hit = kiosks.some((k) => {
      const km = String(k?.mapId?._id || k?.mapId || '');
      const kz = String(k?.zoneId || '');
      return mapId && km === mapId && kz === zId;
    });
    if (hit) return true;
  }

  // 2) fallback: 맵 구역 이름으로 판정(병원/성당/경찰서/소방서/양궁장/절/창고/연구소/호텔/학교)
  const zonesArr = Array.isArray(mapObj?.zones) ? mapObj.zones : [];
  const zone = zonesArr.find((z) => String(z?.zoneId || '') === zId) || null;
  return zoneNameHasKiosk(zone?.name || '');
}

function canUseKioskAtWorldTime(day, phase) {
  // 실제 ER 일반 Kiosk는 게임 시작부터 접근 가능하고, 사용 제약은 크레딧/위치 쪽이 핵심이다.
  return Number(day || 1) >= 1 && !!String(phase || 'morning');
}


// --- 월드 스폰(맵 이벤트): 전설 재료 상자/보스(알파/오메가/위클라인) ---
// 목적: "랜덤 조우"가 아니라, 날짜/낮 조건에 따라 맵 어딘가에 스폰 → 해당 구역에 들어가면 조우/획득.
// NOTE: 시뮬 페이지(클라이언트) 기준의 단순 월드 상태이며, 서버 영구 저장은 추후 단계에서 연결.

function createInitialSpawnState(mapId = '') {
  return {
    mapId: String(mapId || ''),
    // 🦌 야생동물 스폰(존별 카운트): 매 페이즈에 최소 수량을 유지(Top-up)
    // - 목적: '확률 조우'만으로는 파밍 루프(크레딧/키오스크)가 약해져서,
    //   월드 상태로 "존에 야생동물이 충분히 존재"하도록 관리합니다.
    wildlife: {},
    // 전설 재료 상자(드랍된 상자) 목록: 열린 상자는 일정 기간 후 정리
    legendaryCrates: [],
    // 자연 코어(운석/생명의 나무) 스폰: 2일차 낮 이후 일부 구역에 스폰 → 해당 구역 진입 시 습득
    coreNodes: [],
    // 음식 상자(드랍된 상자): 매일 낮 시작 시 일부 구역에 스폰
    foodCrates: [],
    // 보스(구역에 1개씩 스폰): 살아있으면 유지, 처치되면 다시 스폰 가능
    bosses: {
      alpha: null,
      omega: null,
      weakline: null,
    },
    // 마지막 스폰 날짜(낮 페이즈 시작 시 1회만 생성)
    spawnedDay: {
      legendary: -1,
      core: -1,
      food: -1,
      alpha: -1,
      omega: -1,
      weakline: -1,
      wildlife: -1,
    },
    // 내부 카운터(id 생성용)
    counters: { crate: 0, core: 0, food: 0 },
  };
}


function cloneSpawnState(state, mapId = '') {
  const safe = state && typeof state === 'object' ? state : null;
  const mid = String(mapId || '');
  if (!safe || String(safe.mapId || '') !== mid) return createInitialSpawnState(mid);

  const spawnedDay = {
    legendary: Number(safe?.spawnedDay?.legendary ?? -1),
    core: Number(safe?.spawnedDay?.core ?? -1),
    food: Number(safe?.spawnedDay?.food ?? -1),
    alpha: Number(safe?.spawnedDay?.alpha ?? -1),
    omega: Number(safe?.spawnedDay?.omega ?? -1),
    weakline: Number(safe?.spawnedDay?.weakline ?? -1),
    wildlife: Number(safe?.spawnedDay?.wildlife ?? -1),
  };

  const counters = {
    crate: Number(safe?.counters?.crate ?? 0),
    core: Number(safe?.counters?.core ?? 0),
    food: Number(safe?.counters?.food ?? 0),
  };

  return {
    mapId: String(safe.mapId || ''),
    wildlife: (safe.wildlife && typeof safe.wildlife === 'object') ? { ...safe.wildlife } : {},
    legendaryCrates: Array.isArray(safe.legendaryCrates) ? safe.legendaryCrates.map((c) => ({ ...c })) : [],
    coreNodes: Array.isArray(safe.coreNodes) ? safe.coreNodes.map((n) => ({ ...n })) : [],
    foodCrates: Array.isArray(safe.foodCrates) ? safe.foodCrates.map((c) => ({ ...c })) : [],
    bosses: {
      alpha: safe?.bosses?.alpha ? { ...safe.bosses.alpha } : null,
      omega: safe?.bosses?.omega ? { ...safe.bosses.omega } : null,
      weakline: safe?.bosses?.weakline ? { ...safe.bosses.weakline } : null,
    },
    spawnedDay,
    counters,
  };
}


function zoneHasKioskFlag(zone) {
  if (!zone) return false;
  if (typeof zone?.hasKiosk === 'boolean') return !!zone.hasKiosk;
  // name/zoneId 기반 휴리스틱(기본 구역 세트 대응)
  return zoneNameHasKiosk(zone?.name || '') || zoneNameHasKiosk(zone?.zoneId || '');
}

function getEligibleSpawnZoneIds(zones, forbiddenIds) {
  const list = Array.isArray(zones) ? zones : [];
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  return list
    .map((z) => ({ zid: String(z?.zoneId || ''), z }))
    .filter(({ zid }) => !!zid)
    .filter(({ zid, z }) => !forb.has(String(zid)) && !zoneHasKioskFlag(z))
    .map(({ zid }) => zid);
}


// LEGACY: 데이터(coreSpawn/coreSpawnZones) 누락 대비 기본 허용 구역
const LEGACY_CORE_ZONE_IDS = ['beach', 'forest', 'stream', 'pond', 'factory', 'port'];
const LEGACY_CORE_ZONE_NAME_KEYS = ['모래사장', '숲', '개울', '연못', '공장', '항구'];


function zoneAllowsNaturalCore(zone, allowSet) {
  if (!zone) return false;
  // 키오스크 구역은 자연 코어 스폰 제외(안전지대 느낌)
  if (zoneHasKioskFlag(zone)) return false;

  const zid = String(zone?.zoneId || '');

  // 맵 단위 허용 리스트가 있으면 최우선
  if (allowSet instanceof Set && allowSet.size) {
    return zid && allowSet.has(zid);
  }

  // zones[*].coreSpawn 플래그가 있으면 그걸 사용
  if (typeof zone?.coreSpawn === 'boolean') return !!zone.coreSpawn;

  // 데이터가 없으면 기본 허용 구역(레거시)만 허용
  const nm = String(zone?.name || '');
  return LEGACY_CORE_ZONE_IDS.includes(zid) || LEGACY_CORE_ZONE_NAME_KEYS.includes(nm);
}

function getEligibleCoreSpawnZoneIds(zones, forbiddenIds, coreSpawnZoneIds) {
  const list = Array.isArray(zones) ? zones : [];
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const allowSet = Array.isArray(coreSpawnZoneIds) && coreSpawnZoneIds.length ? new Set(coreSpawnZoneIds.map(String)) : null;

  return list
    .map((z) => ({ zid: String(z?.zoneId || ''), z }))
    .filter(({ zid }) => !!zid)
    .filter(({ zid, z }) => !forb.has(String(zid)) && zoneAllowsNaturalCore(z, allowSet))
    .map(({ zid }) => zid);
}


// --- 로컬 설정: 변이 야생동물(밤) 스폰 구역 ---
function localKeyMutantWildlifeZone(mapId) {
  const id = String(mapId || '').trim();
  return id ? `eh_mutant_spawn_zone_${id}` : '';
}

function readLocalString(key) {
  const k = String(key || '').trim();
  if (!k) return '';
  if (typeof window === 'undefined') return '';
  try {
    return String(window.localStorage.getItem(k) || '');
  } catch {
    return '';
  }
}

function getMutantWildlifeSpawnZoneId(mapId) {
  const k = localKeyMutantWildlifeZone(mapId);
  return readLocalString(k);
}

function getHyperloopDeviceZoneId(mapId) {
  const k = localKeyHyperloopDeviceZone(mapId);
  return readLocalString(k);
}

function ensureWorldSpawns(prevState, zones, forbiddenIds, curDay, curPhase, mapId, coreSpawnZoneIds, ruleset) {
  const announcements = [];
  const s = cloneSpawnState(prevState, mapId);

  const ws = ruleset?.worldSpawns || {};
  const coreRule = ws.core || {};
  const legRule = ws.legendaryCrate || {};
  const bossRule = ws.bosses || {};
  const foodRule = ws.foodCrate || {};

  const coreGateDay = Number(coreRule?.gateDay ?? 2);
  const coreDiv = Math.max(1, Number(coreRule?.scaleDiv ?? 7));
  const coreMaxPerDay = Math.max(1, Number(coreRule?.perDayMax ?? 2));
  const coreKeepDays = Math.max(1, Number(coreRule?.keepDays ?? 2));

  const legGateDay = Number(legRule?.gateDay ?? 3);
  const legDiv = Math.max(1, Number(legRule?.scaleDiv ?? 6));
  const legMaxPerDay = Math.max(1, Number(legRule?.perDayMax ?? 3));
  const legKeepDays = Math.max(1, Number(legRule?.keepDays ?? 3));

  const foodGateDay = Number(foodRule?.gateDay ?? 1);
  const foodDiv = Math.max(1, Number(foodRule?.scaleDiv ?? 5));
  const foodMaxPerDay = Math.max(1, Number(foodRule?.perDayMax ?? 4));
  const foodKeepDays = Math.max(1, Number(foodRule?.keepDays ?? 2));

  const timeOfDay = getTimeOfDayFromPhase(curPhase);
  const d = Number(curDay || 0);
  const p = String(curPhase || '');
  const spawnKey = d + (p === 'night' ? 0.5 : 0.0);

  // 오래된/열린 오브젝트 정리(중복 선언 방지: 함수 말미에서 1회만 수행)

  const eligible = getEligibleSpawnZoneIds(zones, forbiddenIds);
  if (!eligible.length) return { state: s, announcements };

  // --- 🦌 야생동물 스폰(존별 카운트): 매 페이즈 Top-up ---
  // 목적:
  // - '확률 조우'만으로는 파밍 루프(크레딧→키오스크→전설/초월 제작)가 약해지므로,
  //   월드 스폰 상태로 "각 존에 야생동물이 충분히 존재"하도록 유지합니다.
  // - UI/로그에서 total/empty를 쉽게 확인(요청: "매 페이즈 스폰 체크")
  try {
    const wildRule = ws?.wildlife || {};
    const perZoneMinDay = Math.max(0, Number(wildRule?.perZoneMinDay ?? 2));
    const perZoneMinNight = Math.max(0, Number(wildRule?.perZoneMinNight ?? 2));
    const extraTotalDay = Math.max(0, Number(wildRule?.extraTotalDay ?? eligible.length));
    const extraTotalNight = Math.max(0, Number(wildRule?.extraTotalNight ?? eligible.length));

    const perZoneMin = (timeOfDay === 'day') ? perZoneMinDay : perZoneMinNight;
    const extraTotal = (timeOfDay === 'day') ? extraTotalDay : extraTotalNight;
    const targetTotal = Math.max(0, eligible.length * perZoneMin + extraTotal);

    // per-phase 키(낮/밤 분리)
    if (Number(s?.spawnedDay?.wildlife) !== spawnKey) {
      if (!s.wildlife || typeof s.wildlife !== 'object') s.wildlife = {};

      // 정리: 현재 맵의 eligible 존만 유지
      const allow = new Set(eligible.map(String));
      Object.keys(s.wildlife).forEach((k) => {
        if (!allow.has(String(k))) delete s.wildlife[k];
      });

      // 1) 각 존 최소치 보장
      for (const zid0 of eligible) {
        const zid = String(zid0 || '');
        if (!zid) continue;
        const cur = Math.max(0, Number(s.wildlife[zid] ?? 0));
        s.wildlife[zid] = Math.max(cur, perZoneMin);
      }

      // 2) 추가 스폰(핫스팟 가중치 분배)
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
      let totalNow = sumNow();
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


  // --- 자연 코어(운석/생명의 나무): ER 타임라인 기반 ---
  // - 운석: Day 1 Night부터 낮/밤 사이클 전환마다 1개, 총 4개
  // - 생명의 나무: Day 1 Night 2개, Day 2 Night 2개
  // 위치는 시뮬에선 eligibleCore(어드민 지정 coreSpawnZones 우선)에서 랜덤 배치
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

  // --- 음식 상자(Blue Air Supply Box): ER 타임라인 기반 ---
  // Day 2: 3 / Night 2: 3 / Day 3: 2 / Night 3: 1
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

  // --- 전설 재료 상자: 3일차 '낮' 이후, 매일 낮 시작에 N개 드랍 ---
  if (timeOfDay === 'day' && Number(curDay || 0) >= legGateDay && Number(s.spawnedDay.legendary) !== Number(curDay || 0)) {
    const alreadyToday = new Set(
      (Array.isArray(s.legendaryCrates) ? s.legendaryCrates : [])
        .filter((c) => Number(c?.spawnedDay) === Number(curDay || 0))
        .map((c) => String(c?.zoneId))
    );

    const maxNew = Math.min(legMaxPerDay, Math.max(1, Math.floor(eligible.length / legDiv) || 1)); // 맵 크기에 따라 1~3개
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

  // --- 보스(알파/오메가/위클라인): ER 타임라인 기반 ---
  function spawnBossAt(kind, targetDay) {
    const k = String(kind);
    if (p !== 'night') return;
    if (d !== Number(targetDay || 0)) return;

    const existing = s?.bosses?.[k];
    if (existing) return; // ER: 1회 스폰

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

  // --- 변이 야생동물(요청): 매 밤 시작 시 1마리 스폰(로컬 설정 zone 우선) ---
  if (String(curPhase || '') === 'morning') {
    // 낮 시작 시: 전날 밤 스폰은 정리(남아있어도 아침에 사라짐)
    if (s.mutantWildlife) s.mutantWildlife = null;
  }

  if (String(curPhase || '') === 'night') {
    const d = Number(curDay || 0);
    s.spawnedDay = s.spawnedDay || {};
    const already = Number(s.spawnedDay.mutantWildlife || 0) === d && s?.mutantWildlife?.alive;
    if (!already) {
      const cfgZid = String(getMutantWildlifeSpawnZoneId(mapId) || '').trim();
      // 어드민에서 지정한 스폰 구역은 금지구역 여부와 무관하게 "존재하면" 우선 적용
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
        s.spawnedDay.mutantWildlife = d;
        announcements.push(`🧪 변이 야생동물(${animal})이 출현했다!`);
      }
    }
  }

  // 오래된/열린 오브젝트 정리
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


function openSpawnedLegendaryCrate(spawnState, zoneId, publicItems, curDay, curPhase, actor, ruleset, opts = {}) {
  const s = spawnState;
  if (!s || !Array.isArray(s.legendaryCrates)) return null;

  const zid = String(zoneId || '');
  const crate = s.legendaryCrates.find((c) => !c?.opened && String(c?.zoneId) === zid) || null;
  if (!crate) return null;

  // 스폰된 상자는 "있으면 거의 연다" 느낌(다만 밤엔 덜 적극적)
  const moved = !!opts.moved;
  const timeOfDay = getTimeOfDayFromPhase(curPhase);
  const ws = ruleset?.worldSpawns || {};
  const legRule = ws?.legendaryCrate || {};
  const oc = legRule?.openChance || {};
  const byTod = (timeOfDay === 'day' ? oc.day : oc.night) || {};
  const chance = moved
    ? Number(byTod?.moved ?? (timeOfDay === 'day' ? 0.85 : 0.55))
    : Number(byTod?.stay ?? (timeOfDay === 'day' ? 0.65 : 0.35));
  if (Math.random() >= chance) return null;

  const candidates = getLegendaryCoreCandidates(publicItems, legRule?.dropWeightsByKey);
  if (!candidates.length) return null;

  const picked = pickWeighted(candidates);
  const item = picked?.item || null;
  if (!item?._id) return null;

  crate.opened = true;
  crate.openedBy = String(actor?.name || 'unknown');
  crate.openedAt = { day: Number(curDay || 0), phase: String(curPhase || '') };

  const reward = legRule?.reward || {};
  const cr = reward?.credits || {};
  const minCr = Number(cr?.min ?? 0);
  const maxCr = Number(cr?.max ?? 0);
  const credits = Math.max(0, randInt(Math.min(minCr, maxCr), Math.max(minCr, maxCr)));

  const bonusChance = Math.max(0, Math.min(1, Number(reward?.bonusDropChance ?? 0)));
  let bonusDrops = [];
  if (bonusChance > 0 && Math.random() < bonusChance) {
    const rest = candidates.filter((c) => String(c?.key || '') !== String(picked?.key || ''));
    const bonusPicked = pickWeighted(rest.length ? rest : candidates);
    const bItem = bonusPicked?.item || null;
    if (bItem?._id) {
      bonusDrops = [{ item: bItem, itemId: String(bItem._id), qty: 1 }];
    }
  }

  return { item, itemId: String(item._id), qty: 1, credits, bonusDrops, crateType: 'legendary_material', zoneId: zid };
}

function openSpawnedFoodCrate(spawnState, zoneId, publicItems, curDay, curPhase, actor, ruleset, opts = {}) {
  const s = spawnState;
  if (!s || !Array.isArray(s.foodCrates)) return null;

  const zid = String(zoneId || '');
  const crate = s.foodCrates.find((c) => !c?.opened && String(c?.zoneId) === zid) || null;
  if (!crate) return null;

  const moved = !!opts.moved;
  const timeOfDay = getTimeOfDayFromPhase(curPhase);
  const ws = ruleset?.worldSpawns || {};
  const rule = ws?.foodCrate || {};
  const oc = rule?.openChance || {};
  const byTod = (timeOfDay === 'day' ? oc.day : oc.night) || {};
  const chance = moved
    ? Number(byTod?.moved ?? (timeOfDay === 'day' ? 0.70 : 0.45))
    : Number(byTod?.stay ?? (timeOfDay === 'day' ? 0.55 : 0.30));
  if (Math.random() >= chance) return null;

  const list = Array.isArray(publicItems) ? publicItems : [];

  // 룰셋 기반 보상 풀/가중치(음식 vs 의료 vs 하급 재료)
  const rt = (ruleset?.worldSpawns || {})?.foodCrate?.rewardTable || {};
  const cats = Array.isArray(rt?.categories) ? rt.categories : [];
  const boosts = rt?.boosts || {};

  // 페이즈(낮/밤)/맵별 카테고리 가중치 보정(옵션)
  // - rulesets.js의 rewardTable.phaseMulByCat / mapMulByMapId
  const pm = rt?.phaseMulByCat || {};
  const mm = rt?.mapMulByMapId || {};
  const byPhase = (timeOfDay === 'day' ? pm.day : pm.night) || {};
  const byMap = mm?.[String(s?.mapId || '')] || mm?.default || {};
  function catMul(key) {
    const k = String(key || '');
    const a = Number(byPhase?.[k] ?? 1);
    const b = Number(byMap?.[k] ?? 1);
    const mul = (Number.isFinite(a) ? a : 1) * (Number.isFinite(b) ? b : 1);
    return Number.isFinite(mul) && mul > 0 ? mul : 1;
  };

  function buildFoodCrateCandidates(key, tierCap) {
    const want = String(key || 'food');
    const cap = Math.max(1, Number(tierCap || 1));
    const out = [];
    for (const it of list) {
      if (!it?._id) continue;
      const sp = classifySpecialByName(it?.name);
      if (sp) continue;

      const cat = inferItemCategory(it);
      const tags = safeTags(it);
      const t = String(it?.type || '').toLowerCase();
      const name = String(it?.name || '');
      const lower = name.toLowerCase();

      if (want === 'food') {
        if (cat !== 'consumable') continue;
        const ok = t === 'food' || tags.includes('food') || name.includes('음식') || name.includes('빵') || name.includes('고기');
        if (!ok) continue;

        let w = 3;
        if (tags.includes('healthy')) w += Math.max(0, Number(boosts?.healthyFood || 0));
        out.push({ item: it, itemId: String(it._id), weight: w });
        continue;
      }

      if (want === 'medical') {
        if (cat !== 'consumable') continue;
        const ok = tags.includes('heal') || tags.includes('medical') || lower.includes('bandage') || lower.includes('medkit') || name.includes('붕대') || name.includes('응급');
        if (!ok) continue;

        let w = 3;
        if (name.includes('붕대')) w += Math.max(0, Number(boosts?.bandageName || 0));
        out.push({ item: it, itemId: String(it._id), weight: w });
        continue;
      }

      if (want === 'material') {
        if (cat !== 'material') continue;
        const tier = clampTier4(it?.tier || 1);
        if (tier > cap) continue;
        const w = tier <= 1 ? 2 : 1;
        out.push({ item: it, itemId: String(it._id), weight: w });
        continue;
      }
    }
    return out;
  }

  const pickedCat = pickWeighted((cats || [])
    .map((c) => {
      const base = Number(c?.weight || 0);
      const w = base * catMul(c?.key);
      return { item: c, weight: w };
    })
    .filter((x) => Number(x?.weight || 0) > 0))?.item || { key: 'food', weight: 1, qty: { min: 1, max: 1 }, tierCap: 1 };

  const catKey = String(pickedCat?.key || 'food');
  const qtyMin = Math.max(1, Number(pickedCat?.qty?.min ?? 1));
  const qtyMax = Math.max(qtyMin, Number(pickedCat?.qty?.max ?? qtyMin));
  const tierCap = Math.max(1, Number(pickedCat?.tierCap ?? 1));

  let candidates = buildFoodCrateCandidates(catKey, tierCap);
  // 후보가 없으면 음식 → 의료 → 재료 순으로 약한 폴백
  if (!candidates.length && catKey !== 'food') candidates = buildFoodCrateCandidates('food', tierCap);
  if (!candidates.length && catKey !== 'medical') candidates = buildFoodCrateCandidates('medical', tierCap);
  if (!candidates.length && catKey !== 'material') candidates = buildFoodCrateCandidates('material', tierCap);

  const picked = pickWeighted(candidates);
  if (!picked?.itemId) return null;
  crate.opened = true;
  crate.openedBy = String(actor?.name || 'unknown');
  crate.openedAt = { day: Number(curDay || 0), phase: String(curPhase || '') };

  const reward = rule?.reward || {};
  const cr = reward?.credits || {};
  const minCr = Number(cr?.min ?? 0);
  const maxCr = Number(cr?.max ?? 0);
  const credits = Math.max(0, randInt(Math.min(minCr, maxCr), Math.max(minCr, maxCr)));

  const qty = Math.max(1, randInt(qtyMin, qtyMax));
  return { item: picked.item, itemId: String(picked.itemId), qty, credits, crateType: 'food', zoneId: zid };
}



function pickupSpawnedCore(spawnState, zoneId, publicItems, curDay, curPhase, actor, ruleset, opts = {}) {
  const s = spawnState;
  if (!s || !Array.isArray(s.coreNodes)) return null;

  const zid = String(zoneId || '');
  const node = s.coreNodes.find((n) => !n?.picked && String(n?.zoneId) === zid) || null;
  if (!node) return null;

  const ws = ruleset?.worldSpawns || {};
  const coreRule = ws?.core || {};

  // 스폰된 코어는 "존재하면 거의 무조건" 주워가는 느낌(ER 메인 오브젝트)
  // - 필요하면 룰셋에서 alwaysPick=false로 되돌릴 수 있음
  const alwaysPick = coreRule?.alwaysPick !== false;
  if (!alwaysPick) {
    const moved = !!opts.moved;
    const timeOfDay = getTimeOfDayFromPhase(curPhase);
    const pc = coreRule?.pickChance || {};
    const byTod = (timeOfDay === 'day' ? pc.day : pc.night) || {};
    const chance = moved
      ? Number(byTod?.moved ?? (timeOfDay === 'day' ? 0.85 : 0.55))
      : Number(byTod?.stay ?? (timeOfDay === 'day' ? 0.65 : 0.35));
    if (Math.random() >= chance) return null;
  }

  const kind = String(node?.kind || '');
  let item = null;
  if (kind === 'meteor') item = findItemByKeywords(publicItems, ['운석', 'meteor']);
  if (kind === 'life_tree') item = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);

  if (!item?._id) {
    // ✅ 서버 아이템 트리에 특수 재료가 없거나 이름이 달라도 시뮬이 멈추지 않도록 "가상 아이템" 생성
    if (kind === 'meteor') item = { _id: 'SIM_MATERIAL_METEOR', name: '운석', type: '재료', tier: 4, tags: ['legendary_core', 'meteor'] };
    if (kind === 'life_tree') item = { _id: 'SIM_MATERIAL_LIFETREE', name: '생명의 나무', type: '재료', tier: 4, tags: ['legendary_core', 'life_tree'] };
  }
  if (!item?._id) return null;

  node.picked = true;
  node.pickedBy = String(actor?.name || 'unknown');
  node.pickedAt = { day: Number(curDay || 0), phase: String(curPhase || '') };

  return { item, itemId: String(item._id), qty: 1, kind };
}


function consumeBossAtZone(spawnState, zoneId, publicItems, curDay, curPhase, actor, ruleset) {
  const s = spawnState;
  if (!s || !s.bosses) return null;

  const zid = String(zoneId || '');
  const ws = ruleset?.worldSpawns || {};
  const bossRule = ws?.bosses || {};
  const fallback = ws?.bossFallback || {};

  const retreatBase = Number(fallback?.retreatBase ?? 0.20);
  const retreatPowerBonusMax = Number(fallback?.retreatPowerBonusMax ?? 0.25);
  const perkFx = getActorPerkEffects(actor);
  const perkWildLootBias = Math.max(0, getPerkWildlifeLootBias(perkFx));

  const kinds = ['alpha', 'omega', 'weakline'];
  for (const k of kinds) {
    const b = s?.bosses?.[k];
    if (!b || !b.alive) continue;
    if (String(b.zoneId) !== zid) continue;

    const p = roughPower(actor);
    const powerBonus = Math.min(retreatPowerBonusMax, Math.max(0, (p - 40) / 240));

    const cfg = bossRule?.[k] || {};
    const kw = Array.isArray(cfg?.dropKeywords) ? cfg.dropKeywords : (k === 'omega'
      ? ['포스 코어', 'force core', 'forcecore']
      : k === 'weakline'
        ? ['vf 혈액', 'vf 샘플', 'blood sample', '혈액 샘플', 'vf']
        : ['미스릴', 'mithril']);

    const dmgCfg = cfg?.dmg || {};
    const dmgMin = Math.max(0, Number(dmgCfg?.min ?? (k === 'omega' ? 8 : 6)));
    const dmgBase = Number(dmgCfg?.base ?? (k === 'omega' ? 26 : k === 'weakline' ? 18 : 22));
    const dmgDiv = Math.max(1, Number(dmgCfg?.scaleDiv ?? (k === 'weakline' ? 10 : 9)));

    const drop = findItemByKeywords(publicItems, kw);
    const dmg = Math.max(dmgMin, dmgBase - Math.floor(p / dmgDiv));

    if (drop?._id) {
      b.alive = false;
      b.defeatedBy = String(actor?.name || '');
      b.defeatedAt = { day: Number(curDay || 0), phase: String(curPhase || '') };

      const label = k === 'alpha' ? '알파' : k === 'omega' ? '오메가' : '위클라인';
      const log = k === 'alpha'
        ? `🐺 야생동물(${label}) 사냥 성공! 미스릴 획득`
        : k === 'omega'
          ? `🧿 변이체(${label}) 격파! 포스 코어 획득`
          : `🧬 변이체(${label}) 처치! VF 혈액 샘플 + (운석/생명의 나무) 획득`;

      const rw = cfg?.reward || {};
      const cr = rw?.credits || {};
      const minCr = Number(cr?.min ?? 0);
      const maxCr = Number(cr?.max ?? 0);
      const credits = Math.max(0, randInt(Math.min(minCr, maxCr), Math.max(minCr, maxCr)));

      const bonusChance = Math.max(0, Math.min(1, Number(rw?.bonusDropChance ?? 0)));
      const drops = [{ item: drop, itemId: String(drop._id), qty: 1 }];
      if (bonusChance > 0 && Math.random() < bonusChance) {
        // 단순화: "추가드랍"은 동일 재료 1개 추가(룰셋으로 확률 고정)
        drops.push({ item: drop, itemId: String(drop._id), qty: 1 });
      }

      // ✅ 요청: 위클라인은 VF 혈액 샘플 1개 + (운석 또는 생명의 나무) 1개 드랍
      if (k === 'weakline') {
        const meteor = findItemByKeywords(publicItems, ['운석', 'meteor']);
        const tree = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);
        const pick = (Math.random() < 0.5 ? meteor : tree) || meteor || tree;
        if (pick?._id) drops.push({ item: pick, itemId: String(pick._id), qty: maybeBoostDropQty(1, perkWildLootBias * 0.22, 1) });
      }

      return {
        kind: k,
        damage: dmg,
        credits,
        drops,
        log,
      };
    }

    // 아이템이 없으면(데이터 미구축) 보스는 그냥 "도망" 처리(상태 유지)
    if (Math.random() < retreatBase + powerBonus) {
      return { kind: k, damage: 0, drops: [], log: `⚠️ 강력한 적과 조우했지만(아이템 미구축) 물러났다` };
    }
  }


  return null;
}

// --- 변이 야생동물(요청): 밤 스폰(로컬 설정 zone) 조우/소모 ---
function consumeMutantWildlifeAtZone(spawnState, zoneId, publicItems, curDay, curPhase, actor, ruleset) {
  const s = spawnState;
  const m = s?.mutantWildlife;
  if (!m || !m.alive) return null;

  const zid = String(zoneId || '');
  if (String(m.zoneId) !== zid) return null;

  const p = roughPower(actor);
  const dmg = Math.max(4, 14 - Math.floor(p / 12));
  const credit = Math.max(0, Number(ruleset?.credits?.mutantWildlifeKill ?? 8));

  m.alive = false;
  m.defeatedBy = String(actor?.name || '');
  m.defeatedAt = { day: Number(curDay || 0), phase: String(curPhase || '') };

  const animal = String(m.animal || '').trim() || '미상';

  // ✅ 드랍(요청)
  // - 변이닭: 1/2 확률로 치킨 1개
  // - 변이멧돼지: 고기 4개
  // - 변이곰/늑대/들개: 고기 2개
  // - 박쥐는 고기 드랍 없음
  const drops = [];
  const meat = findItemByKeywords(publicItems, ['고기']);
  const chicken = findItemByKeywords(publicItems, ['치킨']);
  const nm = animal;
  const low = nm.toLowerCase();

  const isBat = nm.includes('박쥐') || low.includes('bat');
  const isChicken = nm.includes('닭') || low.includes('chicken');
  const isBoar = nm.includes('멧돼지') || low.includes('boar');
  const isBear = nm.includes('곰') || low.includes('bear');
  const isWolf = nm.includes('늑대') || low.includes('wolf');
  const isDog = nm.includes('들개') || low.includes('dog');

  if (!isBat) {
    if (isChicken) {
      if (chicken?._id && Math.random() < 0.5) {
        drops.push({ item: chicken, itemId: String(chicken._id), qty: 1 });
      }
    } else if (isBoar) {
      if (meat?._id) drops.push({ item: meat, itemId: String(meat._id), qty: 4 });
    } else if (isBear || isWolf || isDog) {
      if (meat?._id) drops.push({ item: meat, itemId: String(meat._id), qty: 2 });
    }
  }

  // ✅ 모든 변이동물: 10% 확률로 운석 또는 생명의 나무 드랍
  if (Math.random() < 0.10) {
    const meteor = findItemByKeywords(publicItems, ['운석', 'meteor']);
    const tree = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);
    const pick = (Math.random() < 0.5 ? meteor : tree) || meteor || tree;
    if (pick?._id) drops.push({ item: pick, itemId: String(pick._id), qty: 1 });
  }

  return {
    kind: 'mutant_wildlife',
    damage: dmg,
    credits: credit,
    drops,
    log: `🧪 변이 야생동물(${animal}) 처치! (+${credit} Cr)`,
  };
}


// --- 아이템 특수 분류(구매/스폰 규칙용) ---
function classifySpecialByName(name) {
  const nm = String(name || '').toLowerCase();
  if (!nm) return '';
  // VF 혈액 샘플
  if ((nm.includes('vf') && (nm.includes('혈액') || nm.includes('샘플') || nm.includes('sample'))) || nm.includes('blood sample')) return 'vf';
  // 4대 전설 재료
  if (nm.includes('운석') || nm.includes('meteor')) return 'meteor';
  if ((nm.includes('생명') && nm.includes('나무')) || nm.includes('tree of life') || nm.includes('life tree')) return 'life_tree';
  if (nm.includes('미스릴') || nm.includes('mithril')) return 'mithril';
  if ((nm.includes('포스') && nm.includes('코어')) || nm.includes('force core') || nm.includes('forcecore')) return 'force_core';
  return '';
}

function isSpecialCoreKind(kind) {
  return kind === 'meteor' || kind === 'life_tree' || kind === 'mithril' || kind === 'force_core';
}

function computeCraftTierFromIngredients(ingredients, itemMetaById, itemNameById) {
  // 제작 규칙(요청):
  // - 하급 재료 2개 -> 일반(1)
  // - 일반 장비 1 + 하급 1 -> 희귀(3)
  // - 희귀 장비 1 + 하급 1 -> 영웅(4)
  // - 하급 1 + 운석/생나/포스코어/미스릴 -> 전설(5)
  // - 하급 1 + VF 혈액 샘플 -> 초월(6)
  const ings = Array.isArray(ingredients) ? ingredients : [];

  let hasVf = false;
  let hasLegendaryMat = false;
  let hasEquip = false;
  let maxEquipTier = 0;
  let lowMatCount = 0;

  for (const x of ings) {
    const id = String(x?.itemId || '');
    if (!id) continue;
    const qty = Math.max(1, Number(x?.qty || 1));

    const meta = (itemMetaById && itemMetaById[id]) ? itemMetaById[id] : null;
    const name = String(meta?.name || itemNameById?.[id] || '');
    const kind = classifySpecialByName(name);

    if (kind === 'vf') hasVf = true;
    if (isSpecialCoreKind(kind)) hasLegendaryMat = true;

    const pseudoItem = { name, type: meta?.type, tags: meta?.tags, tier: meta?.tier };
    const cat = inferItemCategory(pseudoItem);
    if (cat === 'equipment') {
      hasEquip = true;
      maxEquipTier = Math.max(maxEquipTier, clampTier4(meta?.tier || pseudoItem?.tier || 1));
    } else if (cat === 'material') {
      // 특수 재료는 별도 처리(전설/초월)
      if (!kind) lowMatCount += qty;
    }
  }

  if (hasVf) return 6;
  if (hasLegendaryMat) return 5;

  if (hasEquip && lowMatCount >= 1) {
    // 일반(1) 장비 + 하급 -> 희귀(3), 희귀(3) 장비 + 하급 -> 영웅(4)
    return maxEquipTier >= 3 ? 4 : 3;
  }
  if (!hasEquip && lowMatCount >= 2) {
    return 1;
  }
  // fallback: 목표 아이템의 원래 tier를 크게 벗어나지 않도록 보정
  return clampTier4(Math.max(1, maxEquipTier || 1));
}

function applyEquipTier(item, tier) {
  if (!item) return item;
  const t = clampTier4(tier);
  return { ...item, tier: t, rarity: tierLabelKo(t) };
}

function isItemInMapCrates(mapObj, itemId) {
  const id = String(itemId || '');
  if (!id) return false;
  const crates = Array.isArray(mapObj?.itemCrates) ? mapObj.itemCrates : [];
  for (const c of crates) {
    const lt = Array.isArray(c?.lootTable) ? c.lootTable : [];
    if (lt.some((e) => String(e?.itemId || '') === id)) return true;
  }
  return false;
}

// --- 간단 조합 목표(=AI 조달 우선순위) ---
// "이미 일부 재료를 들고 있고, 부족한 재료가 적은" 상위 티어 레시피를 우선으로 선택합니다.
function normalizeGoalTier(tier) {
  const t = Number(tier);
  if (t === 4 || t === 5 || t === 6) return t;
  return 6;
}

function pickGoalLoadoutBySlot(actor) {
  const t = normalizeGoalTier(actor?.goalGearTier ?? 6);
  const g = actor?.goalLoadouts && typeof actor.goalLoadouts === 'object' ? actor.goalLoadouts : {};
  const b = (t === 4 ? g.hero : t === 5 ? g.legend : g.transcend) || null;
  if (!b || typeof b !== 'object') return { weapon: '', head: '', clothes: '', arm: '', shoes: '' };
  return {
    weapon: String(b.weaponKey || '').trim(),
    head: String(b.headKey || '').trim(),
    clothes: String(b.clothesKey || '').trim(),
    arm: String(b.armKey || '').trim(),
    shoes: String(b.shoesKey || '').trim(),
  };
}

function pickGoalLoadoutKeys(actor) {
  const b = pickGoalLoadoutBySlot(actor);
  return [b.weapon, b.head, b.clothes, b.arm, b.shoes].filter(Boolean);
}

function getOneSpecialShortMissing(craftGoal) {
  const miss = Array.isArray(craftGoal?.missing) ? craftGoal.missing : [];
  const tier = Number(craftGoal?.tier || craftGoal?.target?.tier || 0);
  if (miss.length !== 1 || tier < 5) return null;
  const m = miss[0] || null;
  const key = String(m?.special || classifySpecialByName(m?.name) || '');
  if (!key || (!isSpecialCoreKind(key) && key !== 'vf')) return null;
  return { ...m, special: key, targetTier: tier, targetName: String(craftGoal?.target?.name || '') };
}

function buildCraftGoal(inventory, craftables, itemNameById, opts) {
  const list = Array.isArray(craftables) ? craftables : [];
  if (!list.length) return null;

  const goalTier = normalizeGoalTier(opts?.goalTier ?? 6);
  const goalKeysRaw = opts?.goalItemKeys instanceof Set ? [...opts.goalItemKeys] : (Array.isArray(opts?.goalItemKeys) ? opts.goalItemKeys : []);
  const goalKeys = new Set(goalKeysRaw.map((x) => String(x || '').trim()).filter(Boolean));
  const perkFx = normalizePerkEffects(opts?.perkEffects);
  const goalWeightBonus = Math.max(0, perkNumber(perkFx.goalWeightPlus || 0));
  const craftBias = Math.max(0, perkNumber(perkFx.craftChancePlus || 0));

  let best = null;

  for (const it of list) {
    const tier = Number(it?.tier || 1);
    if (tier > goalTier) continue;

    const ings = compactIO(it?.recipe?.ingredients || []);
    if (!ings.length) continue;

    let haveSlots = 0;
    const missing = [];

    for (const ing of ings) {
      const id = String(ing?.itemId || '');
      const need = Math.max(1, Number(ing?.qty || 1));
      if (!id) continue;

      const haveQty = invQty(inventory, id);
      if (haveQty >= need) haveSlots += 1;
      else {
        const nm = itemNameById?.[id] || '';
        missing.push({
          itemId: id,
          need,
          have: haveQty,
          name: nm,
          special: classifySpecialByName(nm),
        });
      }
    }

    const k = String(it?.itemKey || it?.externalId || '').trim();
    const isGoal = goalKeys.size > 0 && k && goalKeys.has(k);

    // "재료 0개 보유" 레시피는 기본적으로 제외(너무 랜덤)하되, 목표 장비는 예외
    if (haveSlots <= 0 && !isGoal) continue;

    // 너무 멀면(부족 재료가 너무 많으면) 목표로 삼지 않음
    if (missing.length > 3) continue;

    const ratio = haveSlots / Math.max(1, ings.length);
    let score = tier * 100 + ratio * (25 + craftBias * 6) - missing.length * 8;

    const oneSpecialShort = (missing.length === 1) && (tier >= 5) && (() => {
      const mk = String(missing?.[0]?.special || classifySpecialByName(missing?.[0]?.name) || '');
      return mk && (isSpecialCoreKind(mk) || mk === 'vf');
    })();

    // 공식 Saved Plan/Legendary 추천 흐름처럼, 상위 장비가 '특수 재료 1개만 부족'하면 강하게 밀어준다.
    if (oneSpecialShort) score += (tier >= 6 ? 900 : 700);

    // 목표 장비(itemKey)가 설정된 경우: 해당 결과물을 강하게 우선
    if (goalKeys.size > 0) {
      score += isGoal ? (3000 + goalWeightBonus * 600) : -20;
      if (isGoal && oneSpecialShort) score += 500;
    }

    if (!best || score > best.score) {
      best = {
        score,
        target: it,
        tier,
        missing,
        haveSlots,
        totalSlots: ings.length,
      };
    }
  }

  return best;
}

function uniqStrings(list) {
  const out = [];
  const seen = new Set();
  for (const x of Array.isArray(list) ? list : []) {
    const s = String(x || '');
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function listKioskZoneIdsForMap(mapObj, kiosks, forbiddenIds) {
  const zonesArr = Array.isArray(mapObj?.zones) ? mapObj.zones : [];
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const out = [];
  for (const z of zonesArr) {
    const zid = String(z?.zoneId || '');
    if (!zid || forb.has(zid)) continue;
    if (hasKioskAtZone(kiosks, mapObj, zid)) out.push(zid);
  }
  return uniqStrings(out);
}

function findCrateZoneIdsForItem(mapObj, itemId, forbiddenIds) {
  const crates = Array.isArray(mapObj?.itemCrates) ? mapObj.itemCrates : [];
  const id = String(itemId || '');
  if (!id) return [];
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();

  const hits = [];
  for (const c of crates) {
    const zid = String(c?.zoneId || '');
    if (!zid || forb.has(zid)) continue;
    const lt = Array.isArray(c?.lootTable) ? c.lootTable : [];
    if (lt.some((e) => String(e?.itemId || '') === id)) hits.push(zid);
  }
  return uniqStrings(hits);
}

function findCrateZoneWeightsForItem(mapObj, itemId, forbiddenIds) {
  const crates = Array.isArray(mapObj?.itemCrates) ? mapObj.itemCrates : [];
  const id = String(itemId || '');
  if (!id) return new Map();
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const out = new Map();
  for (const c of crates) {
    const zid = String(c?.zoneId || '');
    if (!zid || forb.has(zid)) continue;
    const lt = Array.isArray(c?.lootTable) ? c.lootTable : [];
    for (const e of lt) {
      if (String(e?.itemId || '') !== id) continue;
      const w = Math.max(0, Number(e?.weight ?? 1));
      out.set(zid, (out.get(zid) || 0) + w);
    }
  }
  return out;
}

function buildRuntimeSpawnMeta({ itemId, meta, itemName, mapObj, spawnState, forbiddenIds }) {
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const score = new Map();
  function add(z, w) {
    const zid = String(z || '');
    if (!zid || forb.has(zid)) return;
    score.set(zid, (score.get(zid) || 0) + Math.max(0, Number(w || 0)));
  };
  const nm = String(itemName || meta?.name || '');
  const tags = safeTags(meta).map((t) => String(t).toLowerCase());
  const spec = String(classifySpecialByName(nm) || '');
  const hintZones = Array.isArray(meta?.spawnZones) ? meta.spawnZones : [];
  const crateHints = new Set((Array.isArray(meta?.spawnCrateTypes) ? meta.spawnCrateTypes : []).map((x) => String(x || '').toLowerCase()).filter(Boolean));
  for (const raw of hintZones) {
    const t = String(raw || '').trim();
    if (!t || !Array.isArray(mapObj?.zones)) continue;
    if (/^Z\d+$/i.test(t)) { add(t.toUpperCase(), 2.4); continue; }
    mapObj.zones.filter((z) => z && z.zoneId && String(z.name || '').includes(t)).forEach((z) => add(String(z.zoneId), 1.8));
  }
  if (crateHints.size && Array.isArray(mapObj?.itemCrates)) {
    for (const c of mapObj.itemCrates) {
      const zid = String(c?.zoneId || '');
      const ct = String(c?.crateType || 'food').toLowerCase();
      if (zid && crateHints.has(ct) && !forb.has(zid)) add(zid, 1.6);
    }
  }
  for (const [z, w] of findCrateZoneWeightsForItem(mapObj, itemId, forb).entries()) add(z, 1.4 + Math.min(4, w / 4));
  if ((nm.includes('물') || tags.includes('water')) && Array.isArray(mapObj?.waterSourceZoneIds)) mapObj.waterSourceZoneIds.forEach((z) => add(z, 2.2));
  if ((nm.includes('스테이크') || tags.includes('cooked')) && Array.isArray(mapObj?.campfireZoneIds)) mapObj.campfireZoneIds.forEach((z) => add(z, 1.4));
  if ((spec === 'meteor' || spec === 'life_tree') && Array.isArray(mapObj?.coreSpawnZones)) mapObj.coreSpawnZones.forEach((z) => add(z, 2.0));
  if (spec === 'mithril' && spawnState?.bosses?.alpha?.alive && spawnState.bosses.alpha.zoneId) add(spawnState.bosses.alpha.zoneId, 2.6);
  if (spec === 'force_core' && spawnState?.bosses?.omega?.alive && spawnState.bosses.omega.zoneId) add(spawnState.bosses.omega.zoneId, 2.6);
  if (spec === 'vf' && spawnState?.bosses?.weakline?.alive && spawnState.bosses.weakline.zoneId) add(spawnState.bosses.weakline.zoneId, 3.0);
  if ((nm.includes('고기') || tags.includes('meat') || tags.includes('food')) && spawnState?.wildlife) {
    Object.entries(spawnState.wildlife)
      .map(([z, c]) => ({ z: String(z), c: Math.max(0, Number(c || 0)) }))
      .filter((x) => x.z && !forb.has(x.z))
      .sort((a, b) => (b.c - a.c) || a.z.localeCompare(b.z))
      .slice(0, 4)
      .forEach((e) => add(e.z, 1));
  }
  return {
    itemId: String(itemId || ''),
    crateTypes: [...crateHints],
    zoneWeights: [...score.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0])),
  };
}

function expandMissingResourceChain(missingList, itemMetaById, itemNameById, maxDepth = 2) {
  const seeds = Array.isArray(missingList) ? missingList : [];
  const seen = new Map();
  const out = [];
  const q = seeds
    .map((m) => ({
      itemId: String(m?.itemId || ''),
      name: String(m?.name || ''),
      depth: 0,
      chainWeight: 1,
      special: String(m?.special || ''),
    }))
    .filter((x) => x.itemId);
  while (q.length) {
    const cur = q.shift();
    const prev = Number(seen.get(cur.itemId) ?? -1);
    if (prev >= cur.chainWeight) continue;
    seen.set(cur.itemId, cur.chainWeight);
    out.push(cur);
    if (cur.depth >= maxDepth) continue;
    const meta = itemMetaById?.[cur.itemId] || null;
    const ings = compactIO(meta?.recipe?.ingredients || []);
    if (!ings.length) continue;
    for (const ing of ings) {
      const id = String(ing?.itemId || '');
      if (!id) continue;
      q.push({
        itemId: id,
        name: String(itemNameById?.[id] || itemMetaById?.[id]?.name || ''),
        depth: cur.depth + 1,
        chainWeight: cur.chainWeight * (cur.depth <= 0 ? 0.72 : 0.5),
        special: String(classifySpecialByName(itemNameById?.[id] || itemMetaById?.[id]?.name || '') || ''),
      });
    }
  }
  return out.sort((a, b) => (a.depth - b.depth) || (b.chainWeight - a.chainWeight) || a.itemId.localeCompare(b.itemId));
}

// ✅ 목표 제작(=missing 재료) 기준으로 '재료가 나올 확률이 높은 존'을 점수화
// - 1) 직접 부족 재료를 우선
// - 2) 부족 재료가 조합식이면 재료의 재료까지 역추적해서 존 점수에 반영
function pickGoalResourceZoneTargets(mapObj, spawnState, forbiddenIds, missingList, itemMetaById, itemNameById) {
  const miss = expandMissingResourceChain(missingList, itemMetaById, itemNameById, 2);
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const score = new Map();

  function addScore(z, w) {
    const zid = String(z || '');
    if (!zid || forb.has(zid)) return;
    score.set(zid, (score.get(zid) || 0) + Math.max(0, Number(w || 0)));
  };

  for (const m of miss) {
    const id = String(m?.itemId || '');
    if (!id) continue;
    const meta = itemMetaById?.[id] || null;
    const runtimeSpawnMeta = buildRuntimeSpawnMeta({
      itemId: id,
      meta,
      itemName: itemNameById?.[id] || meta?.name || m?.name || '',
      mapObj,
      spawnState,
      forbiddenIds: forb,
    });
    const mul = Math.max(0.2, Number(m?.chainWeight || 1));
    for (const [z, w] of runtimeSpawnMeta.zoneWeights) addScore(z, w * mul);
  }

  const ranked = [...score.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  return ranked.slice(0, 6).map(([z]) => z);
}

function bfsNextStepToAnyTarget(startZoneId, targetSet, zoneGraph, forbiddenIds) {
  const start = String(startZoneId || '');
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();

  const targets =
    targetSet instanceof Set
      ? new Set([...targetSet].map((z) => String(z)))
      : new Set(Array.isArray(targetSet) ? targetSet.map((z) => String(z)) : []);

  if (!start || targets.size === 0) return { nextStep: null, target: null };
  if (targets.has(start)) return { nextStep: start, target: start };

  if (!zoneGraph || typeof zoneGraph !== 'object') return { nextStep: null, target: null };

  const q = [start];
  const parent = new Map();
  parent.set(start, null);

  while (q.length) {
    const cur = q.shift();
    const neighbors = Array.isArray(zoneGraph[cur]) ? zoneGraph[cur] : [];
    for (const n0 of neighbors) {
      const n = String(n0 || '');
      if (!n || parent.has(n)) continue;
      if (forb.has(n)) continue;

      parent.set(n, cur);

      if (targets.has(n)) {
        // reconstruct to find next step after start
        let x = n;
        let prev = parent.get(x);
        while (prev && prev !== start) {
          x = prev;
          prev = parent.get(x);
        }
        return { nextStep: x, target: n };
      }

      q.push(n);
    }
  }

  return { nextStep: null, target: null };
}

function bfsPickSafestZone(startZoneId, zoneGraph, forbiddenIds, zonePop, opts) {
  const start = String(startZoneId || '');
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const pop = (zonePop && typeof zonePop === 'object') ? zonePop : {};
  const maxDepth = Math.max(1, Math.floor(Number(opts?.maxDepth ?? 3)));
  const minDelta = Math.max(0, Math.floor(Number(opts?.minDelta ?? 1)));

  if (!start || !zoneGraph || typeof zoneGraph !== 'object') return { target: null, nextStep: null, dist: null };
  if (forb.has(start)) return { target: null, nextStep: null, dist: null };

  const startPop = Number(pop[start] ?? 0);

  // BFS로 "가장 가까운 안전/저인구 존" 탐색:
  // 1) startPop - minDelta 이하를 만족하는 첫 레벨을 우선
  // 2) 없으면 maxDepth 내에서 pop 최소를 fallback
  const q = [start];
  const parent = new Map([[start, null]]);
  const depth = new Map([[start, 0]]);

  let bestAny = start;
  let bestAnyPop = startPop;
  let bestAnyDist = 0;

  let bestCand = null;
  let bestCandPop = Infinity;
  let bestCandDist = Infinity;

  while (q.length) {
    const cur = q.shift();
    const d = Number(depth.get(cur) ?? 0);
    const pCur = Number(pop[cur] ?? 0);

    if (pCur < bestAnyPop || (pCur === bestAnyPop && d < bestAnyDist)) {
      bestAny = cur;
      bestAnyPop = pCur;
      bestAnyDist = d;
    }

    if (d > 0 && pCur <= (startPop - minDelta)) {
      if (d < bestCandDist || (d === bestCandDist && pCur < bestCandPop)) {
        bestCand = cur;
        bestCandDist = d;
        bestCandPop = pCur;
      }
    }

    if (d >= maxDepth) continue;

    const neighbors = Array.isArray(zoneGraph[cur]) ? zoneGraph[cur] : [];
    for (const n0 of neighbors) {
      const n = String(n0 || '');
      if (!n || parent.has(n)) continue;
      if (forb.has(n)) continue;

      parent.set(n, cur);
      depth.set(n, d + 1);
      q.push(n);
    }
  }

  const target = bestCand || bestAny || null;
  if (!target) return { target: null, nextStep: null, dist: null };

  // start → target 경로에서 다음 1스텝을 복원
  let x = target;
  let prev = parent.get(x);
  while (prev && prev !== start) {
    x = prev;
    prev = parent.get(x);
  }

  return { target, nextStep: x, dist: Number(depth.get(target) ?? 0) };
}

// --- 전설/초월 세팅 목표(관전형 AI) ---
// - 목적: "파밍(크레딧) → 키오스크 구매 → 전설/초월 제작" 루프를 목표로 움직이게 함
// - craftGoal(레시피 목표)이 없더라도, 장비 티어가 낮으면 후반 세팅을 추구
function invHasSpecialKind(inventory, kind, itemMetaById, itemNameById) {
  const list = Array.isArray(inventory) ? inventory : [];
  const k = String(kind || '');
  if (!k) return false;
  return list.some((x) => {
    const id = String(x?.itemId || x?.id || '');
    const name = String(x?.name || itemNameById?.[id] || itemMetaById?.[id]?.name || '');
    if (!name) return false;
    if (Math.max(0, Number(x?.qty ?? 1)) <= 0) return false;
    return classifySpecialByName(name) === k;
  });
}

function findInvItemIdBySpecialKind(inventory, kind, itemMetaById, itemNameById) {
  const list = Array.isArray(inventory) ? inventory : [];
  const k = String(kind || '');
  if (!k) return '';
  const hit = list.find((x) => {
    const id = String(x?.itemId || x?.id || '');
    const name = String(x?.name || itemNameById?.[id] || itemMetaById?.[id]?.name || '');
    if (!name) return false;
    if (Math.max(0, Number(x?.qty ?? 1)) <= 0) return false;
    return classifySpecialByName(name) === k;
  });
  return hit ? String(hit?.itemId || hit?.id || '') : '';
}

function computeLateGameUpgradeNeed(actor, itemMetaById, itemNameById, day, phase, ruleset) {
  const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const tiers = {};
  let minTier = 99;
  for (const slot of EQUIP_SLOTS) {
    const best = pickBestEquipBySlot(inv, slot);
    const t = best ? clampTier4(Number(best?.tier || 1)) : 0;
    tiers[slot] = t;
    minTier = Math.min(minTier, t || 0);
  }
  if (!Number.isFinite(minTier) || minTier === 99) minTier = 0;

  const simCredits = Math.max(0, Number(actor?.simCredits || 0));
  const lowCount = countLowMaterials(inv, itemMetaById, itemNameById);

  const hasVf = invHasSpecialKind(inv, 'vf', itemMetaById, itemNameById);
  const hasMeteor = invHasSpecialKind(inv, 'meteor', itemMetaById, itemNameById);
  const hasLife = invHasSpecialKind(inv, 'life_tree', itemMetaById, itemNameById);
  const hasMithril = invHasSpecialKind(inv, 'mithril', itemMetaById, itemNameById);
  const hasForce = invHasSpecialKind(inv, 'force_core', itemMetaById, itemNameById);
  const hasLegendMatAny = hasMeteor || hasLife || hasMithril || hasForce;

  // ✅ 캐릭터 목표(영웅/전설/초월)에 따라 후반 세팅(키오스크/특수재료) 욕구를 달리함
  const goalTier = normalizeGoalTier(actor?.goalGearTier ?? 6);
  const allowLegend = goalTier >= 5;
  const allowTrans = goalTier >= 6;

  // 키오스크가 2일차 낮부터 의미 있게 동작하므로, 목표도 그 시점부터 활성화
  const nearLegend = allowLegend && minTier >= 4 && minTier < 5;
  const nearTrans = allowTrans && minTier >= 5 && minTier < 6;
  const wantLegend = allowLegend && ((nearLegend && canUseKioskAtWorldTime(day, phase)) || isAtOrAfterWorldTime(day, phase, 2, 'day')) && minTier < 5;
  const wantTrans = allowTrans && ((nearTrans && canUseKioskAtWorldTime(day, phase)) || isAtOrAfterWorldTime(day, phase, 3, 'day')) && minTier < 6;
  const legendOverdue = allowLegend && ((nearLegend && isAtOrAfterWorldTime(day, phase, 1, 'night')) || isAtOrAfterWorldTime(day, phase, 2, 'day')) && minTier < 5;
  const transOverdue = allowTrans && ((nearTrans && isAtOrAfterWorldTime(day, phase, 3, 'day')) || isAtOrAfterWorldTime(day, phase, 3, 'night')) && minTier < 6;

  const legendCost = Math.max(0, Number(ruleset?.market?.kiosk?.prices?.legendaryByKey?.meteor ?? 200));
  const forceCost = Math.max(0, Number(ruleset?.market?.kiosk?.prices?.legendaryByKey?.force_core ?? 350));
  const transCost = Math.max(0, Number(ruleset?.market?.kiosk?.prices?.vf ?? 500));

  // 크레딧 파밍 필요(키오스크 구매/후반 세팅 가속)
  const needCreditsForLegend = wantLegend && simCredits < legendCost;
  const needCreditsForTrans = wantTrans && simCredits < transCost;
  const farmCredits = needCreditsForLegend || needCreditsForTrans;

  return {
    goalTier,
    tiers,
    minTier,
    simCredits,
    lowCount,
    wantLegend,
    wantTrans,
    nearLegend,
    nearTrans,
    legendOverdue,
    transOverdue,
    hasVf,
    hasLegendMatAny,
    farmCredits,
    legendCost,
    forceCost,
    transCost,
  };
}

// --- 목표 기반 이동(조합 목표 + 월드 스폰 + 키오스크) ---
function chooseAiMoveTargets({ actor, craftGoal, upgradeNeed, mapObj, spawnState, forbiddenIds, day, phase, kiosks, itemMetaById = null, itemNameById = null }) {
  const miss = Array.isArray(craftGoal?.missing) ? craftGoal.missing : [];
  const hasGoal = !!craftGoal?.target && miss.length > 0;

  const s = spawnState && typeof spawnState === 'object' ? spawnState : null;
  const bosses = s?.bosses || {};
  const coreNodes = Array.isArray(s?.coreNodes) ? s.coreNodes : [];
  const crates = Array.isArray(s?.legendaryCrates) ? s.legendaryCrates : [];

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

  // 0) 메인 오브젝트(자연코어) 우선: 운석/생나 스폰이 떠 있으면 크레딧 파밍보다 먼저 달려감
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
      result.reason = '메인오브젝트(자연코어)';
      return result;
    }
  }

  // 0) 크레딧 파밍(야생동물 밀집 존): 키오스크 구매/후반 제작이 막힐 때 우선
  if (farmCredits && s?.wildlife && typeof s.wildlife === 'object') {
    const entries = Object.entries(s.wildlife)
      .map(([z, c]) => ({ z: String(z), c: Math.max(0, Number(c || 0)) }))
      .filter((x) => x.z && !forbiddenIds.has(String(x.z)))
      .sort((a, b) => (b.c - a.c) || a.z.localeCompare(b.z));
    const top = entries.slice(0, 6).map((x) => x.z).filter(Boolean);
    if (top.length) {
      result.targets = top;
      result.reason = '크레딧 파밍';
      return result;
    }
  }

  // 1) VF: 위클라인(5일차) 우선, 그 다음 키오스크 구매(4일차)
  if (needVf) {
    if (isAtOrAfterWorldTime(day, phase, 5, 'day') && bosses?.weakline?.alive && bosses.weakline.zoneId && !forbiddenIds.has(String(bosses.weakline.zoneId))) {
      result.targets = [String(bosses.weakline.zoneId)];
      result.reason = 'VF(위클라인)';
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
      result.reason = '특수재료(자연코어)';
      return result;
    }

    if (isAtOrAfterWorldTime(day, phase, 3, 'day') && bosses?.alpha?.alive && bosses.alpha.zoneId && !forbiddenIds.has(String(bosses.alpha.zoneId))) {
      result.targets = [String(bosses.alpha.zoneId)];
      result.reason = '특수재료(알파)';
      return result;
    }
    if (isAtOrAfterWorldTime(day, phase, 4, 'day') && bosses?.omega?.alive && bosses.omega.zoneId && !forbiddenIds.has(String(bosses.omega.zoneId))) {
      result.targets = [String(bosses.omega.zoneId)];
      result.reason = '특수재료(오메가)';
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
      result.reason = needMeteor && needLife ? '자연코어(운석/생나)' : needMeteor ? '자연코어(운석)' : '자연코어(생나)';
      return result;
    }

    // 키오스크 구매/교환이 가능한 시점이면 키오스크도 후보로
    if (canUseKioskAtWorldTime(day, phase) && kioskZones.length && simCredits >= legendCost) {
      result.targets = kioskZones;
      result.reason = '자연코어(키오스크)';
      return result;
    }
  }

  // 3) 미스릴: 알파(3일차) → 전설 재료 상자(3일차) → 키오스크(2일차)
  if (needMithril) {
    if (isAtOrAfterWorldTime(day, phase, 3, 'day') && bosses?.alpha?.alive && bosses.alpha.zoneId && !forbiddenIds.has(String(bosses.alpha.zoneId))) {
      result.targets = [String(bosses.alpha.zoneId)];
      result.reason = '미스릴(알파)';
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
    result.reason = '자연코어 탐색';
    return result;
  }

  return result;
}


function pickMissingBasicItemId(craftGoal) {
  const miss = Array.isArray(craftGoal?.missing) ? craftGoal.missing : [];
  const hit = miss.find((m) => m?.itemId && !m?.special);
  return hit?.itemId ? String(hit.itemId) : '';
}

function rollKioskInteraction(mapObj, zoneId, kiosks, publicItems, curDay, curPhase, actor, craftGoal, itemNameById, marketRules, upgradeNeed = null, absSecNow = 0) {
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
      const shuffled = exch.slice().sort(() => Math.random() - 0.5);
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
      const shuffled = refunds.slice().sort(() => Math.random() - 0.5);
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
      const shuffled = buys.slice().sort(() => Math.random() - 0.5);
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
  const needBasic = miss.find((m) => m?.itemId && !m?.special && isItemInMapCrates(mapObj, m.itemId));
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
    return clampTier4(Number(item?.tier || 0));
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



function readStat(actor, keys) {
  const st = actor?.stats && typeof actor.stats === 'object' ? actor.stats : actor;
  for (const k of keys) {
    const v = Number(st?.[k] ?? st?.[String(k).toLowerCase?.()] ?? 0);
    if (Number.isFinite(v)) return v;
  }
  return 0;
}

function roughPower(actor) {
  // 전투/사냥 난이도 보정용(간단 모델)
  const str = readStat(actor, ['STR', 'str']);
  const agi = readStat(actor, ['AGI', 'agi']);
  const sht = readStat(actor, ['SHOOT', 'SHT', 'shoot', 'sht']);
  const end = readStat(actor, ['END', 'end']);
  const men = readStat(actor, ['MEN', 'men']);
  return str + agi + sht + end + men * 0.5;
}

// --- 야생동물/변이체(필드 교전): 하급 아이템 + (조건부) 특수 재료 드랍 ---
function rollWildlifeEncounter(mapObj, zoneId, publicItems, curDay, curPhase, actor, opts = {}) {
  const moved = !!opts.moved;
  const isKioskZone = !!opts.isKioskZone;
  const disableBoss = !!opts.disableBoss;
  const force = !!opts.force;
  const perkFx = getActorPerkEffects(actor);
  const perkWildLootBias = Math.max(0, getPerkWildlifeLootBias(perkFx));
  const perkWildCreditPct = normalizePerkPct(perkFx?.wildlifeCreditsPct || 0);
  const perkWildDamageMinus = Math.max(0, perkNumber(perkFx?.wildlifeDamageMinus || 0));

  // 키오스크 구역은 비교적 "안전지대"로 간주: 야생 조우 확률/보스 스폰을 낮춤
  const baseChance = isKioskZone ? (moved ? 0.10 : 0.05) : (moved ? 0.22 : 0.10);
  if (!force && Math.random() >= baseChance) return null;

  const p = roughPower(actor);
  const powerBonus = Math.min(0.25, Math.max(0, (p - 40) / 240));

  // --- 스폰 규칙(요청): 늑대=매 낮, 곰=매 밤, 닭/멧돼지/박쥐=매 페이즈 ---
  const tod = curPhase === 'morning' ? 'day' : 'night';
  const spawnPool = [
    ...(tod === 'day'
      ? [{ key: 'wolf', label: '늑대', icon: '🐺', weight: 3 }]
      : [{ key: 'bear', label: '곰', icon: '🐻', weight: 3 }]),
    { key: 'chicken', label: '닭', icon: '🐔', weight: 2 },
    { key: 'boar', label: '멧돼지', icon: '🐗', weight: 2 },
    { key: 'bat', label: '박쥐', icon: '🦇', weight: 2 },
    { key: 'dog', label: '들개', icon: '🐕', weight: 2 },
  ];
  const species = pickWeighted(spawnPool) || spawnPool[0];

    if (!disableBoss) {
  // 5일차 낮부터: 위클라인 → VF 혈액 샘플 드랍 가능
    if (!isKioskZone && isAtOrAfterWorldTime(curDay, curPhase, 5, 'day') && Math.random() < 0.15 + powerBonus) {
      const vf = findItemByKeywords(publicItems, ['vf 혈액', 'vf 샘플', 'blood sample', '혈액 샘플', 'vf']);
      const dmg = applyPerkDamageReduction(Math.max(6, 18 - Math.floor(p / 10)), perkWildDamageMinus);
      if (vf?._id) {
        const drops = [{ item: vf, itemId: String(vf._id), qty: maybeBoostDropQty(1, perkWildLootBias * 0.45, 1) }];
        const meteor = findItemByKeywords(publicItems, ['운석', 'meteor']);
        const tree = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);
        const pick = (Math.random() < (0.5 + Math.min(0.12, perkWildLootBias * 0.12)) ? meteor : tree) || meteor || tree;
        if (pick?._id) drops.push({ item: pick, itemId: String(pick._id), qty: 1 });
        return {
          kind: 'weakline',
          damage: dmg,
          credits: applyPerkCreditBonus(randInt(65, 95), perkWildCreditPct),
          drops,
          log: '🧬 변이체(위클라인) 처치! VF 혈액 샘플 + (운석/생명의 나무) 획득 가능',
        };
      }
    }

    // 4일차 낮부터: 오메가 → 포스 코어 드랍 가능
    if (!isKioskZone && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day') && Math.random() < 0.18 + powerBonus) {
      const fc = findItemByKeywords(publicItems, ['포스 코어', 'force core', 'forcecore']);
      const dmg = applyPerkDamageReduction(Math.max(8, 26 - Math.floor(p / 9)), perkWildDamageMinus);
      if (fc?._id) {
        return {
          kind: 'omega',
          damage: dmg,
          credits: applyPerkCreditBonus(randInt(48, 72), perkWildCreditPct),
          drops: [{ item: fc, itemId: String(fc._id), qty: maybeBoostDropQty(1, perkWildLootBias * 0.35, 1) }],
          log: `🧿 변이체(오메가) 격파! 포스 코어 획득 가능`,
        };
      }
    }

    // 3일차 낮부터: 알파 → 미스릴 드랍 가능
    if (!isKioskZone && isAtOrAfterWorldTime(curDay, curPhase, 3, 'day') && Math.random() < 0.22 + powerBonus) {
      const mi = findItemByKeywords(publicItems, ['미스릴', 'mithril']);
      const dmg = applyPerkDamageReduction(Math.max(6, 22 - Math.floor(p / 9)), perkWildDamageMinus);
      if (mi?._id) {
        return {
          kind: 'alpha',
          damage: dmg,
          credits: applyPerkCreditBonus(randInt(36, 56), perkWildCreditPct),
          drops: [{ item: mi, itemId: String(mi._id), qty: maybeBoostDropQty(1, perkWildLootBias * 0.32, 1) }],
          log: `🐺 야생동물(알파) 사냥 성공! 미스릴 획득 가능`,
        };
      }
    }

    }

  // 기본: 하급 재료 드랍(맵 상자 풀 기반 / 없으면 fallback)
  const drops = [];
  const entry = pickFromAllCrates(mapObj, publicItems);
  if (entry?.itemId) {
    const it = (Array.isArray(publicItems) ? publicItems : []).find((x) => String(x?._id) === String(entry.itemId)) || null;
    if (it?._id) {
      const qty0 = Math.max(1, randInt(entry?.minQty ?? 1, entry?.maxQty ?? 1));
      const qty = maybeBoostDropQty(qty0, perkWildLootBias * 0.38, 1);
      drops.push({ item: it, itemId: String(it._id), qty });
    }
  }

  // ✅ 박쥐 제외 모든 야생동물: 고기 드랍(요청)
  const meat = findItemByKeywords(publicItems, ['고기']);
  if (meat?._id) {
    if (species?.key === 'chicken') {
      if (Math.random() < Math.min(0.92, (2 / 3) + perkWildLootBias * 0.12)) drops.push({ item: meat, itemId: String(meat._id), qty: maybeBoostDropQty(1, perkWildLootBias * 0.32, 1) });
    } else if (species?.key === 'boar') {
      drops.push({ item: meat, itemId: String(meat._id), qty: maybeBoostDropQty(2, perkWildLootBias * 0.32, 1) });
    } else if (species?.key === 'bear' || species?.key === 'wolf' || species?.key === 'dog') {
      drops.push({ item: meat, itemId: String(meat._id), qty: maybeBoostDropQty(1, perkWildLootBias * 0.28, 1) });
    }
    // bat은 제외
  }

  // ✅ 모든 야생동물: 5% 확률로 운석 또는 생명의 나무 드랍
  if (Math.random() < Math.min(0.22, 0.05 + perkWildLootBias * 0.06)) {
    const meteor = findItemByKeywords(publicItems, ['운석', 'meteor']);
    const tree = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);
    const pick = (Math.random() < 0.5 ? meteor : tree) || meteor || tree;
    if (pick?._id) drops.push({ item: pick, itemId: String(pick._id), qty: 1 });
  }

  if (!drops.length) return null;

  // ✅ ER 참고: 야생동물 사냥으로 크레딧 획득
  // - 수치는 ER 크레딧 감각(야생동물 소량, 변이/보스는 더 큼)에 맞춰 낮게 유지
  // - 대신 "장비가 뒤처진" 실험체는 파밍으로 역전 기회를 더 잘 잡도록 보정(언더독 보너스)
  const dayScale = 1 + Math.min(0.35, Math.max(0, (Number(curDay || 1) - 1) * 0.08));
  let crMin = 10;
  let crMax = 14;
  const k0 = String(species?.key || '').toLowerCase();
  if (k0 === 'chicken') { crMin = 12; crMax = 18; }
  else if (k0 === 'bat') { crMin = 9; crMax = 14; }
  else if (k0 === 'boar') { crMin = 14; crMax = 22; }
  else if (k0 === 'dog') { crMin = 14; crMax = 22; }
  else if (k0 === 'wolf') { crMin = 18; crMax = 28; }
  else if (k0 === 'bear') { crMin = 22; crMax = 34; }

  const tierSum = getEquipTierSummary(actor);
  const avgTier = (Number(tierSum.weaponTier || 0) + Number(tierSum.armorTierSum || 0) / 4) / 2;
  const underdogMul = (Number(curDay || 1) >= 3 && avgTier <= 3.2) ? 1.6 : (Number(curDay || 1) >= 4 && avgTier <= 4.2) ? 1.3 : 1.0;

  const credits0 = Math.max(0, Math.floor(randInt(Math.floor(crMin * dayScale), Math.floor(crMax * dayScale)) * underdogMul));
  const credits = applyPerkCreditBonus(credits0, perkWildCreditPct);

  const dmgBase = species?.key === 'bear' ? 11 : species?.key === 'wolf' ? 9 : species?.key === 'boar' ? 8 : species?.key === 'bat' ? 6 : 4;
  const dmg = applyPerkDamageReduction(Math.max(0, dmgBase - Math.floor(p / 18)), perkWildDamageMinus);
  return {
    kind: String(species?.key || 'wildlife'),
    damage: dmg,
    credits,
    drops,
    log: `${String(species?.icon || '🦌')} ${String(species?.label || '야생동물')} 사냥 성공`,
  };

  // drops가 비어있으면 조우 없음으로 처리
  return null;
}

// --- 🦌 야생동물(존 스폰 카운트) 소모 ---
// - spawnState.wildlife[zoneId] > 0 이면 "해당 존에 야생동물이 존재"한다고 가정
// - 조우가 성립하면 1마리 소모하고, rollWildlifeEncounter(force=true)로 드랍/크레딧을 생성
function consumeWildlifeAtZone(spawnState, mapObj, zoneId, publicItems, curDay, curPhase, actor, ruleset, opts = {}) {
  const s = spawnState;
  if (!s || !s.wildlife || typeof s.wildlife !== 'object') return null;
  const zid = String(zoneId || '');
  if (!zid) return null;

  const moved = !!opts.moved;
  const isKioskZone = !!opts.isKioskZone;
  const recovering = !!opts.recovering;
  if (recovering) return null;

  const cur = Math.max(0, Number(s.wildlife[zid] ?? 0));
  if (cur <= 0) return null;

  // 조우 확률(존에 개체가 많을수록 더 잘 만남)
  const base = isKioskZone ? (moved ? 0.18 : 0.08) : (moved ? 0.70 : 0.38);
  const densBoost = Math.min(0.22, cur * 0.04);
  const chance = Math.min(0.92, base + densBoost);
  if (Math.random() >= chance) return null;

  // 1마리 소모
  s.wildlife[zid] = Math.max(0, cur - 1);

  // 실제 드랍/크레딧 생성
  const res = rollWildlifeEncounter(mapObj, zid, publicItems, curDay, curPhase, actor, {
    moved,
    isKioskZone,
    disableBoss: true,
    force: true,
  });

  if (res) return res;

  // 드랍 데이터가 없더라도, "사냥했다"는 이벤트는 남김(파밍 루프 끊김 방지)
  const p = roughPower(actor);
  const perkFx = getActorPerkEffects(actor);
  const dmg = applyPerkDamageReduction(Math.max(0, 5 - Math.floor(p / 22)), Math.max(0, perkNumber(perkFx?.wildlifeDamageMinus || 0)));
  const credits = applyPerkCreditBonus(Math.max(0, randInt(12, 22)), perkFx?.wildlifeCreditsPct || 0);
  return { kind: 'wildlife', damage: dmg, credits, drops: [], log: '🦌 야생동물 사냥 성공' };
}

// --- 운석/생명의 나무 자연 스폰(2일차 낮 이후, 일부 맵으로 확장 가능) ---
function rollNaturalCoreSpawn(mapObj, zoneId, publicItems, curDay, curPhase, opts = {}) {
  // 운석/생명의 나무: 2일차 '낮' 이후부터
  const ruleset = opts?.ruleset || null;
  const ws = ruleset?.worldSpawns || {};
  const coreRule = ws?.core || {};
  const coreGateDay = Number(coreRule?.gateDay ?? 2);
  if (!isAtOrAfterWorldTime(curDay, curPhase, coreGateDay, 'day')) return null;

  const moved = !!opts.moved;

  // --- 구역 제한: "일부 구역"만 자연 스폰 허용 ---
  const zones = Array.isArray(mapObj?.zones) ? mapObj.zones : [];
  const z = zones.find((x) => String(x?.zoneId) === String(zoneId)) || null;
  const zoneName = String(z?.name || '');
  const zoneHasKiosk = Boolean(opts?.isKioskZone || z?.hasKiosk);

  // 키오스크 구역(병원/성당/경찰서 등)은 자연 스폰 제외(안전지대 느낌)
  if (zoneHasKiosk) return null;

  // mapObj.coreSpawnZones가 있으면 최우선(향후 데이터화 대비)
  const mapAllow = Array.isArray(mapObj?.coreSpawnZones) ? mapObj.coreSpawnZones.map(String) : null;

  let allowed = false;
  if (mapAllow && mapAllow.length) {
    allowed = mapAllow.includes(String(zoneId));
  } else if (z && typeof z?.coreSpawn === 'boolean') {
    allowed = !!z.coreSpawn;
  } else {
    // 데이터가 없으면 기본 허용 구역(레거시)만 허용
    allowed = LEGACY_CORE_ZONE_IDS.includes(String(zoneId)) || LEGACY_CORE_ZONE_NAME_KEYS.includes(zoneName);
  }

  if (!allowed) return null;

  // 구역 제한이 들어가므로 기본 확률을 약간 올림(그래도 희귀)
  const chance = moved ? 0.08 : 0.03;
  if (Math.random() >= chance) return null;

  const meteor = findItemByKeywords(publicItems, ['운석', 'meteor']);
  const tree = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);
  const candidates = [];
  if (meteor?._id) candidates.push({ key: 'meteor', item: meteor, weight: 1 });
  if (tree?._id) candidates.push({ key: 'life_tree', item: tree, weight: 1 });
  if (!candidates.length) return null;

  const picked = pickWeighted(candidates);
  if (!picked?.item?._id) return null;

  return { item: picked.item, itemId: String(picked.item._id), qty: 1, kind: String(picked.key) };
}

// --- 인벤토리/스택 제한(최소) ---
const DEFAULT_INV_RULES = {
  maxSlots: 10,
  stackMax: { material: 3, consumable: 6, equipment: 1 },
};

function getInvRules(ruleset) {
  const inv = ruleset?.inventory || {};
  return {
    maxSlots: Number(inv.maxSlots || DEFAULT_INV_RULES.maxSlots),
    stackMax: { ...DEFAULT_INV_RULES.stackMax, ...(inv.stackMax || {}) },
  };
}

function inferItemCategory(it) {
  const tags = safeTags(it);
  const type = String(it?.type || '').toLowerCase();
  const name = itemDisplayName(it);
  const lower = String(name || '').toLowerCase();

  // ✅ 서버(DB) 아이템이 equipSlot을 들고 오는 경우 우선 장비로 판정
  // (기존 로직은 name/tag 기반이라 equipSlot만 있는 장비가 재료로 오인될 수 있음)
  if (it && typeof it === 'object') {
    const slot = String(it?.equipSlot || '').trim().toLowerCase();
    if (slot) return 'equipment';
  }

  const isConsumable =
    type === 'food' ||
    type === 'consumable' ||
    tags.includes('food') ||
    tags.includes('healthy') ||
    tags.includes('heal') ||
    tags.includes('medical') ||
    lower.includes('bandage') ||
    lower.includes('medkit') ||
    name.includes('음식') ||
    name.includes('빵') ||
    name.includes('고기') ||
    name.includes('붕대') ||
    name.includes('응급');

  const isEquipment =
    type === 'weapon' ||
    it?.type === '무기' ||
    it?.type === '방어구' ||
    tags.includes('weapon') ||
    tags.includes('armor') ||
    tags.includes('equipment') ||
    tags.includes('equip') ||
    lower.includes('weapon') ||
    name.includes('무기') ||
    name.includes('검') ||
    name.includes('총') ||
    name.includes('창') ||
    name.includes('활') ||
    name.includes('갑옷') ||
    name.includes('헬멧') ||
    name.includes('신발') ||
    name.includes('장갑');

  if (isEquipment) return 'equipment';
  if (isConsumable) return 'consumable';
  return 'material';
}

function inferEquipSlot(it) {
  const tags = safeTags(it);
  const type = String(it?.type || '').toLowerCase();
  const name = itemDisplayName(it);
  const lower = String(name || '').toLowerCase();

  // ✅ 서버(DB) 아이템의 equipSlot 필드를 최우선으로 사용
  if (it && typeof it === 'object') {
    const s = String(it?.equipSlot || '').trim().toLowerCase();
    if (s) return s;
  }

  if (type === 'weapon' || it?.type === '무기' || tags.includes('weapon') || lower.includes('weapon') || name.includes('무기') || name.includes('검') || name.includes('총') || name.includes('활') || name.includes('창')) return 'weapon';
  if (tags.includes('head') || lower.includes('helmet') || name.includes('머리') || name.includes('모자') || name.includes('헬멧')) return 'head';
  if (tags.includes('clothes') || tags.includes('body') || name.includes('옷') || name.includes('상의') || name.includes('갑옷') || name.includes('방어복')) return 'clothes';
  if (tags.includes('arm') || lower.includes('glove') || name.includes('팔') || name.includes('장갑') || name.includes('암가드')) return 'arm';
  if (tags.includes('shoes') || lower.includes('boots') || name.includes('신발') || name.includes('부츠')) return 'shoes';
  return '';
}

function getEffectIndex(character, effectName) {
  const list = Array.isArray(character?.activeEffects) ? character.activeEffects : [];
  const key = String(effectName || '');
  return list.findIndex((e) => String(e?.name || '') === key);
}

function hasActiveEffect(character, effectName) {
  return getEffectIndex(character, effectName) >= 0;
}

function removeActiveEffect(character, effectName) {
  const list = Array.isArray(character?.activeEffects) ? character.activeEffects : [];
  const key = String(effectName || '');
  const next = list.filter((e) => String(e?.name || '') !== key);
  const removed = next.length !== list.length;
  if (removed) character.activeEffects = next;
  return removed;
}

function isBandageLikeItem(it) {
  const name = itemDisplayName(it);
  const lower = String(name || '').toLowerCase();
  return lower.includes('bandage') || lower.includes('medkit') || name.includes('붕대') || name.includes('응급');
}

function canReceiveItem(inventory, it, itemId, qty, ruleset) {
  const rules = getInvRules(ruleset);
  const list = Array.isArray(inventory) ? inventory : [];
  const key = String(it?._id || itemId || '');
  const want = Math.max(0, Number(qty || 0));
  if (!key || want <= 0) return false;

  const category = inferItemCategory(it);
  const maxStack = Math.max(1, Number(rules.stackMax?.[category] || 1));
  const idx = list.findIndex((x) => String(x?.itemId || x?.id || '') === key);
  if (idx >= 0) {
    const have = Math.max(0, Number(list[idx]?.qty ?? 1));
    return have < maxStack;
  }

  // 장비는 타입(머리/옷/팔/신발/무기)별 1개 유지: 더 좋은 장비(tier↑)면 교체 허용
  if (category === 'equipment') {
    const slot = inferEquipSlot(it);
    if (slot) {
      const existing = list.find((x) => (String(x?.category || inferItemCategory(x)) === 'equipment') && String(x?.equipSlot || inferEquipSlot(x) || '') === slot);
      if (existing) {
        const cfg = ruleset?.equipment || {};
        const replaceOnlyIfBetter = cfg.replaceOnlyIfBetter !== false;
        const newTier = clampTier4(it?.tier || 1);
        const oldTier = clampTier4(existing?.tier || 1);
        if (replaceOnlyIfBetter) return newTier > oldTier;
        return true;
      }
    }
  }
  return list.length < rules.maxSlots;
}

function normalizeInventory(inventory, ruleset) {
  const rules = getInvRules(ruleset);
  const list = (Array.isArray(inventory) ? inventory : [])
    .map((x) => ({ ...x }))
    .filter((x) => (x?.itemId || x?.id) && Math.max(0, Number(x?.qty ?? 1)) > 0);

  for (let i = 0; i < list.length; i++) {
    const category = String(list[i]?.category || inferItemCategory(list[i]) || 'material');
    const maxStack = Math.max(1, Number(rules.stackMax?.[category] || 1));
    const q = Math.max(0, Number(list[i]?.qty ?? 1));
    list[i] = {
      ...list[i],
      category,
      equipSlot: category === 'equipment' ? (list[i]?.equipSlot || inferEquipSlot(list[i]) || '') : (list[i]?.equipSlot || ''),
      tier: clampTier4(list[i]?.tier || 1),
      qty: Math.min(maxStack, q),
    };
  }

  // 장비 타입(머리/옷/팔/신발/무기) 중복은 최신 1개만 유지
  const kept = [];
  const usedSlots = new Set();
  for (let i = list.length - 1; i >= 0; i--) {
    const isEq = String(list[i]?.category || inferItemCategory(list[i])) === 'equipment';
    const slot = isEq ? String(list[i]?.equipSlot || inferEquipSlot(list[i]) || '') : '';
    if (isEq && slot) {
      if (usedSlots.has(slot)) continue;
      usedSlots.add(slot);
    }
    kept.push(list[i]);
  }
  kept.reverse();

  if (kept.length > rules.maxSlots) {
    // 오래된 것부터 드랍(정렬 기준: acquiredDay 오름차순)
    kept.sort((a, b) => (Number(a?.acquiredDay ?? 0) - Number(b?.acquiredDay ?? 0)));
    return kept.slice(Math.max(0, kept.length - rules.maxSlots));
  }
  return kept;
}

function formatInvRuleState(inventory, ruleset) {
  const rules = getInvRules(ruleset);
  const slots = Array.isArray(inventory) ? inventory.length : 0;
  const cap = rules?.stackMax || {};
  return ` [INV ${slots}/${rules.maxSlots} | 재료${cap.material}/소모${cap.consumable}/장비${cap.equipment}]`;
}

function formatInvAddNote(meta, want, inventory, ruleset) {
  const reason = String(meta?.reason || '');
  const accepted = Math.max(0, Number(meta?.acceptedQty ?? want ?? 0));
  const dropped = Math.max(0, Number(meta?.droppedQty ?? 0));

  let note = '';
  if (reason === 'equip_replaced') {
    const slot = String(meta?.slot || '');
    const oldName = String(meta?.oldName || '');
    const newName = String(meta?.newName || '');
    const oldTier = Number(meta?.oldTier || 0);
    const newTier = Number(meta?.newTier || 0);
    const head = slot ? `[${slot}]` : '';
    const tOld = oldTier > 0 ? `T${oldTier} ` : '';
    const tNew = newTier > 0 ? `T${newTier} ` : '';
    note = ` (장비 교체${head}: ${tOld}${oldName} → ${tNew}${newName})`;
  } else if (reason === 'equip_not_better') {
    note = ' (장비 유지: 더 좋은 장비가 아님)';
  } else if (accepted <= 0 && dropped > 0) {
    if (reason === 'equip_slot_full') note = ' (장비 슬롯 가득: 획득 실패)';
    else if (reason === 'inventory_full') note = ' (가방 가득: 획득 실패)';
    else note = ' (획득 실패)';
  } else if (dropped > 0) {
    note = ` (스택/한도 초과 ${dropped}개 버림)`;
  }

  if (!note) return '';
  if (!inventory || !ruleset) return note;
  return `${note}${formatInvRuleState(inventory, ruleset)}`;
}

function addItemToInventory(inventory, item, itemId, qty, day, ruleset) {
  const rules = getInvRules(ruleset);
  const list = Array.isArray(inventory) ? [...inventory] : [];
  const key = String(item?._id || itemId || '');
  const want = Math.max(0, Number(qty || 0));
  const category = inferItemCategory(item);
  const maxStack = Math.max(1, Number(rules.stackMax?.[category] || 1));
  const equipSlot = category === 'equipment' ? inferEquipSlot(item) : '';

  if (!key || want <= 0) {
    list._lastAdd = { itemId: key, acceptedQty: 0, droppedQty: want, reason: 'invalid' };
    return list;
  }

  const i = list.findIndex((x) => String(x?.itemId || x?.id || '') === key);
  if (i >= 0) {
    const cur = Math.max(0, Number(list[i]?.qty ?? 1));
    const next = Math.min(maxStack, cur + want);
    const accepted = Math.max(0, next - cur);
    const dropped = Math.max(0, (cur + want) - next);
    list[i] = { ...list[i], qty: next, category, tier: clampTier4(item?.tier || list[i]?.tier || 1), ...(category === 'equipment' ? { rarity: tierLabelKo(clampTier4(item?.tier || list[i]?.tier || 1)) } : {}), ...(equipSlot ? { equipSlot } : {}) };
    list._lastAdd = { itemId: key, acceptedQty: accepted, droppedQty: dropped, reason: dropped > 0 ? 'stack_cap' : '' };
    return list;
  }

  // 장비는 타입(머리/옷/팔/신발/무기)별 1개 유지: 더 좋은 장비(tier↑)면 교체
  if (category === 'equipment' && equipSlot) {
    const cfg = ruleset?.equipment || {};
    const replaceOnlyIfBetter = cfg.replaceOnlyIfBetter !== false;
    const j = list.findIndex((x) => (String(x?.category || inferItemCategory(x)) === 'equipment') && String(x?.equipSlot || inferEquipSlot(x) || '') === equipSlot);
    if (j >= 0) {
      const oldTier = clampTier4(list[j]?.tier || 1);
      const newTier = clampTier4(item?.tier || 1);
      const forceSameTier = !!item?._forceReplaceSameTier && (newTier === oldTier);
      if (replaceOnlyIfBetter && !(newTier > oldTier) && !forceSameTier) {
        list._lastAdd = { itemId: key, acceptedQty: 0, droppedQty: want, reason: 'equip_not_better' };
        return list;
      }
      const oldName = String(list[j]?.name || itemDisplayName(list[j]) || '');
      const newName = String(item?.name || itemDisplayName(item) || '');
      list.splice(j, 1);
      list._lastAdd = { itemId: key, acceptedQty: 0, droppedQty: 0, reason: 'equip_replaced', slot: equipSlot, oldName, newName, oldTier, newTier };
    }
  }

  // 장비 교체로 슬롯이 비었으면 inventory_full 체크를 건너뜀
  if (String(list?._lastAdd?.reason || '') !== 'equip_replaced' && list.length >= rules.maxSlots) {
    list._lastAdd = { itemId: key, acceptedQty: 0, droppedQty: want, reason: 'inventory_full' };
    return list;
  }

  const replacedMeta = String(list?._lastAdd?.reason || '') === 'equip_replaced' ? { ...list._lastAdd } : null;

  const accepted = Math.min(maxStack, want);
  const dropped = Math.max(0, want - accepted);
  list.push({
    itemId: item?._id || itemId,
    qty: accepted,
    name: item?.name,
    type: item?.type,
    tags: Array.isArray(item?.tags) ? item.tags : [],
    category,
    equipSlot: equipSlot || '',
    tier: clampTier4(item?.tier || 1), ...(category === 'equipment' ? { rarity: tierLabelKo(clampTier4(item?.tier || 1)) } : {}),
    acquiredDay: Number(day || 0),
  });
  list._lastAdd = replacedMeta
    ? { ...replacedMeta, itemId: key, acceptedQty: accepted, droppedQty: dropped }
    : { itemId: key, acceptedQty: accepted, droppedQty: dropped, reason: dropped > 0 ? 'stack_cap' : '' };
  return list;
}

function invQty(inventory, itemId) {
  const id = String(itemId || '');
  if (!id) return 0;
  return (Array.isArray(inventory) ? inventory : []).reduce(
    (sum, x) => (String(x?.itemId || x?.id || '') === id ? sum + Math.max(0, Number(x?.qty || 1)) : sum),
    0
  );
}

function consumeIngredientsFromInv(inventory, ingredients) {
  const need = compactIO(ingredients);
  const list = Array.isArray(inventory) ? [...inventory] : [];
  for (const ing of need) {
    const id = String(ing.itemId || '');
    let remaining = Math.max(0, Number(ing.qty || 1));
    if (!id || remaining <= 0) continue;

    for (let i = 0; i < list.length && remaining > 0; i++) {
      if (String(list[i]?.itemId || list[i]?.id || '') !== id) continue;
      const have = Math.max(0, Number(list[i]?.qty || 1));
      const take = Math.min(have, remaining);
      const next = have - take;
      remaining -= take;
      if (next <= 0) {
        list.splice(i, 1);
        i -= 1;
      } else {
        list[i] = { ...list[i], qty: next };
      }
    }
  }
  return list;
}

function tryAutoCraftFromLoot(inventory, lootedItemId, craftables, itemNameById, itemMetaById, day, ruleset) {
  const lootId = String(lootedItemId || '');
  if (!lootId) return null;

  const candidates = (Array.isArray(craftables) ? craftables : [])
    .filter((it) => Array.isArray(it?.recipe?.ingredients) && it.recipe.ingredients.some((ing) => String(ing?.itemId) === lootId))
    .sort((a, b) => (Number(a.tier || 1) - Number(b.tier || 1)) || String(a.name).localeCompare(String(b.name)));

  // ✅ 1일차에는 조합이 '보이도록' 확률을 조금 올림(관전 템포)
  const chance = (Number(day || 0) === 1) ? 0.75 : 0.35;
  if (!candidates.length || Math.random() >= chance) return null;

  for (const target of candidates) {
    const ings = compactIO(target?.recipe?.ingredients || []);
    const ok = ings.length > 0 && ings.every((ing) => invQty(inventory, ing.itemId) >= Number(ing.qty || 1));
    if (!ok) continue;

    const cat = inferItemCategory(target);
    const craftTier = (cat === 'equipment')
      ? computeCraftTierFromIngredients(ings, itemMetaById, itemNameById)
      : clampTier4(target?.tier || 1);

    const craftedItem = (cat === 'equipment') ? applyEquipTier(target, craftTier) : target;

    // 인벤토리가 가득 차면 조합하지 않음(재료 소모 방지)
    // - 장비의 경우 craftTier 반영 전(target.tier)로 판단하면 업그레이드가 막히므로 craftedItem 기준으로 체크
    if (!canReceiveItem(inventory, craftedItem, craftedItem?._id, 1, ruleset)) continue;

    const afterConsume = consumeIngredientsFromInv(inventory, ings);
    const afterAdd = addItemToInventory(afterConsume, craftedItem, craftedItem?._id, 1, day, ruleset);

    const ingText = ings.map((x) => `${itemNameById?.[String(x.itemId)] || String(x.itemId)} x${x.qty}`).join(' + ');
    const tierText = (cat === 'equipment') ? ` (${tierLabelKo(craftTier)})` : '';
    return { inventory: afterAdd, craftedId: String(craftedItem?._id || ''), craftedTier: Number(craftTier || craftedItem?.tier || 1), craftedName: String(craftedItem?.name || ''), log: `🛠️ 조합: ${ingText} → ${craftedItem?.name || '아이템'}${tierText} x1` };
  }
  return null;
}

// ✅ 인벤 기반 자동 조합(페이즈당 1회)
// - loot 트리거(tryAutoCraftFromLoot)만으로는 재료가 쌓여도 제작이 멈추는 구간이 생김
// - 조건을 만족하면 1회는 반드시 시도(관전형 템포)
function buildCraftDebugInfo(actor, craftables, itemNameById, ruleset) {
  const inv0 = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const actorWNorm = normalizeWeaponType(String(actor?.weaponType || '').trim());
  const withRecipe = (Array.isArray(craftables) ? craftables : [])
    .filter((it) => Array.isArray(it?.recipe?.ingredients) && it.recipe.ingredients.length > 0);
  if (!withRecipe.length) return { code: 'recipe_none', text: '레시피가 있는 제작 대상이 없습니다.' };

  const goalBySlot = pickGoalLoadoutBySlot(actor);
  let bestTarget = null;
  let bestMissing = [];
  let bestScore = -1;
  let weaponMismatch = 0;
  let tierBlocked = 0;
  let receiveBlocked = 0;
  let readyCount = 0;

  for (const it of withRecipe) {
    const ings = compactIO(it?.recipe?.ingredients || []);
    const missing = [];
    let have = 0;
    for (const ing of ings) {
      const need = Number(ing?.qty || 1);
      const got = invQty(inv0, ing?.itemId);
      if (got >= need) have += 1;
      else missing.push(`${itemNameById?.[String(ing?.itemId || '')] || String(ing?.itemId || '')} x${Math.max(0, need - got)}`);
    }
    const score = (have * 100) - missing.length;
    if (score > bestScore) {
      bestScore = score;
      bestTarget = it;
      bestMissing = missing;
    }
    if (missing.length > 0) continue;
    readyCount += 1;

    const cat = inferItemCategory(it);
    if (cat === 'equipment') {
      const slot = String(it?.equipSlot || inferEquipSlot(it) || '').toLowerCase();
      if (slot === 'weapon') {
        const w = String(it?.weaponType || '').toLowerCase();
        if (w && actorWNorm && w !== actorWNorm) {
          weaponMismatch += 1;
          continue;
        }
      }
      const curBest = slot ? pickBestEquipBySlot(inv0, slot) : null;
      const curTier = curBest ? clampTier4(Number(curBest?.tier || 1)) : 0;
      const tgtTier = clampTier4(Number(it?.tier || 1));
      const wantKey = String(goalBySlot?.[slot] || '').trim();
      const candKey = String(it?.itemKey || it?.externalId || '').trim();
      const wantGoal = !!(wantKey && candKey && wantKey === candKey);
      if (!wantGoal && tgtTier <= curTier) {
        tierBlocked += 1;
        continue;
      }
    }
    if (!canReceiveItem(inv0, it, it?._id, 1, ruleset)) {
      receiveBlocked += 1;
      continue;
    }
  }

  if (readyCount <= 0) {
    const targetName = String(bestTarget?.name || '목표 없음');
    const missText = bestMissing.length > 0 ? ` / 부족: ${bestMissing.slice(0, 3).join(', ')}` : '';
    return { code: 'missing_ing', targetName, missing: bestMissing, text: `${targetName} 제작 재료 부족${missText}` };
  }
  if (weaponMismatch > 0) {
    return { code: 'weapon_mismatch', targetName: String(bestTarget?.name || ''), text: '무기 타입이 맞지 않아 제작 후보에서 제외되었습니다.' };
  }
  if (receiveBlocked > 0) {
    return { code: 'inventory_full', targetName: String(bestTarget?.name || ''), text: '인벤/슬롯 제한으로 결과물을 받을 수 없습니다.' };
  }
  if (tierBlocked > 0) {
    return { code: 'tier_blocked', targetName: String(bestTarget?.name || ''), text: '동일 슬롯에 동급 이상 장비가 있어 제작을 보류했습니다.' };
  }
  return { code: 'no_candidate', targetName: String(bestTarget?.name || ''), text: '제작 가능한 후보를 찾지 못했습니다.' };
}

function tryAutoCraftFromInventory(actor, craftables, itemNameById, itemMetaById, day, phaseIdxNow, ruleset) {
  if (!actor || typeof actor !== 'object') return null;
  if (Number(actor?._invCraftPhaseIdx ?? -9999) === Number(phaseIdxNow || 0)) return null;

  const inv0 = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const actorWNorm = normalizeWeaponType(String(actor?.weaponType || '').trim());
  const perkFx = getActorPerkEffects(actor);
  const goalWeightBonus = Math.max(0, perkNumber(perkFx.goalWeightPlus || 0));
  const craftBias = Math.max(0, perkNumber(perkFx.craftChancePlus || 0));

  const kmap = (actor?._itemKeyById && typeof actor._itemKeyById === 'object') ? actor._itemKeyById : {};
  const goalBySlot = pickGoalLoadoutBySlot(actor);
  const goalKeys = new Set(Object.values(goalBySlot).map((x) => String(x || '').trim()).filter(Boolean));
  const keyOfId = (id) => String(kmap?.[String(id || '')] || '').trim();

  const candidates = (Array.isArray(craftables) ? craftables : [])
    .filter((it) => Array.isArray(it?.recipe?.ingredients) && it.recipe.ingredients.length > 0)
    .filter((it) => {
      const ings = compactIO(it?.recipe?.ingredients || []);
      if (!ings.length) return false;
      return ings.every((ing) => invQty(inv0, ing.itemId) >= Number(ing.qty || 1));
    })
    .filter((it) => {
      const cat = inferItemCategory(it);
      if (cat !== 'equipment') return true;
      const slot = String(it?.equipSlot || inferEquipSlot(it) || '').toLowerCase();
      if (slot === 'weapon') {
        const w = String(it?.weaponType || '').toLowerCase();
        // 무기 타입이 명시된 경우: 캐릭터 선호 무기와 다르면 제작 우선순위에서 제외
        if (w && actorWNorm && w !== actorWNorm) return false;
      }
      // 같은 슬롯에 이미 동급 이상이 있으면 제작하지 않음(재료 낭비 방지)
      const curBest = slot ? pickBestEquipBySlot(inv0, slot) : null;
      const curTier = curBest ? clampTier4(Number(curBest?.tier || 1)) : 0;
      const tgtTier = clampTier4(Number(it?.tier || 1));

      // 목표 장비면(같은 티어라도) 목표와 다를 때 1회 교체 제작을 허용
      const wantKey = String(goalBySlot?.[slot] || '').trim();
      const candKey = String(it?.itemKey || it?.externalId || '').trim();
      const wantGoal = !!(wantKey && candKey && wantKey === candKey);
      if (wantGoal) {
        const eqId = String(ensureEquipped(actor)?.[slot] || '');
        const eqKey = eqId ? keyOfId(eqId) : '';
        if (eqKey && eqKey === candKey) return false;
        if (inv0.some((x) => String(getInvItemId(x)) === String(it?._id))) return false;
        return true;
      }

      return tgtTier > curTier;
    })
    .sort((a, b) => {
      const ka = String(a?.itemKey || a?.externalId || '').trim();
      const kb = String(b?.itemKey || b?.externalId || '').trim();
      const ga = (goalKeys.size > 0 && ka && goalKeys.has(ka)) ? 1 : 0;
      const gb = (goalKeys.size > 0 && kb && goalKeys.has(kb)) ? 1 : 0;
      if (gb != ga) return gb - ga;

      const perkScoreA = (ga ? (goalWeightBonus * 100) : 0) + (Number(a?.tier || 1) * craftBias * 4);
      const perkScoreB = (gb ? (goalWeightBonus * 100) : 0) + (Number(b?.tier || 1) * craftBias * 4);
      if (perkScoreB !== perkScoreA) return perkScoreB - perkScoreA;

      const ca = inferItemCategory(a) === 'equipment' ? 1 : 0;
      const cb = inferItemCategory(b) === 'equipment' ? 1 : 0;
      if (cb !== ca) return cb - ca;
      return (Number(b?.tier || 1) - Number(a?.tier || 1)) || String(a?.name || '').localeCompare(String(b?.name || ''));
    });

  for (const target of candidates) {
    const ings = compactIO(target?.recipe?.ingredients || []);
    const cat = inferItemCategory(target);
    const craftTier = (cat === 'equipment')
      ? clampTier4(Number(target?.tier || computeCraftTierFromIngredients(ings, itemMetaById, itemNameById) || 1))
      : clampTier4(target?.tier || 1);
    const craftedItem0 = (cat === 'equipment') ? applyEquipTier(target, craftTier) : target;

    // 목표 장비라면 같은 티어 교체를 허용(장비 슬롯 1개 유지 정책에 막히지 않게)
    let craftedItem = craftedItem0;
    if (cat === 'equipment') {
      const slot = String(target?.equipSlot || inferEquipSlot(target) || '').toLowerCase();
      const wantKey = String(goalBySlot?.[slot] || '').trim();
      const candKey = String(target?.itemKey || target?.externalId || '').trim();
      if (wantKey && candKey && wantKey === candKey) {
        craftedItem = { ...craftedItem0, _forceReplaceSameTier: true };
      }
    }

    if (!canReceiveItem(inv0, craftedItem, craftedItem?._id, 1, ruleset)) continue;

    let inv = consumeIngredientsFromInv(inv0, ings);
    inv = addItemToInventory(inv, craftedItem, craftedItem?._id, 1, day, ruleset);
    const meta = inv?._lastAdd;
    const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
    if (got <= 0) continue;

    actor.inventory = inv;
    autoEquipBest(actor, itemMetaById);
    actor._invCraftPhaseIdx = Number(phaseIdxNow || 0);

    const ingText = ings.map((x) => `${itemNameById?.[String(x.itemId)] || String(x.itemId)} x${x.qty}`).join(' + ');
    const tierText = (cat === 'equipment') ? ` (${tierLabelKo(craftTier)})` : '';
    actor._craftDebug = {
      code: 'crafted',
      targetName: String(craftedItem?.name || ''),
      missing: [],
      phaseIdx: Number(phaseIdxNow || 0),
      text: `${craftedItem?.name || '아이템'} 제작 완료`,
    };
    return { changed: true, craftedId: String(craftedItem?._id || ''), craftedTier: Number(craftTier || craftedItem?.tier || 1), craftedName: String(craftedItem?.name || ''), log: `🛠️ [${actor?.name}] 인벤 조합: ${ingText} → ${craftedItem?.name || '아이템'}${tierText} x1` };
  }

  actor._invCraftPhaseIdx = Number(phaseIdxNow || 0);
  actor._craftDebug = {
    ...buildCraftDebugInfo(actor, craftables, itemNameById, ruleset),
    phaseIdx: Number(phaseIdxNow || 0),
  };
  return null;
}

// ===============================
// ✅ 1일차 목표: "1회 이동"만으로 영웅(T4)까지 맞추기
// - 플레이어 간섭이 없으므로, 관전 템포를 위해 AI가 재료를 소모해 장비를 단계적으로 끌어올립니다.
// - 규칙(요청): 하급 재료 2개 → 일반(T1) 제작 / (장비 + 하급1) → 희귀(T3) / (희귀 + 하급1) → 영웅(T4)
//   ※ 여기서는 '하급 재료'를 (재료 카테고리 + 특수재료 제외 + tier<=2)로 간주합니다.
// ===============================

function getInvId(x) {
  return String(x?.itemId || x?.id || x?._id || '');
}

function getInvTier(x, itemMetaById) {
  const t0 = Number(x?.tier);
  if (Number.isFinite(t0) && t0 > 0) return clampTier4(t0);
  const id = getInvId(x);
  const m = id ? itemMetaById?.[id] : null;
  return clampTier4(m?.tier || 1);
}

function isLowMaterialInvEntry(x, itemMetaById, itemNameById) {
  if (!x || typeof x !== 'object') return false;
  const id = getInvId(x);
  if (!id) return false;

  const cat = String(x?.category || inferItemCategory(x) || 'material');
  if (cat !== 'material') return false;

  const name = String(x?.name || itemNameById?.[id] || itemMetaById?.[id]?.name || '');
  if (!name) return false;
  if (classifySpecialByName(name)) return false; // 운석/생나/포스코어/미스릴/VF 제외

  const tier = getInvTier(x, itemMetaById);
  return tier <= 2;
}

function countLowMaterials(inventory, itemMetaById, itemNameById) {
  return (Array.isArray(inventory) ? inventory : []).reduce((sum, x) => {
    if (!isLowMaterialInvEntry(x, itemMetaById, itemNameById)) return sum;
    return sum + Math.max(0, Number(x?.qty ?? 1));
  }, 0);
}

function consumeLowMaterials(inventory, need, itemMetaById, itemNameById) {
  const want = Math.max(0, Math.floor(Number(need || 0)));
  if (want <= 0) return { inventory: Array.isArray(inventory) ? [...inventory] : [], consumed: 0 };

  const list = Array.isArray(inventory) ? inventory.map((x) => ({ ...x })) : [];
  // qty 많은 것부터 먼저 소모
  list.sort((a, b) => Math.max(0, Number(b?.qty ?? 1)) - Math.max(0, Number(a?.qty ?? 1)));

  let remaining = want;
  for (let i = 0; i < list.length && remaining > 0; i++) {
    if (!isLowMaterialInvEntry(list[i], itemMetaById, itemNameById)) continue;
    const q = Math.max(0, Number(list[i]?.qty ?? 1));
    if (q <= 0) continue;
    const take = Math.min(q, remaining);
    const next = q - take;
    remaining -= take;
    if (next <= 0) {
      list.splice(i, 1);
      i -= 1;
    } else {
      list[i] = { ...list[i], qty: next };
    }
  }

  return { inventory: list, consumed: want - remaining };
}

function pickBestEquipBySlot(inventory, slot) {
  const s = String(slot || '').toLowerCase();
  const list = Array.isArray(inventory) ? inventory : [];
  const cand = list.filter((x) => String(x?.equipSlot || inferEquipSlot(x) || '').toLowerCase() === s);
  if (!cand.length) return null;
  cand.sort((a, b) => clampTier4(Number(b?.tier || 1)) - clampTier4(Number(a?.tier || 1)));
  return cand[0] || null;
}

function autoEquipBest(actor, itemMetaById) {
  if (!actor || typeof actor !== 'object') return;
  const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const eq = ensureEquipped(actor);
  const nextEq = { ...eq };

  const kmap = (actor?._itemKeyById && typeof actor._itemKeyById === 'object') ? actor._itemKeyById : {};
  const goal = pickGoalLoadoutBySlot(actor);

  function keyOfInv(x) {
    const id = String(getInvItemId(x) || '');
    const k = String(x?.itemKey || x?.externalId || kmap?.[id] || '').trim();
    return k;
  };

  for (const s of EQUIP_SLOTS) {
    const goalKey = String(goal?.[s] || '').trim();
    if (goalKey) {
      const hit = inv.find((x) => String(x?.equipSlot || inferEquipSlot(x) || '').toLowerCase() === s && keyOfInv(x) === goalKey);
      if (hit) {
        nextEq[s] = String(getInvItemId(hit));
        continue;
      }
    }

    const best = pickBestEquipBySlot(inv, s);
    if (best) nextEq[s] = String(best?.itemId || best?.id || best?._id || '');
    else nextEq[s] = null;
  }
  actor.equipped = nextEq;
}

function day1HeroGearDirector(actor, publicItems, itemNameById, itemMetaById, day, phase, ruleset) {
  const d = Number(day || 0);
  const ph = String(phase || '').toLowerCase();
  if (d !== 1) return { changed: false, logs: [] };
  if (actor?.day1HeroDone) return { changed: false, logs: [] };

  // ✅ 관전형 요구사항(사용자): "1일차 밤"까지는 전원 영웅(T4) 세팅을 반드시 완료
  // - 파밍 RNG/재료 부족/이동 실패로 목표가 누락되는 것을 방지
  // - 낮에는 재료 소모 방식(단계적 제작/강화)을 유지하되, 밤에는 부족한 슬롯을 강제로 채움
  if (ph.includes('night')) {
    const logs = [];
    let inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
    inv = normalizeInventory(inv, ruleset);

    const preferredWeaponType = String(actor?.weaponType || '').trim();
    const wType = START_WEAPON_TYPES.includes(preferredWeaponType)
      ? preferredWeaponType
      : START_WEAPON_TYPES[Math.floor(Math.random() * START_WEAPON_TYPES.length)];
    const wTypeNorm = normalizeWeaponType(wType);

    for (const slot of EQUIP_SLOTS) {
      const best = pickBestEquipBySlot(inv, slot);
      const curTier = best ? clampTier4(Number(best?.tier || 1)) : 0;
      if (curTier >= 4) continue;
      const gear = createEquipmentItem({ slot, day: d, tier: 4, weaponType: slot === 'weapon' ? wTypeNorm : '' });
      inv = addItemToInventory(inv, gear, gear.itemId, 1, d, ruleset);
      logs.push(`✅ [${actor?.name}] 강제 세팅(1일차 밤): ${SLOT_ICON[slot] || '🧩'} 영웅 장비 획득`);
    }

    actor.inventory = inv;
    autoEquipBest(actor, itemMetaById);
    actor.day1HeroDone = true;
    logs.push(`🏁 [${actor?.name}] 1일차 밤 보정 완료: 영웅 장비 세트 확정`);
    return { changed: true, logs };
  }

  // 낮에는 기존 방식 유지: 최소 1회 이동 + 재료 소모로 단계적 달성
  if (Math.max(0, Number(actor?.day1Moves || 0)) < 1) return { changed: false, logs: [] };

  const logs = [];
  let inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  inv = normalizeInventory(inv, ruleset);

  const preferredWeaponType = String(actor?.weaponType || '').trim();
  const wType = START_WEAPON_TYPES.includes(preferredWeaponType)
    ? preferredWeaponType
    : START_WEAPON_TYPES[Math.floor(Math.random() * START_WEAPON_TYPES.length)];
  const wTypeNorm = normalizeWeaponType(wType);

  // 1) 비어있는 방어구 슬롯을 먼저 채움(머리/옷/팔) — 2재료씩
  for (const slot of ['head', 'clothes', 'arm']) {
    const has = !!pickBestEquipBySlot(inv, slot);
    const low = countLowMaterials(inv, itemMetaById, itemNameById);
    if (!has && low >= 2) {
      const dec = consumeLowMaterials(inv, 2, itemMetaById, itemNameById);
      inv = dec.inventory;
      const gear = createEquipmentItem({ slot, day: d, tier: 1, weaponType: '' });
      inv = addItemToInventory(inv, gear, gear.itemId, 1, d, ruleset);
      logs.push(`🛠️ [${actor?.name}] 제작: ${SLOT_ICON[slot] || '🧩'} ${gear?.name || '장비'} (일반)`);
    }
  }

  // 2) 무기/신발 포함 5부위 업그레이드(희귀→영웅) — 1재료씩
  // - 1일차 목표를 위해 한 페이즈에서 과도하게 반복하지 않도록 슬롯당 최대 2단계만 진행
  for (const slot of EQUIP_SLOTS) {
    for (let step = 0; step < 2; step += 1) {
      const it = pickBestEquipBySlot(inv, slot);
      if (!it) break;
      const curTier = clampTier4(Number(it?.tier || 1));
      if (curTier >= 4) break;

      const low = countLowMaterials(inv, itemMetaById, itemNameById);
      if (low < 1) break;

      // T1/2 -> T3, T3 -> T4
      const nextTier = curTier >= 3 ? 4 : 3;
      const dec = consumeLowMaterials(inv, 1, itemMetaById, itemNameById);
      if (dec.consumed < 1) break;
      inv = dec.inventory;

      const gear = createEquipmentItem({ slot, day: d, tier: nextTier, weaponType: slot === 'weapon' ? wTypeNorm : '' });
      inv = addItemToInventory(inv, gear, gear.itemId, 1, d, ruleset);
      logs.push(`⬆️ [${actor?.name}] 강화: ${SLOT_ICON[slot] || '🧩'} ${tierLabelKo(nextTier)} 장비 획득`);
    }
  }

  actor.inventory = inv;
  autoEquipBest(actor, itemMetaById);

  const done = EQUIP_SLOTS.every((s) => {
    const it = pickBestEquipBySlot(inv, s);
    return it && clampTier4(Number(it?.tier || 1)) >= 4;
  });

  if (done) {
    actor.day1HeroDone = true;
    logs.push(`✅ [${actor?.name}] 1일차 목표 달성: 영웅 장비 세트 완성(이동 ${Math.max(0, Number(actor?.day1Moves || 0))}회)`);
  }

  return { changed: logs.length > 0, logs };
}

// ===============================
// ✅ 후반 세팅: 전설(T5)/초월(T6) 제작 디렉터
// - 규칙(요청):
//   * 하급 재료 1 + (운석/생나/미스릴/포스코어) -> 전설(5)
//   * 하급 재료 1 + VF 혈액 샘플 -> 초월(6)
// - 목적: "파밍(크레딧) → 키오스크 구매 → 전설/초월 제작" 루프를 실제로 실행
// - 페이즈당 1회만 수행(과속/로그 스팸 방지)
// ===============================
function lateGameGearDirector(actor, publicItems, itemNameById, itemMetaById, day, phase, ruleset) {
  if (!actor || typeof actor !== 'object') return { changed: false, logs: [] };

  const d = Number(day || 0);
  const ph = String(phase || '');
  const logs = [];

  const phaseIdx = worldPhaseIndex(d, ph);
  if (Number(actor?.lateGameCraftPhaseIdx) === Number(phaseIdx)) return { changed: false, logs };

  let inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  inv = normalizeInventory(inv, ruleset);

  const up = computeLateGameUpgradeNeed(actor, itemMetaById, itemNameById, d, ph, ruleset);
  if (!up?.wantLegend && !up?.wantTrans) return { changed: false, logs };

  // 하급 재료 1개는 필수
  if (Number(up.lowCount || 0) < 1) return { changed: false, logs };

  // 어떤 슬롯을 올릴지: 현재 최저 티어 슬롯부터
  const slotOrder = EQUIP_SLOTS.slice();
  function slotTier(slot) {
    const best = pickBestEquipBySlot(inv, slot);
    return best ? clampTier4(Number(best?.tier || 1)) : 0;
  };
  slotOrder.sort((a, b) => (slotTier(a) - slotTier(b)) || String(a).localeCompare(String(b)));
  const preferredWeaponType = String(actor?.weaponType || '').trim();
  const wType = START_WEAPON_TYPES.includes(preferredWeaponType)
    ? preferredWeaponType
    : START_WEAPON_TYPES[Math.floor(Math.random() * START_WEAPON_TYPES.length)];
  const wTypeNorm = normalizeWeaponType(wType);

  // 목표 티어 결정
  const targetTier = up.wantTrans ? 6 : 5;

  // 재료 선택(우선순위)
  const vfId = findInvItemIdBySpecialKind(inv, 'vf', itemMetaById, itemNameById);
  const forceId = findInvItemIdBySpecialKind(inv, 'force_core', itemMetaById, itemNameById);
  const mithrilId = findInvItemIdBySpecialKind(inv, 'mithril', itemMetaById, itemNameById);
  const meteorId = findInvItemIdBySpecialKind(inv, 'meteor', itemMetaById, itemNameById);
  const lifeId = findInvItemIdBySpecialKind(inv, 'life_tree', itemMetaById, itemNameById);

  let specialId = '';
  let specialLabel = '';
  if (targetTier === 6) {
    specialId = vfId;
    specialLabel = 'VF';
    if (!specialId) return { changed: false, logs };
  } else {
    specialId = forceId || mithrilId || meteorId || lifeId;
    specialLabel = forceId ? '포스코어' : mithrilId ? '미스릴' : meteorId ? '운석' : lifeId ? '생나' : '';
    if (!specialId) return { changed: false, logs };
  }

  // 업그레이드가 필요한 슬롯 선택
  const slotPick = slotOrder.find((s) => slotTier(s) < targetTier) || slotOrder[0];
  if (!slotPick) return { changed: false, logs };

  // 인벤토리 공간(장비 교체 로직이 있으므로 canReceiveItem로 먼저 가드)
  const gear = createEquipmentItem({ slot: slotPick, day: d, tier: targetTier, weaponType: slotPick === 'weapon' ? wTypeNorm : '' });
  if (!canReceiveItem(inv, gear, gear.itemId, 1, ruleset)) return { changed: false, logs };

  // 재료 소모: 하급 1 + 특수 1
  const decLow = consumeLowMaterials(inv, 1, itemMetaById, itemNameById);
  if (decLow.consumed < 1) return { changed: false, logs };
  inv = decLow.inventory;
  inv = consumeIngredientsFromInv(inv, [{ itemId: String(specialId), qty: 1 }]);

  inv = addItemToInventory(inv, gear, gear.itemId, 1, d, ruleset);
  const meta = inv?._lastAdd;
  const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
  if (got > 0) {
    logs.push(`🛠️ [${actor?.name}] 후반 제작: ${specialLabel}+하급재료 → ${SLOT_ICON[slotPick] || '🧩'} ${gear?.name || '장비'} (${tierLabelKo(targetTier)})${formatInvAddNote(meta, 1, inv, ruleset)}`);
    actor.inventory = inv;
    autoEquipBest(actor, itemMetaById);
    actor.lateGameCraftPhaseIdx = phaseIdx;
    return { changed: true, logs };
  }

  return { changed: false, logs };
}



// ===============================
// ✅ 즉시 제작: 특수 재료 획득 즉시 전설(T5)/초월(T6) 장비 제작
// - 운석/생나/미스릴/포스코어: 전설(T5)
// - VF 혈액 샘플: 초월(T6)
// - 인벤이 꽉 차면 하급 재료 1스택을 버리고 공간을 만듭니다.
// - 과도한 로그/과속 방지를 위해 페이즈당 최대 2회까지만 허용합니다.
// ===============================
function ensureRoomForEquipment(inv, ruleset, itemMetaById, itemNameById) {
  const list = Array.isArray(inv) ? [...inv] : [];
  const rules = getInvRules(ruleset);
  if (list.length < Number(rules.maxSlots || 10)) return list;

  // 1) 장비가 아닌 것(재료/소모품)부터 버림
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const it = list[i];
    const cat = inferItemCategory(it);
    if (cat === 'equipment') continue;
    // 특수 재료(VF/운석/생나/미스릴/포코)는 버리지 않음
    const nm = String(it?.name || itemNameById?.[String(it?.itemId || it?.id || '')] || itemMetaById?.[String(it?.itemId || it?.id || '')]?.name || '');
    const sk = classifySpecialByName(nm);
    if (sk) continue;

    const q = Math.max(1, Number(it?.qty || 1));
    if (q > 1) list[i] = { ...it, qty: q - 1 };
    else list.splice(i, 1);
    return list;
  }

  // 2) 그래도 꽉 차면: 마지막 아이템 1개를 제거(최후 수단)
  list.pop();
  return list;
}

function tryImmediateCraftFromSpecial(actor, specialKind, specialItemId, itemNameById, itemMetaById, curDay, curPhase, phaseIdxNow, ruleset) {
  if (!actor || typeof actor !== 'object') return { changed: false, logs: [], pvpBonus: 0 };
  const k = String(specialKind || '');
  if (!k) return { changed: false, logs: [], pvpBonus: 0 };

  const targetTier = (k === 'vf') ? 6 : 5;
  const inv0 = Array.isArray(actor?.inventory) ? actor.inventory : [];

  // 페이즈당 과도한 즉시 제작 방지
  if (Number(actor?._specialCraftPhaseIdx ?? -9999) !== phaseIdxNow) {
    actor._specialCraftPhaseIdx = phaseIdxNow;
    actor._specialCraftCount = 0;
  }
  const cnt = Math.max(0, Number(actor?._specialCraftCount || 0));
  if (cnt >= 2) return { changed: false, logs: [], pvpBonus: 0 };

  const sid = String(specialItemId || '');
  if (!sid) return { changed: false, logs: [], pvpBonus: 0 };
  if (invQty(inv0, sid) <= 0) return { changed: false, logs: [], pvpBonus: 0 };

  let inv = normalizeInventory(inv0, ruleset);

  // 어떤 슬롯을 올릴지: 현재 최저 티어 슬롯부터
  function slotTier(slot) {
    const best = pickBestEquipBySlot(inv, slot);
    return best ? clampTier4(Number(best?.tier || 1)) : 0;
  };
  const slotOrder = EQUIP_SLOTS.slice().sort((a, b) => (slotTier(a) - slotTier(b)) || String(a).localeCompare(String(b)));
  const slotPick = slotOrder.find((s) => slotTier(s) < targetTier) || null;
  if (!slotPick) return { changed: false, logs: [], pvpBonus: 0 };

  // 무기 타입은 캐릭터 선호 기준으로
  const preferredWeaponType = String(actor?.weaponType || '').trim();
  const wType = START_WEAPON_TYPES.includes(preferredWeaponType)
    ? preferredWeaponType
    : START_WEAPON_TYPES[Math.floor(Math.random() * START_WEAPON_TYPES.length)];
  const wTypeNorm = normalizeWeaponType(wType);

  const gear = createEquipmentItem({ slot: slotPick, day: Number(curDay || 0), tier: targetTier, weaponType: slotPick === 'weapon' ? wTypeNorm : '' });

  // 공간 확보
  inv = ensureRoomForEquipment(inv, ruleset, itemMetaById, itemNameById);
  if (!canReceiveItem(inv, gear, gear.itemId, 1, ruleset)) return { changed: false, logs: [], pvpBonus: 0 };

  // 재료 소모(특수 재료 1개)
  inv = consumeIngredientsFromInv(inv, [{ itemId: sid, qty: 1 }]);

  inv = addItemToInventory(inv, gear, gear.itemId, 1, Number(curDay || 0), ruleset);
  const meta = inv?._lastAdd;
  const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
  if (got <= 0) return { changed: false, logs: [], pvpBonus: 0 };

  actor.inventory = inv;
  autoEquipBest(actor, itemMetaById);
  actor._specialCraftCount = cnt + 1;

  const label = (k === 'vf') ? 'VF→초월' : (k === 'force_core') ? '포스코어→전설' : (k === 'mithril') ? '미스릴→전설' : (k === 'meteor') ? '운석→전설' : (k === 'life_tree') ? '생나→전설' : '특수재료→전설';
  const logs = [`⚒️ [${actor?.name}] 즉시 제작: ${label} → ${SLOT_ICON[slotPick] || '🧩'} ${gear?.name || '장비'} (${tierLabelKo(targetTier)})${formatInvAddNote(meta, 1, inv, ruleset)}`];

  // 수집/제작은 소음이 커서 교전을 유발(다음 페이즈 + 즉시 표적)
  const pvpBonus = (k === 'vf') ? 0.55 : 0.35;

  return { changed: true, logs, inventory: inv, pvpBonus };
}
// --- 운석 + 생명의 나무 수액 → 포스 코어(간단 자동 조합) ---
const MAT_METEOR_ID = 'mat_meteor';
const MAT_TREE_ID = 'mat_world_tree';
const MAT_FORCE_CORE_ID = 'mat_force_core';

function invKey(it) {
  return String(it?.itemId || it?.id || it?._id || '');
}

function invDecOne(list, id) {
  const arr = Array.isArray(list) ? [...list] : [];
  const key = String(id || '');
  for (let i = 0; i < arr.length; i++) {
    if (invKey(arr[i]) !== key) continue;
    const q = Math.max(0, Number(arr[i]?.qty || 1));
    if (q > 1) arr[i] = { ...arr[i], qty: q - 1 };
    else arr.splice(i, 1);
    return arr;
  }
  return arr;
}

function invHasOne(list, id) {
  const key = String(id || '');
  return (Array.isArray(list) ? list : []).some((it) => invKey(it) === key && Math.max(0, Number(it?.qty || 1)) > 0);
}

function makeForceCore(day) {
  return { id: MAT_FORCE_CORE_ID, text: '포스 코어', type: 'material', tags: ['material', 'core', 'force_core'], acquiredDay: day };
}

// incomingId가 mat일 경우, 인벤에 저장하지 않아도 그 1개를 재료로 간주해 조합 가능
function tryAutoCraftForceCore(inventory, day, incomingId = '') {
  const inc = String(incomingId || '');
  const haveMeteor = inc === MAT_METEOR_ID || invHasOne(inventory, MAT_METEOR_ID);
  const haveTree = inc === MAT_TREE_ID || invHasOne(inventory, MAT_TREE_ID);
  if (!haveMeteor || !haveTree) return null;

  let next = Array.isArray(inventory) ? [...inventory] : [];
  if (inc !== MAT_METEOR_ID) next = invDecOne(next, MAT_METEOR_ID);
  if (inc !== MAT_TREE_ID) next = invDecOne(next, MAT_TREE_ID);
  next = [...next, makeForceCore(day)];
  return { inventory: next, log: '🧬 포스 코어 조합: 운석 파편 + 생명의 나무 수액 → 포스 코어 x1' };
}

function safeGenerateDynamicEvent(actor, day, ruleset, phase, publicItems) {
  try {
    // ✅ 기존 구현(2인자) / 신규 구현(3~4인자) 모두 호환
    const res = generateDynamicEvent(actor, day, ruleset, phase, publicItems);
    if (res && typeof res === 'object') return res;
    return {
      log: `🍞 [${actor?.name || '???'}]은(는) 주변을 살폈지만 별일이 없었다.`,
      damage: 0,
      recovery: 0,
      newItem: null,
    };
  } catch (err) {
    // ruleset 미정의 등 런타임 ReferenceError 방어
    console.error('[safeGenerateDynamicEvent] fallback:', err);
    return {
      log: `🍞 [${actor?.name || '???'}]은(는) 주변을 살폈지만 별일이 없었다.`,
      damage: 0,
      recovery: 0,
      newItem: null,
    };
  }
}

// --- 월드 시간(일차/낮/밤) 유틸 ---
// NOTE: 기존 phase(morning/night) 로직을 깨지 않기 위해, timeOfDay는 phase에서 파생합니다.
// - phase: 'morning' | 'night' (기존 유지)
// - timeOfDay: 'day' | 'night' (게이트/스폰 규칙용)
const TIME_OF_DAY_ORDER = { day: 0, night: 1 };

function getTimeOfDayFromPhase(ph) {
  return ph === 'morning' ? 'day' : 'night';
}

function worldTimeText(d, ph) {
  const tod = getTimeOfDayFromPhase(ph);
  const icon = tod === 'day' ? '🌞' : '🌙';
  const ko = tod === 'day' ? '낮' : '밤';
  return `${icon} ${Number(d || 0)}일차 ${ko}`;
}

// 예) 2일차 낮 이후: isAtOrAfterWorldTime(day, phase, 2, 'day')
function isAtOrAfterWorldTime(curDay, curPhase, reqDay, reqTimeOfDay = 'day') {
  const cd = Number(curDay || 0);
  const rd = Number(reqDay || 0);
  const cOrder = TIME_OF_DAY_ORDER[getTimeOfDayFromPhase(curPhase)] ?? 0;
  const rOrder = TIME_OF_DAY_ORDER[String(reqTimeOfDay)] ?? 0;
  if (cd > rd) return true;
  if (cd < rd) return false;
  return cOrder >= rOrder;
}

// --- 월드 페이즈 인덱스(배송/쿨다운 등) ---
// day=1, phase=morning(낮) => 0
// day=1, phase=night(밤)  => 1
function worldPhaseIndex(d, ph) {
  const dd = Math.max(0, Number(d || 0));
  const tod = getTimeOfDayFromPhase(ph);
  const base = Math.max(0, dd - 1) * 2;
  return base + (tod === 'night' ? 1 : 0);
}



export default function SimulationPage() {
  const [survivors, setSurvivors] = useState([]);
  const [dead, setDead] = useState([]);
  const [events, setEvents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [prevPhaseLogs, setPrevPhaseLogs] = useState([]);

  const PREVLOGS_OPEN_KEY = 'eh_prevlogs_open';
  const [showPrevLogs, setShowPrevLogs] = useState(() => {
    try {
      return localStorage.getItem(PREVLOGS_OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(PREVLOGS_OPEN_KEY, showPrevLogs ? '1' : '0');
    } catch {
      // ignore
    }
  }, [showPrevLogs]);
  const [runEvents, setRunEvents] = useState([]);
  const [forbiddenAddedNow, setForbiddenAddedNow] = useState([]);

  const [day, setDay] = useState(0);
  const [phase, setPhase] = useState('night');
  // timeOfDay: 'day' | 'night' (phase에서 파생, 날짜/스폰 게이트용)
  const [timeOfDay, setTimeOfDay] = useState(getTimeOfDayFromPhase('night'));
  // ⏱ 경기 경과 시간(초) - 하이브리드(페이즈 버튼 + 내부 틱)에서 기준이 되는 절대 시간
  const [matchSec, setMatchSec] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const initDebugLine = `init api: ${getApiBase()} | deps: ${INIT_DEPENDENCY_PATHS.join(', ')}`;
  function safeRenderCompute(label, factory, fallback) {
    try {
      return factory();
    } catch (err) {
      console.error(`[simulation:${label}]`, err);
      return fallback;
    }
  };

  // 킬 카운트 및 결과창 관리
  const [killCounts, setKillCounts] = useState({});
  const [assistCounts, setAssistCounts] = useState({});
  const [showResultModal, setShowResultModal] = useState(false);
  const [gameEndReason, setGameEndReason] = useState(null); // 게임 종료 사유(예: 6번째 밤 타임리밋)
  const [winner, setWinner] = useState(null);
  const [resultSummary, setResultSummary] = useState(null);

  // 서버 설정값
  const [settings, setSettings] = useState({
    statWeights: { str: 1, agi: 1, int: 1, men: 1, luk: 1, dex: 1, sht: 1, end: 1 },
    suddenDeathTurn: 5,
    forbiddenZoneStartDay: 2,
    forbiddenZoneStartPhase: 'night',
    forbiddenZoneDamageBase: 1.5,
    rulesetId: 'ER_S10',
  });

  // 🗺️ 맵 선택(로드맵 2번)
  const [maps, setMaps] = useState([]);
  const [activeMapId, setActiveMapId] = useState('');
  // 🌀 하이퍼루프(맵 즉시 이동): 현재 맵에서 이동 가능한 목적지(로컬 설정)
  const [hyperloopDestId, setHyperloopDestId] = useState('');
  const [hyperloopCharId, setHyperloopCharId] = useState('');

  // 🪟 UI 모달(미니맵/캐릭터/로그)
  const [uiModal, setUiModal] = useState(null); // 'map' | 'chars' | 'log' | null
  const closeUiModal = () => setUiModal(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeUiModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);


  // 🧩 월드 스폰 상태(전설 재료 상자/보스) - 맵별로 관리
  const [spawnState, setSpawnState] = useState(() => createInitialSpawnState(activeMapId));

  const isFinishingRef = useRef(false);
  // ✅ 시작(1일차 낮) 기본 장비 세팅이 1회만 적용되도록 플래그
  const startStarterLoadoutAppliedRef = useRef(false);
  // ✅ 1일차 밤 "1회 이상 이동" 달성자에게 영웅 세팅(안전망)이 1회만 적용되도록 플래그
  const day1NightHeroCatchupAppliedRef = useRef(false);

  // ✅ 시뮬 랜덤 장비를 DB(Item 컬렉션)에 저장하기 위한 캐시
  // - 같은 장비를 반복 저장하지 않도록 externalId(wpn_/eq_)를 기억
  const simEquipSavedIdsRef = useRef(new Set());
  const simEquipPersistBusyRef = useRef(false);

  async function persistSimEquipmentsFromChars(chars, reason = 'phase') {
    // 동시에 여러 번 호출되면 서버가 과부하/중복 저장될 수 있어 1회만 진행
    if (simEquipPersistBusyRef.current) return;

    try {
      const arr = Array.isArray(chars) ? chars : [];
      const picked = [];
      const seen = new Set();

      for (const c of arr) {
        const inv = Array.isArray(c?.inventory) ? c.inventory : [];
        for (const it of inv) {
          if (!isSimGeneratedEquipment(it)) continue;
          const extId = getSimEquipExternalId(it);
          if (!extId) continue;
          if (simEquipSavedIdsRef.current.has(extId)) continue;
          if (seen.has(extId)) continue;
          seen.add(extId);
          picked.push(it);
        }
      }

      if (!picked.length) return;

      simEquipPersistBusyRef.current = true;
      // 서버 저장(실패해도 시뮬은 계속 진행)
      const res = await apiPost('/items/ingest-sim-equipments', {
        items: picked,
        reason,
      }).catch(() => null);

      // 성공 시에만 캐시 갱신
      if (res && (res.message === 'ok' || Number(res.savedCount || 0) > 0)) {
        for (const it of picked) {
          const extId = getSimEquipExternalId(it);
          if (extId) simEquipSavedIdsRef.current.add(extId);
        }
      }
    } finally {
      simEquipPersistBusyRef.current = false;
    }
  };

  // SD 서든데스(6번째 밤 이후): 페이즈 고정 + 전 구역 금지구역 + 카운트다운
  const suddenDeathActiveRef = useRef(false);
  const suddenDeathEndAtSecRef = useRef(null);
  const suddenDeathForbiddenAnnouncedRef = useRef(false);



const activeMapName = useMemo(() => {
  const list = Array.isArray(maps) ? maps : [];
  return list.find((m) => String(m?._id) === String(activeMapId))?.name || '맵 없음';
}, [maps, activeMapId]);

  // 로그에서 [이름]을 파싱해 아이콘을 붙이기 위한 캐시
  const actorAvatarByName = useMemo(() => {
    const out = {};
    const all = [...(Array.isArray(survivors) ? survivors : []), ...(Array.isArray(dead) ? dead : [])];
    for (const c of all) {
      const name = String(c?.name || '').trim();
      const img = String(c?.previewImage || c?.image || '').trim();
      if (name && img && !out[name]) out[name] = img;
    }
    return out;
  }, [survivors, dead]);

  // ✅ 상점/조합/교환 패널
  const [marketTab, setMarketTab] = useState('craft'); // craft | kiosk | drone | perk | trade
  const [selectedCharId, setSelectedCharId] = useState('');
  const [credits, setCredits] = useState(0);
  const [publicItems, setPublicItems] = useState([]);
  const [kiosks, setKiosks] = useState([]);
  const [droneOffers, setDroneOffers] = useState([]);
  const [publicPerks, setPublicPerks] = useState([]);
  const [tradeOffers, setTradeOffers] = useState([]);
  const [viewerLp, setViewerLp] = useState(() => Number(getUser()?.lp || 0));
  const [viewerPerks, setViewerPerks] = useState(() => (Array.isArray(getUser()?.perks) ? getUser().perks : []));
  const [myTradeOffers, setMyTradeOffers] = useState([]);
  const [qtyMap, setQtyMap] = useState({});
  const [marketMessage, setMarketMessage] = useState('');
  const [tradeDraft, setTradeDraft] = useState({
    give: [{ itemId: '', qty: 1 }],
    want: [{ itemId: '', qty: 1 }],
    wantCredits: 0,
    note: '',
  });

  const logBoxRef = useRef(null);
  const logWindowRef = useRef(null);
  const hasInitialized = useRef(false);
  const forbiddenCacheRef = useRef({});
  const logSeqRef = useRef(0);
  const hyperloopPickLogRef = useRef({ inited: false, last: '' });
  // ✅ UI용 logs는 "현재 페이즈"만 보여주고, 전체 기록은 따로 누적합니다.
  const fullLogsRef = useRef([]);
  const [logBoxMaxH, setLogBoxMaxH] = useState(420);

  // 🗺️ 맵/ID는 시뮬 "시작" 순간에 서버에서 새로고침할 수 있어, ref로 즉시값을 유지합니다.
  const mapsRef = useRef([]);
  const activeMapIdRef = useRef('');
  const activeMapRef = useRef(null);


  // phase(morning/night) -> timeOfDay(day/night) 동기화
  useEffect(() => {
    setTimeOfDay(getTimeOfDayFromPhase(phase));
  }, [phase]);


  // ▶️ 오토 플레이(페이즈 자동 진행)
  // - "틱 기반"은 페이즈 내부를 초 단위로 계산하는 엔진이고,
  // - 오토 플레이는 "다음 페이즈" 버튼을 일정 간격으로 자동 눌러주는 UX입니다.
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(1); // 0.5 / 1 / 2 / 4
  const [isAdvancing, setIsAdvancing] = useState(false);
  const isAdvancingRef = useRef(false);
  const isRefreshingMapsRef = useRef(false);
  const [isRefreshingMapSettings, setIsRefreshingMapSettings] = useState(false);
  const [mapRefreshToast, setMapRefreshToast] = useState(null);
  const mapRefreshToastTimerRef = useRef(null);
  const proceedPhaseGuardedRef = useRef(null);

  function showMapRefreshToast(text, kind = 'info') {
    // ✅ 헤더에서 1~2초 보이는 가벼운 토스트(연타/중복 호출 대응)
    try {
      if (mapRefreshToastTimerRef.current) clearTimeout(mapRefreshToastTimerRef.current);
    } catch {}
    setMapRefreshToast({ text: String(text || ''), kind: String(kind || 'info') });
    mapRefreshToastTimerRef.current = setTimeout(() => {
      setMapRefreshToast(null);
      mapRefreshToastTimerRef.current = null;
    }, 1700);
  };

  useEffect(() => {
    return () => {
      try {
        if (mapRefreshToastTimerRef.current) clearTimeout(mapRefreshToastTimerRef.current);
      } catch {}
    };
  }, []);

  // ✅ 관전자 모드 기본: 상점/조합/교환 UI는 숨김(테스트용 토글)
  const [showMarketPanel, setShowMarketPanel] = useState(false);
  const [pendingTranscendPick, setPendingTranscendPick] = useState(null);

  // 🎲 시드 고정(랜덤 재현)
  const SEED_STORAGE_KEY = 'eh_run_seed';
  function getInitialSeed() {
    try {
      const v = localStorage.getItem(SEED_STORAGE_KEY);
      const s = (v && String(v).trim()) ? String(v).trim() : '';
      return s || String(Date.now());
    } catch {
      return String(Date.now());
    }
  };
  const [runSeed, setRunSeed] = useState(getInitialSeed);
  const [seedDraft, setSeedDraft] = useState(getInitialSeed);
  const randomBackupRef = useRef(null);

  // ✅ (팝업/데스크톱) 시뮬레이션 창: 로그 출력 길이에 맞춰 높이를 유동 조정
  function resizeSimWindowToContent() {
    try {
      if (typeof window === 'undefined') return;
      if (typeof window.resizeTo !== 'function') return;

      const ua = String(navigator?.userAgent || '');
      const isElectron = ua.includes('Electron');
      const isPopup = !!window.opener;

      // 일반 브라우저 탭에서는 resizeTo가 기대대로 동작하지 않으므로, 팝업/데스크톱만 적용
      if (!isElectron && !isPopup) return;

      const doc = document.documentElement;
      const body = document.body;
      const contentH = Math.max(Number(doc?.scrollHeight || 0), Number(body?.scrollHeight || 0));
      const chromeH = Math.max(0, Number(window.outerHeight || 0) - Number(window.innerHeight || 0));

      const minH = 520;
      const maxH = Math.max(minH, Number(screen?.availHeight || 9999) - 40);
      const targetH = Math.max(minH, Math.min(maxH, contentH + chromeH + 20));

      window.resizeTo(Number(window.outerWidth || 1280), targetH);
    } catch {
      // ignore
    }
  };

  function addLog(text, type = 'normal') {
    // 전체 로그(서버 저장/결과용)는 페이즈 초기화와 무관하게 누적
    try {
      fullLogsRef.current = [...(Array.isArray(fullLogsRef.current) ? fullLogsRef.current : []), String(text || '')];
    } catch {}
    // ✅ React StrictMode(dev)에서는 state updater가 2번 호출될 수 있어,
    //   id 생성/카운터 증가를 updater 내부에서 처리해 key 충돌을 방지합니다.
    setLogs((prev) => {
      logSeqRef.current += 1;
      const rand = Math.random().toString(16).slice(2);
      const id = `${Date.now()}-${logSeqRef.current}-${rand}`;
      return [...prev, { text, type, id }];
    });
  };

  // 🎯 하이퍼루프 대상 변경 로그(미니맵/로그에서 구분용)
  useEffect(() => {
    const whoId = String(hyperloopCharId || '').trim();
    if (!whoId) return;

    const ref = hyperloopPickLogRef.current || { inited: false, last: '' };

    // 초기 세팅(기본값 자동 선택)에서는 로그 스팸 방지
    if (!ref.inited) {
      ref.inited = true;
      ref.last = whoId;
      hyperloopPickLogRef.current = ref;
      return;
    }

    if (String(ref.last || '') === whoId) return;
    ref.last = whoId;
    hyperloopPickLogRef.current = ref;

    const whoName = (Array.isArray(survivors) ? survivors : []).find((c) => String(c?._id) === whoId)?.name || '선택 캐릭터';
    addLog(`🎯 하이퍼루프 대상 선택: ${whoName}`, 'system');
  }, [hyperloopCharId, survivors]);


  // 🧾 구조적 이벤트 로그(재현/디버깅용)
  // - 문자열 로그는 사람용, runEvents는 "룰/상태"를 요약/집계하기 위한 데이터용
  function emitRunEvent(kind, payload = {}, at = null) {
    const stamp = at || { day, phase, sec: matchSec };
    const e = { kind: String(kind || 'unknown'), at: stamp, ts: Date.now(), ...payload };
    setRunEvents((prev) => {
      const next = [...(Array.isArray(prev) ? prev : []), e];
      const max = 5000;
      return next.length > max ? next.slice(next.length - max) : next;
    });
  };

  function emitCraftRunEvent(who, crafted, at = null, zoneId = '') {
    if (!crafted?.craftedId) return;
    emitRunEvent('craft', {
      who: String(who || ''),
      itemId: String(crafted.craftedId || ''),
      itemName: String(crafted.craftedName || ''),
      tier: Math.max(1, Number(crafted?.craftedTier || 1)),
      zoneId: String(zoneId || ''),
      qty: 1,
    }, at);
  };

  function emitQueueRunEvent(who, payload = {}, at = null) {
    const blocked = (Array.isArray(payload?.blockedReasons) ? payload.blockedReasons : [])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 4);
    const candidates = (Array.isArray(payload?.candidates) ? payload.candidates : [])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 6);
    const candidateScores = (Array.isArray(payload?.candidateScores) ? payload.candidateScores : [])
      .map((row) => {
        if (!row) return '';
        if (typeof row === 'string') return String(row).trim();
        const type = String(row?.type || row?.label || '').trim();
        const score = Number(row?.score || 0);
        if (!type) return '';
        return `${type}:${Number.isFinite(score) ? score.toFixed(1) : '0.0'}`;
      })
      .filter(Boolean)
      .slice(0, 5);
    const chosen = String(payload?.chosen || '').trim();
    if (!chosen && !blocked.length && candidates.length <= 1) return;
    emitRunEvent('queue', {
      who: String(who?._id || payload?.who || ''),
      whoName: String(who?.name || payload?.whoName || ''),
      zoneId: String(payload?.zoneId || who?.zoneId || ''),
      chosen,
      blockedReasons: blocked,
      candidates,
      candidateScores,
      candidateCount: Math.max(0, Number(payload?.candidateCount || candidates.length || 0)),
      blockedCount: blocked.length,
      reason: String(payload?.reason || ''),
    }, at);
  };

  function emitEffectRunEvents(who, rows, meta = {}, at = null) {
    const whoId = String(who?._id || meta?.whoId || '');
    const whoName = String(who?.name || meta?.whoName || meta?.who || '');
    const zoneId = String(meta?.zoneId || who?.zoneId || '');
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const eff = row?.effect || null;
      const effectName = String(eff?.name || '').trim();
      if (!effectName) return;
      const outcome = row?.reason === 'immune'
        ? 'immune'
        : row?.reason === 'resisted'
          ? 'resisted'
          : row?.applied
            ? 'applied'
            : 'skipped';
      emitRunEvent('effect', {
        who: whoId,
        whoName,
        zoneId,
        source: String(meta?.source || ''),
        itemId: String(meta?.itemId || ''),
        skill: String(meta?.skill || ''),
        reason: String(meta?.reason || ''),
        effect: effectName,
        duration: Math.max(0, Number(eff?.duration ?? 0)),
        stacks: Math.max(0, Number(eff?.stacks ?? eff?.stack ?? 0)),
        outcome,
      }, at);
    });
  };

  function emitConsumableRunEvent(who, item, meta = {}, at = null) {
    const whoId = String(who?._id || meta?.whoId || '');
    const itemId = String(item?._id || item?.itemId || meta?.itemId || '');
    emitRunEvent('use', {
      who: whoId,
      whoName: String(who?.name || meta?.whoName || ''),
      zoneId: String(meta?.zoneId || who?.zoneId || ''),
      source: String(meta?.source || 'consumable'),
      reason: String(meta?.reason || ''),
      manual: meta?.manual === true,
      itemId,
      itemName: itemDisplayName(item || { _id: itemId, name: meta?.itemName || '' }),
      heal: Math.max(0, Number(meta?.heal || 0)),
      cleansed: Math.max(0, Number(meta?.cleansed || 0)),
      removedEffects: Array.isArray(meta?.removedEffects) ? meta.removedEffects.map((x) => String(x || '')).filter(Boolean) : [],
    }, at);
  };

  // 🛠 개발자 도구: 선택 캐릭터에게 소모품을 임의로 사용(강제)
  // - 전투 중 사용 불가: 진행 중(isAdvancing)일 때는 버튼을 비활성화합니다.
  
  // 🎁 개발자 도구: 초월 장비 선택 상자(선택 대기) 처리
  function resolvePendingTranscendPick(optionIndex, method = 'manual') {
    if (!pendingTranscendPick) return;

    const pending = pendingTranscendPick;
    const ruleset = getRuleset(settings?.rulesetId);
    const options = Array.isArray(pending?.options) ? pending.options : [];
    const chosen = (Number(optionIndex) === -1) ? pickAutoTranscendOption(options, publicItems) : (options[Number(optionIndex)] || null);

    if (!chosen?.itemId) {
      setPendingTranscendPick(null);
      return;
    }

    const item = (Array.isArray(publicItems) ? publicItems : []).find((it) => String(it?._id) === String(chosen.itemId)) || null;

    setSurvivors((prev) => {
      const next = (Array.isArray(prev) ? prev : []).map((c) => ({
        ...c,
        inventory: Array.isArray(c?.inventory) ? c.inventory.map((i) => ({ ...i })) : [],
      }));
      const idx = next.findIndex((c) => String(c?._id) === String(pending.characterId));
      if (idx < 0) return prev;

      const ch = next[idx];
      ch.inventory = addItemToInventory(ch.inventory, item, String(chosen.itemId), 1, day, ruleset);
      const meta = ch.inventory?._lastAdd || null;
      const got = Math.max(1, Number(meta?.acceptedQty || 1));
      const nm = itemDisplayName(item || { _id: chosen.itemId, name: chosen.name });
      addLog(`🎁 [${ch.name}] 초월 장비 선택 상자 선택 → ${itemIcon(item)} ${nm}${got > 1 ? ` x${got}` : ''}${formatInvAddNote(meta)}`, 'highlight');
      emitRunEvent('gain', { who: ch.name, whoId: ch._id, itemId: String(chosen.itemId), qty: got, source: 'box', sourceKind: 'transcend_pick', zoneId: pending.zoneId, choice: method }, pending.at || { day, phase, sec: matchSec });
      return next;
    });

    setPendingTranscendPick(null);
  };
const devForceUseConsumable = (charId, invIndex) => {
    if (!showMarketPanel) return;
    if (isAdvancing || isGameOver) return;

    setSurvivors((prev) => {
      const next = (Array.isArray(prev) ? prev : []).map((c) => ({
        ...c,
        inventory: Array.isArray(c?.inventory) ? c.inventory.map((i) => ({ ...i })) : [],
      }));
      const idx = next.findIndex((c) => String(c?._id) === String(charId));
      if (idx < 0) return prev;

      const ch = next[idx];
      const inv = Array.isArray(ch?.inventory) ? ch.inventory : [];
      const ii = Number(invIndex);
      if (!Number.isFinite(ii) || ii < 0 || ii >= inv.length) return prev;

      const it = inv[ii];
      if (inferItemCategory(it) !== 'consumable') return prev;

      const beforeHp = Number(ch.hp || 0);
      const maxHp = Number(ch?.maxHp ?? 100);

      const effect = applyItemEffect(ch, it);
      let heal = Math.max(0, Number(effect?.recovery || 0));
      const cleanseCfg = effect?.cleanse && typeof effect.cleanse === 'object'
        ? effect.cleanse
        : (isBandageLikeItem(it)
          ? { names: [EFFECT_BLEED, EFFECT_POISON, EFFECT_BURN, EFFECT_FOOD_POISON], removeAllNegative: false, bonusHeal: 0 }
          : null);
      const cleanse = cleanseCfg
        ? clearNegativeStatusEffects(ch, { names: Array.isArray(cleanseCfg?.names) ? cleanseCfg.names : [], removeAllNegative: cleanseCfg?.removeAllNegative === true })
        : { changed: false, removed: [] };
      if (cleanse.changed) heal += Math.max(0, perkNumber(getActorPerkEffects(ch)?.cleanseHealPlus || 0)) + Math.max(0, Number(cleanseCfg?.bonusHeal || 0));
      ch.hp = Math.min(maxHp, beforeHp + heal);

      const statBoost = effect?.statBoost && typeof effect.statBoost === 'object' ? effect.statBoost : null;
      if (statBoost) {
        ch.stats = ch.stats && typeof ch.stats === 'object' ? { ...ch.stats } : {};
        Object.entries(statBoost).forEach(([key, value]) => {
          const v = Number(value || 0);
          if (!Number.isFinite(v) || v === 0) return;
          ch.stats[key] = Number(ch.stats?.[key] || 0) + v;
        });
      }
      const runtimeEffects = applyRuntimeEffectPayloads(ch, effect?.newEffects);
      runtimeEffects.results.forEach((row) => {
        if (row?.reason === 'immune') addLog(`🛡️ [${ch.name}] ${String(row?.effect?.name || '효과')} 면역`, 'system');
        else if (row?.reason === 'resisted') addLog(`🧷 [${ch.name}] ${String(row?.effect?.name || '효과')} 저항`, 'system');
        else if (row?.applied) addLog(`🪄 [${ch.name}] ${describeRuntimeEffect(row.effect)}`, 'system');
      });

      const cured = !!cleanse.changed;

      const curQty = Number(it?.qty || 1);
      if (Number.isFinite(curQty) && curQty > 1) inv[ii] = { ...it, qty: curQty - 1 };
      else inv.splice(ii, 1);

      const delta = Math.max(0, Number(ch.hp || 0) - beforeHp);
      const nm = itemDisplayName(it);
      addLog(`🧪 [${ch.name}] 강제 사용: ${itemIcon(it)} ${nm} (+${delta} HP${cured ? ', 상태이상 정리' : ''})`, 'highlight');
      emitConsumableRunEvent(ch, it, { source: 'consumable', reason: 'dev_force', manual: true, heal: delta, cleansed: Array.isArray(cleanse?.removed) ? cleanse.removed.length : 0, removedEffects: Array.isArray(cleanse?.removed) ? cleanse.removed : [] });
      emitEffectRunEvents(ch, runtimeEffects.results, { source: 'consumable', itemId: String(it?._id || it?.itemId || ''), reason: 'dev_force' });
      return next;
    });
  };

  useEffect(() => {
    const el = logBoxRef.current;
    if (!el) return;

    // ✅ 로그 길이에 맞춰 로그창 높이를 유동적으로 조절(최소~최대 클램프)
    const measure = () => {
      const h = Math.max(0, Number(el.scrollHeight || 0));
      const desired = Math.max(180, Math.min(560, h + 8));
      setLogBoxMaxH(desired);

      // ✅ 로그가 쌓여도 "페이지"가 아니라 로그 창 내부만 스크롤되게 고정
      el.scrollTop = el.scrollHeight;

      // ✅ (팝업/데스크톱) 창 높이도 로그 길이에 맞춰 유동 조정
      resizeSimWindowToContent();
    };

    // 렌더 직후 실제 scrollHeight를 잡기 위해 한 프레임 뒤에 측정
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [logs, prevPhaseLogs, showPrevLogs]);

// 선택 캐릭터 기본값 유지
  useEffect(() => {
    if (!survivors?.length) {
      setSelectedCharId('');
      return;
    }
    if (!selectedCharId) {
      setSelectedCharId(survivors[0]._id);
      return;
    }
    if (!survivors.some((s) => String(s._id) === String(selectedCharId))) {
      setSelectedCharId(survivors[0]._id);
    }
  }, [survivors, selectedCharId]);

  const selectedChar = useMemo(() => survivors.find((s) => String(s._id) === String(selectedCharId)) || null, [survivors, selectedCharId]);

  // 🎒 장비 장착/해제(런타임): equipped[slot]에 itemId를 저장
  function setEquipForSurvivor(survivorId, slot, itemIdOrNull) {
    const sid = String(survivorId || '');
    const sslot = String(slot || '');
    if (!sid || !EQUIP_SLOTS.includes(sslot)) return;

    setSurvivors((prev) =>
      (Array.isArray(prev) ? prev : []).map((s) => {
        const id = String(s?._id || s?.id || s?.name || '');
        if (id !== sid) return s;
        const eq = { ...ensureEquipped(s) };
        eq[sslot] = itemIdOrNull ? String(itemIdOrNull) : null;
        return { ...s, equipped: eq };
      })
    );
  };


  const activeMap = useMemo(
    () => (Array.isArray(maps) ? maps : []).find((m) => String(m._id) === String(activeMapId)) || null,
    [maps, activeMapId]
  );

  // ref 동기화(즉시 접근 필요)
  useEffect(() => {
    mapsRef.current = Array.isArray(maps) ? maps : [];
  }, [maps]);
  useEffect(() => {
    activeMapIdRef.current = String(activeMapId || '');
  }, [activeMapId]);
  useEffect(() => {
    activeMapRef.current = activeMap;
  }, [activeMap]);

  // 맵이 바뀌면 월드 스폰 상태 초기화
  useEffect(() => {
    setSpawnState(createInitialSpawnState(activeMapId));
  }, [activeMapId]);

  const zones = useMemo(() => {
    const z = Array.isArray(activeMap?.zones) ? activeMap.zones : [];
    // 맵에 zones 데이터가 없을 때(개발/테스트) 기본 구역 세트를 제공합니다.
    // - 키오스크 있음: 병원/성당/경찰서/소방서/양궁장/절/창고/연구소/호텔/학교
    // - 키오스크 없음: 주유소/골목길/모래사장/숲/개울/연못/공장/항구/고급 주택가
    return z.length ? z : [
      { zoneId: 'hospital', name: '병원', isForbidden: false },
      { zoneId: 'cathedral', name: '성당', isForbidden: false },
      { zoneId: 'police', name: '경찰서', isForbidden: false },
      { zoneId: 'firestation', name: '소방서', isForbidden: false },
      { zoneId: 'archery', name: '양궁장', isForbidden: false },
      { zoneId: 'temple', name: '절', isForbidden: false },
      { zoneId: 'warehouse', name: '창고', isForbidden: false },
      { zoneId: 'lab', name: '연구소', isForbidden: false },
      { zoneId: 'hotel', name: '호텔', isForbidden: false },
      { zoneId: 'school', name: '학교', isForbidden: false },

      { zoneId: 'gas_station', name: '주유소', isForbidden: false },
      { zoneId: 'alley', name: '골목길', isForbidden: false },
      { zoneId: 'beach', name: '모래사장', isForbidden: false },
      { zoneId: 'forest', name: '숲', isForbidden: false },
      { zoneId: 'stream', name: '개울', isForbidden: false },
      { zoneId: 'pond', name: '연못', isForbidden: false },
      { zoneId: 'factory', name: '공장', isForbidden: false },
      { zoneId: 'port', name: '항구', isForbidden: false },
      { zoneId: 'residential', name: '고급 주택가', isForbidden: false },
    ];
  }, [activeMap]);

  const zoneNameById = useMemo(() => {
    const out = {};
    zones.forEach((z) => {
      if (z?.zoneId) out[String(z.zoneId)] = z.name || String(z.zoneId);
    });
    return out;
  }, [zones]);

  function getZoneName(zoneId) {
    const key = String(zoneId || '');
    return zoneNameById[key] || key || '미상';
  }

  // 🌀 하이퍼루프 목적지(로컬 설정): eh_map_hyperloops_{mapId}
  const hyperloopDestIds = useMemo(() => {
    const ids = uniqStr(readLocalJsonArray(localKeyHyperloops(activeMapId)));
    if (!ids.length) return [];
    const mapSet = new Set((Array.isArray(maps) ? maps : []).map((m) => String(m?._id || '')));
    return ids.filter((id) => mapSet.has(String(id)));
  }, [activeMapId, maps]);

  // 🌀 하이퍼루프 장치(패드) 구역(로컬 설정): eh_hyperloop_zone_{mapId}
  const hyperloopPadZoneId = useMemo(() => {
    // ✅ 서버(어드민) 지정값 우선 적용
    const serverZoneId = String(activeMap?.hyperloopDeviceZoneId || '').trim();
    if (serverZoneId) return serverZoneId;
    const saved = String(getHyperloopDeviceZoneId(activeMapId) || '').trim();
    if (saved) return saved;
    const z = Array.isArray(zones) ? zones : [];
    return String(z?.[0]?.zoneId || '');
  }, [activeMapId, zones, activeMap]);

  const hyperloopPadName = useMemo(() => {
    const zid = String(hyperloopPadZoneId || '').trim();
    if (!zid) return '';
    return String(getZoneName(zid) || zid);
  }, [hyperloopPadZoneId, zoneNameById]);

  const isSelectedCharOnHyperloopPad = useMemo(() => {
    const who = String(selectedCharId || '').trim();
    if (!who) return false;
    const pad = String(hyperloopPadZoneId || '').trim();
    if (!pad) return false;
    const actor = (Array.isArray(survivors) ? survivors : []).find((c) => String(c?._id || '') === who) || null;
    return String(actor?.zoneId || '').trim() === pad;
  }, [selectedCharId, survivors, hyperloopPadZoneId]);

  const hyperloopDestKey = hyperloopDestIds.join('|');

  useEffect(() => {
    if (!hyperloopDestIds.length) {
      setHyperloopDestId('');
      return;
    }
    if (!hyperloopDestId || !hyperloopDestIds.includes(String(hyperloopDestId))) {
      setHyperloopDestId(String(hyperloopDestIds[0]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hyperloopDestKey]);

// 🌀 하이퍼루프 이동 대상(캐릭터) 기본값: 선택 캐릭터 우선
useEffect(() => {
  const preferred = String(selectedCharId || '').trim();
  if (preferred) {
    if (String(hyperloopCharId || '') !== preferred) setHyperloopCharId(preferred);
    return;
  }
  const alive = (Array.isArray(survivors) ? survivors : []).filter((c) => Number(c?.hp || 0) > 0);
  if (!alive.length) {
    setHyperloopCharId('');
    return;
  }
  if (!hyperloopCharId || !alive.some((c) => String(c?._id) === String(hyperloopCharId))) {
    setHyperloopCharId(String(alive[0]?._id || ''));
  }
}, [survivors, hyperloopCharId, selectedCharId]);

  function doHyperloopJump(toMapId, whoId) {
    const toId = String(toMapId || '').trim();
const who = String(whoId || '').trim();
if (!who) {
  addLog('🌀 하이퍼루프: 이동할 캐릭터를 선택하세요.', 'system');
  return;
}
    if (!toId) return;
    if (loading || isAdvancing || isGameOver) return;
    if (day <= 0) {
      addLog('🌀 하이퍼루프: 게임 시작 후(1일차부터) 사용할 수 있습니다.', 'system');
      return;
    }

    // 맵 내 장치(패드) 구역에 있어야 사용 가능
    const padZid = String(hyperloopPadZoneId || '').trim();
    const actor = (Array.isArray(survivors) ? survivors : []).find((c) => String(c?._id || '') === who) || null;
    const actorZid = String(actor?.zoneId || '').trim();
    if (!padZid || actorZid !== padZid) {
      const padNm = String(hyperloopPadName || padZid || '하이퍼루프 구역');
      addLog(`🌀 하이퍼루프 장치: [${padNm}]에서만 사용할 수 있습니다.`, 'system');
      return;
    }
    const toMap = (Array.isArray(maps) ? maps : []).find((m) => String(m?._id) === toId) || null;
    if (!toMap) return;

    const rs = getRuleset(settings?.rulesetId);
    const forb = new Set(getForbiddenZoneIdsForPhase(toMap, day, phase, rs));
    const z = Array.isArray(toMap?.zones) ? toMap.zones : [];
    const eligible = getEligibleSpawnZoneIds(z, forb);

    // 목적지 맵에도 패드 구역이 있으면 그곳으로 도착(금지구역이면 예외)
    const destPad = String(getHyperloopDeviceZoneId(toId) || '').trim();
    const destPadOk = !!destPad && z.some((zz) => String(zz?.zoneId || '') === destPad) && !forb.has(destPad);
    const entryZoneId = String((destPadOk ? destPad : (eligible?.[0] || z?.[0]?.zoneId)) || '__default__');

    const fromName = String(activeMapName || '현재맵');
    const toName = String(toMap?.name || '목적지');
    setActiveMapId(toId);
    setSurvivors((prev) => (Array.isArray(prev) ? prev : []).map((c) => (String(c?._id) === who ? ({ ...c, mapId: toId, zoneId: entryZoneId }) : c)));
    const whoName = (Array.isArray(survivors) ? survivors : []).find((c) => String(c?._id) === who)?.name || '선택 캐릭터';
    addLog(`🌀 하이퍼루프 이동: ${fromName} → ${toName} (${whoName})`, 'highlight');
    emitRunEvent('hyperloop', { whoId: who, who: whoName, fromMapId: String(activeMapId || ''), toMapId: toId, toZoneId: entryZoneId });
  };



  // ⏱ mm:ss 포맷
  function formatClock(totalSec) {
    const s = Math.max(0, Number(totalSec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  };

  // 전투 로그 보정: 비치명(HP>0)인데도 '분쇄/처치' 같은 문구가 나오는 것을 방지
  function softenNonLethalBattleLog(s) {
    let t = String(s || '');
    t = t.split('💀').join('⚔️');
    t = t.replace(/완전히\s*분쇄했습니다!?/g, '압도적으로 제압했습니다!');
    t = t.replace(/을\(를\)\s*쓰러뜨리고\s*승리했습니다!?/g, '을(를) 제압하고 승리했습니다!');
    t = t.replace(/처치했습니다!?/g, '제압했습니다!');
    t = t.replace(/격파했습니다!?/g, '제압했습니다!');
    return t;
  };


  const zoneGraph = useMemo(() => {
    const graph = {};
    const zoneIds = zones.map((z) => String(z.zoneId));
    zoneIds.forEach((id) => (graph[id] = new Set()));
    const conns = Array.isArray(activeMap?.zoneConnections) ? activeMap.zoneConnections : [];
    conns.forEach((c) => {
      const a = String(c?.fromZoneId || '');
      const b = String(c?.toZoneId || '');
      if (!a || !b) return;
      if (!graph[a]) graph[a] = new Set();
      if (!graph[b]) graph[b] = new Set();
      graph[a].add(b);
      if (c?.bidirectional !== false) graph[b].add(a);
    });
    // 동선이 하나도 없으면, "전체 순간이동"이 아니라 최소 연결(링)만 생성(관전형/존 기반 동선 고정)
    // - 데이터가 비어도 AI가 멈춰버리는 것을 방지하면서도, 인접 이동 감각은 유지합니다.
    const hasEdges = Object.values(graph).some((s) => (s?.size || 0) > 0);
    if (!hasEdges && zoneIds.length > 1) {
      // ✅ 링 대신 기본 동선 적용(하이퍼루프 맵 레이아웃)
      for (const [a, b] of (Array.isArray(LUMIA_DEFAULT_EDGES) ? LUMIA_DEFAULT_EDGES : [])) {
        if (!a || !b) continue;
        if (!graph[a] || !graph[b]) continue;
        graph[a].add(b);
        graph[b].add(a);
      }

      // 그래도 비어있으면 최후에만 링 fallback
      const hasEdgesAfter = Object.values(graph).some((s) => (s?.size || 0) > 0);
      if (!hasEdgesAfter) {
        for (let i = 0; i < zoneIds.length; i++) {
          const a2 = zoneIds[i];
          const b2 = zoneIds[(i + 1) % zoneIds.length];
          if (a2 && b2 && a2 !== b2) {
            graph[a2].add(b2);
            graph[b2].add(a2);
          }
        }
      }
    }
    // Set -> Array 변환
    const out = {};
    Object.keys(graph).forEach((k) => (out[k] = [...graph[k]]));
    return out;
  }, [activeMap, zones]);

  const canonicalizeCharName = (name) =>
    (name || '')
      .replace(/\s*[•·・]\s*/g, '·')
      .replace(/\s*-\s*/g, '·')
      .replace(/\s+/g, ' ')
      .trim();


  const normalizeForSkillKey = (name) => canonicalizeCharName(String(name || '')).replace(/\s+/g, '');
  function isShirokoTerror(c) {
    const n = normalizeForSkillKey(c?.name);
    return n.includes('시로코') && n.includes('테러');
  };
  function isShirokoBase(c) {
    const n = normalizeForSkillKey(c?.name);
    return n.includes('시로코') && !n.includes('테러');
  };
  function cloneForBattle(obj) {
    try {
      return structuredClone(obj);
    } catch {
      return JSON.parse(JSON.stringify(obj));
    }
  };

  // ✅ 전투 전용 스킬 세팅
  // - DB에 specialSkill이 없거나 기본값(평범함)인 캐릭도 전투에서 "의도한" 스킬만 쓰도록 정규화
  // - 기존 battleLogic.js는 name.includes 기반으로 항상 발동해 밸런스가 무너지는 문제가 있었고,
  //   현재는 specialSkill(=발동 롤 성공 여부)에 따라 스킬이 적용되도록 수정되어 있음.
  function prepareBattleSkills(c) {
    if (!c) return c;
    const raw = String(c?.specialSkill?.name || '').trim();
    const isDefault = !raw || raw === '평범함' || raw === '없음' || raw.toLowerCase() === 'none';

    // 시로코(기본) / 시로코 테러는 이름 기반으로 스킬을 부여
    if (isShirokoBase(c)) {
      c.specialSkill = { ...(c.specialSkill || {}), name: '드론 지원', type: 'combat' };
      return c;
    }
    if (isShirokoTerror(c)) {
      c.specialSkill = { ...(c.specialSkill || {}), name: '심연의 힘', type: 'combat' };
      return c;
    }

    // 그 외는 "평범함" 같은 기본값이면 스킬 없음으로 처리
    if (isDefault) {
      c.specialSkill = null;
      return c;
    }

    // 명시된 스킬은 타입이 없으면 combat으로 보정
    if (c.specialSkill && !c.specialSkill.type) c.specialSkill.type = 'combat';
    return c;
  };
  function applyIaidoOpener(attacker, defender, settings) {
    // 발도: 선제 타격으로 체력을 먼저 깎아 "스킬을 못 쓰고 죽는" 체감 완화
    const openDamage = Number(settings?.battle?.iaidoOpenDamage ?? 38);
    const defMax = Number(defender?.maxHp ?? 100);
    const defHp = Number(defender?.hp ?? defMax);
    defender.hp = Math.max(1, defHp - openDamage);
  };

  function seedRng(seedStr) {
    // 문자열 -> 32bit seed
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    // mulberry32
    let a = h >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };


  function applyRunSeed(seedStr) {
    const s = String(seedStr || '').trim() || '0';
    try { localStorage.setItem(SEED_STORAGE_KEY, s); } catch {}
    if (!randomBackupRef.current) randomBackupRef.current = Math.random;
    Math.random = seedRng(`RUN:${s}`);
  };

  function restoreRandom() {
    if (randomBackupRef.current) Math.random = randomBackupRef.current;
  };

  useEffect(() => {
    // ✅ 게임 시작 전(0일차)에만 시드를 적용해 랜덤 재현성을 확보합니다.
    if (!runSeed) return;
    if (isAdvancing || isGameOver) return;
    if (day !== 0 || matchSec !== 0) return;
    applyRunSeed(runSeed);
  }, [runSeed, day, matchSec, isAdvancing, isGameOver]);

  useEffect(() => () => restoreRandom(), []);

  // ✅ 금지구역 후보 셔플(누적 방식)
  // - day별로 따로 섞으면(시드가 달라지면) "어제 금지"가 오늘 풀리는 현상이 생길 수 있어,
  //   맵별로 1회만 셔플한 순서를 prefix로 잘라 "누적"되게 만듭니다.
  function getForbiddenOrderForMap(mapObj) {
    const z = Array.isArray(mapObj?.zones) && mapObj.zones.length ? mapObj.zones : zones;
    const zoneIds = z.map((x) => String(x.zoneId));
    // ✅ 초기 로드 타이밍(구역 목록이 비어있는 상태)에서 캐시가 굳어버리면
    //    이후에도 금지구역이 0으로 고정될 수 있어, 구역 시그니처를 키에 포함합니다.
    const zSig = zoneIds.length ? `${zoneIds.length}:${zoneIds[0]}:${zoneIds[zoneIds.length - 1]}` : '0';
    const orderKey = `${String(mapObj?._id || 'no-map')}:forbidden:order:${zSig}`;
    if (forbiddenCacheRef.current[orderKey]) return forbiddenCacheRef.current[orderKey];

    const base = new Set(z.filter((x) => x?.isForbidden).map((x) => String(x.zoneId)));

    const candidates = zoneIds.filter((id) => id && !base.has(id));
    const rng = seedRng(`FORB_ORDER:${String(mapObj?._id || '')}`);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    forbiddenCacheRef.current[orderKey] = candidates;
    return candidates;
  }

  function getForbiddenZoneIdsForDay(mapObj, dayNum) {
    const z = Array.isArray(mapObj?.zones) && mapObj.zones.length ? mapObj.zones : zones;
    const zoneIds = z.map((x) => String(x.zoneId));
    const zSig = zoneIds.length ? `${zoneIds.length}:${zoneIds[0]}:${zoneIds[zoneIds.length - 1]}` : '0';
    const key = `${String(mapObj?._id || 'no-map')}:${dayNum}:${zSig}`;
    if (forbiddenCacheRef.current[key]) return forbiddenCacheRef.current[key];

    const base = new Set(z.filter((x) => x?.isForbidden).map((x) => String(x.zoneId)));

    const cfg = mapObj?.forbiddenZoneConfig || {};
    // ✅ 금지구역은 기본 ON
    // - server Map 스키마에서 forbiddenZoneConfig.enabled 기본값이 false였던 레거시 때문에
    //   "항상 금지구역 0"으로 굳는 케이스가 있었음. 현재 룰셋에서는 설정으로만 OFF 허용.
    const enabled = (settings?.forbiddenZoneEnabled === false) ? false : true;

    // 요구사항: 2일차 밤 이후(=3일차 낮부터) "무작위 2곳"을 금지구역으로 고정
    // - 누적 확장 X, 항상 2곳(기본 isForbidden이 있으면 여기에 추가)
    const startDay = Number(cfg.startDay ?? cfg.startPhase ?? settings.forbiddenZoneStartDay ?? 3);
    const count = Math.max(1, Number(cfg.count ?? cfg.perDay ?? 2));

    if (enabled && dayNum >= startDay && zoneIds.length > 0) {
      const order = getForbiddenOrderForMap(mapObj);
      // 최소 1개의 안전구역은 남기기
      const maxAdd = Math.max(0, zoneIds.length - 1 - base.size);
      const extraCount = Math.min(count, Math.min(maxAdd, order.length));
      order.slice(0, extraCount).forEach((id) => base.add(id));
    }

    const arr = [...base];
    forbiddenCacheRef.current[key] = arr;
    return arr;
  }

  // ✅ 금지구역(확장 규칙)
  // - 요구사항: 2일차 밤부터 생성, 낮/밤(페이즈)마다 2곳씩 누적 확장
  // - 마지막(=안전구역이 2곳 남는 시점)에는 더 이상 확장하지 않고, 안전구역도 40s 유예 후 카운트가 깎이도록(아래 detonation 틱) 처리
  // - 맵의 zones[*].isForbidden은 항상 기본 금지구역으로 유지
  function getForbiddenZoneIdsForPhase(mapObj, dayNum, phaseKey, ruleset) {
    const effDay = Math.max(0, Number(dayNum || 0));
    const effPhase = (String(phaseKey || '') === 'night') ? 'night' : 'morning';

    const z = Array.isArray(mapObj?.zones) && mapObj.zones.length ? mapObj.zones : zones;
    const zoneIds = z.map((x) => String(x.zoneId));
    const zSig = zoneIds.length ? `${zoneIds.length}:${zoneIds[0]}:${zoneIds[zoneIds.length - 1]}` : '0';

    const key = `${String(mapObj?._id || 'no-map')}:${String(effDay)}:${String(effPhase)}:${zSig}`;
    if (forbiddenCacheRef.current[key]) return forbiddenCacheRef.current[key];

    const base = new Set(z.filter((x) => x?.isForbidden).map((x) => String(x.zoneId)));

    const cfg = mapObj?.forbiddenZoneConfig || {};
    // ✅ 금지구역은 기본 ON
    // - 레거시(enabled:false 기본값)로 금지구역이 비활성화되는 문제 방지
    const enabled = (settings?.forbiddenZoneEnabled === false) ? false : true;

    // 기본값: 2일차 밤부터 시작(요구사항)
    const startDay = Number(cfg.startDay ?? settings.forbiddenZoneStartDay ?? 2);
    const startPhase = String(cfg.startPhase ?? cfg.startTimeOfDay ?? settings.forbiddenZoneStartPhase ?? 'night');
    const addPerPhase = Math.max(1, Number(cfg.addPerPhase ?? cfg.perPhaseAdd ?? 2));

    const phaseIdx = effDay * 2 + (effPhase === 'night' ? 1 : 0);
    const startIdx = Math.max(0, Number(startDay || 0)) * 2 + (String(startPhase) === 'night' ? 1 : 0);

    // ✅ 강제 금지: 연구소(lab)는 4일차 밤(Night 4)부터 금지구역으로 고정
    // (ER 표준 스케줄: Research Center는 Night 4부터 제한구역)
    const labForceIdx = 4 * 2 + 1; // 4일차 밤
    if (zoneIds.includes('lab') && phaseIdx >= labForceIdx) base.add('lab');

    if (enabled && phaseIdx >= startIdx && zoneIds.length > 0) {
      const steps = phaseIdx - startIdx + 1;
      const want = steps * addPerPhase;
      const order = getForbiddenOrderForMap(mapObj);

      // ✅ 마지막엔 안전구역 2곳 남기기(가능하면)
      const safeRemain = Math.max(1, Math.floor(Number(cfg.safeRemain ?? 2)));
      const maxAdd = Math.max(0, zoneIds.length - safeRemain - base.size);
      const extraCount = Math.min(want, Math.min(maxAdd, order.length));
      order.slice(0, extraCount).forEach((id) => base.add(id));
    }

    const arr = [...base];
    forbiddenCacheRef.current[key] = arr;
    return arr;
  }



  // ✅ 이번 페이즈에 '실제로 새로 추가된' 금지구역 zoneId만 반환
  // - 금지구역 전체 목록(diff)으로 계산하면 캐시/로드 타이밍에 NEW가 흔들릴 수 있어,
  //   누적 셔플(prefix) 규칙 기반으로 '이번 단계에서 추가되는 slice(2개)'만 고정합니다.
  function getForbiddenAddedZoneIdsForPhase(mapObj, dayNum, phaseKey, ruleset) {
    const effDay = Math.max(0, Number(dayNum || 0));
    const effPhase = (String(phaseKey || '') === 'night') ? 'night' : 'morning';

    const z = (Array.isArray(mapObj?.zones) && mapObj.zones.length) ? mapObj.zones : zones;
    const zoneIds = z.map((x) => String(x.zoneId));
    if (!zoneIds.length) return [];

    const cfg = mapObj?.forbiddenZoneConfig || {};
    // ✅ 금지구역은 기본 ON(설정으로만 OFF)
    const enabled = (settings?.forbiddenZoneEnabled === false) ? false : true;
    if (!enabled) return [];

    const startDay = Number(cfg.startDay ?? settings.forbiddenZoneStartDay ?? 2);
    const startPhase = String(cfg.startPhase ?? cfg.startTimeOfDay ?? settings.forbiddenZoneStartPhase ?? 'night');
    const addPerPhase = Math.max(1, Number(cfg.addPerPhase ?? cfg.perPhaseAdd ?? 2));

    const phaseIdx = effDay * 2 + (effPhase === 'night' ? 1 : 0);
    const startIdx = Math.max(0, Number(startDay || 0)) * 2 + (String(startPhase) === 'night' ? 1 : 0);
    if (phaseIdx < startIdx) return [];

    // 기본 금지구역(isForbidden)은 '신규 추가' 대상에서 제외
    // + 강제 금지(연구소): 4일차 밤부터 금지구역으로 고정
    const labForceIdx = 4 * 2 + 1; // 4일차 밤
    const baseSet = new Set(z.filter((x) => x?.isForbidden).map((x) => String(x.zoneId)));
    const labForcedNow = zoneIds.includes('lab') && phaseIdx >= labForceIdx;
    if (labForcedNow) baseSet.add('lab');
    const baseCount = baseSet.size;
    const safeRemain = Math.max(1, Math.floor(Number(cfg.safeRemain ?? 2)));
    const maxAdd = Math.max(0, zoneIds.length - safeRemain - baseCount);

    const order = getForbiddenOrderForMap(mapObj);
    const steps = phaseIdx - startIdx + 1;

    const cap = Math.min(maxAdd, order.length);
    const extraCur = Math.min(steps * addPerPhase, cap);
    const extraPrev = Math.min(Math.max(0, (steps - 1) * addPerPhase), cap);

    let added = order.slice(extraPrev, extraCur).filter(Boolean);

    // ✅ 연구소(lab)는 4일차 밤에 강제로 금지구역이 되므로, 그 순간에는 '이번 페이즈 신규'에 포함
    if (zoneIds.includes('lab') && phaseIdx === labForceIdx) {
      added = ['lab', ...added.filter((x) => String(x) !== 'lab')];
    }
    return added;
  };
  const itemNameById = useMemo(() => {
    const m = {};
    (Array.isArray(publicItems) ? publicItems : []).forEach((it) => {
      if (it?._id) m[String(it._id)] = it.name;
    });
    return m;
  }, [publicItems]);

  const itemMetaById = useMemo(() => {
    const m = {};
    (Array.isArray(publicItems) ? publicItems : []).forEach((it) => {
      if (!it?._id) return;
      m[String(it._id)] = {
        name: String(it?.name || it?.text || ''),
        type: it?.type,
        tier: clampTier4(it?.tier || 1),
        tags: safeTags(it),
        spawnZones: Array.isArray(it?.spawnZones) ? it.spawnZones : [],
        spawnCrateTypes: Array.isArray(it?.spawnCrateTypes) ? it.spawnCrateTypes : [],
        droneCreditsCost: Math.max(0, Number(it?.droneCreditsCost || 0)),
      };
    });
    return m;
  }, [publicItems]);

  const itemKeyById = useMemo(() => {
    const m = {};
    (Array.isArray(publicItems) ? publicItems : []).forEach((it) => {
      if (!it?._id) return;
      const k = String(it?.itemKey || it?.externalId || '').trim();
      if (k) m[String(it._id)] = k;
    });
    return m;
  }, [publicItems]);

  const craftables = useMemo(() => {
    return (Array.isArray(publicItems) ? publicItems : [])
      .filter((it) => Array.isArray(it?.recipe?.ingredients) && it.recipe.ingredients.length > 0)
      .sort((a, b) => (Number(a.tier || 1) - Number(b.tier || 1)) || String(a.name).localeCompare(String(b.name)));
  }, [publicItems]);

  const inventoryOptions = useMemo(() => {
    const inv = Array.isArray(selectedChar?.inventory) ? selectedChar.inventory : [];
    const map = new Map();
    inv.forEach((x) => {
      const id = x?.itemId ? String(x.itemId) : '';
      const name = itemDisplayName(x);
      if (!id) return;
      const prev = map.get(id);
      const qty = Math.max(1, Number(x.qty || 1));
      if (!prev) map.set(id, { itemId: id, name, qty });
      else map.set(id, { ...prev, qty: prev.qty + qty });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedChar]);

  function getQty(key, fallback = 1) {
    const v = Number(qtyMap[key]);
    if (!Number.isFinite(v) || v <= 0) return fallback;
    return Math.floor(v);
  };

  function setQty(key, v) {
    setQtyMap((prev) => ({ ...prev, [key]: v }));
  };

  function patchInventoryOnly(serverCharacter) {
    if (!serverCharacter?._id) return;
    setSurvivors((prev) => (Array.isArray(prev) ? prev : []).map((s) => (
      String(s?._id) === String(serverCharacter?._id)
        ? normalizeRuntimeSurvivor({
            ...s,
            inventory: serverCharacter?.inventory ?? s?.inventory,
            equipped: serverCharacter?.equipped ?? s?.equipped,
          })
        : normalizeRuntimeSurvivor(s)
    )));
  };

  async function syncMyState() {
    try {
      const [me, chars] = await Promise.all([apiGet('/user/me'), apiGet('/characters')]);
      applyUserEconomyProgress({
        credits: me?.credits,
        lp: me?.lp,
        perks: Array.isArray(me?.perks) ? me.perks : undefined,
      });
      const list = Array.isArray(chars) ? chars : [];
      setSurvivors((prev) => (Array.isArray(prev) ? prev : []).map((s) => {
        const found = list.find((c) => String(c?._id) === String(s?._id));
        return found
          ? normalizeRuntimeSurvivor({
              ...s,
              inventory: found?.inventory ?? s?.inventory,
              equipped: found?.equipped ?? s?.equipped,
            })
          : normalizeRuntimeSurvivor(s);
      }));
    } catch (e) {
      // 동기화 실패는 치명적이지 않음
      console.error(e);
    }
  };

  function applyUserEconomyProgress(patch = {}) {
    const hasCredits = Number.isFinite(Number(patch?.credits));
    const hasLp = Number.isFinite(Number(patch?.lp));
    const hasPerks = Array.isArray(patch?.perks);

    if (hasCredits) setCredits(Math.max(0, Number(patch.credits || 0)));
    if (hasLp) setViewerLp(Math.max(0, Number(patch.lp || 0)));
    if (hasPerks) setViewerPerks((patch.perks || []).map((x) => String(x || '')).filter(Boolean));

    updateStoredUser((currentUser) => ({
      ...(currentUser || {}),
      ...(hasCredits ? { credits: Math.max(0, Number(patch.credits || 0)) } : {}),
      ...(hasLp ? { lp: Math.max(0, Number(patch.lp || 0)) } : {}),
      ...(hasPerks ? { perks: (patch.perks || []).map((x) => String(x || '')).filter(Boolean) } : {}),
    }));
  }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncViewerProgress = () => {
      const u = getUser();
      setViewerLp(Math.max(0, Number(u?.lp || 0)));
      setViewerPerks(Array.isArray(u?.perks) ? u.perks.map((x) => String(x || '')).filter(Boolean) : []);
      if (Number.isFinite(Number(u?.credits))) setCredits(Math.max(0, Number(u.credits || 0)));
    };
    syncViewerProgress();
    window.addEventListener(AUTH_SYNC_EVENT, syncViewerProgress);
    return () => window.removeEventListener(AUTH_SYNC_EVENT, syncViewerProgress);
  }, []);

  const ownedPerkCodeSet = useMemo(() => new Set((Array.isArray(viewerPerks) ? viewerPerks : []).map((x) => String(x || ''))), [viewerPerks]);
  const activeViewerPerkBundle = useMemo(() => buildPerkRuntimeBundle(viewerPerks, publicPerks), [viewerPerks, publicPerks]);

  useEffect(() => {
    if (!Array.isArray(survivors) || survivors.length <= 0) return;
    setSurvivors((prev) => normalizeRuntimeSurvivorList((Array.isArray(prev) ? prev : []).map((s) => applyPerkBundleToActor({ ...s }, activeViewerPerkBundle, { applyCredits: true }))));
    setDead((prev) => normalizeRuntimeSurvivorList((Array.isArray(prev) ? prev : []).map((s) => applyPerkBundleToActor({ ...s }, activeViewerPerkBundle, { applyCredits: false }))));
  }, [activeViewerPerkBundle]);

  function getApiErrorMessage(err, fallback = '요청 실패') {
    return String(err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback);
  };

  function getSettledValue(result, fallback = null) {
    if (result?.status !== 'fulfilled') return fallback;
    return result.value ?? fallback;
  };

  function getSettledArray(result) {
    const value = getSettledValue(result, []);
    return Array.isArray(value) ? value : [];
  };

  function getRejectedLabels(pairs) {
    return pairs
      .filter(([, result]) => result?.status === 'rejected')
      .map(([label]) => label);
  };

  async function loadMarket() {
    try {
      setMarketMessage('');
      const [itemsRes, kiosksRes, droneRes, perksRes] = await Promise.allSettled([
        apiGet('/public/items'),
        apiGet('/public/kiosks'),
        apiGet('/public/drone-offers'),
        apiGet('/public/perks'),
      ]);

      setPublicItems(getSettledArray(itemsRes));
      setKiosks(getSettledArray(kiosksRes));
      setDroneOffers(getSettledArray(droneRes));
      setPublicPerks(getSettledArray(perksRes));

      const failed = getRejectedLabels([
        ['아이템', itemsRes],
        ['키오스크', kiosksRes],
        ['드론 판매', droneRes],
        ['특전', perksRes],
      ]);
      if (failed.length) {
        setMarketMessage(`${failed.join(', ')} 로드 실패`);
      }
    } catch (e) {
      setMarketMessage(getApiErrorMessage(e));
    }
  };

  async function loadTrades() {
    try {
      setMarketMessage('');
      const [open, mine] = await Promise.allSettled([
        apiGet('/trades'),
        apiGet('/trades?mine=true'),
      ]);
      setTradeOffers(getSettledArray(open));
      setMyTradeOffers(getSettledArray(mine));

      const failed = getRejectedLabels([
        ['오픈 오퍼', open],
        ['내 오퍼', mine],
      ]);
      if (failed.length) {
        setMarketMessage(`${failed.join(', ')} 로드 실패`);
      }
    } catch (e) {
      setMarketMessage(getApiErrorMessage(e));
    }
  };

  function redirectToLogin(message = '로그인이 필요한 기능입니다. 로그인 페이지로 이동합니다.', shouldClearAuth = false) {
    if (typeof window === 'undefined') return;
    if (shouldClearAuth) clearAuth();
    alert(message);
    window.location.replace('/login');
  };

  function formatInitLoadError(err) {
    const status = Number(err?.response?.status || 0);
    const requestUrl = String(err?.requestUrl || '');
    const path = requestUrl ? requestUrl.replace(/^https?:\/\/[^/]+/i, '') : '';
    const label = path ? ` (${path})` : '';
    const msg = String(err?.message || err?.originalMessage || '').trim();

    if (err?.code === 'ERR_NETWORK' || /network error/i.test(msg)) {
      return `⚠️ 서버에 연결하지 못했습니다${label}. server 실행 상태와 API 주소를 확인해주세요.`;
    }
    if (status === 404) {
      return `⚠️ 필요한 API를 찾지 못했습니다${label}. API_BASE 또는 서버 라우트를 확인해주세요.`;
    }
    if (status >= 500) {
      return `⚠️ 서버 내부 오류로 초기 데이터를 불러오지 못했습니다${label}. 서버 로그를 확인해주세요.`;
    }
    if (status > 0) {
      return `⚠️ 초기 데이터 로드에 실패했습니다${label}. (${status}) ${msg || '요청 실패'}`;
    }
    return `⚠️ 초기 데이터 로드에 실패했습니다. ${msg || '알 수 없는 오류'}`;
  };

  // 초기 데이터 로드 (캐릭터 + 이벤트 + 설정 + 상점 데이터)
  useEffect(() => {
    const token = getToken();
    const me = getUser();
    if (!token || !me?.username) {
      redirectToLogin('로그인 정보가 없거나 만료되었습니다. 다시 로그인해주세요.', true);
      return;
    }

    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const fetchData = async () => {
      try {
        await apiGet('/public/ping', { timeoutMs: INIT_API_TIMEOUT_MS });

        const [charList, settingValue, meValue, mapsList] = await Promise.all([
          apiGet('/characters', { timeoutMs: INIT_API_TIMEOUT_MS }),
          apiGet('/settings', { timeoutMs: INIT_API_TIMEOUT_MS }),
          apiGet('/user/me', { timeoutMs: INIT_API_TIMEOUT_MS }),
          apiGet('/public/maps', { timeoutMs: INIT_API_TIMEOUT_MS }),
        ]);

        const [eventRes, itemsRes, kiosksRes, droneRes, perksRes, openTrades, mineTrades] = await Promise.allSettled([
          apiGet('/events', { timeoutMs: 20000 }),
          apiGet('/public/items', { timeoutMs: 20000 }),
          apiGet('/public/kiosks', { timeoutMs: 20000 }),
          apiGet('/public/drone-offers', { timeoutMs: 20000 }),
          apiGet('/public/perks', { timeoutMs: 20000 }),
          apiGet('/trades', { timeoutMs: 20000 }),
          apiGet('/trades?mine=true', { timeoutMs: 20000 }),
        ]);

        const eventsList = getSettledArray(eventRes);
        const itemsList = getSettledArray(itemsRes);
        const kiosksList = getSettledArray(kiosksRes);
        const droneList = getSettledArray(droneRes);
        const perksList = getSettledArray(perksRes);
        const openTradesList = getSettledArray(openTrades);
        const myTradesList = getSettledArray(mineTrades);

        if (settingValue) setSettings(settingValue);
        setPublicPerks(perksList);
        applyUserEconomyProgress({
          credits: meValue?.credits,
          lp: meValue?.lp,
          perks: Array.isArray(meValue?.perks) ? meValue.perks : undefined,
        });

        mapsRef.current = mapsList;
        setMaps(mapsList);
// ✅ 시뮬레이션은 "플레이어가 맵을 선택"하지 않습니다.
// 등록된 맵 중 첫 번째 맵을 시작점으로 사용합니다. (이동/진행 로직은 런타임에서 처리)
const initialMapId = (mapsList[0]?._id ? String(mapsList[0]._id) : '');
if (initialMapId) {
  activeMapIdRef.current = initialMapId;
  setActiveMapId(initialMapId);
}

        const initialMap = mapsList.find((m) => String(m?._id) === String(initialMapId)) || null;
        activeMapRef.current = initialMap;
        const initialZoneIds = (Array.isArray(initialMap?.zones) && initialMap.zones.length)
          ? initialMap.zones.map((z) => String(z.zoneId))
          : ['__default__'];

        // 🎮 룰 프리셋에 따라 생존자 런타임 상태를 초기화
        const ruleset = getRuleset(settingValue?.rulesetId);
        const det = ruleset?.detonation;
        const energy = ruleset?.gadgetEnergy;

// 🎒 추천 상급 장비(또는 역할)에 맞춰 시작 구역을 가중치 랜덤으로 선택
const pickStartZoneIdForChar = (c) => {
  const zonesArr = Array.isArray(initialMap?.zones) ? initialMap.zones : [];
  const fallback = () => initialZoneIds[Math.floor(Math.random() * initialZoneIds.length)];
  if (!zonesArr.length) return fallback();

  const texts = [];
  function addText(v) {
    if (v === null || v === undefined) return;
    const s = String(v).trim();
    if (s) texts.push(s.toLowerCase());
  };

  function addFromList(arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach((g) => {
      if (!g) return;
      if (typeof g === 'string') return addText(g);
      addText(g.name);
      addText(g.kind);
      addText(g.category);
      addText(g.type);
      if (Array.isArray(g.tags)) g.tags.forEach(addText);
    });
  };

  addFromList(c?.recommendedHighGear);
  addFromList(c?.recommendedAdvancedGear);
  addFromList(c?.recommendedGear);
  addFromList(c?.advancedGear);

  // 스탯 기반 힌트(데이터가 없을 때)
  const st = c?.stats || c?.stat || c;
  const keys = ['str', 'agi', 'int', 'men', 'luk', 'dex', 'sht', 'end'];
  const top = keys
    .map((k) => [k, Number(st?.[k] ?? st?.[k.toUpperCase()] ?? 0)])
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top) addText(top);

  // gear/stat 힌트를 zone name/tags에 매칭하기 위한 간단 사전
  const keywordMap = {
    keyboard: ['keyboard', '키보드', '키보'],
    mouse: ['mouse', '마우스'],
    monitor: ['monitor', '모니터'],
    weapon: ['weapon', '무기', 'armory', '병기'],
    armor: ['armor', '방어구', '갑옷'],
    food: ['food', '음식', '식당', '편의'],
    sht: ['shoot', '사격', '원거리', '총', 'gun'],
    str: ['melee', '근접', '격투'],
    int: ['lab', '연구', '전산', '컴퓨터'],
    dex: ['craft', '제작', '공작'],
  };

  const expanded = new Set();
  texts.forEach((t) => {
    expanded.add(t);
    Object.entries(keywordMap).forEach(([k, syns]) => {
      const hit = t.includes(k) || syns.some((s) => t.includes(String(s).toLowerCase()));
      if (hit) syns.forEach((s) => expanded.add(String(s).toLowerCase()));
    });
  });

  const hints = [...expanded].filter(Boolean);
  if (!hints.length) return fallback();

  const candidates = zonesArr
    .filter((z) => {
      const name = String(z?.name || '').toLowerCase();
      const tags = Array.isArray(z?.tags) ? z.tags.map((x) => String(x).toLowerCase()) : [];
      return hints.some((h) => name.includes(h) || tags.includes(h));
    })
    .map((z) => String(z.zoneId));

  const pool = candidates.length ? candidates : initialZoneIds;
  return pool[Math.floor(Math.random() * pool.length)];
};
// 로컬 명예의 전당(내 기록) 백업 저장: 서버 저장/조회가 꼬여도 최소한 로컬엔 남게 함
const saveLocalHof = (winner, killCountsObj, assistCountsObj, participantsList) => {
  try {
    const me = getUser();
    const username = me?.username || me?.id || 'guest';
    const idToName = {};
    (participantsList || []).forEach((p) => {
      const id = String(p?._id || p?.id || '');
      if (!id) return;
      idToName[id] = p?.name || p?.nickname || p?.charName || p?.title || id;
    });

    writeHallOfFameState({ username }, (current) => {
      const state = { ...(current || {}), chars: { ...(current?.chars || {}) } };
      Object.entries(killCountsObj || {}).forEach(([pid, k]) => {
        const sid = String(pid || '');
        if (!sid) return;
        const amount = Math.max(0, Number(k || 0) || 0);
        if (!amount) return;
        const entry = state.chars[sid] || { name: idToName[sid] || sid, wins: 0, kills: 0, assists: 0 };
        entry.name = idToName[sid] || entry.name;
        entry.kills = Number(entry.kills || 0) + amount;
        state.chars[sid] = entry;
      });
      Object.entries(assistCountsObj || {}).forEach(([pid, a]) => {
        const sid = String(pid || '');
        if (!sid) return;
        const amount = Math.max(0, Number(a || 0) || 0);
        if (!amount) return;
        const entry = state.chars[sid] || { name: idToName[sid] || sid, wins: 0, kills: 0, assists: 0 };
        entry.name = idToName[sid] || entry.name;
        entry.assists = Number(entry.assists || 0) + amount;
        state.chars[sid] = entry;
      });
      if (winner) {
        const wid = String(winner?._id || winner?.id || '');
        if (wid) {
          const entry = state.chars[wid] || { name: idToName[wid] || winner?.name || wid, wins: 0, kills: 0, assists: 0 };
          entry.name = idToName[wid] || entry.name;
          entry.wins = Number(entry.wins || 0) + 1;
          state.chars[wid] = entry;
        }
      }
      return state;
    }, { winnerId: String(winner?._id || winner?.id || '') });
  } catch (e) {
    console.error('local hof save failed', e);
  }
};

        const initPerkBundle = buildPerkRuntimeBundle(Array.isArray(meValue?.perks) ? meValue.perks : [], perksList);

        const charsWithHp = charList.map((c) => applyPerkBundleToActor(normalizeRuntimeSurvivor({
          ...c,
          // 전술 스킬 레벨(런 단위): 매 런 시작 시 Lv.1로 초기화
          tacticalSkillLevel: 1,
          hp: 100,
          maxHp: 100,
          zoneId: pickStartZoneIdForChar(c),
          equipped: ensureEquipped(c),

          // 1일차 "최소 1회 이동" 목표 추적용
          day1Moves: 0,
          day1HeroDone: false,

          simCredits: Number(ruleset?.credits?.start ?? 15),
          droneLastOrderIndex: -9999,
          droneLastOrderAbsSec: -99999,
          kioskLastInteractAbsSec: -99999,
          // 하이브리드(시즌10) 전용 상태
          detonationSec: det ? det.startSec : null,
          detonationMaxSec: det ? det.maxSec : null,
          gadgetEnergy: energy ? energy.start : 0,
          cooldowns: {
            portableSafeZone: 0,
            cnotGate: 0,
          },
          safeZoneUntil: 0,
        }), initPerkBundle, { initialFill: true, applyCredits: true }));
        const shuffledChars = charsWithHp.sort(() => Math.random() - 0.5).map((c) => normalizeRuntimeSurvivor(c));
        setSurvivors(shuffledChars);
        setEvents(eventsList);

        // 킬 카운트 초기화
        const initialKills = {};
        charList.forEach((c) => {
          initialKills[c._id] = 0;
        });
        setKillCounts(initialKills);

        // 어시스트 카운트 초기화
        const initialAssists = {};
        charList.forEach((c) => {
          initialAssists[c._id] = 0;
        });
        setAssistCounts(initialAssists);

        const initialCredits = Number(meValue?.credits || 0);
        setCredits(initialCredits);
        updateStoredUser((currentUser) => ({ ...currentUser, credits: initialCredits }));
        setPublicItems(itemsList);
        setKiosks(kiosksList);
        setDroneOffers(droneList);
        setTradeOffers(openTradesList);
        setMyTradeOffers(myTradesList);

        // 경기 시간도 초기화
        setMatchSec(0);
        setPrevPhaseLogs([]);
        setIsGameOver(false);
        setWinner(null);
        setGameEndReason(null);
        setResultSummary(null);
        setShowResultModal(false);

        addLog('📢 선수들이 경기장에 입장했습니다. 잠시 후 게임이 시작됩니다.', 'system');
      } catch (err) {
        console.error('데이터 로드 실패:', err);
        const status = Number(err?.response?.status || 0);
        if (status === 401 || status === 403) {
          redirectToLogin('세션이 만료되었습니다. 다시 로그인해주세요.', true);
          return;
        }
        addLog(formatInitLoadError(err), 'death');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 최신 킬 정보 전달
  async function finishGame(finalSurvivors, latestKillCounts, latestAssistCounts) {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;
    // 게임 종료 시 오토 플레이는 자동으로 해제
    setAutoPlay(false);
    const w = finalSurvivors[0];
    const finalKills = latestKillCounts || killCounts;
    const finalAssists = latestAssistCounts || assistCounts;
    const participants = [
      ...(Array.isArray(finalSurvivors) ? finalSurvivors : []),
      ...(Array.isArray(dead) ? dead : []),
    ];

    const wId = w ? (w._id || w.id) : null;
    const myKills = wId ? Number(finalKills[wId] || 0) : 0;
    const myAssists = wId ? Number(finalAssists[wId] || 0) : 0;
    const rewardLP = w ? (100 + myKills * 10) : 0;
    const topKillLeader = [...participants]
      .sort((a, b) => ((Number(finalKills?.[b?._id] || 0) - Number(finalKills?.[a?._id] || 0)) || (Number(finalAssists?.[b?._id] || 0) - Number(finalAssists?.[a?._id] || 0))))[0] || null;

    setWinner(w);
    setIsGameOver(true);
    setShowResultModal(true);
    setResultSummary({
      rewardLP,
      myKills,
      myAssists,
      participantsCount: participants.length,
      saveStatus: { hallOfFame: w ? 'pending' : 'skipped', userStats: 'pending' },
      userProgress: null,
      topKillLeader: topKillLeader
        ? {
            id: topKillLeader._id,
            name: topKillLeader.name,
            kills: Number(finalKills?.[topKillLeader._id] || 0),
            assists: Number(finalAssists?.[topKillLeader._id] || 0),
          }
        : null,
    });

    if (w) addLog(`🏆 게임 종료! 최후의 생존자: [${w.name}]`, 'highlight');
    else addLog('💀 생존자가 아무도 없습니다...', 'death');


    // (3) 로컬 백업(캐릭터별: 내 명예의 전당)
    try {
      const me = getUser();
      const username = me?.username || me?.id || 'guest';
      saveLocalHof(w, finalKills, finalAssists, participants);

      // legacy(플레이어 단위) 기록을 1회만 캐릭터로 이관
      if (w) {
        writeHallOfFameState({ username }, (current) => {
          const state = { ...(current || {}), chars: { ...(current?.chars || {}) } };
          if (state._migratedFromPlayerV1) return state;
          try {
            const legacyRaw = localStorage.getItem(LEGACY_HOF_KEY);
            const legacy = legacyRaw ? JSON.parse(legacyRaw) : null;
            const legacyWins = Number(legacy?.wins?.[username] || 0);
            const legacyKills = Number(legacy?.kills?.[username] || 0);
            if (legacyWins > 0 || legacyKills > 0) {
              const wid = String(w?._id ?? w?.id ?? '');
              if (wid) {
                const entry = state.chars[wid] || { name: w?.name || wid, wins: 0, kills: 0, assists: 0 };
                entry.wins = Number(entry.wins || 0) + legacyWins;
                entry.kills = Number(entry.kills || 0) + legacyKills;
                state.chars[wid] = entry;
              }
            }
          } catch {}
          state._migratedFromPlayerV1 = true;
          return state;
        }, { migratedLegacy: true });
      }

      if (w) {
        const raw = localStorage.getItem(LEGACY_HOF_KEY);
        const data = raw ? JSON.parse(raw) : { wins: {}, kills: {} };
        if (!data.wins) data.wins = {};
        if (!data.kills) data.kills = {};
        const wKey = String(w?._id ?? w?.id ?? '');
        const kills = Number(finalKills?.[wKey] || 0);
        data.wins[username] = Number(data.wins[username] || 0) + 1;
        data.kills[username] = Number(data.kills[username] || 0) + kills;
        localStorage.setItem(LEGACY_HOF_KEY, JSON.stringify(data));
      }
      emitHallOfFameSync({ username }, { reason: 'finishGame' });
    } catch (e) {
      console.error('hall of fame sync failed', e);
    }

    // 서버 저장
    try {
      if (w) {
        await apiPost('/game/end', {
          winnerId: wId,
          killCounts: finalKills,
          fullLogs: (Array.isArray(fullLogsRef.current) ? fullLogsRef.current : []).slice(),
          participants,
        });
        addLog('✅ 명예의 전당 저장 완료', 'system');
        setResultSummary((prev) => ({
          ...(prev || {}),
          saveStatus: { ...(prev?.saveStatus || {}), hallOfFame: 'success' },
        }));
      }
    } catch (e) {
      console.error(e);
      addLog('⚠️ 명예의 전당 저장 실패', 'death');
      setResultSummary((prev) => ({
        ...(prev || {}),
        saveStatus: { ...(prev?.saveStatus || {}), hallOfFame: 'error' },
      }));
    }

    try {
      const res = await apiPost('/user/update-stats', {
        kills: myKills,
        isWin: Boolean(w),
        lpEarned: rewardLP,
      });

      if (typeof res?.credits === 'number') setCredits(res.credits);

      if (res?.user && typeof res.user === 'object') {
        updateStoredUser((currentUser) => mergeStoredUserProgress(currentUser, res.user));
      } else if (typeof res?.newLp === 'number' || typeof res?.credits === 'number' || res?.statistics) {
        updateStoredUser((currentUser) => mergeStoredUserProgress(currentUser, {
          lp: typeof res?.newLp === 'number' ? res.newLp : currentUser?.lp,
          credits: typeof res?.credits === 'number' ? res.credits : currentUser?.credits,
          statistics: res?.statistics || currentUser?.statistics,
        }));
      }

      setResultSummary((prev) => ({
        ...(prev || {}),
        rewardLP: typeof res?.lpEarnedApplied === 'number' ? res.lpEarnedApplied : (prev?.rewardLP ?? rewardLP),
        userProgress: {
          lp: typeof res?.newLp === 'number' ? res.newLp : Number(res?.user?.lp || 0),
          credits: typeof res?.credits === 'number' ? res.credits : Number(res?.user?.credits || 0),
          statistics: normalizeUserStatistics(res?.statistics || res?.user?.statistics),
        },
        saveStatus: { ...(prev?.saveStatus || {}), userStats: 'success' },
      }));

      addLog(
        `💾 [전적 저장 완료] ${Boolean(w) ? `LP +${typeof res?.lpEarnedApplied === 'number' ? res.lpEarnedApplied : rewardLP} 획득! ` : ''}(현재 총 LP: ${res?.newLp ?? res?.user?.lp ?? '?'})`,
        'system'
      );
    } catch (e) {
      addLog(`⚠️ 전적 저장 실패: ${e?.response?.data?.error || '서버 오류'}`, 'death');
      setResultSummary((prev) => ({
        ...(prev || {}),
        saveStatus: { ...(prev?.saveStatus || {}), userStats: 'error' },
      }));
    }
  };

  // --- [핵심] 진행 로직 ---
  async function proceedPhase() {
    // ✅ 다음 페이즈로 넘어갈 때, 이전/현재 페이즈 UI 로그는 초기화
    setPrevPhaseLogs([]);
    setShowPrevLogs(false);
    setLogs(() => []);
    logSeqRef.current = 0;
    setLogBoxMaxH(180);

    // 1. 페이즈 및 날짜 변경
    let nextPhase = phase === 'morning' ? 'night' : 'morning';
    let nextDay = day;
    if (phase === 'night') nextDay++;

    // 🎮 룰 프리셋 (기본: ER_S10)
    const ruleset = getRuleset(settings?.rulesetId);

    // 서든데스(6번째 밤 이후): 페이즈 고정 + 전 지역 금지 + 카운트다운
    const sdCfg = ruleset?.suddenDeath || {};
    const sdTotalSec = Math.max(10, Number(sdCfg.totalSec ?? sdCfg.durationSec ?? 180));
    const shouldLockSuddenDeath = suddenDeathActiveRef.current || (day === 6 && phase === 'night');
    if (shouldLockSuddenDeath) {
      // 최초 발동: 6번째 밤 이후 진행을 시도할 때
      if (!suddenDeathActiveRef.current) {
        suddenDeathActiveRef.current = true;
        if (typeof suddenDeathEndAtSecRef.current !== 'number') suddenDeathEndAtSecRef.current = matchSec + sdTotalSec;
        addLog(`=== 서든데스 발동: 최종 안전구역 2곳 제외 전지역 금지 + 카운트다운 ${sdTotalSec}s ===`, 'day-header');
      }
      // 페이즈는 최대 6일차 밤에서 고정
      nextDay = 6;
      nextPhase = 'night';
    }
    // 🚫 금지구역 처리 방식: detonation(폭발 타이머) 설정이 있으면 타이머를 사용
    const useDetonation = !!ruleset?.detonation;
    const marketRules = ruleset?.market || {};
    // ⚔️ 전투 세팅: ruleset 기반 상수(장비 보정 등)를 합쳐서 전달
    const battleSettings = { ...settings, battle: { ...(settings?.battle || {}), equipment: ruleset?.equipment || {} } };
    const phaseDurationSec = getPhaseDurationSec(ruleset, nextDay, nextPhase);
    const phaseStartSec = matchSec;
    const fogLocalSec = getFogLocalTimeSec(ruleset, nextDay, nextPhase, phaseDurationSec);

    // 🔥 서든데스: 6번째 밤부터는 “마지막 1인 생존”까지 교전이 더 자주 발생하도록 가속합니다.
    // - (기존) 6번째 밤 강제 종료는 제거
    if (!suddenDeathActiveRef.current && nextDay === 6 && nextPhase === 'night') {
      addLog('=== 🔥 서든데스: 6번째 밤 돌입 (교전 빈도 증가) ===', 'day-header');
    }

    // 💰 이번 페이즈 기본 크레딧(시즌10 컨셉)
    const baseCredits = Number(ruleset?.credits?.basePerPhase || 0);

    let earnedCredits = baseCredits;

    setDay(nextDay);
    setPhase(nextPhase);
    setTimeOfDay(getTimeOfDayFromPhase(nextPhase));
    addLog(`=== ${worldTimeText(nextDay, nextPhase)} (⏱ ${phaseDurationSec}s) ===`, 'day-header');

    // 서든데스 카운트다운 표시
    if (suddenDeathActiveRef.current && typeof suddenDeathEndAtSecRef.current === 'number') {
      const remain = Math.max(0, Math.ceil(suddenDeathEndAtSecRef.current - matchSec));
      addLog(`서든데스 카운트다운: ${remain}s`, 'system');
    }

    // 현재 페이즈 인덱스(배송/딜레이 처리용)
    const phaseIdxNow = worldPhaseIndex(nextDay, nextPhase);

    // 🧬 부활 컷오프: 2일차 밤(포함)까지의 사망자는 1회 부활 가능
    const reviveCutoffIdx = worldPhaseIndex(2, 'night');
    let revivedNow = [];

    // 🎁 초월 선택 상자(개발자 도구): 한 페이즈에 1개만 선택 대기(나머지는 자동 선택)
    let pendingPickAssigned = false;

    // 2. 맵 내부 구역 이동 + 금지구역(구역 기반) 데미지
    const mapIdNow = String(activeMapIdRef.current || activeMapId || '');
    const mapObjRaw = activeMapRef.current || activeMap;
    const mapObj = mapObjRaw || ((Array.isArray(zones) && zones.length)
      ? { _id: mapIdNow || 'local', zones }
      : null);
    let forbiddenIds = mapObj ? new Set(getForbiddenZoneIdsForPhase(mapObj, nextDay, nextPhase, ruleset)) : new Set();
    let newlyAddedForbidden = mapObj ? getForbiddenAddedZoneIdsForPhase(mapObj, nextDay, nextPhase, ruleset) : [];


    // ✅ 서든데스: 전 지역 금지로 0명 생존(무승부) 케이스가 발생할 수 있어, 최종 안전구역 2곳을 남깁니다.
    // - 기본: 소방서/골목길(2번째 이미지 동선 기준)
    if (suddenDeathActiveRef.current && mapObj && Array.isArray(mapObj.zones)) {
      const allZoneIds = mapObj.zones
        .map((z) => String(z?.zoneId ?? z?.id ?? z?._id ?? ''))
        .filter(Boolean);

      const preferred = ['firestation', 'alley'];
      const safePick = preferred.filter((zid) => allZoneIds.includes(zid));
      while (safePick.length < 2 && allZoneIds.length) {
        const cand = allZoneIds[Math.floor(Math.random() * allZoneIds.length)];
        if (!safePick.includes(cand)) safePick.push(cand);
      }
      const safeSet = new Set(safePick);

      forbiddenIds = new Set(allZoneIds.filter((zid) => !safeSet.has(zid)));

      if (!suddenDeathForbiddenAnnouncedRef.current) {
        newlyAddedForbidden = allZoneIds.filter((zid) => !safeSet.has(zid));
        suddenDeathForbiddenAnnouncedRef.current = true;
      } else {
        newlyAddedForbidden = [];
      }

      addLog(`🟩 최종 안전구역: ${safePick.map((z) => getZoneName(z)).join(', ')}`, 'highlight');
    }

    setForbiddenAddedNow(newlyAddedForbidden);
    const forbiddenNames = [...forbiddenIds].map((zid) => getZoneName(zid)).join(', ');
    const forbiddenAddedNames = newlyAddedForbidden.map((zid) => getZoneName(zid)).join(', ');

    const cfg = mapObj?.forbiddenZoneConfig || {};
    // LEGACY 규칙: 금지구역 체류 시 HP 감소
    const damagePerTick = Number(cfg.damagePerTick ?? 0) || Math.round(nextDay * (settings.forbiddenZoneDamageBase || 1.5));
    // 🧾 금지구역 상태(디버그/재현용): 페이즈 전환마다 1줄로 표준 로그를 남깁니다.
    const totalZones = (Array.isArray(mapObj?.zones) && mapObj.zones.length) ? mapObj.zones.length : (Array.isArray(zones) ? zones.length : 0);
    const safeZones = Math.max(0, totalZones - forbiddenIds.size);
    const fzEnabled = cfg.enabled !== false;
    const fzStartDay = Number(cfg.startDay ?? settings.forbiddenZoneStartDay ?? 2);
    const fzStartPhase = String(cfg.startPhase ?? cfg.startTimeOfDay ?? settings.forbiddenZoneStartPhase ?? 'night');
    const fzPhaseIdx = nextDay * 2 + (nextPhase === 'night' ? 1 : 0);
    const fzStartIdx = Math.max(0, fzStartDay) * 2 + (fzStartPhase === 'night' ? 1 : 0);
    const fzStateText = (!fzEnabled)
      ? 'OFF'
      : (fzPhaseIdx < fzStartIdx ? `대기(${fzStartDay}일차 ${fzStartPhase === 'night' ? '밤' : '낮'}부터)` : 'ON');
    addLog(`🚫 금지구역 업데이트: +${newlyAddedForbidden.length} · 금지 ${forbiddenIds.size}/${totalZones} · 안전 ${safeZones} · ${fzStateText}`, 'system');


    if (forbiddenIds.size > 0) {
      if (newlyAddedForbidden.length > 0) {
        addLog(`🚫 금지구역 확장: ${forbiddenAddedNames}`, 'highlight');
      }
      if (useDetonation) {
        const startSec = Number(ruleset?.detonation?.startSec || 20);
        const maxSec = Number(ruleset?.detonation?.maxSec || 30);
        addLog(`⚠️ 제한구역: ${forbiddenNames} (폭발 타이머: 기본 ${startSec}s / 최대 ${maxSec}s)`, 'system');
      } else {
        addLog(`⚠️ 금지구역: ${forbiddenNames} (해당 구역 체류 시 HP -${damagePerTick})`, 'system');
      }
    }




    // 🧬 부활 처리: deadAtPhaseIdx(사망 시점)가 컷오프 이하이면 다음 페이즈 시작에 1회 부활
    if (Array.isArray(dead) && dead.length) {
      const safeZonePool = (Array.isArray(mapObj?.zones) ? mapObj.zones : [])
        .map((z) => String(z?.zoneId ?? z?.id ?? z?._id ?? ''))
        .filter((zid) => zid && !forbiddenIds.has(String(zid)));
      const remainingDead = [];

      for (const d0 of dead) {
        const deadAt = Number(d0?.deadAtPhaseIdx ?? -9999);
        const eligible = d0?.reviveEligible === true || (deadAt >= 0 && deadAt <= reviveCutoffIdx);
        if (eligible && !d0?.revivedOnce) {
          const maxHp = Number(d0?.maxHp ?? 100);
          const revivedHp = Math.max(1, Math.floor(maxHp * 0.65));
          const zoneId = safeZonePool.length ? String(safeZonePool[Math.floor(Math.random() * safeZonePool.length)]) : String(d0?.zoneId || '');
          const reviveKit = findItemByKeywords(publicItems, ['붕대', 'bandage', '응급']);

          const r = normalizeRevivedSurvivor(d0, revivedHp, zoneId, phaseIdxNow, ruleset, phaseStartSec, reviveKit);
          if (useDetonation) {
            const startSec = Number(ruleset?.detonation?.startSec ?? 20);
            const maxSec = Number(ruleset?.detonation?.maxSec ?? 30);
            r.detonationMaxSec = maxSec;
            r.detonationSec = Math.min(maxSec, startSec);
          }

          revivedNow.push(r);
          emitRunEvent('revive', { who: String(r._id || ''), zoneId: String(zoneId || ''), hp: revivedHp }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
          addLog(`✨ [${r.name}] 부활! (HP ${revivedHp}${reviveKit?._id ? ', 붕대 1 지급' : ''})`, 'highlight');
        } else {
          remainingDead.push(d0);
        }
      }

      if (revivedNow.length) setDead(remainingDead);
    }
    // 2-0. 월드 스폰(맵 이벤트): 전설 재료 상자/보스 생성(낮 시작 시 1회)
    const spawnRes = ensureWorldSpawns(spawnState, zones, forbiddenIds, nextDay, nextPhase, mapIdNow, mapObj?.coreSpawnZones, ruleset);
    let nextSpawn = spawnRes.state;
    if (Array.isArray(spawnRes.announcements) && spawnRes.announcements.length) {
      spawnRes.announcements.forEach((m) => addLog(m, 'highlight'));
    }

    // 🧾 월드 스폰 상태(재현/디버그용)
    try {
      const lc = (Array.isArray(nextSpawn?.legendaryCrates) ? nextSpawn.legendaryCrates : []).filter((c) => !c?.opened).length;
      const cores = (Array.isArray(nextSpawn?.coreNodes) ? nextSpawn.coreNodes : []).filter((n) => !n?.picked);
      const meteor = cores.filter((n) => String(n?.kind) === 'meteor').length;
      const lifeTree = cores.filter((n) => String(n?.kind) === 'life_tree').length;
      const b = nextSpawn?.bosses || {};
      const wildlifeTotal = (nextSpawn?.wildlife && typeof nextSpawn.wildlife === 'object')
        ? Object.values(nextSpawn.wildlife).reduce((sum, v) => sum + Math.max(0, Number(v || 0)), 0)
        : 0;
      emitRunEvent('spawn_state', {
        day: nextDay,
        phase: nextPhase,
        legendary: lc,
        foodCrates: (Array.isArray(nextSpawn?.foodCrates) ? nextSpawn.foodCrates : []).filter((c) => !c?.opened).length,
        meteor,
        lifeTree,
        wildlifeTotal,
        alpha: !!b?.alpha?.alive,
        omega: !!b?.omega?.alive,
        weakline: !!b?.weakline?.alive,
      }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
    } catch {
      // ignore
    }

    // ✅ 관전형: 1일차 낮에는 "기본 장비"만 지급하고, 제작/루팅으로 성장하게 합니다.
    const isFirstDayStarterLoadout = (nextDay === 1 && nextPhase === 'morning' && !startStarterLoadoutAppliedRef.current);
    let phaseSurvivors = isFirstDayStarterLoadout
      ? (Array.isArray(survivors) ? survivors : []).map((s) => {
          const preferredWeaponType = String(s?.weaponType || '').trim();
          const wType = START_WEAPON_TYPES.includes(preferredWeaponType)
            ? preferredWeaponType
            : START_WEAPON_TYPES[Math.floor(Math.random() * START_WEAPON_TYPES.length)];
          const wTypeNorm = normalizeWeaponType(wType);

          const mk = (slot, wTypeArg = '') => createEquipmentItem({ slot, day: nextDay, tier: 1, weaponType: wTypeArg });
          const gear = {
            weapon: mk('weapon', wTypeNorm),
            shoes: mk('shoes'),
          };

          // ✅ 관전형: 시작 시 장비는 최소만 주고, 재료/제작으로 성장
          // - 인벤토리엔 '재료/소모품'만 남기고 장비는 초기화
          let baseInv = Array.isArray(s?.inventory)
            ? s.inventory.filter((x) => String(x?.category || inferItemCategory(x)) !== 'equipment')
            : [];
          baseInv = normalizeInventory(baseInv, ruleset);

          // ✅ 1일차 제작 템포용 스타터 재료(하급 재료): 4~6종 * 3개(스택 상한 3 유지)
          // - "1회 이동" 이후에만 실제 제작/강화가 진행되도록(=목표 조건) 재료는 미리 지급해도 OK
          const mats = (Array.isArray(publicItems) ? publicItems : [])
            .filter((it) => it?._id)
            .filter((it) => inferItemCategory(it) === 'material')
            .filter((it) => clampTier4(it?.tier || 1) <= 2)
            .filter((it) => !classifySpecialByName(it?.name || ''));
          for (let i = mats.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = mats[i];
            mats[i] = mats[j];
            mats[j] = tmp;
          }
          const pickN = Math.max(4, Math.min(6, mats.length));
          let inv = baseInv;
          for (let k = 0; k < pickN; k += 1) {
            const it = mats[k];
            if (!it?._id) continue;
            inv = addItemToInventory(inv, it, String(it._id), 3, nextDay, ruleset);
          }

          // 🥩 시작 보급(요청): 스테이크 3개
          const steak = findItemByKeywords(publicItems, ['스테이크', 'sizzling steak']);
          if (steak?._id) {
            inv = addItemToInventory(inv, steak, String(steak._id), 3, nextDay, ruleset);
          }

          // 시작 장비(무기/신발)
          inv = addItemToInventory(inv, gear.weapon, gear.weapon.itemId, 1, nextDay, ruleset);
          inv = addItemToInventory(inv, gear.shoes, gear.shoes.itemId, 1, nextDay, ruleset);

          return {
            ...s,
            day1Moves: 0,
            day1HeroDone: false,
            inventory: inv,
            equipped: {
              ...(ensureEquipped(s) || {}),
              weapon: gear.weapon.itemId,
              shoes: gear.shoes.itemId,
              head: null,
              clothes: null,
              arm: null,
            },
          };
        })
      : (Array.isArray(survivors) ? survivors : []);

    if (isFirstDayStarterLoadout) {
      startStarterLoadoutAppliedRef.current = true;
      addLog('🧰 1일차 낮: 기본 장비(일반 무기/신발)가 지급되었습니다. (관전형: 제작/루팅으로 성장)', 'highlight');
    }


    // ✅ 부활자는 이번 페이즈부터 다시 생존자로 합류
    if (revivedNow.length) phaseSurvivors = [...phaseSurvivors, ...revivedNow];
    phaseSurvivors = normalizeRuntimeSurvivorList(phaseSurvivors);

    // ✅ 1일차 "1회 이동" 영웅 세팅은 (강제 세팅) 대신 day1HeroGearDirector가 재료를 소모해 단계적으로 달성합니다.

    const newlyDead = [];
    const baseZonePop = {};
    (Array.isArray(phaseSurvivors) ? phaseSurvivors : []).forEach((s) => {
      if (!s || Number(s.hp || 0) <= 0) return;
      const zid = String(s.zoneId || '');
      if (!zid) return;
      baseZonePop[zid] = (baseZonePop[zid] || 0) + 1;
    });
    let updatedSurvivors = (Array.isArray(phaseSurvivors) ? phaseSurvivors : [])
      .map((s) => {
        const beforeHp = Number(s.hp || 0);
        const beforeEffects = Array.isArray(s?.activeEffects) ? s.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean) : [];
        const statusTick = updateEffects({ ...s, activeEffects: beforeEffects }, { returnMeta: true });
        let updated = normalizeRuntimeSurvivor(statusTick?.character || s);

        (Array.isArray(statusTick?.ticks) ? statusTick.ticks : []).forEach((tick) => {
          const amount = Math.max(0, Number(tick?.amount || 0));
          if (amount <= 0) return;
          const nm = String(tick?.name || '효과');
          if (tick?.type === 'damage') addLog(`⏱️ [${updated.name}] ${nm}: HP -${amount}`, 'highlight');
          else if (tick?.type === 'heal') addLog(`✨ [${updated.name}] ${nm}: HP +${amount}`, 'system');
        });
        (Array.isArray(statusTick?.expired) ? statusTick.expired : []).forEach((eff) => {
          const nm = String(eff?.name || '효과');
          addLog(`⌛ [${updated.name}] ${nm} 종료`, 'system');
        });

        const afterHp = Number(updated.hp || 0);
        if (beforeHp > 0 && afterHp <= 0) {
          updated.hp = 0;
          updated.deadAtPhaseIdx = phaseIdxNow;
          updated.reviveEligible = phaseIdxNow <= reviveCutoffIdx;
          newlyDead.push(updated);
          const cause = Array.isArray(statusTick?.ticks) && statusTick.ticks.some((tick) => Number(tick?.amount || 0) > 0)
            ? String(statusTick.ticks[0]?.name || '지속 효과')
            : '지속 효과';
          addLog(`💀 [${updated.name}] ${cause}로 사망했습니다.`, 'death');
          return updated;
        }

        // --- 이동 ---
updated.simCredits = updated.simCredits ?? 0;
updated.droneLastOrderIndex = updated.droneLastOrderIndex ?? -9999;
updated.droneLastOrderAbsSec = updated.droneLastOrderAbsSec ?? -99999;
updated.kioskLastInteractAbsSec = updated.kioskLastInteractAbsSec ?? -99999;
updated.aiTargetZoneId = updated.aiTargetZoneId ?? null;
updated.aiTargetTTL = updated.aiTargetTTL ?? 0;
updated.inventory = Array.isArray(updated.inventory) ? updated.inventory : [];
updated.inventory = normalizeInventory(updated.inventory, ruleset);
updated._itemKeyById = itemKeyById;

const currentZone = String(updated.zoneId || zones[0]?.zoneId || '__default__');
const neighbors = Array.isArray(zoneGraph[currentZone]) ? zoneGraph[currentZone] : [];
let nextZoneId = currentZone;

const mustEscape = forbiddenIds.has(currentZone);

// 목표 기반 이동: 조합 목표/월드 스폰/키오스크를 고려
const preGoal = buildCraftGoal(updated.inventory, craftables, itemNameById, {
  goalTier: updated?.goalGearTier,
  goalItemKeys: pickGoalLoadoutKeys(updated),
  perkEffects: getActorPerkEffects(updated),
});
const upgradeNeed = computeLateGameUpgradeNeed(updated, itemMetaById, itemNameById, nextDay, nextPhase, ruleset);
const aiMove = chooseAiMoveTargets({
  actor: updated,
  craftGoal: preGoal,
  upgradeNeed,
  mapObj,
  spawnState: nextSpawn,
  forbiddenIds,
  day: nextDay,
  phase: nextPhase,
  kiosks,
  itemMetaById,
  itemNameById,
});

// 🤖 목표 존 유지(TTL): 목표를 몇 페이즈 유지해서 '사람처럼' 보이게 함
const aiCfg = ruleset?.ai || {};
const recoverHpBelow = Math.max(0, Number(aiCfg?.recoverHpBelow ?? 38));
const recoverMinDelta = Math.max(0, Math.floor(Number(aiCfg?.recoverMinSaferDelta ?? 1)));
const sameZoneOpponents = (Array.isArray(phaseSurvivors) ? phaseSurvivors : []).filter((t) => (
  t && String(t?._id || '') !== String(updated?._id || '') && Number(t?.hp || 0) > 0 && String(t?.zoneId || '') === String(currentZone)
));
const worstSameZoneOpponent = sameZoneOpponents
  .slice()
  .sort((a, b) => Number(estimatePower(b) || 0) - Number(estimatePower(a) || 0))[0] || null;
const avoidInfoNow = worstSameZoneOpponent ? shouldAvoidCombatByPower(updated, worstSameZoneOpponent) : null;
const extremeRatio = Number(aiCfg?.fightAvoidExtremeRatio ?? 0.30);
const extremeDelta = Number(aiCfg?.fightAvoidExtremeDelta ?? 25);
const lowHpFleeInterrupt = !mustEscape && sameZoneOpponents.length > 0 && Number(updated.hp || 0) > 0 && Number(updated.hp || 0) <= recoverHpBelow;
const powerFleeInterrupt = !mustEscape && !!avoidInfoNow && ((Number(avoidInfoNow?.ratio || 1) < extremeRatio) || ((Number(avoidInfoNow?.opP || 0) - Number(avoidInfoNow?.myP || 0)) >= extremeDelta));
const fleeInterruptReason = mustEscape ? 'forbidden' : (lowHpFleeInterrupt ? 'low_hp' : (powerFleeInterrupt ? 'power_gap' : ''));
const recovering = !mustEscape && !fleeInterruptReason && Number(updated.hp || 0) > 0 && Number(updated.hp || 0) <= recoverHpBelow;

const ttlMin = Math.max(1, Number(aiCfg?.targetTtlMin ?? 2));
const ttlMax = Math.max(ttlMin, Number(aiCfg?.targetTtlMax ?? 4));
const clearOnReach = aiCfg?.clearOnReach !== false;

let holdTarget = null;

// 금지구역이면 목표 유지 대신 목표를 초기화(생존 우선)
if (mustEscape) {
  updated.aiTargetZoneId = null;
  updated.aiTargetTTL = 0;
} else {
  const saved = String(updated.aiTargetZoneId || '');
  const ttlNow = Math.max(0, Number(updated.aiTargetTTL || 0));

  if (saved && ttlNow > 0 && !forbiddenIds.has(saved)) {
    holdTarget = saved;
    // 페이즈마다 TTL 감소
    updated.aiTargetTTL = ttlNow - 1;
    if (clearOnReach && String(currentZone) === saved) {
      holdTarget = null;
      updated.aiTargetZoneId = null;
      updated.aiTargetTTL = 0;
    }
  }

  if (!holdTarget && Array.isArray(aiMove?.targets) && aiMove.targets.length > 0) {
    const pickedTarget = aiMove.targets
      .map((z) => String(z || ''))
      .find((z) => z && !forbiddenIds.has(String(z))) || '';
    if (pickedTarget) {
      updated.aiTargetZoneId = pickedTarget;
      updated.aiTargetTTL = randInt(ttlMin, ttlMax);
      holdTarget = pickedTarget;
    }
  }
}

let moveTargets = holdTarget ? [holdTarget] : (Array.isArray(aiMove?.targets) ? aiMove.targets : []);
let moveReason = holdTarget ? `${String(aiMove?.reason || 'goal')}:ttl` : String(aiMove?.reason || '');

// ✅ 목표/이동 후보에서 금지구역은 최대한 제외 (막혀서 멈추는 현상 방지)
moveTargets = uniqStrings(moveTargets.map((z) => String(z || ''))).filter((z) => z && !forbiddenIds.has(String(z)));

if (fleeInterruptReason) {
  updated.aiTargetZoneId = null;
  updated.aiTargetTTL = 0;
  const depthMax = Math.max(1, Math.floor(Number(aiCfg?.safeSearchDepth ?? 3)));
  const pick = bfsPickSafestZone(currentZone, zoneGraph, forbiddenIds, baseZonePop, { maxDepth: depthMax, minDelta: Math.max(1, recoverMinDelta) });
  const best = String(pick?.target || currentZone);
  if (best && best !== currentZone && !forbiddenIds.has(String(best))) {
    moveTargets = [String(best)];
  }
  moveReason = `flee:${String(fleeInterruptReason)}`;
} else if (recovering) {
  // 회복 우선: 목표/보스 추적보다 안전/저인구 존으로 분산(인접 1칸에만 갇히지 않게 BFS 사용)
  updated.aiTargetZoneId = null;
  updated.aiTargetTTL = 0;

  const depthMax = Math.max(1, Math.floor(Number(aiCfg?.safeSearchDepth ?? 3)));
  const pick = bfsPickSafestZone(currentZone, zoneGraph, forbiddenIds, baseZonePop, { maxDepth: depthMax, minDelta: recoverMinDelta });

  const best = String(pick?.target || currentZone);
  if (best && best !== currentZone && !forbiddenIds.has(String(best))) {
    moveTargets = [String(best)];
    moveReason = 'recover';
  }
}

// 금지구역이면 "탈출 시도" 확률만 올리고, 100% 강제 이탈은 하지 않습니다.
// (요구사항: 금지구역에 일정 시간 머무르면 사망 => 실제로 '머무를' 수 있어야 함)
const forbidCfg = ruleset?.forbidden || {};
const escapeMoveChance = Math.min(1, Math.max(0, Number(forbidCfg.escapeMoveChance ?? 0.85)));
// detonation이 임계치 근처면(=곧 폭발) 탈출 시도를 더 강하게 합니다.
const curDet = Number.isFinite(Number(updated.detonationSec)) ? Number(updated.detonationSec) : 999;
const dangerForceSec = Math.max(0, Number(ruleset?.detonation?.criticalSec ?? 5) + 2);
const escapeChance = (mustEscape && curDet <= dangerForceSec) ? 1 : escapeMoveChance;

const equipMs = getEquipMoveSpeed(updated);
const msMoveBonus = Math.min(0.18, equipMs * 0.9); // 신발 이동속도 반영(이동 결정)
let baseMoveChance = mustEscape ? escapeChance : (fleeInterruptReason ? 1 : (recovering ? 0.95 : (moveTargets.length ? 0.88 : 0.6)));
// ✅ 1일차 낮에는 "최소 1회 이동" 목표를 위해 이동 확률을 상향(관전 템포)
if (!mustEscape && Number(nextDay || 0) === 1 && String(nextPhase || '') === 'morning') {
  baseMoveChance = Math.max(baseMoveChance, 0.92);
}
const moveChance = Math.min(0.98, baseMoveChance + msMoveBonus);
let willMove = Math.random() < moveChance;

// ✅ 관전형 요구사항: 1일차 낮에는 '최소 1회 이동'을 거의 확정으로 보장
// - day1Moves가 0인 상태에서만 강제(이후에는 원래 확률로)
if (!mustEscape && Number(nextDay || 0) === 1 && String(nextPhase || '') === 'morning' && Math.max(0, Number(updated.day1Moves || 0)) < 1) {
  if (neighbors.length > 0) willMove = true;
}

if (willMove) {
  if (mustEscape) {
    // 금지구역이면 우선 안전한 곳으로 이동
    if (neighbors.length > 0) {
      const safeNeighbors = neighbors.filter((zid) => !forbiddenIds.has(String(zid)));
      const candidates = safeNeighbors.length ? safeNeighbors : neighbors;
      nextZoneId = String(candidates[Math.floor(Math.random() * candidates.length)] || currentZone);
    } else {
      // 연결 정보가 없으면(=neighbors가 비면) "맵 전체 순간이동" 대신 제자리(동선 데이터는 zoneConnections로 보강)
      nextZoneId = currentZone;
    }
  } else if (moveTargets.length) {
    const tset = new Set(moveTargets.map((z) => String(z)));
    const stepRes = bfsNextStepToAnyTarget(currentZone, tset, zoneGraph, forbiddenIds);

    const picked = stepRes.nextStep || (tset.has(currentZone) ? currentZone : String(moveTargets[0] || currentZone));
    if (picked && !forbiddenIds.has(String(picked))) nextZoneId = String(picked);
  } else {
    // 기본: 랜덤 인접 이동
    if (neighbors.length > 0) {
      const safeNeighbors = neighbors.filter((zid) => !forbiddenIds.has(String(zid)));
      const candidates = safeNeighbors.length ? safeNeighbors : neighbors;
      nextZoneId = String(candidates[Math.floor(Math.random() * candidates.length)] || currentZone);
    } else {
      // 연결 정보가 없으면(=neighbors가 비면) "맵 전체 랜덤" 대신 제자리
      nextZoneId = currentZone;
    }
  }
}

if (String(nextZoneId) !== String(currentZone)) {
  if (mustEscape) {
    addLog(`⚠️ [${updated.name}] 금지구역 이탈: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'system');
  } else if (String(moveReason || '').startsWith('flee:')) {
    const fleeLabel = moveReason === 'flee:low_hp' ? '저HP' : (moveReason === 'flee:power_gap' ? '전투력 열세' : '긴급');
    addLog(`🏃 [${updated.name}] ${fleeLabel} 인터럽트 도주: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'system');
  } else if (forbiddenIds.has(String(nextZoneId))) {
    addLog(`⚠️ [${updated.name}] 금지구역 진입: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'system');
  } else if (moveTargets.length) {
    if (moveReason === 'recover') {
      addLog(`🛟 [${updated.name}] 회복 우선 이동: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'system');
    } else {
      addLog(`🎯 [${updated.name}] 목표(${moveReason || 'goal'}) 이동: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'normal');
    }
  } else {
    addLog(`🚶 [${updated.name}] 이동: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'normal');
  }

  // 🧾 AI 이동 목표/결정(재현/디버그용)
  emitRunEvent('move', {
    who: String(updated?._id || ''),
    name: updated?.name,
    from: String(currentZone),
    to: String(nextZoneId),
    reason: mustEscape ? 'escape' : (String(moveReason || '').startsWith('flee:') ? String(moveReason) : (moveTargets.length ? String(moveReason || 'goal') : 'wander')),
  }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
} else if (mustEscape) {
  addLog(`⛔ [${updated.name}] 금지구역(${getZoneName(currentZone)})에 머무릅니다...`, 'death');
}

updated.zoneId = nextZoneId;

const didMove = String(nextZoneId) !== String(currentZone);

        // ✅ 1일차 "최소 1회 이동" 목표 추적
        if (didMove && Number(nextDay || 0) === 1) {
          updated.day1Moves = Math.max(0, Number(updated.day1Moves || 0)) + 1;
        }

        // 🔥 모닥불(요리) & 💧 물 채집 (서버 맵 설정 기반)
        try {
          const campfireZones = (Array.isArray(mapObj?.campfireZoneIds) ? mapObj.campfireZoneIds : []).map(String);
          const waterZones = (Array.isArray(mapObj?.waterSourceZoneIds) ? mapObj.waterSourceZoneIds : []).map(String);

          // 물 채집: 해당 존이면 물을 확보(관전 템포용)
          if (waterZones.includes(String(updated.zoneId))) {
            const water = findItemByKeywords(publicItems, ['물', 'water']);
            if (water?._id) {
              const have = invQty(updated.inventory, String(water._id));
              const chance = have <= 0 ? 0.85 : have < 2 ? 0.55 : 0.25;
              if (Math.random() < chance && canReceiveItem(updated.inventory, water, String(water._id), 1, ruleset)) {
                updated.inventory = addItemToInventory(updated.inventory, water, String(water._id), 1, nextDay, ruleset);
                const metaW = updated.inventory?._lastAdd;
                const gotW = Math.max(0, Number(metaW?.acceptedQty ?? 1));
                addLog(`💧 [${updated.name}] ${getZoneName(updated.zoneId)}에서 물을 채집했습니다. (+${gotW})${formatInvAddNote(metaW, 1, updated.inventory, ruleset)}`, 'normal');
                emitRunEvent('gain', { who: String(updated?._id || ''), itemId: String(water._id), qty: gotW, source: 'gather', kind: 'water', zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
              }
            }
          }

          // 모닥불 요리: 고기 1개를 스테이크 1개로 변환(페이즈당 1회)
          if (campfireZones.includes(String(updated.zoneId))) {
            const meat = findItemByKeywords(publicItems, ['고기']);
            const steak = findItemByKeywords(publicItems, ['스테이크', 'sizzling steak']);
            if (meat?._id && steak?._id) {
              const haveMeat = invQty(updated.inventory, String(meat._id));
              if (haveMeat >= 1 && canReceiveItem(updated.inventory, steak, String(steak._id), 1, ruleset)) {
                updated.inventory = consumeIngredientsFromInv(updated.inventory, [{ itemId: String(meat._id), qty: 1 }]);
                updated.inventory = addItemToInventory(updated.inventory, steak, String(steak._id), 1, nextDay, ruleset);
                const metaS = updated.inventory?._lastAdd;
                const gotS = Math.max(0, Number(metaS?.acceptedQty ?? 1));
                addLog(`🔥 [${updated.name}] ${getZoneName(updated.zoneId)} 모닥불에서 고기를 구워 스테이크 x${gotS}을(를) 만들었습니다.${formatInvAddNote(metaS, 1, updated.inventory, ruleset)}`, 'highlight');
                emitRunEvent('gain', { who: String(updated?._id || ''), itemId: String(steak._id), qty: gotS, source: 'craft', kind: 'campfire', zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
              }
            }
          }
        } catch {
          // ignore
        }

        // --- 필드 파밍(이벤트 외): 이동/탐색 중 아이템 획득 ---
        const loot = rollFieldLoot(mapObj, updated.zoneId, publicItems, ruleset, {
          moved: didMove,
          day: nextDay,
          phase: nextPhase,
          dropWeightsByKey: ruleset?.worldSpawns?.legendaryCrate?.dropWeightsByKey,
          perkEffects: getActorPerkEffects(updated),
        });
        if (loot) {
          const isTransPick = String(loot?.crateType || '').toLowerCase() === 'transcend_pick' && Array.isArray(loot?.options);
          if (isTransPick) {
            const devPickable = !!showMarketPanel && !pendingPickAssigned && !pendingTranscendPick && String(selectedCharId || '') === String(updated?._id || '');
            if (devPickable) {
              pendingPickAssigned = true;
              setPendingTranscendPick({
                id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                characterId: String(updated?._id || ''),
                characterName: updated?.name,
                zoneId: String(updated?.zoneId || ''),
                options: loot.options,
                at: { day: nextDay, phase: nextPhase, sec: phaseStartSec },
              });
              addLog(`🎁 [${updated.name}] ${getZoneName(updated.zoneId)}에서 초월 장비 선택 상자를 발견했습니다. (개발자 도구: 선택 대기)`, 'highlight');
            } else {
              const auto = pickAutoTranscendOption(loot.options, publicItems) || (loot.options[0] || null);
              const chosenId = String(auto?.itemId || '');
              const chosenItem = (Array.isArray(publicItems) ? publicItems : []).find((it) => String(it?._id) === chosenId) || null;
              updated.inventory = addItemToInventory(updated.inventory, chosenItem, chosenId, 1, nextDay, ruleset);
              const meta = updated.inventory?._lastAdd;
              const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
              const nm = itemDisplayName(chosenItem || { _id: chosenId, name: auto?.name });
              addLog(`🎁 [${updated.name}] ${getZoneName(updated.zoneId)}에서 초월 장비 선택 상자 오픈 → ${itemIcon(chosenItem)} [${nm}] x${got} 획득${formatInvAddNote(meta, 1, updated.inventory, ruleset)}`, 'highlight');
              emitRunEvent('gain', { who: String(updated?._id || ''), itemId: chosenId, qty: got, source: 'box', sourceKind: 'transcend_pick', zoneId: String(updated?.zoneId || ''), choice: 'auto' }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            }
          } else {
            updated.inventory = addItemToInventory(updated.inventory, loot.item, loot.itemId, loot.qty, nextDay, ruleset);
            const meta = updated.inventory?._lastAdd;
            const got = Math.max(0, Number(meta?.acceptedQty ?? loot.qty));
            const nm = loot.item?.name || '아이템';
            addLog(`📦 [${updated.name}] ${getZoneName(updated.zoneId)}에서 ${crateTypeLabel(loot.crateType)} ${itemIcon(loot.item || { type: '' })} [${nm}] x${got} 획득${formatInvAddNote(meta, loot.qty, updated.inventory, ruleset)}`, 'normal');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: String(loot.itemId || ''), qty: got, source: 'box', sourceKind: String(loot?.crateType || ''), zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
          }
        }

        // --- 필드 조합(이벤트 외): 방금 주운 재료로 1회 조합 시도 ---
        if (loot && String(loot?.crateType || '').toLowerCase() !== 'transcend_pick' && loot.itemId) {
          const crafted = tryAutoCraftFromLoot(updated.inventory, loot.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset);
          if (crafted) {
            updated.inventory = crafted.inventory;
            addLog(`[${updated.name}] ${crafted.log}`, 'normal');
          }
        }


        // --- 음식 상자(맵 이벤트 스폰): 매일 낮 시작에 드랍 → 해당 구역 진입 시 개봉 ---
        const foodCrate = openSpawnedFoodCrate(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, { moved: didMove });
        if (foodCrate) {
          updated.inventory = addItemToInventory(updated.inventory, foodCrate.item, foodCrate.itemId, foodCrate.qty, nextDay, ruleset);
          const metaF = updated.inventory?._lastAdd;
          const gotF = Math.max(0, Number(metaF?.acceptedQty ?? foodCrate.qty));
          const nmF = foodCrate.item?.name || '소모품';
          addLog(`🍱 [${updated.name}] ${getZoneName(updated.zoneId)}에서 음식 상자를 열어 ${itemIcon(foodCrate.item)} [${nmF}] x${gotF} 획득${formatInvAddNote(metaF, foodCrate.qty, updated.inventory, ruleset)}`, 'normal');
          emitRunEvent('gain', { who: String(updated?._id || ''), itemId: String(foodCrate.itemId || ''), qty: gotF, source: 'foodcrate', zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });

          const crF = Math.max(0, Number(foodCrate?.credits || 0));
          if (crF > 0) {
            updated.simCredits = Math.max(0, Number(updated.simCredits || 0) + crF);
            addLog(`💳 [${updated.name}] 음식 상자 보상 크레딧 +${crF}`, 'system');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: 'CREDITS', qty: crF, source: 'foodcrate', zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
          }
        }

        const isKioskZone = hasKioskAtZone(kiosks, mapObj, updated.zoneId);

        // --- 자연 코어(맵 이벤트 스폰): 2일차 '낮' 이후 운석/생명의 나무 ---
        const corePickup = pickupSpawnedCore(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, { moved: didMove });
        if (corePickup) {
          updated.inventory = addItemToInventory(updated.inventory, corePickup.item, corePickup.itemId, corePickup.qty || 1, nextDay, ruleset);
          const meta = updated.inventory?._lastAdd;
          const got = Math.max(0, Number(meta?.acceptedQty ?? (corePickup.qty || 1)));
          const nm = corePickup.item?.name || '특수 재료';
          addLog(`✨ [${updated.name}] ${getZoneName(updated.zoneId)}에서 자연 스폰 희귀 재료 발견: [${nm}] x${got}${formatInvAddNote(meta, corePickup.qty || 1, updated.inventory, ruleset)}`, 'highlight');
          emitRunEvent('gain', { who: String(updated?._id || ''), itemId: String(corePickup.itemId || ''), qty: got, source: 'natural', kind: String(corePickup.kind || ''), zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });

          const immediateCore = tryImmediateCraftFromSpecial(updated, String(corePickup.kind || ''), String(corePickup.itemId || ''), itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
          if (immediateCore?.changed) {
            updated.inventory = immediateCore.inventory;
            (Array.isArray(immediateCore.logs) ? immediateCore.logs : []).forEach((m) => addLog(String(m), 'highlight'));
          }
          if (Number(immediateCore?.pvpBonus || 0) > 0) {
            const pb = Number(immediateCore.pvpBonus || 0);
            updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
            updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
            updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
            updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
          }

          const craftedN = immediateCore?.changed ? null : tryAutoCraftFromLoot(updated.inventory, corePickup.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset);
          if (craftedN) {
            updated.inventory = craftedN.inventory;
            addLog(`[${updated.name}] ${craftedN.log}`, 'normal');
            emitCraftRunEvent(updated?._id, craftedN, { day: nextDay, phase: nextPhase, sec: phaseStartSec }, updated?.zoneId);
          }
        }

        // --- 조합 목표(간단 AI): 현재 인벤 기준으로 '가까운' 상위 티어 1개를 목표로 삼음 ---
        const craftGoal = buildCraftGoal(updated.inventory, craftables, itemNameById, {
          goalTier: updated?.goalGearTier,
          goalItemKeys: pickGoalLoadoutKeys(updated),
          perkEffects: getActorPerkEffects(updated),
        });

        // ✅ 1초 tick 행동 큐(1차): 이동/사냥/구매/제작 중 1개만 실행
        const queuedKioskAction = (didMove || fleeInterruptReason) ? null : rollKioskInteraction(mapObj, updated.zoneId, kiosks, publicItems, nextDay, nextPhase, updated, craftGoal, itemNameById, marketRules, upgradeNeed, phaseStartSec);
        const queuedDroneOrder = (didMove || fleeInterruptReason || (queuedKioskAction?.itemId && queuedKioskAction?.item)) ? null : rollDroneOrder(droneOffers, mapObj, publicItems, nextDay, nextPhase, updated, phaseIdxNow, craftGoal, itemNameById, marketRules, phaseStartSec);
        const craftProbeActor = (didMove || fleeInterruptReason || queuedKioskAction?.itemId || queuedDroneOrder?.itemId)
          ? null
          : { ...updated, inventory: Array.isArray(updated.inventory) ? [...updated.inventory] : [], _itemKeyById: itemKeyById };
        const craftPreview = craftProbeActor
          ? tryAutoCraftFromInventory(craftProbeActor, craftables, itemNameById, itemMetaById, nextDay, phaseIdxNow, ruleset)
          : null;
        const goalMissingIds = new Set(
          (Array.isArray(craftGoal?.missing) ? craftGoal.missing : [])
            .map((m) => String(m?.itemId || ''))
            .filter(Boolean)
        );
        const goalTargetId = String(craftGoal?.target?._id || craftGoal?.target?.itemId || '');
        const queueScoredCandidates = (() => {
          if (didMove || fleeInterruptReason) return [];
          const lowHpRatio = Math.max(0, Math.min(1, Number(updated?.hp || 0) / Math.max(1, Number(updated?.maxHp || 100))));
          const simCredits = Math.max(0, Number(updated?.simCredits || 0));
          const farmCreditsBias = upgradeNeed?.farmCredits ? 10 : 0;
          const legendBias = upgradeNeed?.wantLegend ? 6 : 0;
          const transBias = upgradeNeed?.wantTrans ? 8 : 0;
          const scoreRows = [];
          if (queuedKioskAction?.itemId && queuedKioskAction?.item) {
            const kioskTypeMap = { buy: 'kioskBuy', exchange: 'kioskExchange', sell: 'kioskSell' };
            const itemId = String(queuedKioskAction?.itemId || '');
            const matchesGoal = goalMissingIds.has(itemId) || (goalTargetId && goalTargetId === itemId);
            const kind = String(queuedKioskAction?.kind || 'buy');
            const isSell = kind === 'sell';
            const score =
              (isSell ? (18 + farmCreditsBias + Math.max(0, simCredits >= 300 ? 6 : 0)) : 44)
              + (matchesGoal ? 26 : 0)
              + (isSell ? 0 : legendBias + transBias)
              + (kind === 'exchange' ? 6 : 0)
              - (lowHpRatio <= 0.28 ? 5 : 0);
            scoreRows.push({
              type: kioskTypeMap[kind] || 'kioskBuy',
              zoneId: String(updated?.zoneId || ''),
              itemId,
              etaSec: 1,
              phaseIdx: Number(phaseIdxNow || 0),
              score,
              label: `${kioskTypeMap[kind] || 'kioskBuy'}:${String(queuedKioskAction?.item?.name || itemNameById?.[itemId] || itemId || '')}`,
              priorityNote: [matchesGoal ? 'goal' : '', kind === 'exchange' ? 'exchange' : '', isSell ? 'sell' : ''].filter(Boolean).join('+'),
            });
          }
          if (queuedDroneOrder?.itemId) {
            const itemId = String(queuedDroneOrder?.itemId || '');
            const matchesGoal = goalMissingIds.has(itemId) || (goalTargetId && goalTargetId === itemId);
            const score = 40 + (matchesGoal ? 28 : 0) + legendBias + transBias - (simCredits < 40 ? 10 : 0) - (lowHpRatio <= 0.28 ? 4 : 0);
            scoreRows.push({
              type: 'droneOrder',
              zoneId: String(updated?.zoneId || ''),
              itemId,
              etaSec: 1,
              phaseIdx: Number(phaseIdxNow || 0),
              score,
              label: `drone:${String(queuedDroneOrder?.item?.name || itemNameById?.[itemId] || itemId || '')}`,
              priorityNote: matchesGoal ? 'goal' : '',
            });
          }
          if (craftPreview?.changed) {
            const itemId = String(craftPreview?.craftedId || '');
            const craftedTier = Math.max(1, Number(craftPreview?.craftedTier || itemMetaById?.[itemId]?.tier || 1));
            const matchesGoal = goalTargetId === itemId || goalMissingIds.has(itemId);
            const score = 58 + craftedTier * 6 + (matchesGoal ? 24 : 0) + legendBias + transBias;
            scoreRows.push({
              type: 'craft',
              zoneId: String(updated?.zoneId || ''),
              itemId,
              etaSec: 1,
              phaseIdx: Number(phaseIdxNow || 0),
              score,
              label: `craft:${String(craftPreview?.craftedName || itemNameById?.[itemId] || itemId || '')}`,
              priorityNote: `${matchesGoal ? 'goal+' : ''}tier${craftedTier}`,
            });
          }
          scoreRows.push({
            type: 'hunt',
            zoneId: String(updated?.zoneId || ''),
            etaSec: 1,
            phaseIdx: Number(phaseIdxNow || 0),
            score: 24 + farmCreditsBias + (lowHpRatio <= 0.35 ? 6 : 0) + (craftPreview?.changed ? -10 : 0),
            label: 'hunt',
            priorityNote: farmCreditsBias > 0 ? 'credits' : '',
          });
          return scoreRows
            .sort((a, b) => {
              const ds = Number(b?.score || 0) - Number(a?.score || 0);
              if (Math.abs(ds) > 0.001) return ds;
              const pa = ['craft', 'kioskBuy', 'kioskExchange', 'droneOrder', 'kioskSell', 'hunt'].indexOf(String(a?.type || ''));
              const pb = ['craft', 'kioskBuy', 'kioskExchange', 'droneOrder', 'kioskSell', 'hunt'].indexOf(String(b?.type || ''));
              return pa - pb;
            })
            .slice(0, 5);
        })();
        const queuedAtomicAction = (() => {
          if (didMove) {
            return {
              type: (mustEscape || String(moveReason || '').startsWith('flee:')) ? 'flee' : 'moveTo',
              fromZoneId: String(currentZone || ''),
              toZoneId: String(nextZoneId || currentZone || ''),
              reason: mustEscape ? 'escape' : String(moveReason || 'goal'),
              etaSec: 1,
              phaseIdx: Number(phaseIdxNow || 0),
              score: 999,
            };
          }
          if (fleeInterruptReason) {
            return {
              type: 'flee',
              fromZoneId: String(currentZone || ''),
              toZoneId: String(nextZoneId || currentZone || ''),
              reason: String(moveReason || `flee:${fleeInterruptReason}`),
              etaSec: 1,
              phaseIdx: Number(phaseIdxNow || 0),
              score: 998,
            };
          }
          return queueScoredCandidates[0] || { type: 'hunt', zoneId: String(updated?.zoneId || ''), etaSec: 1, phaseIdx: Number(phaseIdxNow || 0), score: 0 };
        })();
        const queuedActionType = String(queuedAtomicAction?.type || 'hunt');
        const queuePreview = [queuedAtomicAction].filter(Boolean).map((act) => {
          const type = String(act?.type || 'hunt');
          const zoneText = getZoneName(act?.toZoneId || act?.zoneId || '');
          const itemText = String(
            (String(act?.itemId || '') && (itemNameById?.[String(act?.itemId || '')] || ''))
            || queuedKioskAction?.item?.name
            || queuedDroneOrder?.item?.name
            || craftPreview?.craftedName
            || ''
          );
          return [type, itemText && `:${itemText}`, zoneText && `@${zoneText}`].filter(Boolean).join('');
        });
        const candidatePreview = [
          didMove ? `${(mustEscape || String(moveReason || '').startsWith('flee:')) ? 'flee' : 'moveTo'}@${getZoneName(nextZoneId || currentZone || '')}` : null,
          (!didMove && fleeInterruptReason) ? `flee:${String(fleeInterruptReason || '')}` : null,
          ...queueScoredCandidates.map((row) => `${String(row?.label || row?.type || '')}[${Number(row?.score || 0).toFixed(1)}]`),
        ].filter(Boolean);
        const blockedReasons = [
          (didMove && (queuedKioskAction?.itemId || queuedDroneOrder?.itemId || craftPreview?.changed)) ? 'movement_locked' : null,
          (fleeInterruptReason && (queuedKioskAction?.itemId || queuedDroneOrder?.itemId || craftPreview?.changed)) ? `flee_interrupt:${String(fleeInterruptReason || '')}` : null,
          (!didMove && !fleeInterruptReason && !queuedKioskAction?.itemId && !queuedDroneOrder?.itemId && craftProbeActor?._craftDebug?.code && craftProbeActor?._craftDebug?.code !== 'crafted')
            ? `craft:${String(craftProbeActor?._craftDebug?.code || '')}`
            : null,
          ...queueScoredCandidates.slice(1).map((row) => `deferred:${String(row?.type || '')}`).slice(0, 2),
        ].filter(Boolean);
        updated.aiActionQueue = [queuedAtomicAction];
        updated.aiCurrentAction = queuedActionType;
        updated.aiActionEtaSec = Number(queuedAtomicAction?.etaSec || 1);
        updated._aiDebug = {
          phaseIdx: Number(phaseIdxNow || 0),
          zoneName: getZoneName(updated?.zoneId || currentZone),
          action: queuedActionType,
          reason: String(queuedAtomicAction?.reason || moveReason || ''),
          targetZoneName: getZoneName(queuedAtomicAction?.toZoneId || holdTarget || ''),
          itemName: String(
            queuedKioskAction?.item?.name
            || queuedDroneOrder?.item?.name
            || craftPreview?.craftedName
            || (craftGoal?.target?.name || '')
          ),
          goalName: String(craftGoal?.target?.name || ''),
          missingNames: (Array.isArray(craftGoal?.missing) ? craftGoal.missing : [])
            .slice(0, 4)
            .map((m) => String(m?.name || itemNameById?.[String(m?.itemId || '')] || m?.itemId || ''))
            .filter(Boolean),
          queuePreview,
          candidatePreview: candidatePreview.slice(0, 5),
          candidateScores: queueScoredCandidates.slice(0, 4).map((row) => `${String(row?.type || '')}:${Number(row?.score || 0).toFixed(1)}${row?.priorityNote ? `(${String(row.priorityNote)})` : ''}`),
          blockedReasons: blockedReasons.slice(0, 3),
          fleeReason: String(fleeInterruptReason || ''),
          recovering: !!recovering,
          credits: Math.max(0, Number(updated?.simCredits || 0)),
          wantLegend: !!upgradeNeed?.wantLegend,
          wantTrans: !!upgradeNeed?.wantTrans,
          farmCredits: !!upgradeNeed?.farmCredits,
        };
        if (blockedReasons.length || ['flee', 'kioskBuy', 'kioskExchange', 'kioskSell', 'droneOrder', 'craft'].includes(queuedActionType)) {
          emitQueueRunEvent(updated, {
            zoneId: String(updated?.zoneId || currentZone || ''),
            chosen: queuedActionType,
            blockedReasons,
            candidates: candidatePreview.slice(0, 5),
            candidateScores: queueScoredCandidates,
            candidateCount: candidatePreview.length,
            reason: String(queuedAtomicAction?.reason || moveReason || ''),
          }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
        }

        if (queuedActionType === 'hunt') {
        // --- 보스(맵 이벤트 스폰): 알파/오메가/위클라인 ---
        const boss = recovering ? null : consumeBossAtZone(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset);

        // --- 변이 야생동물(요청): 매 밤 스폰(로컬 설정 zone) ---
        const mutant = boss ? null : (recovering ? null : consumeMutantWildlifeAtZone(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset));

        // --- 야생동물 사냥(일반): 존 스폰 카운트 기반(매 페이즈 스폰 체크/파밍 강화) ---
        const hunt = boss || mutant || consumeWildlifeAtZone(nextSpawn, mapObj, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, { moved: didMove, isKioskZone, recovering });

        const isBossReward = !!boss;
        const isMutantReward = !boss && !!mutant;
        if (hunt) {
          const dmg = Math.max(0, Number(hunt.damage || 0));
          updated.hp = Math.max(0, Number(updated.hp || 0) - dmg);
          addLog(`🎯 [${updated.name}] ${hunt.log}${dmg > 0 ? ` (피해 -${dmg})` : ''}`, dmg > 0 ? 'highlight' : 'normal');
          const creditGain = Math.max(0, Number(hunt?.credits || 0));
          if (creditGain > 0) {
            updated.simCredits = Math.max(0, Number(updated.simCredits || 0) + creditGain);
            addLog(`💳 [${updated.name}] ${isBossReward ? '보스 처치 보상' : isMutantReward ? '변이 야생동물 보상' : '사냥 보상'} (크레딧 +${creditGain})`, 'system');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: 'CREDITS', qty: creditGain, source: isBossReward ? 'boss' : isMutantReward ? 'mutant' : 'hunt', kind: String(hunt?.kind || ''), zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });

            if (isBossReward) {
              const pb = 0.45;
              updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
              updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
              updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
              updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
            }
          }



          const drops = normalizeRewardDropEntries(
            Array.isArray(hunt?.drops) ? hunt.drops : (hunt?.drop ? [hunt.drop] : []),
            publicItems,
            itemNameById,
          );
          for (const d of drops) {
            if (!d?.itemId || !d?.item) continue;
            const q = Math.max(1, Number(d.qty || 1));
            const nm = d.item?.name || itemNameById?.[String(d.itemId || '')] || '아이템';
            updated.inventory = addItemToInventory(updated.inventory, d.item, d.itemId, q, nextDay, ruleset);
            const meta = updated.inventory?._lastAdd;
            const got = Math.max(0, Number(meta?.acceptedQty ?? q));
            addLog(`🧾 [${updated.name}] 드랍: ${itemIcon(d.item || { type: '' })} [${nm}] x${got}${formatInvAddNote(meta, q, updated.inventory, ruleset)}`, 'normal');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: String(d.itemId || ''), qty: got, source: isBossReward ? 'boss' : isMutantReward ? 'mutant' : 'hunt', kind: String(hunt?.kind || ''), zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });

            const specialKind = classifySpecialByName(nm);
            const immediateH = tryImmediateCraftFromSpecial(updated, specialKind, String(d.itemId || ''), itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
            if (immediateH?.changed) {
              updated.inventory = immediateH.inventory;
              (Array.isArray(immediateH.logs) ? immediateH.logs : []).forEach((m) => addLog(String(m), 'highlight'));
            }
            if (Number(immediateH?.pvpBonus || 0) > 0) {
              const pb = Number(immediateH.pvpBonus || 0);
              updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
              updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
              updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
              updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
            }

            const craftedH = immediateH?.changed ? null : tryAutoCraftFromLoot(updated.inventory, d.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset);
            if (craftedH) {
              updated.inventory = craftedH.inventory;
              addLog(`[${updated.name}] ${craftedH.log}`, 'normal');
              emitCraftRunEvent(updated?._id, craftedH, { day: nextDay, phase: nextPhase, sec: phaseStartSec }, updated?.zoneId);
            }
          }

          if (updated.hp <= 0 && Number(s.hp || 0) > 0) {
            addLog(`💀 [${updated.name}]이(가) 사냥 중 치명상을 입고 사망했습니다.`, 'death');
            newlyDead.push(updated);
          }
        }

        }

        // --- 전설 재료 상자(맵 이벤트 스폰): 3일차 '낮' 이후부터 맵 어딘가에 드랍 → 해당 구역 진입 시 개봉 ---
        const legendary = openSpawnedLegendaryCrate(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset, { moved: didMove });
        if (legendary) {
          updated.inventory = addItemToInventory(updated.inventory, legendary.item, legendary.itemId, legendary.qty, nextDay, ruleset);
          const meta = updated.inventory?._lastAdd;
          const got = Math.max(0, Number(meta?.acceptedQty ?? legendary.qty));
          const nm = legendary.item?.name || '전설 재료';
          addLog(`🟪 [${updated.name}] ${getZoneName(updated.zoneId)}에서 🎁 전설 재료 상자를 열어 [${nm}] x${got} 획득${formatInvAddNote(meta, legendary.qty, updated.inventory, ruleset)}`, 'normal');
          emitRunEvent('gain', { who: String(updated?._id || ''), itemId: String(legendary.itemId || ''), qty: got, source: 'legend', zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });

          const specialLKindMain = classifySpecialByName(String(legendary?.item?.name || ''));
          const immediateLMain = tryImmediateCraftFromSpecial(updated, specialLKindMain, String(legendary.itemId || ''), itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
          if (immediateLMain?.changed) {
            updated.inventory = immediateLMain.inventory;
            (Array.isArray(immediateLMain.logs) ? immediateLMain.logs : []).forEach((m) => addLog(String(m), 'highlight'));
          }
          if (Number(immediateLMain?.pvpBonus || 0) > 0) {
            const pb = Number(immediateLMain.pvpBonus || 0);
            updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
            updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
            updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
            updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
          }

          // 크레딧 보상 + 추가드랍(룰셋 기반)
          const legCr = Math.max(0, Number(legendary?.credits || 0));
          if (legCr > 0) {
            updated.simCredits = Math.max(0, Number(updated.simCredits || 0) + legCr);
            addLog(`💳 [${updated.name}] 전설 상자 보상 크레딧 +${legCr}`, 'system');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: 'CREDITS', qty: legCr, source: 'legend', zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
          }

          const bonusDrops = Array.isArray(legendary?.bonusDrops) ? legendary.bonusDrops : [];
          for (const bd of bonusDrops) {
            if (!bd?.itemId || !bd?.item) continue;
            const q = Math.max(1, Number(bd.qty || 1));
            updated.inventory = addItemToInventory(updated.inventory, bd.item, bd.itemId, q, nextDay, ruleset);
            const metaB = updated.inventory?._lastAdd;
            const gotB = Math.max(0, Number(metaB?.acceptedQty ?? q));
            const nmB = bd.item?.name || '전설 재료';
            addLog(`🟪 [${updated.name}] 전설 상자 추가드랍: [${nmB}] x${gotB}${formatInvAddNote(metaB, q, updated.inventory, ruleset)}`, 'highlight');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: String(bd.itemId || ''), qty: gotB, source: 'legend', zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });

            const specialLBKind = classifySpecialByName(String(bd?.item?.name || nmB || ''));
            const immediateLB = tryImmediateCraftFromSpecial(updated, specialLBKind, String(bd.itemId || ''), itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
            if (immediateLB?.changed) {
              updated.inventory = immediateLB.inventory;
              (Array.isArray(immediateLB.logs) ? immediateLB.logs : []).forEach((m) => addLog(String(m), 'highlight'));
            }
            if (Number(immediateLB?.pvpBonus || 0) > 0) {
              const pb = Number(immediateLB.pvpBonus || 0);
              updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
              updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
              updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
              updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
            }
          }


          // 전설 재료도 즉시 조합 트리거(선택적)
          const craftedL = (typeof immediateLMain !== 'undefined' && immediateLMain?.changed) ? null : tryAutoCraftFromLoot(updated.inventory, legendary.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset);
          if (craftedL) {
            updated.inventory = craftedL.inventory;
            addLog(`[${updated.name}] ${craftedL.log}`, 'normal');
            emitCraftRunEvent(updated?._id, craftedL, { day: nextDay, phase: nextPhase, sec: phaseStartSec }, updated?.zoneId);
          }
        }

        let didProcure = false;

        // --- 키오스크/드론(구매/교환): 원자 액션(kioskBuy/kioskExchange/kioskSell/droneOrder)일 때만 실행 ---
        if (['kioskBuy','kioskExchange','kioskSell','droneOrder'].includes(queuedActionType)) {
          const kioskAction = queuedKioskAction;
          if (['kioskBuy','kioskExchange','kioskSell'].includes(queuedActionType) && kioskAction?.itemId && kioskAction?.item) {
          const itemNm = kioskAction.item?.name || kioskAction.label || '아이템';

          if (kioskAction.kind === 'buy') {
            const cost = Math.max(0, Number(kioskAction.cost || 0));
            updated.simCredits = Math.max(0, Number(updated.simCredits || 0) - cost);
            updated.inventory = addItemToInventory(updated.inventory, kioskAction.item, kioskAction.itemId, kioskAction.qty || 1, nextDay, ruleset);
            const meta = updated.inventory?._lastAdd;
            const want = Math.max(1, Number(kioskAction.qty || 1));
            const got = Math.max(0, Number(meta?.acceptedQty ?? want));

            // ✅ 전술 강화 모듈: (level 모드) 즉시 소비 → 전술 스킬 레벨 +1
            // - 모듈을 인벤에 쌓아두지 않고, 즉시 레벨로 전환(관전 템포)
            const tacMode = String(ruleset?.ai?.tacModuleUpgradeMode || 'level');
            const tags = Array.isArray(kioskAction?.item?.tags) ? kioskAction.item.tags : [];
            const isTacModule = String(itemNm || '').includes('전술 강화 모듈') || tags.some((t) => String(t).toLowerCase().includes('tac_skill_module'));
            if (tacMode === 'level' && isTacModule && got > 0) {
              const beforeLv = Math.max(1, Math.min(2, Math.floor(Number(updated?.tacticalSkillLevel || 1))));
              const inc = Math.max(0, Math.min(2 - beforeLv, Math.floor(got)));
              if (inc > 0) {
                updated.tacticalSkillLevel = beforeLv + inc;
                updated.inventory = consumeIngredientsFromInv(updated.inventory, [{ itemId: String(kioskAction.itemId || ''), qty: inc }]);
                addLog(`🎛️ [${updated.name}] 전술 강화 모듈 사용 → 전술 스킬 레벨 +${inc} (Lv.${updated.tacticalSkillLevel})`, 'highlight');
              }
            }
            addLog(`🏪 [${updated.name}] 키오스크 ${kioskAction.label ? `(${kioskAction.label}) ` : ''}구매: [${itemNm}] x${got}${formatInvAddNote(meta, want, updated.inventory, ruleset)} (크레딧 -${cost})`, 'system');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: String(kioskAction.itemId || ''), qty: got, source: 'kiosk', kind: 'buy', zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            didProcure = true;

            // 구매 아이템도 즉시 조합 트리거(선택적)
            const specialKKind = classifySpecialByName(String(kioskAction?.item?.name || itemNm || ''));
            const immediateK = tryImmediateCraftFromSpecial(updated, specialKKind, String(kioskAction.itemId || ''), itemNameById, itemMetaById, nextDay, nextPhase, phaseIdxNow, ruleset);
            if (immediateK?.changed) {
              updated.inventory = immediateK.inventory;
              (Array.isArray(immediateK.logs) ? immediateK.logs : []).forEach((m) => addLog(String(m), 'highlight'));
            }
            if (Number(immediateK?.pvpBonus || 0) > 0) {
              const pb = Number(immediateK.pvpBonus || 0);
              updated._gatherPvpBonus = Math.max(Number(updated._gatherPvpBonus || 0), pb);
              updated._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;
              updated._immediateDanger = Math.max(Number(updated._immediateDanger || 0), pb);
              updated._immediateDangerUntilPhaseIdx = phaseIdxNow;
            }

            const craftedK = immediateK?.changed ? null : tryAutoCraftFromLoot(updated.inventory, kioskAction.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset);
            if (craftedK) {
              updated.inventory = craftedK.inventory;
              addLog(`[${updated.name}] ${craftedK.log}`, 'normal');
              emitCraftRunEvent(updated?._id, craftedK, { day: nextDay, phase: nextPhase, sec: phaseStartSec }, updated?.zoneId);
            }
          }

          if (kioskAction.kind === 'exchange' && Array.isArray(kioskAction.consume) && kioskAction.consume.length) {
            const consumedNames = kioskAction.consume
              .map((x) => `${itemNameById?.[String(x.itemId)] || String(x.itemId)} x${x.qty || 1}`)
              .join(' + ');
            updated.inventory = consumeIngredientsFromInv(updated.inventory, kioskAction.consume);
            updated.inventory = addItemToInventory(updated.inventory, kioskAction.item, kioskAction.itemId, kioskAction.qty || 1, nextDay, ruleset);
            const meta = updated.inventory?._lastAdd;
            const want = Math.max(1, Number(kioskAction.qty || 1));
            const got = Math.max(0, Number(meta?.acceptedQty ?? want));

            // ✅ 전술 강화 모듈: (level 모드) 즉시 소비 → 전술 스킬 레벨 +1
            const tacMode = String(ruleset?.ai?.tacModuleUpgradeMode || 'level');
            const tags = Array.isArray(kioskAction?.item?.tags) ? kioskAction.item.tags : [];
            const isTacModule = String(itemNm || '').includes('전술 강화 모듈') || tags.some((t) => String(t).toLowerCase().includes('tac_skill_module'));
            if (tacMode === 'level' && isTacModule && got > 0) {
              const beforeLv = Math.max(1, Math.min(2, Math.floor(Number(updated?.tacticalSkillLevel || 1))));
              const inc = Math.max(0, Math.min(2 - beforeLv, Math.floor(got)));
              if (inc > 0) {
                updated.tacticalSkillLevel = beforeLv + inc;
                updated.inventory = consumeIngredientsFromInv(updated.inventory, [{ itemId: String(kioskAction.itemId || ''), qty: inc }]);
                addLog(`🎛️ [${updated.name}] 전술 강화 모듈 사용 → 전술 스킬 레벨 +${inc} (Lv.${updated.tacticalSkillLevel})`, 'highlight');
              }
            }
            addLog(`🏪 [${updated.name}] 키오스크 교환: ${consumedNames} → [${itemNm}] x${got}${formatInvAddNote(meta, want, updated.inventory, ruleset)}`, 'system');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: String(kioskAction.itemId || ''), qty: got, source: 'kiosk', kind: 'exchange', zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            didProcure = true;

            const craftedE = tryAutoCraftFromLoot(updated.inventory, kioskAction.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset);
            if (craftedE) {
              updated.inventory = craftedE.inventory;
              addLog(`[${updated.name}] ${craftedE.log}`, 'normal');
              emitCraftRunEvent(updated?._id, craftedE, { day: nextDay, phase: nextPhase, sec: phaseStartSec }, updated?.zoneId);
            }
          }

          if (kioskAction.kind === 'sell') {
            const q = Math.max(1, Number(kioskAction.qty || 1));
            const gain = Math.max(0, Number(kioskAction.credits || 0));
            updated.inventory = consumeIngredientsFromInv(updated.inventory, [{ itemId: String(kioskAction.itemId || ''), qty: q }]);
            updated.simCredits = Math.max(0, Number(updated.simCredits || 0) + gain);
            addLog(`🏪 [${updated.name}] 키오스크 환급: [${itemNm}] x${q} → 크레딧 +${gain}`, 'system');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: 'CREDITS', qty: gain, source: 'kiosk', kind: 'sell', zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            didProcure = true;
          }

          }
          if (!didProcure && queuedActionType === 'droneOrder') {
            // --- 드론 호출(하급 아이템 보급): 즉시 지급 ---
            const droneOrder = queuedDroneOrder;
            if (droneOrder?.itemId && Number(droneOrder?.cost || 0) <= Number(updated.simCredits || 0)) {
            const cost = Math.max(0, Number(droneOrder.cost || 0));
            updated.simCredits = Math.max(0, Number(updated.simCredits || 0) - cost);

            const qty = Math.max(1, Number(droneOrder.qty || 1));
            const item = droneOrder?.item || null;
            const itemId = String(droneOrder.itemId || item?._id || '');
            if (itemId) {
              updated.inventory = addItemToInventory(updated.inventory, item, itemId, qty, nextDay, ruleset);
              const meta = updated.inventory?._lastAdd;
              const got = Math.max(0, Number(meta?.acceptedQty ?? qty));
              addLog(`🚁 [${updated.name}] 드론 호출: ${item?.name || itemNameById?.[itemId] || '아이템'} x${got}${formatInvAddNote(meta, qty, updated.inventory, ruleset)} (-${cost}Cr, 즉시)`, 'normal');
              emitRunEvent('gain', { who: String(updated?._id || ''), itemId: String(itemId || ''), qty: got, source: 'drone', zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
              didProcure = true;

              // 즉시 지급된 아이템으로 조합이 가능해지면 자동 조합(낮은 확률)
              const craftedD = tryAutoCraftFromLoot(updated.inventory, itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset);
              if (craftedD?.inventory) {
                updated.inventory = craftedD.inventory;
                addLog(`[${updated.name}] ${craftedD.log}`, 'highlight');
                emitCraftRunEvent(updated?._id, craftedD, { day: nextDay, phase: nextPhase, sec: phaseStartSec }, updated?.zoneId);
              }
            }
          }
        }

        }

        // ✅ 인벤 기반 제작(레시피): 행동 큐가 'craft'일 때만 실행
        // - 이동/사냥/구매와 같은 tick에 겹치지 않게 1차 분리
        if (queuedActionType === 'craft') {
          const invCraft = tryAutoCraftFromInventory(updated, craftables, itemNameById, itemMetaById, nextDay, phaseIdxNow, ruleset);
          if (invCraft?.changed) {
            addLog(String(invCraft.log), 'highlight');
            emitCraftRunEvent(updated?._id, invCraft, { day: nextDay, phase: nextPhase, sec: phaseStartSec }, updated?.zoneId);
          }
          else if (String(selectedCharId || '') === String(updated?._id || '')) {
            const dbg = updated?._craftDebug || null;
            const dbgKey = `${phaseIdxNow}:${String(dbg?.code || '')}:${String(dbg?.targetName || '')}:${Array.isArray(dbg?.missing) ? dbg.missing.join('|') : ''}`;
            if (dbg?.code && updated?._craftDebugLogKey !== dbgKey) {
              updated._craftDebugLogKey = dbgKey;
              addLog(`[${updated.name}] 🧪 제작판정(${dbg.code}): ${dbg.text}`, 'system');
            }
          }

          // ✅ 1일차 목표 달성(영웅 세팅): 재료를 소모해 단계적으로 제작/강화
          // - 조건: 1일차에 최소 1회 이동(day1Moves>=1)
          const heroRes = day1HeroGearDirector(updated, publicItems, itemNameById, itemMetaById, nextDay, nextPhase, ruleset);
          if (heroRes?.changed && Array.isArray(heroRes.logs)) {
            heroRes.logs.forEach((m) => addLog(String(m), 'highlight'));
          }

          // ✅ 후반 세팅(전설/초월) 제작: 크레딧/키오스크 루프가 실제로 장비로 이어지게 함
          const lateRes = lateGameGearDirector(updated, publicItems, itemNameById, itemMetaById, nextDay, nextPhase, ruleset);
          if (lateRes?.changed && Array.isArray(lateRes.logs)) {
            lateRes.logs.forEach((m) => addLog(String(m), 'highlight'));
          }
        }


        // --- 시즌10 컨셉: 가젯 에너지 ---
        if (ruleset.id === 'ER_S10') {
          const energyCfg = ruleset?.gadgetEnergy || {};
          const maxEnergy = Number(energyCfg.max ?? 100);
          const gain = Number(energyCfg.gainPerPhase ?? 10);
          const curEnergy = Number(updated.gadgetEnergy ?? 0);
          updated.gadgetEnergy = Math.min(maxEnergy, curEnergy + gain);
          if (!updated.cooldowns) updated.cooldowns = { portableSafeZone: 0, cnotGate: 0 };
          if (updated.safeZoneUntil === undefined || updated.safeZoneUntil === null) updated.safeZoneUntil = 0;
        }

        // --- 폭발 타이머(금지구역) ---
        // - 룰셋이 detonation을 제공하면, 어떤 규칙이든 폭발 타이머를 사용합니다.
        if (useDetonation) {
          // 기존 저장 데이터와 호환: 필드가 없으면 기본값 주입
          const detCfg = ruleset?.detonation || {};
          if (updated.detonationSec === undefined || updated.detonationSec === null) updated.detonationSec = Number(detCfg.startSec ?? 20);
          if (updated.detonationMaxSec === undefined || updated.detonationMaxSec === null) updated.detonationMaxSec = Number(detCfg.maxSec ?? 30);
        }

        // --- 금지구역 피해(LEGACY) ---
        // - detonation이 없을 때만 HP 감소 규칙을 사용
        if (!useDetonation) {
          if (forbiddenIds.size > 0 && forbiddenIds.has(String(updated.zoneId))) {
            updated.hp = Math.max(0, Number(updated.hp || 0) - damagePerTick);
            if (updated.hp > 0) {
              addLog(`☠️ [${updated.name}] 금지구역(${getZoneName(updated.zoneId)}) 피해: HP -${damagePerTick}`, 'death');
            }
          }

          if (updated.hp <= 0 && Number(s.hp || 0) > 0) {
            addLog(`💀 [${s.name}]이(가) 금지구역을 벗어나지 못하고 사망했습니다.`, 'death');
            updated.deadAtPhaseIdx = phaseIdxNow;
            updated.reviveEligible = phaseIdxNow <= reviveCutoffIdx;
            newlyDead.push(updated);
          }
        }
        return updated;
      })
      .filter((s) => Number(s.hp || 0) > 0);

    // 2.5) 페이즈 내부 틱 시뮬레이션(폭발 타이머)
    if (useDetonation && forbiddenIds.size > 0) {
      const tickSec = Number(ruleset?.tickSec || 1);
      const detCfg = ruleset?.detonation || {};
      const decPerSec = Number(detCfg.decreasePerSecForbidden ?? detCfg.decreasePerSec ?? 1);
      const regenPerSec = Number(detCfg.regenPerSecOutsideForbidden ?? detCfg.regenPerSecOutside ?? 1);
      const criticalSec = Number(detCfg.criticalSec || 5);

      const psz = ruleset?.gadgets?.portableSafeZone || {};
      const pszCost = Number(psz.energyCost || 40);
      const pszCd = Number(psz.cooldownSec || 30);
      const pszDur = Number(psz.durationSec || 7);

      const cnot = ruleset?.gadgets?.cnotGate || {};
      const cnotCost = Number(cnot.energyCost || 30);
      const cnotCd = Number(cnot.cooldownSec || 10);

      const allZoneIds = (Array.isArray(mapObj?.zones) && mapObj.zones.length)
        ? mapObj.zones.map((z) => String(z.zoneId))
        : [...forbiddenIds];

      // 🧨 엔드게임: 안전구역이 2곳만 남으면(=마지막 단계), 40s 유예 후 안전구역도 폭발 타이머가 감소합니다.
      const safeLeft = allZoneIds.filter((zid) => !forbiddenIds.has(String(zid))).length;
      const allowForceAll = !suddenDeathActiveRef.current;
      const forceAllAfterSec = (allowForceAll && safeLeft <= 2) ? Math.max(0, Number(detCfg.forceAllAfterSec ?? 40)) : null;
      if (forceAllAfterSec !== null) {
        addLog(`⏳ 안전구역 유예 ${forceAllAfterSec}s: 이후 모든 구역에서 폭발 타이머가 감소합니다.`, 'system');
      }

      const pickSafeZone = (fromZoneId) => {
        const neighbors = Array.isArray(zoneGraph[fromZoneId]) ? zoneGraph[fromZoneId] : [];
        const safeNeighbors = neighbors.map(String).filter((zid) => !forbiddenIds.has(String(zid)));
        if (safeNeighbors.length) return String(safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)]);
        const safeAll = allZoneIds.filter((zid) => !forbiddenIds.has(String(zid)));
        if (safeAll.length) return String(safeAll[Math.floor(Math.random() * safeAll.length)]);
        return String(fromZoneId);
      };

      // 🌫️ 퍼플 포그(서브웨더) - Day2/Day3/Day4 중간(단순 모델)
      const fogWarningSec = Number(ruleset?.fog?.warningSec || 30);
      const fogDurationSec = Number(ruleset?.fog?.durationSec || 45);
      const fogStartLocal = (fogLocalSec === null || fogLocalSec === undefined) ? null : Number(fogLocalSec);
      const fogWarnLocal = (fogStartLocal !== null) ? Math.max(0, fogStartLocal - fogWarningSec) : null;
      const fogEndLocal = (fogStartLocal !== null) ? fogStartLocal + fogDurationSec : null;

      let aliveMap = buildRuntimeSurvivorMap(updatedSurvivors);
      aliveMap = new Map(Array.from(aliveMap.values()).map((s) => [String(s._id), { ...s, cooldowns: { ...(s.cooldowns || {}) } }]));

      for (let t = 0; t < phaseDurationSec; t += tickSec) {
        const absSec = phaseStartSec + t;

        // 퍼플 포그 안내 로그(과도한 로그 방지: 1회씩만)
        if (fogWarnLocal !== null && t === fogWarnLocal) {
          addLog(`🌫️ 퍼플 포그 경고! 약 ${fogWarningSec}s 후, 일부 구역에서 시야가 악화됩니다.`, 'system');
        }
        if (fogStartLocal !== null && t === fogStartLocal) {
          addLog(`🌫️ 퍼플 포그 확산! (약 ${fogDurationSec}s)`, 'highlight');
        }
        if (fogEndLocal !== null && t === fogEndLocal) {
          addLog(`🌫️ 퍼플 포그가 걷혔습니다.`, 'system');
        }

        for (const s of aliveMap.values()) {
          if (!s || Number(s.hp || 0) <= 0) continue;

          // 쿨다운 감소
          if (s.cooldowns) {
            s.cooldowns.portableSafeZone = Math.max(0, Number(s.cooldowns.portableSafeZone || 0) - tickSec);
            s.cooldowns.cnotGate = Math.max(0, Number(s.cooldowns.cnotGate || 0) - tickSec);
          }

          const zoneId = String(s.zoneId || '__default__');
          const forceAllNow = (forceAllAfterSec !== null && t >= forceAllAfterSec);
          const isForbidden = forceAllNow ? true : forbiddenIds.has(zoneId);

          if (forceAllAfterSec !== null && t === forceAllAfterSec) {
            addLog('⚠️ 유예 종료: 안전구역도 위험해졌습니다.', 'highlight');
          }

          if (!isForbidden) {
            // 안전 구역: 폭발 타이머 회복
            if (s.detonationSec !== null && s.detonationSec !== undefined) {
              const maxDet = Number(s.detonationMaxSec || detCfg.maxSec || 30);
              s.detonationSec = Math.min(maxDet, Number(s.detonationSec || 0) + regenPerSec * tickSec);
            }
            // 로그 스팸 방지: 안전구역에선 경고 마일스톤을 초기화
            s._detLogLastMilestone = null;
            continue;
          }

          // 제한구역: 폭발 타이머는 "금지구역에 있으면 무조건 감소"합니다.
          // (안전지대/개인 보호 효과가 있더라도 감소하며, 엔드게임(forceAllNow)도 동일)

          // 제한구역: 폭발 타이머 감소(휴대용 안전지대 전개 중이면 감소를 멈춥니다.)
          const isProtected = Number(s.safeZoneUntil || 0) > absSec;
          if (!isProtected) {
            s.detonationSec = Math.max(0, Number(s.detonationSec || 0) - decPerSec * tickSec);
          }

          // ⏳ 경고 로그(마일스톤) - 과도한 로그 방지
          const detFloor = Math.max(0, Math.floor(Number(s.detonationSec || 0)));
          const milestones = Array.isArray(detCfg.logMilestones) ? detCfg.logMilestones.map((x) => Math.floor(Number(x))) : [15, 10, 5, 3, 1, 0];
          if (milestones.includes(detFloor) && Number(s._detLogLastMilestone) !== detFloor) {
            s._detLogLastMilestone = detFloor;
            addLog(`⏳ [${s.name}] 폭발 타이머 ${detFloor}s (구역: ${getZoneName(zoneId)})`, 'system');
          }

          // 위기: 가젯 사용 시도(단순 모델)
          if (Number(s.detonationSec || 0) <= criticalSec) {
            const energyNow = Number(s.gadgetEnergy || 0);

            // 1) CNOT 게이트(간이 텔레포트)
            if (Number(s.cooldowns?.cnotGate || 0) <= 0 && energyNow >= cnotCost) {
              const dest = pickSafeZone(zoneId);
              if (dest && String(dest) !== zoneId) {
                s.zoneId = String(dest);
                s.gadgetEnergy = energyNow - cnotCost;
                s.cooldowns.cnotGate = cnotCd;
                addLog(`🌀 [${s.name}] CNOT 게이트 발동 → ${getZoneName(dest)} (에너지 -${cnotCost})`, 'highlight');
              }
            }

            // 2) 휴대용 안전지대(간이 개인 보호)
            const afterEnergy = Number(s.gadgetEnergy || 0);
            if (forbiddenIds.has(String(s.zoneId || zoneId)) && Number(s.cooldowns?.portableSafeZone || 0) <= 0 && afterEnergy >= pszCost) {
              s.gadgetEnergy = afterEnergy - pszCost;
              s.cooldowns.portableSafeZone = pszCd;
              s.safeZoneUntil = absSec + pszDur;
              addLog(`🛡️ [${s.name}] 휴대용 안전지대 전개 (${pszDur}s) (에너지 -${pszCost})`, 'highlight');
            }
          }

          // 폭발 타이머 만료 → 사망
          if (Number(s.detonationSec || 0) <= 0) {
            s._deathAt = absSec;
            s._deathBy = 'detonation';
            s.hp = 0;
            s.deadAtPhaseIdx = phaseIdxNow;
            s.reviveEligible = phaseIdxNow <= reviveCutoffIdx;
            newlyDead.push(s);
            addLog(`💥 [${s.name}] 폭발 타이머가 0이 되어 사망했습니다. (구역: ${getZoneName(zoneId)})`, 'death');
          }
        }
      }

      // ✅ 무승부 방지: 서든데스에서 전원 폭발로 0명이 되면, 가장 늦게 죽은 1명을 승자로 판정
      if (suddenDeathActiveRef.current) {
        const aliveNow = Array.from(aliveMap.values()).filter((x) => Number(x?.hp || 0) > 0);
        if (aliveNow.length === 0) {
          const deadNow = Array.from(aliveMap.values()).filter((x) => Number(x?.hp || 0) <= 0);
          if (deadNow.length) {
            const lastAt = Math.max(...deadNow.map((x) => Number(x?._deathAt || 0)));
            const candidates = deadNow.filter((x) => Number(x?._deathAt || 0) === lastAt);
            const winner = candidates[Math.floor(Math.random() * candidates.length)];
            if (winner) {
              // dead 목록에 들어간 winner를 되살리기
              const idx = newlyDead.findIndex((d) => String(d?._id) === String(winner?._id));
              if (idx >= 0) newlyDead.splice(idx, 1);
              winner.hp = Math.max(1, Number(winner.hp || 1));
              aliveMap.set(winner._id, winner);
              addLog(`⚖️ 전원 폭발! 마지막까지 버틴 [${winner.name}] 승리(무승부 방지)`, 'highlight');
            }
          }
        }
      }

// 반영
      updatedSurvivors = normalizeRuntimeSurvivorList(Array.from(aliveMap.values())).filter((s) => Number(s.hp || 0) > 0);
    }

    if (newlyDead.length) setDead((prev) => [...prev, ...normalizeRuntimeSurvivorList(newlyDead.map((x) => normalizeDeadSnapshot(x, ruleset)))]);

    // 확률 보정(룰셋 기반)
    const pvpProbCfg = ruleset?.pvp || {};
    const fogBonus = (ruleset.id === 'ER_S10' && fogLocalSec !== null && fogLocalSec !== undefined)
      ? Number(pvpProbCfg.encounterFogBonus ?? 0.08)
      : 0;
    const battleBase = Number(pvpProbCfg.encounterBase ?? 0.3);
    const battleScale = Number(pvpProbCfg.encounterDayScale ?? 0.05);
    const battleMax = Number(pvpProbCfg.encounterMax ?? 0.85);
    const sdStartIdx = worldPhaseIndex(6, 'night');
    const phaseIdxNext = worldPhaseIndex(nextDay, nextPhase);
    const suddenDeath = phaseIdxNext >= sdStartIdx;

    // 6번째 밤 이전까지는 교전(엔카운터)을 낮게, 제한구역이 늘수록(=압박) 점점 상승
    const totalZonesCount = Math.max(1, Array.isArray(mapObj?.zones) ? mapObj.zones.length : 19);
    const restrictedRatio = Math.max(0, Math.min(1, forbiddenIds.size / totalZonesCount));
    const paceBonus = suddenDeath ? 0.35 : Math.min(0.25, 0.05 + Math.max(0, nextDay - 1) * 0.02 + restrictedRatio * 0.25);
    const battleCap = suddenDeath ? 0.99 : Math.max(battleMax, 0.88);
    let battleProb = Math.min(battleCap, battleBase + nextDay * battleScale + fogBonus + paceBonus);

    // 전투 알고리즘 보정값(ER 느낌): 제한구역 압박/밤 여부를 전투 계산에도 전달
    battleSettings.battle.pressure = restrictedRatio;
    battleSettings.battle.isNight = (nextPhase === 'night');

    // ✅ 1일차 낮(세팅 페이즈)에는 교전(PvP)을 발생시키지 않음
    if (nextDay === 1 && nextPhase === 'morning') battleProb = 0;

    const eventOffset = Number(pvpProbCfg.eventOffset ?? 0.3);
    const eventMax = Number(pvpProbCfg.eventMax ?? 0.95);
    const eventProb = Math.min(eventMax, (battleProb * 0.55) + eventOffset + restrictedRatio * 0.10);

    // 동일 zone 교전 트리거 최소 인원(기본 2명)
    const pvpMinSameZone = Math.max(2, Math.floor(Number(pvpProbCfg.encounterMinSameZone ?? 2)));
    const assistWindowPhases = Math.max(1, Math.floor(Number(pvpProbCfg.assistWindowPhases ?? 2)));

    // 🩸 출혈(최소): 피격 시 확률로 DOT 상태이상 부여
    const bleedEnabled = pvpProbCfg.bleedEnabled !== false;
    const bleedChanceOnHit = Number(pvpProbCfg.bleedChanceOnHit ?? 0.22);
    const bleedMinDamage = Math.max(0, Number(pvpProbCfg.bleedMinDamage ?? 10));
    const bleedDurationPhases = Math.max(1, Math.floor(Number(pvpProbCfg.bleedDurationPhases ?? 2)));
    const bleedDotPerPhase = Math.max(1, Math.floor(Number(pvpProbCfg.bleedDotPerPhase ?? 6)));

    const tryApplyBleed = (victim, attacker, damage) => {
      if (!bleedEnabled) return false;
      if (!victim || Number(victim.hp || 0) <= 0) return false;
      const dmg = Number(damage || 0);
      if (!(dmg >= bleedMinDamage)) return false;
      if (Math.random() >= bleedChanceOnHit) return false;

      const applied = applyStatusEffect(victim, {
        name: EFFECT_BLEED,
        remainingDuration: bleedDurationPhases,
        dotDamage: bleedDotPerPhase,
        sourceId: String(attacker?._id || ''),
        appliedPhaseIdx: phaseIdxNow,
        tags: ['negative', 'dot', 'bleed'],
        stackMode: 'refresh_max',
        maxStacks: 3,
      });
      if (applied?.reason === 'immune') {
        addLog(`🛡️ [${victim.name}] 출혈 면역`, 'system');
        return false;
      }
      if (applied?.reason === 'resisted') {
        addLog(`🧷 [${victim.name}] 출혈 저항`, 'system');
        return false;
      }
      if (applied?.refreshed) addLog(`🩸 [${victim.name}] 출혈 연장! (${bleedDurationPhases}페이즈)`, 'highlight');
      else if (applied?.applied) addLog(`🩸 [${victim.name}] 출혈! (${bleedDurationPhases}페이즈, -${bleedDotPerPhase}/페이즈)`, 'highlight');
      return !!applied?.applied;
    };

    // 교전이 특정 캐릭터에 편향되지 않도록(선공/우선순위 이점 제거) 양방향 결과를 비교해 채택
    const pickStat = (c, keys) => {
      for (const k of keys) {
        const v = Number(c?.stats?.[k] ?? c?.[k] ?? c?.[k?.toLowerCase?.()] ?? 0);
        if (Number.isFinite(v) && v > 0) return v;
      }
      return 0;
    };

    const combatScore = (c) => {
      const hp = Math.max(1, Math.min(100, Number(c?.hp ?? 100)));
      const base =
        pickStat(c, ['STR', 'str']) +
        pickStat(c, ['AGI', 'agi']) +
        pickStat(c, ['SHOOT', 'shoot', 'SHT', 'sht']) +
        pickStat(c, ['END', 'end']) +
        pickStat(c, ['MEN', 'men']) * 0.5 +
        pickStat(c, ['INT', 'int']) * 0.3 +
        pickStat(c, ['DEX', 'dex']) * 0.3 +
        pickStat(c, ['LUK', 'luk']) * 0.2;
      const shield = Math.max(0, getShieldValue(c));
      const regen = Math.max(0, getRegenValue(c));
      const sustain = Math.min(28, shield * 0.65 + regen * 1.35);

      return (base * (0.5 + hp / 200)) + sustain;
    };

    // 🤖 AI 교전 회피(전투력 비교): 상대 대비 불리하면 교전을 피함(장비 tier + HP 포함)
    const getEquipTierSummary = (c) => {
      const inv = Array.isArray(c?.inventory) ? c.inventory : [];
      let weaponTier = 0;
      let armorTierSum = 0;
      for (const it of inv) {
        const slot = String(it?.equipSlot || '');
        const t = Math.max(1, Number(it?.tier || 1));
        const tp = String(it?.type || '').toLowerCase();
        if (slot === 'weapon' || tp === 'weapon' || tp === '무기') weaponTier = Math.max(weaponTier, t);
        else if (slot === 'head' || slot === 'clothes' || slot === 'arm' || slot === 'shoes') armorTierSum += t;
      }
      return { weaponTier, armorTierSum };
    };

    function estimatePower(c) {
      const base = combatScore(c);
      const { weaponTier, armorTierSum } = getEquipTierSummary(c);
      const pw = Number(ruleset?.ai?.powerWeaponPerTier ?? 3);
      const pa = Number(ruleset?.ai?.powerArmorPerTier ?? 1.5);
      return base + weaponTier * pw + armorTierSum * pa;
    }

    function shouldAvoidCombatByPower(me, opp) {
      const myP = estimatePower(me);
      const opP = estimatePower(opp);
      const ratio = myP / Math.max(1, myP + opP);
      const aggroBias = Math.max(0, getPerkAggressionBias(me));
      const minRatioBase = Number(ruleset?.ai?.fightAvoidMinRatio ?? 0.40);
      const absDeltaBase = Number(ruleset?.ai?.fightAvoidAbsDelta ?? 10);
      const minRatio = Math.max(0.2, minRatioBase - aggroBias * 0.08);
      const absDelta = Math.max(0, absDeltaBase + aggroBias * 12);
      if (ratio < minRatio || (opP - myP) >= absDelta) return { myP, opP, ratio };
      return null;
    };
    // ✅ 장비 쿨감(CDR) 합산: 스킬 발동 확률에 반영
    // - equipped 슬롯(id) 기준으로 inventory에서 아이템을 찾아 stats.cdr 합산
    const getEquippedCdr = (c) => {
      const inv = Array.isArray(c?.inventory) ? c.inventory : [];
      const eq = c?.equipped || {};
      const pickById = (id) => {
        if (!id) return null;
        const sid = String(id);
        return inv.find((it) => String(it?.itemId || it?.id || it?._id || '') === sid) || null;
      };
      let sum = 0;
      for (const s of ['weapon', 'head', 'clothes', 'arm', 'shoes']) {
        const it = pickById(eq?.[s]);
        if (it?.stats?.cdr != null) sum += Number(it.stats.cdr || 0);
      }
      return Math.max(0, Math.min(0.75, sum));
    };


    const getSpecialSkillChance = (c) => {
      const s = c?.specialSkill;
      const name = String(s?.name || '').trim();
      if (!name) return 0;
      // 기본값은 스킬 없음 처리
      if (name === '평범함' || name === '없음' || name.toLowerCase() === 'none') return 0;

      // 타입이 명시돼 있고 combat이 아니면 전투 스킬로 취급하지 않음
      const type = String(s?.type || '').trim();
      if (type && type !== 'combat') return 0;

      // 데이터에 명시된 확률이 있으면 우선
      const explicit = s?.procChance ?? s?.chance ?? s?.proc;
      if (typeof explicit === 'number' && explicit >= 0 && explicit <= 1) return explicit;
      // 기본값(너무 자주 터지면 체감이 "항상 스킬"이 됨)
      const base = Number(settings?.battle?.skillProcDefault ?? 0.35);

      // ✅ CDR(쿨감)로 스킬 발동 빈도 상승
      const cdr = getEquippedCdr(c);
      const cdrScale = Number(settings?.battle?.cdrProcScale ?? 0.25); // CDR 0.75면 +0.1875p
      const bonus = cdr * (Number.isFinite(cdrScale) ? cdrScale : 0.25);
      const cap = Number(settings?.battle?.skillProcCap ?? 0.9);

      // 특정 케이스 체감 보정(테러 발도는 조금 높게)
      if (name.includes('발도')) {
        const b = Number(settings?.battle?.iaidoSkillProc ?? 0.65);
        return Math.max(0, Math.min(cap, b + bonus * 0.5));
      }
      return Math.max(0, Math.min(cap, base + bonus));
    };


    const rollSpecialSkillForBattle = (c) => {
      // 전투용 스킬 정규화(시로코/테러 파생 포함)
      prepareBattleSkills(c);
      if (!c?.specialSkill) return false;
      const p = getSpecialSkillChance(c);
      if (!(p > 0)) {
        c.specialSkill = null;
        return false;
      }
      const did = Math.random() < p;
      if (!did) c.specialSkill = null;
      return did;
    };

    const pickUnbiasedBattle = (a, b) => {
      // 교전 편향(선공/우선순위)에 의한 "항상 같은 승자" 체감 완화
      // + 스킬(특수기)도 매 교전마다 확률로 발동하도록 롤링

      // 1) 시로코 테러(발도) 오프너: 체감상 "드론에 씹혀서 발도 자체가 안 뜨는" 상황 완화
      const aIsTerror = isShirokoTerror(a);
      const bIsTerror = isShirokoTerror(b);
      const hasTerror = aIsTerror || bIsTerror;
      const hasBaseShiroko = isShirokoBase(a) || isShirokoBase(b);

      const iaidoProc = Number(settings?.battle?.iaidoProc ?? 0.55);
      if (hasTerror && hasBaseShiroko && Math.random() < iaidoProc) {
        const terror = aIsTerror ? a : b;
        const shiroko = isShirokoBase(a) ? a : b;

        const terrorClone = cloneForBattle(terror);
        const shirokoClone = cloneForBattle(shiroko);

        // 전투 스킬 정규화(파생 스킬 포함)
        prepareBattleSkills(terrorClone);
        prepareBattleSkills(shirokoClone);

        // 발도는 "발동" 자체를 보장(이 분기 자체가 발동 이벤트)
        terrorClone.specialSkill = { name: '발도', type: 'combat' };

        // 대신, 이 교전에서는 상대 특수스킬을 잠깐 끄고(동시 발동 느낌 제거) 진행
        shirokoClone.specialSkill = null;

        applyIaidoOpener(terrorClone, shirokoClone, battleSettings);
        const rIaido = calculateBattle(terrorClone, shirokoClone, nextDay, battleSettings);

        const prefix = `⚔️ [${terror.name}] 발도! 선제 공격으로 교전이 시작됩니다.`;
        return {
          ...rIaido,
          log: `${prefix} ${rIaido?.log || ''}`.trim(),
        };
      }

      // 2) 일반 교전: 양측을 배틀용으로 복제 + 특수기 발동 확률 롤
      const aClone = cloneForBattle(a);
      const bClone = cloneForBattle(b);
      rollSpecialSkillForBattle(aClone);
      rollSpecialSkillForBattle(bClone);

      const r1 = calculateBattle(aClone, bClone, nextDay, battleSettings);

      // 3) 선택 편향 완화: 선공/우선순위에 따른 승자 고정 체감을 줄이기 위해 확률 기반으로 흔듦
      const id1 = r1?.winner?._id ? String(r1.winner._id) : null;

      const sa = combatScore(a);
      const sb = combatScore(b);
	      const total = Math.max(1, sa + sb);

      let delta = (sa - sb) / total; // -1..1
      let pA = 0.5 + delta * 0.35;   // 0.15..0.85 근처
      const la = pickStat(a, ['LUK', 'luk']) || 0;
      const lb = pickStat(b, ['LUK', 'luk']) || 0;
      pA += ((la - lb) / 100) * 0.05;
	      pA = Math.min(0.85, Math.max(0.15, pA));

      const chosenId = Math.random() < pA ? String(a._id) : String(b._id);

      // 승자가 없으면 그대로 반환
      if (!id1) return r1;

      if (chosenId === id1) return r1;

      // 결과 반전(난전) 처리
      const winner = chosenId === String(a._id) ? a : b;
      const loser = winner === a ? b : a;
      const wnRaw = winner?.name || winner?.character_name || winner?.nickname || '';
      const lnRaw = loser?.name || loser?.character_name || loser?.nickname || '';
      const wn = canonicalizeCharName(wnRaw) || wnRaw || 'UNKNOWN';
      const ln = canonicalizeCharName(lnRaw) || lnRaw || 'UNKNOWN';

      return {
        ...r1,
        winner,
        type: 'kill',
        log: `⚡ 난전! [${wn}](이)가 [${ln}](을)를 제압했습니다!`,
      };
    };

    let todaysSurvivors = [...normalizeRuntimeSurvivorList(updatedSurvivors)].sort(() => Math.random() - 0.5);
    let survivorMap = buildRuntimeSurvivorMap(todaysSurvivors);
    let newDeadIds = [];

    // 이번 턴 킬 모아두기
    let roundKills = {};
    let roundAssists = {};

    // 🧪 소모품 자동 사용(최소): 전투 중 사용은 없음(전투 외 타이밍에서만 호출)
    const consCfg = ruleset?.consumables || {};
    const consEnabled = consCfg?.enabled !== false;
    const consTurnHpBelow = Number(consCfg.aiUseHpBelow ?? 60);
    const consAfterBattleHpBelow = Number(consCfg.afterBattleHpBelow ?? 50);
    const consMaxUsesPerPhase = Math.max(0, Math.floor(Number(consCfg.maxUsesPerPhase ?? 1)));

    const tryUseConsumable = (ch, reason) => {
      if (!consEnabled || consMaxUsesPerPhase <= 0) return false;
      if (!ch || !Array.isArray(ch.inventory) || ch.inventory.length === 0) return false;

      // 같은 페이즈에서 과다 사용 방지(기본 1회)
      const usedPhaseKey = 'consumableUsedPhaseIdx';
      const usedCountKey = 'consumableUsedCount';
      const lastPhase = Number(ch?.[usedPhaseKey] ?? -9999);
      if (lastPhase !== phaseIdxNow) {
        ch[usedPhaseKey] = phaseIdxNow;
        ch[usedCountKey] = 0;
      }
      const usedCount = Number(ch?.[usedCountKey] ?? 0);
      if (usedCount >= consMaxUsesPerPhase) return false;

      const hp = Number(ch.hp || 0);
      const hpBelow = reason === 'after_battle' ? consAfterBattleHpBelow : consTurnHpBelow;
      if (hp <= 0) return false;

      const inv = ch.inventory;
      const hasCleanseTarget = [EFFECT_BLEED, EFFECT_POISON, EFFECT_BURN, EFFECT_FOOD_POISON].some((name) => hasActiveEffect(ch, name));
      const hasBandage = hasCleanseTarget && inv.some((i) => isBandageLikeItem(i));
      if (!hasBandage && hp >= hpBelow) return false;

      // 의료(붕대/힐) → 음식 순으로 우선 사용
      const idxMed = inv.findIndex((i) => {
        const tags = safeTags(i);
        const t = String(i?.type || '').toLowerCase();
        const n = String(i?.name || i?.text || i?.itemId?.name || '');
        return tags.includes('heal') || tags.includes('medical') || n.includes('붕대') || n.toLowerCase().includes('bandage') || n.toLowerCase().includes('medkit') || t === 'medical';
      });
      const idxFood = inv.findIndex((i) => {
        const tags = safeTags(i);
        const t = String(i?.type || '').toLowerCase();
        const n = String(i?.name || i?.text || i?.itemId?.name || '');
        return t === 'food' || tags.includes('food') || tags.includes('healthy') || n.includes('음식') || n.includes('빵') || n.includes('고기');
      });

      const idx = idxMed > -1 ? idxMed : idxFood;
      if (idx < 0) return false;

      const itemToUse = inv[idx];
      const effect = applyItemEffect(ch, itemToUse);
      const cleanseCfg = effect?.cleanse && typeof effect.cleanse === 'object'
        ? effect.cleanse
        : (isBandageLikeItem(itemToUse)
          ? { names: [EFFECT_BLEED, EFFECT_POISON, EFFECT_BURN, EFFECT_FOOD_POISON], removeAllNegative: false, bonusHeal: 0 }
          : null);
      const cleanse = cleanseCfg
        ? clearNegativeStatusEffects(ch, { names: Array.isArray(cleanseCfg?.names) ? cleanseCfg.names : [], removeAllNegative: cleanseCfg?.removeAllNegative === true })
        : { changed: false, removed: [] };

      const cleanseBonus = cleanse.changed
        ? Math.max(0, perkNumber(getActorPerkEffects(ch)?.cleanseHealPlus || 0)) + Math.max(0, Number(cleanseCfg?.bonusHeal || 0))
        : 0;
      const logText = cleanse.changed ? `${effect.log} (상태이상 정리)` : effect.log;
      addLog(logText, 'highlight');

      const maxHp = Number(ch?.maxHp ?? 100);
      ch.hp = Math.min(maxHp, hp + Number(effect.recovery || 0) + cleanseBonus);
      const statBoost = effect?.statBoost && typeof effect.statBoost === 'object' ? effect.statBoost : null;
      if (statBoost) {
        ch.stats = ch.stats && typeof ch.stats === 'object' ? { ...ch.stats } : {};
        Object.entries(statBoost).forEach(([key, value]) => {
          const v = Number(value || 0);
          if (!Number.isFinite(v) || v === 0) return;
          ch.stats[key] = Number(ch.stats?.[key] || 0) + v;
        });
      }
      const runtimeEffects = applyRuntimeEffectPayloads(ch, effect?.newEffects);
      runtimeEffects.results.forEach((row) => {
        if (row?.reason === 'immune') addLog(`🛡️ [${ch.name}] ${String(row?.effect?.name || '효과')} 면역`, 'system');
        else if (row?.reason === 'resisted') addLog(`🧷 [${ch.name}] ${String(row?.effect?.name || '효과')} 저항`, 'system');
        else if (row?.applied) addLog(`🪄 [${ch.name}] ${describeRuntimeEffect(row.effect)}`, 'system');
      });
      const cured = !!cleanse.changed;

      // qty 감소(서버형 인벤토리 대응)
      const currentQty = Number(itemToUse?.qty || 1);
      if (Number.isFinite(currentQty) && currentQty > 1) inv[idx] = { ...itemToUse, qty: currentQty - 1 };
      else inv.splice(idx, 1);

      ch[usedCountKey] = usedCount + 1;
      emitConsumableRunEvent(ch, itemToUse, { source: 'consumable', reason, heal: Math.max(0, Number(ch.hp || 0) - hp), cleansed: Array.isArray(cleanse?.removed) ? cleanse.removed.length : 0, removedEffects: Array.isArray(cleanse?.removed) ? cleanse.removed : [] }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
      emitEffectRunEvents(ch, runtimeEffects.results, { source: 'consumable', itemId: String(itemToUse?._id || itemToUse?.itemId || ''), reason }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
      upsertRuntimeSurvivor(survivorMap, ch);
      return true;
    };


    // 3. 메인 루프
    while (todaysSurvivors.length > 0) {
      let actor = todaysSurvivors.pop();
      actor = actor?._id ? survivorMap.get(String(actor._id)) : null;
      if (!actor) continue;
      actor = normalizeRuntimeSurvivor(actor);

      if (!actor?._id || newDeadIds.includes(actor._id) || actor.hp <= 0) continue;

      // 아이템 사용(전투 중 불가 / 전투 후 가능): 전투 외 타이밍에서만 호출
      tryUseConsumable(actor, 'turn_start');

      // ✅ 수집 이벤트 페널티: 다음 페이즈 1회 교전 확률 보너스
      let gatherPvpBonus = 0;
      const gatherUntil = Number(actor?._gatherPvpBonusUntilPhaseIdx ?? -1);
      if (gatherUntil === phaseIdxNow) {
        gatherPvpBonus = Math.max(0, Number(actor?._gatherPvpBonus || 0));
      } else if (gatherUntil > -1 && gatherUntil < phaseIdxNow) {
        actor._gatherPvpBonus = 0;
        actor._gatherPvpBonusUntilPhaseIdx = null;
      }

      const actorRecoveryLocked = isAiRecoveryLocked(actor, phaseStartSec);
      const potentialTargets = todaysSurvivors.filter((t) => {
        if (!t || newDeadIds.includes(t._id)) return false;
        if (String(t?._id || '') === String(actor?._id || '')) return false;
        if (String(t?.zoneId || '') !== String(actor?.zoneId || '')) return false;
        if (actorRecoveryLocked || isAiRecoveryLocked(t, phaseStartSec)) return false;
        return true;
      });
      const canDual = potentialTargets.length >= (pvpMinSameZone - 1);

      // ✅ 즉시 위험(수집/사냥 직후): 같은 페이즈에서 '표적 우선' (다음 페이즈로 넘어가면 자동 해제)
      const dangerUntil = Number(actor?._immediateDangerUntilPhaseIdx ?? -1);
      if (dangerUntil > -1 && dangerUntil < phaseIdxNow) {
        actor._immediateDanger = 0;
        actor._immediateDangerUntilPhaseIdx = null;
      }

      const pickPvpTarget = (list) => {
        if (!Array.isArray(list) || list.length === 0) return null;
        const noisy = list.filter((t) => {
          const tt = survivorMap.get(t._id);
          return Number(tt?._immediateDanger || 0) > 0 && Number(tt?._immediateDangerUntilPhaseIdx ?? -1) === phaseIdxNow;
        });
        const pool = noisy.length ? noisy : list;
        const picked = pool[Math.floor(Math.random() * pool.length)];
        return picked ? survivorMap.get(picked._id) : null;
      };

      const pvpTarget = canDual ? pickPvpTarget(potentialTargets) : null;
      const rand = Math.random();

      const lowHpAvoidCombat = !suddenDeath && Number(actor.hp || 0) > 0 && Number(actor.hp || 0) <= Number(ruleset?.ai?.recoverHpBelow ?? 38);
      const densityFactor = Math.min(1, Math.max(0, potentialTargets.length / 3));
      const pressureMult = 0.75 + 0.25 * restrictedRatio;
      const densityMult = 0.55 + 0.45 * densityFactor;
      const nightMult = (nextPhase === 'night') ? 1.05 : 1.0;
      const actorAggro = getPerkAggressionBias(actor);
      const battleProb2Base = suddenDeath ? Math.max(0.95, battleProb) : (lowHpAvoidCombat ? 0 : battleProb * densityMult * pressureMult * nightMult);
      const actorMs = getEquipMoveSpeed(actor);
      const evadeBonus = suddenDeath ? 0 : Math.min(0.18, actorMs * 0.9); // 이동속도 높을수록 교전 회피(추격 회피)
      const aggressionEncounterBonus = suddenDeath ? 0 : Math.max(-0.06, Math.min(0.16, actorAggro * 0.18));
      const battleProb2 = Math.min(0.99, Math.max(0, battleProb2Base + gatherPvpBonus + aggressionEncounterBonus - evadeBonus));
      if (lowHpAvoidCombat && canDual) {
        addLog(`🛡️ [${actor.name}] 저HP로 교전 회피`, 'system');
      }

      // 전투력 열세면 교전 회피 + 인접 안전 구역으로 이동(가능할 때)
      if (canDual && !lowHpAvoidCombat && rand < battleProb2) {
        const targetEval = pvpTarget;
        const avoidInfo = targetEval ? shouldAvoidCombatByPower(actor, targetEval) : null;
        if (avoidInfo) {
          const oppName = String(targetEval?.name || '상대');
          const delta = Number(avoidInfo.opP || 0) - Number(avoidInfo.myP || 0);
          const avoidChanceBase = Number(ruleset?.ai?.fightAvoidChance ?? 0.75);
          const avoidChance = Math.min(0.95, avoidChanceBase + Math.min(0.25, actorMs * 1.5)); // 신발 이속이 높을수록 회피 확률 증가
          const extremeRatio = Number(ruleset?.ai?.fightAvoidExtremeRatio ?? 0.30);
          const extremeDelta = Number(ruleset?.ai?.fightAvoidExtremeDelta ?? 25);
          const willAvoid = suddenDeath ? false : ((avoidInfo.ratio < extremeRatio || delta >= extremeDelta) ? true : (Math.random() < avoidChance));

          if (!willAvoid) {
            addLog(`🔥 [${actor.name}] 불리하지만 [${oppName}]과 교전합니다!`, 'highlight');
          } else {
          const from = String(actor?.zoneId || '');
          const pop = {};
          for (const s of survivorMap.values()) {
            if (!s || Number(s.hp || 0) <= 0) continue;
            if (newDeadIds.includes(s._id)) continue;
            const zid = String(s.zoneId || '');
            if (!zid) continue;
            pop[zid] = (pop[zid] || 0) + 1;
          }

          const depthMax = Math.max(1, Math.floor(Number(ruleset?.ai?.safeSearchDepth ?? 3)));
          const minDelta = Math.max(0, Math.floor(Number(ruleset?.ai?.recoverMinSaferDelta ?? 1)));
          const pick = bfsPickSafestZone(from, zoneGraph, forbiddenIds, pop, { maxDepth: depthMax, minDelta });

          let dest = String(pick?.nextStep || '');

          if (dest && dest !== from) {
            actor.zoneId = dest;
            applyAiRecoveryWindow(actor, phaseStartSec, { reason: 'avoid_power', opponentId: String(targetEval?._id || ''), recoverSec: 6, safeZoneSec: 4 });
            upsertRuntimeSurvivor(survivorMap, actor);
            addLog(`🏃 [${actor.name}] 전투력 열세로 [${oppName}] 교전 회피: ${getZoneName(from)} → ${getZoneName(dest)}`, 'system');
            emitRunEvent('move', { who: String(actor?._id || ''), name: actor?.name, from, to: dest, reason: 'avoid_power' }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
          } else {
            applyAiRecoveryWindow(actor, phaseStartSec, { reason: 'avoid_power_hold', opponentId: String(targetEval?._id || ''), recoverSec: 4 });
            addLog(`🏃 [${actor.name}] 전투력 열세로 [${oppName}] 교전 회피`, 'system');
          }
          continue;
          }
        }
      }

      if (canDual && rand < battleProb2) {
        // [⚔️ 전투]
        let target = pvpTarget;
        if (!target) {
          upsertRuntimeSurvivor(survivorMap, actor);
          continue;
        }

        // 상대방 행동권 사용
        const targetIndex = todaysSurvivors.findIndex((t) => t._id === target._id);
        if (targetIndex > -1) todaysSurvivors.splice(targetIndex, 1);



        // --- 전술 스킬(시즌10) 간이 발동 로직 ---
        // - 상세설정에서 선택한 tacticalSkill 문자열을 기반으로, 도주/추격/교전에 실제 영향 부여
        // - 효과는 관전형 템포에 맞춘 단순 모델(SSOT/AI 안정화 우선)
        const absNow = phaseStartSec;

        // --- 전술 강화 모듈(크레딧 업그레이드) 반영 ---
        // - 인벤에 보유한 '전술 강화 모듈' 수만큼 전술 스킬 쿨다운↓ / 효과↑
        // - 관전형을 위한 단순 모델(최대 5스택)
        const tacModuleLevel = (c) => {
          const mode = String(ruleset?.ai?.tacModuleUpgradeMode || 'level');
          if (mode === 'level') {
            // 전술 스킬 레벨: Lv.1~2 (보정치는 Lv-1)
            const lv = Math.max(1, Math.min(2, Math.floor(Number(c?.tacticalSkillLevel || 1))));
            return lv - 1;
          }
          const inv = Array.isArray(c?.inventory) ? c.inventory : [];
          let n = 0;
          for (const it of inv) {
            const nm = String(it?.name || '').trim();
            const tags = Array.isArray(it?.tags) ? it.tags : [];
            const isModule = nm.includes('전술 강화 모듈') || tags.some((t) => String(t).toLowerCase().includes('tac_skill_module'));
            if (!isModule) continue;
            n += Math.max(0, Number(it?.qty || 1));
          }
          // stack 모드는 호환 유지(보정치 최대 1)
          return Math.max(0, Math.min(1, Math.floor(n)));
        };
        const normalizeTac = (v) => {
          const s = String(v || '').trim();
          if (!s) return '블링크';
          const low = s.toLowerCase();
          if (s.includes('블링크') || low.includes('blink')) return '블링크';
          if (s.includes('치유')) return '치유의 바람';
          if (s.includes('라이트') || s.includes('쉴드') || low.includes('shield')) return '라이트닝 쉴드';
          if (s.includes('스트라이더') || s.includes('A13') || low.includes('strider')) return '스트라이더 A-13';
          if (s.includes('임펄스') || low.includes('impulse')) return '임펄스';
          if (s.includes('퀘이크') || low.includes('quake')) return '퀘이크';
          if (s.includes('프로토콜')) return '프로토콜 위반';
          if (s.includes('붉은 폭풍') || low.includes('electric shift')) return '붉은 폭풍';
          if (s.includes('초월') || low.includes('force field')) return '초월';
          if (s.includes('아티팩트') || low.includes('artifact') || low.includes('totem')) return '아티팩트';
          if (s.includes('무효화') || low.includes('nullification')) return '무효화';
          if (s.includes('강한 결속') || low.includes('strong bond') || low.includes('soul stealer')) return '강한 결속';
          if (s.includes('진실의 칼날') || low.includes('blade of truth')) return '진실의 칼날';
          if (s.includes('거짓 서약') || low.includes('false oath')) return '거짓 서약';
          return s;
        };
        const tacCdSec = (name, who) => {
          // 전술 스킬 쿨다운: 테이블 기반(튜닝 용이)
          const base = getTacBaseCdSec(name);

          const lv = tacModuleLevel(who);
          const mult = Math.max(0.70, 1 - (lv * 0.05)); // 최대 30% 감소
          return Math.max(12, Math.round(base * mult));
        };
        const canUseTac = (c) => (absNow >= Number(c?._tacNextAbsSec || 0));
        const useTac = (c, name) => {
          if (!c) return;
          const n = normalizeTac(name);
          c._tacNextAbsSec = absNow + tacCdSec(n, c);
          c._tacLastUsed = n;
          c._tacLastUsedAt = absNow;
        };
        const pvpCfg = ruleset?.pvp || {};
        const pickSparseSafeNeighbor = (fromZoneId) => {
          const from = String(fromZoneId || '');
          if (!from) return '';
          const neighbors = Array.isArray(zoneGraph?.[from]) ? zoneGraph[from].map((z) => String(z)) : [];
          const safeNeighbors = neighbors.filter((z) => z && !forbiddenIds.has(z));
          if (!safeNeighbors.length) return from;
          const pop = {};
          for (const s of survivorMap.values()) {
            if (!s || Number(s.hp || 0) <= 0) continue;
            if (newDeadIds.includes(s._id)) continue;
            const zid = String(s.zoneId || '');
            if (!zid) continue;
            pop[zid] = (pop[zid] || 0) + 1;
          }
          let dest = from;
          let bestPop = 1e9;
          for (const z of safeNeighbors) {
            const p = Number(pop[z] || 0);
            if (p < bestPop) {
              bestPop = p;
              dest = z;
            }
          }
          return String(dest || from);
        };
        const applyCombatElimination = (winner, loser, opts = {}) => {
          if (!winner || !loser) return { assistId: null };
          const winnerId = String(winner?._id || '');
          const loserId = String(loser?._id || '');
          const prevDamagedBy = String(opts.prevDamagedBy || loser?.lastDamagedBy || '');
          const prevDamagedPhaseIdx = Number(opts.prevDamagedPhaseIdx ?? loser?.lastDamagedPhaseIdx ?? -9999);
          let pushedDead = false;
          if (!newDeadIds.includes(loserId)) {
            loser.deadAtPhaseIdx = phaseIdxNow;
            loser.reviveEligible = phaseIdxNow <= reviveCutoffIdx;
            newDeadIds.push(loserId);
            pushedDead = true;
          }
          roundKills[winnerId] = (roundKills[winnerId] || 0) + 1;
          let assistId = null;
          if (prevDamagedBy && prevDamagedBy !== winnerId && prevDamagedBy !== loserId && (phaseIdxNow - prevDamagedPhaseIdx) <= assistWindowPhases) {
            assistId = prevDamagedBy;
            roundAssists[assistId] = (roundAssists[assistId] || 0) + 1;
          }
          const assistName = assistId ? (survivorMap.get(assistId)?.name || assistId) : '';
          addLog(`☠️ [${winner.name}] ${opts.killText || '처치'}! (+1킬${assistId ? `, 어시: ${assistName}` : ''})`, 'death');
          emitRunEvent('death', { who: loserId, by: winnerId, zoneId: String(loser?.zoneId || winner?.zoneId || actor?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
          if (useDetonation) {
            const bonusSec = Number(ruleset?.detonation?.killBonusSec || 5);
            const baseMax = Number((winner.detonationMaxSec ?? ruleset?.detonation?.maxSec) ?? 30);
            const nextMax = baseMax + bonusSec;
            winner.detonationMaxSec = nextMax;
            const baseCur = Number((winner.detonationSec ?? ruleset?.detonation?.startSec) ?? 20);
            winner.detonationSec = Math.min(nextMax, baseCur + bonusSec);
            addLog(`⏱️ [${winner.name}] 처치 보상: 금지구역 제한시간 +${bonusSec}s`, 'system');
            const killCredit = Number(ruleset?.credits?.kill || 0);
            if (killCredit > 0) {
              earnedCredits += killCredit;
              winner.simCredits = Number(winner.simCredits || 0) + killCredit;
            }
          }
          const lootRate = Number(pvpCfg.lootCreditRate ?? 0.35);
          const lootMin = Number(pvpCfg.lootCreditMin ?? 10);
          const winnerLootBias = Math.max(0, getPerkLootBias(winner));
          const lootUnitsBase = Math.max(0, Math.floor(Number(pvpCfg.lootInventoryUnits ?? 1)));
          const lootUnits = Math.max(0, Math.min(4, lootUnitsBase + (winnerLootBias >= 0.35 ? 1 : 0) + (winnerLootBias >= 0.8 ? 1 : 0)));
          const loserCredits = Math.max(0, Number(loser?.simCredits || 0));
          const stealCreditBase = Math.min(loserCredits, Math.max(lootMin, Math.floor(loserCredits * lootRate)));
          const stealCredit = Math.min(loserCredits, Math.max(lootMin, Math.round(stealCreditBase * (1 + winnerLootBias * 0.5))));
          let lootLines = [];
          const craftLogs = [];
          if (stealCredit > 0) {
            loser.simCredits = loserCredits - stealCredit;
            winner.simCredits = Number(winner.simCredits || 0) + stealCredit;
            lootLines.push(`💰 크레딧 ${stealCredit}`);
            emitRunEvent('gain', { who: winnerId, itemId: 'CREDITS', qty: stealCredit, source: 'pvp', from: loserId, zoneId: String(winner?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
          }
          const lootPick = lootUnits > 0 ? pickUnitsFromInventory(loser?.inventory || [], lootUnits) : [];
          if (lootPick.length) {
            loser.inventory = removePickedUnitsFromInventory(loser?.inventory || [], lootPick);
            pruneEquippedAgainstInventory(loser);
            for (const lp of lootPick) {
              const lootId = String(lp?.itemId || '');
              if (!lootId) continue;
              const lootItem = (Array.isArray(publicItems) ? publicItems : []).find((x) => String(x?._id) === lootId) || null;
              const fallbackName = itemNameById?.[lootId] || '아이템';
              const stub = lootItem || { _id: lootId, name: fallbackName, type: '재료', tags: [] };
              winner.inventory = addItemToInventory(winner.inventory, stub, lootId, 1, nextDay, ruleset);
              const gainMeta = winner.inventory?._lastAdd;
              const got = Math.max(0, Number(gainMeta?.acceptedQty ?? 1));
              if (got > 0) {
                emitRunEvent('gain', { who: winnerId, itemId: lootId, qty: got, source: 'pvp', from: loserId, zoneId: String(winner?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
                lootLines.push(`${itemIcon(stub)} ${stub?.name || fallbackName} x${got}`);
                const crafted = tryAutoCraftFromLoot(winner.inventory, lootId, craftables, itemNameById, itemMetaById, nextDay, ruleset);
                if (crafted?.inventory) {
                  winner.inventory = crafted.inventory;
                  craftLogs.push(crafted.log);
                }
              } else {
                lootLines.push(`${itemIcon(stub)} ${stub?.name || fallbackName} 획득 실패`);
              }
            }
          }
          const invCraft = tryAutoCraftFromInventory(winner, craftables, itemNameById, itemMetaById, nextDay, phaseIdxNow, ruleset);
          if (invCraft?.log) craftLogs.push(invCraft.log);
          autoEquipBest(winner, itemMetaById);
          pruneEquippedAgainstInventory(loser);
          if (lootLines.length) addLog(`🧾 루팅: [${winner.name}] ← [${loser.name}] (${lootLines.join(', ')})`, 'normal');
          if (craftLogs.length) {
            for (const line of craftLogs) addLog(line, 'highlight');
          }
          const maxHp = Number(winner?.maxHp ?? 100);
          const restHealMax = Math.max(0, Math.floor(Number(pvpCfg.restHealMax ?? 8)));
          const restHeal = Math.min(restHealMax, Math.max(0, maxHp - Number(winner.hp || 0)));
          if (restHeal > 0) {
            winner.hp = Math.min(maxHp, Number(winner.hp || 0) + restHeal);
            addLog(`🩹 [${winner.name}] 전투 후 숨고르기: HP +${restHeal}`, 'system');
          }
          tryUseConsumable(winner, 'after_battle');
          const curHp = Number(winner.hp || 0);
          const postRestHpBelow = Math.max(0, Number(pvpCfg.postBattleRestHpBelow ?? 45));
          const postRestExtraHealMax = Math.max(0, Math.floor(Number(pvpCfg.postBattleRestExtraHealMax ?? 6)));
          const postMoveChance = Math.max(0, Math.min(1, Number(pvpCfg.postBattleMoveChance ?? 0.35)));
          if (curHp > 0 && curHp <= postRestHpBelow) {
            const extraHeal = Math.min(postRestExtraHealMax, Math.max(0, maxHp - curHp));
            if (extraHeal > 0) {
              winner.hp = Math.min(maxHp, curHp + extraHeal);
              addLog(`🧘 [${winner.name}] 전투 후 휴식: HP +${extraHeal}`, 'system');
            }
          } else if (Math.random() < postMoveChance) {
            const curZone = String(winner.zoneId || '');
            const nextZone = pickSparseSafeNeighbor(curZone);
            if (nextZone && nextZone !== curZone) {
              winner.zoneId = nextZone;
              addLog(`🚶 [${winner.name}] 전투 후 이동: ${getZoneName(nextZone)}`, 'system');
            }
          }
          if (clearPostCombatEffects(winner)) {
            addLog(`🧼 [${winner.name}] 전투 후 지속 피해 상태 정리`, 'system');
          }
          clearRuntimeCombatFields(winner);
          applyAiRecoveryWindow(winner, phaseStartSec, {
            reason: 'post_combat',
            opponentId: loserId,
            recoverSec: 6,
            safeZoneSec: Number(winner.hp || 0) <= postRestHpBelow ? 5 : 0,
          });
          if (pushedDead) {
            setDead((prev) => [...prev, ...normalizeRuntimeSurvivorList([normalizeDeadSnapshot(loser, ruleset)])]);
          }
          return { assistId };
        };
        const markUnattributedDeath = (victim, reasonText = '접전 중 전투불능') => {
          if (!victim) return;
          const victimId = String(victim?._id || '');
          if (!newDeadIds.includes(victimId)) {
            victim.deadAtPhaseIdx = phaseIdxNow;
            victim.reviveEligible = phaseIdxNow <= reviveCutoffIdx;
            newDeadIds.push(victimId);
            setDead((prev) => [...prev, ...normalizeRuntimeSurvivorList([normalizeDeadSnapshot(victim, ruleset)])]);
          }
          addLog(`☠️ [${victim.name}] ${reasonText}`, 'death');
          emitRunEvent('death', { who: victimId, by: '', zoneId: String(victim?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
        };
        const resolveFleeSequence = (flee, chaser, opts = {}) => {
          const curZone = String(opts.curZone || flee?.zoneId || chaser?.zoneId || '');
          if (!flee || !chaser || !curZone) return null;
          const neighbors = Array.isArray(zoneGraph?.[curZone]) ? zoneGraph[curZone].map((z) => String(z)) : [];
          const safeNeighbors = neighbors.filter((z) => z && !forbiddenIds.has(z));
          if (!safeNeighbors.length) return null;

          const fleeTac = normalizeTac(flee?.tacticalSkill);
          const chaseTac = normalizeTac(chaser?.tacticalSkill);
          const fleeTacTrig = getTacTrigger(fleeTac, 'flee');
          const chaseTacTrig = getTacTrigger(chaseTac, 'chase');
          const fleeLv = tacModuleLevel(flee);
          const chaseLv = tacModuleLevel(chaser);

          if (fleeTac === '블링크' && canUseTac(flee)) {
            const dest = pickSparseSafeNeighbor(curZone);
            flee.zoneId = String(dest || curZone);
            applyAiRecoveryWindow(flee, phaseStartSec, { reason: 'tac_blink_escape', opponentId: String(chaser?._id || ''), recoverSec: 8, safeZoneSec: 6 });
            upsertRuntimeSurvivor(survivorMap, flee);
            useTac(flee, '블링크');
            addLog(`✨ [${flee.name}] 전술 스킬(블링크)로 도주! ${getZoneName(curZone)} → ${getZoneName(flee.zoneId)}`, 'highlight');
            emitRunEvent('move', { who: String(flee?._id || ''), name: flee?.name, from: curZone, to: String(flee.zoneId || ''), reason: 'tac_blink_escape' }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            emitRunEvent('chase', { who: String(flee?._id || ''), whoName: flee?.name, chaserId: String(chaser?._id || ''), chaserName: chaser?.name, zoneId: String(flee.zoneId || curZone), outcome: 'blink_escape', escaped: true, caught: false, tacUsed: '블링크' }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            return { escaped: true, caught: false, dest: String(flee.zoneId || curZone), fleeId: String(flee._id), chaserId: String(chaser._id), tacUsed: '블링크' };
          }
          const healBelowHp = Number(fleeTacTrig?.hpBelow ?? 55);
          if ((opts.allowHeal ?? true) && fleeTac === '치유의 바람' && canUseTac(flee) && Number(flee.hp || 0) > 0 && Number(flee.hp || 0) <= healBelowHp) {
            const maxHp = Number(flee?.maxHp ?? 100);
            const healCap = getTacEffectNumber('치유의 바람', 'healCap', 1 + fleeLv, 22);
            const heal = Math.min(healCap, Math.max(0, maxHp - Number(flee.hp || 0)));
            const regenRecovery = getTacEffectNumber('치유의 바람', 'regenRecovery', 1 + fleeLv, 4);
            const regenDuration = getTacEffectNumber('치유의 바람', 'regenDuration', 1 + fleeLv, 2);
            if (heal > 0 || regenRecovery > 0) {
              if (heal > 0) flee.hp = Math.min(maxHp, Number(flee.hp || 0) + heal);
              useTac(flee, '치유의 바람');
              const tacEffects = applyRuntimeEffectPayloads(flee, buildTacStatusEffects('치유의 바람', 1 + fleeLv, 'tac_healwind'));
              const bits = [];
              if (heal > 0) bits.push(`HP +${heal}`);
              tacEffects.results.forEach((row) => {
                if (row?.reason === 'immune') bits.push(`${String(row?.effect?.name || '효과')} 면역`);
                else if (row?.reason === 'resisted') bits.push(`${String(row?.effect?.name || '효과')} 저항`);
                else if (row?.applied) bits.push(describeRuntimeEffect(row.effect));
              });
              addLog(`🌿 [${flee.name}] 전술 스킬(치유의 바람): ${bits.join(', ')}`, 'system');
              emitRunEvent('skill', { who: String(flee?._id || ''), whoName: flee?.name, skill: '치유의 바람', mode: 'escape_heal', zoneId: String(flee?.zoneId || curZone || ''), heal: heal }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
              emitEffectRunEvents(flee, tacEffects.results, { source: 'tactical', skill: '치유의 바람', reason: 'escape_heal', zoneId: String(flee?.zoneId || curZone || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            }
          }

          const escTacBonus = (fleeTacTrig?.applyBonus === true)
            ? getTacEffectNumber(fleeTac, 'escapeBonus', 1 + fleeLv, 0)
            : 0;
          const chaseTacBonus = (chaseTacTrig?.applyBonus === true)
            ? Math.max(
                getTacEffectNumber(chaseTac, 'escapeBonus', 1 + chaseLv, 0),
                getTacEffectNumber(chaseTac, 'chaseBonus', 1 + chaseLv, 0)
              )
            : 0;
          const fleeMs = getEquipMoveSpeed(flee);
          const chaseMs = getEquipMoveSpeed(chaser);
          const fleeAggro = Math.max(0, getPerkAggressionBias(flee));
          const chaseAggro = Math.max(0, getPerkAggressionBias(chaser));
          const fleeHpRatio = Math.max(0, Math.min(1, Number(flee?.hp || 0) / Math.max(1, Number(flee?.maxHp || 100))));
          const chaseHpRatio = Math.max(0, Math.min(1, Number(chaser?.hp || 0) / Math.max(1, Number(chaser?.maxHp || 100))));
          const fleeShield = Math.max(0, getShieldValue(flee));
          const chaseShield = Math.max(0, getShieldValue(chaser));
          const fleeRegen = Math.max(0, getRegenValue(flee));
          const chaseRegen = Math.max(0, getRegenValue(chaser));
          const escapeBase = Number(ruleset?.ai?.escapeBaseChance ?? 0.22);
          const msScale = Number(ruleset?.ai?.escapeMoveSpeedScale ?? 0.12);
          const pressurePenalty = Number(ruleset?.ai?.escapePressurePenalty ?? 0.28);
          const lowSafePenalty = Number(ruleset?.ai?.escapeLowSafePenalty ?? 0.15);
          const recoveryPenalty = Number(ruleset?.ai?.chaseRecoveryPenalty ?? 0.12);
          const safeCount = Math.max(0, totalZonesCount - forbiddenIds.size);
          const curForbidden = forbiddenIds.has(curZone);
          const powDelta = estimatePower(chaser) - estimatePower(flee);
          const fleeSustain = Math.min(0.14, fleeShield * 0.008 + fleeRegen * 0.02);
          const chaseSustain = Math.min(0.10, chaseShield * 0.006 + chaseRegen * 0.015);
          const chaserRecovering = Number(chaser?._aiRecoverUntilSec || 0) > Number(phaseStartSec || 0);
          let pEscape = escapeBase + (fleeMs - chaseMs) * msScale;
          pEscape += (escTacBonus && canUseTac(flee) && (fleeTacTrig?.applyBonus ?? true)) ? escTacBonus : 0;
          if (curForbidden) pEscape -= 0.18;
          pEscape -= restrictedRatio * pressurePenalty;
          if (safeCount <= 3) pEscape -= lowSafePenalty;
          pEscape -= Math.max(0, Math.min(0.18, powDelta / 120));
          pEscape += Math.max(0, (0.42 - fleeHpRatio)) * 0.18;
          pEscape += fleeSustain;
          pEscape -= fleeAggro * 0.08;
          pEscape -= chaseAggro * 0.04;
          pEscape -= chaserRecovering ? recoveryPenalty * 0.45 : 0;
          pEscape = Math.max(0.05, Math.min(0.9, pEscape));
          const didEscape = (opts.forceAttempt === true) ? true : (Math.random() < pEscape);
          if (!didEscape) {
            emitRunEvent('chase', { who: String(flee?._id || ''), whoName: flee?.name, chaserId: String(chaser?._id || ''), chaserName: chaser?.name, zoneId: String(curZone || ''), outcome: 'escape_fail', escaped: false, caught: true, pEscape: Number(pEscape.toFixed(3)), fleeHpRatio: Number(fleeHpRatio.toFixed(3)), chaseHpRatio: Number(chaseHpRatio.toFixed(3)) }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            return { escaped: false, fleeId: String(flee._id), chaserId: String(chaser._id) };
          }
          if (escTacBonus && canUseTac(flee) && (fleeTacTrig?.useOnCommit ?? true)) {
            useTac(flee, fleeTac);
            addLog(`💨 [${flee.name}] 전술 스킬(${fleeTac})로 도주 보정!`, 'system');
            emitRunEvent('skill', { who: String(flee?._id || ''), whoName: flee?.name, skill: String(fleeTac || ''), mode: 'escape_bonus', zoneId: String(flee?.zoneId || curZone || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
          }

          const dest = pickSparseSafeNeighbor(curZone);
          flee.zoneId = String(dest || curZone);
          applyAiRecoveryWindow(flee, phaseStartSec, { reason: String(opts.moveReason || 'escape'), opponentId: String(chaser?._id || ''), recoverSec: 8, safeZoneSec: 6 });
          upsertRuntimeSurvivor(survivorMap, flee);
          addLog(`🏃 [${flee.name}] ${opts.escapeText || '교전을 피하려 도주'}: ${getZoneName(curZone)} → ${getZoneName(flee.zoneId)}`, 'system');
          emitRunEvent('move', { who: String(flee?._id || ''), name: flee?.name, from: curZone, to: String(flee.zoneId || ''), reason: opts.moveReason || 'escape' }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });

          const chaseBase = Number(ruleset?.ai?.chaseBaseChance ?? 0.25);
          const chaseMsScale = Number(ruleset?.ai?.chaseMoveSpeedScale ?? 0.14);
          let pChase = chaseBase + (chaseMs - fleeMs) * chaseMsScale + restrictedRatio * 0.10 + Math.max(0, Math.min(0.20, powDelta / 80));
          pChase += chaseAggro * 0.10;
          pChase -= fleeAggro * 0.04;
          pChase -= Math.max(0, (0.55 - chaseHpRatio)) * 0.22;
          pChase += chaseSustain * 0.5;
          pChase -= chaserRecovering ? recoveryPenalty : 0;
          pChase += (chaseTacBonus && canUseTac(chaser) && (chaseTacTrig?.applyBonus ?? true)) ? chaseTacBonus : 0;
          pChase = Math.max(0, Math.min(0.95, pChase));
          const willChase = Math.random() < pChase;
          if (willChase && chaseTacBonus && canUseTac(chaser) && (chaseTacTrig?.useOnCommit ?? true)) {
            useTac(chaser, chaseTac);
            addLog(`🧭 [${chaser.name}] 전술 스킬(${chaseTac})로 추격 강화!`, 'system');
            emitRunEvent('skill', { who: String(chaser?._id || ''), whoName: chaser?.name, skill: String(chaseTac || ''), mode: 'chase_bonus', zoneId: String(chaser?.zoneId || curZone || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
          }
          if (!willChase) {
            applyAiRecoveryWindow(chaser, phaseStartSec, { reason: 'lost_track', opponentId: String(flee?._id || ''), recoverSec: 4, retargetZoneId: String(flee.zoneId || curZone), retargetTtl: 1 });
            emitRunEvent('chase', { who: String(flee?._id || ''), whoName: flee?.name, chaserId: String(chaser?._id || ''), chaserName: chaser?.name, zoneId: String(flee.zoneId || curZone), outcome: 'escape_no_chase', escaped: true, caught: false, pEscape: Number(pEscape.toFixed(3)), pChase: Number(pChase.toFixed(3)), fleeHpRatio: Number(fleeHpRatio.toFixed(3)), chaseHpRatio: Number(chaseHpRatio.toFixed(3)) }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            return { escaped: true, caught: false, dest: String(flee.zoneId || curZone), fleeId: String(flee._id), chaserId: String(chaser._id) };
          }

          chaser.zoneId = String(flee.zoneId || curZone);
          applyAiRecoveryWindow(chaser, phaseStartSec, { reason: 'chase', opponentId: String(flee?._id || ''), recoverSec: 4, retargetZoneId: String(flee.zoneId || curZone), retargetTtl: 1 });
          upsertRuntimeSurvivor(survivorMap, chaser);
          addLog(`🏃‍♂️ [${chaser.name}] 추격! → ${getZoneName(chaser.zoneId)}`, 'highlight');
          emitRunEvent('move', { who: String(chaser?._id || ''), name: chaser?.name, from: curZone, to: String(chaser.zoneId || ''), reason: 'chase' }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });

          const catchBase = Number(ruleset?.ai?.catchBaseChance ?? 0.35);
          const catchMsScale = Number(ruleset?.ai?.catchMoveSpeedScale ?? 0.18);
          let pCatch = catchBase + (chaseMs - fleeMs) * catchMsScale + restrictedRatio * 0.12 + Math.max(0, Math.min(0.25, powDelta / 70));
          pCatch += chaseAggro * 0.12;
          pCatch -= fleeAggro * 0.05;
          pCatch -= Math.max(0, (0.5 - chaseHpRatio)) * 0.18;
          pCatch -= Math.min(0.18, fleeShield * 0.01 + fleeRegen * 0.03);
          pCatch += Math.min(0.08, chaseShield * 0.006 + chaseRegen * 0.012);
          pCatch += (chaseTacBonus && canUseTac(chaser)) ? (chaseTacBonus * 0.9) : 0;
          pCatch = Math.max(0.05, Math.min(0.95, pCatch));
          const caught = Math.random() < pCatch;
          if (!caught) {
            addLog(`💨 [${flee.name}] 간신히 따돌렸습니다.`, 'system');
            emitRunEvent('chase', { who: String(flee?._id || ''), whoName: flee?.name, chaserId: String(chaser?._id || ''), chaserName: chaser?.name, zoneId: String(flee.zoneId || curZone), outcome: 'escaped_after_chase', escaped: true, caught: false, pEscape: Number(pEscape.toFixed(3)), pChase: Number(pChase.toFixed(3)), pCatch: Number(pCatch.toFixed(3)) }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            return { escaped: true, caught: false, dest: String(flee.zoneId || curZone), fleeId: String(flee._id), chaserId: String(chaser._id) };
          }

          const sustainMitigation = Math.min(5, Math.round(fleeShield * 0.12 + fleeRegen * 0.8));
          const finishBias = chaseHpRatio >= 0.7 ? 1 : 0;
          const pre = Math.min(13, Math.max(3, Math.round(4 + (chaseMs - fleeMs) * 6 + Math.max(0, powDelta) / 80 + finishBias - sustainMitigation)));
          flee.hp = Math.max(0, Number(flee.hp || 0) - pre);
          upsertRuntimeSurvivor(survivorMap, flee);
          addLog(`⚡ 추격전! [${chaser.name}]이(가) [${flee.name}]을(를) 따라잡아 기습합니다. (피해 -${pre})`, 'highlight');
          emitRunEvent('chase', { who: String(flee?._id || ''), whoName: flee?.name, chaserId: String(chaser?._id || ''), chaserName: chaser?.name, zoneId: String(flee.zoneId || curZone), outcome: 'caught', escaped: true, caught: true, preDamage: pre, fatal: Number(flee.hp || 0) <= 0, pEscape: Number(pEscape.toFixed(3)), pChase: Number(pChase.toFixed(3)), pCatch: Number(pCatch.toFixed(3)) }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
          return { escaped: true, caught: true, dest: String(flee.zoneId || curZone), preDamage: pre, fatal: Number(flee.hp || 0) <= 0, fleeId: String(flee._id), chaserId: String(chaser._id) };
        };
        // 🏃 추격·도주(1단계): 이속/HP/장비차 + 제한구역 압박 기반(관전형 템포)
        const escapeOutcome = (() => {
          const curZone = String(actor?.zoneId || target?.zoneId || '');
          if (!curZone) return null;

          const hpBelow = Number(ruleset?.ai?.escapeHpBelow ?? 42);
          const aAvoid = shouldAvoidCombatByPower(actor, target);
          const bAvoid = shouldAvoidCombatByPower(target, actor);
          const aWants = (Number(actor.hp || 0) > 0 && Number(actor.hp || 0) <= hpBelow) || !!aAvoid;
          const bWants = (Number(target.hp || 0) > 0 && Number(target.hp || 0) <= hpBelow) || !!bAvoid;
          if (!aWants && !bWants) return null;

          let flee = null;
          let chaser = null;
          if (aWants && !bWants) { flee = actor; chaser = target; }
          else if (!aWants && bWants) { flee = target; chaser = actor; }
          else {
            const ahp = Number(actor.hp || 0);
            const bhp = Number(target.hp || 0);
            if (ahp != bhp) flee = (ahp < bhp) ? actor : target;
            else {
              const ar = aAvoid ? Number(aAvoid.ratio || 0.5) : 0.5;
              const br = bAvoid ? Number(bAvoid.ratio || 0.5) : 0.5;
              flee = (ar < br) ? actor : target;
            }
            chaser = (flee === actor) ? target : actor;
          }
          return resolveFleeSequence(flee, chaser, { curZone });
        })();

        // 도주 성공 & 미포획이면 전투 없이 종료(둘 다 행동권 소모)
        if (escapeOutcome && escapeOutcome.escaped && !escapeOutcome.caught) {
          actor = survivorMap.get(actor._id) || actor;
          target = survivorMap.get(target._id) || target;
          continue;
        }

        // 도주 중 포획(기습)으로 HP 0이면 즉시 사망 처리
        if (escapeOutcome && escapeOutcome.escaped && escapeOutcome.caught) {
          const fleeNow = survivorMap.get(escapeOutcome.fleeId);
          const chaserNow = survivorMap.get(escapeOutcome.chaserId);
          if (fleeNow && Number(fleeNow.hp || 0) <= 0 && chaserNow) {
            applyCombatElimination(chaserNow, fleeNow, { killText: '추격 제압' });
            continue;
          }
        }

        // 추격전 이후 최신 상태(존/HP)로 전투 진행
        actor = survivorMap.get(actor._id) || actor;
        target = survivorMap.get(target._id) || target;

	        const actorBattleName = canonicalizeCharName(actor.name);
        const targetBattleName = canonicalizeCharName(target.name);
        const battleResult = pickUnbiasedBattle(
          { ...actor, name: actorBattleName },
          { ...target, name: targetBattleName }
        );
        let battleLog = battleResult.log || '';
        if (actorBattleName && actorBattleName !== actor.name) {
          battleLog = battleLog.split(actorBattleName).join(actor.name);
        }
        if (targetBattleName && targetBattleName !== target.name) {
          battleLog = battleLog.split(targetBattleName).join(target.name);
        }
        // 누적 HP 기반 교전: 즉사 대신 피해/반격을 누적(HP 0일 때만 사망)
        if (battleResult.winner) {
          const actorIdStr = String(actor._id);
          const winnerIdStr = String(battleResult.winner._id);
          const winner = winnerIdStr === actorIdStr ? actor : target;
          const loser = winnerIdStr === actorIdStr ? target : actor;
          const winnerId = String(battleResult.winner._id);

          const prevDamagedBy = String(loser?.lastDamagedBy || '');
          const prevDamagedPhaseIdx = Number(loser?.lastDamagedPhaseIdx ?? -9999);

          const wp = combatScore(winner);
          const lp = combatScore(loser);
          const ratio = wp / Math.max(1, wp + lp);
          const base = 18 + nextDay * 3;
          const dmgToLoser = Math.min(92, Math.max(16, Math.round(base + ratio * 34)));
          const dmgToWinner = Math.min(32, Math.max(0, Math.round(7 + (1 - ratio) * 14)));


          const applyCombatTacAttack = (attacker, defender, baseDmg) => {
            const tac = normalizeTac(attacker?.tacticalSkill);
            const trig = getTacTrigger(tac, 'combat');
            const lv = tacModuleLevel(attacker);
            const hp = Number(attacker?.hp || 0);
            const maxHp = Math.max(1, Number(attacker?.maxHp || 100));
            if (!trig || !canUseTac(attacker)) return Math.max(0, Math.floor(Number(baseDmg || 0)));
            if (Number(trig?.hpBelow || 999) < 999 && hp > Number(trig?.hpBelow || 999)) return Math.max(0, Math.floor(Number(baseDmg || 0)));
            let dmg = Math.max(0, Math.floor(Number(baseDmg || 0)));
            const flat = getTacEffectNumber(tac, 'openerFlatDmg', 1 + lv, 0);
            const heal = getTacEffectNumber(tac, 'selfHeal', 1 + lv, 0);
            const cost = getTacEffectNumber(tac, 'selfCost', 1 + lv, 0);
            const regenRecovery = getTacEffectNumber(tac, 'regenRecovery', 1 + lv, 0);
            const regenDuration = getTacEffectNumber(tac, 'regenDuration', 1 + lv, 2);
            if (cost > 0 && hp <= Math.max(12, cost + 2)) return dmg;
            useTac(attacker, tac);
            if (cost > 0) attacker.hp = Math.max(1, hp - cost);
            if (heal > 0) attacker.hp = Math.min(maxHp, Number(attacker.hp || hp) + heal);
            const tacEffects = applyRuntimeEffectPayloads(attacker, buildTacStatusEffects(tac, 1 + lv, `tac_${String(tac || '').replace(/\s+/g, '_')}`));
            dmg += flat;
            if (flat > 0 || heal > 0 || cost > 0 || regenRecovery > 0 || tacEffects.results.length > 0) {
              const bits = [];
              if (flat > 0) bits.push(`추가 피해 +${flat}`);
              if (heal > 0) bits.push(`HP +${heal}`);
              if (cost > 0) bits.push(`HP -${cost}`);
              tacEffects.results.forEach((row) => {
                if (row?.reason === 'immune') bits.push(`${String(row?.effect?.name || '효과')} 면역`);
                else if (row?.reason === 'resisted') bits.push(`${String(row?.effect?.name || '효과')} 저항`);
                else if (row?.applied) bits.push(describeRuntimeEffect(row.effect));
              });
              addLog(`🧠 [${attacker.name}] 전술 스킬(${tac}): ${bits.join(', ')}`, 'highlight');
            }
            emitRunEvent('skill', { who: String(attacker?._id || ''), whoName: attacker?.name, skill: String(tac || ''), mode: 'combat_attack', zoneId: String(attacker?.zoneId || defender?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            emitEffectRunEvents(attacker, tacEffects.results, { source: 'tactical', skill: String(tac || ''), reason: 'combat_attack', zoneId: String(attacker?.zoneId || defender?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            return Math.max(0, dmg);
          };
          const shieldBlock = (defender, rawDmg) => {
            let dmg = Math.max(0, Number(rawDmg || 0));
            if (dmg <= 0) return dmg;

            const preShield = consumeShieldDamage(defender, dmg);
            if (preShield.absorbed > 0) {
              addLog(`🛡️ [${defender.name}] 보호막: 피해 -${preShield.absorbed}`, 'system');
              dmg = Math.max(0, Number(preShield.damage || 0));
              if (dmg <= 0) return 0;
            }

            const tac = normalizeTac(defender?.tacticalSkill);
            const defenseTac = ['라이트닝 쉴드', '초월', '아티팩트', '무효화'];
            if (!defenseTac.includes(tac)) return dmg;
            if (!canUseTac(defender)) return dmg;
            const tcfg = getTacTrigger(tac, 'combatDefense');
            const minDmg = Math.max(0, Number(tcfg?.minIncomingDmg ?? 0));
            if (minDmg > 0 && dmg < minDmg) return dmg;
            const lv = tacModuleLevel(defender);
            const negateLethal = getTacEffectNumber(tac, 'negateLethal', 1 + lv, 0) > 0;
            if (negateLethal && dmg >= Number(defender?.hp || 0)) {
              useTac(defender, tac);
              addLog(`🗿 [${defender.name}] 전술 스킬(${tac}): 치명타격 무효`, 'highlight');
              return Math.max(0, Number(defender?.hp || 0) - 1);
            }
            const blockCap = getTacEffectNumber(tac, 'block', 1 + lv, tac === '라이트닝 쉴드' ? 14 : 0);
            const shieldValue = getTacEffectNumber(tac, 'shieldValue', 1 + lv, blockCap);
            const shieldDuration = getTacEffectNumber(tac, 'shieldDuration', 1 + lv, 2);
            if (blockCap <= 0 && shieldValue <= 0) return dmg;
            useTac(defender, tac);
            const tacEffects = applyRuntimeEffectPayloads(defender, buildTacStatusEffects(tac, 1 + lv, `tac_${String(tac || '').replace(/\s+/g, '_')}`));
            const blocked = consumeShieldDamage(defender, dmg);
            const block = Math.max(0, Number(blocked?.absorbed || 0));
            if (block > 0 || tacEffects.results.length > 0) {
              const bits = [];
              tacEffects.results.forEach((row) => {
                if (row?.reason === 'immune') bits.push(`${String(row?.effect?.name || '효과')} 면역`);
                else if (row?.reason === 'resisted') bits.push(`${String(row?.effect?.name || '효과')} 저항`);
                else if (row?.applied) bits.push(describeRuntimeEffect(row.effect));
              });
              if (block > 0) bits.push(`피해 -${block}`);
              addLog(`⚡ [${defender.name}] 전술 스킬(${tac}): ${bits.join(', ')}`, 'highlight');
            }
            emitRunEvent('skill', { who: String(defender?._id || ''), whoName: defender?.name, skill: String(tac || ''), mode: 'combat_defense', zoneId: String(defender?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            emitEffectRunEvents(defender, tacEffects.results, { source: 'tactical', skill: String(tac || ''), reason: 'combat_defense', zoneId: String(defender?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            return Math.max(0, Number(blocked?.damage || dmg));
          };

          const atkDmgToLoser = applyCombatTacAttack(winner, loser, dmgToLoser);
          const atkDmgToWinner = applyCombatTacAttack(loser, winner, dmgToWinner);
          const finalDmgToLoser = shieldBlock(loser, atkDmgToLoser);
          const finalDmgToWinner = shieldBlock(winner, atkDmgToWinner);

          loser.hp = Math.max(0, Number(loser.hp || 0) - finalDmgToLoser);
          winner.hp = Math.max(0, Number(winner.hp || 0) - finalDmgToWinner);


          const lethal = loser.hp <= 0;
          if (!lethal) {
            battleLog = softenNonLethalBattleLog(battleLog);
          }


          // 최근 피해 기여자 기록(어시스트 판정용)
          if (dmgToWinner > 0) {
            winner.lastDamagedBy = String(loser._id);
            winner.lastDamagedPhaseIdx = phaseIdxNow;
          }
          if (!lethal && dmgToLoser > 0) {
            loser.lastDamagedBy = String(winnerId);
            loser.lastDamagedPhaseIdx = phaseIdxNow;
          }
          addLog(battleLog, lethal ? 'death' : 'normal');
          addLog(`🩸 피해: [${winner.name}]↘[${loser.name}] -${finalDmgToLoser} (반격 -${finalDmgToWinner})`, 'highlight');

          let postCombatFlee = null;
          if (!lethal && Number(loser.hp || 0) > 0 && Number(loser.hp || 0) <= 18 && Math.random() < 0.78) {
            postCombatFlee = resolveFleeSequence(loser, winner, { curZone: String(loser.zoneId || winner.zoneId || ''), forceAttempt: true, escapeText: '빈사 도주', moveReason: 'critical_flee' });
          }

          // 🧾 전투 이벤트(미니맵 핑/집계용)
          emitRunEvent(
            'battle',
            {
              a: String(actor?._id || ''),
              b: String(target?._id || ''),
              winner: (lethal || (postCombatFlee?.fatal === true)) ? String(winner?._id || '') : '',
              lethal: !!lethal || (postCombatFlee?.fatal === true),
              zoneId: String(actor?.zoneId || target?.zoneId || ''),
            },
            { day: nextDay, phase: nextPhase, sec: phaseStartSec }
          );

          // 출혈 판정(피격 시)
          tryApplyBleed(loser, winner, finalDmgToLoser);
          if (finalDmgToWinner > 0) tryApplyBleed(winner, loser, finalDmgToWinner);

          if (postCombatFlee?.fatal === true) {
            applyCombatElimination(winner, loser, { prevDamagedBy, prevDamagedPhaseIdx, killText: '빈사 추격 제압' });
          } else if (lethal) {
            applyCombatElimination(winner, loser, { prevDamagedBy, prevDamagedPhaseIdx, killText: '처치' });
          }
        } else {
          const scratch = Math.min(12, 5 + Math.floor(nextDay / 2));
          actor.hp = Math.max(0, Number(actor.hp || 0) - scratch);
          target.hp = Math.max(0, Number(target.hp || 0) - scratch);
          if (scratch > 0) {
            actor.lastDamagedBy = String(target._id);
            actor.lastDamagedPhaseIdx = phaseIdxNow;
            target.lastDamagedBy = String(actor._id);
            target.lastDamagedPhaseIdx = phaseIdxNow;
          }
          addLog(battleLog, 'normal');
          addLog(`⚔️ 접전 피해: [${actor.name}] / [${target.name}] 둘 다 -${scratch}`, 'normal');

          emitRunEvent(
            'battle',
            {
              a: String(actor?._id || ''),
              b: String(target?._id || ''),
              winner: '',
              lethal: false,
              zoneId: String(actor?.zoneId || target?.zoneId || ''),
            },
            { day: nextDay, phase: nextPhase, sec: phaseStartSec }
          );
          // 출혈 판정(접전)
          tryApplyBleed(actor, target, scratch);
          tryApplyBleed(target, actor, scratch);
          if (actor.hp <= 0) markUnattributedDeath(actor, '접전 끝에 쓰러짐');
          if (target.hp <= 0) markUnattributedDeath(target, '접전 끝에 쓰러짐');
        }

      } else if (canDual && rand < eventProb) {
        // [🤝 2인 이벤트]
        const targetSeed = potentialTargets[0];
        const target = targetSeed?._id ? survivorMap.get(String(targetSeed._id)) : null;
        if (!target || Number(target.hp || 0) <= 0) {
          upsertRuntimeSurvivor(survivorMap, actor);
          continue;
        }
        const targetIndex = todaysSurvivors.findIndex((t) => String(t?._id || '') === String(target._id));
        if (targetIndex > -1) todaysSurvivors.splice(targetIndex, 1);

        const timeKey = nextPhase === 'night' ? 'night' : 'day';

        // ✅ (로드맵 6-4 + 2번 연동) 시간대/맵 조건을 우선 적용
        let availableEvents = (Array.isArray(events) ? events : []).filter((e) => {
          if (!e || !isEnabledScenarioEvent(e)) return false;
          if (String(e.type || 'normal') === 'death') return false;

          const sc = Number(e.survivorCount ?? (String(e.text || '').includes('{2}') ? 2 : 1));
          const vc = Number(e.victimCount ?? 0);
          if (sc !== 2 || vc !== 0) return false;

          const tod = getScenarioEventTimeOfDay(e);
          if (tod !== 'both' && tod !== timeKey) return false;

          // mapId가 비어있으면 "어느 맵에서든" 발생 가능, 값이 있으면 현재 선택 맵과 일치해야 함
          if (activeMapId && e.mapId && String(e.mapId) !== String(activeMapId)) return false;

          // zoneId가 있으면, 현재 캐릭터의 구역과 일치해야 발생
          if (e.zoneId && String(e.zoneId) !== String(actor?.zoneId || '')) return false;
          return true;
        });

        // 구버전 이벤트(텍스트 기반) 호환
        if (availableEvents.length === 0) {
          availableEvents = (Array.isArray(events) ? events : []).filter((e) => {
            if (!e?.text || !isEnabledScenarioEvent(e)) return false;
            if (String(e.type || 'normal') === 'death') return false;
            if (!String(e.text).includes('{2}')) return false;
            const tod = getScenarioEventTimeOfDay(e);
            if (tod !== 'both' && tod !== timeKey) return false;
            if (activeMapId && e.mapId && String(e.mapId) !== String(activeMapId)) return false;
	            if (e.zoneId && String(e.zoneId) !== String(actor?.zoneId || '')) return false;
            return true;
          });
        }

        const randomEvent = availableEvents.length
          ? availableEvents[Math.floor(Math.random() * availableEvents.length)]
          : null;

        if (!randomEvent?.text) {
          // (유저용 로그 아님) 조우했지만 이벤트가 없을 때는 조용히 스킵
          upsertRuntimeSurvivor(survivorMap, actor);
          upsertRuntimeSurvivor(survivorMap, target);
          continue;
        }
        const eventText = String(randomEvent.text)
          .replace(/\{1\}/g, `[${actor.name}]`)
          .replace(/\{2\}/g, `[${target.name}]`);
        addLog(eventText, 'normal');
      } else {
        // [🌳 1인 이벤트]
        const timeKey = nextPhase === 'night' ? 'night' : 'day';
        let soloEvents = (Array.isArray(events) ? events : []).filter((e) => {
          if (!e || !isEnabledScenarioEvent(e)) return false;
          if (String(e.type || 'normal') === 'death') return false;

          const sc = Number(e.survivorCount ?? 1);
          const vc = Number(e.victimCount ?? 0);
          if (sc !== 1 || vc !== 0) return false;

          const tod = getScenarioEventTimeOfDay(e);
          if (tod !== 'both' && tod !== timeKey) return false;

          if (activeMapId && e.mapId && String(e.mapId) !== String(activeMapId)) return false;
	          if (e.zoneId && String(e.zoneId) !== String(actor?.zoneId || '')) return false;
          return true;
        });

        // 구버전 이벤트(텍스트 기반) 호환: {2} 없는 이벤트를 1인 이벤트로 취급
        if (soloEvents.length === 0) {
          soloEvents = (Array.isArray(events) ? events : []).filter((e) => {
            if (!e?.text || !isEnabledScenarioEvent(e)) return false;
            if (String(e.type || 'normal') === 'death') return false;
            if (String(e.text).includes('{2}')) return false;
            const tod = getScenarioEventTimeOfDay(e);
            if (tod !== 'both' && tod !== timeKey) return false;
            if (activeMapId && e.mapId && String(e.mapId) !== String(activeMapId)) return false;
	            if (e.zoneId && String(e.zoneId) !== String(actor?.zoneId || '')) return false;
            return true;
          });
        }

        const scriptSoloChance = Math.max(0, Math.min(1, Number((pvpProbCfg && pvpProbCfg.scriptSoloChance) != null ? pvpProbCfg.scriptSoloChance : 0.22)));
        if (soloEvents.length > 0 && Math.random() < scriptSoloChance) {
          const randomEvent = soloEvents[Math.floor(Math.random() * soloEvents.length)];
          const eventText = String(randomEvent.text)
            .replace(/\{1\}/g, `[${actor.name}]`)
            .replace(/\{2\}/g, `[${actor.name}]`);
          addLog(eventText, 'normal');
        } else {
          // 폴백: 동적 이벤트 생성
          const eventResult = safeGenerateDynamicEvent(actor, nextDay, ruleset, nextPhase, publicItems);
          if (eventResult && eventResult.log && !eventResult.silent) {
            addLog(eventResult.log, Number(eventResult?.damage || 0) > 0 ? 'highlight' : 'normal');
          }

          // ✅ 동적 이벤트 보상: 크레딧
          const perkFx = getActorPerkEffects(actor);
          const erCr = applyPerkCreditBonus(Math.max(0, Number(eventResult?.earnedCredits || 0)), perkFx?.eventCreditsPct || 0);
          if (erCr > 0) {
            earnedCredits += erCr;
            actor.simCredits = Number(actor.simCredits || 0) + erCr;
            emitRunEvent('gain', { who: String(actor && actor._id ? actor._id : ''), itemId: 'CREDITS', qty: erCr, source: 'event', zoneId: String(actor && actor.zoneId ? actor.zoneId : '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
          }

          // ✅ 수집/사냥 이벤트 페널티: (1) 다음 페이즈 1회 교전 확률 증가 (2) 같은 페이즈 즉시 '표적 우선'
          const pb = Math.max(0, Number(eventResult?.pvpBonusNext || 0));
          if (pb > 0) {
            // 다음 페이즈: 공격(initiator) 확률 보너스
            actor._gatherPvpBonus = Math.max(Number(actor._gatherPvpBonus || 0), pb);
            actor._gatherPvpBonusUntilPhaseIdx = phaseIdxNow + 1;

            // 같은 페이즈: 수집 직후 노출(타겟 우선)
            actor._immediateDanger = Math.max(Number(actor._immediateDanger || 0), pb);
            actor._immediateDangerUntilPhaseIdx = phaseIdxNow;
          }

          // ✅ 동적 이벤트 드랍(소량): addItemToInventory로 일관 처리 + 즉시 1회 조합 시도
          // - 기존(레거시) eventResult.newItem / eventResult.drop도 같이 호환
          const legacyNewItem = eventResult && eventResult.newItem ? eventResult.newItem : null;
          const rawEventDrops = [
            ...(Array.isArray(eventResult?.drops) ? eventResult.drops : []),
            ...(eventResult?.drop ? [eventResult.drop] : []),
            ...(legacyNewItem ? [{ item: (legacyNewItem.item || legacyNewItem), itemId: (legacyNewItem.itemId || legacyNewItem.id || legacyNewItem._id || ''), qty: (legacyNewItem.qty || 1) }] : []),
          ];
          const normalizedEventDrops = normalizeRewardDropEntries(rawEventDrops, publicItems, itemNameById);

          for (const resolvedDrop of normalizedEventDrops) {
            const dropId = String(resolvedDrop.itemId || '');
            if (!dropId) continue;
            const eventItemBias = getPerkEventItemBias(perkFx);
            const dropQty = maybeBoostDropQty(Math.max(1, Number(resolvedDrop.qty || 1)), eventItemBias * 0.55, 1);
            const dropItem = resolvedDrop.item || null;

            actor.inventory = addItemToInventory(actor.inventory, dropItem, dropId, dropQty, nextDay, ruleset);
            const metaD = actor.inventory && actor.inventory._lastAdd ? actor.inventory._lastAdd : null;
            const gotD = Math.max(0, Number(metaD && metaD.acceptedQty != null ? metaD.acceptedQty : dropQty));
            if (gotD > 0) {
              const nmD = itemDisplayName(dropItem || { _id: dropId, name: itemNameById?.[dropId] || resolvedDrop?.name });
              addLog("🧾 [" + actor.name + "] 획득: " + itemIcon(dropItem || { type: "" }) + " [" + nmD + "] x" + gotD + formatInvAddNote(metaD, dropQty, actor.inventory, ruleset), "normal");
              emitRunEvent("gain", { who: String(actor && actor._id ? actor._id : ""), itemId: dropId, qty: gotD, source: "event", zoneId: String(actor && actor.zoneId ? actor.zoneId : "") }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });

              const craftedE = tryAutoCraftFromLoot(actor.inventory, dropId, craftables, itemNameById, itemMetaById, nextDay, ruleset);
              if (craftedE) {
                actor.inventory = craftedE.inventory;
                addLog("[" + actor.name + "] " + craftedE.log, "normal");
                emitCraftRunEvent(actor?._id, craftedE, { day: nextDay, phase: nextPhase, sec: phaseStartSec }, actor?.zoneId);
              }
            }
          }

          if (eventResult.damage) actor.hp -= eventResult.damage;
          if (eventResult.recovery) {
            const maxHpNow = Math.max(1, Number(actor?.maxHp || 100));
            const bonusRecovery = Math.max(0, perkNumber(perkFx?.eventRecoveryPlus || 0));
            actor.hp = Math.min(maxHpNow, Number(actor.hp || 0) + Math.max(0, Number(eventResult.recovery || 0)) + bonusRecovery);
          }
          const eventEffects = applyRuntimeEffectPayloads(actor, eventResult?.newEffects || eventResult?.newEffect);
          eventEffects.results.forEach((row) => {
            if (row?.reason === 'immune') addLog(`🛡️ [${actor.name}] ${String(row?.effect?.name || '효과')} 면역`, 'system');
            else if (row?.reason === 'resisted') addLog(`🧷 [${actor.name}] ${String(row?.effect?.name || '효과')} 저항`, 'system');
            else if (row?.applied) addLog(`🪄 [${actor.name}] ${describeRuntimeEffect(row.effect)}`, 'system');
          });
          emitEffectRunEvents(actor, eventEffects.results, { source: 'event', reason: 'dynamic_event', zoneId: String(actor?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
        }

        actor = normalizeRuntimeSurvivor(actor);
        if (actor.hp <= 0) {
          addLog(`💀 [${actor.name}]이(가) 사고로 사망했습니다.`, 'death');
          newDeadIds.push(actor._id);
          setDead((prev) => [...prev, ...normalizeRuntimeSurvivorList([normalizeDeadSnapshot(actor, ruleset)])]);
        }
      }

      upsertRuntimeSurvivor(survivorMap, actor);
    }

    // 4. 킬 카운트 업데이트
    const updatedKillCounts = { ...killCounts };
    Object.keys(roundKills).forEach((killerId) => {
      updatedKillCounts[killerId] = (updatedKillCounts[killerId] || 0) + roundKills[killerId];
    });
    setKillCounts(updatedKillCounts);

    const updatedAssistCounts = { ...assistCounts };
    Object.keys(roundAssists).forEach((aid) => {
      updatedAssistCounts[aid] = (updatedAssistCounts[aid] || 0) + (roundAssists[aid] || 0);
    });
    setAssistCounts(updatedAssistCounts);

    // 5. 생존자 업데이트
    const finalStepSurvivors = Array.from(survivorMap.values())
      .filter((s) => !newDeadIds.includes(s?._id))
      .map((s) => normalizeRuntimeSurvivor(s));

    // 💳 크레딧은 화면에 직접 띄우지 않고, 캐릭터별(simCredits)로만 누적 표시합니다.
    // - baseCredits(페이즈 기본)는 생존자에게 분배(합계=baseCredits)
    if (baseCredits > 0 && finalStepSurvivors.length > 0) {
      const aliveCount = finalStepSurvivors.length;
      const share = Math.floor(baseCredits / aliveCount);
      let rem = baseCredits - share * aliveCount;
      finalStepSurvivors.forEach((s) => {
        const add = share + (rem > 0 ? 1 : 0);
        if (rem > 0) rem -= 1;
        s.simCredits = Number(s.simCredits || 0) + add;
      });
    }

    // ✅ 시뮬에서 생성된 랜덤 장비를 DB에 저장(관리자 아이템 목록에서 확인 가능)
    // - 저장 실패(토큰 만료/서버 다운)해도 시뮬 진행은 계속
    // NOTE: off-map 생존자(관전/퇴장) 분기는 아직 미사용이므로 finalStepSurvivors만 저장한다.
    persistSimEquipmentsFromChars(
      (Array.isArray(finalStepSurvivors) ? finalStepSurvivors : []),
      `phase:d${nextDay}_${nextPhase}`
    ).catch(() => {});


    // SD 서든데스: 카운트다운 종료 시 강제 결판(최후 1인)
    const sdEndAt = suddenDeathEndAtSecRef.current;
    const sdRemainAfter = (suddenDeathActiveRef.current && typeof sdEndAt === 'number')
      ? Math.ceil(sdEndAt - (matchSec + phaseDurationSec))
      : null;
    if (suddenDeathActiveRef.current && typeof sdEndAt === 'number' && sdRemainAfter <= 0 && finalStepSurvivors.length > 1) {
      const sorted = [...finalStepSurvivors].sort((a, b) => Number(b.hp || 0) - Number(a.hp || 0));
      const topHp = Number(sorted[0]?.hp || 0);
      const topList = sorted.filter((s) => Number(s.hp || 0) === topHp);
      const wForced = topList[Math.floor(Math.random() * topList.length)];
      const forcedDead = finalStepSurvivors
        .filter((s) => String(s._id) !== String(wForced._id))
        .map((s) => ({ ...s, hp: 0 }));
      if (forcedDead.length) setDead((prev) => [...prev, ...normalizeRuntimeSurvivorList(forcedDead.map((x) => normalizeDeadSnapshot(x, ruleset)))]);
      setSurvivors([normalizeRuntimeSurvivor(wForced)]);
      setMatchSec((prev) => prev + phaseDurationSec);
      addLog(`⏱ 서든데스 종료! 제한시간 만료로 [${wForced.name}] 승리`, 'highlight');
      finishGame([wForced], updatedKillCounts, updatedAssistCounts);
      return;
    }

    // NOTE: offMapSurvivors는 아직 정의/사용하지 않으므로, 렌더는 최종 생존자만 반영
    setSurvivors((Array.isArray(finalStepSurvivors) ? finalStepSurvivors : []).map((s) => normalizeRuntimeSurvivor(s)));

    // 월드 스폰 상태 반영(상자 개봉/보스 처치 등)
    setSpawnState(nextSpawn);

    // 5.5) 경기 시간 진행(초)
    setMatchSec((prev) => prev + phaseDurationSec);

    // 5.6) 크레딧 적립(페이즈 보상 + 처치 보상 등)
    if (earnedCredits > 0) {
      apiPost('/credits/earn', { amount: earnedCredits })
        .then((res) => {
          applyUserEconomyProgress({ credits: res?.credits });
        })
        .catch(() => {});
    }

    if (finalStepSurvivors.length <= 1) {
      finishGame(finalStepSurvivors, updatedKillCounts, updatedAssistCounts);
    }
  };

  // 🔄 서버 맵 설정 새로고침(관리자에서 수정한 crateAllowDeny 등 즉시 반영용)
  async function refreshMapSettingsFromServer(reason = 'manual') {
    if (isRefreshingMapsRef.current) return false;
    isRefreshingMapsRef.current = true;
    setIsRefreshingMapSettings(true);
    try {
      const mapsRes = await apiGet('/public/maps');
      const mapsList = Array.isArray(mapsRes) ? mapsRes : [];
      if (!mapsList.length) {
        addLog('⚠️ 맵 설정 새로고침 실패(맵 목록 없음)', 'death');
        showMapRefreshToast('맵 목록이 없습니다.', 'error');
        return false;
      }

      mapsRef.current = mapsList;
      setMaps(mapsList);

      const keepId = String(activeMapIdRef.current || activeMapId || '');
      const nextId = (keepId && mapsList.some((m) => String(m?._id) === keepId))
        ? keepId
        : String(mapsList[0]?._id || '');

      if (nextId) {
        activeMapIdRef.current = nextId;
        setActiveMapId(nextId);
        activeMapRef.current = mapsList.find((m) => String(m?._id) === nextId) || null;
      }

      addLog(reason === 'start' ? '🔄 맵 설정을 서버에서 새로 불러왔습니다.' : '🔄 맵 설정을 새로고침했습니다.', 'system');
      showMapRefreshToast(reason === 'start' ? '서버에서 새로 불러옴' : '새로고침 완료', 'ok');
      return true;
    } catch (e) {
      addLog('⚠️ 맵 설정 새로고침 실패(기존 설정 유지)', 'death');
      showMapRefreshToast('새로고침 실패(기존 유지)', 'error');
      return false;
    } finally {
      isRefreshingMapsRef.current = false;
      setIsRefreshingMapSettings(false);
    }
  };

  // 진행 버튼/오토 플레이 공용 가드(중복 호출 방지)
  async function proceedPhaseGuarded() {
    if (isAdvancingRef.current) return;
    if (loading) return;
    if (isGameOver) return;
    if (day === 0 && survivors.length < 2) return;
if (showMarketPanel && pendingTranscendPick) {
      addLog('🎁 초월 장비 선택 상자: 먼저 선택을 완료하세요.', 'system');
      return;
    }

    isAdvancingRef.current = true;
    setIsAdvancing(true);
    try {
      // ✅ "게임 시작" 순간(0일차 첫 진행)에는 맵 설정을 서버에서 강제 새로고침하여,
      //    Admin에서 수정한 crateAllowDeny 등이 즉시 반영되게 합니다.
      if (day === 0 && matchSec === 0) {
        await refreshMapSettingsFromServer('start');
      }

      // 🧾 런 시작(시드 재현): "첫 진행" 순간에만 1회 기록
      if (day === 0 && matchSec === 0) {
        setRunEvents([{ kind: 'run_start', at: { day, phase, sec: matchSec }, seed: runSeed }]);
      }
      await proceedPhase();
    } finally {
      isAdvancingRef.current = false;
      setIsAdvancing(false);
    }
  };

  // 오토 플레이가 항상 최신 proceed를 호출하도록 ref에 연결
  useEffect(() => {
    proceedPhaseGuardedRef.current = proceedPhaseGuarded;
  });

  // ✅ 생존자 1명(또는 0명) 남으면 즉시 종료(틱/타이머 사망도 포함)
  useEffect(() => {
    if (loading || isGameOver) return;
    if (day === 0) return;
    if (!Array.isArray(survivors)) return;
    if (survivors.length > 1) return;
    finishGame(survivors, killCounts, assistCounts);
  }, [survivors.length, day, loading, isGameOver]);


  // ▶ 오토 플레이: matchSec(페이즈 종료 시 증가)를 트리거로 다음 페이즈를 자동 진행
  useEffect(() => {
    if (!autoPlay) return;
    if (loading) return;
    if (isGameOver) return;
    if (showMarketPanel && pendingTranscendPick) return;
    if (day === 0 && survivors.length < 2) return;

    const speed = Math.max(0.25, Number(autoSpeed) || 1);
    const baseDelayMs = 1200; // 페이즈 사이 템포(실시간 UX)
    const delayMs = Math.max(150, Math.round(baseDelayMs / speed));

    const id = window.setTimeout(() => {
      // ref를 통해 최신 함수 호출
      proceedPhaseGuardedRef.current?.();
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [autoPlay, autoSpeed, matchSec, loading, isGameOver, showMarketPanel, pendingTranscendPick, day, survivors.length]);

  // ======== Market actions ========
  function ensureCharSelected() {
    if (!selectedCharId) {
      setMarketMessage('생존자를 선택해주세요.');
      return false;
    }
    return true;
  };

  async function doCraft(itemId) {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const qty = getQty(`craft:${itemId}`, 1);
      const res = await apiPost('/items/craft', { characterId: selectedCharId, itemId, qty });
      applyUserEconomyProgress({ credits: res?.credits, lp: res?.lp, perks: Array.isArray(res?.perks) ? res.perks : undefined });
      if (res?.character) patchInventoryOnly(res.character);
      addLog(`🛠️ [조합] ${res?.message || '조합 완료'} (x${qty})`, 'system');
      await Promise.allSettled([syncMyState(), loadMarket()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [조합 실패] ${msg}`, 'death');
    }
  };

  async function doKioskTransaction(kioskId, catalogIndex) {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const qty = getQty(`kiosk:${kioskId}:${catalogIndex}`, 1);
      const res = await apiPost(`/kiosks/${kioskId}/transaction`, { characterId: selectedCharId, catalogIndex, qty });
      applyUserEconomyProgress({ credits: res?.credits, lp: res?.lp, perks: Array.isArray(res?.perks) ? res.perks : undefined });
      if (res?.character) patchInventoryOnly(res.character);
      addLog(`🏪 [키오스크] ${res?.message || '거래 완료'} (x${qty})`, 'system');
      await Promise.allSettled([syncMyState(), loadMarket()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [키오스크 실패] ${msg}`, 'death');
    }
  };

  async function doDroneBuy(offerId) {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const qty = getQty(`drone:${offerId}`, 1);
      const res = await apiPost('/drone/buy', { characterId: selectedCharId, offerId, qty });
      applyUserEconomyProgress({ credits: res?.credits, lp: res?.lp, perks: Array.isArray(res?.perks) ? res.perks : undefined });
      if (res?.character) patchInventoryOnly(res.character);
      addLog(`🚁 [드론] ${res?.message || '구매 완료'} (x${qty})`, 'system');
      await Promise.allSettled([syncMyState(), loadMarket()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [드론 구매 실패] ${msg}`, 'death');
    }
  };

  async function doPerkPurchase(code) {
    try {
      setMarketMessage('');
      const perkCode = String(code || '').trim();
      if (!perkCode) {
        setMarketMessage('특전 코드가 올바르지 않습니다.');
        return;
      }
      const res = await apiPost('/perks/purchase', { code: perkCode });
      applyUserEconomyProgress({ lp: res?.lp, perks: Array.isArray(res?.perks) ? res.perks : undefined });
      addLog(`🎖️ [특전] ${res?.message || '구매 완료'} (${perkCode})`, 'system');
      await Promise.allSettled([syncMyState(), loadMarket()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [특전 구매 실패] ${msg}`, 'death');
    }
  };

  async function createTradeOffer() {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const give = compactIO(tradeDraft.give);
      const want = compactIO(tradeDraft.want);
      const wantCredits = Math.max(0, Number(tradeDraft.wantCredits || 0));
      const note = String(tradeDraft.note || '');

      if (give.length === 0) {
        setMarketMessage('give 항목이 비었습니다.');
        return;
      }

      await apiPost('/trades', {
        fromCharacterId: selectedCharId,
        give,
        want,
        wantCredits,
        note,
      });

      addLog('🔁 [거래] 오퍼 생성 완료', 'system');
      setTradeDraft({ give: [{ itemId: '', qty: 1 }], want: [{ itemId: '', qty: 1 }], wantCredits: 0, note: '' });
      await Promise.allSettled([loadTrades(), syncMyState()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [거래 오퍼 실패] ${msg}`, 'death');
    }
  };

  async function cancelTradeOffer(offerId) {
    try {
      setMarketMessage('');
      await apiPost(`/trades/${offerId}/cancel`, {});
      addLog('🧾 [거래] 오퍼 취소 완료', 'system');
      await Promise.allSettled([loadTrades(), syncMyState()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [거래 취소 실패] ${msg}`, 'death');
    }
  };

  async function acceptTradeOffer(offerId) {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const res = await apiPost(`/trades/${offerId}/accept`, { toCharacterId: selectedCharId });
      applyUserEconomyProgress({ credits: res?.credits, lp: res?.lp, perks: Array.isArray(res?.perks) ? res.perks : undefined });
      if (res?.character) patchInventoryOnly(res.character);
      addLog('✅ [거래] 수락 완료', 'system');
      await Promise.allSettled([loadTrades(), syncMyState()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [거래 수락 실패] ${msg}`, 'death');
    }
  };

  // 탭 전환 시 필요한 데이터 갱신
  useEffect(() => {
    if (marketTab === 'trade') loadTrades();
    if (marketTab === 'craft' || marketTab === 'kiosk' || marketTab === 'drone' || marketTab === 'perk') loadMarket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketTab]);

  // activeMap 로딩이 순간적으로 비는 경우(=맵 미지정/리프레시 타이밍)에도
  // 금지구역 로직이 동작하도록 zones 기반 fallback을 둡니다.
  const activeMapEff = activeMap || ((Array.isArray(zones) && zones.length)
    ? { _id: String(activeMapId || 'local'), zones }
    : null);
  const forbiddenNow = activeMapEff
    ? new Set(getForbiddenZoneIdsForPhase(activeMapEff, day, phase, getRuleset(settings?.rulesetId)))
    : new Set();

  const shouldComputeHeavyDerived = showResultModal || showMarketPanel || uiModal === 'map' || uiModal === 'chars' || uiModal === 'log';
  const shouldComputeMapDerived = uiModal === 'map';

  // 🧾 런 요약: 획득 경로(아이템만 집계, 크레딧 제외)
  const gainSourceSummary = useMemo(() => {
    if (!shouldComputeHeavyDerived) return '';
    return safeRenderCompute('gainSourceSummary', () => {
    const label = {
      box: '상자',
      natural: '자연스폰',
      hunt: '사냥',
      boss: '보스',
      legend: '전설상자',
      kiosk: '키오스크',
      drone: '드론',
      pvp: 'PvP루팅',
      unknown: '기타',
    };
    const acc = {};
    for (const e of (Array.isArray(runEvents) ? runEvents : [])) {
      if (!e || e.kind !== 'gain') continue;
      const itemId = String(e.itemId || '');
      if (!itemId || itemId === 'CREDITS') continue;
      const src = String(e.source || 'unknown');
      const q = Math.max(0, Number(e.qty ?? 0));
      acc[src] = (acc[src] || 0) + q;
    }
    const entries = Object.entries(acc).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return '';
    return entries.map(([k, v]) => `${label[k] || k}:${v}`).join(' / ');
  }, ''), [runEvents, shouldComputeHeavyDerived]);

  // 💳 런 요약: 크레딧 획득 경로(크레딧만 집계)
  const creditSourceSummary = useMemo(() => {
    if (!shouldComputeHeavyDerived) return '';
    return safeRenderCompute('creditSourceSummary', () => {
    const label = {
      box: '상자',
      natural: '자연스폰',
      hunt: '사냥',
      boss: '보스',
      legend: '전설상자',
      kiosk: '키오스크',
      drone: '드론',
      pvp: 'PvP',
      forbidden: '금지구역보상',
      unknown: '기타',
    };
    const acc = {};
    for (const e of (Array.isArray(runEvents) ? runEvents : [])) {
      if (!e || e.kind !== 'gain') continue;
      if (String(e.itemId || '') !== 'CREDITS') continue;
      const src = String(e.source || 'unknown');
      const q = Math.max(0, Number(e.qty ?? 0));
      acc[src] = (acc[src] || 0) + q;
    }
    const entries = Object.entries(acc).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return '';
    return entries.map(([k, v]) => `${label[k] || k}:${v}`).join(' / ');
  }, ''), [runEvents, shouldComputeHeavyDerived]);

// 🧾 런 요약: TOP 아이템/구역(아이템만 집계, 크레딧 제외)
const gainDetailSummary = useMemo(() => {
  if (!shouldComputeHeavyDerived) return '';
  return safeRenderCompute('gainDetailSummary', () => {
  const topN = 3;

  const itemAcc = {};
  const zoneAcc = {};
  const itemSourceAcc = {}; // itemId -> { source -> qty }

  for (const e of (Array.isArray(runEvents) ? runEvents : [])) {
    if (!e || e.kind !== 'gain') continue;
    const itemId = String(e.itemId || '');
    if (!itemId || itemId === 'CREDITS') continue;
    const q = Math.max(0, Number(e.qty ?? 0));
    if (q <= 0) continue;

    itemAcc[itemId] = (itemAcc[itemId] || 0) + q;

    const src = String(e.source || 'unknown');
    if (!itemSourceAcc[itemId]) itemSourceAcc[itemId] = {};
    itemSourceAcc[itemId][src] = (itemSourceAcc[itemId][src] || 0) + q;

    const zid = String(e.zoneId || '');
    if (zid) zoneAcc[zid] = (zoneAcc[zid] || 0) + q;
  }

  const srcLabel = {
    box: '상자',
    natural: '자연',
    hunt: '사냥',
    boss: '보스',
    legend: '전설',
    kiosk: '키오스크',
    drone: '드론',
    pvp: 'PvP',
    unknown: '기타',
  };

  const topItems = Object.entries(itemAcc).sort((a, b) => b[1] - a[1]).slice(0, topN);
  const topZones = Object.entries(zoneAcc).sort((a, b) => b[1] - a[1]).slice(0, topN);

  const itemStr = topItems
    .map(([id, v]) => {
      const srcs = itemSourceAcc[String(id)] || {};
      let bestK = '';
      let bestV = -1;
      for (const [k, sv] of Object.entries(srcs)) {
        if (Number(sv) > bestV) { bestV = Number(sv); bestK = String(k); }
      }
      const by = bestK ? `(${srcLabel[bestK] || bestK})` : '';
      return `${itemNameById?.[String(id)] || String(id)}x${v}${by}`;
    })
    .join(', ');

  const zoneStr = topZones
    .map(([z, v]) => `${zoneNameById?.[String(z)] || String(z)} ${v}`)
    .join(', ');

  if (!itemStr && !zoneStr) return '';
  if (itemStr && zoneStr) return `TOP 아이템: ${itemStr} | TOP 구역: ${zoneStr}`;
  if (itemStr) return `TOP 아이템: ${itemStr}`;
  return `TOP 구역: ${zoneStr}`;
}, ''), [runEvents, itemNameById, zoneNameById]);

const specialSourceSummary = useMemo(() => {
  if (!shouldComputeHeavyDerived) return '';
  return safeRenderCompute('specialSourceSummary', () => {
  const out = {
    bossCredits: 0,
    bossItems: 0,
    mutantItems: 0,
    eventCredits: 0,
    eventItems: 0,
    huntItems: 0,
    huntCredits: 0,
    alpha: 0,
    omega: 0,
    weakline: 0,
  };
  for (const e of (Array.isArray(runEvents) ? runEvents : [])) {
    if (!e || e.kind !== 'gain') continue;
    const src = String(e.source || '');
    const itemId = String(e.itemId || '');
    const qty = Math.max(0, Number(e.qty || 0));
    if (qty <= 0) continue;
    const isCredit = itemId === 'CREDITS';
    if (src === 'boss') {
      if (isCredit) out.bossCredits += qty;
      else out.bossItems += qty;
      const bossKind = String(e.kind || '').toLowerCase();
      if (bossKind.includes('alpha')) out.alpha += qty;
      if (bossKind.includes('omega')) out.omega += qty;
      if (bossKind.includes('weakline') || bossKind.includes('wickeline')) out.weakline += qty;
    } else if (src === 'mutant') {
      if (!isCredit) out.mutantItems += qty;
    } else if (src === 'event') {
      if (isCredit) out.eventCredits += qty;
      else out.eventItems += qty;
    } else if (src === 'hunt') {
      if (isCredit) out.huntCredits += qty;
      else out.huntItems += qty;
    }
  }
  const parts = [];
  if (out.bossItems || out.bossCredits) {
    const bossKinds = [
      out.alpha ? `A:${out.alpha}` : '',
      out.omega ? `Ω:${out.omega}` : '',
      out.weakline ? `W:${out.weakline}` : '',
    ].filter(Boolean).join(' / ');
    parts.push(`보스 보상 아이템 ${out.bossItems}${out.bossCredits ? ` · 크레딧 ${out.bossCredits}` : ''}${bossKinds ? ` (${bossKinds})` : ''}`);
  }
  if (out.mutantItems) parts.push(`변이 드랍 ${out.mutantItems}`);
  if (out.huntItems || out.huntCredits) parts.push(`일반 사냥 아이템 ${out.huntItems}${out.huntCredits ? ` · 크레딧 ${out.huntCredits}` : ''}`);
  if (out.eventItems || out.eventCredits) parts.push(`이벤트 보상 아이템 ${out.eventItems}${out.eventCredits ? ` · 크레딧 ${out.eventCredits}` : ''}`);
  return parts.join(' | ');
}, ''), [runEvents]);

const runProgressSummary = useMemo(() => {
  if (!shouldComputeHeavyDerived) return { line: '', topZones: '', topVictims: '', topKillers: '', topItems: '' };
  return safeRenderCompute('runProgressSummary', () => {
  const out = {
    droneCalls: 0,
    kioskGains: 0,
    craftCount: 0,
    totalDeaths: 0,
    totalRevives: 0,
    totalFlees: 0,
    firstLegendAt: null,
    firstTransAt: null,
    latestLegendAt: null,
    latestTransAt: null,
    legendWho: new Set(),
    transWho: new Set(),
  };
  function stampText(at) {
    if (!at) return '';
    const d = Number(at?.day || 0);
    const ph = String(at?.phase || '-');
    const sec = Math.max(0, Math.floor(Number(at?.sec || 0)));
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return `D${d} ${ph} ${mm}:${ss}`;
  };
  function touchTier(tier, at, who) {
    const t = Math.max(0, Number(tier || 0));
    const wid = String(who || '');
    if (t >= 5 && !out.firstLegendAt) out.firstLegendAt = at || null;
    if (t >= 6 && !out.firstTransAt) out.firstTransAt = at || null;
    if (t >= 5) out.latestLegendAt = at || null;
    if (t >= 6) out.latestTransAt = at || null;
    if (t >= 5 && wid) out.legendWho.add(wid);
    if (t >= 6 && wid) out.transWho.add(wid);
  };
  for (const e of (Array.isArray(runEvents) ? runEvents : [])) {
    if (!e) continue;
    const who = String(e.who || '');
    if (e.kind === 'gain') {
      const src = String(e.source || '');
      if (src === 'drone') out.droneCalls += 1;
      if (src === 'kiosk') out.kioskGains += 1;
      const meta = itemMetaById?.[String(e.itemId || '')] || null;
      const tier = Number(meta?.tier || 0);
      const cat = inferItemCategory(meta);
      if (cat === 'equipment' && tier > 0) touchTier(tier, e.at || null, who);
    }
    if (e.kind === 'craft') {
      out.craftCount += 1;
      touchTier(Number(e.tier || 0), e.at || null, who);
    }
    if (e.kind === 'death') out.totalDeaths += 1;
    if (e.kind === 'revive') out.totalRevives += 1;
    if (e.kind === 'move') {
      const reason = String(e.reason || '');
      if (reason.includes('escape') || reason.includes('flee')) out.totalFlees += 1;
    }
  }
  const deathBase = Math.max(1, out.totalDeaths);
  const reviveRate = out.totalRevives / deathBase;
  const fleeRate = out.totalFlees / deathBase;
  const isLegendOnTime = !!out.firstLegendAt && isAtOrAfterWorldTime(Number(out.firstLegendAt?.day || 0), String(out.firstLegendAt?.phase || ''), 0, 'morning') && !isAtOrAfterWorldTime(Number(out.firstLegendAt?.day || 0), String(out.firstLegendAt?.phase || ''), 3, 'day');
  const isTransOnTime = !!out.firstTransAt && isAtOrAfterWorldTime(Number(out.firstTransAt?.day || 0), String(out.firstTransAt?.phase || ''), 0, 'morning') && !isAtOrAfterWorldTime(Number(out.firstTransAt?.day || 0), String(out.firstTransAt?.phase || ''), 5, 'day');
  return {
    ...out,
    legendCount: out.legendWho.size,
    transCount: out.transWho.size,
    reviveRate,
    fleeRate,
    legendPace: out.firstLegendAt ? (isLegendOnTime ? 'on-track' : 'late') : 'pending',
    transPace: out.firstTransAt ? (isTransOnTime ? 'on-track' : 'late') : 'pending',
    firstLegendText: stampText(out.firstLegendAt),
    firstTransText: stampText(out.firstTransAt),
    latestLegendText: stampText(out.latestLegendAt),
    latestTransText: stampText(out.latestTransAt),
  };
}, {
  droneCalls: 0,
  kioskGains: 0,
  craftCount: 0,
  totalDeaths: 0,
  totalRevives: 0,
  totalFlees: 0,
  firstLegendAt: null,
  firstTransAt: null,
  latestLegendAt: null,
  latestTransAt: null,
  legendWho: new Set(),
  transWho: new Set(),
  legendCount: 0,
  transCount: 0,
  reviveRate: 0,
  fleeRate: 0,
  legendPace: 'pending',
  transPace: 'pending',
  firstLegendText: '',
  firstTransText: '',
  latestLegendText: '',
  latestTransText: '',
}), [runEvents, itemMetaById]);

const runSupportSummary = useMemo(() => {
  if (!shouldComputeHeavyDerived) return { line: '', topItems: '', topEffects: '', autoUseCount: 0, manualUseCount: 0, totalHeal: 0, totalCleanse: 0, skillUseCount: 0, appliedEffects: 0, resistedEffects: 0 };
  return safeRenderCompute('runSupportSummary', () => {
  const out = {
    autoUseCount: 0,
    manualUseCount: 0,
    totalHeal: 0,
    totalCleanse: 0,
    skillUseCount: 0,
    appliedEffects: 0,
    immuneEffects: 0,
    resistedEffects: 0,
  };
  const itemAcc = {};
  const effectAcc = {};
  for (const e of (Array.isArray(runEvents) ? runEvents : [])) {
    if (!e) continue;
    if (e.kind === 'use') {
      if (e.manual) out.manualUseCount += 1;
      else out.autoUseCount += 1;
      out.totalHeal += Math.max(0, Number(e.heal || 0));
      out.totalCleanse += Math.max(0, Number(e.cleansed || 0));
      const itemId = String(e.itemId || '');
      if (itemId) itemAcc[itemId] = (itemAcc[itemId] || 0) + 1;
    }
    if (e.kind === 'skill') out.skillUseCount += 1;
    if (e.kind === 'effect') {
      const effectName = String(e.effect || '');
      const outcome = String(e.outcome || '');
      if (outcome === 'applied') out.appliedEffects += 1;
      else if (outcome === 'immune') out.immuneEffects += 1;
      else if (outcome === 'resisted') out.resistedEffects += 1;
      if (effectName && outcome === 'applied') effectAcc[effectName] = (effectAcc[effectName] || 0) + 1;
    }
  }
  const topItems = Object.entries(itemAcc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, count]) => `${itemNameById?.[String(id)] || String(id)}x${count}`).join(', ');
  const topEffects = Object.entries(effectAcc).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, count]) => `${name}x${count}`).join(', ');
  return {
    ...out,
    topItems,
    topEffects,
    line: `use ${out.autoUseCount + out.manualUseCount}회 (auto ${out.autoUseCount} / dev ${out.manualUseCount}) · heal ${out.totalHeal} · cleanse ${out.totalCleanse} · skill ${out.skillUseCount} · effect ${out.appliedEffects}/${out.immuneEffects}/${out.resistedEffects}`,
  };
}, {
  autoUseCount: 0,
  manualUseCount: 0,
  totalHeal: 0,
  totalCleanse: 0,
  skillUseCount: 0,
  appliedEffects: 0,
  immuneEffects: 0,
  resistedEffects: 0,
  topItems: '',
  topEffects: '',
  line: '',
}), [runEvents, itemNameById]);

const runActionSummary = useMemo(() => {
  if (!shouldComputeHeavyDerived) return { line: '', topBlocked: '', topDeferred: '', avgEscape: 0, avgChase: 0, avgCatch: 0, avgPreDamage: 0 };
  return safeRenderCompute('runActionSummary', () => {
  const out = {
    queued: 0,
    blocked: 0,
    fleeChosen: 0,
    moveChosen: 0,
    craftChosen: 0,
    droneChosen: 0,
    kioskChosen: 0,
    escapeFail: 0,
    escapeNoChase: 0,
    escapedAfterChase: 0,
    caught: 0,
    blinkEscape: 0,
    avgEscape: 0,
    avgChase: 0,
    avgCatch: 0,
    avgPreDamage: 0,
  };
  const blockedAcc = {};
  const deferredAcc = {};
  let escapeN = 0;
  let chaseN = 0;
  let catchN = 0;
  let preDamageN = 0;
  for (const e of (Array.isArray(runEvents) ? runEvents : [])) {
    if (!e) continue;
    if (e.kind === 'queue') {
      out.queued += 1;
      const chosen = String(e.chosen || '');
      if (chosen === 'flee') out.fleeChosen += 1;
      else if (chosen === 'moveTo') out.moveChosen += 1;
      else if (chosen === 'craft') out.craftChosen += 1;
      else if (chosen === 'droneOrder') out.droneChosen += 1;
      else if (chosen.startsWith('kiosk')) out.kioskChosen += 1;
      (Array.isArray(e.blockedReasons) ? e.blockedReasons : []).forEach((reason) => {
        const key = String(reason || '').trim();
        if (!key) return;
        out.blocked += 1;
        blockedAcc[key] = (blockedAcc[key] || 0) + 1;
        if (key.startsWith('deferred:')) deferredAcc[key.replace('deferred:', '')] = (deferredAcc[key.replace('deferred:', '')] || 0) + 1;
      });
    }
    if (e.kind === 'chase') {
      const outcome = String(e.outcome || '');
      if (outcome === 'escape_fail') out.escapeFail += 1;
      else if (outcome === 'escape_no_chase') out.escapeNoChase += 1;
      else if (outcome === 'escaped_after_chase') out.escapedAfterChase += 1;
      else if (outcome === 'caught') out.caught += 1;
      else if (outcome === 'blink_escape') out.blinkEscape += 1;
      const pEscape = Number(e?.pEscape);
      const pChase = Number(e?.pChase);
      const pCatch = Number(e?.pCatch);
      const preDamage = Number(e?.preDamage);
      if (Number.isFinite(pEscape) && pEscape > 0) { out.avgEscape += pEscape; escapeN += 1; }
      if (Number.isFinite(pChase) && pChase > 0) { out.avgChase += pChase; chaseN += 1; }
      if (Number.isFinite(pCatch) && pCatch > 0) { out.avgCatch += pCatch; catchN += 1; }
      if (Number.isFinite(preDamage) && preDamage >= 0) { out.avgPreDamage += preDamage; preDamageN += 1; }
    }
  }
  out.avgEscape = escapeN > 0 ? out.avgEscape / escapeN : 0;
  out.avgChase = chaseN > 0 ? out.avgChase / chaseN : 0;
  out.avgCatch = catchN > 0 ? out.avgCatch / catchN : 0;
  out.avgPreDamage = preDamageN > 0 ? out.avgPreDamage / preDamageN : 0;
  const topBlocked = Object.entries(blockedAcc)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([reason, count]) => `${reason}x${count}`)
    .join(', ');
  const topDeferred = Object.entries(deferredAcc)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `${reason}x${count}`)
    .join(', ');
  return {
    ...out,
    topBlocked,
    topDeferred,
    line: `queue ${out.queued} · blocked ${out.blocked} · flee ${out.fleeChosen} · move ${out.moveChosen} · craft ${out.craftChosen} · drone ${out.droneChosen} · kiosk ${out.kioskChosen}`,
    chaseLine: `escapeFail ${out.escapeFail} · noChase ${out.escapeNoChase} · escaped ${out.escapedAfterChase + out.blinkEscape} · caught ${out.caught}`,
    tuningLine: `avgEscape ${(out.avgEscape * 100).toFixed(0)}% · avgChase ${(out.avgChase * 100).toFixed(0)}% · avgCatch ${(out.avgCatch * 100).toFixed(0)}% · preDmg ${out.avgPreDamage.toFixed(1)}`,
  };
}, {
  queued: 0,
  blocked: 0,
  fleeChosen: 0,
  moveChosen: 0,
  craftChosen: 0,
  droneChosen: 0,
  kioskChosen: 0,
  escapeFail: 0,
  escapeNoChase: 0,
  escapedAfterChase: 0,
  caught: 0,
  blinkEscape: 0,
  avgEscape: 0,
  avgChase: 0,
  avgCatch: 0,
  avgPreDamage: 0,
  topBlocked: '',
  topDeferred: '',
  line: '',
  chaseLine: '',
  tuningLine: '',
}), [runEvents]);

  const topRankedCharacters = useMemo(() => {
    if (!shouldComputeHeavyDerived) return [];
    return safeRenderCompute('topRankedCharacters', () => {
    return [...(Array.isArray(survivors) ? survivors : []), ...(Array.isArray(dead) ? dead : [])]
      .filter(Boolean)
      .sort((a, b) => ((killCounts?.[b?._id] || 0) - (killCounts?.[a?._id] || 0)) || ((assistCounts?.[b?._id] || 0) - (assistCounts?.[a?._id] || 0)))
      .slice(0, 3);
  }, []), [survivors, dead, killCounts, assistCounts, shouldComputeHeavyDerived]);

  // 🗺️ 미니맵(구역 그래프 + 캐릭터 위치)
  const zonePos = useMemo(() => {
    if (!shouldComputeMapDerived) return {};
    return safeRenderCompute('zonePos', () => {
    const z = Array.isArray(zones) ? zones : [];
    const ids = z.map((x) => String(x?.zoneId || '')).filter(Boolean).sort();
    const out = {};
    if (!ids.length) return out;

    // 1) 루미아 섬 기본 앵커(존 id가 매칭될 때)
    ids.forEach((id) => {
      const p = LUMIA_ZONE_POS[id];
      if (p) out[id] = { x: p.x, y: p.y };
    });

    // 2) 매칭되지 않은 존은 원형 배치로 fallback
    const missing = ids.filter((id) => !out[id]);
    if (missing.length) {
      const cx = 50;
      const cy = 54;
      const r = missing.length <= 2 ? 18 : missing.length <= 6 ? 26 : 34;
      missing.forEach((id, idx) => {
        const ang = (Math.PI * 2 * idx) / missing.length;
        out[id] = { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r };
      });
    }
    return out;
  }, {}), [zones]);

  const zoneEdges = useMemo(() => {
    if (!shouldComputeMapDerived) return [];
    return safeRenderCompute('zoneEdges', () => {
    const ids = (Array.isArray(zones) ? zones : []).map((x) => String(x?.zoneId || '')).filter(Boolean);
    const idSet = new Set(ids);
    const uniq = new Set();
    const edges = [];
    Object.keys(zoneGraph || {}).forEach((a) => {
      if (!idSet.has(a)) return;
      const arr = Array.isArray(zoneGraph?.[a]) ? zoneGraph[a] : [];
      arr.forEach((b) => {
        if (!idSet.has(b) || a === b) return;
        const k = a < b ? `${a}::${b}` : `${b}::${a}`;
        if (uniq.has(k)) return;
        uniq.add(k);
        edges.push([a, b]);
      });
    });
    return edges;
  }, []), [zoneGraph, zones]);

  // 📍 미니맵 핑(최근 이벤트): runEvents 기반(조작 없는 관전형에서 "무슨 일이 어디서" 일어났는지 표시)
  const [pingNow, setPingNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setPingNow(Date.now()), 450);
    return () => clearInterval(t);
  }, []);

  const recentPings = useMemo(() => {
    if (!shouldComputeMapDerived) return [];
    return safeRenderCompute('recentPings', () => {
    const now = Number(pingNow || Date.now());
    const ttlMs = 8000;
    const tail = (Array.isArray(runEvents) ? runEvents : []).slice(-260);
    const out = [];
    const uniq = new Set();

    const pickZoneId = (e) => {
      if (!e) return '';
      const kind = String(e.kind || '');
      if (kind === 'move') return String(e.to || '');
      return String(e.zoneId || '');
    };

    const pickIcon = (e) => {
      const kind = String(e?.kind || '');
      if (kind === 'battle') return '⚔️';
      if (kind === 'death') return '☠️';
      if (kind === 'move') return '🚶';
      if (kind === 'gain') {
        const itemId = String(e?.itemId || '');
        if (itemId === 'CREDITS') return '💰';
        const src = String(e?.source || '');
        if (src === 'legend') return '🟪';
        if (src === 'natural') return '🌠';
        if (src === 'boss') return '👹';
        return '📦';
      }
      return '✨';
    };

    for (let i = tail.length - 1; i >= 0; i -= 1) {
      const e = tail[i];
      const ts = Number(e?.ts || 0);
      if (!ts || (now - ts) > ttlMs) continue;
      const zid = pickZoneId(e);
      if (!zid || !zonePos?.[zid]) continue;

      // 같은 zone+kind는 1개만 표시(깜빡임/도배 방지)
      const k = `${String(e.kind || '')}::${zid}`;
      if (uniq.has(k)) continue;
      uniq.add(k);

      out.push({
        id: String(e._id || e.ts || `${i}`),
        zoneId: zid,
        kind: String(e.kind || ''),
        icon: pickIcon(e),
        ts,
      });

      if (out.length >= 14) break;
    }

    return out;
  }, []), [runEvents, pingNow, zonePos, shouldComputeMapDerived]);


  const detonationRiskSummary = useMemo(() => safeRenderCompute('detonationRiskSummary', () => {
    if (day <= 0) return {
      visible: false,
      total: 0,
      forbiddenCnt: 0,
      safeLeft: 0,
      riskyCount: 0,
      riskyTitle: '',
      willForceAllThisPhase: false,
      fzHoverText: '현재 금지구역 없음',
    };
    const total = Array.isArray(activeMap?.zones) ? activeMap.zones.length : (Array.isArray(zones) ? zones.length : 0);
    const forbiddenCnt = forbiddenNow?.size ? forbiddenNow.size : 0;
    const safeLeft = Math.max(0, total - forbiddenCnt);
    const rs = getRuleset(settings?.rulesetId);
    const critical = Math.max(0, Number(rs?.detonation?.criticalSec ?? 5));
    const riskyChars = [];
    for (const c of (Array.isArray(survivors) ? survivors : [])) {
      const d = Number(c?.detonationSec);
      if (!Number.isFinite(d)) continue;
      const sec = Math.max(0, Math.floor(d));
      if (sec > critical) continue;
      riskyChars.push({ name: c?.name, sec });
    }
    riskyChars.sort((a, b) => Number(a?.sec || 0) - Number(b?.sec || 0));
    const riskyCount = riskyChars.length;
    const riskyMin = riskyCount ? Number(riskyChars[0]?.sec || 0) : null;
    const riskyNames = riskyCount
      ? (() => {
          const names = [];
          for (const x of riskyChars) {
            const nm = String(x?.name || '???').trim();
            if (nm) names.push(nm);
          }
          const head = names.slice(0, 5);
          const extra = names.length > 5 ? ` 외 ${names.length - 5}명` : '';
          return `${head.join(', ')}${extra}`;
        })()
      : '';
    const riskyTitle = riskyCount
      ? `폭발 타이머 임계치(≤${critical}s) 이하 · 최저 ${riskyMin}s: ${riskyNames}`
      : `폭발 타이머 임계치(≤${critical}s) 이하 생존자 수`;
    const detForceAll = Math.max(0, Number(rs?.detonation?.forceAllAfterSec ?? 40));
    const isEndgame = safeLeft <= 2 && total > 0;
    const curPhaseDur = Math.max(0, Number(getPhaseDurationSec(rs, day, phase) || 0));
    const willForceAllThisPhase = isEndgame && curPhaseDur >= detForceAll;
    const fzNameArr = forbiddenCnt
      ? Array.from(forbiddenNow)
          .map((z) => String(getZoneName(z) || ''))
          .filter((x) => x && x !== '__default__')
      : [];
    const fzHead = fzNameArr.slice(0, 5);
    const fzExtra = fzNameArr.length > 5 ? ` (+${fzNameArr.length - 5})` : '';
    const fzNamesShort = fzNameArr.length ? `${fzHead.join(', ')}${fzExtra}` : '';
    const fzHoverText = forbiddenCnt ? `금지구역: ${fzNamesShort}` : '현재 금지구역 없음';
    return {
      visible: true,
      total,
      forbiddenCnt,
      safeLeft,
      riskyCount,
      riskyTitle,
      willForceAllThisPhase,
      fzHoverText,
    };
  }, {
    visible: false,
    total: 0,
    forbiddenCnt: 0,
    safeLeft: 0,
    riskyCount: 0,
    riskyTitle: '',
    willForceAllThisPhase: false,
    fzHoverText: '현재 금지구역 없음',
  }), [day, activeMap, zones, forbiddenNow, settings?.rulesetId, survivors, phase]);

  return (
    <main className="simulation-page">
      <header>
        <section id="header-id1">
          <ul>
            <li>
              <Link href="/" className="logo-btn">
                <div className="text-logo">
                  <span className="logo-top">ETERNAL</span>
                  <span className="logo-main">HUNGER</span>
                </div>
              </Link>
            </li>
            <li><Link href="/">메인</Link></li>
            <li><Link href="/characters">캐릭터 설정</Link></li>
            <li><Link href="/details">캐릭터 상세설정</Link></li>
            <li><Link href="/events">이벤트 설정</Link></li>
            <li><Link href="/modifiers">보정치 설정</Link></li>
            <li><Link href="/simulation" style={{ color: '#0288d1' }}>▶ 게임 시작</Link></li>
          </ul>
        </section>
      </header>

      {uiModal ? (
        <div
          className="eh-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeUiModal();
          }}
        />
      ) : null}

      <div className="simulation-container modal-layout">
        {/* 생존자 현황판 */}
        <aside className={`survivor-board ${uiModal === 'chars' ? 'modal-open' : ''}`}>
          {uiModal === 'chars' ? (<button className="eh-modal-close" onClick={closeUiModal} aria-label="닫기">✕</button>) : null}
          <h2>생존자 ({survivors.length}명)</h2>
          <div className="survivor-grid">
            {survivors.map((char) => (
              <div key={char._id} className="survivor-card alive">
                <img src={char.previewImage || '/Images/default_image.png'} alt={char.name} />
                <span>{char.name}</span>
                <div className="skill-tag">⭐ {char.specialSkill?.name || '기본 공격'}</div>
	                <div className={`zone-badge ${forbiddenNow.has(String(char.zoneId || '')) ? 'forbidden' : ''}`}>
	                  📍 {getZoneName(char.zoneId || '__default__')}
	                </div>

                
                <div style={{ fontSize: 12, marginTop: 6, opacity: 0.95 }}>💳 {Number(char.simCredits || 0)} Cr</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, rowGap: 4, justifyContent: 'center', fontSize: 12, opacity: 0.95 }}>
                  <span>❤️ {Math.max(0, Math.floor(Number(char.hp ?? 0)))}/{Math.max(1, Math.floor(Number(char.maxHp ?? 100)))}</span>
                  {(() => {
                    const detVal = Number(char.detonationSec);
                    if (!Number.isFinite(detVal)) return null;

                    const rs = getRuleset(settings?.rulesetId);
                    const detMax = Number(char.detonationMaxSec ?? rs?.detonation?.maxSec ?? 30);
                    const critical = Math.max(0, Number(rs?.detonation?.criticalSec ?? 5));

                    const totalZonesForUI = Array.isArray(activeMap?.zones) ? activeMap.zones.length : (Array.isArray(zones) ? zones.length : 0);
                    const forbiddenCnt = forbiddenNow?.size ? forbiddenNow.size : 0;
                    const safeLeftForUI = Math.max(0, totalZonesForUI - forbiddenCnt);
                    const detForceAll = Math.max(0, Number(rs?.detonation?.forceAllAfterSec ?? 40));
                    const curPhaseDur = Math.max(0, Number(getPhaseDurationSec(rs, day, phase) || 0));
                    const forceAllOn = (safeLeftForUI <= 2 && totalZonesForUI > 0 && curPhaseDur >= detForceAll);

                    const zid = String(char.zoneId || '');
                    const isForbiddenUi = forceAllOn ? true : forbiddenNow.has(zid);

                    const detFloor = Math.max(0, Math.floor(detVal));
                    const maxFloor = Number.isFinite(detMax) ? Math.max(0, Math.floor(detMax)) : null;
                    const isCritical = detFloor <= critical;
                    const label = maxFloor !== null ? `${detFloor}/${maxFloor}s` : `${detFloor}s`;

                    return (
                      <span
                        title={isForbiddenUi ? '금지구역: 폭발 타이머 감소' : '안전구역: 폭발 타이머 회복'}
                        style={{
                          fontWeight: 900,
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: '1px solid rgba(255,255,255,0.20)',
                          background: isCritical ? 'rgba(255, 82, 82, 0.42)' : isForbiddenUi ? 'rgba(255, 82, 82, 0.26)' : 'rgba(0,0,0,0.22)',
                          color: '#fff',
                        }}
                      >
                        {isCritical ? '⚠️ ' : ''}⏳ {label}
                      </span>
                    );
                  })()}

                  {settings?.rulesetId === 'ER_S10' && (
                    <span>⚡ {Number.isFinite(Number(char.gadgetEnergy)) ? Math.floor(Number(char.gadgetEnergy)) : 0}</span>
                  )}
                </div>

                {(() => {
                  const es = getEquipSummary(char);
                  return (
                    <div className="equip-summary" title={es.full}>
                      🧰 {es.short}
                    </div>
                  );
                })()}

                <div className="inventory-summary">
                  <span className="bag-icon">🎒</span>
                  <span className="inv-count">{Array.isArray(char.inventory) ? char.inventory.length : 0}/3</span>
                  <div className="inv-tooltip">
                    {(Array.isArray(char.inventory) ? char.inventory : []).map((it, i) => (
                      <div key={i} className="inv-item-mini">
                        {itemIcon(it)} {itemDisplayName(it)}
                        {Number(it?.qty || 1) > 1 ? ` x${Number(it.qty)}` : ''}
                      </div>
                    ))}
                  </div>
                </div>

                {killCounts[char._id] > 0 && <span className="kill-badge">⚔️{killCounts[char._id]}</span>}

                <div className="status-effects-container">
                  {(() => {
                    const uiPhaseIdx = Math.max(0, Number(day || 0) * 2 + (timeOfDay === 'day' ? 0 : 1));
                    const du = Number(char?._immediateDangerUntilPhaseIdx ?? -1);
                    const dv = Math.max(0, Number(char?._immediateDanger || 0));
                    if (dv <= 0 || du !== uiPhaseIdx) return null;
                    const pct = Math.min(99, Math.max(1, Math.round(dv * 100)));
                    return (
                      <span title="수집/사냥 직후: 교전 유발(표적 우선)" className="effect-badge">
                        ⚠️ 노출 +{pct}%
                      </span>
                    );
                  })()}
                  {(Array.isArray(char.activeEffects) ? char.activeEffects : []).map((eff, i) => {
                    const nm = String(eff?.name || '');
                    const dur = Number.isFinite(Number(eff?.remainingDuration)) ? Math.max(0, Number(eff.remainingDuration)) : null;
                    const icon = nm === '출혈' ? '🩸' : nm === '식중독' ? '🤢' : nm === '중독' ? '☠️' : nm === '화상' ? '🔥' : nm === '보호막' ? '🛡️' : nm === '재생' ? '✨' : '🤕';
                    const stacks = Math.max(1, Number(eff?.stacks || 1));
                    const label = dur !== null ? `${icon}${nm}${stacks > 1 ? ` x${stacks}` : ''} ${dur}` : `${icon}${nm}${stacks > 1 ? ` x${stacks}` : ''}`;
                    return (
                      <span key={`${nm}-${i}`} title={dur !== null ? `${nm}${stacks > 1 ? ` x${stacks}` : ''} (${dur})` : nm} className="effect-badge">
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: '30px', color: '#ff5252' }}>사망자 ({dead.length}명)</h2>
          <div className="survivor-grid">
            {dead.map((char) => (
              <div key={char._id} className="survivor-card dead">
                <img src={char.previewImage || '/Images/default_image.png'} alt={char.name} />
                <span>{char.name}</span>
                <div className="zone-badge dead">📍 {getZoneName(char.zoneId || '__default__')}</div>
                
                <div style={{ fontSize: 12, marginTop: 6, opacity: 0.95 }}>💳 {Number(char.simCredits || 0)} Cr</div>
{killCounts[char._id] > 0 && <span className="kill-badge">⚔️{killCounts[char._id]}</span>}
              </div>
            ))}
          </div>
        </aside>

        {/* 게임 화면 */}
        <section className={`game-screen ${phase === 'morning' ? 'morning-mode' : 'night-mode'}`}>
          <div className="screen-header">
            <h1>{day === 0 ? 'GAME READY' : `DAY ${day} - ${timeOfDay === 'day' ? 'DAY' : 'NIGHT'}`}</h1>
            <div className="screen-header-right">
              <span className="weather-badge">{timeOfDay === 'day' ? '☀ 낮' : '🌙 밤'}</span>
              <span className="weather-badge">⏱ {formatClock(matchSec)}</span>

              <button
                className="btn-secondary"
                onClick={() => setUiModal('map')}
                disabled={loading || isAdvancing}
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                🗺️ 미니맵
              </button>
              <button
                className="btn-secondary"
                onClick={() => setUiModal('chars')}
                disabled={loading || isAdvancing}
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                👥 캐릭터
              </button>
              <button
                className="btn-secondary"
                onClick={() => setUiModal('log')}
                disabled={loading || isAdvancing}
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                🧾 로그
              </button>


              <button
                className="btn-secondary"
                onClick={() => refreshMapSettingsFromServer('manual')}
                disabled={loading || isAdvancing || isGameOver}
                    style={{ padding: '6px 10px', fontSize: 12 }}
                title="서버에 저장된 맵 설정(crateAllowDeny 등)을 새로 불러옵니다."
              >
                {isRefreshingMapSettings ? '⏳ 새로고침 중...' : '🔄 맵 새로고침'}
              </button>

              {/* 🌀 하이퍼루프: 맵 내 장치(패드) 상호작용은 미니맵 아래에서 제공 */}

              {mapRefreshToast ? (
                <span
                  className="weather-badge"
                  style={{ fontSize: 12, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  title={mapRefreshToast.text}
                >
                  {mapRefreshToast.kind === 'error' ? '⚠️' : '✅'} {mapRefreshToast.text}
                </span>
              ) : null}
            </div>
          </div>

          <div className="market-small" style={{ margin: '10px 0 0', padding: '8px 10px', borderRadius: 8, background: '#eef7ff', color: '#0d47a1', border: '1px solid rgba(2, 136, 209, 0.18)' }}>
            🧪 {initDebugLine}
          </div>

          {detonationRiskSummary?.visible ? (
            <div className="forbidden-top-bar">
              <span className="fz-title">🚫 금지구역</span>
              <span className="fz-chip" title="6번째 밤부터는 교전을 강하게 유도(서든데스)하고, 마지막 1명 생존 시 게임이 종료됩니다.">
                🔥 서든데스: <b>6번째 밤 이후</b>
              </span>
              <span className="fz-chip" title={detonationRiskSummary?.fzHoverText || '현재 금지구역 없음'}>금지 <b>{detonationRiskSummary?.forbiddenCnt || 0}</b> / 전체 <b>{detonationRiskSummary?.total || 0}</b> · 안전 <b>{detonationRiskSummary?.safeLeft || 0}</b></span>
              <span
                className={`fz-chip ${(detonationRiskSummary?.riskyCount || 0) > 0 ? 'fz-danger' : ''}`}
                title={detonationRiskSummary?.riskyTitle || '폭발 타이머 임계치 이하 생존자 수'}
              >
                ⚠️ 위험 <b>{detonationRiskSummary?.riskyCount || 0}</b>명
              </span>
              {Array.isArray(forbiddenAddedNow) && forbiddenAddedNow.length ? (
                <span className="fz-chip fz-danger" title={`이번 진행에서 새로 금지된 구역: ${forbiddenAddedNow.map((z) => getZoneName(z)).join(', ')}`}>
                  +{forbiddenAddedNow.length} 신규 금지
                </span>
              ) : null}
              {detonationRiskSummary?.willForceAllThisPhase ? (
                <span className="fz-chip fz-danger" title="안전구역이 1~2개 남은 상태에서 현 페이즈 길이가 기준 이상이면 폭발이 전 구역에 적용됩니다.">
                  ☢️ 이번 페이즈 전구역 폭발 가능
                </span>
              ) : null}
            </div>
          ) : null}


{(() => {
  if (day <= 0) return null;
  const s = spawnState && String(spawnState.mapId || '') === String(activeMapId || '') ? spawnState : null;
  if (!s) return null;

  const unopenedCrates = (Array.isArray(s.legendaryCrates) ? s.legendaryCrates : []).filter((c) => c && !c.opened).length;
  const unpickedCore = (Array.isArray(s.coreNodes) ? s.coreNodes : []).filter((n) => n && !n.picked).length;

  const meteorCnt = (Array.isArray(s.coreNodes) ? s.coreNodes : []).filter((n) => n && !n.picked && String(n.kind) === 'meteor').length;
  const lifeTreeCnt = (Array.isArray(s.coreNodes) ? s.coreNodes : []).filter((n) => n && !n.picked && String(n.kind) === 'life_tree').length;

  const bosses = s.bosses || {};
  const alphaOn = !!bosses?.alpha?.alive;
  const omegaOn = !!bosses?.omega?.alive;
  const weaklineOn = !!bosses?.weakline?.alive;

  const wildlifeMap = (s?.wildlife && typeof s.wildlife === 'object') ? s.wildlife : {};
  const eligibleWildZones = (Array.isArray(zones) ? zones : [])
    .filter((z) => z && z.zoneId)
    .filter((z) => !zoneHasKioskFlag(z))
    .map((z) => String(z.zoneId));
  const wildlifeTotal = eligibleWildZones.reduce((sum, zid) => sum + Math.max(0, Number(wildlifeMap?.[zid] ?? 0)), 0);
  const wildlifeEmpty = eligibleWildZones.reduce((cnt, zid) => cnt + ((Math.max(0, Number(wildlifeMap?.[zid] ?? 0)) <= 0) ? 1 : 0), 0);

  if (!unopenedCrates && !unpickedCore && !alphaOn && !omegaOn && !weaklineOn && wildlifeTotal <= 0) return null;

  return (
    <div className="worldspawn-toolbar">
      <span className="ws-title">🌍 월드스폰</span>
      <span className="ws-chip">🟪 전설상자: <b>{unopenedCrates}</b></span>
      <span className="ws-chip">🌠 자연코어: 운석 <b>{meteorCnt}</b> / 생나 <b>{lifeTreeCnt}</b></span>
      <span className="ws-chip" title="요청: 매 페이즈 야생동물 스폰 체크">🦌 야생동물: <b>{wildlifeTotal}</b>{wildlifeEmpty > 0 ? ` (빈구역 ${wildlifeEmpty})` : ''}</span>
      <span className="ws-chip">👹 알파: <b>{alphaOn ? 'ON' : 'off'}</b></span>
      <span className="ws-chip">👹 오메가: <b>{omegaOn ? 'ON' : 'off'}</b></span>
      <span className="ws-chip">👹 위클라인: <b>{weaklineOn ? 'ON' : 'off'}</b></span>
    </div>
  );
})()}

          {/* 🗺️ 미니맵: 구역 그래프 + 캐릭터 위치 */}
          <div className={`minimap-panel ${uiModal === 'map' ? 'modal-open' : ''}`}>
            {uiModal === 'map' ? (<button className="eh-modal-close" onClick={closeUiModal} aria-label="닫기">✕</button>) : null}
            {(() => {
              const z = Array.isArray(zones) ? zones : [];
              if (!z.length) return <div className="minimap-empty">미니맵 데이터가 없습니다.</div>;

              const aliveByZone = {};
              (Array.isArray(survivors) ? survivors : []).forEach((c) => {
                const mid = String(c?.mapId || '').trim();
                if (mid && String(activeMapId || '') && mid !== String(activeMapId)) return;
                const zid = String(c?.zoneId || '');
                if (!zid) return;
                if (!aliveByZone[zid]) aliveByZone[zid] = [];
                aliveByZone[zid].push(c);
              });
              const deadByZone = {};
              (Array.isArray(dead) ? dead : []).forEach((c) => {
                const mid = String(c?.mapId || '').trim();
                if (mid && String(activeMapId || '') && mid !== String(activeMapId)) return;
                const zid = String(c?.zoneId || '');
                if (!zid) return;
                if (!deadByZone[zid]) deadByZone[zid] = [];
                deadByZone[zid].push(c);
              });

              const selectedChar = (Array.isArray(survivors) ? survivors : []).find((c) => String(c?._id) === String(hyperloopCharId)) || null;
              const selectedZoneId = selectedChar ? String(selectedChar?.zoneId || '') : '';

              const OFF = [
                [0, 0], [3, 0], [-3, 0], [0, 3], [0, -3],
                [3, 3], [-3, 3], [3, -3], [-3, -3],
                [5, 0], [-5, 0], [0, 5], [0, -5],
              ];

              return (
                <div className="minimap-canvas">
                  <img
                    className="minimap-bg"
                    src={String(activeMap?.image || '').trim() || '/Images/ERMap.webp'}
                    alt="Lumia Island"
                    draggable={false}
                  />

                  <svg className="minimap-svg" viewBox="0 0 100 100" role="img" aria-label="미니맵">
                    {/* 연결선 */}
                    {zoneEdges.map(([a, b]) => {
                      const pa = zonePos?.[a];
                      const pb = zonePos?.[b];
                      if (!pa || !pb) return null;
                      return (
                        <line
                          key={`e-${a}-${b}`}
                          x1={pa.x}
                          y1={pa.y}
                          x2={pb.x}
                          y2={pb.y}
                          className="minimap-edge"
                        />
                      );
                    })}

                    {/* 구역 노드 */}
                    {z.map((zone) => {
                    const id = String(zone?.zoneId || '');
                    const p = zonePos?.[id];
                    if (!id || !p) return null;
                    const isF = forbiddenNow.has(id);
                    const isSelZone = !!selectedZoneId && selectedZoneId === id;
                    const nm = String(getZoneName(id) || id);
                    const aliveHere = aliveByZone[id]?.length || 0;
                    const deadHere = deadByZone[id]?.length || 0;

                    return (
                      <g key={`z-${id}`}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={6.2}
                          className={`minimap-node ${isF ? 'forbidden' : ''} ${isSelZone ? 'selected' : ''}`}
                        />
                        {/* 배경 지도(하이퍼루프 이미지)에 이미 지역명이 있으므로, SVG 텍스트 라벨은 숨긴다. */}
                        <title>{nm}</title>

                        {/* 하이퍼루프 패드 */}
                        {String(hyperloopPadZoneId || '') === id ? (
                          <text x={p.x + 6.2} y={p.y - 5.0} textAnchor="middle" fontSize="5.0" fill="rgba(180,220,255,0.92)">🌀</text>
                        ) : null}

                        {/* 생존/사망 수 */}
                        {(aliveHere > 0 || deadHere > 0) ? (
                          <text
                            x={p.x}
                            y={p.y + 7.2}
                            textAnchor="middle"
                            fontSize="3.0"
                            fill="rgba(255,255,255,0.72)"
                          >
                            {aliveHere > 0 ? `+${aliveHere}` : ''}{deadHere > 0 ? ` / -${deadHere}` : ''}
                          </text>
                        ) : null}

                        {/* 캐릭터 마커 */}
                        {(aliveByZone[id] || []).slice(0, 12).map((c, idx) => {
                          const o = OFF[idx % OFF.length];
                          const cx = p.x + o[0] * 0.55;
                          const cy = p.y + o[1] * 0.55;
                          const isSel = String(c?._id || '') === String(hyperloopCharId || '');
                          return (
                            <g key={`a-${id}-${c._id || idx}`}>
                              {isSel ? (
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={2.2}
                                  fill="none"
                                  stroke="rgba(255,215,0,0.92)"
                                  strokeWidth="0.8"
                                />
                              ) : null}
                              <circle
                                cx={cx}
                                cy={cy}
                                r={1.35}
                                fill={isSel ? 'rgba(255,215,0,0.95)' : 'rgba(255,255,255,0.92)'}
                                stroke="rgba(0,0,0,0.35)"
                                strokeWidth="0.35"
                              />
                              {isSel ? (
                                <text
                                  x={cx + 1.9}
                                  y={cy - 1.2}
                                  textAnchor="middle"
                                  fontSize="3.6"
                                  fill="rgba(255,215,0,0.95)"
                                >
                                  ★
                                </text>
                              ) : null}
                            </g>
                          );
                        })}                        {(deadByZone[id] || []).slice(0, 8).map((c, idx) => {
                          const o = OFF[(idx + 2) % OFF.length];
                          return (
                            <circle
                              key={`d-${id}-${c._id || idx}`}
                              cx={p.x + o[0] * 0.55}
                              cy={p.y + o[1] * 0.55}
                              r={0.85}
                              fill="rgba(170,170,170,0.70)"
                              stroke="rgba(0,0,0,0.28)"
                              strokeWidth="0.35"
                            />
                          );
                        })}
                      </g>
                    );
                  })}
                  </svg>
                </div>
              );
            })()}
            <div className="minimap-legend">
              <span className="minimap-dot alive" /> 생존자 · <span className="minimap-dot dead" /> 사망자 · <span className="minimap-dot forbidden" /> 금지구역 · ⭐ 하이퍼루프 대상
            </div>

            {day > 0 && hyperloopDestIds.length ? (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.22)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ opacity: 0.9 }} title="하이퍼루프는 맵 내 장치(패드)에서만 사용 가능">
                    🌀 하이퍼루프
                  </span>
                  <span style={{ opacity: 0.9 }}>
                    패드: <b>{hyperloopPadName || hyperloopPadZoneId || '자동'}</b>
                  </span>

                  {isSelectedCharOnHyperloopPad ? (
                    <>
                      <select
                        value={hyperloopDestId}
                        onChange={(e) => setHyperloopDestId(e.target.value)}
                        disabled={loading || isAdvancing || isGameOver}
                        title="어드민(맵)에서 설정한 하이퍼루프 목적지(로컬 저장)"
                        style={{
                          padding: '6px 8px',
                          fontSize: 12,
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.18)',
                          background: 'rgba(0,0,0,0.20)',
                          color: '#fff',
                        }}
                      >
                        {hyperloopDestIds.map((id) => {
                          const m = (Array.isArray(maps) ? maps : []).find((x) => String(x?._id) === String(id)) || null;
                          return (
                            <option key={`hl-mm-${id}`} value={id} style={{ color: '#000' }}>
                              {m?.name || id}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        className="btn-secondary"
                        onClick={() => doHyperloopJump(hyperloopDestId, selectedCharId)}
                        disabled={loading || isAdvancing || isGameOver || !hyperloopDestId || !selectedCharId}
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        title="하이퍼루프: 선택 캐릭터만 목적지 맵으로 즉시 이동"
                      >
                        🌀 이동
                      </button>
                    </>
                  ) : (
                    <span style={{ opacity: 0.75 }} title="선택 캐릭터가 패드 구역에 있어야 사용할 수 있습니다.">
                      선택 캐릭터가 패드 구역에 있어야 사용 가능
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className={`log-window ${uiModal === 'log' ? 'modal-open' : ''}`} ref={logWindowRef} style={{ minWidth: 0 }}>
            {uiModal === 'log' ? (<button className="eh-modal-close" onClick={closeUiModal} aria-label="닫기">✕</button>) : null}
            <div className="log-content">
              {day > 0 && (
                <div className="log-top-status">
                  <div className="log-top-row">
                    <span className="log-top-label">🚫 금지구역</span>
                    <span className="log-top-value">{forbiddenNow.size ? Array.from(forbiddenNow).map((z) => getZoneName(z)).join(', ') : '없음'}</span>
                  </div>
                  {forbiddenNow.size ? (
                    <div className="log-top-sub">
                      {(() => {
                        const total = Array.isArray(activeMap?.zones) ? activeMap.zones.length : (Array.isArray(zones) ? zones.length : 0);
                        const safeLeft = Math.max(0, total - forbiddenNow.size);
                        const detForceAll = Math.max(0, Number(getRuleset(settings?.rulesetId)?.detonation?.forceAllAfterSec ?? 40));
                        const extra = safeLeft <= 2 ? ` · 안전구역 2곳 남음 → ${detForceAll}s 후 전구역 위험(타이머 감소)` : '';
                        return `안전구역 ${safeLeft}곳 남음${extra}`;
                      })()}
                    </div>
                  ) : null}
                  {Array.isArray(forbiddenAddedNow) && forbiddenAddedNow.length ? (
                    <div className="log-top-sub">➕ 이번 페이즈 신규: {forbiddenAddedNow.map((z) => getZoneName(z)).join(', ')}</div>
                  ) : null}
                </div>
              )}
              {Array.isArray(prevPhaseLogs) && prevPhaseLogs.length ? (
                <div className="prevlogs-row">
                  <button
                    className="prevlogs-btn"
                    onClick={() => setShowPrevLogs((v) => !v)}
                    title="이전 페이즈 로그를 펼치거나 숨깁니다(설정은 저장됩니다)."
                  >
                    {showPrevLogs ? '이전 페이즈 로그 숨기기' : '이전 페이즈 로그 보기'}
                  </button>
                </div>
              ) : null}

              {showPrevLogs && Array.isArray(prevPhaseLogs) && prevPhaseLogs.length ? (
                <div className="prevlogs-box">
                  <div className="prevlogs-scroll">
                    {prevPhaseLogs.map((log, idx) => (
                      (() => {
                        const who = extractActorNameFromLog(log.text);
                        const avatar = who ? actorAvatarByName[who] : '';
                        return (
                      <div
                        key={`prev-${log.id || idx}`}
                        className={`log-message ${log.type || 'system'}`}
                        style={{
                          maxWidth: '100%',
                          whiteSpace: 'pre-line',
                          overflowWrap: 'anywhere',
                          wordBreak: 'keep-all',
                          lineHeight: 1.45,
                          opacity: 0.9,
                        }}
                      >
                        {avatar ? <img className="log-avatar" src={avatar} alt={who} /> : null}
                        <div className="log-text">{log.text}</div>
                      </div>
                        );
                      })()
                    ))}
                  </div>
                </div>
	              ) : null}

              <div className="log-scroll-area" ref={logBoxRef} style={{ maxHeight: logBoxMaxH }}>
                {logs.map((log, idx) => (
                  (() => {
                    const who = extractActorNameFromLog(log.text);
                    const avatar = who ? actorAvatarByName[who] : '';
                    return (
                  <div
                    key={log.id || idx}
                    className={`log-message ${log.type || 'system'}`}
                    style={{
                      maxWidth: '100%',
                      whiteSpace: 'pre-line',
                      overflowWrap: 'anywhere',
                      wordBreak: 'keep-all',
                      lineHeight: 1.45,
                    }}
                  >
                    {avatar ? <img className="log-avatar" src={avatar} alt={who} /> : null}
                    <div className="log-text">{log.text}</div>
                  </div>
                    );
                  })()
                ))}
              </div>
            </div>
          </div>

          <div className="control-panel">
            <div className="control-row">
              {isGameOver ? (
                <button className="btn-restart" onClick={() => window.location.reload()}>🔄 다시 하기</button>
              ) : (
                <button
                  className="btn-proceed"
                  onClick={proceedPhaseGuarded}
                  disabled={loading || isAdvancing || (day === 0 && survivors.length < 2) || (showMarketPanel && !!pendingTranscendPick)}
                  style={{ opacity: loading || isAdvancing || (day === 0 && survivors.length < 2) || (showMarketPanel && !!pendingTranscendPick) ? 0.5 : 1 }}
                >
                  {loading
                    ? '⏳ 로딩 중...'
                    : isAdvancing
                      ? '⏩ 진행 중...'
                      : survivors.length < 2 && day === 0
                        ? '⚠️ 인원 부족 (2명↑)'
                        : day === 0
                          ? '🔥 게임 시작'
                          : survivors.length <= 1
                            ? '🏆 결과 확인하기'
                            : phase === 'morning'
                              ? (day >= 6 ? '🔥 서든데스 진행' : '🌙 밤으로 진행')
                              : (day >= 6 ? '🔥 서든데스 진행' : '🌞 다음 날 낮으로 진행')}
                </button>
              )}

              <button
                className="btn-secondary"
                onClick={() => setShowMarketPanel((v) => !v)}
                title="관전자 모드에서는 기본적으로 숨겨두고, 테스트할 때만 열어쓰세요."
              >
                {showMarketPanel ? '🛠 개발자 도구 닫기' : '🛠 개발자 도구'}
              </button>

              <button
                className="btn-secondary"
                onClick={() => setAutoPlay((v) => !v)}
                disabled={loading || isGameOver || (day === 0 && survivors.length < 2)}
                title="오토 플레이: 다음 페이즈 버튼을 자동으로 눌러 진행합니다(페이즈 내부는 틱 엔진으로 계산)."
              >
                {autoPlay ? '⏸ 오토' : '▶ 오토'}
              </button>

              <select
                className="autoplay-speed"
                value={autoSpeed}
                onChange={(e) => setAutoSpeed(Number(e.target.value))}
                disabled={loading || isGameOver}
                title="오토 플레이 배속(페이즈 간 템포)"
              >
                <option value={0.5}>x0.5</option>
                <option value={1}>x1</option>
                <option value={2}>x2</option>
                <option value={4}>x4</option>
              </select>
            </div>
          </div>
        </section>

        {/* 🧪 상점/조합/교환 패널 (테스트/디버그용, 기본 숨김) */}
        {showMarketPanel ? (
        <aside className="market-panel">
          <div className="market-header">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <h2 style={{ margin: 0 }}>상점/조합/교환</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>                <button className="market-close" onClick={() => setShowMarketPanel(false)} title="패널 닫기">✕</button>
              </div>
            </div>

            <div className="market-row" style={{ marginTop: 10 }}>
              <div className="market-small">사용 캐릭터</div>
              <select value={selectedCharId} onChange={(e) => setSelectedCharId(e.target.value)} style={{ width: '100%' }}>
                <option value="">(선택)</option>
                {survivors.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">🎲 시드(재현)</div>
              <div className="market-small">같은 시드면 랜덤 결과가 재현됩니다. (게임 시작 전에만 변경 권장)</div>
              <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
                <input
                  value={seedDraft}
                  onChange={(e) => setSeedDraft(e.target.value)}
                  placeholder="예) 1700000000000"
                  style={{ width: '100%' }}
                  disabled={isAdvancing || isGameOver}
                />
                <button
                  className="market-mini-btn"
                  onClick={() => setRunSeed(String(seedDraft || '').trim() || String(Date.now()))}
                  disabled={isAdvancing || isGameOver || day !== 0 || matchSec !== 0}
                  title={(day !== 0 || matchSec !== 0) ? '게임 시작 후에는 변경을 권장하지 않습니다.' : ''}
                >
                  적용
                </button>
                <button
                  className="market-mini-btn"
                  onClick={() => { const n = String(Date.now()); setSeedDraft(n); setRunSeed(n); }}
                  disabled={isAdvancing || isGameOver || day !== 0 || matchSec !== 0}
                >
                  새 시드
                </button>
              </div>
              <div className="market-small">현재: <strong>{runSeed}</strong></div>
            </div>

            <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">🧾 이벤트 로그(JSON)</div>
              <div className="market-small">runEvents: <strong>{runEvents.length}</strong>개 (최근 200개만 표시)</div>
              <textarea
                readOnly
                value={JSON.stringify((Array.isArray(runEvents) ? runEvents : []).slice(-200), null, 2)}
                style={{ width: '100%', minHeight: 160, marginTop: 8 }}
              />
              <div className="market-actions" style={{ marginTop: 8 }}>
                <button
                  onClick={() => {
                    try {
                      navigator.clipboard?.writeText(JSON.stringify(runEvents, null, 2));
                      addLog('✅ 이벤트 로그 복사 완료', 'system');
                    } catch (e) {
                      addLog('⚠️ 이벤트 로그 복사 실패', 'death');
                    }
                  }}
                  disabled={!runEvents.length}
                >
                  전체 복사
                </button>
              </div>
            </div>

            <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">🌍 런 전체 요약</div>
              <div className="market-small">drone: <b>{Number(runProgressSummary?.droneCalls || 0)}</b> / kiosk: <b>{Number(runProgressSummary?.kioskGains || 0)}</b> / craft: <b>{Number(runProgressSummary?.craftCount || 0)}</b></div>
              <div className="market-small" style={{ marginTop: 6 }}>legend chars: <b>{Number(runProgressSummary?.legendCount || 0)}</b> / transcend chars: <b>{Number(runProgressSummary?.transCount || 0)}</b></div>
              <div className="market-small" style={{ marginTop: 6 }}>death: <b>{Number(runProgressSummary?.totalDeaths || 0)}</b> / revive: <b>{Number(runProgressSummary?.totalRevives || 0)}</b> / flee: <b>{Number(runProgressSummary?.totalFlees || 0)}</b></div>
              <div className="market-small" style={{ marginTop: 6 }}>revive ratio: <b>{Number(runProgressSummary?.reviveRate || 0).toFixed(2)}</b> / flee ratio: <b>{Number(runProgressSummary?.fleeRate || 0).toFixed(2)}</b></div>
              <div className="market-small" style={{ marginTop: 6 }}>legend pace: <b>{String(runProgressSummary?.legendPace || 'pending')}</b> / transcend pace: <b>{String(runProgressSummary?.transPace || 'pending')}</b></div>
              <div className="market-small" style={{ marginTop: 6 }}>first legend: {String(runProgressSummary?.firstLegendText || '-')} / first transcend: {String(runProgressSummary?.firstTransText || '-')}</div>
              <div className="market-small" style={{ marginTop: 6 }}>latest legend: {String(runProgressSummary?.latestLegendText || '-')} / latest transcend: {String(runProgressSummary?.latestTransText || '-')}</div>
            </div>


            <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">🩹 사용/상태 요약</div>
              <div className="market-small">{runSupportSummary?.line}</div>
              {runSupportSummary?.topItems ? (
                <div className="market-small" style={{ marginTop: 6 }}>top use: {runSupportSummary.topItems}</div>
              ) : null}
              {runSupportSummary?.topEffects ? (
                <div className="market-small" style={{ marginTop: 6 }}>top effects: {runSupportSummary.topEffects}</div>
              ) : null}
            </div>

            <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">⏱️ 행동 큐/추격 요약</div>
              <div className="market-small">{runActionSummary?.line}</div>
              <div className="market-small" style={{ marginTop: 6 }}>{runActionSummary?.chaseLine}</div>
              {runActionSummary?.tuningLine ? (
                <div className="market-small" style={{ marginTop: 6 }}>{runActionSummary.tuningLine}</div>
              ) : null}
              {runActionSummary?.topBlocked ? (
                <div className="market-small" style={{ marginTop: 6 }}>top blocked: {runActionSummary.topBlocked}</div>
              ) : null}
              {runActionSummary?.topDeferred ? (
                <div className="market-small" style={{ marginTop: 6 }}>top deferred: {runActionSummary.topDeferred}</div>
              ) : null}
            </div>

            {pendingTranscendPick ? (
              <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                <div className="market-title">🎁 초월 장비 선택 상자(대기)</div>
                <div className="market-small">[{pendingTranscendPick.characterName || pendingTranscendPick.characterId}] {getZoneName(pendingTranscendPick.zoneId)} · 선택 완료 전에는 진행이 잠깁니다.</div>
                <div className="market-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  {(Array.isArray(pendingTranscendPick.options) ? pendingTranscendPick.options : []).map((o, idx) => {
                    const it = (Array.isArray(publicItems) ? publicItems : []).find((x) => String(x?._id) === String(o?.itemId)) || null;
                    const nm = itemDisplayName(it || { _id: o?.itemId, name: o?.name });
                    const tierText = tierLabelKo(clampTier4(it?.tier ?? o?.tier ?? 4));
                    const slotText = String(it?.equipSlot || o?.slot || '');
                    return (
                      <button
                        key={`tp-${pendingTranscendPick.id || 'p'}-${String(o?.itemId || idx)}`}
                        onClick={() => resolvePendingTranscendPick(idx, 'manual')}
                        disabled={isAdvancing || isGameOver}
                      >
                        {itemIcon(it)} {nm} ({tierText}{slotText ? `/${slotText}` : ''})
                      </button>
                    );
                  })}
                  <button onClick={() => resolvePendingTranscendPick(-1, 'auto')} disabled={isAdvancing || isGameOver}>자동(추천)</button>
                </div>
              </div>
            ) : null}
            {/* 🛠 개발자 도구: 유저가 선택 캐릭터에게 소모품을 임의로 사용 */}
            {selectedCharId && selectedChar ? (() => {
              const list = (Array.isArray(selectedChar.inventory) ? selectedChar.inventory : [])
                .map((it, idx) => ({ it, idx }))
                .filter((x) => inferItemCategory(x.it) === 'consumable');

              return (
                <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                  <div className="market-title">🧪 소모품 강제 사용(개발자)</div>
                  <div className="market-small">시뮬은 기본적으로 플레이어가 자동 사용합니다. 이 영역은 개발자 도구가 켜졌을 때만 노출됩니다.</div>
                  <div className="market-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                    {list.length === 0 ? (
                      <div className="market-small">소모품이 없습니다.</div>
                    ) : (
                      list.slice(0, 12).map(({ it, idx }) => {
                        const q = Math.max(1, Number(it?.qty || 1));
                        return (
                          <button
                            key={`dev-cons-${idx}-${String(it?._id || it?.itemId || '')}`}
                            onClick={() => devForceUseConsumable(selectedCharId, idx)}
                            disabled={isAdvancing || isGameOver}
                            title={isAdvancing ? '진행 중에는 사용할 수 없습니다.' : '개발자 도구: 임의로 사용'}
                          >
                            {itemIcon(it)} {itemDisplayName(it)}{q > 1 ? ` x${q}` : ''}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })() : null}

            {selectedCharId && selectedChar ? (() => {
              const dbg = selectedChar?._craftDebug || null;
              return (
                <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                  <div className="market-title">🧪 제작 디버그</div>
                  {!dbg ? (
                    <div className="market-small">아직 제작 판정 로그가 없습니다.</div>
                  ) : (
                    <>
                      <div className="market-small">code: <b>{String(dbg?.code || '-')}</b>{dbg?.targetName ? ` / target: ${dbg.targetName}` : ''}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>{String(dbg?.text || '')}</div>
                      {Array.isArray(dbg?.missing) && dbg.missing.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>missing: {dbg.missing.slice(0, 5).join(', ')}</div>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })() : null}

            {selectedCharId && selectedChar ? (() => {
              const ai = selectedChar?._aiDebug || null;
              return (
                <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                  <div className="market-title">🤖 AI 디버그</div>
                  {!ai ? (
                    <div className="market-small">아직 AI 판단 로그가 없습니다.</div>
                  ) : (
                    <>
                      <div className="market-small">action: <b>{String(ai?.action || '-')}</b>{ai?.itemName ? ` / item: ${ai.itemName}` : ''}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>zone: {String(ai?.zoneName || '-')} {ai?.targetZoneName ? `→ ${ai.targetZoneName}` : ''}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>reason: {String(ai?.reason || '-')}</div>
                      {Array.isArray(ai?.queuePreview) && ai.queuePreview.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>queue: {ai.queuePreview.join(' → ')}</div>
                      ) : null}
                      {Array.isArray(ai?.candidatePreview) && ai.candidatePreview.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>candidates: {ai.candidatePreview.join(' > ')}</div>
                      ) : null}
                      {Array.isArray(ai?.candidateScores) && ai.candidateScores.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>scores: {ai.candidateScores.join(' | ')}</div>
                      ) : null}
                      {Array.isArray(ai?.blockedReasons) && ai.blockedReasons.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>blocked: {ai.blockedReasons.join(', ')}</div>
                      ) : null}
                      {ai?.goalName ? <div className="market-small" style={{ marginTop: 6 }}>goal: {String(ai.goalName)}</div> : null}
                      {Array.isArray(ai?.missingNames) && ai.missingNames.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>missing: {ai.missingNames.join(', ')}</div>
                      ) : null}
                      <div className="market-small" style={{ marginTop: 6 }}>
                        late: {ai?.wantLegend ? '전설 ' : ''}{ai?.wantTrans ? '초월 ' : ''}{ai?.farmCredits ? '/ 크레딧 파밍' : ''}{!ai?.wantLegend && !ai?.wantTrans && !ai?.farmCredits ? '일반 성장' : ''}
                      </div>
                      {ai?.fleeReason ? <div className="market-small" style={{ marginTop: 6 }}>flee: {String(ai.fleeReason)}</div> : null}
                    </>
                  )}
                </div>
              );
            })() : null}

            {selectedCharId && selectedChar ? (() => {
              const rp = runProgressSummary || null;
              return (
                <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                  <div className="market-title">📈 런 메트릭</div>
                  {!rp ? (
                    <div className="market-small">아직 메트릭이 없습니다.</div>
                  ) : (
                    <>
                      <div className="market-small">drone: <b>{Number(rp?.droneCalls || 0)}</b> / kiosk: <b>{Number(rp?.kioskGains || 0)}</b> / craft: <b>{Number(rp?.craftCount || 0)}</b></div>
                      <div className="market-small" style={{ marginTop: 6 }}>first legend: {String(rp?.firstLegendText || '-')}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>first transcend: {String(rp?.firstTransText || '-')}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>latest legend: {String(rp?.latestLegendText || '-')}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>latest transcend: {String(rp?.latestTransText || '-')}</div>
                    </>
                  )}
                </div>
              );
            })() : null}

            {/* 🎒 장비 장착/해제 (개발자/관전자) */}
            {selectedCharId && selectedChar ? (() => {
              const eq = ensureEquipped(selectedChar);
              const inv = Array.isArray(selectedChar?.inventory) ? selectedChar.inventory : [];
              const list = inv
                .map((it, idx) => ({ it, idx }))
                .map(({ it, idx }) => {
                  const category = String(it?.category || inferItemCategory(it));
                  const slot = String(it?.equipSlot || inferEquipSlot(it));
                  const itemId = getInvItemId(it);
                  const isEquip = category === 'equipment' && slot && EQUIP_SLOTS.includes(String(slot));
                  return { it, idx, slot, itemId, isEquip };
                })
                .filter((x) => x.isEquip && x.itemId);

              return (
                <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                  <div className="market-title">🎒 장비 장착/해제</div>
                  <div className="market-small">무기/방어구는 장착 상태(equipped)를 우선 적용합니다.</div>
                  <div className="market-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                    {list.length === 0 ? (
                      <div className="market-small">장착 가능한 장비가 없습니다.</div>
                    ) : (
                      list.slice(0, 30).map(({ it, idx, slot, itemId }) => {
                        const tierText = tierLabelKo(clampTier4(it?.tier || 1));
                        const nm = itemDisplayName(it);
                        const equipped = String(eq?.[slot] || '') === String(itemId);
                        return (
                          <div key={`eq-${idx}-${itemId}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{itemIcon(it)}</span>
                            <span style={{ fontWeight: 800 }}>{nm}</span>
                            <span className="market-small">({tierText}{slot ? `/${slot}` : ''})</span>
                            <button
                              className={`invEquipBtn ${equipped ? 'off' : 'on'}`}
                              onClick={() => setEquipForSurvivor(selectedCharId, slot, equipped ? null : itemId)}
                              disabled={isAdvancing || isGameOver}
                            >
                              {equipped ? '해제' : '장착'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })() : null}

            <div className="market-tabs">
              <button className={`market-tab ${marketTab === 'craft' ? 'active' : ''}`} onClick={() => setMarketTab('craft')}>🛠️ 조합</button>
              <button className={`market-tab ${marketTab === 'kiosk' ? 'active' : ''}`} onClick={() => setMarketTab('kiosk')}>🏪 키오스크</button>
              <button className={`market-tab ${marketTab === 'drone' ? 'active' : ''}`} onClick={() => setMarketTab('drone')}>🚁 드론</button>
              <button className={`market-tab ${marketTab === 'perk' ? 'active' : ''}`} onClick={() => setMarketTab('perk')}>🎖️ 특전</button>
              <button className={`market-tab ${marketTab === 'trade' ? 'active' : ''}`} onClick={() => setMarketTab('trade')}>🔁 교환</button>
            </div>

            <div className="market-card" style={{ marginTop: 10 }}>
              <div className="market-row">
                <div>
                  <div className="market-title">💳 계정 진행</div>
                  <div className="market-small" style={{ marginTop: 6 }}>현재 보유 크레딧 {Number(credits || 0)} Cr · LP {Number(viewerLp || 0)} · 보유 특전 {Number((Array.isArray(viewerPerks) ? viewerPerks.length : 0) || 0)}개</div>
                  {activeViewerPerkBundle?.summary ? (<div className="market-small">적용 중: {activeViewerPerkBundle.summary}</div>) : null}
                </div>
                <button onClick={() => Promise.allSettled([syncMyState(), loadMarket()])} className="market-mini-btn">동기화</button>
              </div>
            </div>

            {marketMessage ? (
              <div className="market-card" style={{ borderColor: '#ffcdd2', background: '#fff5f5' }}>
                <div style={{ fontWeight: 800, color: '#c62828' }}>알림</div>
                <div className="market-small" style={{ marginTop: 6, color: '#c62828' }}>{marketMessage}</div>
              </div>
            ) : null}
          </div>

          {marketTab === 'craft' ? (
            <div className="market-section">
              <div className="market-small" style={{ marginBottom: 8 }}>레시피가 있는 아이템만 표시됩니다.</div>
              {craftables.length === 0 ? (
                <div className="market-card">조합 가능한 아이템이 없습니다. (관리자에서 레시피를 등록하세요)</div>
              ) : (
                craftables.map((it) => (
                  <div key={it._id} className="market-card">
                    <div className="market-row">
                      <div>
                        <div className="market-title">{it.name}</div>
                        <div className="market-small">tier {it.tier || 1} · {it.rarity || 'common'} · 비용 {Number(it?.recipe?.creditsCost || 0)} Cr</div>
                      </div>
                    </div>

                    <div className="market-small" style={{ marginTop: 8 }}>
                      재료: {(it.recipe.ingredients || []).map((ing) => {
                        const ingId = String(ing.itemId);
                        const ingName = itemNameById[ingId] || ingId;
                        return `${ingName} x${Number(ing.qty || 1)}`;
                      }).join(', ')}
                    </div>

                    <div className="market-actions" style={{ marginTop: 10 }}>
                      <input
                        type="number"
                        min={1}
                        value={getQty(`craft:${it._id}`, 1)}
                        onChange={(e) => setQty(`craft:${it._id}`, e.target.value)}
                      />
                      <button onClick={() => doCraft(it._id)} disabled={!selectedCharId}>조합</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {marketTab === 'kiosk' ? (
            <div className="market-section">
              {kiosks.length === 0 ? (
                <div className="market-card">키오스크가 없습니다. (관리자에서 키오스크/카탈로그를 등록하세요)</div>
              ) : (
                kiosks.map((k) => (
                  <div key={k._id} className="market-card">
                    <div className="market-row">
                      <div>
                        <div className="market-title">{k.name || '키오스크'}</div>
                        <div className="market-small">위치: {k.mapId?.name || '미지정'}</div>
                      </div>
                      <button onClick={() => loadMarket()} className="market-mini-btn">새로고침</button>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      {(Array.isArray(k.catalog) ? k.catalog : []).map((entry, idx) => {
                        const mode = entry.mode || 'sell';
                        const label = mode === 'sell' ? '구매' : mode === 'buy' ? '판매' : '교환';
                        const price = Math.max(0, Number(entry.priceCredits || 0));

                        const itemId = entry.itemId?._id || entry.itemId;
                        const itemName = entry.itemId?.name || itemNameById[String(itemId)] || String(itemId || '미지정');

                        const exId = entry.exchange?.giveItemId?._id || entry.exchange?.giveItemId;
                        const exName = entry.exchange?.giveItemId?.name || (exId ? (itemNameById[String(exId)] || String(exId)) : '');
                        const exQty = Number(entry.exchange?.giveQty || 1);

                        return (
                          <div key={idx} className="market-subcard">
                            <div className="market-row">
                              <div>
                                <div className="market-title">{label}: {itemName}</div>
                                <div className="market-small">
                                  {mode === 'exchange'
                                    ? `재료: ${exName || '미지정'} x${exQty}`
                                    : `단가: ${price} Cr`}
                                </div>
                              </div>
                            </div>

                            <div className="market-actions" style={{ marginTop: 8 }}>
                              <input
                                type="number"
                                min={1}
                                value={getQty(`kiosk:${k._id}:${idx}`, 1)}
                                onChange={(e) => setQty(`kiosk:${k._id}:${idx}`, e.target.value)}
                              />
                              <button onClick={() => doKioskTransaction(k._id, idx)} disabled={!selectedCharId || !itemId}>실행</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {marketTab === 'drone' ? (
            <div className="market-section">
              {droneOffers.length === 0 ? (
                <div className="market-card">드론 판매 목록이 없습니다. (관리자에서 드론 판매를 등록하세요)</div>
              ) : (
                droneOffers.map((o) => (
                  <div key={o._id} className="market-card">
                    <div className="market-row">
                      <div>
                        <div className="market-title">{o.itemId?.name || '아이템'}</div>
                        <div className="market-small">가격: {Math.max(0, Number(o.priceCredits || 0))} Cr · 티어 제한 ≤ {Number(o.maxTier || 1)}</div>
                      </div>
                      <button onClick={() => loadMarket()} className="market-mini-btn">새로고침</button>
                    </div>
                    <div className="market-actions" style={{ marginTop: 10 }}>
                      <input
                        type="number"
                        min={1}
                        value={getQty(`drone:${o._id}`, 1)}
                        onChange={(e) => setQty(`drone:${o._id}`, e.target.value)}
                      />
                      <button onClick={() => doDroneBuy(o._id)} disabled={!selectedCharId}>구매</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {marketTab === 'perk' ? (
            <div className="market-section">
              <div className="market-small" style={{ marginBottom: 8 }}>계정 단위 특전입니다. 구매 후 홈/시뮬 모두 즉시 반영됩니다.</div>
              {publicPerks.length === 0 ? (
                <div className="market-card">활성 특전이 없습니다. (관리자에서 특전을 등록하세요)</div>
              ) : (
                publicPerks.map((perk) => {
                  const code = String(perk?.code || '');
                  const owned = ownedPerkCodeSet.has(code);
                  const cost = Math.max(0, Number(perk?.lpCost || 0));
                  const desc = String(perk?.description || perk?.effectText || perk?.summary || '').trim();
                  return (
                    <div key={perk?._id || code} className="market-card">
                      <div className="market-row">
                        <div>
                          <div className="market-title">{perk?.name || code || '특전'}</div>
                          <div className="market-small">코드: {code || '-'} · 비용: {cost} LP{perk?.category ? ` · ${perk.category}` : ''}</div>
                        </div>
                        <button onClick={() => loadMarket()} className="market-mini-btn">새로고침</button>
                      </div>
                      {desc ? <div className="market-small" style={{ marginTop: 8 }}>{desc}</div> : null}
                      <div className="market-actions" style={{ marginTop: 10 }}>
                        <button onClick={() => doPerkPurchase(code)} disabled={!code || owned || Number(viewerLp || 0) < cost}>
                          {owned ? '보유 중' : `구매 (${cost} LP)`}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}

          {marketTab === 'trade' ? (
            <div className="market-section">
              <div className="market-row" style={{ marginBottom: 8 }}>
                <div className="market-small">오픈 오퍼</div>
                <button onClick={loadTrades} className="market-mini-btn">새로고침</button>
              </div>

              {tradeOffers.length === 0 ? (
                <div className="market-card">현재 오픈 오퍼가 없습니다.</div>
              ) : (
                tradeOffers.map((off) => (
                  <div key={off._id} className="market-card">
                    <div className="market-title">{off.fromCharacterId?.name || '상대'}의 오퍼</div>
                    <div className="market-small" style={{ marginTop: 6 }}>
                      주는 것: {(Array.isArray(off.give) ? off.give : []).map((g) => `${g.itemId?.name || g.itemId} x${g.qty}`).join(', ')}
                    </div>
                    <div className="market-small" style={{ marginTop: 4 }}>
                      원하는 것: {(Array.isArray(off.want) ? off.want : []).length
                        ? (Array.isArray(off.want) ? off.want : []).map((w) => `${w.itemId?.name || w.itemId} x${w.qty}`).join(', ')
                        : '없음'}
                      {Number(off.wantCredits || 0) > 0 ? ` + ${Number(off.wantCredits)} Cr` : ''}
                    </div>
                    {off.note ? <div className="market-small" style={{ marginTop: 6 }}>메모: {off.note}</div> : null}

                    <div className="market-actions" style={{ marginTop: 10 }}>
                      <button onClick={() => acceptTradeOffer(off._id)} disabled={!selectedCharId || String(off?.fromCharacterId?._id || '') === String(selectedCharId)}>수락</button>
                    </div>
                  </div>
                ))
              )}

              <div className="market-row" style={{ marginTop: 16, marginBottom: 8 }}>
                <div className="market-small">내 오퍼</div>
                <button onClick={loadTrades} className="market-mini-btn">새로고침</button>
              </div>

              {myTradeOffers.length === 0 ? (
                <div className="market-card">내 오퍼가 없습니다.</div>
              ) : (
                myTradeOffers.map((off) => (
                  <div key={off._id} className="market-card">
                    <div className="market-title">상태: {off.status}</div>
                    <div className="market-small" style={{ marginTop: 6 }}>
                      주는 것: {(Array.isArray(off.give) ? off.give : []).map((g) => `${g.itemId?.name || g.itemId} x${g.qty}`).join(', ')}
                    </div>
                    <div className="market-small" style={{ marginTop: 4 }}>
                      원하는 것: {(Array.isArray(off.want) ? off.want : []).length
                        ? (Array.isArray(off.want) ? off.want : []).map((w) => `${w.itemId?.name || w.itemId} x${w.qty}`).join(', ')
                        : '없음'}
                      {Number(off.wantCredits || 0) > 0 ? ` + ${Number(off.wantCredits)} Cr` : ''}
                    </div>
                    <div className="market-actions" style={{ marginTop: 10 }}>
                      {off.status === 'open' ? (
                        <button onClick={() => cancelTradeOffer(off._id)}>취소</button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}

              <div className="market-card" style={{ marginTop: 18 }}>
                <div className="market-title">오퍼 생성</div>
                <div className="market-small" style={{ marginTop: 6 }}>선택한 캐릭터 인벤토리에서 give를 고르고, 원하는 아이템/크레딧을 설정하세요.</div>

                <div style={{ marginTop: 12 }}>
                  <div className="market-small" style={{ fontWeight: 800 }}>주는 것 (give)</div>
                  {(Array.isArray(tradeDraft.give) ? tradeDraft.give : []).map((row, idx) => (
                    <div key={idx} className="market-row" style={{ marginTop: 8, gap: 8 }}>
                      <select
                        value={row.itemId}
                        onChange={(e) => {
                          const next = [...tradeDraft.give];
                          next[idx] = { ...next[idx], itemId: e.target.value };
                          setTradeDraft({ ...tradeDraft, give: next });
                        }}
                        style={{ flex: 1 }}
                      >
                        <option value="">(선택)</option>
                        {inventoryOptions.map((it) => (
                          <option key={it.itemId} value={it.itemId}>{it.name} (보유 {it.qty})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={row.qty}
                        onChange={(e) => {
                          const next = [...tradeDraft.give];
                          next[idx] = { ...next[idx], qty: e.target.value };
                          setTradeDraft({ ...tradeDraft, give: next });
                        }}
                        style={{ width: 70 }}
                      />
                      <button
                        className="market-mini-btn"
                        onClick={() => {
                          const next = tradeDraft.give.filter((_, i) => i !== idx);
                          setTradeDraft({ ...tradeDraft, give: next.length ? next : [{ itemId: '', qty: 1 }] });
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <button
                    className="market-mini-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => setTradeDraft({ ...tradeDraft, give: [...tradeDraft.give, { itemId: '', qty: 1 }] })}
                  >
                    + give 추가
                  </button>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="market-small" style={{ fontWeight: 800 }}>원하는 것 (want)</div>
                  {(Array.isArray(tradeDraft.want) ? tradeDraft.want : []).map((row, idx) => (
                    <div key={idx} className="market-row" style={{ marginTop: 8, gap: 8 }}>
                      <select
                        value={row.itemId}
                        onChange={(e) => {
                          const next = [...tradeDraft.want];
                          next[idx] = { ...next[idx], itemId: e.target.value };
                          setTradeDraft({ ...tradeDraft, want: next });
                        }}
                        style={{ flex: 1 }}
                      >
                        <option value="">(선택 안 함)</option>
                        {publicItems.map((it) => (
                          <option key={it._id} value={it._id}>{it.name} (tier {it.tier || 1})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={row.qty}
                        onChange={(e) => {
                          const next = [...tradeDraft.want];
                          next[idx] = { ...next[idx], qty: e.target.value };
                          setTradeDraft({ ...tradeDraft, want: next });
                        }}
                        style={{ width: 70 }}
                      />
                      <button
                        className="market-mini-btn"
                        onClick={() => {
                          const next = tradeDraft.want.filter((_, i) => i !== idx);
                          setTradeDraft({ ...tradeDraft, want: next.length ? next : [{ itemId: '', qty: 1 }] });
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <button
                    className="market-mini-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => setTradeDraft({ ...tradeDraft, want: [...tradeDraft.want, { itemId: '', qty: 1 }] })}
                  >
                    + want 추가
                  </button>
                </div>

                <div className="market-row" style={{ marginTop: 12, gap: 8 }}>
                  <div className="market-small" style={{ flex: 1 }}>추가 크레딧 요청</div>
                  <input
                    type="number"
                    min={0}
                    value={tradeDraft.wantCredits}
                    onChange={(e) => setTradeDraft({ ...tradeDraft, wantCredits: e.target.value })}
                    style={{ width: 120 }}
                  />
                </div>

                <div className="market-row" style={{ marginTop: 10 }}>
                  <textarea
                    value={tradeDraft.note}
                    onChange={(e) => setTradeDraft({ ...tradeDraft, note: e.target.value })}
                    placeholder="메모(선택)"
                    style={{ width: '100%', minHeight: 64 }}
                  />
                </div>

                <div className="market-actions" style={{ marginTop: 10 }}>
                  <button onClick={createTradeOffer} disabled={!selectedCharId}>오퍼 생성</button>
                </div>
              </div>
            </div>
          ) : null}
        </aside>
        ) : null}
      </div>

      {/* 결과 모달창 */}
      {showResultModal && (
        <div className="result-modal-overlay">
          <div className="result-modal">
            <h1>🏆 게임 종료 🏆</h1>
            {gameEndReason?.type === 'timelimit6night' ? (
              <div
                style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 120, 120, 0.6)',
                  background: 'rgba(30, 10, 10, 0.55)',
                  color: '#ffdfdf',
                  fontWeight: 800,
                  textAlign: 'center',
                }}
              >
                ⏹️ 타임리밋 종료: 6번째 밤 도달
              </div>
            ) : null}
            {winner ? (
              <div className="winner-section">
                <img src={winner.previewImage} alt="우승자" className="winner-img" />
                <h2>{winner.name}</h2>
                <p>최후의 1인! 생존을 축하합니다!</p>
              </div>
            ) : (
              <h2>생존자가 없습니다...</h2>
            )}

            {resultSummary ? (
              <div
                style={{
                  marginTop: 14,
                  marginBottom: 14,
                  padding: '12px 14px',
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(255,255,255,0.04)',
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <strong>참가자 {resultSummary.participantsCount || 0}명</strong>
                  <span>우승 보상 LP {resultSummary.rewardLP || 0}</span>
                  <span>우승자 킬/어시 {resultSummary.myKills || 0}/{resultSummary.myAssists || 0}</span>
                </div>
                {resultSummary.topKillLeader ? (
                  <div style={{ color: '#ffd54f' }}>
                    최다 킬: {resultSummary.topKillLeader.name} ({resultSummary.topKillLeader.kills || 0}킬 / {resultSummary.topKillLeader.assists || 0}어시)
                  </div>
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 13, opacity: 0.92 }}>
                  <span>명예의 전당 저장: {resultSummary.saveStatus?.hallOfFame === 'success' ? '완료' : resultSummary.saveStatus?.hallOfFame === 'error' ? '실패' : resultSummary.saveStatus?.hallOfFame === 'skipped' ? '건너뜀' : '대기'}</span>
                  <span>유저 전적 저장: {resultSummary.saveStatus?.userStats === 'success' ? '완료' : resultSummary.saveStatus?.userStats === 'error' ? '실패' : '대기'}</span>
                </div>
                {resultSummary.userProgress ? (
                  <div style={{ fontSize: 13, opacity: 0.92 }}>
                    누적 전적: {resultSummary.userProgress.statistics?.totalGames || 0}전 / {resultSummary.userProgress.statistics?.totalWins || 0}승 / {resultSummary.userProgress.statistics?.totalKills || 0}킬 · 현재 LP {resultSummary.userProgress.lp || 0} · 크레딧 {resultSummary.userProgress.credits || 0}
                  </div>
                ) : null}
                {specialSourceSummary ? (
                  <div style={{ fontSize: 13, opacity: 0.94 }}>
                    특수 보상 요약: {specialSourceSummary}
                  </div>
                ) : null}
                {gainSourceSummary ? (
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    아이템 획득 경로: {gainSourceSummary}
                  </div>
                ) : null}
                {creditSourceSummary ? (
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    크레딧 획득 경로: {creditSourceSummary}
                  </div>
                ) : null}
                {gainDetailSummary ? (
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    {gainDetailSummary}
                  </div>
                ) : null}
                {runSupportSummary?.line ? (
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    사용/상태 요약: {runSupportSummary.line}
                  </div>
                ) : null}
                {runSupportSummary?.topItems ? (
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    많이 사용한 소모품: {runSupportSummary.topItems}
                  </div>
                ) : null}
                {runSupportSummary?.topEffects ? (
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    많이 발생한 효과: {runSupportSummary.topEffects}
                  </div>
                ) : null}
                {runActionSummary?.line ? (
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    행동 큐 요약: {runActionSummary.line}
                  </div>
                ) : null}
                {runActionSummary?.chaseLine ? (
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    추격/도주 요약: {runActionSummary.chaseLine}
                  </div>
                ) : null}
                {runActionSummary?.tuningLine ? (
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    추격 튜닝 지표: {runActionSummary.tuningLine}
                  </div>
                ) : null}
                {runActionSummary?.topBlocked ? (
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    많이 막힌 이유: {runActionSummary.topBlocked}
                  </div>
                ) : null}
                {runActionSummary?.topDeferred ? (
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    자주 밀린 행동: {runActionSummary.topDeferred}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="stats-summary">
              <h3>⚔️ 킬 랭킹 (Top 3)</h3>
              <ul>
                {topRankedCharacters
                  .map((char, idx) => (
                    <li key={char._id}>
                      <span>{idx + 1}위. {char.name}</span>
                      <strong>{killCounts[char._id] || 0} 킬 / {assistCounts[char._id] || 0} 어시</strong>
                    </li>
                  ))}
              </ul>
            </div>
            <button className="close-btn" onClick={() => setShowResultModal(false)}>닫기</button>
          </div>
        </div>
      )}
    </main>
  );
}