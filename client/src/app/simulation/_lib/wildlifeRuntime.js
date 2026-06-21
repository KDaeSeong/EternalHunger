import {
  applyPerkCreditBonus,
  applyPerkDamageReduction,
  getActorPerkEffects,
  getPerkWildlifeLootBias,
  maybeBoostDropQty,
  normalizePerkPct,
  perkNumber,
} from './perkRuntime';
import { findItemByKeywords, pickWeighted, randInt } from './simulationCommon';
import { isAtOrAfterWorldTime } from './worldTime';
import { roughPower } from './combatRuntime';
import { getEquipTierSummary } from './survivorRuntime';
import { pickFromAllCrates } from './lootRuntime';

const WILDLIFE_SPECIES = {
  chicken: { key: 'chicken', label: '닭', icon: '🐔', dayWeight: 4, nightWeight: 1, credits: [12, 18], dmg: 4, meatQty: 0, chickenDropChance: 0.5 },
  bat: { key: 'bat', label: '박쥐', icon: '🦇', dayWeight: 2, nightWeight: 2, credits: [9, 14], dmg: 6, meatQty: 0 },
  boar: { key: 'boar', label: '멧돼지', icon: '🐗', dayWeight: 2, nightWeight: 2, credits: [14, 22], dmg: 8, meatQty: 2 },
  dog: { key: 'dog', label: '들개', icon: '🐕', dayWeight: 2, nightWeight: 1, credits: [14, 22], dmg: 7, meatQty: 1 },
  wolf: { key: 'wolf', label: '늑대', icon: '🐺', dayWeight: 1, nightWeight: 2, credits: [18, 28], dmg: 9, meatQty: 1 },
  bear: { key: 'bear', label: '곰', icon: '🐻', dayWeight: 0.4, nightWeight: 3, credits: [22, 34], dmg: 11, meatQty: 1 },
};

const WILDLIFE_ALIASES = {
  닭: 'chicken',
  chicken: 'chicken',
  bat: 'bat',
  박쥐: 'bat',
  boar: 'boar',
  멧돼지: 'boar',
  dog: 'dog',
  들개: 'dog',
  wolf: 'wolf',
  늑대: 'wolf',
  bear: 'bear',
  곰: 'bear',
};

function normalizeWildlifeSpeciesKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  return WILDLIFE_ALIASES[raw] || WILDLIFE_ALIASES[lower] || (WILDLIFE_SPECIES[lower] ? lower : '');
}

function getWildlifeSpeciesSpec(value, fallback = 'chicken') {
  const key = normalizeWildlifeSpeciesKey(value) || normalizeWildlifeSpeciesKey(fallback) || 'chicken';
  return WILDLIFE_SPECIES[key] || WILDLIFE_SPECIES.chicken;
}

function rollWildlifeEncounter(mapObj, zoneId, publicItems, curDay, curPhase, actor, opts = {}) {
  const moved = !!opts.moved;
  const isKioskZone = !!opts.isKioskZone;
  const disableBoss = !!opts.disableBoss;
  const force = !!opts.force;
  const perkFx = getActorPerkEffects(actor);
  const perkWildLootBias = Math.max(0, getPerkWildlifeLootBias(perkFx));
  const perkWildCreditPct = normalizePerkPct(perkFx?.wildlifeCreditsPct || 0);
  const perkWildDamageMinus = Math.max(0, perkNumber(perkFx?.wildlifeDamageMinus || 0));

  const baseChance = isKioskZone ? (moved ? 0.10 : 0.05) : (moved ? 0.22 : 0.10);
  if (!force && Math.random() >= baseChance) return null;

  const p = roughPower(actor);
  const powerBonus = Math.min(0.25, Math.max(0, (p - 40) / 240));

  const tod = curPhase === 'morning' ? 'day' : 'night';
  const forcedSpecies = normalizeWildlifeSpeciesKey(opts.speciesKey || opts.species || '');
  const spawnPool = forcedSpecies
    ? [{ ...getWildlifeSpeciesSpec(forcedSpecies), weight: 1 }]
    : Object.values(WILDLIFE_SPECIES)
      .map((row) => ({ ...row, weight: tod === 'day' ? Number(row.dayWeight || 0) : Number(row.nightWeight || 0) }))
      .filter((row) => Number(row.weight || 0) > 0);
  const species = pickWeighted(spawnPool) || spawnPool[0] || WILDLIFE_SPECIES.chicken;

  if (!disableBoss) {
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

  const meat = findItemByKeywords(publicItems, ['고기']);
  if (meat?._id && Number(species?.meatQty || 0) > 0) {
    drops.push({ item: meat, itemId: String(meat._id), qty: maybeBoostDropQty(Number(species.meatQty || 1), perkWildLootBias * 0.32, 1) });
  }
  if (species?.key === 'chicken') {
    const chicken = findItemByKeywords(publicItems, ['치킨']);
    if (chicken?._id && Math.random() < Math.min(0.75, Number(species?.chickenDropChance ?? 0.5) + perkWildLootBias * 0.12)) {
      drops.push({ item: chicken, itemId: String(chicken._id), qty: maybeBoostDropQty(1, perkWildLootBias * 0.28, 1) });
    } else if (meat?._id && Math.random() < Math.min(0.92, (2 / 3) + perkWildLootBias * 0.12)) {
      drops.push({ item: meat, itemId: String(meat._id), qty: maybeBoostDropQty(1, perkWildLootBias * 0.32, 1) });
    }
  }

  if (Math.random() < Math.min(0.22, 0.05 + perkWildLootBias * 0.06)) {
    const meteor = findItemByKeywords(publicItems, ['운석', 'meteor']);
    const tree = findItemByKeywords(publicItems, ['생명의 나무', '생나', 'tree of life', 'life tree']);
    const pick = (Math.random() < 0.5 ? meteor : tree) || meteor || tree;
    if (pick?._id) drops.push({ item: pick, itemId: String(pick._id), qty: 1 });
  }

  if (!drops.length) return null;

  const dayScale = 1 + Math.min(0.35, Math.max(0, (Number(curDay || 1) - 1) * 0.08));
  const crRange = Array.isArray(species?.credits) ? species.credits : [10, 14];
  const crMin = Math.max(0, Number(crRange[0] ?? 10));
  const crMax = Math.max(crMin, Number(crRange[1] ?? 14));

  const tierSum = getEquipTierSummary(actor);
  const avgTier = (Number(tierSum.weaponTier || 0) + Number(tierSum.armorTierSum || 0) / 4) / 2;
  const underdogMul = (Number(curDay || 1) >= 3 && avgTier <= 3.2) ? 1.6 : (Number(curDay || 1) >= 4 && avgTier <= 4.2) ? 1.3 : 1.0;

  const credits0 = Math.max(0, Math.floor(randInt(Math.floor(crMin * dayScale), Math.floor(crMax * dayScale)) * underdogMul));
  const credits = applyPerkCreditBonus(credits0, perkWildCreditPct);

  const dmgBase = Math.max(0, Number(species?.dmg ?? 4));
  const dmg = applyPerkDamageReduction(Math.max(0, dmgBase - Math.floor(p / 18)), perkWildDamageMinus);
  return {
    kind: String(species?.key || 'wildlife'),
    damage: dmg,
    credits,
    drops,
    log: `${String(species?.icon || '🦌')} ${String(species?.label || '야생동물')} 사냥 성공`,
  };

  return null;
}

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

  const base = isKioskZone ? (moved ? 0.18 : 0.08) : (moved ? 0.70 : 0.38);
  const densBoost = Math.min(0.22, cur * 0.04);
  const chance = Math.min(0.92, base + densBoost);
  if (Math.random() >= chance) return null;

  const speciesList = s.wildlifeSpecies && typeof s.wildlifeSpecies === 'object' && Array.isArray(s.wildlifeSpecies[zid])
    ? s.wildlifeSpecies[zid]
    : null;
  const speciesKey = speciesList && speciesList.length
    ? normalizeWildlifeSpeciesKey(speciesList.shift()) || ''
    : '';
  s.wildlife[zid] = Math.max(0, cur - 1);
  if (speciesList) {
    s.wildlife[zid] = Math.max(0, speciesList.length);
  }

  const res = rollWildlifeEncounter(mapObj, zid, publicItems, curDay, curPhase, actor, {
    moved,
    isKioskZone,
    disableBoss: true,
    force: true,
    speciesKey,
  });

  if (res) return res;

  const species = getWildlifeSpeciesSpec(speciesKey, curPhase === 'night' ? 'bear' : 'chicken');
  const p = roughPower(actor);
  const perkFx = getActorPerkEffects(actor);
  const crRange = Array.isArray(species?.credits) ? species.credits : [12, 22];
  const dmg = applyPerkDamageReduction(Math.max(0, Number(species?.dmg ?? 5) - Math.floor(p / 22)), Math.max(0, perkNumber(perkFx?.wildlifeDamageMinus || 0)));
  const credits = applyPerkCreditBonus(Math.max(0, randInt(Number(crRange[0] ?? 12), Number(crRange[1] ?? 22))), perkFx?.wildlifeCreditsPct || 0);
  return { kind: String(species?.key || 'wildlife'), damage: dmg, credits, drops: [], log: `${String(species?.icon || '🦌')} ${String(species?.label || '야생동물')} 사냥 성공` };
}

export {
  consumeWildlifeAtZone,
  rollWildlifeEncounter,
};
