import { canonicalizeCharName } from './combatRuntime';
import { resolveCombatWinnerOutcome } from './phaseCombatDamageRuntime';
import { createPhaseCombatEliminationRuntime } from './phaseCombatEliminationRuntime';
import { createPhaseCombatFleeRuntime } from './phaseCombatFleeRuntime';
import { createPhaseCombatSkillSplashRuntime } from './phaseCombatSkillSplashRuntime';
import { createPhaseCombatTacticalRuntime } from './phaseCombatTacticalRuntime';

export function runPhaseCombatEncounter({
  actions = {},
  state = {},
} = {}) {
  let {
    actor = null,
    target = null,
    assistWindowPhases = 0,
    battleSettings = {},
    canReviveThisMatch = false,
    craftables,
    currentActionSec = () => 0,
    estimatePower = () => 0,
    forbiddenIds = new Set(),
    isDay1MorningFarmPhase = false,
    isSoloMatch = false,
    itemMetaById,
    itemNameById,
    midgameCombatWindow = false,
    newDeadIds = [],
    nextDay = 1,
    phaseIdxNow = 0,
    phaseSurvivors = [],
    pickUnbiasedBattle = () => ({ winner: null, log: '' }),
    publicItems = [],
    restrictedRatio = 0,
    reviveCutoffIdx = 0,
    roundAssists = {},
    roundKills = {},
    ruleset = {},
    shouldAvoidCombatByPower = () => null,
    survivorMap = new Map(),
    todaysSurvivors = [],
    totalZonesCount = 0,
    useDetonation = false,
    zoneGraph = {},
  } = state;
  const {
    addEarnedCredits = () => {},
    addLog = () => {},
    appendPhaseDeadSnapshots = (victim) => victim,
    applyErTraitAfterBattle = () => null,
    applyErWeaponSkillAfterCombat = () => null,
    atNow = () => null,
    emitDeathRunEventOnce = () => {},
    emitEffectRunEvents = () => {},
    emitRunEvent = () => {},
    flushDeadSnapshots = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
    grantPvpDamageMastery = () => {},
    grantPvpKillMastery = () => {},
    reserveActionSecond = () => {},
    setDeathMetadata = () => {},
    tryUseConsumable = () => {},
  } = actions;

  if (!actor || !target) return { actor, target, skipRemainingTurn: false };

  const absNow = currentActionSec();
  const tacticalRuntime = createPhaseCombatTacticalRuntime({
    state: {
      absNow,
      battleSettings,
      ruleset,
    },
    actions: {
      addLog,
      atNow,
      emitEffectRunEvents,
      emitRunEvent,
    },
  });
  const {
    applyCombatTacAttack,
    applyTacUse,
    canUseTac,
    normalizeTac,
    shieldBlock,
    tacModuleLevel,
  } = tacticalRuntime;
  const combatFleeRuntime = createPhaseCombatFleeRuntime({
    state: {
      battleSettings,
      currentActionSec,
      estimatePower,
      forbiddenIds,
      newDeadIds,
      restrictedRatio,
      ruleset,
      survivorMap,
      totalZonesCount,
      zoneGraph,
    },
    actions: {
      addLog,
      atNow,
      emitEffectRunEvents,
      emitRunEvent,
      getZoneName,
    },
    tactical: {
      applyTacUse,
      canUseTac,
      normalizeTac,
      tacModuleLevel,
    },
  });
  const {
    pickSparseSafeNeighbor,
    resolveFleeSequence,
  } = combatFleeRuntime;
  const pvpCfg = ruleset?.pvp || {};
  const combatEliminationRuntime = createPhaseCombatEliminationRuntime({
    state: {
      assistWindowPhases,
      canReviveThisMatch,
      craftables,
      currentActionSec,
      itemMetaById,
      itemNameById,
      isSoloMatch,
      newDeadIds,
      nextDay,
      phaseIdxNow,
      phaseSurvivors,
      publicItems,
      pvpCfg,
      reviveCutoffIdx,
      roundAssists,
      roundKills,
      ruleset,
      sourceActor: actor,
      survivorMap,
      todaysSurvivors,
      useDetonation,
    },
    actions: {
      addEarnedCredits,
      addLog,
      appendPhaseDeadSnapshots,
      applyErTraitAfterBattle,
      atNow,
      emitDeathRunEventOnce,
      emitRunEvent,
      flushDeadSnapshots,
      getZoneName,
      grantPvpKillMastery,
      pickSparseSafeNeighbor,
      setDeathMetadata,
      tryUseConsumable,
    },
  });
  const { applyCombatElimination } = combatEliminationRuntime;
  const markUnattributedDeath = (victim, reasonText = '접전 중 전투불능') => {
    if (!victim) return;
    const victimId = String(victim?._id || '');
    setDeathMetadata(victim, victim._deathBy || 'combat_unattributed', { causeName: reasonText });
    addLog(`☠️ [${victim.name}] ${reasonText}`, 'death');
    if (!newDeadIds.includes(victimId)) {
      victim.deadAtPhaseIdx = phaseIdxNow;
      victim.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
      newDeadIds.push(victimId);
      flushDeadSnapshots(appendPhaseDeadSnapshots(victim));
    }
    emitDeathRunEventOnce(victim, { reason: victim._deathBy || 'combat_unattributed', cause: reasonText });
  };
  const skillSplashRuntime = createPhaseCombatSkillSplashRuntime({
    state: {
      newDeadIds,
      phaseIdxNow,
      survivorMap,
    },
    actions: {
      addLog,
      applyCombatElimination,
      atNow,
      emitRunEvent,
      grantPvpDamageMastery,
      shieldBlock,
    },
  });
  const {
    applyCharacterSkillSplashDamage,
    getCharacterSkillSplashTargets,
  } = skillSplashRuntime;

  const escapeOutcome = (() => {
    const curZone = String(actor?.zoneId || target?.zoneId || '');
    if (!curZone) return null;

    const hpBelow = Number(ruleset?.ai?.escapeHpBelow ?? 42);
    const aAvoid = shouldAvoidCombatByPower(actor, target);
    const bAvoid = shouldAvoidCombatByPower(target, actor);
    const aWants = (Number(actor.hp || 0) > 0 && Number(actor.hp || 0) <= hpBelow) || !!aAvoid;
    const bWants = (Number(target.hp || 0) > 0 && Number(target.hp || 0) <= hpBelow) || !!bAvoid;
    if (!aWants && !bWants) return null;

    let flee = null;
    let chaser = null;
    if (aWants && !bWants) {
      flee = actor;
      chaser = target;
    } else if (!aWants && bWants) {
      flee = target;
      chaser = actor;
    } else {
      const actorHp = Number(actor.hp || 0);
      const targetHp = Number(target.hp || 0);
      if (actorHp !== targetHp) {
        flee = (actorHp < targetHp) ? actor : target;
      } else {
        const actorRatio = aAvoid ? Number(aAvoid.ratio || 0.5) : 0.5;
        const targetRatio = bAvoid ? Number(bAvoid.ratio || 0.5) : 0.5;
        flee = (actorRatio < targetRatio) ? actor : target;
      }
      chaser = (flee === actor) ? target : actor;
    }
    return resolveFleeSequence(flee, chaser, { curZone });
  })();

  if (escapeOutcome && escapeOutcome.escaped && !escapeOutcome.caught) {
    actor = survivorMap.get(actor._id) || actor;
    target = survivorMap.get(target._id) || target;
    return { actor, target, skipRemainingTurn: true };
  }

  if (escapeOutcome && escapeOutcome.escaped && escapeOutcome.caught) {
    const fleeNow = survivorMap.get(escapeOutcome.fleeId);
    const chaserNow = survivorMap.get(escapeOutcome.chaserId);
    if (fleeNow && Number(fleeNow.hp || 0) <= 0 && chaserNow) {
      applyCombatElimination(chaserNow, fleeNow, { killText: '추격 제압' });
      return { actor, target, skipRemainingTurn: true };
    }
  }

  actor = survivorMap.get(actor._id) || actor;
  target = survivorMap.get(target._id) || target;

  const actorBattleName = canonicalizeCharName(actor.name);
  const targetBattleName = canonicalizeCharName(target.name);
  const battleResult = pickUnbiasedBattle(
    { ...actor, name: actorBattleName },
    { ...target, name: targetBattleName }
  );
  let battleLog = battleResult.log || '';
  if (actorBattleName && actorBattleName !== actor.name) {
    battleLog = battleLog.split(actorBattleName).join(actor.name);
  }
  if (targetBattleName && targetBattleName !== target.name) {
    battleLog = battleLog.split(targetBattleName).join(target.name);
  }

  if (battleResult.winner) {
    return resolveCombatWinnerOutcome({
      actions: {
        addLog,
        applyErTraitAfterBattle,
        applyErWeaponSkillAfterCombat,
        atNow,
        emitRunEvent,
        grantPvpDamageMastery,
        reserveActionSecond,
      },
      combatElimination: {
        applyCombatElimination,
      },
      flee: {
        resolveFleeSequence,
      },
      skillSplash: {
        applyCharacterSkillSplashDamage,
        getCharacterSkillSplashTargets,
      },
      state: {
        actor,
        battleLog,
        battleResult,
        battleSettings,
        currentActionSec,
        estimatePower,
        isDay1MorningFarmPhase,
        midgameCombatWindow,
        nextDay,
        phaseIdxNow,
        pvpCfg,
        supportRoster: todaysSurvivors,
        target,
      },
      tactical: {
        applyCombatTacAttack,
        shieldBlock,
      },
    });
  }

  const scratch = Math.min(12, 5 + Math.floor(nextDay / 2));
  actor.hp = Math.max(0, Number(actor.hp || 0) - scratch);
  target.hp = Math.max(0, Number(target.hp || 0) - scratch);
  if (scratch > 0) {
    actor.lastDamagedBy = String(target._id);
    actor.lastDamagedPhaseIdx = phaseIdxNow;
    target.lastDamagedBy = String(actor._id);
    target.lastDamagedPhaseIdx = phaseIdxNow;
  }
  grantPvpDamageMastery(actor, { damageDealt: scratch, damageTaken: scratch }, '접전');
  grantPvpDamageMastery(target, { damageDealt: scratch, damageTaken: scratch }, '접전');
  addLog(battleLog, 'combat-detail');
  addLog(`⚔️ 접전 피해: [${actor.name}] / [${target.name}] 둘 다 -${scratch}`, 'combat-detail');

  emitRunEvent(
    'battle',
    {
      a: String(actor?._id || ''),
      b: String(target?._id || ''),
      winner: '',
      lethal: false,
      zoneId: String(actor?.zoneId || target?.zoneId || ''),
    },
    atNow()
  );
  if (actor.hp <= 0) markUnattributedDeath(actor, '접전 끝에 쓰러짐');
  if (target.hp <= 0) markUnattributedDeath(target, '접전 끝에 쓰러짐');

  return { actor, target, skipRemainingTurn: false };
}
