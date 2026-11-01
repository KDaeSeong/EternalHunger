import { HUNGER_LIMITS, normalizeHungerEvent } from './hungerGameContract.js';
import { createHungerDraft } from './hungerGamePresets.js';

export function hungerEventDraftDestination(events, draft, originId) {
  const existing = events.find(event => event.id === draft.id);
  const replacesOrigin = Boolean(existing && existing.id === originId);
  const collision = Boolean(existing && !replacesOrigin);
  const atLimit = !replacesOrigin && events.length >= HUNGER_LIMITS.events;
  return { collision, atLimit, replacesOrigin,
    reason: collision ? `이 ID는 다른 저장된 이벤트 「${existing.title}」에서 사용합니다. 이 초안으로 다른 이벤트를 덮어쓸 수 없습니다. 원래 ID로 되돌리거나 새 ID로 복제해 주세요.`
      : atLimit ? `이벤트는 ${HUNGER_LIMITS.events}개까지 등록할 수 있습니다. 현재 초안은 유지되며 기존 동일 원본만 수정할 수 있습니다.` : '' };
}

export function prepareHungerEventSave(events, draft, originId) {
  const normalized = normalizeHungerEvent(draft);
  const destination = hungerEventDraftDestination(events, normalized, originId);
  if (destination.reason) throw new Error(destination.reason);
  return { event: normalized, events: destination.replacesOrigin
    ? events.map(event => event.id === normalized.id ? normalized : event)
    : [...events, normalized] };
}

function uniqueId(events, draftId, createId) {
  if (events.length >= HUNGER_LIMITS.events) throw new Error(`이벤트는 ${HUNGER_LIMITS.events}개까지 등록할 수 있습니다. 현재 초안은 그대로 유지됩니다.`);
  const used = new Set([...events.map(event => event.id), draftId]);
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = createId();
    if (!used.has(id)) {
      // Reuse the existing ID contract rather than inventing a second format.
      createHungerDraft(id);
      return id;
    }
  }
  throw new Error('새 이벤트 ID를 만들지 못했습니다. 현재 초안은 그대로 유지됩니다. 다시 시도해 주세요.');
}

export function createNewHungerEventDraft(events, createId) {
  return createHungerDraft(uniqueId(events, '', createId));
}

export function copyHungerEventDraft(events, draft, createId) {
  const normalized = normalizeHungerEvent(draft);
  const id = uniqueId(events, normalized.id, createId);
  return { ...normalized, id, title: normalized.title.slice(0, 114) + ' (복제)' };
}

export function parseHungerEventDraftJson(raw) {
  return normalizeHungerEvent(JSON.parse(raw));
}
