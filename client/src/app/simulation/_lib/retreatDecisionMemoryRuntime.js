export function getRetreatAvoidZoneId(actor) {
  const decisions = Math.max(0, Math.floor(Number(actor?._retreatAvoidDecisions || 0)));
  const zoneId = String(actor?._retreatAvoidZoneId || '');
  return decisions > 0 && zoneId ? zoneId : '';
}

export function consumeRetreatAvoidDecision(actor) {
  if (!actor || typeof actor !== 'object') return '';
  const zoneId = getRetreatAvoidZoneId(actor);
  const remaining = Math.max(0, Math.floor(Number(actor._retreatAvoidDecisions || 0)) - 1);
  actor._retreatAvoidDecisions = remaining;
  if (!remaining) actor._retreatAvoidZoneId = '';
  return zoneId;
}

export function rememberRetreatOrigin(actor, zoneId) {
  if (!actor || typeof actor !== 'object') return actor;
  const origin = String(zoneId || '');
  actor._retreatAvoidZoneId = origin;
  actor._retreatAvoidDecisions = origin ? 1 : 0;
  return actor;
}

export function clearRetreatAvoidMemory(actor) {
  if (!actor || typeof actor !== 'object') return actor;
  actor._retreatAvoidZoneId = '';
  actor._retreatAvoidDecisions = 0;
  return actor;
}
