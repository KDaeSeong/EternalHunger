import { BOARD, BENCH_SIZE } from './autochessData.js';
import { moveUnit } from './autochessEngine.js';
import { getPlayer } from './autochessMarket.js';

export const DRAG_THRESHOLD = 6;

export function samePosition(a, b) {
  return Boolean(a && b && a.kind === b.kind &&
    (a.kind === 'field' ? a.x === b.x && a.y === b.y : a.slot === b.slot));
}

export function validDropPosition(position) {
  return Boolean(position && (position.kind === 'field'
    ? Number.isInteger(position.x) && position.x >= 0 && position.x < BOARD.cols &&
      Number.isInteger(position.y) && position.y >= 0 && position.y < 4
    : position.kind === 'bench' && Number.isInteger(position.slot) &&
      position.slot >= 0 && position.slot < BENCH_SIZE));
}

export function parseDropTarget(key) {
  if (typeof key !== 'string') return null;
  const field = /^field:(\d+):(\d+)$/.exec(key);
  const bench = /^bench:(\d+)$/.exec(key);
  const target = field ? { kind: 'field', x: Number(field[1]), y: Number(field[2]) }
    : bench ? { kind: 'bench', slot: Number(bench[1]) } : null;
  return validDropPosition(target) ? target : null;
}

export function crossedDragThreshold(start, point) {
  return [start?.x, start?.y, point?.x, point?.y].every(Number.isFinite) &&
    Math.hypot(point.x - start.x, point.y - start.y) >= DRAG_THRESHOLD;
}

export function edgeScrollDelta(y, height) {
  if (!Number.isFinite(y) || !Number.isFinite(height) || height <= 0) return 0;
  const edge = Math.min(64, height / 4);
  if (y < edge) return -Math.ceil(14 * Math.min(1, (edge - y) / edge));
  if (y > height - edge) return Math.ceil(14 * Math.min(1, (y - height + edge) / edge));
  return 0;
}

// Apply through the existing game rules, rejecting a gesture from an older context.
export function moveDraggedUnit(state, drag, target, owner) {
  if (!drag || !owner || drag.owner !== owner || state.runId !== drag.runId ||
    state.round !== drag.round || state.phase !== 'planning' || !validDropPosition(target)) return state;
  const unit = getPlayer(state).units.find(candidate => candidate.uid === drag.uid);
  if (!unit || !samePosition(unit.position, drag.sourcePosition) || samePosition(unit.position, target)) return state;
  return moveUnit(state, drag.uid, target);
}
