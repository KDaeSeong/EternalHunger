import { applyHealingModifier } from '../../../utils/statusLogic';
import { getNonCombatRegenMultiplier } from '../../../utils/masteryLogic';
import {
  addItemToInventory,
  applyAiRecoveryWindow,
  areSameTeam,
  autoEquipBest,
  buildCraftGoal,
  clearRuntimeCombatFields,
  getActorPerkEffects,
  getPerkLootBias,
  itemIcon,
  pickGoalLoadoutKeys,
  pickUnitsFromInventory,
  pruneEquippedAgainstInventory,
  removePickedUnitsFromInventory,
  tryAutoCraftFromInventory,
  tryAutoCraftFromLoot,
} from './simulationEngine';
import { clearPostCombatEffects } from './runtimeStatus';
import { getLootCraftOptions } from './runEventRuntime';

export function createPhaseCombatEliminationRuntime({
  actions = {},
  state = {},
} = {}) {
  const {
    assistWindowPhases = 0,
    canReviveThisMatch = false,
    craftables,
    currentActionSec = () => 0,
    itemMetaById,
    itemNameById,
    isSoloMatch = false,
    newDeadIds = [],
    nextDay,
    phaseIdxNow = 0,
    phaseSurvivors = [],
    publicItems = [],
    pvpCfg = {},
    reviveCutoffIdx = 0,
    roundAssists = {},
    roundKills = {},
    ruleset,
    sourceActor = null,
    survivorMap = new Map(),
    todaysSurvivors = [],
    useDetonation = false,
  } = state;
  const {
    addEarnedCredits = () => {},
    addLog = () => {},
    appendPhaseDeadSnapshots = (actor) => actor,
    applyErTraitAfterBattle = () => null,
    atNow = () => null,
    emitDeathRunEventOnce = () => {},
    emitRunEvent = () => {},
    flushDeadSnapshots = () => {},
    grantPvpKillMastery = () => {},
    pickSparseSafeNeighbor = () => '',
    setDeathMetadata = () => {},
    tryUseConsumable = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
  } = actions;

  const applyCombatElimination = (combatWinner, combatLoser, opts = {}) => {
    if (!combatWinner || !combatLoser) return { assistId: null };

    const winnerId = String(combatWinner?._id || '');
    const loserId = String(combatLoser?._id || '');
    const prevDamagedBy = String(opts.prevDamagedBy || combatLoser?.lastDamagedBy || '');
    const prevDamagedPhaseIdx = Number(opts.prevDamagedPhaseIdx ?? combatLoser?.lastDamagedPhaseIdx ?? -9999);
    const deathReason = String(opts?.deathReason || 'combat').trim() || 'combat';
    const deathCauseName = String(opts?.deathCauseName || opts?.killText || '교전').trim() || '교전';
    let pushedDead = false;

    setDeathMetadata(combatLoser, deathReason, { causeName: deathCauseName, by: winnerId });
    if (!newDeadIds.includes(loserId)) {
      combatLoser.deadAtPhaseIdx = phaseIdxNow;
      combatLoser.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
      newDeadIds.push(loserId);
      pushedDead = true;
    }

    roundKills[winnerId] = (roundKills[winnerId] || 0) + 1;
    grantPvpKillMastery(combatWinner, combatLoser, '처치');

    let assistId = null;
    const assistActor = prevDamagedBy
      ? (survivorMap.get(prevDamagedBy)
        || phaseSurvivors.find((survivor) => String(survivor?._id || '') === prevDamagedBy)
        || todaysSurvivors.find((survivor) => String(survivor?._id || '') === prevDamagedBy)
        || null)
      : null;
    const canRecordAssist = !isSoloMatch
      && assistActor
      && String(assistActor?.name || '').trim()
      && prevDamagedBy !== winnerId
      && prevDamagedBy !== loserId
      && areSameTeam(assistActor, combatWinner)
      && !areSameTeam(assistActor, combatLoser)
      && (phaseIdxNow - prevDamagedPhaseIdx) <= assistWindowPhases;

    if (canRecordAssist) {
      assistId = prevDamagedBy;
      roundAssists[assistId] = (roundAssists[assistId] || 0) + 1;
    }

    const assistName = assistId ? String(assistActor?.name || '') : '';
    const killVerb = String(opts.killText || '처치').trim() || '처치';
    addLog(`☠️ [${combatWinner.name}] → [${combatLoser.name}] ${killVerb} (+1킬${assistId ? `, 어시: ${assistName}` : ''})`, 'death');

    if (!opts?.skipTraitAfterBattle) {
      applyErTraitAfterBattle(combatWinner, { lethal: true, defeated: combatLoser, damageDealt: opts?.damageDealt });
    }

    emitDeathRunEventOnce(combatLoser, {
      by: winnerId,
      zoneId: String(combatLoser?.zoneId || combatWinner?.zoneId || sourceActor?.zoneId || ''),
      reason: deathReason,
      cause: deathCauseName,
    });

    if (useDetonation) {
      const bonusSec = Number(ruleset?.detonation?.killBonusSec || 5);
      const baseMax = Number((combatWinner.detonationMaxSec ?? ruleset?.detonation?.maxSec) ?? 30);
      const nextMax = baseMax + bonusSec;
      combatWinner.detonationMaxSec = nextMax;
      const baseCur = Number((combatWinner.detonationSec ?? ruleset?.detonation?.startSec) ?? 20);
      combatWinner.detonationSec = Math.min(nextMax, baseCur + bonusSec);
      addLog(`⏱️ [${combatWinner.name}] 처치 보상: 금지구역 제한시간 +${bonusSec}s`, 'combat-detail');

      const killCredit = Number(ruleset?.credits?.kill || 0);
      if (killCredit > 0) {
        addEarnedCredits(killCredit);
        combatWinner.simCredits = Number(combatWinner.simCredits || 0) + killCredit;
      }
    }

    const lootRate = Number(pvpCfg.lootCreditRate ?? 0.35);
    const lootMin = Number(pvpCfg.lootCreditMin ?? 10);
    const winnerLootBias = Math.max(0, getPerkLootBias(combatWinner));
    const lootUnitsBase = Math.max(0, Math.floor(Number(pvpCfg.lootInventoryUnits ?? 1)));
    const lootUnits = Math.max(0, Math.min(4, lootUnitsBase + (winnerLootBias >= 0.35 ? 1 : 0) + (winnerLootBias >= 0.8 ? 1 : 0)));
    const loserCredits = Math.max(0, Number(combatLoser?.simCredits || 0));
    const stealCreditBase = Math.min(loserCredits, Math.max(lootMin, Math.floor(loserCredits * lootRate)));
    const stealCredit = Math.min(loserCredits, Math.max(lootMin, Math.round(stealCreditBase * (1 + winnerLootBias * 0.5))));
    const lootLines = [];
    const craftLogs = [];

    if (stealCredit > 0) {
      combatLoser.simCredits = loserCredits - stealCredit;
      combatWinner.simCredits = Number(combatWinner.simCredits || 0) + stealCredit;
      lootLines.push(`💰 크레딧 ${stealCredit}`);
      emitRunEvent('gain', { who: winnerId, itemId: 'CREDITS', qty: stealCredit, source: 'pvp', from: loserId, zoneId: String(combatWinner?.zoneId || '') }, atNow());
    }

    const winnerLootGoal = buildCraftGoal(combatWinner.inventory, craftables, itemNameById, {
      goalTier: combatWinner?.goalGearTier,
      goalItemKeys: pickGoalLoadoutKeys(combatWinner),
      perkEffects: getActorPerkEffects(combatWinner),
    });
    const winnerLootGoalIds = (Array.isArray(winnerLootGoal?.missing) ? winnerLootGoal.missing : [])
      .map((missing) => String(missing?.itemId || ''))
      .filter(Boolean);
    const lootPick = lootUnits > 0 ? pickUnitsFromInventory(combatLoser?.inventory || [], lootUnits, { goalItemIds: winnerLootGoalIds }) : [];

    if (lootPick.length) {
      combatLoser.inventory = removePickedUnitsFromInventory(combatLoser?.inventory || [], lootPick);
      pruneEquippedAgainstInventory(combatLoser);
      for (const lootPiece of lootPick) {
        const lootId = String(lootPiece?.itemId || '');
        if (!lootId) continue;
        const lootItem = lootPiece?.item || (Array.isArray(publicItems) ? publicItems : []).find((item) => String(item?._id) === lootId) || null;
        const fallbackName = itemNameById?.[lootId] || '아이템';
        const stub = lootItem || { _id: lootId, name: fallbackName, type: '재료', tags: [] };
        combatWinner.inventory = addItemToInventory(combatWinner.inventory, stub, lootId, 1, nextDay, ruleset);
        const gainMeta = combatWinner.inventory?._lastAdd;
        const got = Math.max(0, Number(gainMeta?.acceptedQty ?? 1));
        if (got > 0) {
          emitRunEvent('gain', { who: winnerId, itemId: lootId, qty: got, source: 'pvp', from: loserId, zoneId: String(combatWinner?.zoneId || '') }, atNow());
          lootLines.push(`${itemIcon(stub)} ${stub?.name || fallbackName} x${got}`);
          const crafted = tryAutoCraftFromLoot(combatWinner.inventory, lootId, craftables, itemNameById, itemMetaById, nextDay, ruleset, getLootCraftOptions(combatWinner));
          if (crafted?.inventory) {
            combatWinner.inventory = crafted.inventory;
            craftLogs.push(crafted.log);
          }
        }
      }
    }

    const invCraft = tryAutoCraftFromInventory(combatWinner, craftables, itemNameById, itemMetaById, nextDay, phaseIdxNow, ruleset);
    if (invCraft?.log) craftLogs.push(invCraft.log);
    autoEquipBest(combatWinner, itemMetaById);
    pruneEquippedAgainstInventory(combatLoser);

    if (lootLines.length) addLog(`🧾 루팅: [${combatWinner.name}] ← [${combatLoser.name}] (${lootLines.join(', ')})`, 'combat-detail');
    if (craftLogs.length) {
      for (const line of craftLogs) addLog(line, 'highlight');
    }

    const maxHp = Number(combatWinner?.maxHp ?? 100);
    const restHealMax = Math.max(0, Math.floor(Number(pvpCfg.restHealMax ?? 8)));
    const regenMultiplier = getNonCombatRegenMultiplier(combatWinner);
    const restHeal = applyHealingModifier(combatWinner, Math.min(Math.round(restHealMax * regenMultiplier), Math.max(0, maxHp - Number(combatWinner.hp || 0))));
    if (restHeal > 0) {
      combatWinner.hp = Math.min(maxHp, Number(combatWinner.hp || 0) + restHeal);
      addLog(`🩹 [${combatWinner.name}] 전투 후 재정비: HP +${restHeal}`, 'combat-detail');
    }

    tryUseConsumable(combatWinner, 'after_battle');
    const curHp = Number(combatWinner.hp || 0);
    const postRestHpBelow = Math.max(0, Number(pvpCfg.postBattleRestHpBelow ?? 45));
    const postRestExtraHealMax = Math.max(0, Math.floor(Number(pvpCfg.postBattleRestExtraHealMax ?? 6)));
    const postMoveChance = Math.max(0, Math.min(1, Number(pvpCfg.postBattleMoveChance ?? 0.35)));

    if (curHp > 0 && curHp <= postRestHpBelow) {
      const extraHeal = applyHealingModifier(combatWinner, Math.min(Math.round(postRestExtraHealMax * regenMultiplier), Math.max(0, maxHp - curHp)));
      if (extraHeal > 0) {
        combatWinner.hp = Math.min(maxHp, curHp + extraHeal);
        addLog(`🧘 [${combatWinner.name}] 전투 후 응급 처치: HP +${extraHeal}`, 'combat-detail');
      }
    } else if (Math.random() < postMoveChance) {
      const curZone = String(combatWinner.zoneId || '');
      const nextZone = pickSparseSafeNeighbor(curZone);
      if (nextZone && nextZone !== curZone) {
        combatWinner.zoneId = nextZone;
        addLog(`🚶 [${combatWinner.name}] 전투 후 이동: ${getZoneName(nextZone)}`, 'combat-detail');
      }
    }

    if (clearPostCombatEffects(combatWinner)) {
      addLog(`🧼 [${combatWinner.name}] 전투 후 지속 피해 상태 정리`, 'combat-detail');
    }
    clearRuntimeCombatFields(combatWinner);
    applyAiRecoveryWindow(combatWinner, currentActionSec(), {
      reason: 'post_combat',
      opponentId: loserId,
      recoverSec: 6,
      safeZoneSec: Number(combatWinner.hp || 0) <= postRestHpBelow ? 5 : 0,
    });

    if (pushedDead) {
      flushDeadSnapshots(appendPhaseDeadSnapshots(combatLoser));
    }

    return { assistId };
  };

  return { applyCombatElimination };
}
