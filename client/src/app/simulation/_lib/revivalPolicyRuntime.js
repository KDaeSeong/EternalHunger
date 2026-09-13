import { worldPhaseIndex } from './worldTime.js';

function phaseFromTimeOfDay(value) {
  return String(value || 'day') === 'night' ? 'night' : 'morning';
}

// Shared with actual phase revival; do not maintain separate reward cutoffs.
export function getRevivePhaseConfig(reviveCfg = {}) {
  const reviveAutoCutoff = reviveCfg?.autoCutoff || {};
  const revivePaidStart = reviveCfg?.paidStart || {};
  const revivePaidCutoff = reviveCfg?.paidCutoff || {};
  const reviveWipeProtectionCutoff = reviveCfg?.teamWipeProtectionCutoff || { day: 2, timeOfDay: 'day' };
  const paidReviveCutoffIdx = worldPhaseIndex(
    Number(revivePaidCutoff?.day ?? 5),
    phaseFromTimeOfDay(revivePaidCutoff?.timeOfDay ?? revivePaidCutoff?.phase ?? 'day')
  );
  return {
    corpseWindowSec: Math.max(1, Number(reviveCfg?.corpseWindowSec ?? 30)),
    corpseInteractSec: Math.max(1, Number(reviveCfg?.corpseInteractSec ?? 5)),
    corpseDamageDivisor: Math.max(1, Number(reviveCfg?.corpseDamageDivisor ?? 12)),
    autoDelaySecPerLevel: Math.max(0, Number(reviveCfg?.autoDelaySecPerLevel ?? 5)),
    paidReviveCostBase: Math.max(0, Number(reviveCfg?.paidCostBase ?? 200)),
    paidReviveCostPerUse: Math.max(0, Number(reviveCfg?.paidCostPerUse ?? 0)),
    paidReviveStartIdx: worldPhaseIndex(
      Number(revivePaidStart?.day ?? 3),
      phaseFromTimeOfDay(revivePaidStart?.timeOfDay ?? revivePaidStart?.phase ?? 'day')
    ),
    paidReviveCutoffIdx,
    autoReviveIdx: worldPhaseIndex(
      Number(reviveAutoCutoff?.day ?? 2),
      phaseFromTimeOfDay(reviveAutoCutoff?.timeOfDay ?? reviveAutoCutoff?.phase ?? 'night')
    ),
    reviveCutoffIdx: paidReviveCutoffIdx,
    reviveHpRatio: Math.max(0.05, Math.min(1, Number(reviveCfg?.hpRatio ?? 0.65))),
    wipeProtectionCutoffIdx: worldPhaseIndex(
      Number(reviveWipeProtectionCutoff?.day ?? 2),
      phaseFromTimeOfDay(reviveWipeProtectionCutoff?.timeOfDay ?? reviveWipeProtectionCutoff?.phase ?? 'day')
    ),
  };
}

export function getDeathAtSec(actor) {
  const deathAt = Number(actor?._deathAt ?? actor?.deathAtSec ?? actor?.corpseStartedAtSec);
  return Number.isFinite(deathAt) && deathAt >= 0 ? deathAt : null;
}

export function getCorpseRemainingSec(deadActor, nowSec, cfg) {
  const deathAt = getDeathAtSec(deadActor);
  const windowSec = Math.max(1, Number(cfg?.corpseWindowSec ?? 30));
  const stored = Number(deadActor?.corpseRemainingSec);
  const byClock = deathAt == null ? windowSec : Math.max(0, deathAt + windowSec - Number(nowSec || 0));
  if (Number.isFinite(stored) && stored >= 0) return Math.min(stored, byClock);
  return byClock;
}
