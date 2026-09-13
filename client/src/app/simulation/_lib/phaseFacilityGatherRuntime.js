import { simulationRandom } from '../../../utils/simulationRandom.js';
import {
  addItemToInventory,
  canReceiveItem,
  consumeIngredientsFromInv,
  findItemByKeywords,
  formatInvAddNote,
  invQty,
  uniqStr,
} from './simulationEngine';
import {
  getRegionData,
  getRegionFacilityZoneIds,
} from './lumiaRegionData';
import { gainText } from './runEventRuntime';
import { collectFieldResourceLoot, emitFieldResourcePickup, getFieldResourceQty } from './fieldResourceRuntime';

export function runFacilityGatherPhase({
  actions = {},
  state = {},
} = {}) {
  const {
    actor,
    mapObj,
    nextDay,
    publicItems,
    ruleset,
  } = state;
  const {
    addLog = () => {},
    atNow = () => null,
    emitItemGainIfAny = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
  } = actions;

  const updated = actor || {};
  const fieldResources = state.nextSpawn?.fieldResources;
  try {
    const campfireZones = uniqStr([
      ...(Array.isArray(mapObj?.campfireZoneIds) ? mapObj.campfireZoneIds : []).map(String),
      ...getRegionFacilityZoneIds('campfire', mapObj?.zones),
    ]);
    const waterZones = uniqStr([
      ...(Array.isArray(mapObj?.waterSourceZoneIds) ? mapObj.waterSourceZoneIds : []).map(String),
      ...(Array.isArray(mapObj?.zones) ? mapObj.zones : [])
        .filter((zone) => Number(getRegionData(zone?.zoneId)?.resources?.['물'] || 0) > 0)
        .map((zone) => String(zone?.zoneId || '')),
    ]);

    if (waterZones.includes(String(updated.zoneId))) {
      const water = findItemByKeywords(publicItems, ['물', 'water']);
      if (water?._id && getFieldResourceQty(fieldResources, updated.zoneId, water._id) > 0) {
        const have = invQty(updated.inventory, String(water._id));
        const chance = have <= 0 ? 0.85 : have < 2 ? 0.55 : 0.25;
        if (simulationRandom() < chance && canReceiveItem(updated.inventory, water, String(water._id), 1, ruleset)) {
          const loot = { item: water, itemId: String(water._id), qty: 1, zoneId: String(updated.zoneId) };
          const gotW = collectFieldResourceLoot(fieldResources, loot, (qty) => {
            updated.inventory = addItemToInventory(updated.inventory, water, String(water._id), qty, nextDay, ruleset);
            return updated.inventory?._lastAdd?.acceptedQty ?? qty;
          });
          emitFieldResourcePickup(fieldResources, loot, gotW, updated, actions);
          const metaW = updated.inventory?._lastAdd;
          addLog(`💧 [${updated.name}] ${getZoneName(updated.zoneId)}에서 물 ${gainText(gotW)}${formatInvAddNote(metaW, 1, updated.inventory, ruleset)}`, 'normal');
          emitItemGainIfAny(gotW, { who: String(updated?._id || ''), itemId: String(water._id), source: 'gather', kind: 'water', zoneId: String(updated?.zoneId || '') }, atNow());
        }
      }
    }

    if (campfireZones.includes(String(updated.zoneId))) {
      const meat = findItemByKeywords(publicItems, ['고기']);
      const steak = findItemByKeywords(publicItems, ['스테이크', 'sizzling steak']);
      if (meat?._id && steak?._id) {
        const haveMeat = invQty(updated.inventory, String(meat._id));
        if (haveMeat >= 1 && canReceiveItem(updated.inventory, steak, String(steak._id), 1, ruleset)) {
          updated.inventory = consumeIngredientsFromInv(updated.inventory, [{ itemId: String(meat._id), qty: 1 }]);
          updated.inventory = addItemToInventory(updated.inventory, steak, String(steak._id), 1, nextDay, ruleset);
          const metaS = updated.inventory?._lastAdd;
          const gotS = Math.max(0, Number(metaS?.acceptedQty ?? 1));
          addLog(`🔥 [${updated.name}] ${getZoneName(updated.zoneId)} 모닥불에서 고기를 구워 스테이크 ${gainText(gotS, '제작', '제작 실패')}${formatInvAddNote(metaS, 1, updated.inventory, ruleset)}`, 'highlight');
          emitItemGainIfAny(gotS, { who: String(updated?._id || ''), itemId: String(steak._id), source: 'craft', kind: 'campfire', zoneId: String(updated?.zoneId || '') }, atNow());
        }
      }
    }
  } catch {
    // Facility data is optional; gathering should never break phase simulation.
  }

  return {
    actor: updated,
  };
}
