import assert from 'node:assert/strict';
import { readTacticalEffectReceipt } from '../../src/app/simulation/_lib/tacticalEffectEvidenceRuntime.js';

const near = (left, right) => Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 1e-6;
const key = (who, opponent, sec) => JSON.stringify([String(who || ''), String(opponent || ''), sec]);

// Join committed damage to the exact defensive actor, attacker and shared-clock
// timestamp. Do not guess from names, nearby timestamps, or a later life.
export function buildTacticalImpactEvidence(events, { actorIds = [], sampleLimit = 12 } = {}) {
  const pending = new Map();
  const samples = [];
  const watched = new Set(actorIds.map(String));
  let activations = 0;
  let defenses = 0;
  let matchedDefenses = 0;
  let watchedDefenses = 0;
  for (const [index, event] of events.entries()) {
    if (event?.kind === 'skill' && event.source === 'tactical'
      && ['combat_attack', 'combat_defense'].includes(event.mode)) {
      const receipt = readTacticalEffectReceipt(event);
      assert.ok(receipt, `Current activation ${index} must have valid tactical-stage evidence.`);
      activations += 1;
      if (event.mode === 'combat_defense') {
        defenses += 1;
        assert.ok(event.opponentId, 'A real defense needs its triggering attacker, not an inferred name.');
        const identity = key(event.who, event.opponentId, event.at.sec);
        assert.ok(!pending.has(identity), 'A second defense may not overwrite an unobserved activation.');
        pending.set(identity, { event, index });
      } else if (watched.has(String(event.who)) && samples.length < sampleLimit) {
        samples.push({ activationIndex: index, activation: structuredClone(event),
          scope: 'actual tactical-stage recovery/cost/bonus; target HP damage is separate' });
      }
    }
    if (event?.kind !== 'damage') continue;
    const identity = key(event.targetId, event.who, event.at?.sec);
    const activation = pending.get(identity);
    if (!activation) continue;
    const receipt = activation.event.tacticalEffect;
    assert.ok(index > activation.index);
    assert.ok(near(event.hpBefore, receipt.hpBefore), 'The damage must start from this exact defensive HP.');
    assert.ok(near(event.hpBefore - event.hpAfter, event.hpDamage), 'Reported damage must equal committed HP loss.');
    assert.ok(near(event.damage - event.absorbed, receipt.damageAfter), 'The exact tactical remainder must feed the committed damage.');
    assert.ok(near(receipt.damageBefore + receipt.existingShieldAbsorbed, Math.floor(event.damage)),
      'Existing shields and tactical prevention must not be conflated.');
    if (receipt.lethalPrevented) assert.ok(near(event.hpAfter, 1), 'A lethal-prevention fact must actually leave 1 HP in this hit.');
    matchedDefenses += 1;
    if (watched.has(String(activation.event.who))) {
      watchedDefenses += 1;
      if (samples.length < sampleLimit) samples.push({ activationIndex: activation.index,
        activation: structuredClone(activation.event), damageIndex: index, damage: structuredClone(event),
        scope: 'exact defense stage followed by this committed HP hit; not whole-match survival causality' });
    }
    pending.delete(identity);
  }
  return { activations, defenses, matchedDefenses, watchedDefenses,
    unmatched: [...pending.values()].map(({ event, index }) => ({ activationIndex: index, who: event.who,
      opponentId: event.opponentId, atSec: event.at.sec })), samples };
}
