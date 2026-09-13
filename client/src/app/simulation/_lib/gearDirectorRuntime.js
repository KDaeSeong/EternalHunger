import { getValidRecipeIngredients, unavailableGearRecipe } from './gearRecipeGuardRuntime.js';

// Compatibility entry points for existing route callers. Real growth is handled
// by the recipe craft actions; these must never guarantee gear after a time,
// movement count or forceRouteCompletion flag, including incomplete catalogs.
function missingRecipeNotice(actor, publicItems) {
  if (!actor || typeof actor !== 'object') return { changed: false, logs: [] };
  if ((Array.isArray(publicItems) ? publicItems : []).some((item) => getValidRecipeIngredients(item))) {
    return { changed: false, logs: [], reason: 'recipe_growth_managed' };
  }
  return unavailableGearRecipe(actor, 'recipe_catalog_missing', '유효한 제작법이 없어 장비 제작 불가');
}

function day1HeroGearDirector(actor, publicItems) {
  return missingRecipeNotice(actor, publicItems);
}

function lateGameGearDirector(actor, publicItems) {
  return missingRecipeNotice(actor, publicItems);
}

// Keep public imports stable without keeping the obsolete free-gear machinery.
export { invHasSpecialKind, findInvItemIdBySpecialKind, computeLateGameUpgradeNeed } from './gearUpgradeNeedRuntime';
export { tryAutoCraftFromInventory } from './gearInventoryCraftRuntime';
export { getInvId, getInvTier, pickCatalogEquipmentItem } from './gearCatalogRuntime';
export { isLowMaterialInvEntry, countLowMaterials, consumeLowMaterials, autoEquipBest } from './gearFallbackRuntime';
export { ensureRoomForEquipment, tryImmediateCraftFromSpecial } from './gearImmediateSpecialCraftRuntime';
export { day1HeroGearDirector, lateGameGearDirector };
