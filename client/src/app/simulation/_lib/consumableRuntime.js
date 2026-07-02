import { itemDisplayName } from './simulationCommon';

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
