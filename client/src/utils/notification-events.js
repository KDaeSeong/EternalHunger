'use client';

export const NOTIFICATIONS_SYNC_EVENT = 'eh:notifications-sync';
export const NOTIFICATIONS_SYNC_STORAGE_KEY = 'eh_notifications_sync';

export function emitNotificationsSync(detail = {}) {
  if (typeof window === 'undefined') return;

  const payload = {
    at: Date.now(),
    ...(detail && typeof detail === 'object' ? detail : {}),
  };

  try {
    window.localStorage.setItem(NOTIFICATIONS_SYNC_STORAGE_KEY, JSON.stringify(payload));
  } catch {}

  try {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_SYNC_EVENT, { detail: payload }));
  } catch {}
}
