import { useEffect, useRef, useState } from 'react';
import { LOG_DETAIL_OPEN_KEY } from './logPresentation';
import {
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
  matchSec,
  phase,
} = {}) {
  const [logs, setLogs] = useState([]);
  const [prevPhaseLogs, setPrevPhaseLogs] = useState([]);
  const [showPrevLogs, setShowPrevLogs] = useState(() => readStoredFlag(PREVLOGS_OPEN_KEY));
  const [showDetailedLogs, setShowDetailedLogs] = useState(() => readStoredFlag(LOG_DETAIL_OPEN_KEY));
  const [runEvents, setRunEvents] = useState([]);
  const [logBoxMaxH, setLogBoxMaxH] = useState(420);

  const logBoxRef = useRef(null);
  const logWindowRef = useRef(null);
  const logSeqRef = useRef(0);
  const fullLogsRef = useRef([]);
  const fullLogEntriesRef = useRef([]);

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
      actions: { setLogs },
    });
  }

  const addLogRef = useRef(addLog);

  useEffect(() => {
    addLogRef.current = addLog;
  });

  function exportBattleLog(format = 'md') {
    return exportSimulationBattleLog({
      format,
      refs: { fullLogsRef },
      state: {
        ...exportState,
        runEvents,
      },
    });
  }

  function emitRunEvent(kind, payload = {}, at = null) {
    return emitSimulationRunEvent({
      kind,
      payload,
      at,
      state: { day, phase, matchSec },
      actions: { setRunEvents },
    });
  }

  function resetPhaseLogs() {
    setPrevPhaseLogs([]);
    setShowPrevLogs(false);
    setLogs(() => []);
    logSeqRef.current = 0;
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
    logBoxMaxH,
    logBoxRef,
    logWindowRef,
    logs,
    prevPhaseLogs,
    resetPhaseLogs,
    runEvents,
    setLogBoxMaxH,
    setPrevPhaseLogs,
    setRunEvents,
    setShowDetailedLogs,
    setShowPrevLogs,
    showDetailedLogs,
    showPrevLogs,
  };
}
