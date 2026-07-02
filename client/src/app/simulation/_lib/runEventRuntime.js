import { pickGoalLoadoutKeys } from './craftRuntime';
import { itemDisplayName } from './simulationCommon';

export function gainText(qty, successWord = '획득', failWord = '획득 실패') {
  const n = Math.max(0, Number(qty || 0));
  return n > 0 ? `x${n} ${successWord}` : failWord;
}

export function shouldLogItemReceive(qty, meta = null, opts = {}) {
  const n = Math.max(0, Number(qty || 0));
  if (n > 0) return true;
  if (opts?.important) return true;

  const quietReasons = new Set(['inventory_full', 'stack_cap', 'equip_not_better', 'equip_slot_full']);
  const reason = String(meta?.reason || '');
  if (!reason) return false;
  return !quietReasons.has(reason);
}

export function emitItemGainIfAny(emitRunEvent, qty, payload = {}, at = null) {
  const n = Math.max(0, Number(qty || 0));
  if (n <= 0) return;
  emitRunEvent('gain', { ...payload, qty: n }, at);
}

export function emitCraftRunEvent(emitRunEvent, who, crafted, at = null, zoneId = '') {
  if (!crafted?.craftedId) return;
  emitRunEvent('craft', {
    who: String(who || ''),
    itemId: String(crafted.craftedId || ''),
    itemName: String(crafted.craftedName || ''),
    tier: Math.max(1, Number(crafted?.craftedTier || 1)),
    zoneId: String(zoneId || ''),
    qty: 1,
  }, at);
}

export function emitObjectiveRunEvent(emitRunEvent, actor, objective, payload = {}, at = null) {
  if (!actor || !objective) return;
  emitRunEvent('objective', {
    who: String(actor?._id || ''),
    whoName: String(actor?.name || ''),
    zoneId: String(actor?.zoneId || ''),
    objective: String(objective || ''),
    ...(payload && typeof payload === 'object' ? payload : {}),
  }, at);
}

export function getLootCraftOptions(actor) {
  return {
    goalItemKeys: pickGoalLoadoutKeys(actor),
  };
}

export function emitQueueRunEvent(emitRunEvent, who, payload = {}, at = null) {
  const blocked = (Array.isArray(payload?.blockedReasons) ? payload.blockedReasons : [])
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 4);
  const candidates = (Array.isArray(payload?.candidates) ? payload.candidates : [])
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 6);
  const candidateScores = (Array.isArray(payload?.candidateScores) ? payload.candidateScores : [])
    .map((row) => {
      if (!row) return '';
      if (typeof row === 'string') return String(row).trim();
      const type = String(row?.type || row?.label || '').trim();
      const score = Number(row?.score || 0);
      if (!type) return '';
      return `${type}:${Number.isFinite(score) ? score.toFixed(1) : '0.0'}`;
    })
    .filter(Boolean)
    .slice(0, 5);
  const chosen = String(payload?.chosen || '').trim();
  if (!chosen && !blocked.length && candidates.length <= 1) return;
  emitRunEvent('queue', {
    who: String(who?._id || payload?.who || ''),
    whoName: String(who?.name || payload?.whoName || ''),
    zoneId: String(payload?.zoneId || who?.zoneId || ''),
    chosen,
    blockedReasons: blocked,
    candidates,
    candidateScores,
    candidateCount: Math.max(0, Number(payload?.candidateCount || candidates.length || 0)),
    blockedCount: blocked.length,
    reason: String(payload?.reason || ''),
    objectiveType: String(payload?.objectiveType || ''),
    objectiveSubkind: String(payload?.objectiveSubkind || ''),
    contestPressure: Math.max(0, Number(payload?.contestPressure || 0)),
  }, at);
}

export function emitEffectRunEvents(emitRunEvent, who, rows, meta = {}, at = null) {
  const whoId = String(who?._id || meta?.whoId || '');
  const whoName = String(who?.name || meta?.whoName || meta?.who || '');
  const zoneId = String(meta?.zoneId || who?.zoneId || '');
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const eff = row?.effect || null;
    const effectName = String(eff?.name || '').trim();
    if (!effectName) return;
    const outcome = row?.reason === 'immune'
      ? 'immune'
      : row?.reason === 'resisted'
        ? 'resisted'
        : row?.applied
          ? 'applied'
          : 'skipped';
    emitRunEvent('effect', {
      who: whoId,
      whoName,
      zoneId,
      source: String(meta?.source || ''),
      itemId: String(meta?.itemId || ''),
      skill: String(meta?.skill || ''),
      reason: String(meta?.reason || ''),
      effect: effectName,
      duration: Math.max(0, Number(eff?.duration ?? 0)),
      stacks: Math.max(0, Number(eff?.stacks ?? eff?.stack ?? 0)),
      outcome,
    }, at);
  });
}

export function emitConsumableRunEvent(emitRunEvent, who, item, meta = {}, at = null) {
  const whoId = String(who?._id || meta?.whoId || '');
  const itemId = String(item?._id || item?.itemId || meta?.itemId || '');
  emitRunEvent('use', {
    who: whoId,
    whoName: String(who?.name || meta?.whoName || ''),
    zoneId: String(meta?.zoneId || who?.zoneId || ''),
    source: String(meta?.source || 'consumable'),
    reason: String(meta?.reason || ''),
    manual: meta?.manual === true,
    itemId,
    itemName: itemDisplayName(item || { _id: itemId, name: meta?.itemName || '' }),
    heal: Math.max(0, Number(meta?.heal || 0)),
    satiety: Math.max(0, Number(meta?.satiety || 0)),
  }, at);
}
