import { normalizeErStatDeltaMap } from './erStats.js';

export function getPassiveSkillStatModifiers(character) {
  const passive = character?.characterSkills?.passive;
  if (!passive || passive.enabled !== true) return null;
  const modifiers = passive.statModifiers;
  return modifiers && typeof modifiers === 'object' ? normalizeErStatDeltaMap(modifiers) : null;
}

// Initialization and pregame editing only. Keep the actual applied delta so
// even a negative bonus clamped at 1 HP can later be removed without drift.
export function applyStartingPassiveHealth(character) {
  if (!Number.isFinite(character?.hp) || !Number.isFinite(character?.maxHp)) return character;
  const bonus = Number(getPassiveSkillStatModifiers(character)?.maxHp || 0);
  const applied = Number(character._passiveMaxHpApplied || 0);
  if (!bonus && !applied) return character;
  const baseMax = Math.max(1, character.maxHp - applied);
  const maxHp = Math.max(1, Math.round(baseMax + bonus));
  return { ...character, maxHp, _passiveMaxHpApplied: maxHp - baseMax,
    ...(Number.isFinite(character._perkBaseMaxHp) ? { _perkBaseMaxHp: character._perkBaseMaxHp + maxHp - character.maxHp } : {}),
    hp: character.hp <= 0 ? 0 : Math.max(0, Math.min(maxHp, character.hp + maxHp - character.maxHp)) };
}
