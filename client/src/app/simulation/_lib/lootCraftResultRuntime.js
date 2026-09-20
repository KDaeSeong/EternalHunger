import { autoEquipBest } from './gearFallbackRuntime.js';
import { commitCraftTransaction } from './craftTransactionRuntime.js';

// Shared by the product and full-match harness: no separate test-only payment
// path. A rejected/repeated receipt awards neither mastery nor a success event.
export function applyLootCraftResult(actor, crafted, itemMeta, { at = null, zoneId = '', logType = 'normal',
  addLog = () => {}, grantCraftMastery = () => {}, emitCraftRunEvent = () => {} } = {}) {
  if (!actor || !crafted?.transaction || !commitCraftTransaction(actor, crafted.transaction).ok) return false;
  autoEquipBest(actor, itemMeta);
  addLog(`[${actor.name}] ${crafted.log}`, logType);
  grantCraftMastery(actor, crafted, itemMeta, '제작');
  emitCraftRunEvent(actor._id, crafted, at, zoneId || actor.zoneId);
  return true;
}
