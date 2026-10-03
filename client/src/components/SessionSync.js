'use client';

import { useEffect } from 'react';
import { getUser, refreshStoredAuthSession } from '../utils/api';

const RESYNC_INTERVAL_MS = 5 * 60 * 1000;

function hasCsrfCookie() {
  try {
    return document.cookie.split(';').some((part) => part.trim().startsWith('eh_csrf='));
  } catch {
    return false;
  }
}

// The header reads the signed-in user from localStorage. Ask the server once per
// load (and again after the tab has been away for a while) so that:
// - an expired or revoked cookie session stops showing as signed in
//   (apiRequest clears stored auth on AUTH_* 401 responses), and
// - LP, credits and perks shown in the header match the account.
export default function SessionSync() {
  useEffect(() => {
    let cancelled = false;
    let lastSyncAt = 0;

    const sync = async () => {
      if (!getUser() && !hasCsrfCookie()) return;
      lastSyncAt = Date.now();
      try {
        if (!cancelled) await refreshStoredAuthSession({ shouldApply: () => !cancelled });
      } catch {
        // Network errors keep the stored state; auth failures are handled in apiRequest.
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastSyncAt > RESYNC_INTERVAL_MS) sync();
    };

    sync();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
