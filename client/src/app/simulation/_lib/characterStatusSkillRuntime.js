import { getStoredActiveStatusEffects, getStatusProtectionReason, getStatusDurationAdjustment,
  hasEffectImmunity, isHarmfulStatusEffect, isTargetableByStatus } from '../../../utils/statusLogic.js';
import { normalizeCharacterStatusEffects } from '../../../utils/characterStatusSkillDefinition.js';
import { areSameTeam } from './teamRuntime.js';
import { applyStatusEffect } from './runtimeStatusApplication.js';
import { emitEffectRunEvents } from './runEventRuntime.js';
import { shareCombatSpace } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';

const idOf = (actor) => String(actor?._id || actor?.id || '');
const sameSide = (a, b) => idOf(a) === idOf(b) || areSameTeam(a, b);
function runtimeEffect(entry, caster, payload = {}) {
  const { target: _target, durationSec, ...fields } = entry;
  return { ...fields, remainingDuration: durationSec, durationUnit: 'sec',
    sourceId: payload.sourceId || '', sourceActorId: idOf(caster), tags: ['character_skill'] };
}
function validRecipient(caster, target, entry) {
  return target && target.hp > 0 && shareCombatSpace(caster, target) && isTargetableByStatus(target)
    && (isHarmfulStatusEffect(entry) ? !sameSide(caster, target) : sameSide(caster, target));
}

// Pure AI estimate: probabilistic resistance is resolved only at actual release.
// Project policy: refresh a state only after at least half its new duration has
// elapsed. A cleanse has value only when a stored harmful effect can be removed.
export function getCharacterStatusSkillValue(caster, skillTarget, def) {
  let value = 0;
  for (const entry of def?.statusEffects || []) {
    const target = entry.target === 'self' ? caster : skillTarget;
    if (!validRecipient(caster, target, entry)) continue;
    const stored = getStoredActiveStatusEffects(target);
    if (entry.name === '해로운 효과 제거') {
      value += stored.filter(isHarmfulStatusEffect).length * 30;
      continue;
    }
    const effect = runtimeEffect(entry, caster);
    if (getStatusProtectionReason(target, effect) || hasEffectImmunity(target, effect, { random: () => 1 }).immune) continue;
    const duration = getStatusDurationAdjustment(target, effect)?.appliedSec ?? entry.durationSec;
    if (duration <= 0) continue;
    const current = stored.find((row) => row.name === entry.name);
    if (current && (current.remainingDuration == null || current.remainingDuration > duration / 2)) continue;
    value += 20 + Math.min(5, duration) * 10;
  }
  return value;
}

export function makeCharacterStatusPayload(def, prepared) {
  const effects = normalizeCharacterStatusEffects(def, def.slot);
  if (!effects.length) return null;
  return { effects, skill: def.name, sourceId: def.id, slot: def.slot, castId: prepared?.castId || '' };
}

// Called after this hit's complete damage/weapon batch, never during previews
// or at cast start. A shield/invulnerability blocks damage, not targetable CC.
export function applyCharacterSkillStatusEffects(caster, skillTarget, payload, opts = {}) {
  if (!payload || caster?.hp <= 0 || isDimensionRiftDefeated(caster)) return [];
  const results = [];
  for (const entry of payload.effects) {
    const self = entry.target === 'self';
    if (self ? opts.onlyTarget : opts.allowTarget === false) continue;
    const target = self ? caster : skillTarget;
    if (!validRecipient(caster, target, entry)) continue;
    const result = applyStatusEffect(target, runtimeEffect(entry, caster, payload),
      { sourceActor: caster, nowSec: opts.at?.sec, at: opts.at, emitRunEvent: opts.emitRunEvent, addLog: opts.addLog });
    results.push({ targetId: idOf(target), ...result });
    emitEffectRunEvents((kind, data, at) => opts.emitRunEvent?.(kind, { ...data, castId: payload.castId, slot: payload.slot }, at),
      target, [result], { source: 'character_skill', skill: payload.skill, reason: 'skill_impact' }, opts.at);
    const outcome = result.reason === 'cleansed' ? `정화: ${(result.removed || []).map((row) => row.name).join(', ') || '제거할 상태 없음'}`
      : result.applied ? `${entry.name} ${result.effect.remainingDuration}초${result.suppressedBy ? ` (${result.suppressedBy}로 일시 무시)` : ''}`
        : `${entry.name} 적용 실패: ${result.immunityType || result.reason}`;
    opts.addLog?.(`[${caster.name}] ${payload.skill} → [${target.name}] ${outcome}`, 'combat-detail');
  }
  return results;
}
