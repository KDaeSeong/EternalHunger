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
    { matchMode }
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

  const phaseSurvivors = (Array.isArray(survivors) ? survivors : []).map((survivor) => {
    const preferredWeaponType = normalizeWeaponType(String(survivor?.weaponType || '').trim());
    const weaponType = preferredWeaponType
      ? preferredWeaponType
      : START_WEAPON_TYPES[Math.floor(Math.random() * START_WEAPON_TYPES.length)];
    const normalizedWeaponType = normalizeWeaponType(weaponType);

    const gear = {
      weapon: pickCatalogEquipmentItem(publicItems, {
        slot: 'weapon',
        tier: 1,
        weaponType: normalizedWeaponType,
        allowNearestTier: true,
      }),
      shoes: pickCatalogEquipmentItem(publicItems, {
        slot: 'shoes',
        tier: 1,
        allowNearestTier: true,
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

    if (gear.weapon?._id) {
      inventory = addItemToInventory(inventory, gear.weapon, String(gear.weapon._id), 1, nextDay, ruleset);
    }
    if (gear.shoes?._id) {
      inventory = addItemToInventory(inventory, gear.shoes, String(gear.shoes._id), 1, nextDay, ruleset);
    }

    return {
      ...survivor,
      day1Moves: 0,
      day1HeroDone: false,
      inventory,
      equipped: {
        ...(ensureEquipped(survivor) || {}),
        weapon: gear.weapon?._id ? String(gear.weapon._id) : null,
        shoes: gear.shoes?._id ? String(gear.shoes._id) : null,
        head: null,
        clothes: null,
        arm: null,
      },
    };
  });

  startStarterLoadoutAppliedRef.current = true;
  addLog('🧰 1일차 낮: 실제 아이템 목록에서 시작 무기/신발이 지급되었습니다. (관전형: 제작/루팅으로 성장)', 'highlight');
  return phaseSurvivors;
}
