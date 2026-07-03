import { updateEffects } from '../../../utils/statusLogic';
import {
  normalizeRuntimeEffect,
  normalizeRuntimeSurvivor,
  shouldLogRuntimeEffectExpiry,
  shouldLogRuntimeEffectTick,
} from './simulationEngine';

export function applyActorPhaseStatusTick({
  actions = {},
  state = {},
} = {}) {
  const {
    actor,
    canReviveThisMatch,
    elapsedSec,
    phaseIdxNow,
    reviveCutoffIdx,
  } = state;
  const {
    addLog = () => {},
    emitDeathRunEventOnce = () => {},
    setDeathMetadata = () => {},
  } = actions;

  const beforeHp = Number(actor?.hp || 0);
  const beforeEffects = Array.isArray(actor?.activeEffects)
    ? actor.activeEffects.map((effect) => normalizeRuntimeEffect(effect)).filter(Boolean)
    : [];
  const statusTick = updateEffects({ ...actor, activeEffects: beforeEffects }, { returnMeta: true, elapsedSec });
  const updated = normalizeRuntimeSurvivor(statusTick?.character || actor);

  (Array.isArray(statusTick?.ticks) ? statusTick.ticks : []).forEach((tick) => {
    if (!shouldLogRuntimeEffectTick(tick)) return;
    const amount = Math.max(0, Number(tick?.amount || 0));
    if (amount <= 0) return;
    const name = String(tick?.name || '효과');
    const secText = Number(tick?.seconds || 0) > 1 ? ` (${Math.max(1, Math.floor(Number(tick.seconds)))}초)` : '';
    if (tick?.type === 'damage') addLog(`⏱️ [${updated.name}] ${name}: HP -${amount}${secText}`, 'highlight');
    else if (tick?.type === 'heal') addLog(`✨ [${updated.name}] ${name}: HP +${amount}${secText}`, 'system');
  });

  (Array.isArray(statusTick?.expired) ? statusTick.expired : []).forEach((effect) => {
    if (!shouldLogRuntimeEffectExpiry(effect)) return;
    const name = String(effect?.name || '효과');
    addLog(`⌛ [${updated.name}] ${name} 종료`, 'system');
  });

  const afterHp = Number(updated.hp || 0);
  if (beforeHp > 0 && afterHp <= 0) {
    updated.hp = 0;
    const visibleDamageTick = (Array.isArray(statusTick?.ticks) ? statusTick.ticks : [])
      .find((tick) => Number(tick?.amount || 0) > 0 && shouldLogRuntimeEffectTick(tick));
    const cause = visibleDamageTick
      ? String(visibleDamageTick?.name || '상태 이상')
      : '지속 피해';
    setDeathMetadata(updated, 'status_effect', { causeName: cause });
    updated.deadAtPhaseIdx = phaseIdxNow;
    updated.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
    emitDeathRunEventOnce(updated, { reason: 'status_effect', cause });
    addLog(`💀 [${updated.name}] ${cause}로 사망했습니다.`, 'death');
    return {
      actor: updated,
      died: true,
    };
  }

  return {
    actor: updated,
    died: false,
  };
}
