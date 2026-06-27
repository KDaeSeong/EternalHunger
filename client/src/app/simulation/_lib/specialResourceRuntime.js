import { findItemByKeywords, randInt } from './simulationCommon';
import { canonicalCoreZoneId } from './coreSpawnRuntime';

const METEOR_EXCLUDED_ZONE_IDS = new Set(['stream', 'forest', 'hotel', 'temple', 'cemetery']);

const METEOR_PHASE_COUNTS = {
  '2:morning': 2,
  '3:morning': 2,
  '4:morning': 2,
};

const LIFE_TREE_PHASE_ZONES = {
  '2:morning': ['hotel', 'temple', 'cemetery'],
  '3:morning': ['stream', 'forest'],
};

const SPECIAL_RESOURCE_KEYWORDS = {
  meteor: ['운석', 'meteor'],
  life_tree: ['생명의 나무', '생나', 'tree of life', 'life tree'],
  mithril: ['미스릴', 'mithril'],
  force_core: ['포스 코어', 'force core', 'forcecore'],
  vf_blood_sample: ['vf 혈액', 'vf 샘플', 'blood sample', '혈액 샘플', 'vf'],
};

const DEFAULT_SPECIAL_DROP_RULES = {
  wolf: [
    { key: 'meteor', chance: 0.035 },
    { key: 'life_tree', chance: 0.035 },
  ],
  bear: [
    { key: 'meteor', chance: 0.06 },
    { key: 'life_tree', chance: 0.06 },
    { key: 'mithril', chance: 0.05 },
    { key: 'force_core', chance: 0.025 },
  ],
  alpha: [
    { key: 'mithril', chance: 1 },
  ],
  omega: [
    { key: 'force_core', chance: 1 },
  ],
  weakline: [
    { key: 'vf_blood_sample', chance: 1 },
    { key: 'meteor', chance: 0.10 },
    { key: 'life_tree', chance: 0.10 },
    { key: 'mithril', chance: 0.08 },
  ],
  mutant_wolf: [
    { key: 'meteor', chance: 0.07 },
    { key: 'life_tree', chance: 0.07 },
  ],
  mutant_bear: [
    { key: 'meteor', chance: 0.09 },
    { key: 'life_tree', chance: 0.09 },
    { key: 'mithril', chance: 0.08 },
    { key: 'force_core', chance: 0.04 },
  ],
  gamma: [
    { key: 'meteor', chance: 0.10 },
    { key: 'life_tree', chance: 0.10 },
    { key: 'mithril', chance: 0.10 },
  ],
  mutant_bear_pack: [
    { key: 'meteor', chance: 0.14 },
    { key: 'life_tree', chance: 0.14 },
    { key: 'mithril', chance: 0.12 },
    { key: 'force_core', chance: 0.06 },
  ],
};

function phaseKey(day, phase) {
  return `${Number(day || 0)}:${String(phase || '')}`;
}

function normalizeDropSourceKind(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('wick') || raw.includes('weak') || raw.includes('위클')) return 'weakline';
  if (raw.includes('omega') || raw.includes('오메가')) return 'omega';
  if (raw.includes('alpha') || raw.includes('알파')) return 'alpha';
  if (raw.includes('gamma') || raw.includes('감마')) return 'gamma';
  if (raw.includes('mutant_bear_pack') || raw.includes('변이체 무리')) return 'mutant_bear_pack';
  if (raw.includes('mutant_bear') || raw.includes('변이 곰')) return 'mutant_bear';
  if (raw.includes('mutant_wolf') || raw.includes('변이 늑대')) return 'mutant_wolf';
  if (raw.includes('bear') || raw.includes('곰')) return 'bear';
  if (raw.includes('wolf') || raw.includes('늑대')) return 'wolf';
  return raw;
}

function normalizeAnimalDropSource(kind, animal = '') {
  const k = normalizeDropSourceKind(kind);
  const a = normalizeDropSourceKind(animal);
  if (k === 'mutant_wildlife') {
    if (a === 'bear') return 'mutant_bear';
    if (a === 'wolf') return 'mutant_wolf';
    return '';
  }
  return k || a;
}

function findSpecialResourceItem(publicItems, key) {
  return findItemByKeywords(publicItems, SPECIAL_RESOURCE_KEYWORDS[key] || []);
}

function getSpecialDropRules(sourceKind, ruleset) {
  const key = normalizeDropSourceKind(sourceKind);
  const custom = ruleset?.worldSpawns?.specialResourceDrops?.[key];
  const list = Array.isArray(custom) ? custom : DEFAULT_SPECIAL_DROP_RULES[key];
  return Array.isArray(list) ? list : [];
}

function rollSpecialResourceDrops(sourceKind, publicItems, opts = {}) {
  const rules = getSpecialDropRules(sourceKind, opts?.ruleset);
  if (!rules.length) return [];

  const perkLootBias = Math.max(0, Number(opts?.perkLootBias || 0));
  const bonus = Math.min(0.05, perkLootBias * 0.035);
  const drops = [];

  for (const rule of rules) {
    const key = String(rule?.key || '').trim();
    if (!key) continue;
    const item = findSpecialResourceItem(publicItems, key);
    if (!item?._id) continue;
    const baseChance = Math.max(0, Math.min(1, Number(rule?.chance ?? 0)));
    const chance = Math.min(1, baseChance >= 1 ? 1 : baseChance + bonus);
    if (Math.random() >= chance) continue;
    drops.push({
      item,
      itemId: String(item._id),
      qty: Math.max(1, Math.floor(Number(rule?.qty || 1))),
      resourceKey: key,
    });
  }

  return drops;
}

function getCoreSpawnScheduleSummary() {
  return {
    meteor: { phaseCounts: { ...METEOR_PHASE_COUNTS }, excludedZoneIds: [...METEOR_EXCLUDED_ZONE_IDS] },
    life_tree: { phaseZones: { ...LIFE_TREE_PHASE_ZONES } },
  };
}

function getMeteorSpawnZonePool(zones, forbiddenIds, usedZoneIds = []) {
  const forb = forbiddenIds instanceof Set ? new Set([...forbiddenIds].map(canonicalCoreZoneId)) : new Set();
  const used = new Set((Array.isArray(usedZoneIds) ? usedZoneIds : []).map(canonicalCoreZoneId).filter(Boolean));
  return (Array.isArray(zones) ? zones : [])
    .map((z) => canonicalCoreZoneId(z?.zoneId))
    .filter(Boolean)
    .filter((zid) => !forb.has(zid))
    .filter((zid) => !used.has(zid))
    .filter((zid) => !METEOR_EXCLUDED_ZONE_IDS.has(zid));
}

function getLifeTreeSpawnZoneIds(day, phase, zones, forbiddenIds) {
  const key = phaseKey(day, phase);
  const wanted = LIFE_TREE_PHASE_ZONES[key] || [];
  if (!wanted.length) return [];
  const zoneSet = new Set((Array.isArray(zones) ? zones : []).map((z) => canonicalCoreZoneId(z?.zoneId)).filter(Boolean));
  const forb = forbiddenIds instanceof Set ? new Set([...forbiddenIds].map(canonicalCoreZoneId)) : new Set();
  return wanted
    .map(canonicalCoreZoneId)
    .filter((zid) => zid && zoneSet.has(zid) && !forb.has(zid));
}

function buildCoreSpawnPlan({ zones, forbiddenIds, day, phase, usedMeteorZoneIds = [] }) {
  const key = phaseKey(day, phase);
  const plan = [];

  for (const zoneId of getLifeTreeSpawnZoneIds(day, phase, zones, forbiddenIds)) {
    plan.push({ kind: 'life_tree', zoneId });
  }

  const meteorCount = Math.max(0, Number(METEOR_PHASE_COUNTS[key] || 0));
  if (meteorCount > 0) {
    const pool = getMeteorSpawnZonePool(zones, forbiddenIds, usedMeteorZoneIds);
    const count = Math.min(meteorCount, pool.length);
    for (let i = 0; i < count; i += 1) {
      const idx = randInt(0, Math.max(0, pool.length - 1));
      const zoneId = pool.splice(idx, 1)[0];
      if (zoneId) plan.push({ kind: 'meteor', zoneId });
    }
  }

  return plan;
}

export {
  DEFAULT_SPECIAL_DROP_RULES,
  LIFE_TREE_PHASE_ZONES,
  METEOR_EXCLUDED_ZONE_IDS,
  METEOR_PHASE_COUNTS,
  buildCoreSpawnPlan,
  findSpecialResourceItem,
  getCoreSpawnScheduleSummary,
  normalizeAnimalDropSource,
  normalizeDropSourceKind,
  rollSpecialResourceDrops,
};
