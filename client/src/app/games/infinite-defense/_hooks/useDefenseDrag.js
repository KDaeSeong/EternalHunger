'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { crossedDragThreshold, edgeScrollDelta, parseDefenseDropTarget } from '../_lib/infiniteDefenseDrag.js';

export default function useDefenseDrag({ enabled, owner, runId, phase, wave, scopeRef, onStart, onDrop, onCancel }) {
  const active = useRef(null), frame = useRef(0), suppressClick = useRef(false), rendered = useRef(null);
  const config = useRef({ enabled, owner, runId, phase, wave, scopeRef, onStart, onDrop, onCancel });
  const [view, setView] = useState(null);
  useEffect(() => {
    config.current = { enabled, owner, runId, phase, wave, scopeRef, onStart, onDrop, onCancel };
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
    } catch { /* The source may have unmounted during a screen or account change. */ }
    return record;
  }, []);
  const cancel = useCallback(() => {
    const record = finish();
    if (record?.moved) config.current.onCancel();
  }, [finish]);

  useEffect(() => cancel, [enabled, owner, runId, phase, wave, cancel]);
  useEffect(() => {
    const hide = () => { if (document.hidden) cancel(); };
    const escape = event => { if (event.key === 'Escape' && active.current) { event.preventDefault(); cancel(); } };
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', escape);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', escape);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [cancel]);

  const validContext = record => {
    const current = config.current;
    return current.enabled && current.owner === record.owner && current.runId === record.runId &&
      current.phase === record.phase && current.wave === record.wave;
  };
  const targetAt = (x, y) => {
    const element = document.elementFromPoint(x, y)?.closest('[data-defense-drop]');
    if (!element || !config.current.scopeRef.current?.contains(element)) return null;
    return parseDefenseDropTarget(element.getAttribute('data-defense-drop'));
  };

  const onPointerDown = (event, studentId, assignment) => {
    if (!config.current.enabled || !assignment || active.current || event.button !== 0 || event.isPrimary === false) return;
    const current = config.current;
    const record = {
      studentId, sourceAssignment: { mode: assignment.mode, padId: assignment.padId, paid: assignment.paid },
      owner: current.owner, runId: current.runId, phase: current.phase, wave: current.wave,
      pointerId: event.pointerId, element: event.currentTarget,
      start: { x: event.clientX, y: event.clientY }, x: event.clientX, y: event.clientY, moved: false,
    };
    record.tick = () => {
      if (active.current !== record) return;
      if (!validContext(record) || !record.element.isConnected) { cancel(); return; }
      const next = { studentId: record.studentId, x: record.x, y: record.y, dropKey: targetAt(record.x, record.y) || '' };
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
      config.current.onStart(record.studentId);
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
    if (target) config.current.onDrop(record, target);
    else config.current.onCancel();
  };
  const onPointerCancel = event => { if (active.current?.pointerId === event.pointerId) cancel(); };
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
