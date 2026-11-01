import { HUNGER_LABELS } from './hungerGameContract.js';

function pairKey(leftId, rightId) {
  return JSON.stringify(leftId < rightId ? [leftId, rightId] : [rightId, leftId]);
}

function transitionLabel(previousKind, kind) {
  if (previousKind === kind) return kind === 'ally' ? '동맹 유지' : '적대 유지';
  if (!previousKind) return kind === 'ally' ? '새 동맹' : '새 적대';
  return `${HUNGER_LABELS[previousKind]} → ${HUNGER_LABELS[kind]}`;
}

// Derive presentation from observed receipts only; prose and future phases are
// never used to infer a motive, relationship or participant outcome.
export function getHungerRelationshipView(history, viewIndex = -1) {
  const last = viewIndex < 0 ? history.length - 1 : Math.min(viewIndex, history.length - 1);
  const pairs = new Map();
  const effectsByRow = new Map();
  for (let historyIndex = 0; historyIndex <= last; historyIndex += 1) {
    const phase = history[historyIndex];
    for (const row of phase.rows) {
      row.effects.forEach((effect, effectIndex) => {
        if (!['ally', 'enemy'].includes(effect.type) || typeof effect.actorId !== 'string'
          || typeof effect.otherId !== 'string' || effect.actorId === effect.otherId) return;
        const key = pairKey(effect.actorId, effect.otherId);
        const prior = pairs.get(key);
        const change = { actorId: effect.actorId, otherId: effect.otherId,
          previousKind: prior?.kind || '', kind: effect.type,
          changed: prior?.kind !== effect.type, label: transitionLabel(prior?.kind, effect.type),
          historyIndex, day: phase.day, phase: phase.phase, eventId: row.eventId,
          rowId: row.id, title: row.title, outcome: row.outcome };
        if (!effectsByRow.has(row)) effectsByRow.set(row, new Map());
        effectsByRow.get(row).set(effectIndex, change);
        pairs.delete(key);
        pairs.set(key, { key, leftId: effect.actorId, rightId: effect.otherId, kind: effect.type,
          lastChange: change.changed ? change : prior.lastChange });
      });
    }
  }
  return { effectsByRow, relationships: [...pairs.values()] };
}
