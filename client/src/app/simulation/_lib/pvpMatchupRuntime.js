import { calculateBattle } from '../../../utils/battleLogic';
import { normalizeErStats } from '../../../utils/erStats';
import { canonicalizeCharName, cloneForBattle } from './combatRuntime';
import { estimateMovePower, shouldAvoidCombatByMovePower } from './movePowerRuntime';

function estimatePvpPower(actor, context = {}) {
  return estimateMovePower(actor, context);
}

function shouldAvoidCombatByPvpPower(actor, opponent, context = {}) {
  return shouldAvoidCombatByMovePower(actor, opponent, context);
}

function pickUnbiasedBattle(attacker, defender, context = {}) {
  const nextDay = Math.max(1, Math.floor(Number(context?.nextDay || 1)));
  const battleSettings = context?.battleSettings || {};
  const firstResult = calculateBattle(cloneForBattle(attacker), cloneForBattle(defender), nextDay, battleSettings);
  const firstWinnerId = firstResult?.winner?._id ? String(firstResult.winner._id) : null;
  if (!firstWinnerId) return firstResult;

  const attackerPower = estimatePvpPower(attacker, context);
  const defenderPower = estimatePvpPower(defender, context);
  const totalPower = Math.max(1, attackerPower + defenderPower);
  const delta = (attackerPower - defenderPower) / totalPower;
  let attackerWinChance = 0.5 + delta * 0.35;

  const attackerStats = normalizeErStats(attacker?.stats || {});
  const defenderStats = normalizeErStats(defender?.stats || {});
  const attackerTempo = Number(attackerStats.sightRange || 0) + Number(attackerStats.attackSpeed || 0) * 6;
  const defenderTempo = Number(defenderStats.sightRange || 0) + Number(defenderStats.attackSpeed || 0) * 6;
  attackerWinChance += ((attackerTempo - defenderTempo) / 30) * 0.05;
  attackerWinChance = Math.min(0.85, Math.max(0.15, attackerWinChance));

  const attackerId = String(attacker?._id || '');
  const defenderId = String(defender?._id || '');
  if (!attackerId || !defenderId) return firstResult;

  const chosenId = Math.random() < attackerWinChance ? attackerId : defenderId;
  if (chosenId === firstWinnerId) return firstResult;

  const skirmishWinner = chosenId === attackerId ? attacker : defender;
  const skirmishLoser = skirmishWinner === attacker ? defender : attacker;
  const winnerRawName = skirmishWinner?.name || skirmishWinner?.character_name || skirmishWinner?.nickname || '';
  const loserRawName = skirmishLoser?.name || skirmishLoser?.character_name || skirmishLoser?.nickname || '';
  const winnerName = canonicalizeCharName(winnerRawName) || winnerRawName || 'UNKNOWN';
  const loserName = canonicalizeCharName(loserRawName) || loserRawName || 'UNKNOWN';

  return {
    ...firstResult,
    winner: skirmishWinner,
    type: 'kill',
    log: `⚡ 난전! [${winnerName}](이)가 [${loserName}](을)를 제압했습니다!`,
  };
}

export {
  estimatePvpPower,
  pickUnbiasedBattle,
  shouldAvoidCombatByPvpPower,
};
