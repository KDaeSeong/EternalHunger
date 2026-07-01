import { normalizeRuntimeSurvivor } from './survivorRuntime';

const RUNTIME_CHARACTER_SYNC_FIELDS = [
  'name',
  'gender',
  'summary',
  'previewImage',
  'weaponType',
  'goalGearTier',
  'goalLoadouts',
  'tacticalSkill',
  'tacticalSkillLevel',
  'characterSkillCode',
  'characterSkillLevel',
  'characterSkillLevels',
  'characterSkills',
  'erSubject',
  'erRole',
  'erTrait',
  'erWeapons',
  'stats',
  'specialSkill',
  'records',
];

export function mergeServerCharacterIntoRuntimeSurvivor(runtimeSurvivor, serverCharacter) {
  const base = runtimeSurvivor && typeof runtimeSurvivor === 'object' ? runtimeSurvivor : {};
  const saved = serverCharacter && typeof serverCharacter === 'object' ? serverCharacter : {};
  const next = { ...base };

  for (const field of RUNTIME_CHARACTER_SYNC_FIELDS) {
    if (saved[field] !== undefined) next[field] = saved[field];
  }

  if (saved.inventory !== undefined) next.inventory = saved.inventory;
  if (saved.equipped !== undefined) next.equipped = saved.equipped;

  return normalizeRuntimeSurvivor(next);
}

export function getRuntimeActorKey(actor) {
  return String(actor?._id || actor?.id || actor?.name || '').trim();
}

export function dedupeRuntimeParticipants(list) {
  const out = [];
  const seen = new Set();
  for (const actor of Array.isArray(list) ? list : []) {
    if (!actor || typeof actor !== 'object') continue;
    const key = getRuntimeActorKey(actor) || `idx:${out.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(actor);
  }
  return out;
}
