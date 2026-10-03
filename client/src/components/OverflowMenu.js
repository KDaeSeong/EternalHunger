'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

// "더보기" button with a short list of less frequent actions.
// items: [{ label, onSelect, danger }]
export default function OverflowMenu({ label = '더보기', items = [], className = '' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={`ui-overflow ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="ui-overflow__trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      <div className="ui-overflow__menu" id={menuId} hidden={!open}>
        {items.map((item) => (
          <button
            type="button"
            key={item.label}
            className={item.danger ? 'is-danger' : ''}
            onClick={() => {
              setOpen(false);
              item.onSelect?.();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
