import { getRuleset } from '../../../utils/rulesets';
import { forceUseConsumableAtIndex } from './consumableRuntime';
import { gainText } from './runEventRuntime';
import {
  EQUIP_SLOTS,
  addItemToInventory,
  autoEquipBest,
  ensureEquipped,
  formatInvAddNote,
  itemDisplayName,
  itemIcon,
  pickAutoTranscendOption,
} from './simulationEngine';

export function createDevToolActionRuntime(context = {}) {
  const state = context.state || {};
  const actions = context.actions || {};

  const {
    day,
    isAdvancing,
    isGameOver,
    matchSec,
    pendingTranscendPick,
    phase,
    publicItems,
    settings,
    showMarketPanel,
    survivors,
  } = state;

  const {
    addLog = () => {},
    emitConsumableRunEvent = () => {},
    emitEffectRunEvents = () => {},
    emitItemGainIfAny = () => {},
    markDevRunTainted = () => {},
    setPendingTranscendPick = () => {},
    setSurvivors = () => {},
  } = actions;

  function resolvePendingTranscendPick(optionIndex, method = 'manual') {
    if (!pendingTranscendPick) return;

    const pending = pendingTranscendPick;
    const ruleset = getRuleset(settings?.rulesetId);
    const options = Array.isArray(pending?.options) ? pending.options : [];
    const chosen = (Number(optionIndex) === -1) ? pickAutoTranscendOption(options, publicItems) : (options[Number(optionIndex)] || null);

    if (!chosen?.itemId) {
      setPendingTranscendPick(null);
      return;
    }

    const item = (Array.isArray(publicItems) ? publicItems : []).find((it) => String(it?._id) === String(chosen.itemId)) || null;

    setSurvivors((prev) => {
      const next = (Array.isArray(prev) ? prev : []).map((character) => ({
        ...character,
        inventory: Array.isArray(character?.inventory) ? character.inventory.map((entry) => ({ ...entry })) : [],
      }));
      const idx = next.findIndex((character) => String(character?._id) === String(pending.characterId));
      if (idx < 0) return prev;

      const character = next[idx];
      character.inventory = addItemToInventory(character.inventory, item, String(chosen.itemId), 1, day, ruleset);
      const meta = character.inventory?._lastAdd || null;
      const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
      const name = itemDisplayName(item || { _id: chosen.itemId, name: chosen.name });
      if (got > 0) markDevRunTainted();
      addLog(`🎁 [${character.name}] 초월 장비 선택 상자 선택 → ${itemIcon(item)} ${name} ${gainText(got)}${formatInvAddNote(meta, 1, character.inventory, ruleset)}`, 'highlight');
      emitItemGainIfAny(got, { who: character.name, whoId: character._id, itemId: String(chosen.itemId), source: 'box', sourceKind: 'transcend_pick', zoneId: pending.zoneId, choice: method }, pending.at || { day, phase, sec: matchSec });
      if (got > 0) autoEquipBest(character, {});
      return next;
    });

    setPendingTranscendPick(null);
  }

  function devForceUseConsumable(charId, invIndex) {
    if (!showMarketPanel) return;
    if (isAdvancing || isGameOver) return;

    setSurvivors((prev) => {
      const next = (Array.isArray(prev) ? prev : []).map((character) => ({
        ...character,
        inventory: Array.isArray(character?.inventory) ? character.inventory.map((entry) => ({ ...entry })) : [],
      }));
      const idx = next.findIndex((character) => String(character?._id) === String(charId));
      if (idx < 0) return prev;

      const character = next[idx];
      const result = forceUseConsumableAtIndex(character, invIndex, {
        addLog,
        emitConsumableRunEvent,
        emitEffectRunEvents,
      });
      if (!result.used) return prev;
      markDevRunTainted();
      return next;
    });
  }

  function setEquipForSurvivor(survivorId, slot, itemIdOrNull) {
    const sid = String(survivorId || '');
    const sslot = String(slot || '');
    if (!sid || !EQUIP_SLOTS.includes(sslot)) return;
    const nextItemId = itemIdOrNull ? String(itemIdOrNull) : null;
    const current = (Array.isArray(survivors) ? survivors : []).find((survivor) => {
      const id = String(survivor?._id || survivor?.id || survivor?.name || '');
      return id === sid;
    });
    const currentEquipped = current ? ensureEquipped(current) : null;
    if (!currentEquipped || String(currentEquipped[sslot] || '') === String(nextItemId || '')) return;
    markDevRunTainted();

    setSurvivors((prev) =>
      (Array.isArray(prev) ? prev : []).map((survivor) => {
        const id = String(survivor?._id || survivor?.id || survivor?.name || '');
        if (id !== sid) return survivor;
        const equipped = { ...ensureEquipped(survivor) };
        equipped[sslot] = nextItemId;
        return { ...survivor, equipped };
      })
    );
  }

  return {
    devForceUseConsumable,
    resolvePendingTranscendPick,
    setEquipForSurvivor,
  };
}
