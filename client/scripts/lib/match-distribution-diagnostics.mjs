const TEAM_RETREAT_MOVE_REASONS = new Set(['flee:team_outnumbered', 'flee:team_power_gap']);

function eventSecond(event) {
  return Number(event?.at?.sec ?? event?.sec ?? 0);
}

function decisionReason(moveReason) {
  return String(moveReason || '').replace(/^flee:/, '');
}

export function summarizeTeamRetreats(events = []) {
  // This metric is deliberately limited to explicit team-power flee movement.
  // Generic avoid_power movement remains part of the separate movement summary.
  const rows = events.filter((event) => event?.kind === 'move' && event?.who && event?.from && event?.to
    && TEAM_RETREAT_MOVE_REASONS.has(String(event?.reason || '')));
  const byReason = {};
  const byActor = {};
  for (const event of rows) {
    const reason = decisionReason(event.reason) || 'unknown';
    const actorId = String(event.who || 'unknown');
    byReason[reason] = (byReason[reason] || 0) + 1;
    byActor[actorId] = (byActor[actorId] || 0) + 1;
  }

  const lastMoveByActor = new Map();
  const reversalSamples = [];
  let reversals = 0;
  for (const event of events) {
    if (event?.kind !== 'move' || !event?.who || !event?.from || !event?.to) continue;
    const actorId = String(event.who);
    const previous = lastMoveByActor.get(actorId);
    const reason = String(event.reason || '');
    if (TEAM_RETREAT_MOVE_REASONS.has(reason) && previous
      && TEAM_RETREAT_MOVE_REASONS.has(String(previous.reason || ''))
      && String(previous.from || '') === String(event.to || '')
      && String(previous.to || '') === String(event.from || '')) {
      reversals += 1;
      if (reversalSamples.length < 8) reversalSamples.push({
        actorId,
        previousAtSec: eventSecond(previous),
        atSec: eventSecond(event),
        from: String(event.from || ''),
        to: String(event.to || ''),
        previousReason: decisionReason(previous.reason),
        reason: decisionReason(reason),
      });
    }
    lastMoveByActor.set(actorId, event);
  }

  const topActors = Object.entries(byActor).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  return {
    total: rows.length,
    uniqueActors: Object.keys(byActor).length,
    maxPerActor: topActors.length ? topActors[0][1] : 0,
    reversals,
    reversalSamples,
    byReason,
    topActors,
  };
}
