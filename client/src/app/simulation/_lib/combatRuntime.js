function readStat(actor, keys) {
  const st = actor?.stats && typeof actor.stats === 'object' ? actor.stats : actor;
  for (const k of keys) {
    const v = Number(st?.[k] ?? st?.[String(k).toLowerCase?.()] ?? 0);
    if (Number.isFinite(v)) return v;
  }
  return 0;
}

function roughPower(actor) {
  const str = readStat(actor, ['STR', 'str']);
  const agi = readStat(actor, ['AGI', 'agi']);
  const sht = readStat(actor, ['SHOOT', 'SHT', 'shoot', 'sht']);
  const end = readStat(actor, ['END', 'end']);
  const men = readStat(actor, ['MEN', 'men']);
  return str + agi + sht + end + men * 0.5;
}

export {
  readStat,
  roughPower,
};
