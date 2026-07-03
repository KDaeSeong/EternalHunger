export function normalizeRuntimeEffect(effect) {
  if (!effect || typeof effect !== 'object') return null;
  const next = { ...effect };
  if (next?.remainingDuration != null) {
    const dur = Number(next.remainingDuration);
    const alreadySeconds = next?.durationUnit === 'sec' || next?.durationSec != null || dur > 10;
    next.remainingDuration = Number.isFinite(dur) ? Math.max(0, Math.floor(alreadySeconds ? dur : dur * 10)) : 0;
    next.durationUnit = 'sec';
  }
  if (next?.dotDamage != null) {
    const dot = Number(next.dotDamage);
    next.dotDamage = Number.isFinite(dot) ? Math.max(0, Math.floor(dot)) : 0;
  }
  if (next?.recovery != null) {
    const rec = Number(next.recovery);
    next.recovery = Number.isFinite(rec) ? Math.max(0, Math.floor(rec)) : 0;
  }
  if (next?.shieldValue != null) {
    const shield = Number(next.shieldValue);
    next.shieldValue = Number.isFinite(shield) ? Math.max(0, Math.floor(shield)) : 0;
  }
  if (next?.healReductionPct != null) {
    const value = Number(next.healReductionPct);
    next.healReductionPct = Number.isFinite(value) ? Math.max(0, Math.min(0.95, value)) : 0;
  }
  if (next?.moveSpeedBonus != null) {
    const value = Number(next.moveSpeedBonus);
    next.moveSpeedBonus = Number.isFinite(value) ? Math.max(-0.75, Math.min(1.5, value)) : 0;
  }
  if (next?.lifestealPct != null) {
    const value = Number(next.lifestealPct);
    next.lifestealPct = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  }
  if (next?.cooldownRateBonus != null) {
    const value = Number(next.cooldownRateBonus);
    next.cooldownRateBonus = Number.isFinite(value) ? Math.max(0, Math.min(1.5, value)) : 0;
  }
  if (next?.cooldownRatePenalty != null) {
    const value = Number(next.cooldownRatePenalty);
    next.cooldownRatePenalty = Number.isFinite(value) ? Math.max(0, Math.min(1.5, value)) : 0;
  }
  if (next?.knockbackDistance != null) {
    const value = Number(next.knockbackDistance);
    next.knockbackDistance = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }
  if (next?.sourceId != null) next.sourceId = String(next.sourceId || '');
  return next;
}
