export const TACTICAL_EFFECT_SCHEMA = 'eternal-hunger.tactical-effect.v1';

const fields = ['level', 'hpBefore', 'hpAfter', 'hpSpent', 'hpRecovered', 'cooldownBefore', 'cooldownUntil',
  'damageBefore', 'damageAfter', 'damagePrevented', 'damageAdded', 'existingShieldAbsorbed', 'movementDistance'];
const same = (left, right) => Math.abs(left - right) < 1e-6;

// A receipt describes the tactical stage, before a later damage packet commits
// target HP. Missing/invalid evidence is unknown, never a fabricated zero effect.
export function readTacticalEffectReceipt(event) {
  const receipt = event?.tacticalEffect;
  if (event?.kind !== 'skill' || event.source !== 'tactical'
    || !['combat_attack', 'combat_defense'].includes(event.mode)
    || receipt?.schema !== TACTICAL_EFFECT_SCHEMA
    || fields.some((field) => typeof receipt[field] !== 'number' || !Number.isFinite(receipt[field]) || receipt[field] < 0)
    || ![1, 2].includes(receipt.level) || typeof receipt.lethalPrevented !== 'boolean'
    || typeof event.at?.sec !== 'number' || !Number.isFinite(event.at.sec) || event.at.sec < 0
    || receipt.cooldownBefore > event.at.sec || receipt.cooldownUntil < event.at.sec
    || !same(receipt.hpAfter, receipt.hpBefore - receipt.hpSpent + receipt.hpRecovered)) return null;
  if (event.mode === 'combat_defense') {
    if (!same(receipt.damagePrevented, receipt.damageBefore - receipt.damageAfter)
      || receipt.damageAdded !== 0 || receipt.hpSpent !== 0 || receipt.hpRecovered !== 0
      || receipt.movementDistance !== 0) return null;
    if (receipt.lethalPrevented && !(receipt.hpBefore > 0
      && receipt.damageBefore >= receipt.hpBefore
      && same(receipt.damageAfter, Math.max(0, receipt.hpBefore - 1)))) return null;
  } else if (!same(receipt.damageAfter, receipt.damageBefore + receipt.damageAdded)
    || receipt.damagePrevented !== 0 || receipt.existingShieldAbsorbed !== 0 || receipt.lethalPrevented) return null;
  return receipt;
}

export function buildTacticalEffectSummary(events, actorId) {
  const out = { uses: 0, recorded: 0, unrecorded: 0, hpRecovered: 0, hpSpent: 0,
    damagePrevented: 0, damageAdded: 0, lethalPrevented: 0, movementDistance: 0 };
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.kind !== 'skill' || String(event.who || '') !== String(actorId)
      || !['combat_attack', 'combat_defense'].includes(event.mode)) continue;
    out.uses += 1;
    const receipt = readTacticalEffectReceipt(event);
    if (!receipt) { out.unrecorded += 1; continue; }
    out.recorded += 1;
    for (const key of ['hpRecovered', 'hpSpent', 'damagePrevented', 'damageAdded', 'movementDistance']) out[key] += receipt[key];
    if (receipt.lethalPrevented) out.lethalPrevented += 1;
  }
  return out;
}

export function describeTacticalEffectReceipt(event) {
  const receipt = readTacticalEffectReceipt(event);
  if (!receipt) return '';
  const bits = [];
  if (receipt.lethalPrevented) bits.push('치명타격 무효');
  if (receipt.damagePrevented > 0) bits.push(`전술 단계 차단 ${receipt.damagePrevented} (통과 피해 ${receipt.damageAfter})`);
  if (receipt.damageAdded > 0) bits.push(`추가 원피해 ${receipt.damageAdded}`);
  if (receipt.hpRecovered > 0) bits.push(`실제 회복 ${receipt.hpRecovered}`);
  if (receipt.hpSpent > 0) bits.push(`HP 비용 ${receipt.hpSpent}`);
  if (receipt.hpSpent > 0 || receipt.hpRecovered > 0) bits.push(`HP ${receipt.hpBefore}→${receipt.hpAfter}`);
  if (receipt.movementDistance > 0) bits.push(`내부 이동 ${receipt.movementDistance}m`);
  bits.push(`발동 당시 재사용 대기 ${Math.max(0, receipt.cooldownUntil - event.at.sec)}초`);
  return bits.join(' · ');
}
