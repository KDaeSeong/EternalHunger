import { normalizeErStats } from '../../../utils/erStats';

function readStat(actor, keys) {
  const st = normalizeErStats(actor?.stats || actor || {});
  for (const k of keys) {
    const v = Number(st?.[k] ?? st?.[String(k).toLowerCase?.()] ?? 0);
    if (Number.isFinite(v)) return v;
  }
  return 0;
}

function roughPower(actor) {
  const stats = normalizeErStats(actor?.stats || actor || {});
  return (
    Number(stats.attackPower || 0) +
    Number(stats.skillAmp || 0) * 0.35 +
    Number(stats.defense || 0) * 0.85 +
    Number(stats.attackSpeed || 0) * 10 +
    Number(stats.attackRange || 0) * 1.5 +
    Number(stats.sightRange || 0) * 0.4 +
    Number(stats.maxHp || 0) * 0.08
  );
}

export {
  readStat,
  roughPower,
};
