const { findCharacterSkillChoice, startCharacterCast, finishCharacterCast } = await import('../../src/app/simulation/_lib/characterCastRuntime.js');
const { areSameTeam } = await import('../../src/app/simulation/_lib/teamRuntime.js');

// Unit checks which need an immediate skill must explicitly execute its cast
// lifecycle. Nonzero cast time is intentionally rejected here, not bypassed.
export function releaseInstantSkill(actor, roster, nowSec, settings, release, actions = {}) {
  const opponents = roster.filter((row) => !areSameTeam(actor, row));
  const choice = findCharacterSkillChoice(actor, opponents, roster, nowSec, settings);
  if (!choice || choice.atSec > nowSec) return false;
  if (choice.decision.timing.castDelaySec !== 0) throw new Error('Use the real clock fixture for delayed skills.');
  if (!startCharacterCast(actor, choice, nowSec, settings, actions)) return false;
  const prepared = finishCharacterCast(actor, nowSec, actions);
  if (prepared) release(roster.find((row) => String(row._id) === prepared.targetId), prepared);
  return true;
}
