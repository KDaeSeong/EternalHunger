import { tryAutoCraftFromInventory } from './gearInventoryCraftRuntime';
import { isAtOrAfterWorldTime } from './worldTime';
import { getInvRules, inferItemCategory, invQty } from './inventoryRules';
import { classifySpecialByName } from './craftRuntime';
import { getValidRecipeIngredients, unavailableGearRecipe } from './gearRecipeGuardRuntime.js';

// Retained for compatibility. Recipe crafting never calls this room fallback.
export function ensureRoomForEquipment(inv, ruleset, itemMetaById, itemNameById) {
  const list = Array.isArray(inv) ? [...inv] : [];
  const rules = getInvRules(ruleset);
  if (list.length < Number(rules.maxSlots || 10)) return list;

  // 장비가 아닌 것(재료/소모품)부터 버리되, 특수 재료는 보존한다.
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i];
    const category = inferItemCategory(item);
    if (category === 'equipment') continue;
    const itemId = String(item?.itemId || item?.id || '');
    const name = String(item?.name || itemNameById?.[itemId] || itemMetaById?.[itemId]?.name || '');
    const specialKind = classifySpecialByName(name);
    if (specialKind) continue;

    const qty = Math.max(1, Number(item?.qty || 1));
    if (qty > 1) list[i] = { ...item, qty: qty - 1 };
    else list.splice(i, 1);
    return list;
  }

  list.pop();
  return list;
}

export function tryImmediateCraftFromSpecial(actor, specialKind, specialItemId, publicItems, itemNameById, itemMetaById, curDay, curPhase, phaseIdxNow, ruleset) {
  const unchanged = (reason) => ({ changed: false, logs: [], pvpBonus: 0, reason });
  if (!actor || !Number.isFinite(Number(actor.hp)) || Number(actor.hp) <= 0) return unchanged('actor_inactive');
  const kind = String(specialKind || '');
  if (!['vf', 'force_core', 'mithril', 'meteor', 'life_tree'].includes(kind)) return unchanged('not_special_material');
  const specialId = String(specialItemId || '');
  if (!specialId || invQty(actor.inventory, specialId) <= 0) return unchanged('special_material_missing');
  if (actor._growthPlan && !actor._growthPlan.openingComplete) return unchanged('opening_growth_pending');

  const targetTier = kind === 'vf' ? 6 : 5;
  const craftRule = ruleset?.equipment?.immediateSpecialCraft || ruleset?.immediateSpecialCraft || {};
  const defaultGate = kind === 'vf' ? { day: 4, timeOfDay: 'day' } : { day: 2, timeOfDay: 'day' };
  const gate = (kind === 'vf' ? craftRule.transGate : craftRule.legendGate) || defaultGate;
  const gateDay = Math.max(1, Number(gate?.day ?? defaultGate.day));
  const gateTimeOfDay = String(gate?.timeOfDay || gate?.phase || defaultGate.timeOfDay);
  if (!isAtOrAfterWorldTime(curDay, curPhase, gateDay, gateTimeOfDay)) return unchanged('before_unlock');

  // Compute limits without resetting actor fields on a failed attempt.
  const dayKey = Math.max(0, Number(curDay || 0));
  const dayCount = Number(actor._specialCraftDay) === dayKey ? Math.max(0, Number(actor._specialCraftDayCount || 0)) : 0;
  const count = Number(actor._specialCraftPhaseIdx) === phaseIdxNow ? Math.max(0, Number(actor._specialCraftCount || 0)) : 0;
  const maxPerDay = Math.max(0, Math.floor(Number(craftRule.perDayMax ?? 1)));
  const maxPerPhase = Math.max(0, Math.floor(Number(craftRule.perPhaseMax ?? 1)));
  if (![dayCount, count, maxPerDay, maxPerPhase].every(Number.isFinite)
    || dayCount >= maxPerDay || count >= maxPerPhase) return unchanged('craft_limit');

  const candidates = (Array.isArray(publicItems) ? publicItems : []).filter((item) =>
    inferItemCategory(item) === 'equipment' && Number(item.tier) === targetTier
    && getValidRecipeIngredients(item)?.some((row) => row.itemId === specialId));
  if (!candidates.length) return unavailableGearRecipe(actor, 'special_recipe_missing',
    `${itemNameById?.[specialId] || specialId}을 사용하는 유효한 T${targetTier} 제작법이 없어 즉시 제작 불가`, specialId);

  const preview = structuredClone(actor);
  const result = tryAutoCraftFromInventory(preview, candidates, itemNameById, itemMetaById, curDay, phaseIdxNow, ruleset);
  if (!result?.changed) return unchanged('recipe_requirements_not_met');
  Object.assign(actor, preview);
  actor._specialCraftDay = dayKey;
  actor._specialCraftDayCount = dayCount + 1;
  actor._specialCraftPhaseIdx = phaseIdxNow;
  actor._specialCraftCount = count + 1;
  return { ...result, logs: [result.log], inventory: actor.inventory, pvpBonus: 0 };
}
