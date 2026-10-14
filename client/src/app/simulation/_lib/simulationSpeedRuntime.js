export function normalizeAutoSpeed(value) {
  return Math.max(1, Math.min(32, Number(value) || 1));
}
