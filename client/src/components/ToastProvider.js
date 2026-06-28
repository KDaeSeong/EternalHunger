'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const DEFAULT_DURATION_MS = 3200;

function normalizeToast(input) {
  if (typeof input === 'string') return { message: input };
  return input && typeof input === 'object' ? input : { message: '' };
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextIdRef = useRef(1);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input) => {
    const toast = normalizeToast(input);
    const message = String(toast.message || '').trim();
    if (!message) return null;

    const id = nextIdRef.current;
    nextIdRef.current += 1;

    const nextToast = {
      id,
      tone: toast.tone || 'info',
      title: toast.title || '',
      message,
    };

    setToasts((current) => [...current.slice(-3), nextToast]);

    const durationMs = Number(toast.durationMs ?? DEFAULT_DURATION_MS);
    if (durationMs > 0) {
      window.setTimeout(() => dismissToast(id), durationMs);
    }

    return id;
  }, [dismissToast]);

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="app-toast-region" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`app-toast app-toast--${toast.tone}`}>
            {toast.title ? <strong>{toast.title}</strong> : null}
            <span>{toast.message}</span>
            <button type="button" onClick={() => dismissToast(toast.id)} aria-label="알림 닫기">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context) return context;

  return {
    showToast(input) {
      const toast = normalizeToast(input);
      if (toast.message) console.info(toast.message);
      return null;
    },
    dismissToast() {},
  };
}
