import { buildErBehaviorModifier } from '../../../utils/erMeta';
import {
  applyHealingModifier,
  getLifestealPercent,
} from '../../../utils/statusLogic';
import { applyCharacterSkillOnBasicAttack } from './characterSkillRuntime';
import { softenNonLethalBattleLog } from './simulationFormattingRuntime';
import { areSameTeam } from './teamRuntime';

function applyCombatLifesteal(who, dealt, { addLog = () => {} } = {}) {
  if (!who || Number(who.hp || 0) <= 0) return 0;
  const pct = getLifestealPercent(who);
  if (pct <= 0 || dealt <= 0) return 0;
  const maxHp = Math.max(1, Number(who?.maxHp || 100));
  const rawHeal = Math.min(Math.max(0, maxHp - Number(who.hp || 0)), Math.max(1, Math.round(Number(dealt || 0) * pct)));
  const heal = applyHealingModifier(who, rawHeal);
  if (heal <= 0) return 0;
  who.hp = Math.min(maxHp, Number(who.hp || 0) + heal);
  addLog(`🩸 [${who.name}] 흡혈: HP +${heal}`, 'combat-detail');
  return heal;
}

function getSameZoneSupportTargets(actor, roster) {
  const actorId = String(actor?._id || actor?.id || '');
  const zoneId = String(actor?.zoneId || '');
  if (!actorId || !zoneId) return [];
  return (Array.isArray(roster) ? roster : [])
    .filter((row) => row && String(row?._id || row?.id || '') !== actorId)
    .filter((row) => Number(row?.hp || 0) > 0)
    .filter((row) => String(row?.zoneId || '') === zoneId)
    .filter((row) => areSameTeam(actor, row));
}

export function resolveCombatWinnerOutcome({
  actions = {},
  combatElimination = {},
  flee = {},
  skillSplash = {},
  state = {},
  tactical = {},
} = {}) {
  const {
    actor,
    battleLog: initialBattleLog = '',
    battleResult,
    battleSettings = {},
    currentActionSec = () => 0,
    estimatePower = () => 0,
    isDay1MorningFarmPhase = false,
    midgameCombatWindow = false,
    nextDay = 1,
    phaseIdxNow = 0,
    pvpCfg = {},
    supportRoster = [],
    target,
  } = state;
  const {
    addLog = () => {},
    applyErTraitAfterBattle = () => null,
    applyErWeaponSkillAfterCombat = () => null,
    atNow = () => null,
    emitRunEvent = () => {},
    grantPvpDamageMastery = () => {},
    reserveActionSecond = () => {},
  } = actions;
  const {
    applyCombatTacAttack = (_attacker, _defender, damage) => Math.max(0, Number(damage || 0)),
    shieldBlock = (_defender, damage) => Math.max(0, Number(damage || 0)),
  } = tactical;
  const {
    applyCharacterSkillSplashDamage = () => 0,
    getCharacterSkillSplashTargets = () => [],
  } = skillSplash;
  const {
    resolveFleeSequence = () => null,
  } = flee;
  const {
    applyCombatElimination = () => null,
  } = combatElimination;

  if (!battleResult?.winner) {
    return { handled: false, actor, target, battleLog: initialBattleLog, skipRemainingTurn: false };
  }

  let battleLog = initialBattleLog;
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
    addLog(`⚔️ ER 피해 보정: ${bits.join(' / ')}`, 'combat-detail');
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
    supportTargets: getSameZoneSupportTargets(battleWinner, supportRoster),
    showLog: battleSettings?.skills?.showSkillLogs !== false,
  });
  const charSkillToWinner = applyCharacterSkillOnBasicAttack(loser, battleWinner, atkDmgToWinner, {
    settings: battleSettings,
    nowSec: currentActionSec(),
    at: atNow(),
    addLog,
    emitRunEvent,
    splashTargets: getCharacterSkillSplashTargets(loser, battleWinner),
    supportTargets: getSameZoneSupportTargets(loser, supportRoster),
    showLog: battleSettings?.skills?.showSkillLogs !== false,
  });
  const skillActionLockSec = Math.max(
    0,
    Number(charSkillToLoser?.actionLockSec || 0),
    Number(charSkillToWinner?.actionLockSec || 0)
  );
  if (skillActionLockSec > 0) {
    reserveActionSecond(Math.max(1, Math.ceil(skillActionLockSec)));
  }
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
    addLog(`🌀 캐릭터 스킬 광역: ${bits.join(' / ')}`, 'combat-detail');
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
        addLog(`☠️ [${battleWinner.name}] 결정타로 [${loser.name}]을(를) 마무리했습니다.`, 'combat-detail');
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
  addLog(battleLog, 'combat-detail');
  addLog(`🩸 피해: [${battleWinner.name}]↘[${loser.name}] -${totalDmgToLoser} (반격 -${totalDmgToWinner})`, 'combat-detail');
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

  return {
    actor,
    battleLog,
    handled: true,
    skipRemainingTurn: false,
    target,
  };
}
