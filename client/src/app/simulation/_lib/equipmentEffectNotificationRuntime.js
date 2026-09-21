// Observation failures must not consume an equipment reservation before its
// HP, contributions, kills and loot settle. Keep publication order, attempt
// every notification once, then surface failures instead of hiding a broken
// log or retrying an event whose receiver may already have accepted it.
// Domain callbacks are deliberately not caught: their failure is not an
// observation failure and must not be presented as successful settlement.
export function settleEquipmentNotifications(actions = {}, settle) {
  const failures = [];
  const guarded = { ...actions };
  for (const key of ['addLog', 'emitRunEvent', 'emitDeathRunEventOnce', 'emitEffectRunEvents', 'flushDeadSnapshots']) {
    if (typeof actions[key] !== 'function') continue;
    guarded[key] = (...args) => {
      try { return actions[key](...args); }
      catch (error) { failures.push(error); return undefined; }
    };
  }
  const result = settle(guarded);
  if (failures.length) throw new AggregateError(failures, 'Equipment settlement completed, but observation publication failed.');
  return result;
}
