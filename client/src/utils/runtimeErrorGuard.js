export function formatRuntimeReason(reason) {
  if (!reason) return '';
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
  if (typeof reason === 'string') return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

export function isReferenceLikeError(reason) {
  const name = String(reason?.name || '');
  const message = String(reason?.message || reason || '');
  return name === 'ReferenceError' || /ReferenceError|is not defined|before initialization/i.test(message);
}

export function bindReferenceErrorGuards(handlers = {}) {
  if (typeof window === 'undefined') return () => {};

  const {
    onReferenceError = () => {},
    suppressDefault = false,
  } = handlers;

  const onWindowError = (event) => {
    const reason = event?.error || event?.message;
    if (!isReferenceLikeError(reason)) return;
    onReferenceError(reason, 'window.error');
    if (suppressDefault && typeof event?.preventDefault === 'function') event.preventDefault();
  };

  const onUnhandledRejection = (event) => {
    const reason = event?.reason;
    if (!isReferenceLikeError(reason)) return;
    onReferenceError(reason, 'unhandledrejection');
    if (suppressDefault && typeof event?.preventDefault === 'function') event.preventDefault();
  };

  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  return () => {
    window.removeEventListener('error', onWindowError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}
