import { normalizeWeaponType } from '../../../utils/equipmentCatalog';
import {
  clampTier4,
  compactIO,
  tierLabelKo,
} from './simulationCommon';
import {
  addItemToInventory,
  canReceiveItem,
  consumeIngredientsFromInv,
  inferEquipSlot,
  inferItemCategory,
  invQty,
} from './inventoryRules';
import {
  normalizePerkEffects,
  perkNumber,
} from './perkRuntime';

function clampGearTier(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(6, Math.floor(n)));
}

export function classifySpecialByName(name) {
  const nm = String(name || '').toLowerCase();
  if (!nm) return '';
  if ((nm.includes('vf') && (nm.includes('혈액') || nm.includes('샘플') || nm.includes('sample'))) || nm.includes('blood sample')) return 'vf';
  if (nm.includes('운석') || nm.includes('meteor')) return 'meteor';
  if ((nm.includes('생명') && nm.includes('나무')) || nm.includes('tree of life') || nm.includes('life tree')) return 'life_tree';
  if (nm.includes('미스릴') || nm.includes('mithril')) return 'mithril';
  if ((nm.includes('포스') && nm.includes('코어')) || nm.includes('force core') || nm.includes('forcecore')) return 'force_core';
  return '';
}

export function isSpecialCoreKind(kind) {
  return kind === 'meteor' || kind === 'life_tree' || kind === 'mithril' || kind === 'force_core';
}

export function computeCraftTierFromIngredients(ingredients, itemMetaById, itemNameById) {
  const ings = Array.isArray(ingredients) ? ingredients : [];

  let hasVf = false;
  let hasLegendaryMat = false;
  let hasEquip = false;
  let maxEquipTier = 0;
  let lowMatCount = 0;

  for (const x of ings) {
    const id = String(x?.itemId || '');
    if (!id) continue;
    const qty = Math.max(1, Number(x?.qty || 1));

    const meta = (itemMetaById && itemMetaById[id]) ? itemMetaById[id] : null;
    const name = String(meta?.name || itemNameById?.[id] || '');
    const kind = classifySpecialByName(name);

    if (kind === 'vf') hasVf = true;
    if (isSpecialCoreKind(kind)) hasLegendaryMat = true;

    const pseudoItem = { name, type: meta?.type, tags: meta?.tags, tier: meta?.tier };
    const cat = inferItemCategory(pseudoItem);
    if (cat === 'equipment') {
      hasEquip = true;
      maxEquipTier = Math.max(maxEquipTier, clampGearTier(meta?.tier || pseudoItem?.tier || 1));
    } else if (cat === 'material') {
      if (!kind) lowMatCount += qty;
    }
  }

  if (hasVf) return 6;
  if (hasLegendaryMat) return 5;
  if (hasEquip && lowMatCount >= 1) return maxEquipTier >= 3 ? 4 : 3;
  if (!hasEquip && lowMatCount >= 2) return 1;
  return clampGearTier(Math.max(1, maxEquipTier || 1));
}

export function applyEquipTier(item, tier) {
  if (!item) return item;
  const t = clampGearTier(tier);
  return { ...item, tier: t, rarity: tierLabelKo(t) };
}

export function isItemInMapCrates(mapObj, itemId) {
  const id = String(itemId || '');
  if (!id) return false;
  const crates = Array.isArray(mapObj?.itemCrates) ? mapObj.itemCrates : [];
  for (const c of crates) {
    const lt = Array.isArray(c?.lootTable) ? c.lootTable : [];
    if (lt.some((e) => String(e?.itemId || '') === id)) return true;
  }
  return false;
}

export function normalizeGoalTier() {
  return 6;
}

export function pickGoalLoadoutBySlot(actor) {
  const g = actor?.goalLoadouts && typeof actor.goalLoadouts === 'object' ? actor.goalLoadouts : {};
  const b = g.transcend || null;
  if (!b || typeof b !== 'object') return { weapon: '', head: '', clothes: '', arm: '', shoes: '' };
  return {
    weapon: String(b.weaponKey || '').trim(),
    head: String(b.headKey || '').trim(),
    clothes: String(b.clothesKey || '').trim(),
    arm: String(b.armKey || '').trim(),
    shoes: String(b.shoesKey || '').trim(),
  };
}

export function pickGoalLoadoutKeys(actor) {
  const b = pickGoalLoadoutBySlot(actor);
  return [b.weapon, b.head, b.clothes, b.arm, b.shoes].filter(Boolean);
}

export function getOneSpecialShortMissing(craftGoal) {
  const miss = Array.isArray(craftGoal?.missing) ? craftGoal.missing : [];
  const tier = Number(craftGoal?.tier || craftGoal?.target?.tier || 0);
  if (miss.length !== 1 || tier < 5) return null;
  const m = miss[0] || null;
  const key = String(m?.special || classifySpecialByName(m?.name) || '');
  if (!key || (!isSpecialCoreKind(key) && key !== 'vf')) return null;
  return { ...m, special: key, targetTier: tier, targetName: String(craftGoal?.target?.name || '') };
}

export function buildCraftGoal(inventory, craftables, itemNameById, opts) {
  const list = Array.isArray(craftables) ? craftables : [];
  if (!list.length) return null;

  const goalTier = normalizeGoalTier(opts?.goalTier ?? 6);
  const goalKeysRaw = opts?.goalItemKeys instanceof Set ? [...opts.goalItemKeys] : (Array.isArray(opts?.goalItemKeys) ? opts.goalItemKeys : []);
  const goalKeys = new Set(goalKeysRaw.map((x) => String(x || '').trim()).filter(Boolean));
  const perkFx = normalizePerkEffects(opts?.perkEffects);
  const goalWeightBonus = Math.max(0, perkNumber(perkFx.goalWeightPlus || 0));
  const craftBias = Math.max(0, perkNumber(perkFx.craftChancePlus || 0));

  let best = null;

  for (const it of list) {
    const tier = Number(it?.tier || 1);
    if (tier > goalTier) continue;

    const ings = compactIO(it?.recipe?.ingredients || []);
    if (!ings.length) continue;

    let haveSlots = 0;
    const missing = [];

    for (const ing of ings) {
      const id = String(ing?.itemId || '');
      const need = Math.max(1, Number(ing?.qty || 1));
      if (!id) continue;

      const haveQty = invQty(inventory, id);
      if (haveQty >= need) haveSlots += 1;
      else {
        const nm = itemNameById?.[id] || '';
        missing.push({
          itemId: id,
          need,
          have: haveQty,
          name: nm,
          special: classifySpecialByName(nm),
        });
      }
    }

    const k = String(it?.itemKey || it?.externalId || '').trim();
    const isGoal = goalKeys.size > 0 && k && goalKeys.has(k);

    if (haveSlots <= 0 && !isGoal) continue;
    if (missing.length > 3) continue;

    const ratio = haveSlots / Math.max(1, ings.length);
    let score = tier * 100 + ratio * (25 + craftBias * 6) - missing.length * 8;

    const oneSpecialShort = (missing.length === 1) && (tier >= 5) && (() => {
      const mk = String(missing?.[0]?.special || classifySpecialByName(missing?.[0]?.name) || '');
      return mk && (isSpecialCoreKind(mk) || mk === 'vf');
    })();

    if (oneSpecialShort) score += (tier >= 6 ? 900 : 700);

    if (goalKeys.size > 0) {
      score += isGoal ? (3000 + goalWeightBonus * 600) : -20;
      if (isGoal && oneSpecialShort) score += 500;
    }

    if (!best || score > best.score) {
      best = {
        score,
        target: it,
        tier,
        missing,
        haveSlots,
        totalSlots: ings.length,
      };
    }
  }

  return best;
}

export function pickBestEquipBySlot(inventory, slot) {
  const s = String(slot || '').toLowerCase();
  const list = Array.isArray(inventory) ? inventory : [];
  const cand = list.filter((x) => String(x?.equipSlot || inferEquipSlot(x) || '').toLowerCase() === s);
  if (!cand.length) return null;
  cand.sort((a, b) => clampGearTier(Number(b?.tier || 1)) - clampGearTier(Number(a?.tier || 1)));
  return cand[0] || null;
}

export function tryAutoCraftFromLoot(inventory, lootedItemId, craftables, itemNameById, itemMetaById, day, ruleset, opts = {}) {
  const lootId = String(lootedItemId || '');
  if (!lootId) return null;

  const goalKeys = new Set(
    (Array.isArray(opts?.goalItemKeys) ? opts.goalItemKeys : [])
      .map((key) => String(key || '').trim())
      .filter(Boolean)
  );
  const scoreCandidate = (it) => {
    const cat = inferItemCategory(it);
    const key = String(it?.itemKey || it?.externalId || '').trim();
    const isGoal = key && goalKeys.has(key);
    const tier = clampGearTier(it?.tier || 1);
    const ingredients = compactIO(it?.recipe?.ingredients || []);
    return (
      (isGoal ? 10000 : 0) +
      (cat === 'equipment' ? 800 : (cat === 'consumable' ? -250 : 0)) +
      tier * 90 -
      ingredients.length * 4
    );
  };

  const candidates = (Array.isArray(craftables) ? craftables : [])
    .filter((it) => Array.isArray(it?.recipe?.ingredients) && it.recipe.ingredients.some((ing) => String(ing?.itemId) === lootId))
    .sort((a, b) => {
      const ds = scoreCandidate(b) - scoreCandidate(a);
      if (Math.abs(ds) > 0.001) return ds;
      return (Number(a.tier || 1) - Number(b.tier || 1)) || String(a.name).localeCompare(String(b.name));
    });

  const chance = (Number(day || 0) === 1) ? 0.75 : 0.35;
  if (!candidates.length || Math.random() >= chance) return null;

  for (const target of candidates) {
    const ings = compactIO(target?.recipe?.ingredients || []);
    const ok = ings.length > 0 && ings.every((ing) => invQty(inventory, ing.itemId) >= Number(ing.qty || 1));
    if (!ok) continue;

    const cat = inferItemCategory(target);
    const craftTier = (cat === 'equipment')
      ? computeCraftTierFromIngredients(ings, itemMetaById, itemNameById)
      : clampTier4(target?.tier || 1);

    const craftedItem = (cat === 'equipment') ? applyEquipTier(target, craftTier) : target;

    if (!canReceiveItem(inventory, craftedItem, craftedItem?._id, 1, ruleset)) continue;

    const afterConsume = consumeIngredientsFromInv(inventory, ings);
    const afterAdd = addItemToInventory(afterConsume, craftedItem, craftedItem?._id, 1, day, ruleset);

    const ingText = ings.map((x) => `${itemNameById?.[String(x.itemId)] || String(x.itemId)} x${x.qty}`).join(' + ');
    const tierText = (cat === 'equipment') ? ` (${tierLabelKo(craftTier)})` : '';
    return { inventory: afterAdd, craftedId: String(craftedItem?._id || ''), craftedTier: Number(craftTier || craftedItem?.tier || 1), craftedName: String(craftedItem?.name || ''), log: `🛠️ 조합: ${ingText} → ${craftedItem?.name || '아이템'}${tierText} x1` };
  }
  return null;
}

export function buildCraftDebugInfo(actor, craftables, itemNameById, ruleset) {
  const inv0 = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const actorWNorm = normalizeWeaponType(String(actor?.weaponType || '').trim());
  const withRecipe = (Array.isArray(craftables) ? craftables : [])
    .filter((it) => Array.isArray(it?.recipe?.ingredients) && it.recipe.ingredients.length > 0);
  if (!withRecipe.length) return { code: 'recipe_none', text: '레시피가 있는 제작 대상이 없습니다.' };

  const goalBySlot = pickGoalLoadoutBySlot(actor);
  let bestTarget = null;
  let bestMissing = [];
  let bestScore = -1;
  let weaponMismatch = 0;
  let tierBlocked = 0;
  let receiveBlocked = 0;
  let readyCount = 0;

  for (const it of withRecipe) {
    const ings = compactIO(it?.recipe?.ingredients || []);
    const missing = [];
    let have = 0;
    for (const ing of ings) {
      const need = Number(ing?.qty || 1);
      const got = invQty(inv0, ing?.itemId);
      if (got >= need) have += 1;
      else missing.push(`${itemNameById?.[String(ing?.itemId || '')] || String(ing?.itemId || '')} x${Math.max(0, need - got)}`);
    }
    const score = (have * 100) - missing.length;
    if (score > bestScore) {
      bestScore = score;
      bestTarget = it;
      bestMissing = missing;
    }
    if (missing.length > 0) continue;
    readyCount += 1;

    const cat = inferItemCategory(it);
    if (cat === 'equipment') {
      const slot = String(it?.equipSlot || inferEquipSlot(it) || '').toLowerCase();
      if (slot === 'weapon') {
        const w = String(it?.weaponType || '').toLowerCase();
        if (w && actorWNorm && w !== actorWNorm) {
          weaponMismatch += 1;
          continue;
        }
      }
      const curBest = slot ? pickBestEquipBySlot(inv0, slot) : null;
      const curTier = curBest ? clampGearTier(Number(curBest?.tier || 1)) : 0;
      const tgtTier = clampGearTier(Number(it?.tier || 1));
      const wantKey = String(goalBySlot?.[slot] || '').trim();
      const candKey = String(it?.itemKey || it?.externalId || '').trim();
      const wantGoal = !!(wantKey && candKey && wantKey === candKey);
      if (!wantGoal && tgtTier <= curTier) {
        tierBlocked += 1;
        continue;
      }
    }
    if (!canReceiveItem(inv0, it, it?._id, 1, ruleset)) {
      receiveBlocked += 1;
      continue;
    }
  }

  if (readyCount <= 0) {
    const targetName = String(bestTarget?.name || '목표 없음');
    const missText = bestMissing.length > 0 ? ` / 부족: ${bestMissing.slice(0, 3).join(', ')}` : '';
    return { code: 'missing_ing', targetName, missing: bestMissing, text: `${targetName} 제작 재료 부족${missText}` };
  }
  if (weaponMismatch > 0) {
    return { code: 'weapon_mismatch', targetName: String(bestTarget?.name || ''), text: '무기 타입이 맞지 않아 제작 후보에서 제외되었습니다.' };
  }
  if (receiveBlocked > 0) {
    return { code: 'inventory_full', targetName: String(bestTarget?.name || ''), text: '인벤/슬롯 제한으로 결과물을 받을 수 없습니다.' };
  }
  if (tierBlocked > 0) {
    return { code: 'tier_blocked', targetName: String(bestTarget?.name || ''), text: '동일 슬롯에 동급 이상 장비가 있어 제작을 보류했습니다.' };
  }
  return { code: 'no_candidate', targetName: String(bestTarget?.name || ''), text: '제작 가능한 후보를 찾지 못했습니다.' };
}
