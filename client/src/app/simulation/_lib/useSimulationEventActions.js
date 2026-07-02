import { useMemo } from 'react';
import {
  applyErTraitAfterBattle as applyErTraitAfterBattleRuntime,
  applyErWeaponSkillAfterCombat as applyErWeaponSkillAfterCombatRuntime,
} from './combatRuntime';
import {
  grantCraftMastery as grantCraftMasteryRuntime,
  grantMasteries as grantMasteriesRuntime,
  grantMastery as grantMasteryRuntime,
  grantPvpDamageMastery as grantPvpDamageMasteryRuntime,
  grantPvpKillMastery as grantPvpKillMasteryRuntime,
} from './masteryProgressRuntime';
import {
  emitConsumableRunEvent as emitConsumableRunEventRuntime,
  emitCraftRunEvent as emitCraftRunEventRuntime,
  emitEffectRunEvents as emitEffectRunEventsRuntime,
  emitItemGainIfAny as emitItemGainIfAnyRuntime,
  emitObjectiveRunEvent as emitObjectiveRunEventRuntime,
  emitQueueRunEvent as emitQueueRunEventRuntime,
} from './runEventRuntime';
import { autoEquipBest } from './simulationEngine';

export function useSimulationEventActions({
  addLog,
  emitRunEvent,
} = {}) {
  return useMemo(() => {
    function grantMastery(actor, category, amount, reason = '') {
      return grantMasteryRuntime(actor, category, amount, reason, addLog);
    }

    function grantMasteries(actor, entries = [], reason = '') {
      return grantMasteriesRuntime(actor, entries, reason, addLog);
    }

    function grantCraftMastery(actor, crafted, craftItemMetaById, reason = '제작') {
      return grantCraftMasteryRuntime(actor, crafted, craftItemMetaById, reason, addLog);
    }

    function grantPvpDamageMastery(actor, payload = {}, reason = '교전') {
      return grantPvpDamageMasteryRuntime(actor, payload, reason, addLog);
    }

    function grantPvpKillMastery(actor, opponent, reason = '처치') {
      return grantPvpKillMasteryRuntime(actor, opponent, reason, addLog);
    }

    function emitItemGainIfAny(qty, payload = {}, at = null) {
      return emitItemGainIfAnyRuntime(emitRunEvent, qty, payload, at);
    }

    function emitCraftRunEvent(who, crafted, at = null, zoneId = '') {
      return emitCraftRunEventRuntime(emitRunEvent, who, crafted, at, zoneId);
    }

    function emitObjectiveRunEvent(actor, objective, payload = {}, at = null) {
      return emitObjectiveRunEventRuntime(emitRunEvent, actor, objective, payload, at);
    }

    function emitQueueRunEvent(who, payload = {}, at = null) {
      return emitQueueRunEventRuntime(emitRunEvent, who, payload, at);
    }

    function emitEffectRunEvents(who, rows, meta = {}, at = null) {
      return emitEffectRunEventsRuntime(emitRunEvent, who, rows, meta, at);
    }

    function emitConsumableRunEvent(who, item, meta = {}, at = null) {
      return emitConsumableRunEventRuntime(emitRunEvent, who, item, meta, at);
    }

    function applyErTraitAfterBattle(actor, opts = {}) {
      return applyErTraitAfterBattleRuntime(actor, { ...opts, addLog });
    }

    function applyErWeaponSkillAfterCombat(attacker, defender, opts = {}) {
      return applyErWeaponSkillAfterCombatRuntime(attacker, defender, {
        ...opts,
        addLog,
        emitRunEvent,
        emitEffectRunEvents,
      });
    }

    function applyLootCraftResult(actor, crafted, itemMeta, at = null, zoneId = '', logType = 'normal') {
      if (!actor || !crafted?.inventory) return false;
      actor.inventory = crafted.inventory;
      autoEquipBest(actor, itemMeta);
      addLog(`[${actor.name}] ${crafted.log}`, logType);
      grantCraftMastery(actor, crafted, itemMeta, '제작');
      emitCraftRunEvent(actor?._id, crafted, at, zoneId || actor?.zoneId);
      return true;
    }

    return {
      applyErTraitAfterBattle,
      applyErWeaponSkillAfterCombat,
      applyLootCraftResult,
      emitConsumableRunEvent,
      emitCraftRunEvent,
      emitEffectRunEvents,
      emitItemGainIfAny,
      emitObjectiveRunEvent,
      emitQueueRunEvent,
      grantCraftMastery,
      grantMasteries,
      grantMastery,
      grantPvpDamageMastery,
      grantPvpKillMastery,
    };
  }, [addLog, emitRunEvent]);
}
