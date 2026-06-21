const MAX_PREVIEW_IMAGE_CHARS = 60000;
const MAX_TEXT_CHARS = 4000;

const STAT_KEYS = ['str', 'agi', 'int', 'men', 'luk', 'dex', 'sht', 'end'];
const LOADOUT_TIERS = ['hero', 'legend', 'transcend'];
const LOADOUT_KEYS = ['weaponKey', 'headKey', 'clothesKey', 'armKey', 'shoesKey'];
const SIMPLE_COMPARE_KEYS = [
  'name',
  'gender',
  'summary',
  'weaponType',
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
  const src = stats && typeof stats === 'object' ? stats : {};
  const out = {};
  for (const key of STAT_KEYS) out[key] = cleanNumber(src[key], 0);
  return out;
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
  if (key === 'tacticalSkillLevel') return Math.max(1, Math.min(2, cleanNumber(value, 1)));
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
  if (c.goalGearTier !== undefined) out.goalGearTier = cleanNumber(c.goalGearTier, 6);
  if (c.tacticalSkill !== undefined) out.tacticalSkill = cleanString(c.tacticalSkill, 128) || '';
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
