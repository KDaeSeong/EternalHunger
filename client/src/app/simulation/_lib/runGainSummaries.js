import {
  DETAIL_SOURCE_LABELS,
  GAIN_SOURCE_LABELS,
  gainEvents,
  itemName,
  positiveQty,
  sourceKey,
  topEntries,
  zoneName,
} from './runSummaryShared';

export function buildGainSourceSummary(runEvents) {
  const acc = {};
  for (const event of gainEvents(runEvents)) {
    const itemId = String(event.itemId || '');
    if (!itemId || itemId === 'CREDITS') continue;
    const qty = positiveQty(event);
    if (qty <= 0) continue;
    const src = sourceKey(event);
    acc[src] = (acc[src] || 0) + qty;
  }
  return topEntries(acc, 99).map(([key, qty]) => `${GAIN_SOURCE_LABELS[key] || key}:${qty}`).join(' / ');
}

export function buildCreditSourceSummary(runEvents) {
  const acc = {};
  for (const event of gainEvents(runEvents)) {
    if (String(event.itemId || '') !== 'CREDITS') continue;
    const qty = positiveQty(event);
    if (qty <= 0) continue;
    const src = sourceKey(event);
    acc[src] = (acc[src] || 0) + qty;
  }
  return topEntries(acc, 99).map(([key, qty]) => `${GAIN_SOURCE_LABELS[key] || key}:${qty}`).join(' / ');
}

export function buildGainDetailSummary({ runEvents, itemNameById, zoneNameById }) {
  const itemAcc = {};
  const zoneAcc = {};
  const itemSourceAcc = {};

  for (const event of gainEvents(runEvents)) {
    const id = String(event.itemId || '');
    if (!id || id === 'CREDITS') continue;
    const qty = positiveQty(event);
    if (qty <= 0) continue;

    itemAcc[id] = (itemAcc[id] || 0) + qty;

    const src = sourceKey(event);
    if (!itemSourceAcc[id]) itemSourceAcc[id] = {};
    itemSourceAcc[id][src] = (itemSourceAcc[id][src] || 0) + qty;

    const zoneId = String(event.zoneId || '');
    if (zoneId) zoneAcc[zoneId] = (zoneAcc[zoneId] || 0) + qty;
  }

  const itemStr = topEntries(itemAcc, 3)
    .map(([id, qty]) => {
      const srcs = itemSourceAcc[String(id)] || {};
      let bestSource = '';
      let bestQty = -1;
      for (const [key, sourceQty] of Object.entries(srcs)) {
        if (Number(sourceQty) > bestQty) {
          bestQty = Number(sourceQty);
          bestSource = String(key);
        }
      }
      const sourceText = bestSource ? `(${DETAIL_SOURCE_LABELS[bestSource] || bestSource})` : '';
      return `${itemName(itemNameById, id)}x${qty}${sourceText}`;
    })
    .join(', ');

  const zoneStr = topEntries(zoneAcc, 3)
    .map(([id, qty]) => `${zoneName(zoneNameById, id)} ${qty}`)
    .join(', ');

  if (itemStr && zoneStr) return `TOP 아이템: ${itemStr} | TOP 구역: ${zoneStr}`;
  if (itemStr) return `TOP 아이템: ${itemStr}`;
  if (zoneStr) return `TOP 구역: ${zoneStr}`;
  return '';
}

export function buildSpecialSourceSummary(runEvents) {
  const out = {
    bossCredits: 0,
    bossItems: 0,
    mutantItems: 0,
    mutantCredits: 0,
    eventCredits: 0,
    eventItems: 0,
    huntItems: 0,
    huntCredits: 0,
    alpha: 0,
    omega: 0,
    weakline: 0,
  };

  for (const event of gainEvents(runEvents)) {
    const src = sourceKey(event);
    const itemId = String(event.itemId || '');
    const qty = positiveQty(event);
    if (qty <= 0) continue;
    const isCredit = itemId === 'CREDITS';

    if (src === 'boss') {
      if (isCredit) out.bossCredits += qty;
      else out.bossItems += qty;
      const bossKind = String(event.subkind || event.sourceKind || '').toLowerCase();
      if (bossKind.includes('alpha')) out.alpha += qty;
      if (bossKind.includes('omega')) out.omega += qty;
      if (bossKind.includes('weakline') || bossKind.includes('wickeline')) out.weakline += qty;
    } else if (src === 'mutant') {
      if (isCredit) out.mutantCredits += qty;
      else out.mutantItems += qty;
    } else if (src === 'event') {
      if (isCredit) out.eventCredits += qty;
      else out.eventItems += qty;
    } else if (src === 'hunt') {
      if (isCredit) out.huntCredits += qty;
      else out.huntItems += qty;
    }
  }

  const parts = [];
  if (out.bossItems || out.bossCredits) {
    const bossKinds = [
      out.alpha ? `A:${out.alpha}` : '',
      out.omega ? `O:${out.omega}` : '',
      out.weakline ? `W:${out.weakline}` : '',
    ].filter(Boolean).join(' / ');
    parts.push(`보스 보상 아이템 ${out.bossItems}${out.bossCredits ? ` · 크레딧 ${out.bossCredits}` : ''}${bossKinds ? ` (${bossKinds})` : ''}`);
  }
  if (out.mutantItems || out.mutantCredits) {
    parts.push(`변이 야생동물 아이템 ${out.mutantItems}${out.mutantCredits ? ` · 크레딧 ${out.mutantCredits}` : ''}`);
  }
  if (out.huntItems || out.huntCredits) {
    parts.push(`일반 사냥 아이템 ${out.huntItems}${out.huntCredits ? ` · 크레딧 ${out.huntCredits}` : ''}`);
  }
  if (out.eventItems || out.eventCredits) {
    parts.push(`이벤트 보상 아이템 ${out.eventItems}${out.eventCredits ? ` · 크레딧 ${out.eventCredits}` : ''}`);
  }
  return parts.join(' | ');
}
