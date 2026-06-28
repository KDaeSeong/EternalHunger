'use client';

import { useSyncExternalStore } from 'react';
import { AUTH_SYNC_EVENT, getToken } from './api';

let cachedUserRaw;
let cachedUserValue = null;
let cachedAdminRaw;
let cachedAdminValue = false;

function readLocalStorage(key) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getUserSnapshot() {
  const raw = readLocalStorage('user') || 'null';
  if (raw === cachedUserRaw) return cachedUserValue;
  cachedUserRaw = raw;
  try {
    cachedUserValue = JSON.parse(raw);
  } catch {
    cachedUserValue = null;
  }
  return cachedUserValue;
}

function getAdminSnapshot() {
  const raw = readLocalStorage('user') || 'null';
  if (raw === cachedAdminRaw) return cachedAdminValue;
  cachedAdminRaw = raw;
  const user = getUserSnapshot();
  cachedAdminValue = Boolean(user?.isAdmin);
  return cachedAdminValue;
}

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
  return useSyncExternalStore(subscribe, getUserSnapshot, () => null);
}

export function useIsAdminSnapshot() {
  return useSyncExternalStore(subscribe, getAdminSnapshot, () => false);
}
