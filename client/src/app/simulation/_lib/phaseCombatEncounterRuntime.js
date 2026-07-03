import { buildErBehaviorModifier } from '../../../utils/erMeta';
import {
  applyHealingModifier,
  getLifestealPercent,
} from '../../../utils/statusLogic';
import { applyCharacterSkillOnBasicAttack } from './characterSkillRuntime';
import { canonicalizeCharName } from './combatRuntime';
import { createPhaseCombatEliminationRuntime } from './phaseCombatEliminationRuntime';
import { createPhaseCombatFleeRuntime } from './phaseCombatFleeRuntime';
import { createPhaseCombatSkillSplashRuntime } from './phaseCombatSkillSplashRuntime';
import { createPhaseCombatTacticalRuntime } from './phaseCombatTacticalRuntime';
import { softenNonLethalBattleLog } from './simulationFormattingRuntime';

function applyCombatLifesteal(who, dealt, { addLog = () => {} } = {}) {
  if (!who || Number(who.hp || 0) <= 0) return 0;
  const pct = getLifestealPercent(who);
  if (pct <= 0 || dealt <= 0) return 0;
  const maxHp = Math.max(1, Number(who?.maxHp || 100));
  const rawHeal = Math.min(Math.max(0, maxHp - Number(who.hp || 0)), Math.max(1, Math.round(Number(dealt || 0) * pct)));
  const heal = applyHealingModifier(who, rawHeal);
  if (heal <= 0) return 0;
  who.hp = Math.min(maxHp, Number(who.hp || 0) + heal);
  addLog(`🩸 [${who.name}] 흡혈: HP +${heal}`, 'system');
  return heal;
}

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
    const actorIdStr = String(actor._id);
    const winnerIdStr = String(battleResult.winner._id);
    const battleWinner = winnerIdStr === actorIdStr ? actor : target;
    const loser = winnerIdStr === actorIdStr ? target : actor;
    const winnerId = String(battleResult.winner._id);

    const prevDamagedBy = String(loser?.lastDamagedBy || '');
    const prevDamagedPhaseIdx = Number(loser?.lastDamagedPhaseIdx ?? -9999);

    const winnerPower = estimatePower(battleWinner);
    const loserPower = estimatePower(loser);
    const ratio = winnerPower / Math.max(1, winnerPower + loserPower);
    const loserHpBeforeDamage = Math.max(0, Number(loser.hp || 0));
    const damageBase = Number(pvpCfg.damageBase ?? 18);
    const damageDayScale = Number(pvpCfg.damageDayScale ?? 3);
    const base = damageBase + nextDay * damageDayScale;
    const earlyLethalDayEnd = Math.max(0, Math.floor(Number(pvpCfg.earlyLethalDamageDayEnd ?? 3)));
    const earlyLethalWindow = !isDay1MorningFarmPhase && nextDay <= earlyLethalDayEnd;
    const earlyDamageFlat = earlyLethalWindow ? Math.max(0, Number(pvpCfg.earlyLethalDamageFlat ?? 8)) : 0;
    const earlyLowHpBonusBelow = Math.max(0, Number(pvpCfg.earlyLethalLowHpBonusBelow ?? 45));
    const earlyLowHpBonus = (earlyLethalWindow && loserHpBeforeDamage <= earlyLowHpBonusBelow)
      ? Math.max(0, Number(pvpCfg.earlyLethalLowHpBonus ?? 10))
      : 0;
    const winnerErDamage = buildErBehaviorModifier(battleWinner, battleSettings);
    const loserErDamage = buildErBehaviorModifier(loser, battleSettings);
    const erDamageScale = Math.max(0, Number(battleSettings?.battle?.erDamageScale ?? 1));
    const winnerDamageBonus = Math.round(Math.max(0, Number(winnerErDamage?.damageBonus || 0)) * erDamageScale);
    const counterDamageBonus = Math.round(Math.max(0, Number(loserErDamage?.damageBonus || 0)) * erDamageScale * 0.45);
    const dmgToLoser = Math.min(110, Math.max(16, Math.round(base + ratio * 34 + winnerDamageBonus + earlyDamageFlat + earlyLowHpBonus)));
    const dmgToWinner = Math.min(38, Math.max(0, Math.round(7 + (1 - ratio) * 14 + counterDamageBonus)));
    if (winnerDamageBonus >= 4 || counterDamageBonus >= 3) {
      const bits = [];
      if (winnerDamageBonus >= 4) bits.push(`${battleWinner.name} +${winnerDamageBonus}`);
      if (counterDamageBonus >= 3) bits.push(`${loser.name} 반격 +${counterDamageBonus}`);
      addLog(`⚔️ ER 피해 보정: ${bits.join(' / ')}`, 'system');
    }

    const atkDmgToLoser = applyCombatTacAttack(battleWinner, loser, dmgToLoser);
    const atkDmgToWinner = applyCombatTacAttack(loser, battleWinner, dmgToWinner);
    const charSkillToLoser = applyCharacterSkillOnBasicAttack(battleWinner, loser, atkDmgToLoser, {
      settings: battleSettings,
      nowSec: currentActionSec(),
      at: atNow(),
      addLog,
      emitRunEvent,
      splashTargets: getCharacterSkillSplashTargets(battleWinner, loser),
      showLog: battleSettings?.skills?.showSkillLogs !== false,
    });
    const charSkillToWinner = applyCharacterSkillOnBasicAttack(loser, battleWinner, atkDmgToWinner, {
      settings: battleSettings,
      nowSec: currentActionSec(),
      at: atNow(),
      addLog,
      emitRunEvent,
      splashTargets: getCharacterSkillSplashTargets(loser, battleWinner),
      showLog: battleSettings?.skills?.showSkillLogs !== false,
    });
    const finalDmgToLoser = shieldBlock(loser, charSkillToLoser.damage);
    const finalDmgToWinner = shieldBlock(battleWinner, charSkillToWinner.damage);

    loser.hp = Math.max(0, Number(loser.hp || 0) - finalDmgToLoser);
    battleWinner.hp = Math.max(0, Number(battleWinner.hp || 0) - finalDmgToWinner);
    const splashDmgByWinner = applyCharacterSkillSplashDamage(battleWinner, charSkillToLoser.splashHits);
    const splashDmgByLoser = applyCharacterSkillSplashDamage(loser, charSkillToWinner.splashHits);
    applyCombatLifesteal(battleWinner, finalDmgToLoser, { addLog });
    applyCombatLifesteal(loser, finalDmgToWinner, { addLog });
    const weaponSkillResult = applyErWeaponSkillAfterCombat(battleWinner, loser, {
      damageDealt: finalDmgToLoser,
      lethalPreview: loser.hp <= 0,
      settings: battleSettings,
      nowSec: currentActionSec(),
      at: atNow(),
    });
    const weaponSkillDamageToLoser = Math.max(0, Number(weaponSkillResult?.damage || 0));
    let totalDmgToLoser = finalDmgToLoser + weaponSkillDamageToLoser;
    const totalDmgToWinner = finalDmgToWinner;
    if (splashDmgByWinner > 0 || splashDmgByLoser > 0) {
      const bits = [];
      if (splashDmgByWinner > 0) bits.push(`${battleWinner.name} 광역 +${splashDmgByWinner}`);
      if (splashDmgByLoser > 0) bits.push(`${loser.name} 광역 +${splashDmgByLoser}`);
      addLog(`🌀 캐릭터 스킬 광역: ${bits.join(' / ')}`, 'system');
    }

    let lethal = loser.hp <= 0;
    if (!lethal && earlyLethalWindow) {
      const hpAfterCombat = Math.max(0, Number(loser.hp || 0));
      const finishHpBelow = Math.max(0, Number(pvpCfg.earlyLethalFinishHpBelow ?? 12));
      if (hpAfterCombat > 0 && hpAfterCombat <= finishHpBelow) {
        const finishBase = Math.max(0, Number(pvpCfg.earlyLethalFinishChanceBase ?? 0.12));
        const finishScale = Math.max(0, Number(pvpCfg.earlyLethalFinishChanceDayScale ?? 0.05));
        const finishRatioBonus = Math.max(0, Number(pvpCfg.earlyLethalFinishRatioBonus ?? 0.12));
        const midgameFinishBonus = midgameCombatWindow ? Math.max(0, Number(pvpCfg.midgameLethalFinishBonus ?? 0.10)) : 0;
        const finishMax = Math.max(0, Math.min(1, Number(pvpCfg.earlyLethalFinishMax ?? 0.34)));
        const ratioBonus = Math.max(0, (ratio - 0.5) * 2) * finishRatioBonus;
        const finishChance = Math.min(finishMax, finishBase + Math.max(0, nextDay - 1) * finishScale + ratioBonus + midgameFinishBonus);
        if (Math.random() < finishChance) {
          const finisherDamage = Math.max(1, Math.ceil(hpAfterCombat));
          loser.hp = 0;
          totalDmgToLoser += finisherDamage;
          lethal = true;
          addLog(`☠️ [${battleWinner.name}] 결정타로 [${loser.name}]을(를) 마무리했습니다.`, 'death');
        }
      }
    }
    if (!lethal) {
      battleLog = softenNonLethalBattleLog(battleLog);
    }

    if (totalDmgToWinner > 0) {
      battleWinner.lastDamagedBy = String(loser._id);
      battleWinner.lastDamagedPhaseIdx = phaseIdxNow;
    }
    if (!lethal && totalDmgToLoser > 0) {
      loser.lastDamagedBy = String(winnerId);
      loser.lastDamagedPhaseIdx = phaseIdxNow;
    }
    addLog(battleLog, lethal ? 'death' : 'normal');
    addLog(`🩸 피해: [${battleWinner.name}]↘[${loser.name}] -${totalDmgToLoser} (반격 -${totalDmgToWinner})`, 'highlight');
    grantPvpDamageMastery(battleWinner, { damageDealt: totalDmgToLoser, damageTaken: totalDmgToWinner }, lethal ? '결정 교전' : '교전 승리');
    grantPvpDamageMastery(loser, { damageDealt: totalDmgToWinner, damageTaken: totalDmgToLoser }, lethal ? '교전 경험' : '반격');

    let postCombatFlee = null;
    const criticalFleeHpBelow = Math.max(0, Number(pvpCfg.criticalFleeHpBelow ?? 18));
    const criticalFleeChance = Math.max(0, Math.min(1, Number(pvpCfg.criticalFleeChance ?? 0.78)));
    if (!lethal && Number(loser.hp || 0) > 0 && Number(loser.hp || 0) <= criticalFleeHpBelow && Math.random() < criticalFleeChance) {
      postCombatFlee = resolveFleeSequence(loser, battleWinner, { curZone: String(loser.zoneId || battleWinner.zoneId || ''), forceAttempt: true, escapeText: '빈사 도주', moveReason: 'critical_flee' });
    }
    if (!lethal && postCombatFlee?.fatal !== true) {
      applyErTraitAfterBattle(battleWinner, { lethal: false, damageDealt: totalDmgToLoser, defeated: loser });
    }

    emitRunEvent(
      'battle',
      {
        a: String(actor?._id || ''),
        b: String(target?._id || ''),
        winner: (lethal || (postCombatFlee?.fatal === true)) ? String(battleWinner?._id || '') : '',
        lethal: !!lethal || (postCombatFlee?.fatal === true),
        zoneId: String(actor?.zoneId || target?.zoneId || ''),
      },
      atNow()
    );

    if (postCombatFlee?.fatal === true) {
      applyCombatElimination(battleWinner, loser, { prevDamagedBy, prevDamagedPhaseIdx, killText: '빈사 추격 제압', deathReason: 'critical_flee', deathCauseName: '빈사 추격', damageDealt: totalDmgToLoser });
    } else if (lethal) {
      applyCombatElimination(battleWinner, loser, { prevDamagedBy, prevDamagedPhaseIdx, killText: '처치', deathReason: 'combat', deathCauseName: '교전', damageDealt: totalDmgToLoser });
    }

    return { actor, target, skipRemainingTurn: false };
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
  addLog(battleLog, 'normal');
  addLog(`⚔️ 접전 피해: [${actor.name}] / [${target.name}] 둘 다 -${scratch}`, 'normal');

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
