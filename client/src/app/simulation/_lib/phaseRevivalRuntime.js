import {
  areSameTeam,
  getActorTeamName,
  hasKioskAtZone,
  normalizeRevivedSurvivor,
  worldPhaseIndex,
} from './simulationEngine';

function phaseFromTimeOfDay(value) {
  return String(value || 'day') === 'night' ? 'night' : 'morning';
}

function getRevivePhaseConfig(reviveCfg = {}) {
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

function actorLevel(actor) {
  const raw = Number(actor?.level ?? actor?.erLevel ?? actor?.weaponMasteryLevel ?? 1);
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.min(20, Math.floor(raw)));
}

function actorId(actor) {
  return String(actor?._id || actor?.id || actor?.charId || actor?.name || '').trim();
}

function getDeathAtSec(actor) {
  const deathAt = Number(actor?._deathAt ?? actor?.deathAtSec ?? actor?.corpseStartedAtSec);
  return Number.isFinite(deathAt) && deathAt >= 0 ? deathAt : null;
}

function getCorpseRemainingSec(deadActor, nowSec, cfg) {
  const deathAt = getDeathAtSec(deadActor);
  const windowSec = Math.max(1, Number(cfg?.corpseWindowSec ?? 30));
  const stored = Number(deadActor?.corpseRemainingSec);
  const byClock = deathAt == null ? windowSec : Math.max(0, deathAt + windowSec - Number(nowSec || 0));
  if (Number.isFinite(stored) && stored >= 0) return Math.min(stored, byClock);
  return byClock;
}

function estimateCorpseDamagePressure(deadActor, enemies, cfg) {
  const zoneId = String(deadActor?.zoneId || '');
  if (!zoneId) return { damage: 0, secLoss: 0, attackers: [] };
  const attackers = (Array.isArray(enemies) ? enemies : [])
    .filter((actor) => actor && Number(actor?.hp || 0) > 0 && String(actor?.zoneId || '') === zoneId && !areSameTeam(actor, deadActor));
  if (!attackers.length) return { damage: 0, secLoss: 0, attackers: [] };

  const damage = attackers.reduce((sum, actor) => {
    const atk = Number(actor?.attackPower ?? actor?.atk ?? actor?.stats?.attackPower ?? 20);
    const amp = Number(actor?.skillAmp ?? actor?.stats?.skillAmp ?? 0);
    return sum + Math.max(8, atk + amp * 0.25);
  }, 0);
  const secLoss = Math.max(1, Math.floor(damage / Math.max(1, Number(cfg?.corpseDamageDivisor ?? 12))));
  return { damage, secLoss, attackers };
}

function chooseSameZoneReviver(deadActor, survivors) {
  const zoneId = String(deadActor?.zoneId || '');
  if (!zoneId) return null;
  return (Array.isArray(survivors) ? survivors : [])
    .filter((actor) => actor && Number(actor?.hp || 0) > 0 && String(actor?.zoneId || '') === zoneId && areSameTeam(actor, deadActor))
    .sort((a, b) => Number(b?.hp || 0) - Number(a?.hp || 0))[0] || null;
}

function findKioskReviver(deadActor, survivors, kiosks, mapObj) {
  return (Array.isArray(survivors) ? survivors : [])
    .filter((actor) => actor && Number(actor?.hp || 0) > 0 && areSameTeam(actor, deadActor))
    .filter((actor) => hasKioskAtZone(kiosks, mapObj, actor?.zoneId))
    .sort((a, b) => Number(b?.simCredits || 0) - Number(a?.simCredits || 0))[0] || null;
}

function getTeamCreditPool(deadActor, teammates) {
  return Math.max(0, Number(deadActor?.simCredits || 0))
    + (Array.isArray(teammates) ? teammates : [])
      .reduce((sum, actor) => sum + Math.max(0, Number(actor?.simCredits || 0)), 0);
}

function deductTeamReviveCost(deadActor, teammates, cost) {
  let remaining = Math.max(0, Number(cost || 0));
  const payments = [];
  const takeFrom = (actor, label) => {
    if (!actor || remaining <= 0) return;
    const have = Math.max(0, Number(actor?.simCredits || 0));
    if (have <= 0) return;
    const take = Math.min(have, remaining);
    actor.simCredits = have - take;
    remaining -= take;
    payments.push({ actor, label, amount: take });
  };

  takeFrom(deadActor, 'self');
  const sortedTeammates = [...(Array.isArray(teammates) ? teammates : [])]
    .filter((actor) => actor && Number(actor?.hp || 0) > 0)
    .sort((a, b) => Number(b?.simCredits || 0) - Number(a?.simCredits || 0));
  for (const teammate of sortedTeammates) takeFrom(teammate, 'teammate');
  return { paid: Math.max(0, Number(cost || 0)) - remaining, remaining, payments };
}

export function runPhaseRevival({
  state = {},
  actions = {},
} = {}) {
  const {
    canReviveThisMatch = false,
    dead = [],
    forbiddenIds = new Set(),
    kiosks = [],
    mapObj,
    phaseIdxNow = 0,
    phaseStartSec = 0,
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
    autoReviveIdx,
    paidReviveCostBase,
    paidReviveCostPerUse,
    paidReviveCutoffIdx,
    paidReviveStartIdx,
    reviveCutoffIdx,
    reviveHpRatio,
    wipeProtectionCutoffIdx,
    ...corpseCfg
  } = getRevivePhaseConfig(reviveCfg);
  const revivedNow = [];

  if (Array.isArray(dead) && dead.length) {
    const safeZonePool = (Array.isArray(mapObj?.zones) ? mapObj.zones : [])
      .map((zone) => String(zone?.zoneId ?? zone?.id ?? zone?._id ?? ''))
      .filter((zoneId) => zoneId && !forbiddenIds.has(String(zoneId)));
    const remainingDead = [];

    for (const deadActor of dead) {
      const deadAt = Number(deadActor?.deadAtPhaseIdx ?? -9999);
      const teammates = (Array.isArray(survivors) ? survivors : []).filter((survivor) => (
        survivor && Number(survivor?.hp || 0) > 0 && areSameTeam(survivor, deadActor)
      ));
      const teamAlive = canReviveThisMatch && teammates.length > 0;
      const wipeProtectionActive = canReviveThisMatch && phaseIdxNow <= wipeProtectionCutoffIdx;
      const teamWipeProtected = canReviveThisMatch
        && wipeProtectionActive
        && deadAt >= 0
        && deadAt <= wipeProtectionCutoffIdx
        && !deadActor?.revivedOnce;
      let corpseRemainingSec = getCorpseRemainingSec(deadActor, phaseStartSec, corpseCfg);
      const corpsePressure = estimateCorpseDamagePressure(deadActor, survivors, corpseCfg);
      if (corpseRemainingSec > 0 && corpsePressure.secLoss > 0) {
        corpseRemainingSec = Math.max(0, corpseRemainingSec - corpsePressure.secLoss);
        deadActor.corpseRemainingSec = corpseRemainingSec;
        if (corpseRemainingSec <= 0) {
          addLog(`🪦 [${deadActor.name}] 시체가 추가 공격을 받아 소멸했습니다.`, 'death');
        }
      }

      const sameZoneReviver = canReviveThisMatch
        && wipeProtectionActive
        && corpseRemainingSec >= corpseCfg.corpseInteractSec
        ? chooseSameZoneReviver(deadActor, survivors)
        : null;
      const canAutoReviveByTeamState = teamWipeProtected || (teamAlive && phaseIdxNow === autoReviveIdx);
      const autoEligible = canReviveThisMatch
        && !sameZoneReviver
        && canAutoReviveByTeamState
        && deadAt >= 0
        && deadAt <= autoReviveIdx
        && !deadActor?.revivedOnce
        && (teamWipeProtected || phaseIdxNow === autoReviveIdx);
      const paidReviveCount = Math.max(0, Math.floor(Number(deadActor?.paidReviveCount || 0)));
      const paidCost = paidReviveCostBase + paidReviveCostPerUse * paidReviveCount;
      const kioskReviver = findKioskReviver(deadActor, survivors, kiosks, mapObj);
      const teamCreditPool = getTeamCreditPool(deadActor, teammates);
      const paidEligible = canReviveThisMatch
        && !sameZoneReviver
        && !autoEligible
        && phaseIdxNow >= paidReviveStartIdx
        && phaseIdxNow <= paidReviveCutoffIdx
        && deadAt >= 0
        && deadAt <= paidReviveCutoffIdx
        && !deadActor?.revivedOnce
        && teamAlive
        && kioskReviver
        && teamCreditPool >= paidCost;

      if (sameZoneReviver || autoEligible || paidEligible) {
        const maxHp = Number(deadActor?.maxHp ?? 100);
        const revivedHp = Math.max(1, Math.floor(maxHp * reviveHpRatio));
        const zoneId = safeZonePool.length
          ? String(safeZonePool[Math.floor(Math.random() * safeZonePool.length)])
          : String(deadActor?.zoneId || '');
        const reviveKit = null;

        const revived = normalizeRevivedSurvivor(deadActor, revivedHp, zoneId, phaseIdxNow, ruleset, phaseStartSec, reviveKit);
        let reviveMethod = 'auto';
        let paidInfo = null;
        if (sameZoneReviver) {
          reviveMethod = 'corpse_interaction';
          revived.zoneId = String(deadActor?.zoneId || sameZoneReviver?.zoneId || revived.zoneId || '');
        }
        if (paidEligible) {
          reviveMethod = 'kiosk_paid';
          paidInfo = deductTeamReviveCost(deadActor, teammates, paidCost);
          revived.simCredits = Math.max(0, Number(deadActor?.simCredits || 0));
          revived.paidReviveCount = paidReviveCount + 1;
          revived.zoneId = String(kioskReviver?.zoneId || revived.zoneId || '');
        }
        if (useDetonation) {
          const startSec = Number(ruleset?.detonation?.startSec ?? 20);
          const maxSec = Number(ruleset?.detonation?.maxSec ?? 30);
          revived.detonationMaxSec = maxSec;
          revived.detonationSec = Math.min(maxSec, startSec);
        }

        revivedNow.push(revived);
        emitRunEvent('revive', {
          who: String(revived._id || ''),
          zoneId: String(revived?.zoneId || zoneId || ''),
          hp: revivedHp,
          paid: paidEligible,
          cost: paidEligible ? paidCost : 0,
          method: reviveMethod,
          by: sameZoneReviver ? actorId(sameZoneReviver) : kioskReviver ? actorId(kioskReviver) : '',
        }, atNow());
        if (sameZoneReviver) {
          addLog(`✨ [${sameZoneReviver.name}] 5초 상호작용으로 [${revived.name}] 부활! (HP ${revivedHp})`, 'highlight');
        } else if (paidEligible) {
          const payerText = paidInfo?.payments?.some((p) => p.label === 'teammate')
            ? ', 팀원 크레딧 포함'
            : '';
          addLog(`🏪 [${kioskReviver.name}] 키오스크 부활: [${revived.name}] (-${paidCost}Cr${payerText}, HP ${revivedHp})`, 'highlight');
        } else {
          const teamName = getActorTeamName(deadActor);
          const delayText = teamWipeProtected ? '전멸 방지' : `Lv.${actorLevel(deadActor)} 지연`;
          addLog(`✨ [${revived.name}] 자동 부활! (${teamName} · ${delayText}, HP ${revivedHp})`, 'highlight');
        }
      } else {
        remainingDead.push(deadActor);
      }
    }

    if (revivedNow.length) setDead(remainingDead);
  }

  return {
    reviveCutoffIdx,
    wipeProtectionCutoffIdx,
    revivedNow,
  };
}
