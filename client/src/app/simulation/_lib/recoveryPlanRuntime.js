import { applyItemEffect } from '../../../utils/itemLogic.js';
import { applyHealingModifier, canActVoluntarilyByStatus, getActiveStatusEffects } from '../../../utils/statusLogic.js';
import { shareCombatSpace } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';
import { canReceiveItem, getInvItemId, inferItemCategory, invQty } from './inventoryRules.js';
import { getGrowthItemZones, getGrowthRecipeWork, markGrowthComponent } from './growthPlanRuntime.js';
import { getFieldResourceQty } from './fieldResourceRuntime.js';
import { areSameTeam } from './teamRuntime.js';
import { isFoodRecoveryItem } from './satietyRuntime.js';
import { prepareCraftTransaction, commitCraftTransaction } from './craftTransactionRuntime.js';
import { getRetreatAvoidZoneId } from './retreatDecisionMemoryRuntime.js';

const healingCatalogs = new WeakMap();
function healingValue(actor, item) {
  if (inferItemCategory(item) !== 'consumable') return 0;
  const effect = applyItemEffect(actor, item);
  if (effect.supported === false || (!effect.explicit && !isFoodRecoveryItem(item))) return 0;
  return applyHealingModifier(actor, effect.recovery)
    + (effect.newEffects || []).reduce((sum, row) => sum + applyHealingModifier(actor, row.recovery)
      * Math.max(0, Number(row.remainingDuration || 0)), 0);
}

// A recovery decision owns no loot, HP or equipment. Recompute from live stock
// each action, and let the usual finite pickup, craft and consumption commit it.
export function buildActorRecoveryPlan(actor, items = [], {
  mapObj, zoneGraph = {}, forbiddenIds = new Set(), phaseSurvivors = [], movementRoster = phaseSurvivors,
  nextSpawn, fieldResources = nextSpawn?.fieldResources, ruleset = {}, excludedZoneIds = [],
} = {}) {
  const hp = Number(actor?.hp), current = String(actor?.zoneId || '');
  if (!actor || !Number.isFinite(hp) || hp <= 0 || isDimensionRiftDefeated(actor)
    || hp > Math.max(0, Number(ruleset.ai?.recoverHpBelow ?? 38))) return null;
  const base = { mode: 'unavailable', reason: 'healing_unavailable', targetId: '', targetName: '',
    targetZoneId: current, nextStep: current, currentZoneItemIds: [], missing: [], readyCraftId: '', blocked: '' };
  if (getActiveStatusEffects(actor).some(row => applyHealingModifier(actor, row.recovery) > 0)) {
    return { ...base, mode: 'wait', reason: 'healing_effect' };
  }
  const cons = ruleset.consumables || {};
  const canUse = cons.enabled !== false && Number.isSafeInteger(Number(cons.maxUsesPerPhase ?? 1))
    && Number(cons.maxUsesPerPhase ?? 1) > 0 && hp < Number(cons.aiUseHpBelow ?? 60);
  const owned = canUse && (actor.inventory || []).find(row => {
    const qty = Number(row.qty ?? 1);
    return Number.isSafeInteger(qty) && qty > 0 && healingValue(actor, row) > 0;
  });
  if (owned) return { ...base, mode: 'wait', reason: 'healing_item', targetId: getInvItemId(owned), targetName: owned.name || '' };

  const blocked = new Set([...forbiddenIds, ...excludedZoneIds]);
  const avoid = getRetreatAvoidZoneId(actor);
  if (avoid) blocked.add(avoid);
  const roster = Array.isArray(movementRoster) ? movementRoster : [];
  for (const other of roster) if (Number(other?.hp) > 0 && !isDimensionRiftDefeated(other)
    && shareCombatSpace(actor, other) && !areSameTeam(actor, other)) blocked.add(String(other.zoneId));
  const routes = new Map([[current, { distance: 0, nextStep: current }]]), frontier = [current];
  for (let index = 0; index < frontier.length; index++) {
    const from = frontier[index], route = routes.get(from);
    for (const raw of zoneGraph[from] || []) {
      const zone = String(raw);
      if (blocked.has(zone) || routes.has(zone)) continue;
      routes.set(zone, { distance: route.distance + 1, nextStep: from === current ? zone : route.nextStep });
      frontier.push(zone);
    }
  }
  const candidates = [];
  if (canUse) {
    if (!healingCatalogs.has(items)) healingCatalogs.set(items, items.filter(item => healingValue({ hp: 1 }, item) > 0));
    for (const item of healingCatalogs.get(items)) {
      if (item.lockedByAdmin === 'deleted' || healingValue(actor, item) <= 0) continue;
      const work = getGrowthRecipeWork(actor, items, item._id, { ruleset, targetIds: [String(item._id)] });
      if (work.blocked || work.plannedCredits > Number(actor.simCredits || 0)) continue;
      const missing = work.missing.map(row => ({ ...row,
        zones: getGrowthItemZones(items.find(entry => String(entry._id) === row.itemId), mapObj, blocked, fieldResources)
          .filter(zone => routes.has(zone)) }));
      if (missing.some(row => row.zones.reduce((sum, zone) => sum + getFieldResourceQty(fieldResources, zone, row.itemId), 0) < row.need)) continue;
      const readyCraftId = work.readyCraftId && prepareCraftTransaction(actor,
        markGrowthComponent(items.find(entry => String(entry._id) === work.readyCraftId), { _growthPlan: work }), 1, ruleset).ok
        ? work.readyCraftId : '';
      const sources = missing.flatMap(row => row.zones).filter(zone => missing.some(row => row.zones.includes(zone)
        && canReceiveItem(actor.inventory, items.find(entry => String(entry._id) === row.itemId), row.itemId, 1, ruleset)));
      const targetZoneId = readyCraftId ? current : sources.sort((a, b) => routes.get(a).distance - routes.get(b).distance || a.localeCompare(b))[0];
      if (!targetZoneId) continue;
      candidates.push({ ...base, ...work, mode: readyCraftId ? 'craft' : 'farm', reason: readyCraftId ? 'recovery_craft' : 'recovery_supply',
        targetId: String(item._id), targetName: item.name || '', targetZoneId, nextStep: routes.get(targetZoneId).nextStep,
        distance: routes.get(targetZoneId).distance, missing, readyCraftId,
        currentZoneItemIds: missing.filter(row => row.zones.includes(current)).map(row => row.itemId) });
    }
  }
  candidates.sort((a, b) => Number(b.mode === 'craft') - Number(a.mode === 'craft') || a.distance - b.distance
    || a.missing.reduce((sum, row) => sum + row.need, 0) - b.missing.reduce((sum, row) => sum + row.need, 0)
    || a.plannedCredits - b.plannedCredits || a.targetId.localeCompare(b.targetId));
  if (candidates.length) return candidates[0];
  const allies = roster.filter(other => other !== actor && String(other?._id) !== String(actor._id) && Number(other?.hp) > 0
    && !isDimensionRiftDefeated(other) && shareCombatSpace(actor, other) && areSameTeam(actor, other)
    && !blocked.has(String(other.zoneId)) && routes.has(String(other.zoneId)))
    .sort((a, b) => routes.get(String(a.zoneId)).distance - routes.get(String(b.zoneId)).distance || String(a._id).localeCompare(String(b._id)));
  if (allies.length) return { ...base, mode: 'regroup', reason: 'recovery_regroup', targetZoneId: String(allies[0].zoneId),
    nextStep: routes.get(String(allies[0].zoneId)).nextStep };
  return base;
}

export function craftActorRecoveryItem(actor, plan, items, day, phaseIdx, ruleset) {
  if (!plan?.readyCraftId || !canActVoluntarilyByStatus(actor)) return null;
  const actionKey = actor._actionCycleKey ?? `phase:${Number(phaseIdx || 0)}`;
  if (actor._invCraftActionKey === actionKey) return null;
  const item = items.find(row => String(row._id) === plan.readyCraftId);
  const prepared = prepareCraftTransaction(actor, markGrowthComponent(item, { _growthPlan: plan }), day, ruleset);
  const result = prepared.ok ? commitCraftTransaction(actor, prepared) : prepared;
  if (!result.ok) return null;
  actor._invCraftActionKey = actionKey;
  actor._invCraftPhaseIdx = Number(phaseIdx || 0);
  return { changed: true, craftedId: String(item._id), craftedName: item.name || '', craftedTier: Number(item.tier || 1),
    craftedQty: result.receipt.qty, receipt: result.receipt,
    log: `🩹 [${actor.name}] 회복용 ${item.name || item._id} x${result.receipt.qty} 제작 · 재료 소비${result.receipt.paidCost ? ` · ${result.receipt.paidCost}Cr 지불` : ''}` };
}
