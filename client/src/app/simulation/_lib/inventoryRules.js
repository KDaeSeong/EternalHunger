import {
  compactIO,
  itemDisplayName,
  safeTags,
  tierLabelKo,
} from './simulationCommon';

export const DEFAULT_INV_RULES = {
  maxSlots: 10,
  stackMax: { material: 3, consumable: 6, equipment: 1 },
};

export function getInvItemId(it) {
  return String(it?.itemId || it?.id || it?._id || '');
}

function clampInventoryTier(value, category = '') {
  const n = Number(value);
  const maxTier = String(category || '').toLowerCase() === 'equipment' ? 6 : 4;
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(maxTier, Math.floor(n)));
}

// 시뮬에서 랜덤 생성된 장비(weapon/armor)를 DB에 저장할 때 사용하는 외부 ID
export function getSimEquipExternalId(it) {
  const id = String(it?.itemId || it?.id || '').trim();
  return id;
}

export function isSimGeneratedEquipment(it) {
  if (!it || typeof it !== 'object') return false;
  const extId = getSimEquipExternalId(it);
  if (!extId) return false;
  if (!extId.startsWith('wpn_') && !extId.startsWith('eq_')) return false;

  const cat = String(it?.category || '').toLowerCase();
  const slot = String(it?.equipSlot || '').toLowerCase();
  const tags = safeTags(it).map((t) => String(t).toLowerCase());
  const hasStats = it?.stats && typeof it.stats === 'object';

  const isEquip = cat === 'equipment' || slot === 'weapon' || tags.includes('equipment') || tags.includes('weapon') || tags.includes('armor');
  return isEquip && hasStats;
}

export function getInvRules(ruleset) {
  const inv = ruleset?.inventory || {};
  return {
    maxSlots: Number(inv.maxSlots || DEFAULT_INV_RULES.maxSlots),
    stackMax: { ...DEFAULT_INV_RULES.stackMax, ...(inv.stackMax || {}) },
  };
}

export function inferItemCategory(it) {
  const tags = safeTags(it);
  const type = String(it?.type || '').toLowerCase();
  const name = itemDisplayName(it);
  const lower = String(name || '').toLowerCase();
  const bandageLike = lower.includes('bandage') || name.includes('붕대');

  if (it && typeof it === 'object') {
    const slot = String(it?.equipSlot || '').trim().toLowerCase();
    if (slot) return 'equipment';
  }

  if (bandageLike) return 'material';

  const isConsumable =
    type === 'food' ||
    type === 'consumable' ||
    tags.includes('food') ||
    tags.includes('healthy') ||
    tags.includes('capsule') ||
    tags.includes('book') ||
    lower.includes('apple') ||
    lower.includes('steak') ||
    name.includes('음식') ||
    name.includes('사과') ||
    name.includes('스테이크') ||
    name.includes('빵') ||
    name.includes('고기') ||
    name.includes('치킨');

  const isEquipment =
    type === 'weapon' ||
    it?.type === '무기' ||
    it?.type === '방어구' ||
    tags.includes('weapon') ||
    tags.includes('armor') ||
    tags.includes('equipment') ||
    tags.includes('equip') ||
    lower.includes('weapon') ||
    name.includes('무기') ||
    name.includes('검') ||
    name.includes('총') ||
    name.includes('창') ||
    name.includes('활') ||
    name.includes('갑옷') ||
    name.includes('헬멧') ||
    name.includes('신발') ||
    name.includes('장갑');

  if (isEquipment) return 'equipment';
  if (isConsumable) return 'consumable';
  return 'material';
}

export function inferEquipSlot(it) {
  const tags = safeTags(it);
  const type = String(it?.type || '').toLowerCase();
  const name = itemDisplayName(it);
  const lower = String(name || '').toLowerCase();

  if (it && typeof it === 'object') {
    const s = String(it?.equipSlot || '').trim().toLowerCase();
    if (s) return s;
  }

  if (type === 'weapon' || it?.type === '무기' || tags.includes('weapon') || lower.includes('weapon') || name.includes('무기') || name.includes('검') || name.includes('총') || name.includes('활') || name.includes('창')) return 'weapon';
  if (tags.includes('head') || lower.includes('helmet') || name.includes('머리') || name.includes('모자') || name.includes('헬멧')) return 'head';
  if (tags.includes('clothes') || tags.includes('body') || name.includes('옷') || name.includes('상의') || name.includes('갑옷') || name.includes('방어복')) return 'clothes';
  if (tags.includes('arm') || lower.includes('glove') || name.includes('팔') || name.includes('장갑') || name.includes('암가드')) return 'arm';
  if (tags.includes('shoes') || lower.includes('boots') || name.includes('신발') || name.includes('부츠')) return 'shoes';
  return '';
}

export function isBandageLikeItem(it) {
  const name = itemDisplayName(it);
  const lower = String(name || '').toLowerCase();
  return lower.includes('bandage') || name.includes('붕대');
}

function hasSpecialInventoryTag(it) {
  const tags = safeTags(it).map((t) => String(t || '').toLowerCase());
  const name = String(itemDisplayName(it) || '').toLowerCase();
  return tags.some((t) => (
    t.includes('legendary_core') ||
    t.includes('meteor') ||
    t.includes('life_tree') ||
    t.includes('mithril') ||
    t.includes('force_core') ||
    t.includes('vf') ||
    t.includes('transcend') ||
    t.includes('tac_skill_module')
  )) || name.includes('meteor') || name.includes('mithril') || name.includes('force core') || name.includes('blood sample');
}

function hasGoalInventoryTag(it) {
  const tags = safeTags(it).map((t) => String(t || '').toLowerCase());
  return it?.goalItem === true || it?._goalItem === true || tags.includes('craft_goal') || tags.includes('route_goal');
}

export function markInventoryGoalItem(item, isGoal = true, tagName = 'craft_goal') {
  if (!isGoal || !item || typeof item !== 'object') return item;
  const tags = safeTags(item).map((t) => String(t || '')).filter(Boolean);
  const tag = String(tagName || 'craft_goal').trim() || 'craft_goal';
  if (!tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())) tags.push(tag);
  return { ...item, tags, goalItem: true };
}

function inventoryItemPriority(it) {
  const category = inferItemCategory(it);
  const tier = clampInventoryTier(it?.tier || 1, category);

  if (category === 'equipment') return 80 + tier * 5;
  if (hasSpecialInventoryTag(it)) return 70 + tier * 5;
  if (hasGoalInventoryTag(it)) return 54 + tier * 5;
  if (category === 'consumable') {
    return 20 + tier * 3;
  }
  return tier * 4;
}

function isAutoDroppableConsumable(entry, invCfg, incomingScore) {
  if (invCfg?.autoDropConsumablesForPriority === false) return false;
  const tier = clampInventoryTier(entry?.tier || 1, 'consumable');
  const maxTier = Math.max(1, Number(invCfg?.autoDropConsumableMaxTier ?? 2));
  const minIncomingScore = Math.max(0, Number(invCfg?.autoDropConsumableMinIncomingScore ?? 50));
  return tier <= maxTier && incomingScore >= minIncomingScore;
}

function findAutoDropIndexForIncoming(list, incoming, ruleset) {
  if (!Array.isArray(list) || !list.length) return -1;
  const invCfg = ruleset?.inventory || {};
  if (invCfg.autoDropLowValue === false) return -1;

  const incomingScore = inventoryItemPriority(incoming);
  const minIncomingScore = Math.max(0, Number(invCfg.autoDropMinIncomingScore ?? 14));
  const scoreMargin = Math.max(0, Number(invCfg.autoDropScoreMargin ?? 8));
  if (incomingScore < minIncomingScore) return -1;

  const candidates = list
    .map((entry, index) => {
      const category = String(entry?.category || inferItemCategory(entry) || 'material');
      const tier = clampInventoryTier(entry?.tier || 1, category);
      const protectedEntry = category === 'equipment' || hasSpecialInventoryTag(entry) || hasGoalInventoryTag(entry) || tier >= 4;
      if (protectedEntry) return null;
      const disposableMaterial = category === 'material' && tier <= 2;
      const disposableConsumable = category === 'consumable' && isAutoDroppableConsumable(entry, invCfg, incomingScore);
      if (!disposableMaterial && !disposableConsumable) return null;

      const score = inventoryItemPriority(entry);
      if (score + scoreMargin > incomingScore) return null;
      return {
        index,
        score,
        qty: Math.max(1, Number(entry?.qty ?? 1)),
        acquiredDay: Number(entry?.acquiredDay ?? 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.score - b.score) || (a.acquiredDay - b.acquiredDay) || (b.qty - a.qty));

  return candidates.length ? candidates[0].index : -1;
}

export function canReceiveItem(inventory, it, itemId, qty, ruleset) {
  const rules = getInvRules(ruleset);
  const list = Array.isArray(inventory) ? inventory : [];
  const key = String(it?._id || itemId || '');
  const want = Math.max(0, Number(qty || 0));
  if (!key || want <= 0) return false;

  const category = inferItemCategory(it);
  const maxStack = Math.max(1, Number(rules.stackMax?.[category] || 1));
  const idx = list.findIndex((x) => String(x?.itemId || x?.id || '') === key);
  if (idx >= 0) {
    const have = Math.max(0, Number(list[idx]?.qty ?? 1));
    return have < maxStack;
  }

  if (category === 'equipment') {
    const slot = inferEquipSlot(it);
    if (slot) {
      const existing = list.find((x) => (String(x?.category || inferItemCategory(x)) === 'equipment') && String(x?.equipSlot || inferEquipSlot(x) || '') === slot);
      if (existing) {
        const cfg = ruleset?.equipment || {};
        const replaceOnlyIfBetter = cfg.replaceOnlyIfBetter !== false;
        const newTier = clampInventoryTier(it?.tier || 1, 'equipment');
        const oldTier = clampInventoryTier(existing?.tier || 1, 'equipment');
        if (replaceOnlyIfBetter) return newTier > oldTier;
        return true;
      }
    }
  }
  return list.length < rules.maxSlots || findAutoDropIndexForIncoming(list, it, ruleset) >= 0;
}

export function normalizeInventory(inventory, ruleset) {
  const rules = getInvRules(ruleset);
  const list = (Array.isArray(inventory) ? inventory : [])
    .map((x, index) => ({ ...x, _normIndex: index }))
    .filter((x) => (x?.itemId || x?.id) && Math.max(0, Number(x?.qty ?? 1)) > 0);

  for (let i = 0; i < list.length; i++) {
    const category = String(list[i]?.category || inferItemCategory(list[i]) || 'material');
    const maxStack = Math.max(1, Number(rules.stackMax?.[category] || 1));
    const q = Math.max(0, Number(list[i]?.qty ?? 1));
    list[i] = {
      ...list[i],
      category,
      equipSlot: category === 'equipment' ? (list[i]?.equipSlot || inferEquipSlot(list[i]) || '') : (list[i]?.equipSlot || ''),
      tier: clampInventoryTier(list[i]?.tier || 1, category),
      qty: Math.min(maxStack, q),
    };
  }

  const equipmentBySlot = new Map();
  const keptNonEquipment = [];
  const isBetterEquipment = (next, prev) => {
    if (!prev) return true;
    const nextTier = clampInventoryTier(next?.tier || 1, 'equipment');
    const prevTier = clampInventoryTier(prev?.tier || 1, 'equipment');
    if (nextTier !== prevTier) return nextTier > prevTier;
    const nextScore = inventoryItemPriority(next);
    const prevScore = inventoryItemPriority(prev);
    if (nextScore !== prevScore) return nextScore > prevScore;
    const nextDay = Number(next?.acquiredDay ?? 0);
    const prevDay = Number(prev?.acquiredDay ?? 0);
    if (nextDay !== prevDay) return nextDay > prevDay;
    return Number(next?._normIndex ?? 0) > Number(prev?._normIndex ?? 0);
  };

  for (const entry of list) {
    const isEq = String(entry?.category || inferItemCategory(entry)) === 'equipment';
    const slot = isEq ? String(entry?.equipSlot || inferEquipSlot(entry) || '') : '';
    if (isEq && slot) {
      const prev = equipmentBySlot.get(slot);
      if (isBetterEquipment(entry, prev)) equipmentBySlot.set(slot, entry);
      continue;
    }
    keptNonEquipment.push(entry);
  }

  let kept = [...keptNonEquipment, ...equipmentBySlot.values()]
    .sort((a, b) => Number(a?._normIndex ?? 0) - Number(b?._normIndex ?? 0));

  if (kept.length > rules.maxSlots) {
    kept = kept
      .map((entry) => ({ entry, score: inventoryItemPriority(entry) }))
      .sort((a, b) => (
        (Number(b.score || 0) - Number(a.score || 0)) ||
        (Number(b.entry?.acquiredDay ?? 0) - Number(a.entry?.acquiredDay ?? 0)) ||
        (Number(b.entry?._normIndex ?? 0) - Number(a.entry?._normIndex ?? 0))
      ))
      .slice(0, Math.max(0, rules.maxSlots))
      .map((row) => row.entry)
      .sort((a, b) => Number(a?._normIndex ?? 0) - Number(b?._normIndex ?? 0));
  }

  return kept.map(({ _normIndex, ...entry }) => entry);
}

export function formatInvRuleState(inventory, ruleset) {
  const rules = getInvRules(ruleset);
  const slots = Array.isArray(inventory) ? inventory.length : 0;
  const cap = rules?.stackMax || {};
  return ` [INV ${slots}/${rules.maxSlots} | 재료${cap.material}/소모${cap.consumable}/장비${cap.equipment}]`;
}

export function formatInvAddNote(meta, want, inventory, ruleset) {
  const reason = String(meta?.reason || '');
  const accepted = Math.max(0, Number(meta?.acceptedQty ?? want ?? 0));
  const dropped = Math.max(0, Number(meta?.droppedQty ?? 0));

  let note = '';
  if (reason === 'equip_replaced') {
    const slot = String(meta?.slot || '');
    const oldName = String(meta?.oldName || '');
    const newName = String(meta?.newName || '');
    const oldTier = Number(meta?.oldTier || 0);
    const newTier = Number(meta?.newTier || 0);
    const head = slot ? `[${slot}]` : '';
    const tOld = oldTier > 0 ? `T${oldTier} ` : '';
    const tNew = newTier > 0 ? `T${newTier} ` : '';
    note = ` (장비 교체${head}: ${tOld}${oldName} → ${tNew}${newName})`;
  } else if (reason === 'auto_dropped') {
    const roomName = String(meta?.roomItemName || meta?.droppedItemName || '');
    const roomQty = Math.max(1, Number(meta?.roomItemQty || meta?.droppedItemQty || 1));
    note = ` (공간 확보: ${roomName || '저가치 재료'}${roomQty > 1 ? ` x${roomQty}` : ''} 버림)`;
  } else if (reason === 'equip_not_better') {
    note = ' (장비 유지: 더 좋은 장비가 아님)';
  } else if (accepted <= 0 && dropped > 0) {
    if (reason === 'equip_slot_full') note = ' (장비 슬롯 가득: 획득 실패)';
    else if (reason === 'inventory_full') note = ' (가방 가득: 획득 실패)';
    else note = ' (획득 실패)';
  } else if (dropped > 0) {
    note = ` (스택/한도 초과 ${dropped}개 버림)`;
  }

  if (!note) return '';
  if (!inventory || !ruleset) return note;
  return `${note}${formatInvRuleState(inventory, ruleset)}`;
}

export function addItemToInventory(inventory, item, itemId, qty, day, ruleset) {
  const rules = getInvRules(ruleset);
  const list = Array.isArray(inventory) ? [...inventory] : [];
  const key = String(item?._id || itemId || '');
  const want = Math.max(0, Number(qty || 0));
  const category = inferItemCategory(item);
  const maxStack = Math.max(1, Number(rules.stackMax?.[category] || 1));
  const equipSlot = category === 'equipment' ? inferEquipSlot(item) : '';

  if (!key || want <= 0) {
    list._lastAdd = { itemId: key, acceptedQty: 0, droppedQty: want, reason: 'invalid' };
    return list;
  }

  const i = list.findIndex((x) => String(x?.itemId || x?.id || '') === key);
  if (i >= 0) {
    const cur = Math.max(0, Number(list[i]?.qty ?? 1));
    const next = Math.min(maxStack, cur + want);
    const accepted = Math.max(0, next - cur);
    const dropped = Math.max(0, (cur + want) - next);
    const nextTier = clampInventoryTier(item?.tier || list[i]?.tier || 1, category);
    list[i] = { ...list[i], qty: next, category, tier: nextTier, ...(category === 'equipment' ? { rarity: tierLabelKo(nextTier) } : {}), ...(equipSlot ? { equipSlot } : {}) };
    list._lastAdd = { itemId: key, acceptedQty: accepted, droppedQty: dropped, reason: dropped > 0 ? 'stack_cap' : '' };
    return list;
  }

  if (category === 'equipment' && equipSlot) {
    const cfg = ruleset?.equipment || {};
    const replaceOnlyIfBetter = cfg.replaceOnlyIfBetter !== false;
    const j = list.findIndex((x) => (String(x?.category || inferItemCategory(x)) === 'equipment') && String(x?.equipSlot || inferEquipSlot(x) || '') === equipSlot);
    if (j >= 0) {
      const oldTier = clampInventoryTier(list[j]?.tier || 1, 'equipment');
      const newTier = clampInventoryTier(item?.tier || 1, 'equipment');
      const forceSameTier = !!item?._forceReplaceSameTier && (newTier === oldTier);
      if (replaceOnlyIfBetter && !(newTier > oldTier) && !forceSameTier) {
        list._lastAdd = { itemId: key, acceptedQty: 0, droppedQty: want, reason: 'equip_not_better' };
        return list;
      }
      const oldName = String(list[j]?.name || itemDisplayName(list[j]) || '');
      const newName = String(item?.name || itemDisplayName(item) || '');
      list.splice(j, 1);
      list._lastAdd = { itemId: key, acceptedQty: 0, droppedQty: 0, reason: 'equip_replaced', slot: equipSlot, oldName, newName, oldTier, newTier };
    }
  }

  let roomMeta = String(list?._lastAdd?.reason || '') === 'equip_replaced' ? { ...list._lastAdd } : null;
  if (!roomMeta && list.length >= rules.maxSlots) {
    const dropIdx = findAutoDropIndexForIncoming(list, item, ruleset);
    if (dropIdx >= 0) {
      const droppedEntry = list[dropIdx];
      list.splice(dropIdx, 1);
      roomMeta = {
        itemId: key,
        acceptedQty: 0,
        droppedQty: 0,
        reason: 'auto_dropped',
        roomItemName: String(droppedEntry?.name || itemDisplayName(droppedEntry) || getInvItemId(droppedEntry) || ''),
        roomItemQty: Math.max(1, Number(droppedEntry?.qty ?? 1)),
      };
    }
  }

  if (!roomMeta && list.length >= rules.maxSlots) {
    list._lastAdd = { itemId: key, acceptedQty: 0, droppedQty: want, reason: 'inventory_full' };
    return list;
  }

  const replacedMeta = roomMeta;

  const accepted = Math.min(maxStack, want);
  const dropped = Math.max(0, want - accepted);
  list.push({
    itemId: item?._id || itemId,
    qty: accepted,
    name: item?.name,
    type: item?.type,
    tags: Array.isArray(item?.tags) ? item.tags : [],
    ...(item?.itemKey ? { itemKey: item.itemKey } : {}),
    ...(item?.externalId ? { externalId: item.externalId } : {}),
    ...(item?.erCode ? { erCode: item.erCode } : {}),
    ...(item?.weaponType ? { weaponType: item.weaponType } : {}),
    ...(item?.itemSubType ? { itemSubType: item.itemSubType } : {}),
    ...(item?.stats && typeof item.stats === 'object' ? { stats: { ...item.stats } } : {}),
    ...(item?.baseCreditValue !== undefined ? { baseCreditValue: item.baseCreditValue } : {}),
    ...(hasGoalInventoryTag(item) ? { goalItem: true } : {}),
    category,
    equipSlot: equipSlot || '',
    tier: clampInventoryTier(item?.tier || 1, category), ...(category === 'equipment' ? { rarity: tierLabelKo(clampInventoryTier(item?.tier || 1, category)) } : {}),
    acquiredDay: Number(day || 0),
  });
  list._lastAdd = replacedMeta
    ? { ...replacedMeta, itemId: key, acceptedQty: accepted, droppedQty: dropped }
    : { itemId: key, acceptedQty: accepted, droppedQty: dropped, reason: dropped > 0 ? 'stack_cap' : '' };
  return list;
}

export function invQty(inventory, itemId) {
  const id = String(itemId || '');
  if (!id) return 0;
  return (Array.isArray(inventory) ? inventory : []).reduce(
    (sum, x) => (String(x?.itemId || x?.id || '') === id ? sum + Math.max(0, Number(x?.qty || 1)) : sum),
    0
  );
}

export function consumeIngredientsFromInv(inventory, ingredients) {
  const need = compactIO(ingredients);
  const list = Array.isArray(inventory) ? [...inventory] : [];
  for (const ing of need) {
    const id = String(ing.itemId || '');
    let remaining = Math.max(0, Number(ing.qty || 1));
    if (!id || remaining <= 0) continue;

    for (let i = 0; i < list.length && remaining > 0; i++) {
      if (String(list[i]?.itemId || list[i]?.id || '') !== id) continue;
      const have = Math.max(0, Number(list[i]?.qty || 1));
      const take = Math.min(have, remaining);
      const next = have - take;
      remaining -= take;
      if (next <= 0) {
        list.splice(i, 1);
        i -= 1;
      } else {
        list[i] = { ...list[i], qty: next };
      }
    }
  }
  return list;
}
