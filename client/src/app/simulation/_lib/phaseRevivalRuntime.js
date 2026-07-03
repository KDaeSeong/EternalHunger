import {
  areSameTeam,
  findItemByKeywords,
  normalizeRevivedSurvivor,
  worldPhaseIndex,
} from './simulationEngine';

function phaseFromTimeOfDay(value) {
  return String(value || 'day') === 'night' ? 'night' : 'morning';
}

function getRevivePhaseConfig(reviveCfg = {}) {
  const reviveAutoCutoff = reviveCfg?.autoCutoff || {};
  const revivePaidCutoff = reviveCfg?.paidCutoff || {};
  const reviveWipeProtectionCutoff = reviveCfg?.teamWipeProtectionCutoff || { day: 2, timeOfDay: 'day' };

  return {
    paidReviveCostBase: Math.max(0, Number(reviveCfg?.paidCostBase ?? 100)),
    paidReviveCostPerUse: Math.max(0, Number(reviveCfg?.paidCostPerUse ?? 50)),
    paidReviveCutoffIdx: worldPhaseIndex(
      Number(revivePaidCutoff?.day ?? 5),
      phaseFromTimeOfDay(revivePaidCutoff?.timeOfDay ?? revivePaidCutoff?.phase ?? 'day')
    ),
    reviveCutoffIdx: worldPhaseIndex(
      Number(reviveAutoCutoff?.day ?? 2),
      phaseFromTimeOfDay(reviveAutoCutoff?.timeOfDay ?? reviveAutoCutoff?.phase ?? 'night')
    ),
    reviveHpRatio: Math.max(0.05, Math.min(1, Number(reviveCfg?.hpRatio ?? 0.65))),
    wipeProtectionCutoffIdx: worldPhaseIndex(
      Number(reviveWipeProtectionCutoff?.day ?? 2),
      phaseFromTimeOfDay(reviveWipeProtectionCutoff?.timeOfDay ?? reviveWipeProtectionCutoff?.phase ?? 'day')
    ),
  };
}

export function runPhaseRevival({
  state = {},
  actions = {},
} = {}) {
  const {
    canReviveThisMatch = false,
    dead = [],
    forbiddenIds = new Set(),
    mapObj,
    phaseIdxNow = 0,
    phaseStartSec = 0,
    publicItems = [],
    reviveCfg = {},
    ruleset,
    survivors = [],
    useDetonation = false,
  } = state;
  const {
    addLog = () => {},
    atNow = () => null,
    emitRunEvent = () => {},
    setDead = () => {},
  } = actions;
  const {
    paidReviveCostBase,
    paidReviveCostPerUse,
    paidReviveCutoffIdx,
    reviveCutoffIdx,
    reviveHpRatio,
    wipeProtectionCutoffIdx,
  } = getRevivePhaseConfig(reviveCfg);
  const revivedNow = [];

  if (Array.isArray(dead) && dead.length) {
    const safeZonePool = (Array.isArray(mapObj?.zones) ? mapObj.zones : [])
      .map((zone) => String(zone?.zoneId ?? zone?.id ?? zone?._id ?? ''))
      .filter((zoneId) => zoneId && !forbiddenIds.has(String(zoneId)));
    const remainingDead = [];

    for (const deadActor of dead) {
      const deadAt = Number(deadActor?.deadAtPhaseIdx ?? -9999);
      const teamAlive = canReviveThisMatch && (Array.isArray(survivors) ? survivors : []).some((survivor) => (
        Number(survivor?.hp || 0) > 0 && areSameTeam(survivor, deadActor)
      ));
      const teamWipeProtected = canReviveThisMatch
        && phaseIdxNow <= wipeProtectionCutoffIdx
        && deadAt >= 0
        && deadAt <= wipeProtectionCutoffIdx;
      const canAutoReviveByTeamState = teamAlive || teamWipeProtected;
      const autoEligible = canReviveThisMatch
        && canAutoReviveByTeamState
        && (deadActor?.reviveEligible === true || (deadAt >= 0 && deadAt <= reviveCutoffIdx))
        && !deadActor?.revivedOnce;
      const paidReviveCount = Math.max(0, Math.floor(Number(deadActor?.paidReviveCount || 0)));
      const paidCost = paidReviveCostBase + paidReviveCostPerUse * paidReviveCount;
      const paidEligible = canReviveThisMatch
        && !autoEligible
        && phaseIdxNow <= paidReviveCutoffIdx
        && teamAlive
        && Number(deadActor?.simCredits || 0) >= paidCost;

      if (autoEligible || paidEligible) {
        const maxHp = Number(deadActor?.maxHp ?? 100);
        const revivedHp = Math.max(1, Math.floor(maxHp * reviveHpRatio));
        const zoneId = safeZonePool.length
          ? String(safeZonePool[Math.floor(Math.random() * safeZonePool.length)])
          : String(deadActor?.zoneId || '');
        const reviveKit = findItemByKeywords(publicItems, ['붕대', 'bandage', '응급']);

        const revived = normalizeRevivedSurvivor(deadActor, revivedHp, zoneId, phaseIdxNow, ruleset, phaseStartSec, reviveKit);
        if (paidEligible) {
          revived.simCredits = Math.max(0, Number(revived.simCredits || 0) - paidCost);
          revived.paidReviveCount = paidReviveCount + 1;
        }
        if (useDetonation) {
          const startSec = Number(ruleset?.detonation?.startSec ?? 20);
          const maxSec = Number(ruleset?.detonation?.maxSec ?? 30);
          revived.detonationMaxSec = maxSec;
          revived.detonationSec = Math.min(maxSec, startSec);
        }

        revivedNow.push(revived);
        emitRunEvent('revive', { who: String(revived._id || ''), zoneId: String(zoneId || ''), hp: revivedHp, paid: paidEligible, cost: paidEligible ? paidCost : 0 }, atNow());
        addLog(`✨ [${revived.name}] ${paidEligible ? `유료 부활! (-${paidCost}Cr)` : '부활!'} (HP ${revivedHp}${reviveKit?._id ? ', 붕대 1 지급' : ''})`, 'highlight');
      } else {
        remainingDead.push(deadActor);
      }
    }

    if (revivedNow.length) setDead(remainingDead);
  }

  return {
    reviveCutoffIdx,
    revivedNow,
  };
}
