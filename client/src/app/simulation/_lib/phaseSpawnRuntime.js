import { simulationRandom } from '../../../utils/simulationRandom.js';
import { normalizeWeaponType } from '../../../utils/equipmentCatalog';
import {
  START_WEAPON_TYPES,
  addItemToInventory,
  ensureEquipped,
  ensureWorldSpawns,
  findItemByKeywords,
  inferItemCategory,
  listActiveDimensionRifts,
  normalizeInventory,
  pickCatalogEquipmentItem,
} from './simulationEngine';

export function prepareWorldSpawnsForPhase({
  actions = {},
  state = {},
} = {}) {
  const {
    forbiddenIds,
    mapIdNow,
    mapObj,
    matchMode,
    nextDay,
    nextPhase,
    ruleset,
    spawnState,
    zones,
  } = state;
  const {
    addLog = () => {},
    atNow = () => null,
    emitRunEvent = () => {},
  } = actions;

  const spawnResult = ensureWorldSpawns(
    spawnState,
    zones,
    forbiddenIds,
    nextDay,
    nextPhase,
    mapIdNow,
    mapObj?.coreSpawnZones,
    ruleset,
    { matchMode, ...(Object.hasOwn(mapObj || {}, 'mutantWildlifeSpawnZoneId')
      ? { mutantWildlifeSpawnZoneId: mapObj.mutantWildlifeSpawnZoneId } : {}) }
  );
  const nextSpawn = spawnResult.state;
  if (Array.isArray(spawnResult.announcements) && spawnResult.announcements.length) {
    spawnResult.announcements.forEach((message) => addLog(message, 'highlight'));
  }

  try {
    const legendaryCount = (Array.isArray(nextSpawn?.legendaryCrates) ? nextSpawn.legendaryCrates : [])
      .filter((crate) => !crate?.opened)
      .length;
    const cores = (Array.isArray(nextSpawn?.coreNodes) ? nextSpawn.coreNodes : [])
      .filter((node) => !node?.picked);
    const meteor = cores.filter((node) => String(node?.kind) === 'meteor').length;
    const lifeTree = cores.filter((node) => String(node?.kind) === 'life_tree').length;
    const bosses = nextSpawn?.bosses || {};
    const wildlifeTotal = (nextSpawn?.wildlife && typeof nextSpawn.wildlife === 'object')
      ? Object.values(nextSpawn.wildlife).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0)
      : 0;
    emitRunEvent('spawn_state', {
      day: nextDay,
      phase: nextPhase,
      legendary: legendaryCount,
      transcendCrates: (Array.isArray(nextSpawn?.transcendCrates) ? nextSpawn.transcendCrates : []).filter((crate) => !crate?.opened).length,
      foodCrates: (Array.isArray(nextSpawn?.foodCrates) ? nextSpawn.foodCrates : []).filter((crate) => !crate?.opened).length,
      dimensionRifts: listActiveDimensionRifts(nextSpawn).length,
      meteor,
      lifeTree,
      wildlifeTotal,
      alpha: !!bosses?.alpha?.alive,
      omega: !!bosses?.omega?.alive,
      weakline: !!bosses?.weakline?.alive,
    }, atNow());
  } catch {
    // Non-critical diagnostics should not stop the phase.
  }

  return nextSpawn;
}

export function buildStarterLoadoutSurvivorsForPhase({
  actions = {},
  refs = {},
  state = {},
} = {}) {
  const {
    nextDay,
    nextPhase,
    publicItems,
    ruleset,
    survivors,
  } = state;
  const { startStarterLoadoutAppliedRef } = refs;
  const { addLog = () => {} } = actions;

  const shouldApply = nextDay === 1
    && nextPhase === 'morning'
    && !startStarterLoadoutAppliedRef?.current;

  if (!shouldApply) {
    return Array.isArray(survivors) ? survivors : [];
  }

  let weaponCount = 0;
  let shoesCount = 0;
  const phaseSurvivors = (Array.isArray(survivors) ? survivors : []).map((survivor) => {
    const preferredWeaponType = normalizeWeaponType(String(survivor?.weaponType || '').trim());
    const weaponType = preferredWeaponType
      ? preferredWeaponType
      : START_WEAPON_TYPES[Math.floor(simulationRandom() * START_WEAPON_TYPES.length)];
    const normalizedWeaponType = normalizeWeaponType(weaponType);

    const gear = {
      weapon: pickCatalogEquipmentItem(publicItems, {
        slot: 'weapon',
        tier: 1,
        weaponType: normalizedWeaponType,
        allowNearestTier: false,
      }),
      shoes: pickCatalogEquipmentItem(publicItems, {
        slot: 'shoes',
        tier: 1,
        allowNearestTier: false,
      }),
    };

    let inventory = Array.isArray(survivor?.inventory)
      ? survivor.inventory.filter((item) => String(item?.category || inferItemCategory(item)) !== 'equipment')
      : [];
    inventory = normalizeInventory(inventory, ruleset);

    const steak = findItemByKeywords(publicItems, ['스테이크', 'sizzling steak']);
    if (steak?._id) {
      inventory = addItemToInventory(inventory, steak, String(steak._id), 1, nextDay, ruleset);
    }

    const receivedGear = {};
    const starterIssues = [];
    for (const slot of ['weapon', 'shoes']) {
      const item = gear[slot];
      const label = slot === 'weapon' ? `${normalizedWeaponType || '선택 무기'} T1` : '신발 T1';
      if (!item?._id) {
        starterIssues.push({ slot, reason: 'catalog_item_missing' });
        addLog(`⚠️ [${survivor.name}] 시작 ${label} 항목 누락 — 생성 장비나 상위 장비로 대체하지 않습니다.`, 'system');
        continue;
      }
      inventory = addItemToInventory(inventory, item, String(item._id), 1, nextDay, ruleset);
      if (inventory?._lastAdd?.acceptedQty === 1) {
        receivedGear[slot] = String(item._id);
        if (slot === 'weapon') weaponCount += 1;
        else shoesCount += 1;
      } else {
        starterIssues.push({ slot, reason: 'inventory_rejected' });
        addLog(`⚠️ [${survivor.name}] 시작 ${label} 수령 실패 — 가방 상태 확인 필요`, 'system');
      }
    }

    return {
      ...survivor,
      day1Moves: 0,
      day1HeroDone: false,
      _starterLoadoutIssues: starterIssues,
      inventory,
      equipped: {
        ...(ensureEquipped(survivor) || {}),
        weapon: receivedGear.weapon || null,
        shoes: receivedGear.shoes || null,
        head: null,
        clothes: null,
        arm: null,
      },
    };
  });

  startStarterLoadoutAppliedRef.current = true;
  addLog(`🧰 1일차 낮: 실제 T1 시작 장비 수령 — 무기 ${weaponCount}/${phaseSurvivors.length}명, 신발 ${shoesCount}/${phaseSurvivors.length}명. (이후 제작/루팅으로 성장)`, 'highlight');
  return phaseSurvivors;
}
