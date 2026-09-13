import { getForcedControlMotion, forcedControlKey } from './combatSpatialRuntime.js';

// Only transitions are logged; tracking a moving source does not flood the
// event journal or consume RNG. Stored state is plain JSON for phase/replay use.
export function reconcileForcedControls(roster, nowSec, actions = {}) {
  for (const actor of roster) {
    const plan = Number(actor.hp || 0) > 0 ? getForcedControlMotion(actor, roster) : null;
    const previous = actor._forcedControlState;
    if (!plan) {
      if (previous) {
        actions.emitRunEvent?.('forced_control_end', { who: String(actor._id || actor.id),
          effect: previous.effect, sourceActorId: previous.sourceActorId, zoneId: String(actor.zoneId || '') }, actions.atNow?.() || { sec: nowSec });
        actor._forcedControlState = null;
      }
      continue;
    }
    const { control, sourcePosition } = plan;
    const next = { key: forcedControlKey(control), effect: control.name, mode: control.mode,
      sourceActorId: String(control.sourceActorId || ''), sourcePosition: sourcePosition ? { ...sourcePosition } : null };
    actor._forcedControlState = next;
    if (previous?.key === next.key) continue;
    const targetName = plan.source?.name || next.sourceActorId || '시전자 미확인';
    const reason = { fear: '시전자 반대 방향으로 보행', charm: '시전자 방향으로 보행', taunt: '시전자에게 접근하여 기본 공격' }[control.mode];
    actions.emitRunEvent?.('forced_control', { who: String(actor._id || actor.id), targetId: next.sourceActorId,
      effect: control.name, mode: control.mode, sourceActorId: next.sourceActorId, sourcePosition: next.sourcePosition,
      remainingDuration: control.remainingDuration, zoneId: String(actor.zoneId || ''),
      reason: sourcePosition ? reason : '시전자 위치 미확인으로 대기' }, actions.atNow?.() || { sec: nowSec });
    actions.addLog?.(`[${actor.name}] ${control.name}: ${sourcePosition ? reason : '시전자 위치 미확인으로 대기'} (${targetName})`, 'combat-detail');
  }
}
