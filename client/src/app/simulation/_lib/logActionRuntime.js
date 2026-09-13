import {
  getExportLogLines,
  makeLogFileBaseName,
  downloadTextFile,
  buildLogExportSummary,
  buildMarkdownLogExport,
} from './logExportRuntime';

function nowMs() {
  return Date.now();
}

export const RUN_EVENT_VIEW_LIMIT = 5000;

export function appendVisibleRunEvents(previous, incoming, limit = RUN_EVENT_VIEW_LIMIT) {
  const before = Array.isArray(previous) ? previous : [];
  const added = Array.isArray(incoming) ? incoming : [];
  const max = Math.max(1, Math.floor(Number(limit) || RUN_EVENT_VIEW_LIMIT));
  if (!added.length) return before;
  if (added.length >= max) return added.slice(-max);
  return [...before.slice(-Math.max(0, max - added.length)), ...added];
}

export function appendSimulationLog({
  text,
  type = 'normal',
  refs = {},
  actions = {},
} = {}) {
  const { fullLogsRef, fullLogEntriesRef, logSeqRef } = refs;
  const { enqueueVisibleLog, setLogs } = actions;

  try {
    const logText = String(text || '');
    const logType = String(type || 'normal');
    const fullLogs = Array.isArray(fullLogsRef.current) ? fullLogsRef.current : [];
    fullLogs.push(logText);
    fullLogsRef.current = fullLogs;
    const fullLogEntries = Array.isArray(fullLogEntriesRef.current) ? fullLogEntriesRef.current : [];
    fullLogEntries.push({ text: logText, type: logType });
    fullLogEntriesRef.current = fullLogEntries;
  } catch {
    // ignore
  }

  if (typeof setLogs !== 'function' && typeof enqueueVisibleLog !== 'function') return;
  // React may defer or repeat an updater. Allocate once at event creation, with
  // no random draw and no ref mutation inside the updater.
  logSeqRef.current += 1;
  const entry = { text, type, id: `log-${logSeqRef.current}` };
  if (typeof enqueueVisibleLog === 'function') {
    enqueueVisibleLog(entry);
    return;
  }
  setLogs((prev) => [...prev, entry]);
}

export function exportSimulationBattleLog({
  format = 'md',
  refs = {},
  state = {},
} = {}) {
  const fmt = String(format || 'md').toLowerCase() === 'json' ? 'json' : 'md';
  const lines = getExportLogLines(refs.fullLogsRef?.current);
  if (!lines.length) {
    return { status: 'empty', ok: false, format: fmt, filename: '' };
  }

  const {
    settings,
    resultSummary,
    runEvents,
    winner,
    killCounts,
    assistCounts,
  } = state;
  const summary = buildLogExportSummary({
    lines,
    settings,
    resultSummary,
    runEvents,
    winner,
    killCounts,
    assistCounts,
  });
  const filename = makeLogFileBaseName({ winner, resultSummary }, fmt);
  const payload = fmt === 'json'
    ? JSON.stringify({
        schema: 'eternal-hunger.battle-log.v1',
        summary,
        logs: lines.map((logText, index) => ({ index: index + 1, text: logText })),
        runEvents: Array.isArray(runEvents) ? runEvents : [],
      }, null, 2)
    : buildMarkdownLogExport(lines, summary);
  const ok = downloadTextFile(
    filename,
    payload,
    fmt === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8'
  );
  return {
    status: ok ? 'saved' : 'failed',
    ok,
    format: fmt,
    filename,
    logCount: lines.length,
  };
}

export function emitSimulationRunEvent({
  kind,
  payload = {},
  at = null,
  state = {},
  actions = {},
  refs = {},
} = {}) {
  const { day, phase, matchSec } = state;
  const { enqueueRunEvent, setRunEvents } = actions;
  if (typeof enqueueRunEvent !== 'function' && typeof setRunEvents !== 'function') return;

  const stamp = at || { day, phase, sec: matchSec };
  const eventPayload = payload && typeof payload === 'object' ? { ...payload } : {};
  const payloadKind = eventPayload.kind;
  delete eventPayload.kind;
  delete eventPayload.at;
  delete eventPayload.ts;
  const event = { ...eventPayload, kind: String(kind || 'unknown'), at: stamp, ts: nowMs() };
  if (
    (event.subkind === undefined || event.subkind === null || event.subkind === '')
    && payloadKind !== undefined
    && payloadKind !== null
    && String(payloadKind)
  ) {
    event.subkind = String(payloadKind);
  }
  if (refs.fullRunEventsRef) refs.fullRunEventsRef.current.push(structuredClone(event));
  if (typeof enqueueRunEvent === 'function') enqueueRunEvent(event);
  else setRunEvents((prev) => appendVisibleRunEvents(prev, [event]));
}
