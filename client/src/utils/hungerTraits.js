// Narrative traits are deliberately independent of ER stats and skill text.
export const HUNGER_TRAITS = Object.freeze([
  { id: 'lightning_control', label: '번개 조종', group: '능력' },
  { id: 'flight', label: '비행 가능', group: '능력' },
  { id: 'underwater_breathing', label: '수중 호흡', group: '생존' },
  { id: 'survivalist', label: '생존 전문가', group: '생존' },
  { id: 'medic', label: '응급 처치', group: '생존' },
  { id: 'mechanical', label: '기계 신체', group: '신체' },
  { id: 'lightning_immune', label: '자연 번개 면역', group: '면역' },
  { id: 'fire_immune', label: '화재 면역', group: '면역' },
  { id: 'poison_immune', label: '독 면역', group: '면역' },
  { id: 'cold_immune', label: '추위 면역', group: '면역' },
  { id: 'lightning_resistant', label: '번개 저항', group: '저항' },
  { id: 'fire_resistant', label: '화재 저항', group: '저항' },
  { id: 'poison_resistant', label: '독 저항', group: '저항' },
  { id: 'cold_resistant', label: '추위 저항', group: '저항' },
]);

export function normalizeHungerTraits(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => /^[a-z][a-z0-9_]{0,63}$/.test(entry)))]
    .slice(0, 32).sort();
}

export function hungerTraitLabel(id) {
  return HUNGER_TRAITS.find((trait) => trait.id === id)?.label || id;
}
