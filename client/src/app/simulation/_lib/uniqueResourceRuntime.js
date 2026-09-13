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
  const after = roundResource(before - cost);
  actor.uniqueResource = resource;
  actor.uniqueResourceValue = after;
  return { paid: true, changed: true, cost, before, after, resource };
}

export function gainSkillResource(actor, skill) {
  const gain = normalizeSkillResourceAmount(skill?.resourceGain);
  const { resource, value: before } = getUniqueResourceSnapshot(actor);
  if (!resource.enabled || gain <= 0) return { changed: false, gain: 0, before, after: before, resource };
  const after = roundResource(Math.min(resource.maxValue, before + gain));
  actor.uniqueResource = resource;
  actor.uniqueResourceValue = after;
  return { changed: after > before, gain: roundResource(after - before), before, after, resource };
}

export function advanceUniqueResource(actor, elapsedSec) {
  const { resource, value: before } = getUniqueResourceSnapshot(actor);
  const elapsed = Math.max(0, finiteNumber(elapsedSec, 0));
  if (!resource.enabled || resource.regenPerSec <= 0 || elapsed <= 0) {
    return { changed: false, gained: 0, before, after: before, resource };
  }
  const after = roundResource(Math.min(resource.maxValue, before + resource.regenPerSec * elapsed));
  actor.uniqueResource = resource;
  actor.uniqueResourceValue = after;
  return { changed: after > before, gained: roundResource(after - before), before, after, resource };
}

export { DEFAULT_UNIQUE_RESOURCE };
