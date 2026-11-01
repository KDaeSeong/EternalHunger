import { createHungerRun } from './hungerGameRuntime.js';

export function createHungerPreview({ roster, event, matchMode, casting = {}, context, injuredByRole = {}, relationships = [], survivors = roster.length, duelPhases = 0, seed = 'preview' }) {
  const count = Number(survivors), duration = Number(duelPhases);
  if (!Number.isInteger(count) || count < 2 || count > roster.length) throw new Error('시험 생존자는 2명부터 전체 참가자 수까지 지정할 수 있습니다.');
  if (!Number.isInteger(duration) || duration < 0 || duration > 120) throw new Error('시험 대치 페이즈는 0~120으로 지정해 주세요.');
  const state = createHungerRun({ roster, events: [event], matchMode, seed, maxPhases: 120 });
  Object.assign(state, { day: context.day, phase: context.phase, weather: context.weather, location: context.location, phaseIndex: duration });
  const roles = state.input.events[0].roles;
  const assigned = Object.fromEntries(roles.map((role, index) => [role.key, casting[role.key] || roster[index]?.id]));
  const living = new Set(Object.values(assigned));
  if ([...living].some((id) => !state.actors.some((actor) => actor.id === id))) throw new Error('시험에 배정할 참가자를 확인해 주세요.');
  if (living.size !== roles.length) throw new Error('시험의 각 역할에는 서로 다른 참가자를 배정해 주세요.');
  if (!Array.isArray(relationships) || relationships.length > 6) throw new Error('시험 관계는 배역 쌍마다 하나씩, 6개 이내로 지정해 주세요.');
  const pairs = new Set();
  for (const relation of relationships) {
    if (!relation || typeof relation !== 'object' || Array.isArray(relation)
      || !Object.hasOwn(assigned, relation.left) || !Object.hasOwn(assigned, relation.right)
      || relation.left === relation.right || !['none', 'ally', 'enemy'].includes(relation.kind)) {
      throw new Error('시험 관계의 서로 다른 배역과 관계 종류를 확인해 주세요.');
    }
    const pair = JSON.stringify([relation.left, relation.right].sort());
    if (pairs.has(pair)) throw new Error('같은 배역 쌍의 시험 관계를 중복 지정할 수 없습니다.');
    pairs.add(pair);
    if (relation.kind !== 'none') state.relationships.push({ leftId: assigned[relation.left], rightId: assigned[relation.right], kind: relation.kind });
  }
  if (living.size > count) throw new Error('시험 생존자 수는 배정한 참가자 수 이상이어야 합니다.');
  for (const actor of state.actors) if (living.size < count) living.add(actor.id);
  for (const actor of state.actors) {
    actor.alive = living.has(actor.id);
    if (!actor.alive) actor.death = { phaseIndex: 0, cause: 'accident', eventId: 'preview' };
  }
  for (const role of roles) state.actors.find((actor) => actor.id === assigned[role.key]).injured = Boolean(injuredByRole[role.key]);
  return { state, assigned };
}
