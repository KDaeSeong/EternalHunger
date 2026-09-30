const roundHp = (value) => Math.round(Number(value) * 1e6) / 1e6;

// Callers apply the source's healing modifier first. Return only HP actually
// restored, so overhealing cannot appear as a successful recovery in a log.
export function restoreRuntimeHp(actor, amount, maxHp = Number(actor?.maxHp || 100)) {
  const hp = Number(actor?.hp), requested = Number(amount);
  if (!actor || !Number.isFinite(hp) || !Number.isFinite(maxHp) || !Number.isFinite(requested)
    || hp <= 0 || maxHp <= hp || requested <= 0) return 0;
  actor.hp = Math.min(maxHp, roundHp(hp + requested));
  return roundHp(actor.hp - hp);
}

export function describeHpRecovery(actor, amount) {
  return `HP +${roundHp(amount)} (${roundHp(actor.hp - amount)}→${roundHp(actor.hp)}/${roundHp(actor.maxHp)})`;
}
