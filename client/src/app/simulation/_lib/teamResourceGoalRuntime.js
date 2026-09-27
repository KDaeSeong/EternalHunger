import { getGrowthRecipeWork } from './growthPlanRuntime.js';
import { canReceiveItem, inferItemCategory, markInventoryGoalItem } from './inventoryRules.js';
import { findSpecialResourceItem } from './specialResourceRuntime.js';
import { markObjectiveTarget } from './aiMoveTargetScoringRuntime.js';
import { getGuaranteedBossDrops } from './bossRewardRuntime.js';
import { getBossObjectiveSourceId } from './movementObjectiveRuntime.js';
import { classifySpecialByName } from './craftRuntime.js';
import { getCombatSpaceId, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';

const idOf = (actor) => String(actor._id || actor.id || '');

// A concrete, already spawned recipe ingredient may guide the whole squad.
// Selection does not reserve the world's source, move inventory or award gear.
export function chooseTeamResourceMove({ members = [], spawnState, publicItems = [], ruleset, routeForZone } = {}) {
  const nodes = (spawnState?.coreNodes || []).filter((row) => row?.id && !row.picked
    && ['meteor', 'life_tree'].includes(row.kind));
  const sources = nodes.map((node) => ({ ...node, type: 'natural_core',
    drops: [{ item: findSpecialResourceItem(publicItems, node.kind), qty: 1 }] }));
  const retreatRatio = Math.max(0.05, Math.min(0.8, Number(ruleset?.ai?.huntRetreatHpRatio ?? 0.22)));
  const bossReady = members.length >= 2 && members.every((actor) => Number(actor.hp || 0) >
    Math.max(0, Number(ruleset?.ai?.escapeHpBelow || 0), Number(ruleset?.ai?.recoverHpBelow ?? 38))
    && Number(actor.hp || 0) / Math.max(1, Number(actor.maxHp || 1)) > retreatRatio);
  for (const kind of ['alpha', 'omega', 'weakline']) {
    const boss = spawnState?.bosses?.[kind];
    if (!bossReady || !boss?.alive || !boss.zoneId || boss.engagedBy) continue;
    const drops = getGuaranteedBossDrops(kind, publicItems, ruleset)
      .filter(({ item }) => inferItemCategory(item) === 'material' && classifySpecialByName(item.name));
    if (drops.length) sources.push({ type: 'boss', kind, zoneId: boss.zoneId, id: getBossObjectiveSourceId(kind, boss), drops });
  }
  if (!sources.length) return null;
  const routes = new Map(), candidates = [];
  for (const actor of members) {
    if (getCombatSpaceId(actor) !== WORLD_COMBAT_SPACE) continue;
    const growth = actor._growthPlan;
    if (!growth?.openingComplete || !growth.targetId) continue;
    const target = publicItems.find((item) => String(item._id) === String(growth.targetId));
    if (!target) continue;
    const work = getGrowthRecipeWork(actor, publicItems, target._id);
    if (work.blocked || !work.missing.length) continue;
    for (const node of sources) for (const { item, qty } of node.drops) {
      const need = work.missing.find((row) => row.itemId === String(item?._id) && row.need > 0);
      if (!need || !canReceiveItem(actor.inventory, node.type === 'boss' ? markInventoryGoalItem(item, true) : item,
        item._id, Math.min(qty, need.need), ruleset)) continue;
      if (!routes.has(node.zoneId)) routes.set(node.zoneId, routeForZone(node.zoneId));
      const route = routes.get(node.zoneId);
      if (!route) continue;
      candidates.push({ actor, target, item, need, node, distance: route.distance,
        completesRecipe: work.missing.length === 1 && need.need <= qty && work.plannedCredits <= work.availableCredits });
    }
  }
  candidates.sort((a, b) => Number(b.completesRecipe) - Number(a.completesRecipe)
    || Number(a.node.type === 'boss') - Number(b.node.type === 'boss') || a.distance - b.distance
    || Number(a.actor.teamSlot || 99) - Number(b.actor.teamSlot || 99)
    || idOf(a.actor).localeCompare(idOf(b.actor)) || String(a.node.id).localeCompare(String(b.node.id)));
  const best = candidates[0];
  if (!best) return null;
  const result = { targets: [String(best.node.zoneId)], reason: 'team_growth_resource',
    objectiveSourceIds: [String(best.node.id)],
    beneficiary: { who: idOf(best.actor), name: String(best.actor.name || idOf(best.actor)),
      targetItemId: String(best.target._id), targetItemName: String(best.target.name || best.target._id),
      materialId: String(best.item._id), materialName: String(best.item.name || best.item._id) } };
  return markObjectiveTarget(result, best.actor, best.node.type, best.node.kind);
}
