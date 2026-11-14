import { PADS, STUDENTS } from './infiniteDefenseData.js';
import { assignStudent, swapDefenders, replaceDefender } from './infiniteDefenseEngine.js';

export const DRAG_THRESHOLD = 6;
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
export function parseDefenseDropTarget(key) {
  return typeof key === 'string' && PADS.some(pad => pad.id === key) ? key : null;
}
export function sameAssignment(a, b) {
  return Boolean(a && b && a.mode === b.mode && a.padId === b.padId && a.paid === b.paid);
}
export function defenseDropStatus(state, studentId, padId) {
  const student = STUDENTS.find(candidate => candidate.id === studentId);
  const row = state.assignments[studentId];
  const reject = (kind, text) => ({ allowed: false, kind, text });
  if (!student || !row || !parseDefenseDropTarget(padId)) return reject('outside', '거점에 놓기 · 방어 캐릭터 교환·대기 캐릭터 교체 · Esc 취소');
  if (state.phase === 'defeat') return reject('ended', '종료된 작전에서는 배치할 수 없습니다.');
  if (row.mode === 'defend' && row.padId === padId) return reject('same', '현재 거점 · 위치 유지');
  const occupant = STUDENTS.find(candidate => candidate.id !== studentId &&
    state.assignments[candidate.id].mode === 'defend' && state.assignments[candidate.id].padId === padId);
  if (occupant) {
    if (row.mode === 'defend' && parseDefenseDropTarget(row.padId))
      return { allowed: true, kind: 'swap', cost: 0, targetId: occupant.id,
        text: padId.slice(1) + '번 거점 · ' + occupant.name + '와 위치 교환 · 무료' };
    if (row.mode === 'reserve') {
      const cost = row.paid ? 0 : student.cost;
      if (state.coins < cost) return reject('funds', '크레딧 부족 · ' + cost + ' 필요');
      return { allowed: true, kind: 'replace', cost, targetId: occupant.id,
        text: padId.slice(1) + '번 거점 교체 · ' + occupant.name + ' 대기 전환 · ' + (cost ? cost + ' 크레딧' : '무료') };
    }
    return reject('occupied', occupant.name + ' 배치 중 · 채굴 캐릭터는 먼저 대기로 전환');
  }
  const cost = row.paid ? 0 : student.cost;
  if (state.coins < cost) return reject('funds', '크레딧 부족 · ' + cost + ' 필요');
  return { allowed: true, kind: 'valid', cost,
    text: padId.slice(1) + '번 거점 ' + (row.mode === 'defend' ? '이동' : '배치') + ' · ' + (cost ? cost + ' 크레딧' : '무료') };
}

// A gesture must still belong to the same owner, operation, and assignment when released.
export function moveDraggedDefender(state, drag, padId, owner) {
  if (!drag || !owner || drag.owner !== owner || state.runId !== drag.runId ||
      state.wave !== drag.wave || state.phase !== drag.phase ||
      !sameAssignment(state.assignments[drag.studentId], drag.sourceAssignment)) return state;
  const drop = defenseDropStatus(state, drag.studentId, padId);
  if (!drop.allowed) return state;
  if (drop.kind === 'swap') return swapDefenders(state, drag.studentId, drop.targetId);
  if (drop.kind === 'replace') return replaceDefender(state, drag.studentId, drop.targetId);
  return assignStudent(state, drag.studentId, 'defend', padId);
}
