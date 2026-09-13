export const SIMULATION_EVALUATION_STORAGE_KEY = 'eh_simulation_evaluations_v1';
export const SIMULATION_EVALUATION_SCHEMA = 'eternal-hunger.evaluation.v1';
export const SIMULATION_EVALUATION_EXPORT_SCHEMA = 'eternal-hunger.evaluation-export.v1';
export const SIMULATION_EVALUATION_LIMIT = 20;

const FIELDS = ['understanding', 'reasoning', 'replayDesire', 'readability', 'farmingUnderstand', 'regroupUnderstand', 'combatUnderstand', 'retreatUnderstand', 'eliminationUnderstand', 'fun', 'wouldReplay10m', 'confusion'];
const TEXT_FIELDS = new Set(['confusion']);
function text(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function score(value) { const n = Number(value); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; }
function boolish(value) { return value === true || value === false ? value : null; }
function storageOf(storage) { if (storage?.getItem && storage?.setItem) return storage; try { return globalThis.localStorage; } catch { return null; } }

function normalizeFields(fields) {
  const normalized = {};
  FIELDS.forEach((field) => {
    normalized[field] = TEXT_FIELDS.has(field)
      ? text(fields?.[field])
      : field === 'wouldReplay10m'
        ? boolish(fields?.[field])
        : score(fields?.[field]);
  });
  return normalized;
}

function hasObservation(fields) {
  return FIELDS.some((field) => (
    TEXT_FIELDS.has(field) ? Boolean(fields[field]) : fields[field] !== null
  ));
}

export function normalizeSimulationEvaluation(value) {
  if (!value || typeof value !== 'object' || value.schema !== SIMULATION_EVALUATION_SCHEMA) return null;
  const id = text(value.id, 128); if (!id) return null;
  const out = { schema: SIMULATION_EVALUATION_SCHEMA, id, status: value.status === 'complete' ? 'complete' : 'in_progress', startedAt: Number.isFinite(Number(value.startedAt)) ? Number(value.startedAt) : 0, updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : 0, completedAt: Number.isFinite(Number(value.completedAt)) ? Number(value.completedAt) : null, runId: text(value.runId, 128) || null, fields: normalizeFields(value.fields) };
  if (!out.startedAt || !out.updatedAt) return null;
  if (out.status === 'complete' && (!out.completedAt || !hasObservation(out.fields))) return null;
  return out;
}
function readAll(storage) { const target = storageOf(storage); if (!target) return []; try { const parsed = JSON.parse(target.getItem(SIMULATION_EVALUATION_STORAGE_KEY) || '[]'); if (!Array.isArray(parsed) && parsed?.schema !== SIMULATION_EVALUATION_SCHEMA) return []; const rows = Array.isArray(parsed) ? parsed : parsed.evaluations; return Array.isArray(rows) ? rows.map(normalizeSimulationEvaluation).filter(Boolean).slice(0, SIMULATION_EVALUATION_LIMIT) : []; } catch { return []; } }
function writeAll(rows, storage) { const target = storageOf(storage); if (!target) return false; try { target.setItem(SIMULATION_EVALUATION_STORAGE_KEY, JSON.stringify({ schema: SIMULATION_EVALUATION_SCHEMA, evaluations: rows.slice(0, SIMULATION_EVALUATION_LIMIT) })); return true; } catch { return false; } }
export function listSimulationEvaluations(storage) { return readAll(storage); }
export function startSimulationEvaluation({
  runId = null,
  now = Date.now(),
  storage,
  idFactory = () => globalThis.crypto?.randomUUID?.(),
} = {}) {
  const rows = readAll(storage);
  const existing = runId && rows.find((row) => row.runId === text(runId, 128));
  if (existing) return { ok: true, record: existing, reused: true };
  let generatedToken = '';
  try { generatedToken = text(idFactory?.(), 128).replace(/[^a-z0-9_-]/gi, ''); } catch { generatedToken = ''; }
  const token = generatedToken || 'local';
  let id;
  let suffix = 0;
  do {
    id = `evaluation_${now}_${token}${suffix ? `_${suffix}` : ''}`;
    suffix += 1;
  } while (rows.some((row) => row.id === id));
  const record = normalizeSimulationEvaluation({ schema: SIMULATION_EVALUATION_SCHEMA, id, status: 'in_progress', startedAt: now, updatedAt: now, runId, fields: {} });
  if (!record || !writeAll([record, ...rows], storage)) return { ok: false, record: null };
  return { ok: true, record };
}
function persistSimulationEvaluation(id, patch, storage, { allowComplete = false } = {}) {
  const rows = readAll(storage);
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return { ok: false, record: null, reason: '평가 기록을 찾을 수 없습니다.' };
  const current = rows[index];
  if (current.status === 'complete') return { ok: false, record: null, reason: '완료된 평가 기록은 변경할 수 없습니다.' };
  const wantsComplete = patch?.status === 'complete';
  if (wantsComplete && !allowComplete) return { ok: false, record: null, reason: '평가 완료 전용 절차를 사용해야 합니다.' };
  const fields = normalizeFields({ ...current.fields, ...(patch?.fields || {}) });
  if (wantsComplete && !hasObservation(fields)) {
    return { ok: false, record: null, reason: '최소 한 항목에 유효한 관찰 내용을 입력해야 평가를 완료할 수 있습니다.' };
  }
  const now = Date.now();
  const next = normalizeSimulationEvaluation({
    ...current,
    status: wantsComplete ? 'complete' : 'in_progress',
    fields,
    updatedAt: now,
    completedAt: wantsComplete ? now : null,
  });
  if (!next || !writeAll([next, ...rows.filter((_, rowIndex) => rowIndex !== index)], storage)) {
    return { ok: false, record: null, reason: '평가 기록을 이 브라우저에 저장하지 못했습니다.' };
  }
  return { ok: true, record: next };
}

export function updateSimulationEvaluation(id, patch = {}, storage) {
  return persistSimulationEvaluation(id, patch, storage);
}

export function completeSimulationEvaluation(id, fields, storage) {
  return persistSimulationEvaluation(id, { status: 'complete', fields }, storage, { allowComplete: true });
}

export function buildSimulationEvaluationExport({
  evaluation,
  replayRecord = null,
  evaluationCode = '',
  now = Date.now(),
} = {}) {
  const normalized = normalizeSimulationEvaluation(evaluation);
  if (!normalized) throw new TypeError('내보낼 평가 기록이 올바르지 않습니다.');
  const replayId = text(replayRecord?.id, 128);
  const matchingReplay = replayId && (!normalized.runId || replayId === normalized.runId)
    ? {
        id: replayId,
        finishedAt: Number.isFinite(Number(replayRecord?.finishedAt)) ? Number(replayRecord.finishedAt) : null,
        runSeed: text(replayRecord?.runSeed ?? replayRecord?.input?.runSeed, 128),
        summary: replayRecord?.summary && typeof replayRecord.summary === 'object'
          ? replayRecord.summary
          : null,
      }
    : null;
  return {
    schema: SIMULATION_EVALUATION_EXPORT_SCHEMA,
    evaluationCode: text(evaluationCode, 128),
    exportedAt: Number.isFinite(Number(now)) ? Number(now) : Date.now(),
    evaluation: normalized,
    replay: matchingReplay,
  };
}

export function serializeSimulationEvaluationExport(options = {}) {
  return `${JSON.stringify(buildSimulationEvaluationExport(options), null, 2)}\n`;
}
