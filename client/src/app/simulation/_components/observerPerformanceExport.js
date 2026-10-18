export const OBSERVER_REPORT_MAX_BYTES = 2 * 1024 * 1024;

export function canExportObserverPerformanceReport(report) {
  return Boolean(report && typeof report === 'object' && !Array.isArray(report)
    && report.schema === 'eh-observer-performance.v3'
    && ['settled', 'incomplete'].includes(report.boundary?.status)
    && typeof report.endedAtMs === 'number' && Number.isFinite(report.endedAtMs));
}

function filenamePart(value, limit, fallback) {
  const safe = String(value ?? '').replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .slice(0, limit).replace(/^[._-]+|[._-]+$/g, '');
  return safe || fallback;
}

export function buildObserverPerformanceReportDownload(report, now = new Date()) {
  if (!canExportObserverPerformanceReport(report)) return { ok: false, reason: 'not-finalized' };
  try {
    // Preserve failed and incomplete reports unchanged; only the analyzer decides acceptance.
    const snapshot = structuredClone(report);
    const text = JSON.stringify(snapshot, null, 2);
    if (new TextEncoder().encode(text).byteLength > OBSERVER_REPORT_MAX_BYTES) {
      return { ok: false, reason: 'too-large' };
    }
    const initial = snapshot.context?.initial;
    const speed = filenamePart(initial?.speed, 12, 'unknown');
    const seed = filenamePart(initial?.seed, 32, 'unknown');
    const label = filenamePart(snapshot.label, 48, 'measurement');
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    return { ok: true, filename: `eternal-hunger-observer-v3-x${speed}-${seed}-${label}-${stamp}.json`,
      text, mimeType: 'application/json;charset=utf-8' };
  } catch {
    return { ok: false, reason: 'serialization-failed' };
  }
}
