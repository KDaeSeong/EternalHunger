import { getErStatLabel } from '../../../utils/erStats.js';

export function describeConsumableReceipt(event) {
  if (event?.kind !== 'use') return '';
  const parts = [];
  if (Number(event.heal) > 0) parts.push(`체력 +${event.heal}`);
  if (Number(event.satiety) > 0) parts.push(`포만감 +${event.satiety}`);
  for (const row of Array.isArray(event.effects) ? event.effects : []) {
    const values = [];
    if (row.shield > 0) values.push(`보호막 ${row.shield}`);
    if (row.regen > 0) values.push(`초당 체력 +${row.regen}`);
    for (const [key, value] of Object.entries(row.stats || {})) if (value > 0) values.push(`${getErStatLabel(key)} +${value}`);
    if (values.length) parts.push(`${values.join(', ')}${row.durationSec > 0 ? ` (${row.durationSec}초)` : ''}`);
  }
  const reason = { before_battle: '교전 대비', after_battle: '전투 후 회복', turn_start: '상태 회복', dev_force: '수동 확인' }[event.reason];
  const stock = Number.isSafeInteger(event.remainingQty) && event.remainingQty >= 0 ? ` · 남은 수량 ${event.remainingQty}개` : '';
  return `${event.itemName || '소모품'} 사용${reason ? ` · ${reason}` : ''}${parts.length ? ` · ${parts.join(' / ')}` : ''}${stock}`;
}
