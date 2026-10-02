import { areSameTeam } from './teamRuntime.js';
import { getGrowthRecipeWork } from './growthPlanRuntime.js';
import { getLateGrowthTargets } from './lateGrowthTargetRuntime.js';
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
    const targets = new Map();
    const current = publicItems.find((item) => String(item._id) === String(actor._growthPlan?.targetId || ''));
    if (current) targets.set(String(current._id), current);
    // An earned drop can complete an explicitly chosen later recipe while an
    // earlier goal is blocked. Do not turn every automatic catalogue recipe
    // into a new claim on teammates' loot; validate authored targets normally.
    if (actor._growthPlan?.openingComplete) {
      const authored = new Set(['legend', 'transcend'].flatMap((group) =>
        Object.values(actor.goalLoadouts?.[group] || {}).map((key) => String(key || '').trim()).filter(Boolean)));
      for (const target of getLateGrowthTargets(actor, publicItems).targets) {
        if (authored.has(String(target.itemKey || target.externalId || target._id).trim())
          || authored.has(String(target._id))) targets.set(String(target._id), target);
      }
    }
    for (const [targetRank, target] of [...targets.values()].entries()) {
      const work = getGrowthRecipeWork(actor, publicItems, target._id);
      const need = work.missing.find((row) => row.itemId === String(drop.itemId) && row.need > 0);
      if (work.blocked || !need) continue;
      const qty = Math.min(remaining, need.need);
      if (!canReceiveItem(actor.inventory, markInventoryGoalItem(drop.item, true), drop.itemId, qty, ruleset)) continue;
      candidates.push({ actor, qty, targetRank, targetItemId: String(target._id), targetItemName: String(target.name || target._id),
        completesRecipe: work.missing.length === 1 && need.need <= remaining && work.plannedCredits <= work.availableCredits });
    }
  }
  candidates.sort((a, b) => Number(b.completesRecipe) - Number(a.completesRecipe)
    || Number(a.actor.teamSlot || 99) - Number(b.actor.teamSlot || 99)
    || idOf(a.actor).localeCompare(idOf(b.actor)) || a.targetRank - b.targetRank);
  return candidates[0] || null;
}
