import { applyItemEffect } from '../../../utils/itemLogic';
import { applyHealingModifier, canActVoluntarilyByStatus, getActiveStatusEffects } from '../../../utils/statusLogic';
import { normalizeConsumeEffect } from '../../../utils/consumeEffectContract.js';
import { inferItemCategory } from './inventoryRules';
import { itemDisplayName } from './simulationCommon';
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
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';

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

// Evaluate on an owned copy, then commit every mutation before publishing any
// callback. Invalid/no-benefit attempts preserve inventory, phase limits and HP.
function commitConsumableAtIndex(actor, invIndex, opts = {}) {
  if (isDimensionRiftDefeated(actor)) return { used: false, reason: 'rift_defeated' };
  if (!actor || !Array.isArray(actor.inventory)) return { used: false, reason: 'invalid_actor' };
  const hp = Number(actor.hp);
  const maxHp = Number(actor.maxHp ?? 100);
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || hp <= 0 || maxHp <= 0 || hp > maxHp)
    return { used: false, reason: 'invalid_hp' };
  if (!canActVoluntarilyByStatus(actor)) return { used: false, reason: 'action_blocked' };
  const index = Number(invIndex);
  if (!Number.isInteger(index) || index < 0 || index >= actor.inventory.length)
    return { used: false, reason: 'invalid_index' };
  const item = actor.inventory[index];
  const qty = Number(item?.qty ?? 1);
  if (!Number.isSafeInteger(qty) || qty <= 0 || inferItemCategory(item) !== 'consumable')
    return { used: false, reason: 'invalid_stock' };
  const effect = applyItemEffect(actor, item);
  if (effect.supported === false) return { used: false, reason: effect.reason };

  const next = structuredClone(actor);
  const healing = applyHealingModifier(next, Math.max(0, Number(effect.recovery || 0)));
  if (!Number.isFinite(healing)) return { used: false, reason: 'invalid_healing' };
  next.hp = Math.min(maxHp, hp + healing);
  const satiety = applySatietyGain(next, effect.satiety);
  let statApplied = false;
  for (const [key, raw] of Object.entries(effect.statBoost || {})) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value === 0) continue;
    next.stats = { ...next.stats, [key]: Number(next.stats?.[key] || 0) + value };
    statApplied = true;
  }
  const permanent = applyPermanentConsumableBoostToActor(next, effect, item);
  const incoming = effect.explicit
    ? (effect.newEffects || []).filter(row => usefulTimedEffect(actor, row, opts.reason === 'before_battle'))
    : effect.newEffects;
  // These are self-applied beneficial effects, not hostile resistance rolls.
  const runtime = applyRuntimeEffectPayloads(next, incoming, { random: () => 1 });
  const timedApplied = runtime.applied && JSON.stringify(next.activeEffects) !== JSON.stringify(actor.activeEffects || []);
  const heal = Math.max(0, next.hp - hp);
  if (!(heal > 0 || satiety > 0 || statApplied || permanent.applied || timedApplied))
    return { used: false, reason: 'no_benefit' };

  if (qty > 1) next.inventory[index] = { ...next.inventory[index], qty: qty - 1 };
  else next.inventory.splice(index, 1);
  if (opts.phaseIdx !== undefined) {
    next.consumableUsedPhaseIdx = opts.phaseIdx;
    next.consumableUsedCount = opts.usedCount + 1;
  }
  Object.assign(actor, next);
  upsertRuntimeSurvivor(opts.survivorMap, actor);

  const appliedEffects = runtime.results.filter(row => row.applied).map(row => ({
    name: row.effect.name, durationSec: row.effect.remainingDuration,
    shield: Math.max(0, Number(row.effect.shieldValue || 0)),
    regen: Math.max(0, Number(row.effect.recovery || 0)),
    stats: { ...(row.effect.statModifiers || {}) },
  }));
  const meta = { source: 'consumable', reason: opts.reason || 'dev_force',
    manual: opts.manual === true, heal, satiety, remainingQty: qty - 1, effects: appliedEffects };
  const at = opts.atNow?.();
  opts.emitConsumableRunEvent?.(actor, item, meta, at);
  opts.emitEffectRunEvents?.(actor, runtime.results, {
    source: 'consumable', itemId: String(item._id || item.itemId || ''), reason: meta.reason,
  }, at);
  const gains = [heal > 0 ? `체력 +${heal}` : '', satiety > 0 ? `포만감 +${satiety}` : ''].filter(Boolean);
  opts.addLog?.(`💊 [${actor.name}] ${itemDisplayName(item)} 사용${gains.length ? ` · ${gains.join(', ')}` : ''} · 남은 수량 ${qty - 1}개`, 'highlight');
  if (permanent.log) opts.addLog?.(permanent.log, 'highlight');
  runtime.results.forEach(row => {
    if (row.applied && shouldLogRuntimeEffectApplication(row.effect)) {
      const description = describeRuntimeEffect(row.effect);
      if (description) opts.addLog?.(`🪄 [${actor.name}] ${description}`, 'system');
    }
  });
  return { used: true, actor, item, ...meta };
}

function usefulTimedEffect(actor, incoming, beforeBattle) {
  if (incoming.recovery > 0 && actor.hp >= actor.maxHp && !beforeBattle) return false;
  const existing = getActiveStatusEffects(actor).find(row => row.name === incoming.name);
  if (!existing) return true;
  const values = row => ({ shield: Number(row.shieldValue || 0), regen: Number(row.recovery || 0),
    ...(row.statModifiers || {}) });
  const old = values(existing), next = values(incoming);
  const keys = new Set([...Object.keys(old), ...Object.keys(next)]);
  // A weaker dose must not replace a stronger shield, regeneration or buff.
  if ([...keys].some(key => Number(next[key] || 0) < Number(old[key] || 0))) return false;
  return [...keys].some(key => Number(next[key] || 0) > Number(old[key] || 0))
    || existing.remainingDuration != null && Number(incoming.remainingDuration) > Number(existing.remainingDuration);
}

export function createPhaseConsumableRuntime(opts = {}) {
  const { consCfg = {}, phaseIdxNow = 0 } = opts;
  const limit = Number(consCfg.maxUsesPerPhase ?? 1);
  const hpTurn = Number(consCfg.aiUseHpBelow ?? 60);
  const hpBattle = Number(consCfg.afterBattleHpBelow ?? 50);
  const satietyBelow = Number(consCfg.aiUseSatietyBelow ?? 35);
  const tryUseConsumable = (actor, reason) => {
    if (consCfg.enabled === false || !Number.isSafeInteger(limit) || limit <= 0
      || !Number.isSafeInteger(phaseIdxNow) || !Array.isArray(actor?.inventory)) return false;
    const used = actor.consumableUsedPhaseIdx === phaseIdxNow ? Number(actor.consumableUsedCount ?? 0) : 0;
    if (!Number.isSafeInteger(used) || used < 0 || used >= limit) return false;
    const hp = Number(actor.hp);
    const hungry = normalizeSatiety(actor.satiety) < satietyBelow;
    const hurt = hp < (reason === 'after_battle' ? hpBattle : hpTurn);
    for (let i = 0; i < actor.inventory.length; i++) {
      const item = actor.inventory[i];
      const contract = normalizeConsumeEffect(item?.consumeEffect);
      if (!contract.ok) continue;
      if (reason === 'before_battle') {
        // Combat utility is consumed at a real encounter, never merely because
        // a defensive item exists in the bag while safely farming.
        if (!contract.explicit) continue;
      } else {
        if (!contract.explicit && !isFoodRecoveryItem(item)) continue;
        if (!hurt && !hungry) continue;
        if (contract.explicit && !((hurt && (contract.effect.heal > 0 || contract.effect.regen > 0))
          || (hungry && contract.effect.satiety > 0))) continue;
      }
      if (commitConsumableAtIndex(actor, i, { ...opts, reason, phaseIdx: phaseIdxNow, usedCount: used }).used) return true;
    }
    return false;
  };
  return { tryUseConsumable };
}

export function forceUseConsumableAtIndex(actor, invIndex, opts = {}) {
  return commitConsumableAtIndex(actor, invIndex, { ...opts, reason: 'dev_force', manual: true });
}
