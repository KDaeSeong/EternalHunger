export const HP_DAMAGE_PERCENT_UNIT = 'percent';

// Unmarked older definitions used fractions up to 0.25 and percentage points
// above that threshold. Preserve that interpretation, but never guess the unit
// of a new explicit percentage (0.2% is not 20%).
export function normalizeHpDamagePercent(value, unit) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return unit !== HP_DAMAGE_PERCENT_UNIT && number <= 0.25 ? number * 100 : number;
}

export function readHpDamageRatio(value, unit) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return unit !== HP_DAMAGE_PERCENT_UNIT && number <= 0.25 ? number : number / 100;
}
