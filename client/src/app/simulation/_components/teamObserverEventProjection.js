import { observerEventActorIds } from '../_lib/teamObserverRuntime';

export function createTeamObserverEventProjection(ids) {
  const memberIds = new Set(ids);
  const relevance = new WeakMap();

  return {
    memberIds,
    project(events) {
      const source = Array.isArray(events) ? events : [];
      // The log publisher owns read-only snapshots. A weak key lets their
      // team membership survive later publications without retaining them.
      const selected = new Array(source.length);
      for (let index = 0; index < source.length; index += 1) {
        const event = source[index];
        if (!event || typeof event !== 'object') continue;

        let related = relevance.get(event);
        if (related === undefined) {
          related = observerEventActorIds(event).some((id) => memberIds.has(id));
          relevance.set(event, related);
        }
        // Preserve positions for same-time ordering and the displayed row keys.
        if (related) selected[index] = event;
      }
      return selected;
    },
  };
}
