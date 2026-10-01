import { createHungerRun } from './hungerGameRuntime.js';

export function createHungerPreview({ roster, event, casting = {}, context, injuredByRole = {}, survivors = roster.length, duelPhases = 0, seed = 'preview' }) {
  const count = Number(survivors), duration = Number(duelPhases);
  if (!Number.isInteger(count) || count < 2 || count > roster.length) throw new Error('시험 생존자는 2명부터 전체 참가자 수까지 지정할 수 있습니다.');
  if (!Number.isInteger(duration) || duration < 0 || duration > 120) throw new Error('시험 대치 페이즈는 0~120으로 지정해 주세요.');
  const state = createHungerRun({ roster, events: [event], seed, maxPhases: 120 });
  Object.assign(state, { day: context.day, phase: context.phase, weather: context.weather, location: context.location, phaseIndex: duration });
  const assigned = Object.fromEntries(event.roles.map((role, index) => [role.key, casting[role.key] || roster[index]?.id]));
  const living = new Set(Object.values(assigned));
  if ([...living].some((id) => !state.actors.some((actor) => actor.id === id))) throw new Error('시험에 배정할 참가자를 확인해 주세요.');
  if (living.size > count) throw new Error('시험 생존자 수는 배정한 참가자 수 이상이어야 합니다.');
  for (const actor of state.actors) if (living.size < count) living.add(actor.id);
  for (const actor of state.actors) {
    actor.alive = living.has(actor.id);
    if (!actor.alive) actor.death = { phaseIndex: 0, cause: 'accident', eventId: 'preview' };
  }
  for (const role of event.roles) state.actors.find((actor) => actor.id === assigned[role.key]).injured = Boolean(injuredByRole[role.key]);
  return { state, assigned };
}
