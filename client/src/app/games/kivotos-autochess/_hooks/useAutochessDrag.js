'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { crossedDragThreshold, edgeScrollDelta, parseDropTarget } from '../_lib/autochessDrag.js';

export default function useAutochessDrag({ enabled, owner, runId, round, scopeRef, onStart, onDrop, onCancel }) {
  const active = useRef(null), frame = useRef(0), suppressClick = useRef(false), rendered = useRef(null);
  const config = useRef({ enabled, owner, runId, round, scopeRef, onStart, onDrop, onCancel });
  const [view, setView] = useState(null);

  useEffect(() => {
    config.current = { enabled, owner, runId, round, scopeRef, onStart, onDrop, onCancel };
  });

  const finish = useCallback(() => {
    const record = active.current;
    active.current = null;
    cancelAnimationFrame(frame.current); frame.current = 0;
    if (record?.moved) {
      suppressClick.current = true;
      rendered.current = null; setView(null);
    }
    try {
      if (record?.element.hasPointerCapture(record.pointerId)) record.element.releasePointerCapture(record.pointerId);
    } catch { /* The source may have unmounted during an account or phase change. */ }
    return record;
  }, []);

  const cancel = useCallback(() => {
    const record = finish();
    if (record?.moved) config.current.onCancel();
  }, [finish]);

  useEffect(() => cancel, [enabled, owner, runId, round, cancel]);
  useEffect(() => {
    const hide = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [cancel]);

  const validContext = record => {
    const current = config.current;
    return current.enabled && current.owner === record.owner &&
      current.runId === record.runId && current.round === record.round;
  };
  const targetAt = (x, y) => {
    const element = document.elementFromPoint(x, y)?.closest('[data-ac-drop]');
    if (!element || element.disabled || !config.current.scopeRef.current?.contains(element)) return null;
    const key = element.getAttribute('data-ac-drop'), position = parseDropTarget(key);
    return position ? { key, position } : null;
  };

  const onPointerDown = (event, unit) => {
    if (!config.current.enabled || !unit || active.current || event.button !== 0 || event.isPrimary === false) return;
    const current = config.current;
    const record = {
      uid: unit.uid, studentId: unit.studentId, star: unit.star, sourcePosition: { ...unit.position },
      owner: current.owner, runId: current.runId, round: current.round,
      pointerId: event.pointerId, element: event.currentTarget,
      start: { x: event.clientX, y: event.clientY }, x: event.clientX, y: event.clientY, moved: false,
    };
    record.tick = () => {
      if (active.current !== record) return;
      if (!validContext(record)) { cancel(); return; }
      const target = targetAt(record.x, record.y);
      const next = { uid: record.uid, studentId: record.studentId, star: record.star,
        x: record.x, y: record.y, dropKey: target?.key || '' };
      const previous = rendered.current;
      if (!previous || previous.x !== next.x || previous.y !== next.y || previous.dropKey !== next.dropKey) {
        rendered.current = next; setView(next);
      }
      const scroll = edgeScrollDelta(record.y, window.innerHeight);
      if (scroll) window.scrollBy(0, scroll);
      frame.current = requestAnimationFrame(record.tick);
    };
    active.current = record;
    try { event.currentTarget.setPointerCapture(event.pointerId); }
    catch { active.current = null; }
  };
  const onPointerMove = event => {
    const record = active.current;
    if (!record || event.pointerId !== record.pointerId) return;
    if (!validContext(record) || event.buttons === 0) { cancel(); return; }
    record.x = event.clientX; record.y = event.clientY;
    if (!record.moved && crossedDragThreshold(record.start, { x: record.x, y: record.y })) {
      record.moved = true;
      config.current.onStart(record.uid);
      frame.current = requestAnimationFrame(record.tick);
    }
    if (record.moved) event.preventDefault();
  };
  const onPointerUp = event => {
    const record = active.current;
    if (!record || event.pointerId !== record.pointerId) return;
    const target = record.moved && validContext(record) ? targetAt(event.clientX, event.clientY) : null;
    finish();
    if (!record.moved) return;
    if (target) config.current.onDrop(record, target.position);
    else config.current.onCancel();
  };
  const onPointerCancel = event => {
    if (active.current?.pointerId === event.pointerId) cancel();
  };
  const onClickCapture = event => {
    if (suppressClick.current && event.detail > 0) {
      suppressClick.current = false;
      event.preventDefault(); event.stopPropagation();
    }
  };
  const onPointerDownCapture = () => { if (!active.current) suppressClick.current = false; };

  return { view, cancel, onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
    onLostPointerCapture: onPointerCancel, onClickCapture, onPointerDownCapture };
}
