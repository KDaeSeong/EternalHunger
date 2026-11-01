import { normalizeHungerRoster } from './hungerGameContract.js';

export function parseHungerItemDraft(text) {
  const items = text.split(',').map((item) => item.trim()).filter(Boolean);
  try {
    const normalized = normalizeHungerRoster([{ id: 'item-editor', name: '아이템 편집', items }])[0].items;
    return { items: normalized, error: '' };
  } catch (error) {
    return { items: null, error: error.message };
  }
}

export function createHungerRosterImageRequests() {
  const requests = new Map();
  let active = true;
  return {
    begin(id) { if (!active) return null; const token = {}; requests.set(id, token); return token; },
    isCurrent(id, token) { return active && requests.get(id) === token; },
    invalidate(id) { requests.delete(id); },
    retain(ids) { for (const id of requests.keys()) if (!ids.has(id)) requests.delete(id); },
    reset() { requests.clear(); },
    activate() { active = true; },
    deactivate() { active = false; requests.clear(); },
  };
}
