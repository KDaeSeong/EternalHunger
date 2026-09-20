// Observation only. Copy primitive values at the actual attack boundary;
// later healing, revival or UI renders must not rewrite an earlier exchange.
export function captureCombatHealth(actor) {
  return { hp: Number(actor?.hp), maxHp: Number(actor?.maxHp) };
}

export function recordCombatHealth(before, attacker, target) {
  return { version: 1,
    attacker: { id: String(attacker._id), before: before.attacker, after: captureCombatHealth(attacker) },
    target: { id: String(target._id), before: before.target, after: captureCombatHealth(target) } };
}

const validHealth = (row) => row && Number.isFinite(row.hp) && row.hp >= 0 && Number.isFinite(row.maxHp) && row.maxHp > 0;
const amount = (value) => String(Math.round(value * 10) / 10);
export function formatCombatHealthChange(before, after) {
  if (!validHealth(before) || !validHealth(after)) return '';
  return `HP ${amount(before.hp)}/${amount(before.maxHp)} → ${amount(after.hp)}/${amount(after.maxHp)}`;
}

export function presentCombatHealth(event, nameOf = String) {
  const health = event?.health;
  if (health?.version !== 1 || String(event.a) !== health.attacker?.id || String(event.b) !== health.target?.id) return null;
  const participants = [health.attacker, health.target].map((row) => ({ id: row.id, name: nameOf(row.id),
    text: formatCombatHealthChange(row.before, row.after),
    ratio: validHealth(row.after) ? Math.max(0, Math.min(1, row.after.hp / row.after.maxHp)) : 0 }));
  if (participants.some((row) => !row.text)) return null;
  return { participants, text: participants.map((row) => `${row.name} ${row.text}`).join(' · ') };
}
