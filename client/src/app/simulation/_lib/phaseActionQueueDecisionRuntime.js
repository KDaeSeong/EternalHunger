import {
  canReceiveItem,
  rollDroneOrder,
  rollKioskInteraction,
  tryAutoCraftFromInventory,
} from './simulationEngine';

function normalizeGoalMissingIds(goalMissingIds) {
  return goalMissingIds instanceof Set
    ? goalMissingIds
    : new Set((Array.isArray(goalMissingIds) ? goalMissingIds : []).map((id) => String(id || '')).filter(Boolean));
}

function buildRouteDroneNeedIds(updated, routePlanMissingIdsNow) {
  return new Set((Array.isArray(updated?.routePlanDroneItemIds) ? updated.routePlanDroneItemIds : [])
    .map((id) => String(id || '').trim())
    .filter((id) => id && Array.isArray(routePlanMissingIdsNow) && routePlanMissingIdsNow.includes(id)));
}

export function prepareActorPhaseActionQueue({
  actions = {},
  state = {},
} = {}) {
  const {
    actor,
    craftables,
    craftGoal,
    currentActionSec = () => 0,
    currentRouteItemIds = [],
    currentRouteNeedsSearch = false,
    didMove = false,
    droneOffers,
    earlyRouteActionActive = false,
    fallbackRouteItemIds = [],
    fleeInterruptReason = '',
    goalMissingIds = new Set(),
    goalTargetId = '',
    holdTarget = '',
    itemKeyById,
    itemMetaById,
    itemNameById,
    kiosks,
    mapObj,
    marketRules,
    moveContestPressure = 0,
    moveEtaSec = 1,
    moveObjectiveSubkind = '',
    moveObjectiveType = '',
    moveReason = '',
    mustEscape = false,
    nextDay,
    nextPhase,
    nextZoneId,
    phaseIdxNow = 0,
    publicItems,
    recovering = false,
    routePlanMissingIdsNow = [],
    ruleset,
    currentZone,
    upgradeNeed,
    usedHyperloopMove = false,
  } = state;
  const {
    atNow = () => null,
    emitQueueRunEvent = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
  } = actions;

  const updated = actor || {};
  const goalMissingSet = normalizeGoalMissingIds(goalMissingIds);
  const routeDroneNeedIds = buildRouteDroneNeedIds(updated, routePlanMissingIdsNow);
  const deferProcureForRoute = currentRouteNeedsSearch && !upgradeNeed?.wantLegend && !upgradeNeed?.wantTrans;

  let queuedKioskAction = (didMove || fleeInterruptReason || deferProcureForRoute)
    ? null
    : rollKioskInteraction(mapObj, updated.zoneId, kiosks, publicItems, nextDay, nextPhase, updated, craftGoal, itemNameById, marketRules, ruleset, upgradeNeed, currentActionSec());
  if (queuedKioskAction?.kind === 'buy' && queuedKioskAction?.itemId && !canReceiveItem(updated.inventory, queuedKioskAction.item, queuedKioskAction.itemId, queuedKioskAction.qty || 1, ruleset)) {
    queuedKioskAction = null;
  }

  let queuedDroneOrder = (didMove || fleeInterruptReason || deferProcureForRoute || (queuedKioskAction?.itemId && queuedKioskAction?.item))
    ? null
    : rollDroneOrder(droneOffers, mapObj, publicItems, nextDay, nextPhase, updated, phaseIdxNow, craftGoal, itemNameById, marketRules, currentActionSec());
  if (queuedDroneOrder?.itemId && !canReceiveItem(updated.inventory, queuedDroneOrder.item, queuedDroneOrder.itemId, queuedDroneOrder.qty || 1, ruleset)) {
    queuedDroneOrder = null;
  }

  const craftProbeActor = (didMove || fleeInterruptReason || queuedKioskAction?.itemId || queuedDroneOrder?.itemId)
    ? null
    : { ...updated, inventory: Array.isArray(updated.inventory) ? [...updated.inventory] : [], _itemKeyById: itemKeyById };
  const craftPreview = craftProbeActor
    ? tryAutoCraftFromInventory(craftProbeActor, craftables, itemNameById, itemMetaById, nextDay, phaseIdxNow, ruleset)
    : null;
  const suppressEarlyRouteHunt = currentRouteNeedsSearch && !craftPreview?.changed && !upgradeNeed?.farmCredits;

  const queueScoredCandidates = (() => {
    if (didMove || fleeInterruptReason) return [];
    const lowHpRatio = Math.max(0, Math.min(1, Number(updated?.hp || 0) / Math.max(1, Number(updated?.maxHp || 100))));
    const simCredits = Math.max(0, Number(updated?.simCredits || 0));
    const farmCreditsBias = upgradeNeed?.farmCredits ? 10 : 0;
    const spendSurplusBias = upgradeNeed?.spendSurplus ? Math.min(18, 6 + Math.floor(simCredits / 250)) : 0;
    const legendBias = upgradeNeed?.wantLegend ? 6 : 0;
    const transBias = upgradeNeed?.wantTrans ? 8 : 0;
    const scoreRows = [];

    if (queuedKioskAction?.itemId && queuedKioskAction?.item) {
      const kioskTypeMap = { buy: 'kioskBuy', exchange: 'kioskExchange', sell: 'kioskSell' };
      const itemId = String(queuedKioskAction?.itemId || '');
      const matchesGoal = goalMissingSet.has(itemId) || (goalTargetId && goalTargetId === itemId);
      const kind = String(queuedKioskAction?.kind || 'buy');
      const isSell = kind === 'sell';
      const score =
        (isSell ? (18 + farmCreditsBias + Math.max(0, simCredits >= 300 ? 6 : 0)) : 44 + spendSurplusBias)
        + (matchesGoal ? 26 : 0)
        + (isSell ? 0 : legendBias + transBias)
        + (kind === 'exchange' ? 6 : 0)
        - (lowHpRatio <= 0.28 ? 5 : 0);
      scoreRows.push({
        type: kioskTypeMap[kind] || 'kioskBuy',
        zoneId: String(updated?.zoneId || ''),
        itemId,
        etaSec: 1,
        phaseIdx: Number(phaseIdxNow || 0),
        score,
        label: `${kioskTypeMap[kind] || 'kioskBuy'}:${String(queuedKioskAction?.item?.name || itemNameById?.[itemId] || itemId || '')}`,
        priorityNote: [matchesGoal ? 'goal' : '', kind === 'exchange' ? 'exchange' : '', isSell ? 'sell' : ''].filter(Boolean).join('+'),
      });
    }

    if (queuedDroneOrder?.itemId) {
      const itemId = String(queuedDroneOrder?.itemId || '');
      const matchesGoal = goalMissingSet.has(itemId) || (goalTargetId && goalTargetId === itemId);
      const matchesRouteDrone = routeDroneNeedIds.has(itemId);
      const score = 40 + spendSurplusBias + (matchesGoal ? 28 : 0) + (matchesRouteDrone ? 36 : 0) + legendBias + transBias - (simCredits < 40 ? 10 : 0) - (lowHpRatio <= 0.28 ? 4 : 0);
      scoreRows.push({
        type: 'droneOrder',
        zoneId: String(updated?.zoneId || ''),
        itemId,
        etaSec: 1,
        phaseIdx: Number(phaseIdxNow || 0),
        score,
        label: `drone:${String(queuedDroneOrder?.item?.name || itemNameById?.[itemId] || itemId || '')}`,
        priorityNote: [matchesRouteDrone ? 'route_drone' : '', matchesGoal ? 'goal' : ''].filter(Boolean).join('+'),
      });
    }

    if (craftPreview?.changed) {
      const itemId = String(craftPreview?.craftedId || '');
      const craftedTier = Math.max(1, Number(craftPreview?.craftedTier || itemMetaById?.[itemId]?.tier || 1));
      const matchesGoal = goalTargetId === itemId || goalMissingSet.has(itemId);
      const score = 58 + craftedTier * 6 + (matchesGoal ? 24 : 0) + legendBias + transBias;
      scoreRows.push({
        type: 'craft',
        zoneId: String(updated?.zoneId || ''),
        itemId,
        etaSec: 1,
        phaseIdx: Number(phaseIdxNow || 0),
        score,
        label: `craft:${String(craftPreview?.craftedName || itemNameById?.[itemId] || itemId || '')}`,
        priorityNote: `${matchesGoal ? 'goal+' : ''}tier${craftedTier}`,
      });
    }

    if (suppressEarlyRouteHunt) {
      scoreRows.push({
        type: 'routeFarm',
        zoneId: String(updated?.zoneId || ''),
        etaSec: 1,
        phaseIdx: Number(phaseIdxNow || 0),
        score: 34 + (fallbackRouteItemIds.length ? 4 : 0) + (lowHpRatio <= 0.35 ? 2 : 0),
        label: 'routeFarm',
        priorityNote: currentRouteItemIds.length ? 'early_route+materials' : 'early_route+fallback',
      });
    } else {
      scoreRows.push({
        type: 'hunt',
        zoneId: String(updated?.zoneId || ''),
        etaSec: 1,
        phaseIdx: Number(phaseIdxNow || 0),
        score: 24 + farmCreditsBias + (lowHpRatio <= 0.35 ? 6 : 0) + (craftPreview?.changed ? -10 : 0),
        label: 'hunt',
        priorityNote: farmCreditsBias > 0 ? 'credits' : '',
      });
    }

    return scoreRows
      .sort((a, b) => {
        const ds = Number(b?.score || 0) - Number(a?.score || 0);
        if (Math.abs(ds) > 0.001) return ds;
        const pa = ['craft', 'routeFarm', 'kioskBuy', 'kioskExchange', 'droneOrder', 'kioskSell', 'hunt'].indexOf(String(a?.type || ''));
        const pb = ['craft', 'routeFarm', 'kioskBuy', 'kioskExchange', 'droneOrder', 'kioskSell', 'hunt'].indexOf(String(b?.type || ''));
        return pa - pb;
      })
      .slice(0, 5);
  })();

  const queuedAtomicAction = (() => {
    if (didMove) {
      return {
        type: (mustEscape || String(moveReason || '').startsWith('flee:')) ? 'flee' : 'moveTo',
        fromZoneId: String(currentZone || ''),
        toZoneId: String(nextZoneId || currentZone || ''),
        reason: mustEscape ? 'escape' : String(moveReason || 'goal'),
        etaSec: moveEtaSec,
        transport: usedHyperloopMove ? 'hyperloop' : 'walk',
        phaseIdx: Number(phaseIdxNow || 0),
        score: 999,
        objectiveType: moveObjectiveType,
        objectiveSubkind: moveObjectiveSubkind,
        contestPressure: moveContestPressure,
      };
    }
    if (fleeInterruptReason) {
      return {
        type: 'flee',
        fromZoneId: String(currentZone || ''),
        toZoneId: String(nextZoneId || currentZone || ''),
        reason: String(moveReason || `flee:${fleeInterruptReason}`),
        etaSec: moveEtaSec,
        transport: usedHyperloopMove ? 'hyperloop' : 'walk',
        phaseIdx: Number(phaseIdxNow || 0),
        score: 998,
      };
    }
    return queueScoredCandidates[0] || (
      earlyRouteActionActive
        ? { type: 'routeFarm', zoneId: String(updated?.zoneId || ''), etaSec: 1, phaseIdx: Number(phaseIdxNow || 0), score: 1, reason: 'early_route' }
        : { type: 'hunt', zoneId: String(updated?.zoneId || ''), etaSec: 1, phaseIdx: Number(phaseIdxNow || 0), score: 0 }
    );
  })();

  const queuedActionType = String(queuedAtomicAction?.type || 'hunt');
  const queuePreview = [queuedAtomicAction].filter(Boolean).map((act) => {
    const type = String(act?.type || 'hunt');
    const zoneText = getZoneName(act?.toZoneId || act?.zoneId || '');
    const itemText = String(
      (String(act?.itemId || '') && (itemNameById?.[String(act?.itemId || '')] || ''))
      || queuedKioskAction?.item?.name
      || queuedDroneOrder?.item?.name
      || craftPreview?.craftedName
      || ''
    );
    return [type, itemText && `:${itemText}`, zoneText && `@${zoneText}`].filter(Boolean).join('');
  });
  const candidatePreview = [
    didMove ? `${(mustEscape || String(moveReason || '').startsWith('flee:')) ? 'flee' : 'moveTo'}@${getZoneName(nextZoneId || currentZone || '')}` : null,
    (!didMove && fleeInterruptReason) ? `flee:${String(fleeInterruptReason || '')}` : null,
    ...queueScoredCandidates.map((row) => `${String(row?.label || row?.type || '')}[${Number(row?.score || 0).toFixed(1)}]`),
  ].filter(Boolean);
  const blockedReasons = [
    (didMove && (queuedKioskAction?.itemId || queuedDroneOrder?.itemId || craftPreview?.changed)) ? 'movement_locked' : null,
    (fleeInterruptReason && (queuedKioskAction?.itemId || queuedDroneOrder?.itemId || craftPreview?.changed)) ? `flee_interrupt:${String(fleeInterruptReason || '')}` : null,
    (!didMove && !fleeInterruptReason && !queuedKioskAction?.itemId && !queuedDroneOrder?.itemId && craftProbeActor?._craftDebug?.code && craftProbeActor?._craftDebug?.code !== 'crafted')
      ? `craft:${String(craftProbeActor?._craftDebug?.code || '')}`
      : null,
    ...queueScoredCandidates.slice(1).map((row) => `deferred:${String(row?.type || '')}`).slice(0, 2),
  ].filter(Boolean);

  updated.aiActionQueue = [queuedAtomicAction];
  updated.aiCurrentAction = queuedActionType;
  updated.aiActionEtaSec = Number(queuedAtomicAction?.etaSec || 1);
  updated._aiDebug = {
    phaseIdx: Number(phaseIdxNow || 0),
    zoneName: getZoneName(updated?.zoneId || currentZone),
    action: queuedActionType,
    reason: String(queuedAtomicAction?.reason || moveReason || ''),
    targetZoneName: getZoneName(queuedAtomicAction?.toZoneId || holdTarget || ''),
    itemName: String(
      queuedKioskAction?.item?.name
      || queuedDroneOrder?.item?.name
      || craftPreview?.craftedName
      || (craftGoal?.target?.name || '')
    ),
    goalName: String(craftGoal?.target?.name || ''),
    missingNames: (Array.isArray(craftGoal?.missing) ? craftGoal.missing : [])
      .slice(0, 4)
      .map((missing) => String(missing?.name || itemNameById?.[String(missing?.itemId || '')] || missing?.itemId || ''))
      .filter(Boolean),
    queuePreview,
    candidatePreview: candidatePreview.slice(0, 5),
    candidateScores: queueScoredCandidates.slice(0, 4).map((row) => `${String(row?.type || '')}:${Number(row?.score || 0).toFixed(1)}${row?.priorityNote ? `(${String(row.priorityNote)})` : ''}`),
    blockedReasons: blockedReasons.slice(0, 3),
    objectiveType: String(queuedAtomicAction?.objectiveType || moveObjectiveType || ''),
    objectiveSubkind: String(queuedAtomicAction?.objectiveSubkind || moveObjectiveSubkind || ''),
    contestPressure: Math.max(0, Number(queuedAtomicAction?.contestPressure || moveContestPressure || 0)),
    fleeReason: String(fleeInterruptReason || ''),
    recovering: !!recovering,
    credits: Math.max(0, Number(updated?.simCredits || 0)),
    wantLegend: !!upgradeNeed?.wantLegend,
    wantTrans: !!upgradeNeed?.wantTrans,
    farmCredits: !!upgradeNeed?.farmCredits,
    spendSurplus: !!upgradeNeed?.spendSurplus,
  };

  if (blockedReasons.length || ['flee', 'routeFarm', 'kioskBuy', 'kioskExchange', 'kioskSell', 'droneOrder', 'craft'].includes(queuedActionType)) {
    emitQueueRunEvent(updated, {
      zoneId: String(updated?.zoneId || currentZone || ''),
      chosen: queuedActionType,
      blockedReasons,
      candidates: candidatePreview.slice(0, 5),
      candidateScores: queueScoredCandidates,
      candidateCount: candidatePreview.length,
      reason: String(queuedAtomicAction?.reason || moveReason || ''),
      objectiveType: String(queuedAtomicAction?.objectiveType || moveObjectiveType || ''),
      objectiveSubkind: String(queuedAtomicAction?.objectiveSubkind || moveObjectiveSubkind || ''),
      contestPressure: Math.max(0, Number(queuedAtomicAction?.contestPressure || moveContestPressure || 0)),
    }, atNow());
  }

  return {
    actor: updated,
    blockedReasons,
    candidatePreview,
    craftPreview,
    craftProbeActor,
    queuePreview,
    queueScoredCandidates,
    queuedActionType,
    queuedAtomicAction,
    queuedDroneOrder,
    queuedKioskAction,
    suppressEarlyRouteHunt,
  };
}
