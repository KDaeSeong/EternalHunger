import { normalizeWeaponType } from '../../../utils/equipmentCatalog';
import {
  compactIO,
  tierLabelKo,
} from './simulationCommon';
import { getActorPerkEffects, perkNumber } from './perkRuntime';
import {
  addItemToInventory,
  canReceiveItem,
  consumeIngredientsFromInv,
  getInvItemId,
  inferEquipSlot,
  inferItemCategory,
  invQty,
} from './inventoryRules';
import { ensureEquipped } from './survivorRuntime';
import {
  applyEquipTier,
  buildCraftDebugInfo,
  computeCraftTierFromIngredients,
  pickBestEquipBySlot,
  pickGoalLoadoutBySlot,
} from './craftRuntime';
import { clampGearTier } from './gearCatalogRuntime';
import { autoEquipBest } from './gearFallbackRuntime';

export function tryAutoCraftFromInventory(actor, craftables, itemNameById, itemMetaById, day, phaseIdxNow, ruleset) {
  if (!actor || typeof actor !== 'object') return null;
  if (Number(actor?._invCraftPhaseIdx ?? -9999) === Number(phaseIdxNow || 0)) return null;

  const inv0 = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const actorWNorm = normalizeWeaponType(String(actor?.weaponType || '').trim());
  const perkFx = getActorPerkEffects(actor);
  const goalWeightBonus = Math.max(0, perkNumber(perkFx.goalWeightPlus || 0));
  const craftBias = Math.max(0, perkNumber(perkFx.craftChancePlus || 0));

  const itemKeyById = (actor?._itemKeyById && typeof actor._itemKeyById === 'object') ? actor._itemKeyById : {};
  const goalBySlot = pickGoalLoadoutBySlot(actor);
  const goalKeys = new Set(Object.values(goalBySlot).map((value) => String(value || '').trim()).filter(Boolean));
  const keyOfId = (id) => String(itemKeyById?.[String(id || '')] || '').trim();

  const candidates = (Array.isArray(craftables) ? craftables : [])
    .filter((item) => Array.isArray(item?.recipe?.ingredients) && item.recipe.ingredients.length > 0)
    .filter((item) => {
      const ingredients = compactIO(item?.recipe?.ingredients || []);
      if (!ingredients.length) return false;
      return ingredients.every((ingredient) => invQty(inv0, ingredient.itemId) >= Number(ingredient.qty || 1));
    })
    .filter((item) => {
      const category = inferItemCategory(item);
      if (category !== 'equipment') return true;
      const slot = String(item?.equipSlot || inferEquipSlot(item) || '').toLowerCase();
      if (slot === 'weapon') {
        const weaponType = String(item?.weaponType || '').toLowerCase();
        if (weaponType && actorWNorm && weaponType !== actorWNorm) return false;
      }

      const curBest = slot ? pickBestEquipBySlot(inv0, slot) : null;
      const curTier = curBest ? clampGearTier(Number(curBest?.tier || 1)) : 0;
      const targetTier = clampGearTier(Number(item?.tier || 1));

      const wantKey = String(goalBySlot?.[slot] || '').trim();
      const candidateKey = String(item?.itemKey || item?.externalId || '').trim();
      const wantGoal = !!(wantKey && candidateKey && wantKey === candidateKey);
      if (wantGoal) {
        const equippedId = String(ensureEquipped(actor)?.[slot] || '');
        const equippedKey = equippedId ? keyOfId(equippedId) : '';
        if (equippedKey && equippedKey === candidateKey) return false;
        if (inv0.some((entry) => String(getInvItemId(entry)) === String(item?._id))) return false;
        return true;
      }

      return targetTier > curTier;
    })
    .sort((a, b) => {
      const keyA = String(a?.itemKey || a?.externalId || '').trim();
      const keyB = String(b?.itemKey || b?.externalId || '').trim();
      const goalA = (goalKeys.size > 0 && keyA && goalKeys.has(keyA)) ? 1 : 0;
      const goalB = (goalKeys.size > 0 && keyB && goalKeys.has(keyB)) ? 1 : 0;
      if (goalB !== goalA) return goalB - goalA;

      const perkScoreA = (goalA ? (goalWeightBonus * 100) : 0) + (Number(a?.tier || 1) * craftBias * 4);
      const perkScoreB = (goalB ? (goalWeightBonus * 100) : 0) + (Number(b?.tier || 1) * craftBias * 4);
      if (perkScoreB !== perkScoreA) return perkScoreB - perkScoreA;

      const equipA = inferItemCategory(a) === 'equipment' ? 1 : 0;
      const equipB = inferItemCategory(b) === 'equipment' ? 1 : 0;
      if (equipB !== equipA) return equipB - equipA;
      return (Number(b?.tier || 1) - Number(a?.tier || 1)) || String(a?.name || '').localeCompare(String(b?.name || ''));
    });

  for (const target of candidates) {
    const ingredients = compactIO(target?.recipe?.ingredients || []);
    const category = inferItemCategory(target);
    const craftTier = (category === 'equipment')
      ? clampGearTier(Number(target?.tier || computeCraftTierFromIngredients(ingredients, itemMetaById, itemNameById) || 1))
      : clampGearTier(target?.tier || 1);
    const craftedItem0 = (category === 'equipment') ? applyEquipTier(target, craftTier) : target;

    let craftedItem = craftedItem0;
    if (category === 'equipment') {
      const slot = String(target?.equipSlot || inferEquipSlot(target) || '').toLowerCase();
      const wantKey = String(goalBySlot?.[slot] || '').trim();
      const candidateKey = String(target?.itemKey || target?.externalId || '').trim();
      if (wantKey && candidateKey && wantKey === candidateKey) {
        craftedItem = { ...craftedItem0, _forceReplaceSameTier: true };
      }
    }

    if (!canReceiveItem(inv0, craftedItem, craftedItem?._id, 1, ruleset)) continue;

    let inv = consumeIngredientsFromInv(inv0, ingredients);
    inv = addItemToInventory(inv, craftedItem, craftedItem?._id, 1, day, ruleset);
    const meta = inv?._lastAdd;
    const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
    if (got <= 0) continue;

    actor.inventory = inv;
    autoEquipBest(actor, itemMetaById);
    actor._invCraftPhaseIdx = Number(phaseIdxNow || 0);

    const ingredientText = ingredients
      .map((ingredient) => `${itemNameById?.[String(ingredient.itemId)] || String(ingredient.itemId)} x${ingredient.qty}`)
      .join(' + ');
    const tierText = (category === 'equipment') ? ` (${tierLabelKo(craftTier)})` : '';
    actor._craftDebug = {
      code: 'crafted',
      targetName: String(craftedItem?.name || ''),
      missing: [],
      phaseIdx: Number(phaseIdxNow || 0),
      text: `${craftedItem?.name || '아이템'} 제작 완료`,
    };
    return {
      changed: true,
      craftedId: String(craftedItem?._id || ''),
      craftedTier: Number(craftTier || craftedItem?.tier || 1),
      craftedName: String(craftedItem?.name || ''),
      log: `🛠️ [${actor?.name}] 인벤 조합: ${ingredientText} → ${craftedItem?.name || '아이템'}${tierText} x1`,
    };
  }

  actor._invCraftPhaseIdx = Number(phaseIdxNow || 0);
  actor._craftDebug = {
    ...buildCraftDebugInfo(actor, craftables, itemNameById, ruleset),
    phaseIdx: Number(phaseIdxNow || 0),
  };
  return null;
}
