'use client';

import { useSyncExternalStore } from 'react';
import { AUTH_SYNC_EVENT, getToken, getUser, isAdmin } from './api';

function subscribe(callback) {
  if (typeof window === 'undefined') return () => {};

  const onChange = () => callback();
  window.addEventListener(AUTH_SYNC_EVENT, onChange);
  window.addEventListener('storage', onChange);

  return () => {
    window.removeEventListener(AUTH_SYNC_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function useAuthToken() {
  return useSyncExternalStore(subscribe, () => getToken(), () => null);
}

export function useAuthUser() {
  return useSyncExternalStore(subscribe, () => getUser(), () => null);
}

export function useIsAdminSnapshot() {
  return useSyncExternalStore(subscribe, () => isAdmin(), () => false);
}
