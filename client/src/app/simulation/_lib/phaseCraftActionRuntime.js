import {
  buildCraftGoal,
  getActorPerkEffects,
  lateGameGearDirector,
  pickGoalLoadoutKeys,
  tryAutoCraftFromInventory,
} from './simulationEngine';
import { advanceActorRouteProgressForGoal } from './phaseRouteProgressRuntime';
import { shouldForceDay1HeroGearCatchup } from './routePlanProgressRuntime';

export function runCraftAction({
  actions = {},
  state = {},
} = {}) {
  const {
    actor,
    craftables,
    itemMetaById,
    itemNameById,
    nextDay,
    nextPhase,
    phaseIdxNow = 0,
    publicItems,
    queuedActionType,
    ruleset,
    selectedCharId,
  } = state;
  const {
    addLog = () => {},
    atNow = () => null,
    emitCraftRunEvent = () => {},
    runDay1HeroGear = () => {},
  } = actions;

  const updated = actor || {};
  if (queuedActionType !== 'craft') {
    return {
      actor: updated,
      ran: false,
    };
  }

  const invCraft = tryAutoCraftFromInventory(updated, craftables, itemNameById, itemMetaById, nextDay, phaseIdxNow, ruleset);
  if (invCraft?.changed) {
    addLog(String(invCraft.log), 'highlight');
    emitCraftRunEvent(updated?._id, invCraft, atNow(), updated?.zoneId);
    const postCraftGoal = buildCraftGoal(updated.inventory, craftables, itemNameById, {
      goalTier: updated?.goalGearTier,
      goalItemKeys: pickGoalLoadoutKeys(updated),
      perkEffects: getActorPerkEffects(updated),
    });
    advanceActorRouteProgressForGoal({
      actor: updated,
      craftGoal: postCraftGoal,
      ruleset,
      searched: false,
      zoneId: updated.zoneId,
    });
  } else if (String(selectedCharId || '') === String(updated?._id || '')) {
    const dbg = updated?._craftDebug || null;
    const dbgKey = `${phaseIdxNow}:${String(dbg?.code || '')}:${String(dbg?.targetName || '')}:${Array.isArray(dbg?.missing) ? dbg.missing.join('|') : ''}`;
    if (dbg?.code && updated?._craftDebugLogKey !== dbgKey) {
      updated._craftDebugLogKey = dbgKey;
      addLog(`[${updated.name}] 🧪 제작판정(${dbg.code}): ${dbg.text}`, 'system');
    }
  }

  const allowAbstractGearFallback = !Array.isArray(craftables) || craftables.length <= 0;
  const forceEarlyHeroRouteCompletion = shouldForceDay1HeroGearCatchup(updated, nextDay, nextPhase);
  runDay1HeroGear(updated, {
    allowAbstractFallback: allowAbstractGearFallback || forceEarlyHeroRouteCompletion,
    forceRouteCompletion: forceEarlyHeroRouteCompletion,
    routeCompletionTier: Number(ruleset?.ai?.day1AbstractFallbackMaxTier ?? 4),
  });

  const lateRes = lateGameGearDirector(updated, publicItems, itemNameById, itemMetaById, nextDay, nextPhase, ruleset, {
    allowAbstractFallback: allowAbstractGearFallback,
  });
  if (lateRes?.changed && Array.isArray(lateRes.logs)) {
    lateRes.logs.forEach((message) => addLog(String(message), 'highlight'));
  }

  return {
    actor: updated,
    craftResult: invCraft || null,
    lateGameResult: lateRes || null,
    ran: true,
  };
}
