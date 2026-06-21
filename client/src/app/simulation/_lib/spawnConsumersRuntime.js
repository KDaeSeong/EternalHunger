import {
  clampTier4,
  findItemByKeywords,
  pickWeighted,
  randInt,
  safeTags,
} from './simulationCommon';
import { getTimeOfDayFromPhase } from './worldTime';
import { getLegendaryCoreCandidates } from './legendaryRuntime';
import { classifySpecialByName } from './craftRuntime';
import { canReceiveItem, inferItemCategory, markInventoryGoalItem } from './inventoryRules';
import { roughPower } from './combatRuntime';
import {
  getActorPerkEffects,
  getPerkWildlifeLootBias,
  maybeBoostDropQty,
} from './perkRuntime';

function openSpawnedLegendaryCrate(spawnState, zoneId, publicItems, curDay, curPhase, actor, ruleset, opts = {}) {
  const s = spawnState;
  if (!s || !Array.isArray(s.legendaryCrates)) return null;

  const zid = String(zoneId || '');
  const crate = s.legendaryCrates.find((c) => !c?.opened && String(c?.zoneId) === zid) || null;
  if (!crate) return null;

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
  if (actor && !canReceiveItem(actor?.inventory, item, String(item._id), 1, ruleset)) return null;

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
  const goalItemIds = new Set(
    (Array.isArray(opts?.goalItemIds) ? opts.goalItemIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  );
  const goalLootBoost = Math.max(0, Number(rule?.goalLootBoost ?? ruleset?.drops?.fieldCrate?.goalLootBoost ?? 8));

  const rt = (ruleset?.worldSpawns || {})?.foodCrate?.rewardTable || {};
  const cats = Array.isArray(rt?.categories) ? rt.categories : [];
  const boosts = rt?.boosts || {};

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
      const id = String(it._id);
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
        if (goalItemIds.has(id)) w += goalLootBoost;
        out.push({ item: it, itemId: id, weight: w });
        continue;
      }

      if (want === 'medical') {
        if (cat !== 'consumable') continue;
        const ok = tags.includes('heal') || tags.includes('medical') || lower.includes('bandage') || lower.includes('medkit') || name.includes('붕대') || name.includes('응급');
        if (!ok) continue;

        let w = 3;
        if (name.includes('붕대')) w += Math.max(0, Number(boosts?.bandageName || 0));
        if (goalItemIds.has(id)) w += goalLootBoost;
        out.push({ item: it, itemId: id, weight: w });
        continue;
      }

      if (want === 'material') {
        if (cat !== 'material') continue;
        const tier = clampTier4(it?.tier || 1);
        if (tier > cap) continue;
        let w = tier <= 1 ? 2 : 1;
        if (goalItemIds.has(id)) w += goalLootBoost;
        out.push({ item: it, itemId: id, weight: w });
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
  if (!candidates.length && catKey !== 'food') candidates = buildFoodCrateCandidates('food', tierCap);
  if (!candidates.length && catKey !== 'medical') candidates = buildFoodCrateCandidates('medical', tierCap);
  if (!candidates.length && catKey !== 'material') candidates = buildFoodCrateCandidates('material', tierCap);

  const picked = pickWeighted(candidates);
  if (!picked?.itemId) return null;

  const qty = Math.max(1, randInt(qtyMin, qtyMax));
  const pickedItem = markInventoryGoalItem(picked.item, goalItemIds.has(String(picked.itemId)));
  if (actor && !canReceiveItem(actor?.inventory, pickedItem, String(picked.itemId), qty, ruleset)) return null;

  crate.opened = true;
  crate.openedBy = String(actor?.name || 'unknown');
  crate.openedAt = { day: Number(curDay || 0), phase: String(curPhase || '') };

  const reward = rule?.reward || {};
  const cr = reward?.credits || {};
  const minCr = Number(cr?.min ?? 0);
  const maxCr = Number(cr?.max ?? 0);
  const credits = Math.max(0, randInt(Math.min(minCr, maxCr), Math.max(minCr, maxCr)));

  return { item: pickedItem, itemId: String(picked.itemId), qty, credits, crateType: 'food', zoneId: zid };
}

function pickupSpawnedCore(spawnState, zoneId, publicItems, curDay, curPhase, actor, ruleset, opts = {}) {
  const s = spawnState;
  if (!s || !Array.isArray(s.coreNodes)) return null;

  const zid = String(zoneId || '');
  const node = s.coreNodes.find((n) => !n?.picked && String(n?.zoneId) === zid) || null;
  if (!node) return null;

  const ws = ruleset?.worldSpawns || {};
  const coreRule = ws?.core || {};

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
    if (kind === 'meteor') item = { _id: 'SIM_MATERIAL_METEOR', name: '운석', type: '재료', tier: 4, tags: ['legendary_core', 'meteor'] };
    if (kind === 'life_tree') item = { _id: 'SIM_MATERIAL_LIFETREE', name: '생명의 나무', type: '재료', tier: 4, tags: ['legendary_core', 'life_tree'] };
  }
  if (!item?._id) return null;
  if (actor && !canReceiveItem(actor?.inventory, item, String(item._id), 1, ruleset)) return null;

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
        drops.push({ item: drop, itemId: String(drop._id), qty: 1 });
      }

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

    if (Math.random() < retreatBase + powerBonus) {
      return { kind: k, damage: 0, drops: [], log: `⚠️ 강력한 적과 조우했지만(아이템 미구축) 물러났다` };
    }
  }

  return null;
}

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

export {
  consumeBossAtZone,
  consumeMutantWildlifeAtZone,
  openSpawnedFoodCrate,
  openSpawnedLegendaryCrate,
  pickupSpawnedCore,
};
