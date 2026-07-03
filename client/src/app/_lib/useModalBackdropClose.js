import { useRef } from 'react';

export function useModalBackdropClose({ dragThreshold = 8 } = {}) {
  const backdropPointerRef = useRef(null);

  const handleBackdropPointerDown = (event) => {
    if (event.target !== event.currentTarget) {
      backdropPointerRef.current = null;
      return;
    }
    backdropPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handleBackdropPointerUp = (event, closeModal) => {
    const start = backdropPointerRef.current;
    backdropPointerRef.current = null;
    if (!start || event.target !== event.currentTarget) return;
    const movedX = Math.abs(event.clientX - start.x);
    const movedY = Math.abs(event.clientY - start.y);
    if (movedX > dragThreshold || movedY > dragThreshold) return;
    const selection = typeof window !== 'undefined' ? window.getSelection?.() : null;
    if (selection && !selection.isCollapsed && String(selection.toString() || '').trim()) return;
    closeModal?.();
  };

  return {
    handleBackdropPointerDown,
    handleBackdropPointerUp,
  };
}
