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

export function appendSimulationLog({
  text,
  type = 'normal',
  refs = {},
  actions = {},
} = {}) {
  const { fullLogsRef, fullLogEntriesRef, logSeqRef } = refs;
  const { setLogs } = actions;

  try {
    const logText = String(text || '');
    const logType = String(type || 'normal');
    fullLogsRef.current = [...(Array.isArray(fullLogsRef.current) ? fullLogsRef.current : []), logText];
    fullLogEntriesRef.current = [
      ...(Array.isArray(fullLogEntriesRef.current) ? fullLogEntriesRef.current : []),
      { text: logText, type: logType },
    ];
  } catch {
    // ignore
  }

  if (typeof setLogs !== 'function') return;
  setLogs((prev) => {
    logSeqRef.current += 1;
    const rand = Math.random().toString(16).slice(2);
    const id = `${Date.now()}-${logSeqRef.current}-${rand}`;
    return [...prev, { text, type, id }];
  });
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
} = {}) {
  const { day, phase, matchSec } = state;
  const { setRunEvents } = actions;
  if (typeof setRunEvents !== 'function') return;

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
  setRunEvents((prev) => {
    const next = [...(Array.isArray(prev) ? prev : []), event];
    const max = 5000;
    return next.length > max ? next.slice(next.length - max) : next;
  });
}
