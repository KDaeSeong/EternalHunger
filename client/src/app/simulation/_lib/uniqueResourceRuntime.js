const DEFAULT_UNIQUE_RESOURCE = Object.freeze({
  enabled: false,
  name: '고유 자원',
  maxValue: 100,
  startValue: 0,
  regenPerSec: 0,
});

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finiteNumber(value, min)));
}

function roundResource(value) {
  return Math.round(finiteNumber(value, 0) * 1000) / 1000;
}

export function normalizeUniqueResourceDefinition(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const maxValue = roundResource(clamp(finiteNumber(source.maxValue, DEFAULT_UNIQUE_RESOURCE.maxValue), 1, 10000));
  return {
    enabled: source.enabled === true,
    name: String(source.name || DEFAULT_UNIQUE_RESOURCE.name).trim().slice(0, 30) || DEFAULT_UNIQUE_RESOURCE.name,
    maxValue,
    startValue: roundResource(clamp(source.startValue, 0, maxValue)),
    regenPerSec: roundResource(clamp(source.regenPerSec, 0, 100)),
  };
}

export function normalizeUniqueResourceValue(definition, value) {
  const resource = normalizeUniqueResourceDefinition(definition);
  const fallback = resource.enabled ? resource.startValue : 0;
  const current = value == null ? fallback : finiteNumber(value, 0);
  return roundResource(clamp(current, 0, resource.maxValue));
}

export function normalizeSkillResourceAmount(value) {
  return roundResource(clamp(value, 0, 10000));
}

export function getUniqueResourceSnapshot(actor) {
  const resource = normalizeUniqueResourceDefinition(actor?.uniqueResource);
  const value = normalizeUniqueResourceValue(resource, actor?.uniqueResourceValue);
  return { resource, value };
}

// Keep sub-display recovery across copied/serialized actors. A receipt belongs
// only to its exact definition and visible balance; legacy or edited state has
// no implicit credit. The signed residue compensates display rounding.
function regenerationRemainder(actor, resource, value) {
  const state = actor?._uniqueResourceRegen;
  const remainder = state?.remainder;
  return resource.enabled && value < resource.maxValue
    && state?.definition === JSON.stringify(resource) && state?.value === value
    && Number(actor?.uniqueResourceValue) === value
    && typeof remainder === 'number' && Number.isFinite(remainder) && Math.abs(remainder) <= 0.000500000001
    && value + remainder >= 0 ? remainder : 0;
}

export function normalizeUniqueResourceRegeneration(actor) {
  if (!actor?._uniqueResourceRegen) return undefined;
  const { resource, value } = getUniqueResourceSnapshot(actor);
  const remainder = regenerationRemainder(actor, resource, value);
  return remainder ? { definition: JSON.stringify(resource), value, remainder } : undefined;
}

function commitResourceValue(actor, resource, exact) {
  const bounded = Math.max(0, Math.min(resource.maxValue, Math.round(exact * 1e12) / 1e12));
  const after = roundResource(bounded);
  const remainder = after >= resource.maxValue || bounded <= 0 ? 0 : Math.round((bounded - after) * 1e12) / 1e12;
  actor.uniqueResource = resource;
  actor.uniqueResourceValue = after;
  if (remainder) actor._uniqueResourceRegen = { definition: JSON.stringify(resource), value: after, remainder };
  else delete actor._uniqueResourceRegen;
  return after;
}

export function canPaySkillResource(actor, skill) {
  const cost = normalizeSkillResourceAmount(skill?.resourceCost);
  if (cost <= 0) return true;
  const { resource, value } = getUniqueResourceSnapshot(actor);
  return resource.enabled && value >= cost;
}

export function spendSkillResource(actor, skill) {
  const cost = normalizeSkillResourceAmount(skill?.resourceCost);
  const { resource, value: before } = getUniqueResourceSnapshot(actor);
  if (cost <= 0) return { paid: true, changed: false, cost: 0, before, after: before, resource };
  if (!resource.enabled || before < cost) return { paid: false, changed: false, cost, before, after: before, resource };
  const after = commitResourceValue(actor, resource, before - cost + regenerationRemainder(actor, resource, before));
  return { paid: true, changed: true, cost, before, after, resource };
}

export function gainSkillResource(actor, skill) {
  const gain = normalizeSkillResourceAmount(skill?.resourceGain);
  const { resource, value: before } = getUniqueResourceSnapshot(actor);
  if (!resource.enabled || gain <= 0) return { changed: false, gain: 0, before, after: before, resource };
  const after = commitResourceValue(actor, resource, before + gain + regenerationRemainder(actor, resource, before));
  return { changed: after > before, gain: roundResource(after - before), before, after, resource };
}

export function advanceUniqueResource(actor, elapsedSec) {
  const { resource, value: before } = getUniqueResourceSnapshot(actor);
  const elapsed = Math.max(0, finiteNumber(elapsedSec, 0));
  if (!resource.enabled || resource.regenPerSec <= 0 || elapsed <= 0) {
    return { changed: false, gained: 0, before, after: before, resource };
  }
  const after = commitResourceValue(actor, resource,
    before + regenerationRemainder(actor, resource, before) + resource.regenPerSec * elapsed);
  return { changed: after > before, gained: roundResource(after - before), before, after, resource };
}

export { DEFAULT_UNIQUE_RESOURCE };
