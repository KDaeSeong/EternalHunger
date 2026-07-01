import { itemDisplayName, safeTags } from './simulationCommon';

export const SATIETY_DEFAULT = 70;
export const SATIETY_MAX = 100;

export function normalizeSatiety(value, fallback = SATIETY_DEFAULT) {
  const n = Number(value);
  const base = Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.min(SATIETY_MAX, Math.round(base)));
}

export function applySatietyGain(actor, amount) {
  if (!actor || typeof actor !== 'object') return 0;
  const gain = Math.max(0, Math.round(Number(amount || 0)));
  if (gain <= 0) {
    actor.satiety = normalizeSatiety(actor.satiety);
    return 0;
  }
  const before = normalizeSatiety(actor.satiety);
  actor.satiety = normalizeSatiety(before + gain, before);
  return Math.max(0, actor.satiety - before);
}

export function decayActorSatiety(actor, amount) {
  if (!actor || typeof actor !== 'object') return 0;
  const decay = Math.max(0, Number(amount || 0));
  const before = normalizeSatiety(actor.satiety);
  actor.satiety = normalizeSatiety(before - decay, before);
  return Math.max(0, before - actor.satiety);
}

export function isFoodRecoveryItem(item) {
  const tags = safeTags(item).map((t) => String(t || '').toLowerCase());
  const type = String(item?.type || '').toLowerCase();
  const name = itemDisplayName(item);
  const lower = String(name || '').toLowerCase();
  if (lower.includes('bandage') || name.includes('붕대')) return false;
  return (
    type === 'food' ||
    tags.includes('food') ||
    tags.includes('healthy') ||
    lower.includes('food') ||
    lower.includes('apple') ||
    lower.includes('steak') ||
    name.includes('음식') ||
    name.includes('사과') ||
    name.includes('스테이크') ||
    name.includes('빵') ||
    name.includes('고기') ||
    name.includes('치킨')
  );
}
