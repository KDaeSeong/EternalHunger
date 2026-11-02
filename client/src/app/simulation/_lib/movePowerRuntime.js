import { buildErBehaviorModifier } from '../../../utils/erMeta';
import { getPerkAggressionBias } from './perkRuntime';
import { getCombatEquipment } from '../../../utils/battleEquipmentLogic.js';
import { getCombatPowerBreakdown } from './combatPowerEstimateRuntime.js';

// Brand only functions created here. External estimators may mutate their
// inputs, so route planners must not reuse their roster-derived facts.
const planningPowerSnapshots = new WeakSet();
export function isPlanningMovePowerSnapshot(estimatePower) {
  return planningPowerSnapshots.has(estimatePower);
}

function combatScoreForMovePower(actor, context = {}) {
  return getCombatPowerBreakdown(actor, context.battleSettings || {}).total;
}

function summarizeEquipTierForMovePower(actor) {
  // Use the same equipped items as actual damage. Stored spares contribute
  // nothing; legacy actors without an equipped map still resolve one per slot.
  const inv = getCombatEquipment(actor);
  let weaponTier = 0;
  let armorTierSum = 0;
  for (const item of inv) {
    const slot = String(item?.equipSlot || '');
    const value = Number(item?.tier || 1);
    const tier = Number.isFinite(value) ? Math.max(1, value) : 1;
    const type = String(item?.type || '').toLowerCase();
    if (slot === 'weapon' || ['weapon', '무기', 'armory', '병기'].includes(type) || item?.tags?.includes('weapon')) weaponTier = Math.max(weaponTier, tier);
    else if (slot === 'head' || slot === 'clothes' || slot === 'arm' || slot === 'shoes') armorTierSum += tier;
  }
  return { weaponTier, armorTierSum, equippedCount: inv.length };
}

function estimateMovePower(actor, context = {}) {
  const base = combatScoreForMovePower(actor, context);
  const battleSettings = context?.battleSettings || {};
  const er = buildErBehaviorModifier(actor, battleSettings);
  return base + Number(er?.powerScore || 0);
}

// Sort one local candidate list without recomputing the pure internal score
// from the comparator. Keep the historical coercion and stable tie behavior.
export function sortActorsByMovePowerDescending(rows, context = {}) {
  const candidates = Array.isArray(rows) ? rows : [];
  if (candidates.length < 2) return candidates.slice();
  return candidates.map((actor) => ({
    actor,
    score: Number(estimateMovePower(actor, context) || 0),
  })).sort((a, b) => b.score - a.score).map(({ actor }) => actor);
}

// Team path searches only relocate shallow copies of this pre-action roster.
// HP, equipment, statuses and mastery stay fixed until the complete planning
// boundary has finished. Compute that strength once, not for every graph node.
// The closure belongs to ONE boundary; never keep it on an actor or in a frame.
export function createPlanningMovePowerSnapshot(roster, context = {}) {
  const rows = new Map(), ambiguous = new Set();
  for (const actor of Array.isArray(roster) ? roster : []) {
    if (!actor) continue;
    const id = String(actor._id || actor.id || '');
    if (!id) continue;
    if (rows.has(id)) ambiguous.add(id);
    else rows.set(id, actor);
  }
  const scores = new Map();
  for (const [id, actor] of rows) {
    if (!ambiguous.has(id)) scores.set(id, estimateMovePower(actor, context));
  }
  const estimatePlanningPower = (actor) => {
    const id = String(actor?._id || actor?.id || '');
    return scores.has(id) ? scores.get(id) : estimateMovePower(actor, context);
  };
  planningPowerSnapshots.add(estimatePlanningPower);
  return estimatePlanningPower;
}

function shouldAvoidCombatByMovePower(me, opponent, context = {}) {
  const ruleset = context?.ruleset || {};
  const battleSettings = context?.battleSettings || {};
  const myPower = estimateMovePower(me, context);
  const opponentPower = estimateMovePower(opponent, context);
  const ratio = myPower / Math.max(1, myPower + opponentPower);
  const aggroBias = Math.max(0, getPerkAggressionBias(me));
  const er = buildErBehaviorModifier(me, battleSettings);
  const minRatioBase = Number(ruleset?.ai?.fightAvoidMinRatio ?? 0.40);
  const absDeltaBase = Number(ruleset?.ai?.fightAvoidAbsDelta ?? 10);
  const minRatio = Math.max(0.18, minRatioBase - aggroBias * 0.08 - Number(er?.aggressionBias || 0) * 0.18 - Number(er?.escapeBonus || 0) * 0.10);
  const absDelta = Math.max(0, absDeltaBase + aggroBias * 12 + Number(er?.chaseBonus || 0) * 18);
  if (ratio < minRatio || (opponentPower - myPower) >= absDelta) {
    return { myP: myPower, opP: opponentPower, ratio, scope: 'duel', minRatio, absDelta };
  }
  return null;
}

export {
  combatScoreForMovePower,
  estimateMovePower,
  shouldAvoidCombatByMovePower,
  summarizeEquipTierForMovePower,
};
