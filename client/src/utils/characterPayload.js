import { normalizeSupportedTacSkill } from './tacticalSkillCatalog.js';
import { ER_STAT_KEYS, normalizeErStats } from './erStats.js';

const MAX_PREVIEW_IMAGE_CHARS = 60000;
const MAX_TEXT_CHARS = 4000;

const STAT_KEYS = ER_STAT_KEYS;
const LOADOUT_TIERS = ['hero', 'legend', 'transcend'];
const LOADOUT_KEYS = ['weaponKey', 'headKey', 'clothesKey', 'armKey', 'shoesKey'];
const ACTIVE_SKILL_SLOTS = ['q', 'w', 'e', 'r'];
const CHARACTER_SKILL_SLOTS = [...ACTIVE_SKILL_SLOTS, 'passive'];
const SKILL_LEVEL_ARRAY_FIELDS = [
  'firstFlat',
  'secondFlat',
  'flatDamage',
  'maxHpPct',
  'currentHpPct',
  'secondMaxHpPct',
  'secondCurrentHpPct',
  'heal',
  'shield',
];
const SIMPLE_COMPARE_KEYS = [
  'name',
  'gender',
  'summary',
  'weaponType',
  'characterTemplateId',
  'characterSkillCode',
  'characterSkillLevel',
  'goalGearTier',
  'tacticalSkill',
  'tacticalSkillLevel',
  'erSubject',
  'erRole',
  'erTrait',
  'previewImage',
];

function cleanString(value, max = MAX_TEXT_CHARS) {
  if (value === undefined || value === null) return undefined;
  const text = String(value);
  return text.length > max ? text.slice(0, max) : text;
}

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanObjectId(value) {
  const text = String(value || '').trim();
  return /^[a-f\d]{24}$/i.test(text) ? text : undefined;
}

function characterKey(character) {
  const c = character && typeof character === 'object' ? character : {};
  return String(c._id || c.id || '').trim();
}

function normalizePreviewIdSet(ids) {
  if (!ids) return null;
  if (ids instanceof Set) return ids;
  if (Array.isArray(ids)) return new Set(ids.map((id) => String(id || '').trim()).filter(Boolean));
  return null;
}

function shouldIncludePreviewImage(character, options = {}) {
  if (options.omitPreviewImages) return false;

  const idSet = normalizePreviewIdSet(options.previewImageIds);
  if (idSet) return idSet.has(characterKey(character));

  if (options.includePreviewImages !== undefined) return Boolean(options.includePreviewImages);

  return !cleanObjectId(character?._id);
}

function cleanPreviewImage(value) {
  const text = String(value || '').trim();
  if (!text) return undefined;
  if (text.startsWith('data:image/')) {
    return text.length <= MAX_PREVIEW_IMAGE_CHARS ? text : undefined;
  }
  return text.length <= 4096 ? text : undefined;
}

function cleanStats(stats) {
  return normalizeErStats(stats);
}

function cleanLoadouts(goalLoadouts) {
  const src = goalLoadouts && typeof goalLoadouts === 'object' ? goalLoadouts : {};
  const out = {};
  for (const tier of LOADOUT_TIERS) {
    const tierSrc = src[tier] && typeof src[tier] === 'object' ? src[tier] : {};
    out[tier] = {};
    for (const key of LOADOUT_KEYS) out[tier][key] = cleanString(tierSrc[key], 256) || '';
  }
  return out;
}

function cleanSkillLevels(levels) {
  const src = levels && typeof levels === 'object' ? levels : {};
  const out = {};
  for (const key of ['q', 'w', 'e', 'r']) {
    out[key] = Math.max(1, Math.min(5, cleanNumber(src[key], 1)));
  }
  return out;
}

function cleanLevelArray(value, fallback = 0) {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? '').split(/[,\s/]+/).filter(Boolean);
  const src = raw.length ? raw : [fallback];
  const out = [];
  for (let i = 0; i < 5; i += 1) {
    const picked = src[i] ?? src[src.length - 1] ?? fallback;
    out.push(cleanNumber(picked, fallback));
  }
  return out;
}

function cleanSkillStatModifiers(statModifiers) {
  const src = statModifiers && typeof statModifiers === 'object' ? statModifiers : {};
  const out = {};
  for (const key of ER_STAT_KEYS) {
    const value = cleanNumber(src[key], 0);
    if (value !== 0) out[key] = value;
  }
  return out;
}

function cleanPctInput(value, fallback = 0) {
  const n = cleanNumber(value, fallback);
  if (n <= 0) return 0;
  return n > 1 ? n / 100 : n;
}

function cleanCharacterSkill(raw, slot) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const isPassive = slot === 'passive';
  const defaultType = isPassive ? 'passive_stat' : slot === 'q' ? 'basic_attack_recast' : 'combat_effect';
  const defaultCooldown = slot === 'r' ? 60 : slot === 'e' ? 18 : slot === 'w' ? 12 : slot === 'q' ? 7 : 0;
  const out = {
    enabled: src.enabled === true,
    slot,
    type: cleanString(src.type, 64) || defaultType,
    trigger: cleanString(src.trigger, 64) || (isPassive ? 'always' : 'basic_attack'),
    name: cleanString(src.name, 256) || '',
    sourceText: cleanString(src.sourceText, MAX_TEXT_CHARS) || '',
    cooldownSec: Math.max(isPassive ? 0 : 1, cleanNumber(src.cooldownSec, defaultCooldown)),
    recastWindowSec: Math.max(0, cleanNumber(src.recastWindowSec, slot === 'q' ? 5 : 0)),
    range: Math.max(0, cleanNumber(src.range, 0)),
    castDelaySec: Math.max(0, cleanNumber(src.castDelaySec, 0)),
    recoveryDelaySec: Math.max(0, cleanNumber(src.recoveryDelaySec, 0)),
    useCondition: cleanString(src.useCondition, 64) || 'auto',
    targetPriority: cleanString(src.targetPriority, 64) || 'auto',
    minExpectedDamage: Math.max(0, cleanNumber(src.minExpectedDamage, 1)),
    minSplashTargets: Math.max(0, Math.floor(cleanNumber(src.minSplashTargets, 0))),
    minCasterHpPct: cleanPctInput(src.minCasterHpPct, 0),
    maxCasterHpPct: cleanPctInput(src.maxCasterHpPct, 0),
    minTargetHpPct: cleanPctInput(src.minTargetHpPct, 0),
    maxTargetHpPct: cleanPctInput(src.maxTargetHpPct, 0),
    radius: Math.max(0, cleanNumber(src.radius, 0)),
    durationSec: Math.max(0, cleanNumber(src.durationSec, 0)),
    firstSkillAmpScale: Math.max(0, cleanNumber(src.firstSkillAmpScale, 0)),
    secondSkillAmpScale: Math.max(0, cleanNumber(src.secondSkillAmpScale, 0)),
    skillAmpScale: Math.max(0, cleanNumber(src.skillAmpScale ?? src.firstSkillAmpScale, 0)),
    statModifiers: cleanSkillStatModifiers(src.statModifiers),
    tags: Array.isArray(src.tags) ? src.tags.map((tag) => cleanString(tag, 128)).filter(Boolean).slice(0, 16) : [],
  };
  for (const field of SKILL_LEVEL_ARRAY_FIELDS) {
    out[field] = cleanLevelArray(src[field], 0);
  }
  if (!isPassive && !src.flatDamage && src.firstFlat) out.flatDamage = cleanLevelArray(src.firstFlat, 0);
  return out;
}

function cleanCharacterSkills(skills) {
  const src = skills && typeof skills === 'object' ? skills : {};
  return Object.fromEntries(
    CHARACTER_SKILL_SLOTS.map((slot) => [slot, cleanCharacterSkill(src[slot], slot)])
  );
}

function cleanStatsObject(stats) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return undefined;
  const out = {};
  for (const [key, value] of Object.entries(stats)) {
    const n = Number(value);
    if (Number.isFinite(n)) out[key] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

function cleanInventoryEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const out = {};
  const itemId = entry.itemId ?? entry._id ?? entry.id;
  if (itemId !== undefined && itemId !== null && String(itemId).trim()) out.itemId = String(itemId);
  if (entry.id !== undefined && entry.id !== null && String(entry.id).trim()) out.id = String(entry.id);
  if (entry.name !== undefined) out.name = cleanString(entry.name, 512);
  if (entry.qty !== undefined) out.qty = Math.max(1, cleanNumber(entry.qty, 1));
  if (entry.type !== undefined) out.type = cleanString(entry.type, 128);
  if (Array.isArray(entry.tags)) out.tags = entry.tags.map((x) => cleanString(x, 128)).filter(Boolean).slice(0, 24);
  if (entry.equipSlot !== undefined) out.equipSlot = cleanString(entry.equipSlot, 64);
  if (entry.weaponType !== undefined) out.weaponType = cleanString(entry.weaponType, 128);
  if (entry.tier !== undefined) out.tier = cleanNumber(entry.tier, 0);
  if (entry.grade !== undefined) out.grade = cleanString(entry.grade, 128);
  const stats = cleanStatsObject(entry.stats);
  if (stats) out.stats = stats;
  if (entry.acquiredDay !== undefined) out.acquiredDay = cleanNumber(entry.acquiredDay, 0);
  return Object.keys(out).length ? out : null;
}

function cleanRecords(records) {
  if (!records || typeof records !== 'object') return undefined;
  return {
    totalKills: cleanNumber(records.totalKills, 0),
    totalWins: cleanNumber(records.totalWins, 0),
    gamesPlayed: cleanNumber(records.gamesPlayed, 0),
    deathCount: cleanNumber(records.deathCount, 0),
  };
}

function cleanArrayStrings(list, max = 128) {
  return (Array.isArray(list) ? list : [])
    .map((x) => cleanString(x, max))
    .filter(Boolean);
}

function stableStringify(value) {
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function comparableValueForKey(value, key) {
  if (key === 'goalGearTier') return cleanNumber(value, 6);
  if (key === 'characterSkillLevel') return Math.max(1, Math.min(5, cleanNumber(value, 1)));
  if (key === 'characterSkills') return stableStringify(cleanCharacterSkills(value));
  if (key === 'tacticalSkillLevel') return Math.max(1, Math.min(2, cleanNumber(value, 1)));
  if (key === 'tacticalSkill') return normalizeSupportedTacSkill(value);
  if (key === 'previewImage') return cleanPreviewImage(value) || '';
  if (key === 'name') return cleanString(value, 512) || 'Unnamed';
  if (key === 'gender') return cleanString(value, 64) || 'unknown';
  if (key === 'summary') return cleanString(value, MAX_TEXT_CHARS) || '';
  return cleanString(value, 512) || '';
}

function compareField(payload, saved, key) {
  if (!payload || payload[key] === undefined) return true;
  return comparableValueForKey(payload[key], key) === comparableValueForKey(saved?.[key], key);
}

function compareObject(payloadValue, savedValue, cleaner) {
  return stableStringify(cleaner(payloadValue)) === stableStringify(cleaner(savedValue));
}

export function findCharacterSaveMismatches(payloadCharacters, savedCharacters, options = {}) {
  const savedById = new Map(
    (Array.isArray(savedCharacters) ? savedCharacters : [])
      .map((char) => [String(char?._id || '').trim(), char])
      .filter(([id]) => Boolean(id))
  );
  const savedIdByClientId = new Map(
    (Array.isArray(options?.saveResults) ? options.saveResults : [])
      .map((row) => [String(row?.clientId || '').trim(), String(row?._id || '').trim()])
      .filter(([clientId, savedId]) => Boolean(clientId) && Boolean(savedId))
  );
  const mismatches = [];

  for (const payload of Array.isArray(payloadCharacters) ? payloadCharacters : []) {
    const requestId = String(payload?._id || payload?.id || '').trim();
    const id = String(payload?._id || savedIdByClientId.get(requestId) || '').trim();
    if (!id) continue;
    const saved = savedById.get(id);
    if (!saved) {
      mismatches.push({ id: requestId || id, field: '_id' });
      continue;
    }

    for (const key of SIMPLE_COMPARE_KEYS) {
      if (!compareField(payload, saved, key)) mismatches.push({ id: requestId || id, field: key });
    }
    if (payload?.stats !== undefined && !compareObject(payload.stats, saved?.stats, cleanStats)) {
      mismatches.push({ id: requestId || id, field: 'stats' });
    }
    if (payload?.goalLoadouts !== undefined && !compareObject(payload.goalLoadouts, saved?.goalLoadouts, cleanLoadouts)) {
      mismatches.push({ id: requestId || id, field: 'goalLoadouts' });
    }
    if (payload?.characterSkillLevels !== undefined && !compareObject(payload.characterSkillLevels, saved?.characterSkillLevels, cleanSkillLevels)) {
      mismatches.push({ id: requestId || id, field: 'characterSkillLevels' });
    }
    if (payload?.characterSkills !== undefined && !compareObject(payload.characterSkills, saved?.characterSkills, cleanCharacterSkills)) {
      mismatches.push({ id: requestId || id, field: 'characterSkills' });
    }
    if (payload?.erWeapons !== undefined && stableStringify(cleanArrayStrings(payload.erWeapons)) !== stableStringify(cleanArrayStrings(saved?.erWeapons))) {
      mismatches.push({ id: requestId || id, field: 'erWeapons' });
    }
  }

  return mismatches;
}

export function compactCharacterForSave(character, options = {}) {
  const c = character && typeof character === 'object' ? character : {};
  const out = {};

  const dbId = cleanObjectId(c._id);
  if (dbId) out._id = dbId;
  else if (c.id !== undefined && c.id !== null) out.id = c.id;

  out.name = cleanString(c.name, 512) || 'Unnamed';
  out.gender = cleanString(c.gender, 64) || 'unknown';
  out.stats = cleanStats(c.stats);

  if (shouldIncludePreviewImage(c, options)) {
    const previewImage = cleanPreviewImage(c.previewImage);
    if (previewImage !== undefined) out.previewImage = previewImage;
  }

  if (c.summary !== undefined) out.summary = cleanString(c.summary, MAX_TEXT_CHARS);
  if (c.weaponType !== undefined) out.weaponType = cleanString(c.weaponType, 128) || '';
  if (c.characterTemplateId !== undefined) out.characterTemplateId = cleanString(c.characterTemplateId, 128) || '';
  if (c.characterSkillCode !== undefined) out.characterSkillCode = cleanString(c.characterSkillCode, 128) || '';
  if (c.characterSkillLevel !== undefined) out.characterSkillLevel = Math.max(1, Math.min(5, cleanNumber(c.characterSkillLevel, 1)));
  if (c.characterSkillLevels !== undefined) out.characterSkillLevels = cleanSkillLevels(c.characterSkillLevels);
  if (c.characterSkills !== undefined) out.characterSkills = cleanCharacterSkills(c.characterSkills);
  if (c.goalGearTier !== undefined) out.goalGearTier = cleanNumber(c.goalGearTier, 6);
  if (c.tacticalSkill !== undefined) out.tacticalSkill = normalizeSupportedTacSkill(c.tacticalSkill);
  if (c.tacticalSkillLevel !== undefined) out.tacticalSkillLevel = Math.max(1, Math.min(2, cleanNumber(c.tacticalSkillLevel, 1)));
  if (c.erSubject !== undefined) out.erSubject = cleanString(c.erSubject, 128) || '';
  if (c.erRole !== undefined) out.erRole = cleanString(c.erRole, 128) || '';
  if (c.erTrait !== undefined) out.erTrait = cleanString(c.erTrait, 128) || '';
  if (Array.isArray(c.erWeapons)) out.erWeapons = c.erWeapons.map((x) => cleanString(x, 128)).filter(Boolean).slice(0, 8);
  if (c.goalLoadouts !== undefined) out.goalLoadouts = cleanLoadouts(c.goalLoadouts);
  if (Array.isArray(c.inventory)) out.inventory = c.inventory.map(cleanInventoryEntry).filter(Boolean).slice(0, 80);
  if (c.specialSkill && typeof c.specialSkill === 'object') {
    out.specialSkill = {
      name: cleanString(c.specialSkill.name, 256) || '',
      description: cleanString(c.specialSkill.description, MAX_TEXT_CHARS),
      type: cleanString(c.specialSkill.type, 64),
      effectValue: cleanNumber(c.specialSkill.effectValue, 0),
    };
  }
  const records = cleanRecords(c.records);
  if (records) out.records = records;

  return out;
}

export function compactCharactersForSave(characters, options = {}) {
  return (Array.isArray(characters) ? characters : []).map((character) => compactCharacterForSave(character, options));
}

export function estimateCharacterPayloadBytes(characters, options = {}) {
  try {
    return new Blob([JSON.stringify(compactCharactersForSave(characters, options))]).size;
  } catch {
    return JSON.stringify(compactCharactersForSave(characters, options)).length;
  }
}
