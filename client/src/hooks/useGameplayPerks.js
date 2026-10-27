'use client';

import { useEffect, useRef, useState } from 'react';
import {
  GAMEPLAY_GAME_LABELS,
  gameplayPerkProductsForGame,
  normalizeGameplayPerkAccount,
  normalizeGameplayPerkCodes,
} from '../utils/gameplayPerks';
import { AUTH_SYNC_EVENT, apiGet, captureAuthSession, getToken, getUser, isCurrentAuthSession } from '../utils/api';

function userIdentity(user) {
  return String(user?.id || user?._id || user?.username || '').trim();
}

function readIdentity(gameSlug) {
  const user = getUser();
  const token = getToken();
  const session = captureAuthSession();
  const identity = userIdentity(user);
  const authenticated = Boolean(token && identity && session?.scope);
  const ownedCodes = authenticated ? normalizeGameplayPerkCodes(user?.perks, gameSlug) : [];
  const equippedCodes = authenticated
    ? normalizeGameplayPerkCodes(user?.perkLoadouts?.[gameSlug], gameSlug, ownedCodes)
    : [];
  const signature = JSON.stringify([ownedCodes, equippedCodes]);
  const key = JSON.stringify([gameSlug, session?.scope || '', session?.revision || 0, session?.csrfToken || '', identity, signature]);
  return { user, token, session, identity, authenticated, ownedCodes, equippedCodes, signature, key };
}

function staleSessionError() {
  const error = new Error('계정이 바뀌어 특전 정보를 적용하지 않았습니다. 다시 시도해 주세요.');
  error.code = 'GAMEPLAY_PERK_SESSION_CHANGED';
  return error;
}

export default function useGameplayPerks(gameSlug) {
  const knownGame = Object.hasOwn(GAMEPLAY_GAME_LABELS, gameSlug);
  const fallbackProducts = gameplayPerkProductsForGame(gameSlug);
  const identity = readIdentity(gameSlug);
  const [, setAuthSignal] = useState(0);
  const [snapshot, setSnapshot] = useState(null);
  const mountedRef = useRef(false);
  const requestEpochRef = useRef(0);
  const automaticRequestRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const targetWindow = window;
    const onAuthChange = () => setAuthSignal((value) => value + 1);
    const onStorage = (event) => {
      if (!event?.key || event.key === 'user' || event.key === 'eh_auth_sync_ts') onAuthChange();
    };
    targetWindow.addEventListener(AUTH_SYNC_EVENT, onAuthChange);
    targetWindow.addEventListener('storage', onStorage);
    return () => {
      targetWindow.removeEventListener(AUTH_SYNC_EVENT, onAuthChange);
      targetWindow.removeEventListener('storage', onStorage);
    };
  }, []);

  async function fetchContext({ expectedKey, dedupeAutomatic = false } = {}) {
    const requestIdentity = readIdentity(gameSlug);
    if (!knownGame || !requestIdentity.authenticated) {
      return {
        products: fallbackProducts,
        ownedCodes: [],
        equippedCodes: [],
        status: 'guest',
        error: null,
      };
    }
    const key = requestIdentity.key;
    if (expectedKey && key !== expectedKey) throw staleSessionError();
    if (dedupeAutomatic && automaticRequestRef.current?.key === key) {
      return automaticRequestRef.current.promise;
    }

    const epoch = ++requestEpochRef.current;
    const requestToken = {};
    if (mountedRef.current) {
      setSnapshot({
        requestKey: key,
        products: fallbackProducts,
        ownedCodes: requestIdentity.ownedCodes,
        equippedCodes: requestIdentity.equippedCodes,
        status: 'loading',
        error: null,
      });
    }

    const request = (async () => {
      try {
        const payload = await apiGet('/perks/available');
        const liveIdentity = readIdentity(gameSlug);
        if (epoch !== requestEpochRef.current || !isCurrentAuthSession(requestIdentity.session)
          || liveIdentity.key !== key || userIdentity(payload?.user) !== requestIdentity.identity
          || !Array.isArray(payload?.perks) || !payload?.user || typeof payload.user !== 'object') {
          throw staleSessionError();
        }
        const account = normalizeGameplayPerkAccount(payload, gameSlug);
        const context = { ...account, status: 'ready', error: null };
        if (mountedRef.current) setSnapshot({ ...context, requestKey: key });
        return context;
      } catch (error) {
        const liveIdentity = readIdentity(gameSlug);
        const stillCurrent = epoch === requestEpochRef.current
          && isCurrentAuthSession(requestIdentity.session) && liveIdentity.key === key;
        if (stillCurrent && mountedRef.current) {
          setSnapshot({
            requestKey: key,
            products: fallbackProducts,
            ownedCodes: requestIdentity.ownedCodes,
            equippedCodes: [],
            status: 'error',
            error,
          });
        }
        throw error;
      } finally {
        if (automaticRequestRef.current?.requestToken === requestToken) automaticRequestRef.current = null;
      }
    })();
    if (dedupeAutomatic) automaticRequestRef.current = { key, promise: request, requestToken };
    return request;
  }

  useEffect(() => {
    if (!knownGame || !identity.authenticated) {
      setSnapshot({
        requestKey: identity.key,
        products: fallbackProducts,
        ownedCodes: [],
        equippedCodes: [],
        status: 'guest',
        error: null,
      });
      return;
    }
    void fetchContext({ expectedKey: identity.key, dedupeAutomatic: true }).catch(() => {});
    // Auth events trigger a render only; changed wallet/profile fields do not
    // refetch unless the account or equipped/owned signature changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity.key, gameSlug, knownGame]);

  const visibleSnapshot = snapshot?.requestKey === identity.key
    ? snapshot
    : identity.authenticated
      ? {
        products: fallbackProducts,
        ownedCodes: identity.ownedCodes,
        equippedCodes: identity.equippedCodes,
        status: 'loading',
        error: null,
      }
      : { products: fallbackProducts, ownedCodes: [], equippedCodes: [], status: 'guest', error: null };

  const refresh = () => fetchContext({ expectedKey: readIdentity(gameSlug).key });
  const captureForNewRun = async ({ withoutPerks = false } = {}) => {
    if (withoutPerks) return [];
    const current = readIdentity(gameSlug);
    if (!current.authenticated) return [];
    const context = await fetchContext({ expectedKey: current.key });
    if (context.status !== 'ready') throw staleSessionError();
    return normalizeGameplayPerkCodes(context.equippedCodes, gameSlug, context.ownedCodes)
      .filter((code) => context.products.some((product) => product.code === code && product.isActive === true));
  };

  return {
    products: visibleSnapshot.products,
    ownedCodes: visibleSnapshot.ownedCodes,
    equippedCodes: visibleSnapshot.equippedCodes,
    status: visibleSnapshot.status,
    error: visibleSnapshot.error,
    refresh,
    captureForNewRun,
  };
}
