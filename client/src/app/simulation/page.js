'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { apiGet, apiPost, apiPut } from '../../utils/api';
import { calculateBattle } from '../../utils/battleLogic';
import { generateDynamicEvent } from '../../utils/eventLogic';
import { updateEffects } from '../../utils/statusLogic';
import { applyItemEffect } from '../../utils/itemLogic';
import { getRuleset, getPhaseDurationSec, getFogLocalTimeSec } from '../../utils/rulesets';
import '../../styles/ERSimulation.css';

function safeTags(item) {
  return Array.isArray(item?.tags) ? item.tags : [];
}

function itemDisplayName(item) {
  return item?.name || item?.text || item?.itemId?.name || '알 수 없는 아이템';
}

function itemIcon(item) {
  const t = String(item?.type || '').toLowerCase();
  const tags = safeTags(item);
  if (tags.includes('heal') || tags.includes('medical')) return '🚑';
  if (t === 'food' || tags.includes('food') || tags.includes('healthy')) return '🍎';
  if (t === 'weapon' || item?.type === '무기') return '⚔️';
  if (item?.type === '방어구') return '🛡️';
  return '📦';
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

// --- 티어(장비 등급): 1=일반, 2=영웅, 3=전설, 4=초월 ---
function clampTier4(v) {
  const n = Math.floor(Number(v || 1));
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(4, Math.max(1, n));
}

function tierLabelKo(tier) {
  const t = clampTier4(tier);
  if (t === 4) return '초월';
  if (t === 3) return '전설';
  if (t === 2) return '영웅';
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
    .filter((it) => clampTier4(it?.tier || 1) >= 4);
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

  const chance = useFallback
    ? (moved ? Number(field?.fallbackChanceMoved ?? 0.20) : Number(field?.fallbackChanceStay ?? 0.08))
    : (moved ? Number(field?.chanceMoved ?? 0.28) : Number(field?.chanceStay ?? 0.12));
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

    const entry = pickWeighted(crate?.lootTable);
    if (!entry?.itemId) return null;

    const itemId = String(entry.itemId);
    const item = (Array.isArray(publicItems) ? publicItems : []).find((it) => String(it?._id) === itemId) || null;
    const qty = Math.max(1, randInt(entry?.minQty ?? 1, entry?.maxQty ?? 1));

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
  const wFood = isDenied('food') ? 0 : wFood0;
  const wLegend = isDenied('legendary_material') ? 0 : wLegend0;
  const wTrans = isDenied('transcend_pick') ? 0 : wTrans0;

  const typeCandidates = [
    { item: 'food', weight: wFood },
    { item: 'legendary_material', weight: wLegend },
    { item: 'transcend_pick', weight: wTrans },
  ].filter((x) => Number(x?.weight || 0) > 0);

  if (!typeCandidates.length) return null;
  const pickedType = pickWeighted(typeCandidates)?.item || null;
  if (!pickedType) return null;

  if (pickedType === 'legendary_material') {
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

      pool.push({ itemId: String(it._id), weight: w, minQty: 1, maxQty: 1 });
      continue;
    }

    if (cat === 'consumable') {
      const tags = safeTags(it);
      const t = String(it?.type || '').toLowerCase();
      // 음식/치유 위주
      if (t === 'food' || tags.includes('food') || tags.includes('heal') || tags.includes('medical')) {
        pool.push({ itemId: String(it._id), weight: 2, minQty: 1, maxQty: 1 });
      }
    }
  }

  const entry = pickWeighted(pool);
  if (!entry?.itemId) return null;

  const itemId = String(entry.itemId);
  const item = list.find((it) => String(it?._id) === itemId) || null;
  const qty = Math.max(1, randInt(entry?.minQty ?? 1, entry?.maxQty ?? 1));
  return { item, itemId, qty, crateId: 'fallback', crateType: 'food', zoneId: String(zoneId || '') };
}


// --- 전설 재료 상자(필드 드랍): 3일차 '낮' 이후부터 맵 곳곳에서 발견 가능 ---
function findItemByKeywords(publicItems, keywords) {
  const list = Array.isArray(publicItems) ? publicItems : [];
  const keys = (Array.isArray(keywords) ? keywords : [])
    .map((k) => String(k || '').toLowerCase())
    .filter(Boolean);
  if (!keys.length) return null;
  return (
    list.find((it) => {
      const name = String(it?.name || it?.text || '').toLowerCase();
      return keys.some((k) => name.includes(k));
    }) || null
  );
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

function rollLegendaryCrateLoot(mapObj, zoneId, publicItems, curDay, curPhase, opts = {}) {
  // 게이트: 3일차 '낮' 이후부터
  if (!isAtOrAfterWorldTime(curDay, curPhase, 3, 'day')) return null;

  const moved = !!opts.moved;
  // 전설 재료 상자는 자주 나오면 밸런스가 무너져서, 이동 시에도 낮은 확률로만 발견
  const chance = moved ? 0.09 : 0.03;
  if (Math.random() >= chance) return null;

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

function countInventoryUnits(inventory) {
  return (Array.isArray(inventory) ? inventory : []).reduce((sum, x) => sum + Math.max(0, Number(x?.qty ?? 1)), 0);
}

function kioskLegendaryPrice(key, priceByKey) {
  const table = priceByKey && typeof priceByKey === 'object' ? priceByKey : {};
  const v = Number(table?.[key]);
  if (Number.isFinite(v) && v > 0) return v;

  // fallback: 기존 체감 가격(밸런스는 ruleset로 조정)
  if (key === 'force_core') return 1200;
  if (key === 'mithril') return 900;
  return 650; // meteor / life_tree
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


// --- 월드 스폰(맵 이벤트): 전설 재료 상자/보스(알파/오메가/위클라인) ---
// 목적: "랜덤 조우"가 아니라, 날짜/낮 조건에 따라 맵 어딘가에 스폰 → 해당 구역에 들어가면 조우/획득.
// NOTE: 시뮬 페이지(클라이언트) 기준의 단순 월드 상태이며, 서버 영구 저장은 추후 단계에서 연결.

function createInitialSpawnState(mapId = '') {
  return {
    mapId: String(mapId || ''),
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
  };

  const counters = {
    crate: Number(safe?.counters?.crate ?? 0),
    core: Number(safe?.counters?.core ?? 0),
    food: Number(safe?.counters?.food ?? 0),
  };

  return {
    mapId: String(safe.mapId || ''),
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
  if (timeOfDay !== 'day') {
    // 밤에는 스폰 생성하지 않지만, 오래된/열린 오브젝트 정리는 해 둠
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


  const eligible = getEligibleSpawnZoneIds(zones, forbiddenIds);
  if (!eligible.length) return { state: s, announcements };


  const eligibleCore = getEligibleCoreSpawnZoneIds(zones, forbiddenIds, coreSpawnZoneIds);

  // --- 자연 코어(운석/생명의 나무): 2일차 '낮' 이후, 매일 낮 시작에 1~2개 스폰 ---
  if (Number(curDay || 0) >= coreGateDay && Number(s.spawnedDay.core) !== Number(curDay || 0) && eligibleCore.length) {
    const alreadyAlive = new Set(
      (Array.isArray(s.coreNodes) ? s.coreNodes : [])
        .filter((n) => !n?.picked)
        .map((n) => String(n?.zoneId))
    );

    const maxNew = Math.min(coreMaxPerDay, Math.max(1, Math.floor(eligibleCore.length / coreDiv) || 1)); // 맵 크기에 따라 1~2개
    const zonePool = eligibleCore.filter((zid) => !alreadyAlive.has(String(zid)));
    const pickCount = Math.min(maxNew, zonePool.length);

    for (let i = 0; i < pickCount; i++) {
      const zid = zonePool.splice(randInt(0, Math.max(0, zonePool.length - 1)), 1)[0];
      const kind = pickCount === 2 ? (i === 0 ? 'meteor' : 'life_tree') : Math.random() < 0.5 ? 'meteor' : 'life_tree';

      s.counters.core = Number(s.counters.core || 0) + 1;
      s.coreNodes.push({
        id: `CORE_${String(curDay || 0)}_${String(s.counters.core)}`,
        kind,
        zoneId: String(zid),
        spawnedDay: Number(curDay || 0),
        picked: false,
        pickedBy: null,
        pickedAt: null,
      });
    }

    s.spawnedDay.core = Number(curDay || 0);
    if (pickCount > 0) announcements.push(`🌠 희귀 재료 자연 스폰 발생! (x${pickCount})`);
  }

  // --- 음식 상자: 1일차 '낮' 이후, 매일 낮 시작에 N개 드랍 ---
  if (Number(curDay || 0) >= foodGateDay && Number(s.spawnedDay.food) !== Number(curDay || 0)) {
    const alreadyAlive = new Set(
      (Array.isArray(s.foodCrates) ? s.foodCrates : [])
        .filter((c) => !c?.opened)
        .map((c) => String(c?.zoneId))
    );

    const maxNew = Math.min(foodMaxPerDay, Math.max(1, Math.floor(eligible.length / foodDiv) || 1));
    const zonePool = eligible.filter((zid) => !alreadyAlive.has(String(zid)));
    const pickCount = Math.min(maxNew, zonePool.length);

    for (let i = 0; i < pickCount; i++) {
      const zid = zonePool.splice(randInt(0, Math.max(0, zonePool.length - 1)), 1)[0];
      s.counters.food = Number(s.counters.food || 0) + 1;
      s.foodCrates.push({
        id: `FCRATE_${String(curDay || 0)}_${String(s.counters.food)}`,
        zoneId: String(zid),
        spawnedDay: Number(curDay || 0),
        opened: false,
        openedBy: null,
        openedAt: null,
      });
    }

    s.spawnedDay.food = Number(curDay || 0);
    if (pickCount > 0) announcements.push(`🍱 음식 상자 드랍 발생! (x${pickCount})`);
  }

  // --- 전설 재료 상자: 3일차 '낮' 이후, 매일 낮 시작에 N개 드랍 ---
  if (Number(curDay || 0) >= legGateDay && Number(s.spawnedDay.legendary) !== Number(curDay || 0)) {
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

  // --- 보스: '낮' 시작 시 1개 스폰(살아있으면 유지), 처치 후 다음 날 다시 스폰 가능 ---
  function spawnBoss(kind, thresholdDay) {
    const k = String(kind);
    const d = Number(curDay || 0);
    const cfgDay = Number(bossRule?.[k]?.gateDay);
    const needDay = Number.isFinite(cfgDay) ? cfgDay : Number(thresholdDay || 0);
    if (d < needDay) return;

    const existing = s?.bosses?.[k];
    if (existing && existing.alive) return; // 살아있으면 유지

    if (Number(s.spawnedDay?.[k]) === d) return; // 오늘 이미 스폰했으면 패스

    const zid = eligible[randInt(0, Math.max(0, eligible.length - 1))];
    s.bosses[k] = {
      kind: k,
      zoneId: String(zid),
      spawnedDay: d,
      alive: true,
      defeatedBy: null,
      defeatedAt: null,
    };
    s.spawnedDay[k] = d;

    const label = k === 'alpha' ? '알파' : k === 'omega' ? '오메가' : '위클라인';
    announcements.push(`⚠️ ${label}가 어딘가에 출현했다!`);
  }

  spawnBoss('alpha', 3);
  spawnBoss('omega', 4);
  spawnBoss('weakline', 5);

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
  const catMul = (key) => {
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

  // 안전장치: 2일차 낮 이후만
  const ws = ruleset?.worldSpawns || {};
  const coreRule = ws?.core || {};
  const coreGateDay = Number(coreRule?.gateDay ?? 2);
  if (!isAtOrAfterWorldTime(curDay, curPhase, coreGateDay, 'day')) return null;

  // 스폰된 코어는 "존재하면 꽤 높은 확률로" 주워가는 느낌(밤엔 덜 적극적)
  const moved = !!opts.moved;
  const timeOfDay = getTimeOfDayFromPhase(curPhase);
  const pc = coreRule?.pickChance || {};
  const byTod = (timeOfDay === 'day' ? pc.day : pc.night) || {};
  const chance = moved
    ? Number(byTod?.moved ?? (timeOfDay === 'day' ? 0.85 : 0.55))
    : Number(byTod?.stay ?? (timeOfDay === 'day' ? 0.65 : 0.35));
  if (Math.random() >= chance) return null;

  const kind = String(node?.kind || '');
  let item = null;
  if (kind === 'meteor') item = findItemByKeywords(publicItems, ['운석', 'meteor']);
  if (kind === 'life_tree') item = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);

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
          : `🧬 변이체(${label}) 처치! VF 혈액 샘플 획득`;

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
  const ings = Array.isArray(ingredients) ? ingredients : [];
  let hasVf = false;
  let hasLegendaryMat = false;
  let hasEquip = false;

  for (const x of ings) {
    const id = String(x?.itemId || '');
    if (!id) continue;

    const meta = (itemMetaById && itemMetaById[id]) ? itemMetaById[id] : null;
    const name = String(meta?.name || itemNameById?.[id] || '');
    const kind = classifySpecialByName(name);

    if (kind === 'vf') hasVf = true;
    if (isSpecialCoreKind(kind)) hasLegendaryMat = true;

    const pseudoItem = { name, type: meta?.type, tags: meta?.tags, tier: meta?.tier };
    if (inferItemCategory(pseudoItem) === 'equipment') hasEquip = true;
  }

  if (hasVf) return 4;
  if (hasLegendaryMat) return 3;
  if (hasEquip) return 2;
  return 1;
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
function buildCraftGoal(inventory, craftables, itemNameById) {
  const list = Array.isArray(craftables) ? craftables : [];
  if (!list.length) return null;

  let best = null;

  for (const it of list) {
    const tier = Number(it?.tier || 1);
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

    // "재료 0개 보유" 레시피는 목표로 삼지 않음(너무 랜덤해짐)
    if (haveSlots <= 0) continue;

    // 너무 멀면(부족 재료가 너무 많으면) 목표로 삼지 않음
    if (missing.length > 3) continue;

    const ratio = haveSlots / Math.max(1, ings.length);
    const score = tier * 100 + ratio * 25 - missing.length * 8;

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

// --- 목표 기반 이동(조합 목표 + 월드 스폰 + 키오스크) ---
function chooseAiMoveTargets({ actor, craftGoal, mapObj, spawnState, forbiddenIds, day, phase, kiosks }) {
  const miss = Array.isArray(craftGoal?.missing) ? craftGoal.missing : [];
  const hasGoal = !!craftGoal?.target && miss.length > 0;

  const s = spawnState && typeof spawnState === 'object' ? spawnState : null;
  const bosses = s?.bosses || {};
  const coreNodes = Array.isArray(s?.coreNodes) ? s.coreNodes : [];
  const crates = Array.isArray(s?.legendaryCrates) ? s.legendaryCrates : [];

  const result = { targets: [], reason: '' };

  const simCredits = Math.max(0, Number(actor?.simCredits || 0));
  const kioskZones = listKioskZoneIdsForMap(mapObj, kiosks, forbiddenIds);

  const needKeys = new Set(
    miss
      .map((m) => String(m?.special || classifySpecialByName(m?.name) || ''))
      .filter(Boolean)
  );

  const needVf = needKeys.has('vf');
  const needMeteor = needKeys.has('meteor');
  const needLife = needKeys.has('life_tree');
  const needMithril = needKeys.has('mithril');
  const needForce = needKeys.has('force_core');

  // 1) VF: 위클라인(5일차) 우선, 그 다음 키오스크 구매(4일차)
  if (needVf) {
    if (isAtOrAfterWorldTime(day, phase, 5, 'day') && bosses?.weakline?.alive && bosses.weakline.zoneId) {
      result.targets = [String(bosses.weakline.zoneId)];
      result.reason = 'VF(위클라인)';
      return result;
    }
    if (isAtOrAfterWorldTime(day, phase, 4, 'day') && simCredits >= 500 && kioskZones.length) {
      result.targets = kioskZones;
      result.reason = 'VF(키오스크)';
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
      .map((n) => String(n.zoneId));
    const uniq = uniqStrings(targets);

    if (uniq.length) {
      result.targets = uniq;
      result.reason = needMeteor && needLife ? '자연코어(운석/생나)' : needMeteor ? '자연코어(운석)' : '자연코어(생나)';
      return result;
    }

    // 키오스크 구매/교환이 가능한 시점이면 키오스크도 후보로
    if (isAtOrAfterWorldTime(day, phase, 2, 'day') && kioskZones.length && simCredits >= 650) {
      result.targets = kioskZones;
      result.reason = '자연코어(키오스크)';
      return result;
    }
  }

  // 3) 미스릴: 알파(3일차) → 전설 재료 상자(3일차) → 키오스크(2일차)
  if (needMithril) {
    if (isAtOrAfterWorldTime(day, phase, 3, 'day') && bosses?.alpha?.alive && bosses.alpha.zoneId) {
      result.targets = [String(bosses.alpha.zoneId)];
      result.reason = '미스릴(알파)';
      return result;
    }

    const crateTargets = uniqStrings(crates.filter((c) => c && !c.opened && c.zoneId).map((c) => String(c.zoneId)));
    if (isAtOrAfterWorldTime(day, phase, 3, 'day') && crateTargets.length) {
      result.targets = crateTargets;
      result.reason = '미스릴(전설상자)';
      return result;
    }

    if (isAtOrAfterWorldTime(day, phase, 2, 'day') && kioskZones.length && simCredits >= 900) {
      result.targets = kioskZones;
      result.reason = '미스릴(키오스크)';
      return result;
    }
  }

  // 4) 포스 코어: 오메가(4일차) → 전설 재료 상자(3일차) → 키오스크(2일차)
  if (needForce) {
    if (isAtOrAfterWorldTime(day, phase, 4, 'day') && bosses?.omega?.alive && bosses.omega.zoneId) {
      result.targets = [String(bosses.omega.zoneId)];
      result.reason = '포스코어(오메가)';
      return result;
    }

    const crateTargets = uniqStrings(crates.filter((c) => c && !c.opened && c.zoneId).map((c) => String(c.zoneId)));
    if (isAtOrAfterWorldTime(day, phase, 3, 'day') && crateTargets.length) {
      result.targets = crateTargets;
      result.reason = '포스코어(전설상자)';
      return result;
    }

    if (isAtOrAfterWorldTime(day, phase, 2, 'day') && kioskZones.length && simCredits >= 1200) {
      result.targets = kioskZones;
      result.reason = '포스코어(키오스크)';
      return result;
    }
  }

  // 5) 목표가 있으면, 부족한 일반 재료가 들어있는 상자 구역으로 이동
  if (hasGoal) {
    const basicItemId = pickMissingBasicItemId(craftGoal);
    if (basicItemId) {
      const zonesForItem = findCrateZoneIdsForItem(mapObj, basicItemId, forbiddenIds);
      if (zonesForItem.length) {
        result.targets = zonesForItem;
        result.reason = '재료 파밍';
        return result;
      }
    }
  }

  // 6) 기회주의: 전설 재료 상자/자연 코어가 있으면 약간의 확률로 향함(루프 가속)
  const crateTargets = uniqStrings(crates.filter((c) => c && !c.opened && c.zoneId).map((c) => String(c.zoneId)));
  if (isAtOrAfterWorldTime(day, phase, 3, 'day') && crateTargets.length && Math.random() < 0.18) {
    result.targets = crateTargets;
    result.reason = '전설상자 탐색';
    return result;
  }

  const coreTargets = uniqStrings(coreNodes.filter((n) => n && !n.picked && n.zoneId).map((n) => String(n.zoneId)));
  if (isAtOrAfterWorldTime(day, phase, 2, 'day') && coreTargets.length && Math.random() < 0.12) {
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

function rollKioskInteraction(mapObj, zoneId, kiosks, publicItems, curDay, curPhase, actor, craftGoal, itemNameById, marketRules) {
  const mr = marketRules?.kiosk || {};
  const gateDay = Number(mr?.gate?.day ?? 2);
  const gatePhase = String(mr?.gate?.phase ?? 'day');

  // 게이트: ruleset 기준
  if (!isAtOrAfterWorldTime(curDay, curPhase, gateDay, gatePhase)) return null;

  // 위치 게이트: 키오스크는 특정 시설(병원/성당/경찰서/소방서/양궁장/절/창고/연구소/호텔/학교) 구역에만 존재
  if (!hasKioskAtZone(kiosks, mapObj, zoneId)) return null;

  const simCredits = Math.max(0, Number(actor?.simCredits || 0));
  const items = Array.isArray(publicItems) ? publicItems : [];
  const findById = (id) => items.find((x) => String(x?._id) === String(id)) || null;

  const miss = Array.isArray(craftGoal?.missing) ? craftGoal.missing : [];
  const hasNeed = miss.length > 0;
  const cats = mr?.categories || {};
  const allowVf = cats?.vf !== false;
  const allowLegendary = cats?.legendary !== false;
  const allowBasic = cats?.basic !== false;


  // 목표(조합) 기반이면 더 적극적으로 이용(룰셋)
  const chanceNeed = Number(mr?.chanceNeed ?? 0.22);
  const chanceIdle = Number(mr?.chanceIdle ?? 0.10);
  const chance = hasNeed ? chanceNeed : chanceIdle;
  if (Math.random() >= chance) return null;

  // 1) 목표 기반: VF 혈액 샘플 (룰셋 가격/성공률)
  const needVf = miss.find((m) => m?.special === 'vf' || classifySpecialByName(m?.name) === 'vf');
  if (needVf && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day')) {
    const vfItem = findById(needVf.itemId) || findItemByKeywords(items, ['vf', '혈액', '샘플', 'sample']);
    const cost = Number(mr?.prices?.vf ?? 500);
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
    const cost = kioskLegendaryPrice(key, mr?.prices?.legendaryByKey);

    if (found) {
      // 구매 우선
      const ok = Number(mr?.buySuccess?.legendary ?? 0.85);
      if (allowLegendary && simCredits >= cost && Math.random() < ok) {
        return { kind: 'buy', item: found, itemId: String(found._id), qty: 1, cost, label };
      }
      // 교환: 인벤에서 임의 N개 단위 소모(룰셋)
      const units = countInventoryUnits(actor?.inventory || []);
      const exUnits = Math.max(1, Number(mr?.exchange?.consumeUnits ?? 3));
      const exChance = Number(mr?.exchange?.chanceNeed ?? 0.75);
      if (units >= exUnits && Math.random() < exChance) {
        const consume = pickUnitsFromInventory(actor?.inventory || [], exUnits);
        if (consume.length) return { kind: 'exchange', item: found, itemId: String(found._id), qty: 1, consume, label };
      }
    }
  }

  // 3) 목표 기반: 일반 재료(맵 상자풀에 존재하는 재료만 구매)
  const needBasic = miss.find((m) => m?.itemId && !m?.special && isItemInMapCrates(mapObj, m.itemId));
  if (needBasic) {
    const it = findById(needBasic.itemId);
    const cost = Number(mr?.prices?.basic ?? 120);
    const ok = Number(mr?.buySuccess?.basic ?? 0.75);
    if (allowBasic && it && simCredits >= cost && Math.random() < ok) {
      const needQty = Math.max(1, Math.min(2, Math.max(1, Number(needBasic.need || 1) - Number(needBasic.have || 0))));
      return { kind: 'buy', item: it, itemId: String(it._id), qty: needQty, cost, label: '재료 보급' };
    }
  }

  // 4) fallback: 기존 랜덤 로직 (VF/전설 재료/기본 보급)

  // 4-1) 4일차 낮 이후: VF 혈액 샘플(500 크레딧) 구매 가능
  if (isAtOrAfterWorldTime(curDay, curPhase, 4, 'day')) {
    const vfChance = Number(mr?.fallback?.vfChance ?? 0.25);
    if (allowVf && Math.random() < vfChance) {
      const vf = findItemByKeywords(items, ['vf', '혈액', '샘플', 'sample']);
      const cost = Number(mr?.prices?.vf ?? 500);
      if (vf && simCredits >= cost) return { kind: 'buy', item: vf, itemId: String(vf._id), qty: 1, cost, label: 'VF 혈액 샘플' };
    }
  }

  // 4-2) 2일차 낮 이후: 운석/생나 키오스크 구매/교환 가능(미스릴/포스코어도 포함)
  const lgChance = Number(mr?.fallback?.legendaryChance ?? 0.20);
  if (allowLegendary && Math.random() < lgChance) {
    const cores = getLegendaryCoreCandidates(items);
    if (cores.length) {
      const picked = cores[Math.floor(Math.random() * cores.length)];
      const cost = kioskLegendaryPrice(picked.key, mr?.prices?.legendaryByKey);

      // 구매
      const ok = Number(mr?.buySuccess?.legendaryFallback ?? mr?.buySuccess?.legendary ?? 0.7);
      if (simCredits >= cost && Math.random() < ok) {
        return { kind: 'buy', item: picked.item, itemId: String(picked.item._id), qty: 1, cost, label: picked.label };
      }

      // 교환: 인벤에서 임의 N개 단위 소모(룰셋)
      const units = countInventoryUnits(actor?.inventory || []);
      const exUnits = Math.max(1, Number(mr?.exchange?.consumeUnits ?? 3));
      const exChance = Number(mr?.exchange?.chanceFallback ?? 0.6);
      if (units >= exUnits && Math.random() < exChance) {
        const consume = pickUnitsFromInventory(actor?.inventory || [], exUnits);
        if (consume.length) return { kind: 'exchange', item: picked.item, itemId: String(picked.item._id), qty: 1, consume, label: picked.label };
      }
    }
  }

  // 4-3) 기본 보급(하급 재료)
  const basicChance = Number(mr?.fallback?.basicChance ?? 0.35);
  if (allowBasic && Math.random() < basicChance) {
    const entry = pickFromAllCrates(mapObj, publicItems);
    if (entry?.itemId) {
      const it = findById(entry.itemId);
      const cost = Number(mr?.prices?.basic ?? 120);
      if (it && simCredits >= cost) {
        const qty = Math.max(1, randInt(entry?.minQty ?? 1, entry?.maxQty ?? 1));
        return { kind: 'buy', item: it, itemId: String(it._id), qty, cost, label: '보급품' };
      }
    }
  }

  return null;
}


// --- 전송 드론(하급 아이템) 호출: 즉시 지급 ---
function rollDroneOrder(droneOffers, mapObj, publicItems, curDay, curPhase, actor, phaseIdxNow, craftGoal, itemNameById, marketRules) {
  // 드론은 언제든 호출 가능(하급 아이템 보급용). 캐릭터가 자동으로 호출하며, '즉시 지급' 규칙을 따른다.
  // 너무 잦으면 재미가 깨져서 확률로 제어하고, 같은 페이즈에 중복 호출은 막는다.
  const dm = marketRules?.drone || {};
  if (dm?.enabled === false) return null;

  const invCount = Array.isArray(actor?.inventory) ? actor.inventory.length : 0;

  const idxNow = Number(phaseIdxNow || 0);
  const lastIdx = Number(actor?.droneLastOrderIndex ?? -9999);
  if (idxNow <= lastIdx) return null;

  const credits = Math.max(0, Number(actor?.simCredits || 0));
  const items = Array.isArray(publicItems) ? publicItems : [];
  const needId = pickMissingBasicItemId(craftGoal);
  const hasNeed = !!needId;

  // 목표(조합)에서 부족한 하급 재료가 있으면 조금 더 자주 호출
  const needLow = Number(dm?.chanceNeedLowInv ?? 0.20);
  const needDef = Number(dm?.chanceNeedDefault ?? 0.12);
  const lowInv = Number(dm?.chanceLowInv ?? 0.14);
  const inv2 = Number(dm?.chanceInv2 ?? 0.10);
  const def = Number(dm?.chanceDefault ?? 0.06);
  const baseChance = hasNeed ? (invCount <= 2 ? needLow : needDef) : (invCount <= 1 ? lowInv : invCount == 2 ? inv2 : def);
  if (Math.random() >= baseChance) return null;

  const pool = [];
  const isSpecialName = (name) => {
    const kind = classifySpecialByName(name);
    return kind === 'vf' || isSpecialCoreKind(kind);
  };

  // 1) droneOffers(있으면)에서 뽑기: 특수 재료(운석/생나/미스릴/포스코어/VF)는 제외
  if (Array.isArray(droneOffers) && droneOffers.length) {
    for (const offer of droneOffers) {
      const price = Math.max(0, Number(offer?.price ?? offer?.cost ?? 0));
      const itemId = String(offer?.itemId ?? offer?.item?._id ?? '');
      const item = offer?.item || (itemId ? items.find((x) => String(x?._id) === itemId) : null);
      if (!itemId || !item) continue;

      const nm = String(item?.name || '');
      if (isSpecialName(nm)) continue;
      if (credits < price) continue;

      let weight = Math.max(1, Number(offer?.weight ?? 1));

      // 목표에 필요한 재료면 가중치 크게
      const mul = Math.max(1, Number(dm?.needWeightMul ?? 8));
      if (hasNeed && String(itemId) === String(needId)) weight *= mul;

      pool.push({ kind: 'offer', offerId: offer?.offerId ?? offer?._id ?? null, item, itemId, price, weight });
    }
  }

  // 1-1) 목표 재료가 있는데, offer에 없거나(혹은 전부 비쌈) pool이 비었으면 fallback로 해당 아이템을 직접 구매하는 형태(가격 고정)
  if (hasNeed && !pool.some((p) => String(p?.itemId) === String(needId))) {
    const it = items.find((x) => String(x?._id) === String(needId));
    const nfPrice = Math.max(0, Number(dm?.needFallbackPrice ?? 140));
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

      const price = Math.max(0, Number(dm?.price ?? 140));
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

  // 키오스크 구역은 비교적 "안전지대"로 간주: 야생 조우 확률/보스 스폰을 낮춤
  const baseChance = isKioskZone ? (moved ? 0.10 : 0.05) : (moved ? 0.22 : 0.10);
  if (Math.random() >= baseChance) return null;

  const p = roughPower(actor);
  const powerBonus = Math.min(0.25, Math.max(0, (p - 40) / 240));

    if (!disableBoss) {
  // 5일차 낮부터: 위클라인 → VF 혈액 샘플 드랍 가능
    if (!isKioskZone && isAtOrAfterWorldTime(curDay, curPhase, 5, 'day') && Math.random() < 0.15 + powerBonus) {
      const vf = findItemByKeywords(publicItems, ['vf 혈액', 'vf 샘플', 'blood sample', '혈액 샘플', 'vf']);
      const dmg = Math.max(6, 18 - Math.floor(p / 10));
      if (vf?._id) {
        return {
          kind: 'weakline',
          damage: dmg,
          drops: [{ item: vf, itemId: String(vf._id), qty: 1 }],
          log: `🧬 변이체(위클라인) 처치! VF 혈액 샘플 획득 가능`,
        };
      }
    }

    // 4일차 낮부터: 오메가 → 포스 코어 드랍 가능
    if (!isKioskZone && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day') && Math.random() < 0.18 + powerBonus) {
      const fc = findItemByKeywords(publicItems, ['포스 코어', 'force core', 'forcecore']);
      const dmg = Math.max(8, 26 - Math.floor(p / 9));
      if (fc?._id) {
        return {
          kind: 'omega',
          damage: dmg,
          drops: [{ item: fc, itemId: String(fc._id), qty: 1 }],
          log: `🧿 변이체(오메가) 격파! 포스 코어 획득 가능`,
        };
      }
    }

    // 3일차 낮부터: 알파 → 미스릴 드랍 가능
    if (!isKioskZone && isAtOrAfterWorldTime(curDay, curPhase, 3, 'day') && Math.random() < 0.22 + powerBonus) {
      const mi = findItemByKeywords(publicItems, ['미스릴', 'mithril']);
      const dmg = Math.max(6, 22 - Math.floor(p / 9));
      if (mi?._id) {
        return {
          kind: 'alpha',
          damage: dmg,
          drops: [{ item: mi, itemId: String(mi._id), qty: 1 }],
          log: `🐺 야생동물(알파) 사냥 성공! 미스릴 획득 가능`,
        };
      }
    }

    }

// 기본: 하급 재료 드랍(맵 상자 풀 기반 / 없으면 fallback)
  const entry = pickFromAllCrates(mapObj, publicItems);
  if (entry?.itemId) {
    const it = (Array.isArray(publicItems) ? publicItems : []).find((x) => String(x?._id) === String(entry.itemId)) || null;
    if (it?._id) {
      const qty = Math.max(1, randInt(entry?.minQty ?? 1, entry?.maxQty ?? 1));
      const dmg = Math.max(0, 8 - Math.floor(p / 18));
      return {
        kind: 'wildlife',
        damage: dmg,
        drops: [{ item: it, itemId: String(it._id), qty }],
        log: `🦌 야생동물 사냥`,
      };
    }
  }

  return null;
}

// --- 운석/생명의 나무 자연 스폰(2일차 낮 이후, 일부 맵으로 확장 가능) ---
function rollNaturalCoreSpawn(mapObj, zoneId, publicItems, curDay, curPhase, opts = {}) {
  // 운석/생명의 나무: 2일차 '낮' 이후부터
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

  if (type === 'weapon' || it?.type === '무기' || tags.includes('weapon') || lower.includes('weapon') || name.includes('무기') || name.includes('검') || name.includes('총') || name.includes('활') || name.includes('창')) return 'weapon';
  if (tags.includes('head') || lower.includes('helmet') || name.includes('머리') || name.includes('모자') || name.includes('헬멧')) return 'head';
  if (tags.includes('clothes') || tags.includes('body') || name.includes('옷') || name.includes('상의') || name.includes('갑옷') || name.includes('방어복')) return 'clothes';
  if (tags.includes('arm') || lower.includes('glove') || name.includes('팔') || name.includes('장갑') || name.includes('암가드')) return 'arm';
  if (tags.includes('shoes') || lower.includes('boots') || name.includes('신발') || name.includes('부츠')) return 'shoes';
  return '';
}

const EFFECT_BLEED = '출혈';

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
      if (replaceOnlyIfBetter && !(newTier > oldTier)) {
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

  if (!candidates.length || Math.random() >= 0.35) return null;

  for (const target of candidates) {
    const ings = compactIO(target?.recipe?.ingredients || []);
    const ok = ings.length > 0 && ings.every((ing) => invQty(inventory, ing.itemId) >= Number(ing.qty || 1));
    if (!ok) continue;

    // 인벤토리가 가득 차면 조합하지 않음(재료 소모 방지)
    if (!canReceiveItem(inventory, target, target?._id, 1, ruleset)) continue;

    const afterConsume = consumeIngredientsFromInv(inventory, ings);

    const cat = inferItemCategory(target);
    const craftTier = (cat === 'equipment')
      ? computeCraftTierFromIngredients(ings, itemMetaById, itemNameById)
      : clampTier4(target?.tier || 1);

    const craftedItem = (cat === 'equipment') ? applyEquipTier(target, craftTier) : target;
    const afterAdd = addItemToInventory(afterConsume, craftedItem, craftedItem?._id, 1, day, ruleset);

    const ingText = ings.map((x) => `${itemNameById?.[String(x.itemId)] || String(x.itemId)} x${x.qty}`).join(' + ');
    const tierText = (cat === 'equipment') ? ` (${tierLabelKo(craftTier)})` : '';
    return { inventory: afterAdd, craftedId: String(craftedItem?._id || ''), log: `🛠️ 조합: ${ingText} → ${craftedItem?.name || '아이템'}${tierText} x1` };
  }
  return null;
}

function safeGenerateDynamicEvent(actor, day, ruleset) {
  try {
    // ✅ 기존 구현(2인자) / 신규 구현(3인자) 모두 호환
    const res = generateDynamicEvent(actor, day, ruleset);
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

  // 킬 카운트 및 결과창 관리
  const [killCounts, setKillCounts] = useState({});
  const [assistCounts, setAssistCounts] = useState({});
  const [showResultModal, setShowResultModal] = useState(false);
  const [winner, setWinner] = useState(null);

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

  // 🧩 월드 스폰 상태(전설 재료 상자/보스) - 맵별로 관리
  const [spawnState, setSpawnState] = useState(() => createInitialSpawnState(activeMapId));


const activeMapName = useMemo(() => {
  const list = Array.isArray(maps) ? maps : [];
  return list.find((m) => String(m?._id) === String(activeMapId))?.name || '맵 없음';
}, [maps, activeMapId]);

  // ✅ 상점/조합/교환 패널
  const [marketTab, setMarketTab] = useState('craft'); // craft | kiosk | drone | trade
  const [selectedCharId, setSelectedCharId] = useState('');
  const [credits, setCredits] = useState(0);
  const [publicItems, setPublicItems] = useState([]);
  const [kiosks, setKiosks] = useState([]);
  const [droneOffers, setDroneOffers] = useState([]);
  const [tradeOffers, setTradeOffers] = useState([]);
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
  const hasInitialized = useRef(false);
  const forbiddenCacheRef = useRef({});
  const logSeqRef = useRef(0);

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

  const showMapRefreshToast = (text, kind = 'info') => {
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
  const getInitialSeed = () => {
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

  const addLog = (text, type = 'normal') => {
    // ✅ React StrictMode(dev)에서는 state updater가 2번 호출될 수 있어,
    //   id 생성/카운터 증가를 updater 내부에서 처리해 key 충돌을 방지합니다.
    setLogs((prev) => {
      logSeqRef.current += 1;
      const rand = Math.random().toString(16).slice(2);
      const id = `${Date.now()}-${logSeqRef.current}-${rand}`;
      return [...prev, { text, type, id }];
    });
  };

  // 🧾 구조적 이벤트 로그(재현/디버깅용)
  // - 문자열 로그는 사람용, runEvents는 "룰/상태"를 요약/집계하기 위한 데이터용
  const emitRunEvent = (kind, payload = {}, at = null) => {
    const stamp = at || { day, phase, sec: matchSec };
    const e = { kind: String(kind || 'unknown'), at: stamp, ...payload };
    setRunEvents((prev) => {
      const next = [...(Array.isArray(prev) ? prev : []), e];
      const max = 5000;
      return next.length > max ? next.slice(next.length - max) : next;
    });
  };

  // 🛠 개발자 도구: 선택 캐릭터에게 소모품을 임의로 사용(강제)
  // - 전투 중 사용 불가: 진행 중(isAdvancing)일 때는 버튼을 비활성화합니다.
  
  // 🎁 개발자 도구: 초월 장비 선택 상자(선택 대기) 처리
  const resolvePendingTranscendPick = (optionIndex, method = 'manual') => {
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
      const heal = Math.max(0, Number(effect?.recovery || 0));
      ch.hp = Math.min(maxHp, beforeHp + heal);

      const cured = isBandageLikeItem(it) ? removeActiveEffect(ch, EFFECT_BLEED) : false;

      const curQty = Number(it?.qty || 1);
      if (Number.isFinite(curQty) && curQty > 1) inv[ii] = { ...it, qty: curQty - 1 };
      else inv.splice(ii, 1);

      const delta = Math.max(0, Number(ch.hp || 0) - beforeHp);
      const nm = itemDisplayName(it);
      addLog(`🧪 [${ch.name}] 강제 사용: ${itemIcon(it)} ${nm} (+${delta} HP${cured ? ', 출혈 제거' : ''})`, 'highlight');
      return next;
    });
  };

  useEffect(() => {
  const el = logBoxRef.current;
  if (!el) return;
  // ✅ 로그가 쌓여도 "페이지"가 아니라 로그 창 내부만 스크롤되게 고정
  el.scrollTop = el.scrollHeight;
}, [logs]);

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
      { zoneId: 'fire_station', name: '소방서', isForbidden: false },
      { zoneId: 'archery_range', name: '양궁장', isForbidden: false },
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

  const getZoneName = (zoneId) => {
    const key = String(zoneId || '');
    return zoneNameById[key] || key || '미상';
  };

  // ⏱ mm:ss 포맷
  const formatClock = (totalSec) => {
    const s = Math.max(0, Number(totalSec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
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
    // 동선이 하나도 없으면, "모든 구역 연결" 기본으로 동작(초기 셋업 편의)
    const hasEdges = Object.values(graph).some((s) => (s?.size || 0) > 0);
    if (!hasEdges && zoneIds.length > 1) {
      zoneIds.forEach((a) => {
        zoneIds.forEach((b) => {
          if (a !== b) graph[a].add(b);
        });
      });
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
  const isShirokoTerror = (c) => {
    const n = normalizeForSkillKey(c?.name);
    return n.includes('시로코') && n.includes('테러');
  };
  const isShirokoBase = (c) => {
    const n = normalizeForSkillKey(c?.name);
    return n.includes('시로코') && !n.includes('테러');
  };
  const cloneForBattle = (obj) => {
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
  const prepareBattleSkills = (c) => {
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
  const applyIaidoOpener = (attacker, defender, settings) => {
    // 발도: 선제 타격으로 체력을 먼저 깎아 "스킬을 못 쓰고 죽는" 체감 완화
    const openDamage = Number(settings?.battle?.iaidoOpenDamage ?? 38);
    const defMax = Number(defender?.maxHp ?? 100);
    const defHp = Number(defender?.hp ?? defMax);
    defender.hp = Math.max(1, defHp - openDamage);
  };

  const seedRng = (seedStr) => {
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


  const applyRunSeed = (seedStr) => {
    const s = String(seedStr || '').trim() || '0';
    try { localStorage.setItem(SEED_STORAGE_KEY, s); } catch {}
    if (!randomBackupRef.current) randomBackupRef.current = Math.random;
    Math.random = seedRng(`RUN:${s}`);
  };

  const restoreRandom = () => {
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
  const getForbiddenOrderForMap = (mapObj) => {
    const orderKey = `${String(mapObj?._id || 'no-map')}:forbidden:order`;
    if (forbiddenCacheRef.current[orderKey]) return forbiddenCacheRef.current[orderKey];

    const z = Array.isArray(mapObj?.zones) && mapObj.zones.length ? mapObj.zones : zones;
    const zoneIds = z.map((x) => String(x.zoneId));
    const base = new Set(z.filter((x) => x?.isForbidden).map((x) => String(x.zoneId)));

    const candidates = zoneIds.filter((id) => id && !base.has(id));
    const rng = seedRng(`FORB_ORDER:${String(mapObj?._id || '')}`);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    forbiddenCacheRef.current[orderKey] = candidates;
    return candidates;
  };

  const getForbiddenZoneIdsForDay = (mapObj, dayNum) => {
    const key = `${String(mapObj?._id || 'no-map')}:${dayNum}`;
    if (forbiddenCacheRef.current[key]) return forbiddenCacheRef.current[key];

    const z = Array.isArray(mapObj?.zones) && mapObj.zones.length ? mapObj.zones : zones;
    const zoneIds = z.map((x) => String(x.zoneId));
    const base = new Set(z.filter((x) => x?.isForbidden).map((x) => String(x.zoneId)));

    const cfg = mapObj?.forbiddenZoneConfig || {};
    // 기본값: ON (명시적으로 false일 때만 비활성)
    const enabled = cfg.enabled !== false;

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
  };

  // ✅ 금지구역(확장 규칙)
  // - 요구사항: 2일차 밤부터 생성, 낮/밤(페이즈)마다 2곳씩 누적 확장
  // - 마지막(=안전구역이 2곳 남는 시점)에는 더 이상 확장하지 않고, 안전구역도 40s 유예 후 카운트가 깎이도록(아래 detonation 틱) 처리
  // - 맵의 zones[*].isForbidden은 항상 기본 금지구역으로 유지
  const getForbiddenZoneIdsForPhase = (mapObj, dayNum, phaseKey, ruleset) => {
    const effDay = Math.max(0, Number(dayNum || 0));
    const effPhase = (String(phaseKey || '') === 'night') ? 'night' : 'morning';

    const key = `${String(mapObj?._id || 'no-map')}:${String(effDay)}:${String(effPhase)}`;
    if (forbiddenCacheRef.current[key]) return forbiddenCacheRef.current[key];

    const z = Array.isArray(mapObj?.zones) && mapObj.zones.length ? mapObj.zones : zones;
    const zoneIds = z.map((x) => String(x.zoneId));
    const base = new Set(z.filter((x) => x?.isForbidden).map((x) => String(x.zoneId)));

    const cfg = mapObj?.forbiddenZoneConfig || {};
    const enabled = cfg.enabled !== false;

    // 기본값: 2일차 밤부터 시작(요구사항)
    const startDay = Number(cfg.startDay ?? settings.forbiddenZoneStartDay ?? 2);
    const startPhase = String(cfg.startPhase ?? cfg.startTimeOfDay ?? settings.forbiddenZoneStartPhase ?? 'night');
    const addPerPhase = Math.max(1, Number(cfg.addPerPhase ?? cfg.perPhaseAdd ?? 2));

    const phaseIdx = effDay * 2 + (effPhase === 'night' ? 1 : 0);
    const startIdx = Math.max(0, Number(startDay || 0)) * 2 + (String(startPhase) === 'night' ? 1 : 0);

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
      };
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

  const getQty = (key, fallback = 1) => {
    const v = Number(qtyMap[key]);
    if (!Number.isFinite(v) || v <= 0) return fallback;
    return Math.floor(v);
  };

  const setQty = (key, v) => {
    setQtyMap((prev) => ({ ...prev, [key]: v }));
  };

  const patchInventoryOnly = (serverCharacter) => {
    if (!serverCharacter?._id) return;
    setSurvivors((prev) => prev.map((s) => (String(s._id) === String(serverCharacter._id) ? { ...s, inventory: serverCharacter.inventory ?? s.inventory } : s)));
  };

  const syncMyState = async () => {
    try {
      const [me, chars] = await Promise.all([apiGet('/user/me'), apiGet('/characters')]);
      setCredits(Number(me?.credits || 0));
      const list = Array.isArray(chars) ? chars : [];
      setSurvivors((prev) => prev.map((s) => {
        const found = list.find((c) => String(c._id) === String(s._id));
        return found ? { ...s, inventory: found.inventory ?? s.inventory } : s;
      }));
    } catch (e) {
      // 동기화 실패는 치명적이지 않음
      console.error(e);
    }
  };

  const loadMarket = async () => {
    try {
      setMarketMessage('');
      const [itemsRes, kiosksRes, droneRes] = await Promise.all([
        apiGet('/public/items'),
        apiGet('/public/kiosks'),
        apiGet('/public/drone-offers'),
      ]);
      setPublicItems(Array.isArray(itemsRes) ? itemsRes : []);
      setKiosks(Array.isArray(kiosksRes) ? kiosksRes : []);
      setDroneOffers(Array.isArray(droneRes) ? droneRes : []);
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
    }
  };

  const loadTrades = async () => {
    try {
      setMarketMessage('');
      const [open, mine] = await Promise.all([
        apiGet('/trades'),
        apiGet('/trades?mine=true'),
      ]);
      setTradeOffers(Array.isArray(open) ? open : []);
      setMyTradeOffers(Array.isArray(mine) ? mine : []);
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
    }
  };

  // 초기 데이터 로드 (캐릭터 + 이벤트 + 설정 + 상점 데이터)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('로그인이 필요한 기능입니다. 로그인 페이지로 이동합니다.');
      window.location.href = '/login';
      return;
    }

    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const fetchData = async () => {
      try {
        const [charRes, eventRes, settingRes, meRes, itemsRes, mapsRes, kiosksRes, droneRes, openTrades, mineTrades] = await Promise.all([
          apiGet('/characters'),
          apiGet('/events'),
          apiGet('/settings'),
          apiGet('/user/me'),
          apiGet('/public/items'),
          apiGet('/public/maps'),
          apiGet('/public/kiosks'),
          apiGet('/public/drone-offers'),
          apiGet('/trades'),
          apiGet('/trades?mine=true'),
        ]);

        if (settingRes) setSettings(settingRes);

        const mapsList = Array.isArray(mapsRes) ? mapsRes : [];
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
        const ruleset = getRuleset(settingRes?.rulesetId);
        const det = ruleset?.detonation;
        const energy = ruleset?.gadgetEnergy;

// 🎒 추천 상급 장비(또는 역할)에 맞춰 시작 구역을 가중치 랜덤으로 선택
const pickStartZoneIdForChar = (c) => {
  const zonesArr = Array.isArray(initialMap?.zones) ? initialMap.zones : [];
  const fallback = () => initialZoneIds[Math.floor(Math.random() * initialZoneIds.length)];
  if (!zonesArr.length) return fallback();

  const texts = [];
  const addText = (v) => {
    if (v === null || v === undefined) return;
    const s = String(v).trim();
    if (s) texts.push(s.toLowerCase());
  };

  const addFromList = (arr) => {
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
const saveLocalHof = (winner, killCountsObj, participantsList) => {
  try {
    const me = JSON.parse(localStorage.getItem('user') || 'null');
    const username = me?.username || me?.id || 'guest';
    const key = `eh_hof_${username}`;

    const raw = localStorage.getItem(key);
    const state = raw ? JSON.parse(raw) : { winsByChar: {}, killsByChar: {}, updatedAt: 0 };

    // 우승 1회
    if (winner?.name) {
      state.winsByChar[winner.name] = (state.winsByChar[winner.name] || 0) + 1;
    }

    // 킬 누적 (id -> name 변환)
    const idToName = {};
    (participantsList || []).forEach((p) => {
      const id = p?._id || p?.id;
      if (!id) return;
      idToName[id] = p?.name || p?.nickname || p?.charName || p?.title;
    });

    Object.entries(killCountsObj || {}).forEach(([id, k]) => {
      const name = idToName[id];
      if (!name) return;
      const v = Number(k || 0);
      if (!Number.isFinite(v) || v <= 0) return;
      state.killsByChar[name] = (state.killsByChar[name] || 0) + v;
    });

    state.updatedAt = Date.now();
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.error('local hof save failed', e);
  }
};

        const charsWithHp = (Array.isArray(charRes) ? charRes : []).map((c) => ({
          ...c,
          hp: 100,
          maxHp: 100,
          zoneId: pickStartZoneIdForChar(c),


          simCredits: 0,
          droneLastOrderIndex: -9999,
          // 하이브리드(시즌10) 전용 상태
          detonationSec: det ? det.startSec : null,
          detonationMaxSec: det ? det.maxSec : null,
          gadgetEnergy: energy ? energy.start : 0,
          cooldowns: {
            portableSafeZone: 0,
            cnotGate: 0,
          },
          safeZoneUntil: 0,
        }));
        const shuffledChars = charsWithHp.sort(() => Math.random() - 0.5);
        setSurvivors(shuffledChars);
        setEvents(Array.isArray(eventRes) ? eventRes : []);

        // 킬 카운트 초기화
        const initialKills = {};
        (Array.isArray(charRes) ? charRes : []).forEach((c) => {
          initialKills[c._id] = 0;
        });
        setKillCounts(initialKills);

        // 어시스트 카운트 초기화
        const initialAssists = {};
        (Array.isArray(charRes) ? charRes : []).forEach((c) => {
          initialAssists[c._id] = 0;
        });
        setAssistCounts(initialAssists);

        setCredits(Number(meRes?.credits || 0));
        setPublicItems(Array.isArray(itemsRes) ? itemsRes : []);
        setKiosks(Array.isArray(kiosksRes) ? kiosksRes : []);
        setDroneOffers(Array.isArray(droneRes) ? droneRes : []);
        setTradeOffers(Array.isArray(openTrades) ? openTrades : []);
        setMyTradeOffers(Array.isArray(mineTrades) ? mineTrades : []);

        // 경기 시간도 초기화
        setMatchSec(0);

        addLog('📢 선수들이 경기장에 입장했습니다. 잠시 후 게임이 시작됩니다.', 'system');
      } catch (err) {
        console.error('데이터 로드 실패:', err);
        addLog('⚠️ 데이터를 불러오는데 실패했습니다.', 'death');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 최신 킬 정보 전달
  const finishGame = async (finalSurvivors, latestKillCounts, latestAssistCounts) => {
    // 게임 종료 시 오토 플레이는 자동으로 해제
    setAutoPlay(false);
    const w = finalSurvivors[0];
    const finalKills = latestKillCounts || killCounts;
    const finalAssists = latestAssistCounts || assistCounts;

    const wId = w ? (w._id || w.id) : null;
    const myKills = wId ? (finalKills[wId] || 0) : 0;
    const rewardLP = 100 + myKills * 10;

    setWinner(w);
    setIsGameOver(true);
    setShowResultModal(true);

    if (w) addLog(`🏆 게임 종료! 최후의 생존자: [${w.name}]`, 'highlight');
    else addLog('💀 생존자가 아무도 없습니다...', 'death');


    // (3) 로컬 백업(캐릭터별: 내 명예의 전당)
    try {
      const me = JSON.parse(localStorage.getItem('user') || 'null');
      const username = me?.username || me?.id || 'guest';
      const key = `eh_hof_${username}`;
      const raw = localStorage.getItem(key);
      const state = raw ? JSON.parse(raw) : { chars: {} };
      if (!state.chars) state.chars = {};

      const participants = [
        ...(Array.isArray(finalSurvivors) ? finalSurvivors : []),
        ...(Array.isArray(dead) ? dead : []),
      ];

      const idToName = {};
      for (const p of participants) {
        const pid = String(p?._id ?? p?.id ?? '');
        if (!pid) continue;
        idToName[pid] = p?.name ?? p?.nickname ?? p?.charName ?? p?.title ?? pid;
      }

      for (const [pid, k] of Object.entries(finalKills || {})) {
        const sid = String(pid);
        if (!sid) continue;
        const entry = state.chars[sid] || { name: idToName[sid] || sid, wins: 0, kills: 0, assists: 0 };
        entry.name = idToName[sid] || entry.name;
        entry.kills = Number(entry.kills || 0) + Number(k || 0);
        state.chars[sid] = entry;
      }

      // 어시스트 집계(최근 기여자)
      for (const [pid, a] of Object.entries(finalAssists || {})) {
        const sid = String(pid);
        if (!sid) continue;
        const entry = state.chars[sid] || { name: idToName[sid] || sid, wins: 0, kills: 0, assists: 0 };
        entry.assists = Number(entry.assists || 0) + Number(a || 0);
        state.chars[sid] = entry;
      }

      if (w) {
        const wid = String(w?._id ?? w?.id ?? '');
        if (wid) {
          const entry =
            state.chars[wid] ||
            { name: idToName[wid] || (w?.name ?? w?.nickname ?? w?.charName ?? wid), wins: 0, kills: 0, assists: 0 };
          entry.name = idToName[wid] || entry.name;
          entry.wins = Number(entry.wins || 0) + 1;
          state.chars[wid] = entry;
        }
      }


      // legacy(플레이어 단위) 기록을 1회만 캐릭터로 이관
      // - 과거 데이터는 "어떤 캐릭터가 했는지" 정보를 잃어서 정확 복원은 불가능
      // - 그래서 최초 1회에 한해 '승자 캐릭터'에 합산해 이어갑니다.
      if (!state._migratedFromPlayerV1) {
        try {
          const legacyRaw = localStorage.getItem('eh_local_hof_v1');
          const legacy = legacyRaw ? JSON.parse(legacyRaw) : null;
          const legacyWins = Number(legacy?.wins?.[username] || 0);
          const legacyKills = Number(legacy?.kills?.[username] || 0);

          if ((legacyWins > 0 || legacyKills > 0) && w) {
            const wid2 = String(w?._id ?? w?.id ?? '');
            if (wid2) {
              const entry =
                state.chars[wid2] ||
                { name: idToName[wid2] || (w?.name ?? w?.nickname ?? w?.charName ?? wid2), wins: 0, kills: 0 };
              entry.name = idToName[wid2] || entry.name;
              entry.wins = Number(entry.wins || 0) + legacyWins;
              entry.kills = Number(entry.kills || 0) + legacyKills;
              state.chars[wid2] = entry;
            }
          }
        } catch (e) {
          // ignore
        }
        state._migratedFromPlayerV1 = true;
      }

      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      // ignore
    }
    // 로컬 백업 저장(서버 저장/조회가 꼬여도 홈에서 "내 기록"은 최소한 보이게)
if (w) {
  try {
    const me = JSON.parse(localStorage.getItem('user') || 'null');
    const username = me?.username || me?.id || 'guest';
    const key = 'eh_local_hof_v1';

    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : { wins: {}, kills: {} };
    if (!data.wins) data.wins = {};
    if (!data.kills) data.kills = {};

    const wKey = String(w?._id ?? w?.id ?? '');
    const kills = Number(finalKills?.[wKey] || 0);

    data.wins[username] = Number(data.wins[username] || 0) + 1;
    data.kills[username] = Number(data.kills[username] || 0) + kills;

    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage/JSON 실패는 무시
  }
}

    // 서버 저장
    try {
      if (w) {
        await apiPost('/game/end', {
          winnerId: wId,
          killCounts: finalKills,
          fullLogs: logs.map((l) => l.text),
          participants: [...survivors, ...dead],
        });
        addLog('✅ 명예의 전당 저장 완료', 'system');
      }
    } catch (e) {
      console.error(e);
      addLog('⚠️ 명예의 전당 저장 실패', 'death');
    }

    try {
      if (w) {
        const res = await apiPost('/user/update-stats', {
          kills: myKills,
          isWin: true,
          lpEarned: rewardLP,
        });
        addLog(`💾 [전적 저장 완료] LP +${rewardLP} 획득! (현재 총 LP: ${res?.newLp ?? '?'})`, 'system');
        if (typeof res?.credits === 'number') setCredits(res.credits);

        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser && typeof res?.newLp === 'number') {
          currentUser.lp = res.newLp;
          localStorage.setItem('user', JSON.stringify(currentUser));
        }
      }
    } catch (e) {
      addLog(`⚠️ 전적 저장 실패: ${e?.response?.data?.error || '서버 오류'}`, 'death');
    }
  };

  // --- [핵심] 진행 로직 ---
  const proceedPhase = async () => {
    // 1. 페이즈 및 날짜 변경
    const nextPhase = phase === 'morning' ? 'night' : 'morning';
    let nextDay = day;
    if (phase === 'night') nextDay++;

    // 🎮 룰 프리셋 (기본: ER_S10)
    const ruleset = getRuleset(settings?.rulesetId);
    // 🚫 금지구역 처리 방식: detonation(폭발 타이머) 설정이 있으면 타이머를 사용
    const useDetonation = !!ruleset?.detonation;
    const marketRules = ruleset?.market || {};
    // ⚔️ 전투 세팅: ruleset 기반 상수(장비 보정 등)를 합쳐서 전달
    const battleSettings = { ...settings, battle: { ...(settings?.battle || {}), equipment: ruleset?.equipment || {} } };
    const phaseDurationSec = getPhaseDurationSec(ruleset, nextDay, nextPhase);
    const phaseStartSec = matchSec;
    const fogLocalSec = getFogLocalTimeSec(ruleset, nextDay, nextPhase, phaseDurationSec);

    // ⏹️ 강제 종료: 6번째 밤 도달 시 게임을 끝냅니다.
    // - 너무 오래 끌리는 템포 문제를 해결하기 위한 안전장치
    if (nextDay === 6 && nextPhase === 'night') {
      setDay(nextDay);
      setPhase(nextPhase);
      setTimeOfDay(getTimeOfDayFromPhase(nextPhase));
      addLog(`=== ${worldTimeText(nextDay, nextPhase)} (⏱ ${phaseDurationSec}s) ===`, 'day-header');
      addLog('⏹️ 6번째 밤 도달: 시간 제한으로 게임이 종료됩니다.', 'highlight');
      const alive = (Array.isArray(survivors) ? survivors : []).filter((s) => Number(s?.hp || 0) > 0);
      alive.sort((a, b) => (Number(b?.hp || 0) - Number(a?.hp || 0)) || String(a?.name || '').localeCompare(String(b?.name || '')));
      await finishGame(alive, killCounts, assistCounts);
      return;
    }

    // 💰 이번 페이즈 기본 크레딧(시즌10 컨셉)
    const baseCredits = Number(ruleset?.credits?.basePerPhase || 0);

    let earnedCredits = baseCredits;

    setDay(nextDay);
    setPhase(nextPhase);
    setTimeOfDay(getTimeOfDayFromPhase(nextPhase));
    addLog(`=== ${worldTimeText(nextDay, nextPhase)} (⏱ ${phaseDurationSec}s) ===`, 'day-header');

    // 현재 페이즈 인덱스(배송/딜레이 처리용)
    const phaseIdxNow = worldPhaseIndex(nextDay, nextPhase);

    // 🎁 초월 선택 상자(개발자 도구): 한 페이즈에 1개만 선택 대기(나머지는 자동 선택)
    let pendingPickAssigned = false;

    // 2. 맵 내부 구역 이동 + 금지구역(구역 기반) 데미지
    const mapIdNow = String(activeMapIdRef.current || activeMapId || '');
    const mapObjRaw = activeMapRef.current || activeMap;
    const mapObj = mapObjRaw || ((Array.isArray(zones) && zones.length)
      ? { _id: mapIdNow || 'local', zones }
      : null);
    const prevForbiddenIds = mapObj ? new Set(getForbiddenZoneIdsForPhase(mapObj, day, phase, ruleset)) : new Set();
    const forbiddenIds = mapObj ? new Set(getForbiddenZoneIdsForPhase(mapObj, nextDay, nextPhase, ruleset)) : new Set();
    const newlyAddedForbidden = mapObj ? [...forbiddenIds].filter((zid) => !prevForbiddenIds.has(zid)) : [];
    setForbiddenAddedNow(newlyAddedForbidden);
    const forbiddenNames = [...forbiddenIds].map((zid) => getZoneName(zid)).join(', ');
    const forbiddenAddedNames = newlyAddedForbidden.map((zid) => getZoneName(zid)).join(', ');

    const cfg = mapObj?.forbiddenZoneConfig || {};
    // LEGACY 규칙: 금지구역 체류 시 HP 감소
    const damagePerTick = Number(cfg.damagePerTick ?? 0) || Math.round(nextDay * (settings.forbiddenZoneDamageBase || 1.5));

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
      emitRunEvent('spawn_state', {
        day: nextDay,
        phase: nextPhase,
        legendary: lc,
        foodCrates: (Array.isArray(nextSpawn?.foodCrates) ? nextSpawn.foodCrates : []).filter((c) => !c?.opened).length,
        meteor,
        lifeTree,
        alpha: !!b?.alpha?.alive,
        omega: !!b?.omega?.alive,
        weakline: !!b?.weakline?.alive,
      }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
    } catch {
      // ignore
    }

    const newlyDead = [];
    const baseZonePop = {};
    (Array.isArray(survivors) ? survivors : []).forEach((s) => {
      if (!s || Number(s.hp || 0) <= 0) return;
      const zid = String(s.zoneId || '');
      if (!zid) return;
      baseZonePop[zid] = (baseZonePop[zid] || 0) + 1;
    });
    let updatedSurvivors = (Array.isArray(survivors) ? survivors : [])
      .map((s) => {
        const beforeHp = Number(s.hp || 0);
        const hadBleed = hasActiveEffect(s, EFFECT_BLEED);

        let updated = updateEffects({ ...s });

        const afterHp = Number(updated.hp || 0);
        if (hadBleed && afterHp < beforeHp) {
          addLog(`🩸 [${updated.name}] 출혈: HP -${beforeHp - afterHp}`, 'highlight');
        }
        if (beforeHp > 0 && afterHp <= 0) {
          updated.hp = 0;
          newlyDead.push(updated);
          addLog(`💀 [${updated.name}] 출혈로 사망했습니다.`, 'death');
          return updated;
        }

        // --- 이동 ---
updated.simCredits = updated.simCredits ?? 0;
updated.droneLastOrderIndex = updated.droneLastOrderIndex ?? -9999;
updated.aiTargetZoneId = updated.aiTargetZoneId ?? null;
updated.aiTargetTTL = updated.aiTargetTTL ?? 0;
updated.inventory = Array.isArray(updated.inventory) ? updated.inventory : [];
updated.inventory = normalizeInventory(updated.inventory, ruleset);

const currentZone = String(updated.zoneId || zones[0]?.zoneId || '__default__');
const neighbors = Array.isArray(zoneGraph[currentZone]) ? zoneGraph[currentZone] : [];
let nextZoneId = currentZone;

const mustEscape = forbiddenIds.has(currentZone);

// 목표 기반 이동: 조합 목표/월드 스폰/키오스크를 고려
const preGoal = buildCraftGoal(updated.inventory, craftables, itemNameById);
const aiMove = chooseAiMoveTargets({
  actor: updated,
  craftGoal: preGoal,
  mapObj,
  spawnState: nextSpawn,
  forbiddenIds,
  day: nextDay,
  phase: nextPhase,
  kiosks,
});

// 🤖 목표 존 유지(TTL): 목표를 몇 페이즈 유지해서 '사람처럼' 보이게 함
const aiCfg = ruleset?.ai || {};
const recoverHpBelow = Math.max(0, Number(aiCfg?.recoverHpBelow ?? 38));
const recoverMinDelta = Math.max(0, Math.floor(Number(aiCfg?.recoverMinSaferDelta ?? 1)));
const recovering = !mustEscape && Number(updated.hp || 0) > 0 && Number(updated.hp || 0) <= recoverHpBelow;

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
    const pickedTarget = String(aiMove.targets[0] || '');
    if (pickedTarget && !forbiddenIds.has(pickedTarget)) {
      updated.aiTargetZoneId = pickedTarget;
      updated.aiTargetTTL = randInt(ttlMin, ttlMax);
      holdTarget = pickedTarget;
    }
  }
}

let moveTargets = holdTarget ? [holdTarget] : (Array.isArray(aiMove?.targets) ? aiMove.targets : []);
let moveReason = holdTarget ? `${String(aiMove?.reason || 'goal')}:ttl` : String(aiMove?.reason || '');

if (recovering) {
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

const moveChance = mustEscape ? escapeChance : (recovering ? 0.95 : (moveTargets.length ? 0.88 : 0.6));
const willMove = Math.random() < moveChance;

if (willMove) {
  if (mustEscape) {
    // 금지구역이면 우선 안전한 곳으로 이동
    if (neighbors.length > 0) {
      const safeNeighbors = neighbors.filter((zid) => !forbiddenIds.has(String(zid)));
      const candidates = safeNeighbors.length ? safeNeighbors : neighbors;
      nextZoneId = String(candidates[Math.floor(Math.random() * candidates.length)] || currentZone);
    } else {
      const allZoneIds = zones.map((z) => String(z.zoneId)).filter(Boolean);
      const safeAll = allZoneIds.filter((zid) => !forbiddenIds.has(String(zid)));
      const pool = safeAll.length ? safeAll : allZoneIds;
      if (pool.length > 0) nextZoneId = String(pool[Math.floor(Math.random() * pool.length)] || currentZone);
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
      // 연결 정보가 없으면(=neighbors가 비면) 맵 전체에서 랜덤 이동
      const allZoneIds = zones.map((z) => String(z.zoneId)).filter(Boolean);
      const safeAll = allZoneIds.filter((zid) => !forbiddenIds.has(String(zid)));
      const pool = safeAll.length ? safeAll : allZoneIds;
      if (pool.length > 0) nextZoneId = String(pool[Math.floor(Math.random() * pool.length)] || currentZone);
    }
  }
}

if (String(nextZoneId) !== String(currentZone)) {
  if (mustEscape) {
    addLog(`⚠️ [${updated.name}] 금지구역 이탈: ${getZoneName(currentZone)} → ${getZoneName(nextZoneId)}`, 'system');
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
    reason: mustEscape ? 'escape' : (moveTargets.length ? String(moveReason || 'goal') : 'wander'),
  }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
} else if (mustEscape) {
  addLog(`⛔ [${updated.name}] 금지구역(${getZoneName(currentZone)})에 머무릅니다...`, 'death');
}

updated.zoneId = nextZoneId;

const didMove = String(nextZoneId) !== String(currentZone);

        // --- 필드 파밍(이벤트 외): 이동/탐색 중 아이템 획득 ---
        const loot = rollFieldLoot(mapObj, updated.zoneId, publicItems, ruleset, { moved: didMove, day: nextDay, phase: nextPhase, dropWeightsByKey: ruleset?.worldSpawns?.legendaryCrate?.dropWeightsByKey });
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

          const craftedN = tryAutoCraftFromLoot(updated.inventory, corePickup.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset);
          if (craftedN) {
            updated.inventory = craftedN.inventory;
            addLog(`[${updated.name}] ${craftedN.log}`, 'normal');
          }
        }

        // --- 보스(맵 이벤트 스폰): 알파/오메가/위클라인 ---
        const boss = recovering ? null : consumeBossAtZone(nextSpawn, updated.zoneId, publicItems, nextDay, nextPhase, updated, ruleset);

        // --- 야생동물/변이체 사냥(일반): 하급 아이템 드랍 ---
        const hunt = boss || (recovering ? null : rollWildlifeEncounter(mapObj, updated.zoneId, publicItems, nextDay, nextPhase, updated, { moved: didMove, isKioskZone, disableBoss: true }));
        if (hunt) {
          const dmg = Math.max(0, Number(hunt.damage || 0));
          updated.hp = Math.max(0, Number(updated.hp || 0) - dmg);
          addLog(`🎯 [${updated.name}] ${hunt.log}${dmg > 0 ? ` (피해 -${dmg})` : ''}`, dmg > 0 ? 'highlight' : 'normal');
          const creditGain = Math.max(0, Number(hunt?.credits || 0));
          if (creditGain > 0) {
            updated.simCredits = Math.max(0, Number(updated.simCredits || 0) + creditGain);
            addLog(`💳 [${updated.name}] ${boss ? '보스 처치 보상' : '사냥 보상'} (크레딧 +${creditGain})`, 'system');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: 'CREDITS', qty: creditGain, source: boss ? 'boss' : 'hunt', kind: String(hunt?.kind || ''), zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
          }



          const drops = Array.isArray(hunt.drops) ? hunt.drops : [];
          for (const d of drops) {
            if (!d?.itemId || !d?.item) continue;
            const q = Math.max(1, Number(d.qty || 1));
            const nm = d.item?.name || '아이템';
            updated.inventory = addItemToInventory(updated.inventory, d.item, d.itemId, q, nextDay, ruleset);
            const meta = updated.inventory?._lastAdd;
            const got = Math.max(0, Number(meta?.acceptedQty ?? q));
            addLog(`🧾 [${updated.name}] 드랍: ${itemIcon(d.item || { type: '' })} [${nm}] x${got}${formatInvAddNote(meta, q, updated.inventory, ruleset)}`, 'normal');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: String(d.itemId || ''), qty: got, source: boss ? 'boss' : 'hunt', kind: String(hunt?.kind || ''), zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });

            const craftedH = tryAutoCraftFromLoot(updated.inventory, d.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset);
            if (craftedH) {
              updated.inventory = craftedH.inventory;
              addLog(`[${updated.name}] ${craftedH.log}`, 'normal');
            }
          }

          if (updated.hp <= 0 && Number(s.hp || 0) > 0) {
            addLog(`💀 [${updated.name}]이(가) 사냥 중 치명상을 입고 사망했습니다.`, 'death');
            newlyDead.push(updated);
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
          }


          // 전설 재료도 즉시 조합 트리거(선택적)
          const craftedL = tryAutoCraftFromLoot(updated.inventory, legendary.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset);
          if (craftedL) {
            updated.inventory = craftedL.inventory;
            addLog(`[${updated.name}] ${craftedL.log}`, 'normal');
          }
        }

        // --- 조합 목표(간단 AI): 현재 인벤 기준으로 '가까운' 상위 티어 1개를 목표로 삼음 ---
        const craftGoal = buildCraftGoal(updated.inventory, craftables, itemNameById);
        let didProcure = false;

        // --- 키오스크(구매/교환): 2일차 '낮' 이후부터 ---
        const kioskAction = rollKioskInteraction(mapObj, updated.zoneId, kiosks, publicItems, nextDay, nextPhase, updated, craftGoal, itemNameById, marketRules);
        if (kioskAction?.itemId && kioskAction?.item) {
          const itemNm = kioskAction.item?.name || kioskAction.label || '아이템';

          if (kioskAction.kind === 'buy') {
            const cost = Math.max(0, Number(kioskAction.cost || 0));
            updated.simCredits = Math.max(0, Number(updated.simCredits || 0) - cost);
            updated.inventory = addItemToInventory(updated.inventory, kioskAction.item, kioskAction.itemId, kioskAction.qty || 1, nextDay, ruleset);
            const meta = updated.inventory?._lastAdd;
            const want = Math.max(1, Number(kioskAction.qty || 1));
            const got = Math.max(0, Number(meta?.acceptedQty ?? want));
            addLog(`🏪 [${updated.name}] 키오스크 ${kioskAction.label ? `(${kioskAction.label}) ` : ''}구매: [${itemNm}] x${got}${formatInvAddNote(meta, want, updated.inventory, ruleset)} (크레딧 -${cost})`, 'system');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: String(kioskAction.itemId || ''), qty: got, source: 'kiosk', kind: 'buy', zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            didProcure = true;

            // 구매 아이템도 즉시 조합 트리거(선택적)
            const craftedK = tryAutoCraftFromLoot(updated.inventory, kioskAction.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset);
            if (craftedK) {
              updated.inventory = craftedK.inventory;
              addLog(`[${updated.name}] ${craftedK.log}`, 'normal');
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
            addLog(`🏪 [${updated.name}] 키오스크 교환: ${consumedNames} → [${itemNm}] x${got}${formatInvAddNote(meta, want, updated.inventory, ruleset)}`, 'system');
            emitRunEvent('gain', { who: String(updated?._id || ''), itemId: String(kioskAction.itemId || ''), qty: got, source: 'kiosk', kind: 'exchange', zoneId: String(updated?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            didProcure = true;

            const craftedE = tryAutoCraftFromLoot(updated.inventory, kioskAction.itemId, craftables, itemNameById, itemMetaById, nextDay, ruleset);
            if (craftedE) {
              updated.inventory = craftedE.inventory;
              addLog(`[${updated.name}] ${craftedE.log}`, 'normal');
            }
          }

        }
                if (!didProcure) {
          // --- 드론 호출(하급 아이템 보급): 즉시 지급 ---
          const droneOrder = rollDroneOrder(droneOffers, mapObj, publicItems, nextDay, nextPhase, updated, phaseIdxNow, craftGoal, itemNameById, marketRules);
          if (droneOrder?.itemId && Number(droneOrder?.cost || 0) <= Number(updated.simCredits || 0)) {
            const cost = Math.max(0, Number(droneOrder.cost || 0));
            updated.simCredits = Math.max(0, Number(updated.simCredits || 0) - cost);

            const qty = Math.max(1, Number(droneOrder.qty || 1));
            const item = droneOrder?.item || null;
            const itemId = String(droneOrder.itemId || item?._id || '');
            if (itemId) {
              updated.inventory = addItemToInventory(updated.inventory, item, itemId, qty, nextDay, ruleset);
              updated.droneLastOrderIndex = Number(phaseIdxNow || 0);
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
              }
            }
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
      const forceAllAfterSec = (safeLeft <= 2) ? Math.max(0, Number(detCfg.forceAllAfterSec ?? 40)) : null;
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

      let aliveMap = new Map(updatedSurvivors.map((s) => [s._id, { ...s, cooldowns: { ...(s.cooldowns || {}) } }]));

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

          // 제한구역: 폭발 타이머 감소
          s.detonationSec = Math.max(0, Number(s.detonationSec || 0) - decPerSec * tickSec);

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
            s.hp = 0;
            newlyDead.push(s);
            addLog(`💥 [${s.name}] 폭발 타이머가 0이 되어 사망했습니다. (구역: ${getZoneName(zoneId)})`, 'death');
          }
        }
      }

      // 반영
      updatedSurvivors = Array.from(aliveMap.values()).filter((s) => Number(s.hp || 0) > 0);
    }

    if (newlyDead.length) setDead((prev) => [...prev, ...newlyDead]);

    // 확률 보정(룰셋 기반)
    const pvpProbCfg = ruleset?.pvp || {};
    const fogBonus = (ruleset.id === 'ER_S10' && fogLocalSec !== null && fogLocalSec !== undefined)
      ? Number(pvpProbCfg.encounterFogBonus ?? 0.08)
      : 0;
    const battleBase = Number(pvpProbCfg.encounterBase ?? 0.3);
    const battleScale = Number(pvpProbCfg.encounterDayScale ?? 0.05);
    const battleMax = Number(pvpProbCfg.encounterMax ?? 0.85);
    const battleProb = Math.min(battleMax, battleBase + nextDay * battleScale + fogBonus);

    const eventOffset = Number(pvpProbCfg.eventOffset ?? 0.3);
    const eventMax = Number(pvpProbCfg.eventMax ?? 0.95);
    const eventProb = Math.min(eventMax, battleProb + eventOffset);

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

      victim.activeEffects = Array.isArray(victim.activeEffects) ? victim.activeEffects.map((e) => ({ ...e })) : [];
      const idx = victim.activeEffects.findIndex((e) => String(e?.name || '') === EFFECT_BLEED);
      const nextEff = {
        name: EFFECT_BLEED,
        remainingDuration: bleedDurationPhases,
        dotDamage: bleedDotPerPhase,
        sourceId: String(attacker?._id || ''),
        appliedPhaseIdx: phaseIdxNow,
      };

      if (idx >= 0) {
        const prev = victim.activeEffects[idx] || {};
        const prevDur = Math.max(0, Number(prev?.remainingDuration || 0));
        victim.activeEffects[idx] = { ...prev, ...nextEff, remainingDuration: Math.max(prevDur, bleedDurationPhases) };
        addLog(`🩸 [${victim.name}] 출혈 연장! (${bleedDurationPhases}페이즈)`, 'highlight');
      } else {
        victim.activeEffects.push(nextEff);
        addLog(`🩸 [${victim.name}] 출혈! (${bleedDurationPhases}페이즈, -${bleedDotPerPhase}/페이즈)`, 'highlight');
      }
      return true;
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

      return base * (0.5 + hp / 200);
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

    const estimatePower = (c) => {
      const base = combatScore(c);
      const { weaponTier, armorTierSum } = getEquipTierSummary(c);
      const pw = Number(ruleset?.ai?.powerWeaponPerTier ?? 3);
      const pa = Number(ruleset?.ai?.powerArmorPerTier ?? 1.5);
      return base + weaponTier * pw + armorTierSum * pa;
    };

    const shouldAvoidCombatByPower = (me, opp) => {
      const myP = estimatePower(me);
      const opP = estimatePower(opp);
      const ratio = myP / Math.max(1, myP + opP);
      const minRatio = Number(ruleset?.ai?.fightAvoidMinRatio ?? 0.40);
      const absDelta = Number(ruleset?.ai?.fightAvoidAbsDelta ?? 10);
      if (ratio < minRatio || (opP - myP) >= absDelta) return { myP, opP, ratio };
      return null;
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

      // 특정 케이스 체감 보정(테러 발도는 상대 스킬에 씹히지 않게 조금 높게)
      if (name.includes('발도')) return Number(settings?.battle?.iaidoSkillProc ?? 0.65);
      return base;
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

    let todaysSurvivors = [...updatedSurvivors].sort(() => Math.random() - 0.5);
    let survivorMap = new Map(todaysSurvivors.map((s) => [s._id, s]));
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
      const hasBleed = hasActiveEffect(ch, EFFECT_BLEED);
      const hasBandage = hasBleed && inv.some((i) => isBandageLikeItem(i));
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
      const hadBleedBefore = hasActiveEffect(ch, EFFECT_BLEED);
      const cured = hadBleedBefore && isBandageLikeItem(itemToUse) ? removeActiveEffect(ch, EFFECT_BLEED) : false;

      const effect = applyItemEffect(ch, itemToUse);
      const logText = cured ? `${effect.log} (출혈 제거)` : effect.log;
      addLog(logText, 'highlight');

      const maxHp = Number(ch?.maxHp ?? 100);
      ch.hp = Math.min(maxHp, hp + Number(effect.recovery || 0));

      // qty 감소(서버형 인벤토리 대응)
      const currentQty = Number(itemToUse?.qty || 1);
      if (Number.isFinite(currentQty) && currentQty > 1) inv[idx] = { ...itemToUse, qty: currentQty - 1 };
      else inv.splice(idx, 1);

      ch[usedCountKey] = usedCount + 1;
      survivorMap.set(ch._id, ch);
      return true;
    };


    // 3. 메인 루프
    while (todaysSurvivors.length > 0) {
      let actor = todaysSurvivors.pop();
      actor = survivorMap.get(actor._id);

      if (newDeadIds.includes(actor._id) || actor.hp <= 0) continue;

      // 아이템 사용(전투 중 불가 / 전투 후 가능): 전투 외 타이밍에서만 호출
      tryUseConsumable(actor, 'turn_start');

      const potentialTargets = todaysSurvivors.filter((t) => !newDeadIds.includes(t._id) && String(t?.zoneId || '') === String(actor?.zoneId || ''));
      const canDual = potentialTargets.length >= (pvpMinSameZone - 1);
      const rand = Math.random();

      const lowHpAvoidCombat = Number(actor.hp || 0) > 0 && Number(actor.hp || 0) <= Number(ruleset?.ai?.recoverHpBelow ?? 38);
      const battleProb2 = lowHpAvoidCombat ? 0 : battleProb;
      if (lowHpAvoidCombat && canDual) {
        addLog(`🛡️ [${actor.name}] 저HP로 교전 회피`, 'system');
      }

      // 전투력 열세면 교전 회피 + 인접 안전 구역으로 이동(가능할 때)
      if (canDual && !lowHpAvoidCombat && rand < battleProb2) {
        const targetEval = survivorMap.get(potentialTargets[0]._id);
        const avoidInfo = targetEval ? shouldAvoidCombatByPower(actor, targetEval) : null;
        if (avoidInfo) {
          const oppName = String(targetEval?.name || '상대');
          const delta = Number(avoidInfo.opP || 0) - Number(avoidInfo.myP || 0);
          const avoidChance = Number(ruleset?.ai?.fightAvoidChance ?? 0.75);
          const extremeRatio = Number(ruleset?.ai?.fightAvoidExtremeRatio ?? 0.30);
          const extremeDelta = Number(ruleset?.ai?.fightAvoidExtremeDelta ?? 25);
          const willAvoid = (avoidInfo.ratio < extremeRatio || delta >= extremeDelta) ? true : (Math.random() < avoidChance);

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
            survivorMap.set(actor._id, actor);
            addLog(`🏃 [${actor.name}] 전투력 열세로 [${oppName}] 교전 회피: ${getZoneName(from)} → ${getZoneName(dest)}`, 'system');
            emitRunEvent('move', { who: String(actor?._id || ''), name: actor?.name, from, to: dest, reason: 'avoid_power' }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
          } else {
            addLog(`🏃 [${actor.name}] 전투력 열세로 [${oppName}] 교전 회피`, 'system');
          }
          continue;
          }
        }
      }

      if (canDual && rand < battleProb2) {
        // [⚔️ 전투]
        const target = survivorMap.get(potentialTargets[0]._id);

        // 상대방 행동권 사용
        const targetIndex = todaysSurvivors.findIndex((t) => t._id === target._id);
        if (targetIndex > -1) todaysSurvivors.splice(targetIndex, 1);

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
          const base = 12 + nextDay * 2;
          const dmgToLoser = Math.min(65, Math.max(8, Math.round(base + ratio * 25)));
          const dmgToWinner = Math.min(25, Math.max(0, Math.round(5 + (1 - ratio) * 12)));

          loser.hp = Math.max(0, Number(loser.hp || 0) - dmgToLoser);
          winner.hp = Math.max(0, Number(winner.hp || 0) - dmgToWinner);

          const lethal = loser.hp <= 0;

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
          addLog(`🩸 피해: [${winner.name}]↘[${loser.name}] -${dmgToLoser} (반격 -${dmgToWinner})`, 'highlight');

          // 출혈 판정(피격 시)
          tryApplyBleed(loser, winner, dmgToLoser);
          if (dmgToWinner > 0) tryApplyBleed(winner, loser, dmgToWinner);

          if (lethal) {
            if (!newDeadIds.includes(loser._id)) {
              newDeadIds.push(loser._id);
              setDead((prev) => [...prev, loser]);
            }

            roundKills[winnerId] = (roundKills[winnerId] || 0) + 1;

            // 어시스트: 직전 피해 기여자(킬러 제외)가 최근에 기여했다면 1회 인정
            let assistId = null;
            if (
              prevDamagedBy &&
              prevDamagedBy !== winnerId &&
              prevDamagedBy !== String(loser._id) &&
              (phaseIdxNow - prevDamagedPhaseIdx) <= assistWindowPhases
            ) {
              assistId = prevDamagedBy;
            }
            if (assistId) {
              roundAssists[assistId] = (roundAssists[assistId] || 0) + 1;
            }

            const assistName = assistId ? (survivorMap.get(assistId)?.name || assistId) : '';
            addLog(`☠️ [${winner.name}] 처치! (+1킬${assistId ? `, 어시: ${assistName}` : ''})`, 'death');

            // 처치 보상: 금지구역 제한시간(최대치) +5초 연장 + 크레딧
            if (useDetonation) {
              const bonusSec = Number(ruleset?.detonation?.killBonusSec || 5);
              if (winner) {
                const baseMax = Number((winner.detonationMaxSec ?? ruleset?.detonation?.maxSec) ?? 30);
                const nextMax = baseMax + bonusSec;
                winner.detonationMaxSec = nextMax;
                const baseCur = Number((winner.detonationSec ?? ruleset?.detonation?.startSec) ?? 20);
                winner.detonationSec = Math.min(nextMax, baseCur + bonusSec);
                addLog(`⏱️ [${winner.name}] 처치 보상: 금지구역 제한시간 +${bonusSec}s`, 'system');
              }
              const killCredit = Number(ruleset?.credits?.kill || 0);
              if (killCredit > 0) {
                earnedCredits += killCredit;
                winner.simCredits = Number(winner.simCredits || 0) + killCredit;
              }
            }
            // ✅ PvP 루팅: 패자 인벤 일부 + 크레딧 일부를 승자가 획득
            // - 수치는 ruleset.pvp에서 고정(로드맵 4의 첫 단추)
            const pvpCfg = ruleset?.pvp || {};
            const lootRate = Number(pvpCfg.lootCreditRate ?? 0.35);
            const lootMin = Number(pvpCfg.lootCreditMin ?? 10);
            const lootUnits = Math.max(0, Math.floor(Number(pvpCfg.lootInventoryUnits ?? 1)));

            const loserCredits = Math.max(0, Number(loser?.simCredits || 0));
            const stealCredit = Math.min(loserCredits, Math.max(lootMin, Math.floor(loserCredits * lootRate)));

            let lootLines = [];
            if (stealCredit > 0) {
              loser.simCredits = loserCredits - stealCredit;
              winner.simCredits = Number(winner.simCredits || 0) + stealCredit;
              lootLines.push(`💰 크레딧 ${stealCredit}`);
              emitRunEvent('gain', { who: String(winner?._id || ''), itemId: 'CREDITS', qty: stealCredit, source: 'pvp', from: String(loser?._id || ''), zoneId: String(winner?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
            }

            const lootPick = lootUnits > 0 ? pickUnitsFromInventory(loser?.inventory || [], lootUnits) : [];
            if (lootPick.length) {
              for (const lp of lootPick) {
                const lootId = String(lp?.itemId || '');
                if (!lootId) continue;

                const lootItem = (Array.isArray(publicItems) ? publicItems : []).find((x) => String(x?._id) === lootId) || null;
                const fallbackName = itemNameById?.[lootId] || '아이템';
                const stub = lootItem || { _id: lootId, name: fallbackName, type: '재료', tags: [] };

                winner.inventory = addItemToInventory(winner.inventory, stub, lootId, 1, nextDay, ruleset);
                emitRunEvent('gain', { who: String(winner?._id || ''), itemId: String(lootId || ''), qty: 1, source: 'pvp', from: String(loser?._id || ''), zoneId: String(winner?.zoneId || '') }, { day: nextDay, phase: nextPhase, sec: phaseStartSec });
                lootLines.push(`${itemIcon(stub)} ${stub?.name || fallbackName} x1`);
              }
            }

            if (lootLines.length) {
              addLog(`🧾 루팅: [${winner.name}] ← [${loser.name}] (${lootLines.join(', ')})`, 'normal');
            }

            // ✅ 전투 후 숨고르기(최소 회복): 전투 승리 시 HP 소량 회복
            const maxHp = Number(winner?.maxHp ?? 100);
            const restHealMax = Math.max(0, Math.floor(Number(pvpCfg.restHealMax ?? 8)));
            const restHeal = Math.min(restHealMax, Math.max(0, maxHp - Number(winner.hp || 0)));
            if (restHeal > 0) {
              winner.hp = Math.min(maxHp, Number(winner.hp || 0) + restHeal);
              addLog(`🩹 [${winner.name}] 전투 후 숨고르기: HP +${restHeal}`, 'system');
            }
            tryUseConsumable( winner, 'after_battle');
            // ✅ 전투 후 행동: 승자(루팅/숨고르기 이후) 추가 휴식 또는 이동
            const postMoveChance = Math.max(0, Math.min(1, Number(pvpCfg.postBattleMoveChance ?? 0.35)));
            const postRestHpBelow = Math.max(0, Number(pvpCfg.postBattleRestHpBelow ?? 45));
            const postRestExtraHealMax = Math.max(0, Math.floor(Number(pvpCfg.postBattleRestExtraHealMax ?? 6)));

            const curHp = Number(winner.hp || 0);
            if (curHp > 0 && curHp <= postRestHpBelow) {
              const extraHeal = Math.min(postRestExtraHealMax, Math.max(0, maxHp - curHp));
              if (extraHeal > 0) {
                winner.hp = Math.min(maxHp, curHp + extraHeal);
                addLog(`🧘 [${winner.name}] 전투 후 휴식: HP +${extraHeal}`, 'system');
              }
            } else if (Math.random() < postMoveChance) {
              const curZone = String(winner.zoneId || '');
              const neigh = Array.isArray(zoneGraph[curZone]) ? zoneGraph[curZone] : [];
              const safeNeighbors = neigh.map((z) => String(z)).filter((z) => z && !forbiddenIds.has(z));
              let nextZone = curZone;
              if (safeNeighbors.length) {
                const diff = safeNeighbors.filter((z) => z !== curZone);
                const pool = diff.length ? diff : safeNeighbors;
                nextZone = String(pool[Math.floor(Math.random() * pool.length)] || curZone);
              }
              if (nextZone && nextZone !== curZone) {
                winner.zoneId = nextZone;
                addLog(`🚶 [${winner.name}] 전투 후 이동: ${getZoneName(nextZone)}`, 'system');
              }
            }

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
          // 출혈 판정(접전)
          tryApplyBleed(actor, target, scratch);
          tryApplyBleed(target, actor, scratch);
          if (actor.hp <= 0 && !newDeadIds.includes(actor._id)) {
            newDeadIds.push(actor._id);
            setDead((prev) => [...prev, actor]);
          }
          if (target.hp <= 0 && !newDeadIds.includes(target._id)) {
            newDeadIds.push(target._id);
            setDead((prev) => [...prev, target]);
          }
        }

      } else if (canDual && rand < eventProb) {
        // [🤝 2인 이벤트]
        const target = survivorMap.get(potentialTargets[0]._id);
        const targetIndex = todaysSurvivors.findIndex((t) => t._id === target._id);
        if (targetIndex > -1) todaysSurvivors.splice(targetIndex, 1);

        const timeKey = nextPhase === 'night' ? 'night' : 'day';

        // ✅ (로드맵 6-4 + 2번 연동) 시간대/맵 조건을 우선 적용
        let availableEvents = (Array.isArray(events) ? events : []).filter((e) => {
          if (!e) return false;
          if (String(e.type || 'normal') === 'death') return false;

          const sc = Number(e.survivorCount ?? (String(e.text || '').includes('{2}') ? 2 : 1));
          const vc = Number(e.victimCount ?? 0);
          if (sc !== 2 || vc !== 0) return false;

          const tod = String(e.timeOfDay || 'both');
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
            if (!e?.text) return false;
            if (String(e.type || 'normal') === 'death') return false;
            if (!String(e.text).includes('{2}')) return false;
            const tod = String(e.timeOfDay || 'both');
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
          survivorMap.set(actor._id, actor);
          survivorMap.set(target._id, target);
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
          if (!e) return false;
          if (String(e.type || 'normal') === 'death') return false;

          const sc = Number(e.survivorCount ?? 1);
          const vc = Number(e.victimCount ?? 0);
          if (sc !== 1 || vc !== 0) return false;

          const tod = String(e.timeOfDay || 'both');
          if (tod !== 'both' && tod !== timeKey) return false;

          if (activeMapId && e.mapId && String(e.mapId) !== String(activeMapId)) return false;
	          if (e.zoneId && String(e.zoneId) !== String(actor?.zoneId || '')) return false;
          return true;
        });

        // 구버전 이벤트(텍스트 기반) 호환: {2} 없는 이벤트를 1인 이벤트로 취급
        if (soloEvents.length === 0) {
          soloEvents = (Array.isArray(events) ? events : []).filter((e) => {
            if (!e?.text) return false;
            if (String(e.type || 'normal') === 'death') return false;
            if (String(e.text).includes('{2}')) return false;
            const tod = String(e.timeOfDay || 'both');
            if (tod !== 'both' && tod !== timeKey) return false;
            if (activeMapId && e.mapId && String(e.mapId) !== String(activeMapId)) return false;
	            if (e.zoneId && String(e.zoneId) !== String(actor?.zoneId || '')) return false;
            return true;
          });
        }

        if (soloEvents.length > 0) {
          const randomEvent = soloEvents[Math.floor(Math.random() * soloEvents.length)];
          const eventText = String(randomEvent.text)
            .replace(/\{1\}/g, `[${actor.name}]`)
            .replace(/\{2\}/g, `[${actor.name}]`);
          addLog(eventText, 'normal');
        } else {
          // 폴백: 동적 이벤트 생성
          const eventResult = safeGenerateDynamicEvent(actor, nextDay, ruleset);
          addLog(eventResult.log, eventResult.damage > 0 ? 'highlight' : 'normal');

          if (eventResult.newItem && (actor.inventory || []).length < 3) {
            actor.inventory = [...(actor.inventory || []), eventResult.newItem];
          }
          if (eventResult.damage) actor.hp -= eventResult.damage;
          if (eventResult.recovery) actor.hp = Math.min(100, actor.hp + eventResult.recovery);
          if (eventResult.newEffect) actor.activeEffects = [...(actor.activeEffects || []), eventResult.newEffect];
        }

        if (actor.hp <= 0) {
          addLog(`💀 [${actor.name}]이(가) 사고로 사망했습니다.`, 'death');
          newDeadIds.push(actor._id);
          setDead((prev) => [...prev, actor]);
        }
      }

      survivorMap.set(actor._id, actor);
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
    const finalStepSurvivors = Array.from(survivorMap.values()).filter((s) => !newDeadIds.includes(s._id));

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

    setSurvivors(finalStepSurvivors);

    // 월드 스폰 상태 반영(상자 개봉/보스 처치 등)
    setSpawnState(nextSpawn);

    // 5.5) 경기 시간 진행(초)
    setMatchSec((prev) => prev + phaseDurationSec);

    // 5.6) 크레딧 적립(페이즈 보상 + 처치 보상 등)
    if (earnedCredits > 0) {
      try {
        const res = await apiPost('/credits/earn', { amount: earnedCredits });
        if (typeof res?.credits === 'number') setCredits(res.credits);
} catch (e) {
        // 서버가 꺼져있거나 네트워크 이슈가 있어도 시뮬레이션은 진행되도록
}
    }

    if (finalStepSurvivors.length <= 1) {
      finishGame(finalStepSurvivors, updatedKillCounts, updatedAssistCounts);
    }
  };

  // 🔄 서버 맵 설정 새로고침(관리자에서 수정한 crateAllowDeny 등 즉시 반영용)
  const refreshMapSettingsFromServer = async (reason = 'manual') => {
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
  const proceedPhaseGuarded = async () => {
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
  const ensureCharSelected = () => {
    if (!selectedCharId) {
      setMarketMessage('생존자를 선택해주세요.');
      return false;
    }
    return true;
  };

  const doCraft = async (itemId) => {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const qty = getQty(`craft:${itemId}`, 1);
      const res = await apiPost('/items/craft', { characterId: selectedCharId, itemId, qty });
      if (typeof res?.credits === 'number') setCredits(res.credits);
      if (res?.character) patchInventoryOnly(res.character);
      addLog(`🛠️ [조합] ${res?.message || '조합 완료'} (x${qty})`, 'system');
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
      addLog(`⚠️ [조합 실패] ${e?.response?.data?.error || e.message}`, 'death');
    }
  };

  const doKioskTransaction = async (kioskId, catalogIndex) => {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const qty = getQty(`kiosk:${kioskId}:${catalogIndex}`, 1);
      const res = await apiPost(`/kiosks/${kioskId}/transaction`, { characterId: selectedCharId, catalogIndex, qty });
      if (typeof res?.credits === 'number') setCredits(res.credits);
      if (res?.character) patchInventoryOnly(res.character);
      addLog(`🏪 [키오스크] ${res?.message || '거래 완료'} (x${qty})`, 'system');
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
      addLog(`⚠️ [키오스크 실패] ${e?.response?.data?.error || e.message}`, 'death');
    }
  };

  const doDroneBuy = async (offerId) => {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const qty = getQty(`drone:${offerId}`, 1);
      const res = await apiPost('/drone/buy', { characterId: selectedCharId, offerId, qty });
      if (typeof res?.credits === 'number') setCredits(res.credits);
      if (res?.character) patchInventoryOnly(res.character);
      addLog(`🚁 [드론] ${res?.message || '구매 완료'} (x${qty})`, 'system');
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
      addLog(`⚠️ [드론 구매 실패] ${e?.response?.data?.error || e.message}`, 'death');
    }
  };

  const createTradeOffer = async () => {
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
      await loadTrades();
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
      addLog(`⚠️ [거래 오퍼 실패] ${e?.response?.data?.error || e.message}`, 'death');
    }
  };

  const cancelTradeOffer = async (offerId) => {
    try {
      setMarketMessage('');
      await apiPost(`/trades/${offerId}/cancel`, {});
      addLog('🧾 [거래] 오퍼 취소 완료', 'system');
      await loadTrades();
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
      addLog(`⚠️ [거래 취소 실패] ${e?.response?.data?.error || e.message}`, 'death');
    }
  };

  const acceptTradeOffer = async (offerId) => {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      await apiPost(`/trades/${offerId}/accept`, { toCharacterId: selectedCharId });
      addLog('✅ [거래] 수락 완료', 'system');
      await Promise.all([loadTrades(), syncMyState()]);
    } catch (e) {
      setMarketMessage(e?.response?.data?.error || e.message);
      addLog(`⚠️ [거래 수락 실패] ${e?.response?.data?.error || e.message}`, 'death');
    }
  };

  // 탭 전환 시 필요한 데이터 갱신
  useEffect(() => {
    if (marketTab === 'trade') loadTrades();
    if (marketTab === 'craft' || marketTab === 'kiosk' || marketTab === 'drone') loadMarket();
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

  // 🧾 런 요약: 획득 경로(아이템만 집계, 크레딧 제외)
  const gainSourceSummary = useMemo(() => {
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
  }, [runEvents]);

  // 💳 런 요약: 크레딧 획득 경로(크레딧만 집계)
  const creditSourceSummary = useMemo(() => {
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
  }, [runEvents]);

// 🧾 런 요약: TOP 아이템/구역(아이템만 집계, 크레딧 제외)
const gainDetailSummary = useMemo(() => {
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
}, [runEvents, itemNameById, zoneNameById]);


  return (
    <main className="simulation-page">
      <header>
        <section id="header-id1">
          <ul>
            <li>
              <Link href="/" className="logo-btn">
                <div className="text-logo">
                  <span className="logo-top">PROJECT</span>
                  <span className="logo-main">ARENA</span>
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

      <div className="simulation-container">
        {/* 생존자 현황판 */}
        <aside className="survivor-board">
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
                  {(Array.isArray(char.activeEffects) ? char.activeEffects : []).map((eff, i) => {
                    const nm = String(eff?.name || '');
                    const dur = Number.isFinite(Number(eff?.remainingDuration)) ? Math.max(0, Number(eff.remainingDuration)) : null;
                    const icon = nm === '출혈' ? '🩸' : nm === '식중독' ? '🤢' : '🤕';
                    const label = dur !== null ? `${icon}${nm} ${dur}` : `${icon}${nm}`;
                    return (
                      <span key={`${nm}-${i}`} title={dur !== null ? `${nm} (${dur})` : nm} className="effect-badge">
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
                onClick={() => refreshMapSettingsFromServer('manual')}
                disabled={loading || isAdvancing || isRefreshingMapSettings}
                style={{ padding: '6px 10px', fontSize: 12 }}
                title="서버에 저장된 맵 설정(crateAllowDeny 등)을 새로 불러옵니다."
              >
                {isRefreshingMapSettings ? '⏳ 새로고침 중...' : '🔄 맵 새로고침'}
              </button>

              {mapRefreshToast ? (
                <span
                  className="weather-badge"
                  style={{ fontSize: 12, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  title={mapRefreshToast.text}
                >
                  {mapRefreshToast.kind === 'error' ? '⚠️' : '✅'} {mapRefreshToast.text}
                </span>
              ) : null}

              <div
                className="map-select"
                title="맵은 플레이어가 선택하지 않으며, 등록된 맵에서 캐릭터가 이동하면서 시뮬레이션이 진행됩니다."
              >
                <span className="map-select-label">🗺️</span>
                <div className="map-select-current">{activeMapName}</div>
              </div>
            </div>
          </div>

          {(() => {
            if (day <= 0) return null;
            const total = Array.isArray(activeMap?.zones) ? activeMap.zones.length : (Array.isArray(zones) ? zones.length : 0);
            const forbiddenCnt = forbiddenNow?.size ? forbiddenNow.size : 0;
            const safeLeft = Math.max(0, total - forbiddenCnt);
            const rs = getRuleset(settings?.rulesetId);
            const detForceAll = Math.max(0, Number(rs?.detonation?.forceAllAfterSec ?? 40));
            const isEndgame = safeLeft <= 2 && total > 0;
            const curPhaseDur = Math.max(0, Number(getPhaseDurationSec(rs, day, phase) || 0));
            const willForceAllThisPhase = isEndgame && curPhaseDur >= detForceAll;
            const fzNames = forbiddenCnt ? Array.from(forbiddenNow).map((z) => getZoneName(z)).join(', ') : '';

            return (
              <div className="forbidden-top-bar">
                <span className="fz-title">🚫 금지구역</span>
                <span className="fz-chip">금지 <b>{forbiddenCnt}</b> / 전체 <b>{total}</b> · 안전 <b>{safeLeft}</b></span>
                {Array.isArray(forbiddenAddedNow) && forbiddenAddedNow.length ? (
                  <span className="fz-chip">➕ 이번 페이즈 <b>+{forbiddenAddedNow.length}</b></span>
                ) : null}
                {forbiddenCnt ? (
                  <span className="fz-list" title={fzNames}>📍 {fzNames}</span>
                ) : (
                  <span className="fz-list">(현재 금지구역 없음)</span>
                )}
                {isEndgame ? (
                  <span
                    className={`fz-chip ${willForceAllThisPhase ? 'fz-danger' : 'fz-final'}`}
                    title="안전구역이 2곳만 남으면 유예 후, 안전구역도 포함해 모든 구역에서 폭발 타이머가 감소합니다."
                  >
                    🔥 전구역 위험: <b>{willForceAllThisPhase ? 'ON' : '유예중'}</b> · 유예 <b>{detForceAll}s</b>
                  </span>
                ) : null}
              </div>
            );
          })()}


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

  if (!unopenedCrates && !unpickedCore && !alphaOn && !omegaOn && !weaklineOn) return null;

  return (
    <div
      style={{
        margin: '8px 0 10px',
        padding: '10px 12px',
        borderRadius: 10,
        background: 'rgba(0,0,0,0.28)',
        border: '1px solid rgba(255,255,255,0.12)',
        fontSize: 13,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <span style={{ opacity: 0.9 }}>🌍 월드스폰</span>
      <span>🟪 전설상자: <b>{unopenedCrates}</b></span>
      <span>🌠 자연코어: 운석 <b>{meteorCnt}</b> / 생나 <b>{lifeTreeCnt}</b></span>
      <span>👹 알파: <b>{alphaOn ? 'ON' : 'off'}</b></span>
      <span>👹 오메가: <b>{omegaOn ? 'ON' : 'off'}</b></span>
      <span>👹 위클라인: <b>{weaklineOn ? 'ON' : 'off'}</b></span>
    </div>
  );
})()}

          <div className="log-window" style={{ minWidth: 0 }}>
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
              <div className="log-scroll-area" ref={logBoxRef}>
                {logs.map((log, idx) => (
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
                    {log.text}
                  </div>
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
                              ? '🌙 밤으로 진행'
                              : '🌞 다음 날 낮으로 진행'}
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

            <div className="market-tabs">
              <button className={`market-tab ${marketTab === 'craft' ? 'active' : ''}`} onClick={() => setMarketTab('craft')}>🛠️ 조합</button>
              <button className={`market-tab ${marketTab === 'kiosk' ? 'active' : ''}`} onClick={() => setMarketTab('kiosk')}>🏪 키오스크</button>
              <button className={`market-tab ${marketTab === 'drone' ? 'active' : ''}`} onClick={() => setMarketTab('drone')}>🚁 드론</button>
              <button className={`market-tab ${marketTab === 'trade' ? 'active' : ''}`} onClick={() => setMarketTab('trade')}>🔁 교환</button>
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
                        const itemName = entry.itemId?.name || itemNameById.get(String(itemId)) || String(itemId);

                        const exId = entry.exchange?.giveItemId?._id || entry.exchange?.giveItemId;
                        const exName = entry.exchange?.giveItemId?.name || (exId ? (itemNameById.get(String(exId)) || String(exId)) : '');
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
                              <button onClick={() => doKioskTransaction(k._id, idx)} disabled={!selectedCharId}>실행</button>
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
                      <button onClick={() => acceptTradeOffer(off._id)} disabled={!selectedCharId}>수락</button>
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
            <div className="market-small" style={{ marginTop: 6 }}>🎲 Seed: <strong>{runSeed}</strong></div>
            <div className="market-small" style={{ marginTop: 6 }}>📦 획득 경로: <strong>{gainSourceSummary || '-'}</strong></div>
            <div className="market-small" style={{ marginTop: 6 }}>💳 크레딧 경로: <strong>{creditSourceSummary || '-'}</strong></div>
            <div className="market-small" style={{ marginTop: 6 }}>🔎 획득 상세: <strong>{gainDetailSummary || '-'}</strong></div>
            {winner ? (
              <div className="winner-section">
                <img src={winner.previewImage} alt="우승자" className="winner-img" />
                <h2>{winner.name}</h2>
                <p>최후의 1인! 생존을 축하합니다!</p>
              </div>
            ) : (
              <h2>생존자가 없습니다...</h2>
            )}

            <div className="stats-summary">
              <h3>⚔️ 킬 랭킹 (Top 3)</h3>
              <ul>
                {[...survivors, ...dead]
                  .sort((a, b) => ((killCounts[b._id] || 0) - (killCounts[a._id] || 0)) || ((assistCounts[b._id] || 0) - (assistCounts[a._id] || 0)))
                  .slice(0, 3)
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
