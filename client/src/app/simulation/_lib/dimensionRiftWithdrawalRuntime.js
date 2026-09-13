import { canMoveByStatus } from '../../../utils/statusLogic.js';
import { getActorDimensionRiftId, leaveDimensionRiftSpace } from './dimensionRiftSpaceRuntime.js';

// Project policy: voluntary retreat forfeits this admission and returns to its
// entrance. It is not a world-graph move, blink, heal, revive, or safe-zone grant.
export function withdrawFromDimensionRift(actor, nowSec, { reason = 'retreat', opponentId = '', actions = {} } = {}) {
  const riftId = getActorDimensionRiftId(actor);
  if (!riftId || !Number.isFinite(Number(actor?.hp)) || Number(actor.hp) <= 0 || !canMoveByStatus(actor)) return null;
  const change = leaveDimensionRiftSpace(actor, { id: riftId }, nowSec, 'withdrawn');
  if (!change) return null;
  actor.aiCurrentAction = 'dimension_rift_withdraw';
  actor._lastDimensionRiftExit = { ...actor._lastDimensionRiftExit, cause: reason, opponentId: String(opponentId) };
  const event = { ...change, zoneId: String(actor.zoneId || ''), cause: reason, opponentId: String(opponentId) };
  actions.addLog?.(`🌀 [${actor.name}] 차원의 틈 참가 포기 → 입구 복귀 (체력·가방·쿨다운 유지)`, 'system');
  actions.emitRunEvent?.('dimension_rift_space', event, actions.atNow?.());
  return event;
}
