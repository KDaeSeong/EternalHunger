import { areSameTeam } from './teamRuntime.js';
import { getGrowthRecipeWork } from './growthPlanRuntime.js';
import { canReceiveItem, inferItemCategory, markInventoryGoalItem } from './inventoryRules.js';
import { classifySpecialByName } from './craftRuntime.js';
import { getCombatSpaceId, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';

const idOf = (actor) => String(actor?._id || actor?.id || '');

// Allocate only an earned boss material, using current inventory at settlement.
// No RNG, remote transfers, world claims or changes to the rolled reward pool.
export function chooseBossLootRecipient({ hunter, roster = [], drop, remaining, publicItems = [], ruleset,
  isSoloMatch = false, excluded = new Set() } = {}) {
  if (isSoloMatch || !(Number(hunter?.hp) > 0) || getCombatSpaceId(hunter) !== WORLD_COMBAT_SPACE
    || inferItemCategory(drop?.item) !== 'material' || !classifySpecialByName(drop?.item?.name)) return null;
  const actors = new Map((Array.isArray(roster) ? roster : []).map((actor) => [idOf(actor), actor]));
  actors.set(idOf(hunter), hunter); // A planner's older copy must not replace the live hunter.
  const candidates = [];
  for (const actor of actors.values()) {
    if (!idOf(actor) || excluded.has(idOf(actor)) || !(Number(actor.hp) > 0) || isDimensionRiftDefeated(actor)
      || !areSameTeam(hunter, actor) || getCombatSpaceId(actor) !== WORLD_COMBAT_SPACE
      || String(actor.zoneId || '') !== String(hunter.zoneId || '')) continue;
    const target = publicItems.find((item) => String(item._id) === String(actor._growthPlan?.targetId || ''));
    if (!target) continue;
    const work = getGrowthRecipeWork(actor, publicItems, target._id);
    const need = work.missing.find((row) => row.itemId === String(drop.itemId) && row.need > 0);
    if (work.blocked || !need) continue;
    const qty = Math.min(remaining, need.need);
    if (!canReceiveItem(actor.inventory, markInventoryGoalItem(drop.item, true), drop.itemId, qty, ruleset)) continue;
    candidates.push({ actor, qty, targetItemId: String(target._id), targetItemName: String(target.name || target._id),
      completesRecipe: work.missing.length === 1 && need.need <= remaining && work.plannedCredits <= work.availableCredits });
  }
  candidates.sort((a, b) => Number(b.completesRecipe) - Number(a.completesRecipe)
    || Number(a.actor.teamSlot || 99) - Number(b.actor.teamSlot || 99)
    || idOf(a.actor).localeCompare(idOf(b.actor)));
  return candidates[0] || null;
}
