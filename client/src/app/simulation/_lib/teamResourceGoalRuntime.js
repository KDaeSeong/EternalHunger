import { getGrowthRecipeWork } from './growthPlanRuntime.js';
import { canReceiveItem } from './inventoryRules.js';
import { findSpecialResourceItem } from './specialResourceRuntime.js';
import { markObjectiveTarget } from './aiMoveTargetScoringRuntime.js';

const idOf = (actor) => String(actor._id || actor.id || '');

// A concrete, already spawned recipe ingredient may guide the whole squad.
// Selection does not reserve the world's source, move inventory or award gear.
export function chooseTeamResourceMove({ members = [], spawnState, publicItems = [], ruleset, routeForZone } = {}) {
  const nodes = (spawnState?.coreNodes || []).filter((row) => row?.id && !row.picked
    && ['meteor', 'life_tree'].includes(row.kind));
  if (!nodes.length) return null;
  const routes = new Map(), candidates = [];
  for (const actor of members) {
    const growth = actor._growthPlan;
    if (!growth?.openingComplete || !growth.targetId) continue;
    const target = publicItems.find((item) => String(item._id) === String(growth.targetId));
    if (!target) continue;
    const work = getGrowthRecipeWork(actor, publicItems, target._id);
    if (work.blocked || !work.missing.length) continue;
    for (const node of nodes) {
      const item = findSpecialResourceItem(publicItems, node.kind);
      const need = work.missing.find((row) => row.itemId === String(item?._id) && row.need > 0);
      if (!need || !canReceiveItem(actor.inventory, item, item._id, 1, ruleset)) continue;
      if (!routes.has(node.zoneId)) routes.set(node.zoneId, routeForZone(node.zoneId));
      const route = routes.get(node.zoneId);
      if (!route) continue;
      candidates.push({ actor, target, item, need, node, distance: route.distance,
        completesRecipe: work.missing.length === 1 && need.need === 1 && work.plannedCredits <= work.availableCredits });
    }
  }
  candidates.sort((a, b) => Number(b.completesRecipe) - Number(a.completesRecipe) || a.distance - b.distance
    || Number(a.actor.teamSlot || 99) - Number(b.actor.teamSlot || 99)
    || idOf(a.actor).localeCompare(idOf(b.actor)) || String(a.node.id).localeCompare(String(b.node.id)));
  const best = candidates[0];
  if (!best) return null;
  const result = { targets: [String(best.node.zoneId)], reason: 'team_growth_resource',
    objectiveSourceIds: [String(best.node.id)],
    beneficiary: { who: idOf(best.actor), name: String(best.actor.name || idOf(best.actor)),
      targetItemId: String(best.target._id), targetItemName: String(best.target.name || best.target._id),
      materialId: String(best.item._id), materialName: String(best.item.name || best.item._id) } };
  return markObjectiveTarget(result, best.actor, 'natural_core', best.node.kind);
}
