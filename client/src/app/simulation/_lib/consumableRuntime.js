import { applyItemEffect } from '../../../utils/itemLogic';
import { applyHealingModifier } from '../../../utils/statusLogic';
import { inferItemCategory } from './inventoryRules';
import { itemDisplayName, itemIcon } from './simulationCommon';
import {
  applyRuntimeEffectPayloads,
  describeRuntimeEffect,
  shouldLogRuntimeEffectApplication,
} from './runtimeStatus';
import {
  applySatietyGain,
  isFoodRecoveryItem,
  normalizeSatiety,
} from './satietyRuntime';
import { upsertRuntimeSurvivor } from './survivorRuntime';

export function applyPermanentConsumableBoostToActor(actor, effect, item) {
  const boost = effect?.permanentBoost && typeof effect.permanentBoost === 'object' ? effect.permanentBoost : null;
  if (!actor || !boost) return { applied: false, duplicate: false, log: '' };

  const key = String(effect?.permanentKey || boost?.key || item?._id || item?.itemId || item?.name || '').trim();
  if (!key) return { applied: false, duplicate: false, log: '' };

  const used = actor.usedPermanentConsumables && typeof actor.usedPermanentConsumables === 'object'
    ? { ...actor.usedPermanentConsumables }
    : {};
  const itemName = itemDisplayName(item);
  if (used[key]) {
    return { applied: false, duplicate: true, log: `♻️ [${actor.name}] ${itemName} 영구 보너스는 이미 적용되어 있습니다.` };
  }
  used[key] = true;
  actor.usedPermanentConsumables = used;

  actor.itemPermanentBonuses = actor.itemPermanentBonuses && typeof actor.itemPermanentBonuses === 'object'
    ? { ...actor.itemPermanentBonuses }
    : {};
  const parts = [];

  const maxHpPlus = Math.max(0, Math.round(Number(boost?.maxHp || 0)));
  if (maxHpPlus > 0) {
    const prevMax = Math.max(1, Number(actor.maxHp || 100));
    const prevHp = Math.max(0, Number(actor.hp || 0));
    actor.maxHp = prevMax + maxHpPlus;
    actor.hp = Math.min(actor.maxHp, prevHp + maxHpPlus);
    actor.itemPermanentBonuses.maxHp = Number(actor.itemPermanentBonuses.maxHp || 0) + maxHpPlus;
    parts.push(`최대 체력 +${maxHpPlus}`);
  }

  const statBoost = boost?.stats && typeof boost.stats === 'object' ? boost.stats : {};
  if (Object.keys(statBoost).length) {
    actor.stats = actor.stats && typeof actor.stats === 'object' ? { ...actor.stats } : {};
    actor.itemPermanentBonuses.stats = actor.itemPermanentBonuses.stats && typeof actor.itemPermanentBonuses.stats === 'object'
      ? { ...actor.itemPermanentBonuses.stats }
      : {};
    Object.entries(statBoost).forEach(([rawKey, value]) => {
      const statKey = String(rawKey || '').trim();
      const v = Number(value || 0);
      if (!statKey || !Number.isFinite(v) || v === 0) return;
      actor.stats[statKey] = Number(actor.stats?.[statKey] || 0) + v;
      actor.itemPermanentBonuses.stats[statKey] = Number(actor.itemPermanentBonuses.stats?.[statKey] || 0) + v;
      parts.push(`${statKey} +${v}`);
    });
  }

  const moveSpeedPlus = Number(boost?.moveSpeed || 0);
  if (Number.isFinite(moveSpeedPlus) && moveSpeedPlus !== 0) {
    actor.permanentMoveSpeed = Number(actor.permanentMoveSpeed || 0) + moveSpeedPlus;
    actor.itemPermanentBonuses.moveSpeed = Number(actor.itemPermanentBonuses.moveSpeed || 0) + moveSpeedPlus;
    parts.push(`이동 속도 +${moveSpeedPlus}`);
  }

  return {
    applied: parts.length > 0,
    duplicate: false,
    log: parts.length ? `💊 [${actor.name}] ${itemName} 영구 보너스 적용: ${parts.join(', ')}` : '',
  };
}

export function createPhaseConsumableRuntime(opts = {}) {
  const {
    addLog,
    atNow,
    consCfg = {},
    emitConsumableRunEvent,
    emitEffectRunEvents,
    phaseIdxNow = 0,
    survivorMap,
  } = opts;
  const consEnabled = consCfg?.enabled !== false;
  const consTurnHpBelow = Number(consCfg.aiUseHpBelow ?? 60);
  const consAfterBattleHpBelow = Number(consCfg.afterBattleHpBelow ?? 50);
  const consMaxUsesPerPhase = Math.max(0, Math.floor(Number(consCfg.maxUsesPerPhase ?? 1)));

  const tryUseConsumable = (actor, reason) => {
    if (!consEnabled || consMaxUsesPerPhase <= 0) return false;
    if (!actor || !Array.isArray(actor.inventory) || actor.inventory.length === 0) return false;

    const usedPhaseKey = 'consumableUsedPhaseIdx';
    const usedCountKey = 'consumableUsedCount';
    const lastPhase = Number(actor?.[usedPhaseKey] ?? -9999);
    if (lastPhase !== phaseIdxNow) {
      actor[usedPhaseKey] = phaseIdxNow;
      actor[usedCountKey] = 0;
    }
    const usedCount = Number(actor?.[usedCountKey] ?? 0);
    if (usedCount >= consMaxUsesPerPhase) return false;

    const hp = Number(actor.hp || 0);
    const hpBelow = reason === 'after_battle' ? consAfterBattleHpBelow : consTurnHpBelow;
    const satiety = normalizeSatiety(actor.satiety);
    const satietyBelow = Math.max(0, Math.min(100, Number(consCfg.aiUseSatietyBelow ?? 35)));
    if (hp <= 0) return false;

    const inventory = actor.inventory;
    if (hp >= hpBelow && satiety >= satietyBelow) return false;

    const itemIndex = inventory.findIndex((item) => isFoodRecoveryItem(item));
    if (itemIndex < 0) return false;

    const itemToUse = inventory[itemIndex];
    const effect = applyItemEffect(actor, itemToUse);
    addLog?.(effect.log, 'highlight');

    const maxHp = Number(actor?.maxHp ?? 100);
    const finalRecovery = applyHealingModifier(actor, Number(effect.recovery || 0));
    actor.hp = Math.min(maxHp, hp + finalRecovery);
    const satietyGain = applySatietyGain(actor, effect?.satiety);
    const statBoost = effect?.statBoost && typeof effect.statBoost === 'object' ? effect.statBoost : null;
    if (statBoost) {
      actor.stats = actor.stats && typeof actor.stats === 'object' ? { ...actor.stats } : {};
      Object.entries(statBoost).forEach(([key, value]) => {
        const statValue = Number(value || 0);
        if (!Number.isFinite(statValue) || statValue === 0) return;
        actor.stats[key] = Number(actor.stats?.[key] || 0) + statValue;
      });
    }

    const permanent = applyPermanentConsumableBoostToActor(actor, effect, itemToUse);
    if (permanent.log) addLog?.(permanent.log, permanent.duplicate ? 'system' : 'highlight');

    const runtimeEffects = applyRuntimeEffectPayloads(actor, effect?.newEffects);
    runtimeEffects.results.forEach((row) => {
      if (row?.reason === 'immune') addLog?.(`🛡️ [${actor.name}] ${String(row?.effect?.name || '효과')} 면역`, 'system');
      else if (row?.reason === 'resisted') addLog?.(`🧷 [${actor.name}] ${String(row?.effect?.name || '효과')} 저항`, 'system');
      else if (row?.applied && shouldLogRuntimeEffectApplication(row.effect)) {
        const desc = describeRuntimeEffect(row.effect);
        if (desc) addLog?.(`🪄 [${actor.name}] ${desc}`, 'system');
      }
    });

    const currentQty = Number(itemToUse?.qty || 1);
    if (Number.isFinite(currentQty) && currentQty > 1) inventory[itemIndex] = { ...itemToUse, qty: currentQty - 1 };
    else inventory.splice(itemIndex, 1);

    actor[usedCountKey] = usedCount + 1;
    emitConsumableRunEvent?.(actor, itemToUse, {
      source: 'consumable',
      reason,
      heal: Math.max(0, Number(actor.hp || 0) - hp),
      satiety: satietyGain,
    }, atNow?.());
    emitEffectRunEvents?.(actor, runtimeEffects.results, {
      source: 'consumable',
      itemId: String(itemToUse?._id || itemToUse?.itemId || ''),
      reason,
    }, atNow?.());
    upsertRuntimeSurvivor(survivorMap, actor);
    return true;
  };

  return { tryUseConsumable };
}

export function forceUseConsumableAtIndex(actor, invIndex, opts = {}) {
  const {
    addLog,
    emitConsumableRunEvent,
    emitEffectRunEvents,
  } = opts;
  if (!actor || !Array.isArray(actor.inventory)) return { used: false };

  const inventory = actor.inventory;
  const itemIndex = Number(invIndex);
  if (!Number.isFinite(itemIndex) || itemIndex < 0 || itemIndex >= inventory.length) return { used: false };

  const item = inventory[itemIndex];
  if (inferItemCategory(item) !== 'consumable') return { used: false };

  const beforeHp = Number(actor.hp || 0);
  const maxHp = Number(actor?.maxHp ?? 100);
  const effect = applyItemEffect(actor, item);
  const heal = Math.max(0, Number(effect?.recovery || 0));
  const finalHeal = applyHealingModifier(actor, heal);
  actor.hp = Math.min(maxHp, beforeHp + finalHeal);
  const satietyGain = applySatietyGain(actor, effect?.satiety);

  const statBoost = effect?.statBoost && typeof effect.statBoost === 'object' ? effect.statBoost : null;
  if (statBoost) {
    actor.stats = actor.stats && typeof actor.stats === 'object' ? { ...actor.stats } : {};
    Object.entries(statBoost).forEach(([key, value]) => {
      const statValue = Number(value || 0);
      if (!Number.isFinite(statValue) || statValue === 0) return;
      actor.stats[key] = Number(actor.stats?.[key] || 0) + statValue;
    });
  }

  const permanent = applyPermanentConsumableBoostToActor(actor, effect, item);
  if (permanent.log) addLog?.(permanent.log, permanent.duplicate ? 'system' : 'highlight');

  const runtimeEffects = applyRuntimeEffectPayloads(actor, effect?.newEffects);
  runtimeEffects.results.forEach((row) => {
    if (row?.reason === 'immune') addLog?.(`🛡️ [${actor.name}] ${String(row?.effect?.name || '효과')} 면역`, 'system');
    else if (row?.reason === 'resisted') addLog?.(`🧷 [${actor.name}] ${String(row?.effect?.name || '효과')} 저항`, 'system');
    else if (row?.applied && shouldLogRuntimeEffectApplication(row.effect)) {
      const desc = describeRuntimeEffect(row.effect);
      if (desc) addLog?.(`🪄 [${actor.name}] ${desc}`, 'system');
    }
  });

  const currentQty = Number(item?.qty || 1);
  if (Number.isFinite(currentQty) && currentQty > 1) inventory[itemIndex] = { ...item, qty: currentQty - 1 };
  else inventory.splice(itemIndex, 1);

  const delta = Math.max(0, Number(actor.hp || 0) - beforeHp);
  const itemName = itemDisplayName(item);
  addLog?.(`🧪 [${actor.name}] 강제 사용: ${itemIcon(item)} ${itemName} (+${delta} HP${satietyGain ? `, 포만감 +${satietyGain}` : ''})`, 'highlight');
  emitConsumableRunEvent?.(actor, item, {
    source: 'consumable',
    reason: 'dev_force',
    manual: true,
    heal: delta,
    satiety: satietyGain,
  });
  emitEffectRunEvents?.(actor, runtimeEffects.results, {
    source: 'consumable',
    itemId: String(item?._id || item?.itemId || ''),
    reason: 'dev_force',
  });
  return { used: true, actor, item, heal: delta, satiety: satietyGain };
}
