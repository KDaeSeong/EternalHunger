import { useEffect, useRef, useState } from 'react';
import { LOG_DETAIL_OPEN_KEY } from './logPresentation';
import {
  appendVisibleRunEvents,
  appendSimulationLog,
  emitSimulationRunEvent,
  exportSimulationBattleLog,
} from './logActionRuntime';

const PREVLOGS_OPEN_KEY = 'eh_prevlogs_open';

function readStoredFlag(key) {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeStoredFlag(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

function resizeSimulationWindowToContent() {
  try {
    if (typeof window === 'undefined') return;
    if (typeof window.resizeTo !== 'function') return;

    const ua = String(window.navigator?.userAgent || '');
    const isElectron = ua.includes('Electron');
    const isPopup = !!window.opener;
    if (!isElectron && !isPopup) return;

    const doc = document.documentElement;
    const body = document.body;
    const contentH = Math.max(Number(doc?.scrollHeight || 0), Number(body?.scrollHeight || 0));
    const chromeH = Math.max(0, Number(window.outerHeight || 0) - Number(window.innerHeight || 0));

    const minH = 520;
    const maxH = Math.max(minH, Number(window.screen?.availHeight || 9999) - 40);
    const targetH = Math.max(minH, Math.min(maxH, contentH + chromeH + 20));

    window.resizeTo(Number(window.outerWidth || 1280), targetH);
  } catch {
    // ignore browser resize restrictions
  }
}

export function useSimulationLogs({
  day,
  exportState = {},
  isGameOver = false,
  matchSec,
  phase,
  runInputRef,
} = {}) {
  const [logs, setLogs] = useState([]);
  const [prevPhaseLogs, setPrevPhaseLogs] = useState([]);
  const [showPrevLogs, setShowPrevLogs] = useState(() => readStoredFlag(PREVLOGS_OPEN_KEY));
  const [showDetailedLogs, setShowDetailedLogs] = useState(() => readStoredFlag(LOG_DETAIL_OPEN_KEY));
  const [runEvents, setVisibleRunEvents] = useState([]);
  const [logBoxMaxH, setLogBoxMaxH] = useState(420);

  const logBoxRef = useRef(null);
  const logWindowRef = useRef(null);
  const logSeqRef = useRef(0);
  const fullLogsRef = useRef([]);
  const fullLogEntriesRef = useRef([]);
  const fullRunEventsRef = useRef([]);
  const pendingVisibleLogsRef = useRef([]);
  const pendingVisibleRunEventsRef = useRef([]);
  const visiblePublicationRef = useRef(null);
  const publicationDisposedRef = useRef(false);
  const flushVisibleJournalRef = useRef(null);
  const viewWindow = typeof window === 'undefined' ? null : window;

  function cancelVisiblePublication() {
    visiblePublicationRef.current?.cancel();
    visiblePublicationRef.current = null;
  }

  function flushVisibleJournal() {
    cancelVisiblePublication();
    if (publicationDisposedRef.current) return;
    const pendingLogs = pendingVisibleLogsRef.current;
    const pendingEvents = pendingVisibleRunEventsRef.current;
    pendingVisibleLogsRef.current = [];
    pendingVisibleRunEventsRef.current = [];
    if (pendingLogs.length) setLogs((previous) => [...previous, ...pendingLogs]);
    if (pendingEvents.length) setVisibleRunEvents((previous) => appendVisibleRunEvents(previous, pendingEvents));
  }
  useEffect(() => {
    flushVisibleJournalRef.current = flushVisibleJournal;
  });

  function requestVisiblePublication() {
    if (publicationDisposedRef.current || visiblePublicationRef.current) return;
    const publication = { cancel() {} };
    visiblePublicationRef.current = publication;
    const flush = () => {
      if (visiblePublicationRef.current !== publication) return;
      flushVisibleJournalRef.current();
    };
    // Worker messages have separate microtask checkpoints. Publish their
    // read-only views together, while the full journals stay immediate FIFO.
    if (typeof viewWindow?.requestAnimationFrame === 'function') {
      const frameId = viewWindow.requestAnimationFrame(flush);
      const timerId = viewWindow.setTimeout(flush, 100);
      publication.cancel = () => {
        viewWindow.cancelAnimationFrame(frameId);
        viewWindow.clearTimeout(timerId);
      };
    } else if (typeof queueMicrotask === 'function') queueMicrotask(flush);
    else Promise.resolve().then(flush);
  }

  useEffect(() => {
    publicationDisposedRef.current = false;
    return () => {
      visiblePublicationRef.current?.cancel();
      visiblePublicationRef.current = null;
      publicationDisposedRef.current = true;
      pendingVisibleLogsRef.current = [];
      pendingVisibleRunEventsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (isGameOver) flushVisibleJournalRef.current();
  }, [isGameOver]);

  function setRunEvents(events) {
    pendingVisibleRunEventsRef.current = [];
    if (!pendingVisibleLogsRef.current.length) cancelVisiblePublication();
    const owned = structuredClone(events);
    fullRunEventsRef.current = owned;
    setVisibleRunEvents(owned.slice(-5000));
  }

  function enqueueVisibleRunEvent(event) {
    if (publicationDisposedRef.current) return;
    pendingVisibleRunEventsRef.current.push(event);
    requestVisiblePublication();
  }

  function enqueueVisibleLog(entry) {
    if (publicationDisposedRef.current) return;
    pendingVisibleLogsRef.current.push(entry);
    requestVisiblePublication();
  }

  useEffect(() => {
    writeStoredFlag(PREVLOGS_OPEN_KEY, showPrevLogs);
  }, [showPrevLogs]);

  useEffect(() => {
    writeStoredFlag(LOG_DETAIL_OPEN_KEY, showDetailedLogs);
  }, [showDetailedLogs]);

  function addLog(text, type = 'normal') {
    return appendSimulationLog({
      text,
      type,
      refs: { fullLogsRef, fullLogEntriesRef, logSeqRef },
      actions: { enqueueVisibleLog, setLogs },
    });
  }

  const addLogRef = useRef(addLog);

  useEffect(() => {
    addLogRef.current = addLog;
  });

  function exportBattleLog(format = 'md') {
    return exportSimulationBattleLog({
      format,
      refs: { fullLogsRef, runInputRef },
      state: {
        ...exportState,
        runEvents: fullRunEventsRef.current,
      },
    });
  }

  function emitRunEvent(kind, payload = {}, at = null) {
    return emitSimulationRunEvent({
      kind,
      payload,
      at,
      state: { day, phase, matchSec },
      refs: { fullRunEventsRef },
      actions: { enqueueOwnedRunEvent: enqueueVisibleRunEvent },
    });
  }

  function resetPhaseLogs() {
    // Death-log deduplication only reads entries from the current phase.
    fullLogEntriesRef.current = [];
    pendingVisibleLogsRef.current = [];
    if (!pendingVisibleRunEventsRef.current.length) cancelVisiblePublication();
    setPrevPhaseLogs([]);
    setShowPrevLogs(false);
    setLogs(() => []);
    setLogBoxMaxH(180);
  }

  useEffect(() => {
    const el = logBoxRef.current;
    if (!el) return undefined;

    const measure = () => {
      const h = Math.max(0, Number(el.scrollHeight || 0));
      const desired = Math.max(180, Math.min(560, h + 8));
      setLogBoxMaxH(desired);
      el.scrollTop = el.scrollHeight;
      resizeSimulationWindowToContent();
    };

    const raf = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(raf);
  }, [logs, prevPhaseLogs, showPrevLogs, showDetailedLogs]);

  return {
    addLog,
    addLogRef,
    emitRunEvent,
    exportBattleLog,
    fullLogEntriesRef,
    fullLogsRef,
    fullRunEventsRef,
    logBoxMaxH,
    logBoxRef,
    logWindowRef,
    logs,
    prevPhaseLogs,
    resetPhaseLogs,
    runEvents,
    setPrevPhaseLogs,
    setRunEvents,
    setShowDetailedLogs,
    setShowPrevLogs,
    showDetailedLogs,
    showPrevLogs,
  };
}
