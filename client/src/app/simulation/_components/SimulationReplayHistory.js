'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { listSimulationReplays, loadSimulationReplay, REPLAY_HISTORY_LIMIT } from '../_lib/simulationReplayStorage';
import { readLocalSimulationRunHistory } from '../_lib/localRunHistoryRuntime';
import { formatClock } from '../_lib/simulationFormattingRuntime';
import { buildSimulationRunComparison, formatComparisonMetric } from '../_lib/simulationRunComparisonRuntime.js';
import {
  completeSimulationEvaluation,
  listSimulationEvaluations,
  serializeSimulationEvaluationExport,
  startSimulationEvaluation,
  updateSimulationEvaluation,
} from '../_lib/simulationEvaluationRuntime.js';
import { classifySimulationReplayDeletionError, deleteSimulationReplay } from './simulationReplayDeletionRuntime.js';
import { createReplayHistoryRequests, replayHistoryMetadata } from './simulationReplayHistoryLifetime';
import { useObserverMemoryLifetime } from './useObserverMemoryLifetime';

function recordTitle(record) {
  return record ? `${record.summary?.winnerTeamName || record.summary?.winnerName || '전원 탈락'} · ${new Date(record.finishedAt).toLocaleString('ko-KR')}` : '선택 안 함';
}

function deltaText(metric) {
  if (!metric.delta) return '같음';
  return `${metric.delta > 0 ? '+' : '-'}${formatComparisonMetric(Math.abs(metric.delta), metric.unit)}`;
}

const EVALUATION_FIELD_DEFS = [
  ['understanding', '팀의 현재 목표를 이해했는가'],
  ['reasoning', '이동·합류·교전·후퇴 판단 이유를 화면의 근거로 이해할 수 있었는가'],
  ['farmingUnderstand', '파밍 흐름을 이해했는가'],
  ['regroupUnderstand', '팀 합류를 이해했는가'],
  ['combatUnderstand', '교전 이유를 이해했는가'],
  ['retreatUnderstand', '후퇴 이유를 이해했는가'],
  ['eliminationUnderstand', '탈락 원인을 이해했는가'],
  ['fun', '재미'],
  ['replayDesire', '다시 해보고 싶은 마음'],
  ['readability', '화면 읽기 쉬움'],
  ['wouldReplay10m', '10분 안에 한 번 더 경기하겠는가'],
  ['confusion', '가장 큰 혼란·지루함·개선 메모'],
];

function isObservedEvaluationField(field, value) {
  return field === 'confusion'
    ? Boolean(String(value ?? '').trim())
    : value !== null && value !== undefined && value !== '';
}

function evaluationObservationCount(fields) {
  return EVALUATION_FIELD_DEFS.reduce((count, [field]) => (
    count + (isObservedEvaluationField(field, fields?.[field]) ? 1 : 0)
  ), 0);
}

function evaluationStatusLabel(record) {
  if (!record) return '미시작';
  return record.status === 'complete' ? '완료' : '진행 중';
}

function evaluationStatusClass(record) {
  if (!record) return 'not-started';
  return record.status === 'complete' ? 'complete' : 'in-progress';
}

export default function SimulationReplayHistory({
  disabled,
  onReplay,
  onVariant,
  replayMode,
  draftMode,
  evaluationMode = false,
  evaluationCode = '',
  evaluationRunRecord = null,
  evaluationOpenRequest = 0,
}) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [baseline, setBaseline] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [evaluationRun, setEvaluationRun] = useState(null);
  const [evaluationRecords, setEvaluationRecords] = useState([]);
  const [evaluationFields, setEvaluationFields] = useState({});
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [requests] = useState(createReplayHistoryRequests);
  useEffect(() => () => requests.cancel(), [requests]);
  useObserverMemoryLifetime('history', { baseline, candidate }, open);
  const evaluationPanelRef = useRef(null);
  const evaluationId = evaluation?.id;
  const observedEvaluationCount = evaluationObservationCount(evaluationFields);

  useEffect(() => {
    if (evaluationId) evaluationPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [evaluationId]);

  useEffect(() => {
    if (!evaluationMode || !evaluationOpenRequest || !evaluationRunRecord?.id) return undefined;
    requests.cancel();
    const request = requests.begin();
    setOpen(true);
    setPendingDeleteId(null);
    setBusy(true);
    setMessage('완주 기록과 평가 양식을 준비하는 중입니다.');
    void listSimulationReplays().then((records) => {
      if (!requests.isCurrent(request)) return;
      const mergedRuns = records.some((record) => record.id === evaluationRunRecord.id)
        ? records
        : [replayHistoryMetadata(evaluationRunRecord), ...records];
      const currentRun = mergedRuns.find((record) => record.id === evaluationRunRecord.id)
        || replayHistoryMetadata(evaluationRunRecord);
      const evaluationRows = listSimulationEvaluations();
      const existing = evaluationRows.find((row) => row.runId === evaluationRunRecord.id);
      const result = existing
        ? { ok: true, record: existing }
        : startSimulationEvaluation({ runId: evaluationRunRecord.id });
      setRuns(mergedRuns);
      setEvaluationRecords(result.ok
        ? [result.record, ...evaluationRows.filter((row) => row.id !== result.record.id)]
        : evaluationRows);
      if (result.ok) {
        setEvaluationRun(currentRun);
        setEvaluation(result.record);
        setEvaluationFields(result.record.fields);
        setMessage('');
      } else {
        setMessage('평가 기록을 이 브라우저에 저장하지 못했습니다.');
      }
    }).catch((error) => {
      if (requests.isCurrent(request)) setMessage(error.message || '완주 기록을 불러오지 못했습니다.');
    }).finally(() => {
      if (requests.finish(request)) setBusy(false);
    });
    return () => { if (requests.isCurrent(request)) requests.cancel(); };
  }, [evaluationCode, evaluationMode, evaluationOpenRequest, evaluationRunRecord, requests]);
  const comparison = useMemo(() => {
    if (!baseline || !candidate || baseline.id === candidate.id) return null;
    try { return buildSimulationRunComparison(baseline, candidate); } catch { return null; }
  }, [baseline, candidate]);

  async function showHistory() {
    const request = requests.begin();
    if (request === null) return;
    setOpen(true);
    setPendingDeleteId(null);
    setBusy(true);
    setMessage('경기 기록을 불러오는 중입니다.');
    try {
      const records = await listSimulationReplays();
      if (!requests.isCurrent(request)) return;
      setRuns(records);
      setEvaluationRecords(listSimulationEvaluations());
      const legacyCount = readLocalSimulationRunHistory().length;
      setMessage(records.length ? '' : legacyCount
        ? '이전 완주 요약에는 시작 조건이 없습니다. 이번 경기부터 동일 재경기를 보관합니다.'
        : '아직 보관된 경기가 없습니다. 경기를 끝내면 자동으로 저장합니다.');
    } catch (error) { if (requests.isCurrent(request)) setMessage(error.message || '경기 보관함을 열지 못했습니다.'); }
    finally { if (requests.finish(request)) setBusy(false); }
  }

  function closeHistory() {
    requests.cancel();
    setOpen(false);
    setBusy(false);
    setBaseline(null);
    setCandidate(null);
    setRuns([]);
    setPendingDeleteId(null);
    setMessage('');
    // Evaluation fields are small and may contain an unsaved edit after a
    // storage error. Preserve them; only comparison archives are released.
  }

  async function replay(id) {
    if (disabled || busy) return;
    const request = requests.begin();
    if (request === null) return;
    setBusy(true);
    try { const record = await loadSimulationReplay(id); if (requests.isCurrent(request)) onReplay(record); }
    catch (error) { if (requests.isCurrent(request)) setMessage(error.message || '재경기를 불러오지 못했습니다.'); }
    finally { if (requests.finish(request)) setBusy(false); }
  }

  async function prepareVariant(id) {
    if (disabled || busy) return;
    const request = requests.begin();
    if (request === null) return;
    setBusy(true);
    try { const record = await loadSimulationReplay(id); if (requests.isCurrent(request)) onVariant?.(record); }
    catch (error) { if (requests.isCurrent(request)) setMessage(error.message || '변경 경기 조건을 불러오지 못했습니다.'); }
    finally { if (requests.finish(request)) setBusy(false); }
  }

  async function selectComparison(id, side) {
    if (disabled || busy) return;
    const other = side === 'baseline' ? candidate : baseline;
    if (other?.id === id) { setMessage('비교 기준과 대상에는 서로 다른 두 경기를 고르세요.'); return; }
    const request = requests.begin();
    if (request === null) return;
    setBusy(true);
    try {
      const record = await loadSimulationReplay(id);
      if (!requests.isCurrent(request)) return;
      if (side === 'baseline') setBaseline(record); else setCandidate(record);
      setMessage('');
    } catch (error) { if (requests.isCurrent(request)) setMessage(error.message || '비교할 경기 기록을 불러오지 못했습니다.'); }
    finally { if (requests.finish(request)) setBusy(false); }
  }

  async function confirmDelete(id) {
    if (disabled || busy || pendingDeleteId !== id) return;
    const request = requests.begin();
    if (request === null) return;
    setBusy(true);
    try {
      await deleteSimulationReplay(id);
      if (!requests.isCurrent(request)) return;
      setRuns((current) => current.filter((run) => run.id !== id));
      if (baseline?.id === id) setBaseline(null);
      if (candidate?.id === id) setCandidate(null);
      setPendingDeleteId(null);
      setMessage('경기 기록을 삭제했습니다. 연결된 5분 평가 기록은 이 브라우저에 그대로 보존됩니다.');
    } catch (error) {
      if (requests.isCurrent(request)) setMessage(classifySimulationReplayDeletionError(error).text);
    } finally { if (requests.finish(request)) setBusy(false); }
  }

  function beginEvaluation(runId) {
    const run = runs.find((row) => row.id === runId) || null;
    setEvaluationRun(run);
    const existing = listSimulationEvaluations().find((row) => row.runId === runId);
    if (existing) { setEvaluation(existing); setEvaluationFields(existing.fields); setEvaluationRecords((current) => [existing, ...current.filter((row) => row.id !== existing.id)]); setMessage(''); return; }
    const result = startSimulationEvaluation({ runId });
    if (result.ok) { setEvaluation(result.record); setEvaluationFields(result.record.fields); setEvaluationRecords((current) => [result.record, ...current.filter((row) => row.id !== result.record.id)]); setMessage(''); }
    else setMessage('평가 기록을 이 브라우저에 저장하지 못했습니다.');
  }
  function changeEvaluation(field, value) {
    const next = { ...evaluationFields, [field]: value };
    setEvaluationFields(next);
    if (evaluation) { const result = updateSimulationEvaluation(evaluation.id, { fields: next }); if (result.ok) { setEvaluation(result.record); setEvaluationRecords((current) => [result.record, ...current.filter((row) => row.id !== result.record.id)]); setMessage(''); } else setMessage('평가 변경을 이 브라우저에 저장하지 못했습니다.'); }
  }
  function finishEvaluation() {
    if (!evaluation) return;
    const result = completeSimulationEvaluation(evaluation.id, evaluationFields);
    if (result.ok) { setEvaluation(result.record); setEvaluationRecords((current) => [result.record, ...current.filter((row) => row.id !== result.record.id)]); setMessage('5분 평가 기록을 완료했습니다. 이 기기에만 저장했습니다.'); }
    else setMessage(result.reason || '평가 완료 기록을 이 브라우저에 저장하지 못했습니다.');
  }
  function closeEvaluation() {
    setEvaluation(null);
    setEvaluationRun(null);
    setEvaluationFields({});
  }

  function getEvaluationExportText() {
    if (!evaluation) return '';
    return serializeSimulationEvaluationExport({
      evaluation,
      replayRecord: evaluationRun,
      evaluationCode,
    });
  }

  async function copyEvaluationResult() {
    const payload = getEvaluationExportText();
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      setMessage('평가 결과 JSON을 복사했습니다. 의뢰인에게 그대로 보내면 됩니다.');
    } catch {
      setMessage('클립보드 복사 권한이 없습니다. JSON 다운로드를 사용하세요.');
    }
  }

  function downloadEvaluationResult() {
    const payload = getEvaluationExportText();
    if (!payload) return;
    try {
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const safeCode = String(evaluationCode || 'eternal-hunger').replace(/[^a-z0-9._-]+/gi, '-');
      anchor.href = url;
      anchor.download = `${safeCode}-evaluation.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage('평가 결과 JSON을 다운로드했습니다. 이 파일을 의뢰인에게 보내세요.');
    } catch {
      setMessage('평가 결과 파일을 만들지 못했습니다. 결과 복사를 사용하세요.');
    }
  }

  return <div className="sim-replay-toolbar">
    {replayMode ? <span>동일 재경기 · 원본 조건으로 관전 · 승수와 보상은 추가되지 않음</span> : null}
    {draftMode ? <span>변경 경기 준비 · 보관된 조건을 복사했으며 시작 전 편집 가능</span> : null}
    {evaluationMode ? <span>평가 결과는 이 브라우저에만 저장됨</span> : null}
    <button type="button" onClick={showHistory}>{evaluationMode ? '설문·경기 기록' : '경기 보관함'}</button>
    {open ? <div className="sim-replay-backdrop">
      <section className="sim-replay-history" role="dialog" aria-modal="true" aria-label="경기 보관함">
        <h2>경기 보관함</h2>
        <p>이 브라우저에 최근 {REPLAY_HISTORY_LIMIT}경기를 보관합니다. 참가자·지도·규칙과 같은 시드로 다시 관전할 수 있습니다.</p>
        <p>두 경기를 골라 편성·전략·시드 차이와 실제 생존·성장·교전 결과를 함께 비교할 수 있습니다.</p>
        <p>보관함을 닫으면 비교 선택은 해제됩니다. 저장된 경기와 평가 기록은 유지됩니다.</p>
        {disabled ? <p>진행 중인 경기를 마치면 보관된 경기를 불러올 수 있습니다.</p> : null}
        <p role="status">{message}</p>
        <ul>{runs.map((run) => {
          const runEvaluation = evaluationRecords.find((evaluationRecord) => evaluationRecord.runId === run.id);
          return <li key={run.id}>
          <div><strong>{run.summary?.winnerTeamName || run.summary?.winnerName || '전원 탈락'}</strong>
            <span>{new Date(run.finishedAt).toLocaleString('ko-KR')} · {run.summary?.participantCount}명 · {formatClock(run.summary?.ending?.atSec)} · 시드 {run.runSeed}</span>
            <span className={`sim-replay-evaluation-status sim-replay-evaluation-status--${evaluationStatusClass(runEvaluation)}`}>5분 평가: {evaluationStatusLabel(runEvaluation)}</span>
            {run.unavailable ? <span>{run.unavailable}</span> : null}</div>
          <div className="sim-replay-actions">
            <button type="button" disabled={disabled || busy || Boolean(run.unavailable)} onClick={() => replay(run.id)}>동일 재경기</button>
            <button type="button" disabled={disabled || busy || Boolean(run.unavailable)} onClick={() => prepareVariant(run.id)}>조건 복사·변경</button>
            <button type="button" disabled={disabled || busy || Boolean(run.unavailable) || baseline?.id === run.id} onClick={() => selectComparison(run.id, 'baseline')}>비교 기준</button>
            <button type="button" disabled={disabled || busy || Boolean(run.unavailable) || candidate?.id === run.id} onClick={() => selectComparison(run.id, 'candidate')}>비교 대상</button>
            <button type="button" disabled={busy || Boolean(run.unavailable)} onClick={() => beginEvaluation(run.id)}>5분 평가 기록</button>
            {pendingDeleteId === run.id ? <><span role="status">이 기록을 삭제할까요? 연결된 5분 평가 기록은 유지됩니다.</span><button type="button" disabled={disabled || busy} onClick={() => confirmDelete(run.id)}>삭제 확인</button><button type="button" disabled={busy} onClick={() => setPendingDeleteId(null)}>취소</button></> : <button type="button" disabled={disabled || busy} onClick={() => setPendingDeleteId(run.id)}>기록 삭제</button>}
          </div>
        </li>;
        })}</ul>
        <section className="sim-run-comparison" aria-label="경기 비교">
          <h3>편성·전략 비교</h3>
          <div className="sim-run-comparison-selection"><span>기준: {recordTitle(baseline)}</span><span>대상: {recordTitle(candidate)}</span></div>
          {!comparison ? <p>서로 다른 두 경기를 선택하면 조건과 결과 차이를 표시합니다.</p> : <>
            <p className="sim-run-comparison-warning">{comparison.interpretation}</p>
            <p><strong>승리 결과:</strong> {comparison.winnerBefore} → {comparison.winnerAfter}</p>
            <p><strong>종료 판정:</strong> {comparison.endingBefore} → {comparison.endingAfter}</p>
            <details open>
              <summary>바뀐 시작 조건 ({comparison.inputChangeCount})</summary>
              {comparison.conditionChanges.length || comparison.actorChanges.length ? <ul className="sim-run-comparison-changes">
                {comparison.conditionChanges.map((row) => <li key={row.key}><strong>{row.label}</strong><span>{row.before} → {row.after}</span></li>)}
                {comparison.actorChanges.map((row, index) => <li key={`${row.actorId}:${row.key || row.label}:${index}`}>
                  <strong>{row.actorName} · {row.label}</strong><span>{row.before} → {row.after}</span></li>)}
              </ul> : <p>기록된 시작 조건 차이가 없습니다.</p>}
            </details>
            <details open>
              <summary>달라진 결과 지표 ({comparison.metrics.filter((row) => row.delta !== 0).length})</summary>
              <div className="sim-run-comparison-table" role="table" aria-label="경기 결과 지표 비교">
                <div className="sim-run-comparison-table-head" role="row">
                  <strong role="columnheader">지표</strong><span role="columnheader">기준</span>
                  <span role="columnheader">대상</span><em role="columnheader">차이</em>
                </div>
                {comparison.metrics.map((row) => <div key={row.key} role="row">
                  <strong role="cell">{row.label}</strong><span role="cell">{formatComparisonMetric(row.before, row.unit)}</span>
                  <span role="cell">{formatComparisonMetric(row.after, row.unit)}</span><em role="cell">{deltaText(row)}</em>
                </div>)}
              </div>
            </details>
            {comparison.highlights.length ? <div className="sim-run-comparison-highlights"><strong>큰 변화</strong>
              <ul>{comparison.highlights.map((line) => <li key={line}>{line}</li>)}</ul></div> : <p>기록된 결과 지표도 같습니다.</p>}
            <p>위 내용은 함께 달라진 기록을 설명하며, 한 경기만으로 특정 변경의 효과를 확정하지 않습니다.</p>
          </>}
        </section>
        {evaluation ? <section ref={evaluationPanelRef} className="sim-evaluation-panel" aria-label="5분 인간 평가 기록">
          <h3>5분 평가 기록 · {evaluation.status === 'complete' ? '완료' : '진행 중'}</h3>
          <p>판단을 대신하지 않습니다. 관찰한 사실과 본인의 느낌만 기록하며, 이 브라우저에만 보관합니다.</p>
          {evaluationRun ? <dl className="sim-evaluation-meta" aria-label="평가 대상 replay 메타">
            <div><dt>승자</dt><dd>{evaluationRun.summary?.winnerTeamName || evaluationRun.summary?.winnerName || '전원 탈락'}</dd></div>
            <div><dt>일시</dt><dd>{new Date(evaluationRun.finishedAt).toLocaleString('ko-KR')}</dd></div>
            <div><dt>참가자</dt><dd>{evaluationRun.summary?.participantCount == null ? '기록 없음' : `${evaluationRun.summary.participantCount}명`}</dd></div>
            <div><dt>종료시간</dt><dd>{formatClock(evaluationRun.summary?.ending?.atSec)}</dd></div>
            <div><dt>seed</dt><dd>{evaluationRun.runSeed ?? '기록 없음'}</dd></div>
          </dl> : <p className="sim-evaluation-note">대상 replay 메타를 찾을 수 없습니다.</p>}
          <p className="sim-evaluation-observation-count" role="status">입력된 관찰 <strong>{observedEvaluationCount}/12</strong></p>
          <p className="sim-evaluation-note">빈 항목은 미관측으로 남깁니다. ‘아니오’도 입력된 관찰로 계산합니다.</p>
          <p className="sim-evaluation-reasoning-note">이유 이해도는 결과가 옳았는지가 아니라, 화면에 드러난 근거로 이동·합류·교전·후퇴 판단 이유를 따라갈 수 있었는지를 기록하는 항목입니다.</p>
          <div className="sim-evaluation-fields">
            {EVALUATION_FIELD_DEFS.slice(0, 10).map(([field, label]) => <label key={field}>{label}<select disabled={evaluation.status === 'complete'} value={evaluationFields[field] ?? ''} onChange={(event) => changeEvaluation(field, event.target.value ? Number(event.target.value) : null)}><option value="">미관측</option>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}점</option>)}</select></label>)}
            <label>{EVALUATION_FIELD_DEFS[10][1]}<select disabled={evaluation.status === 'complete'} value={evaluationFields.wouldReplay10m ?? ''} onChange={(event) => changeEvaluation('wouldReplay10m', event.target.value === '' ? null : event.target.value === 'true')}><option value="">미관측</option><option value="true">예</option><option value="false">아니오</option></select></label>
            <label>{EVALUATION_FIELD_DEFS[11][1]}<textarea disabled={evaluation.status === 'complete'} value={evaluationFields.confusion || ''} onChange={(event) => changeEvaluation('confusion', event.target.value)} /></label>
          </div>
          <div className="sim-evaluation-actions">
            {evaluation.status !== 'complete' ? <button type="button" onClick={finishEvaluation}>평가 완료로 저장</button> : null}
            <button type="button" onClick={copyEvaluationResult}>결과 JSON 복사</button>
            <button type="button" onClick={downloadEvaluationResult}>결과 JSON 다운로드</button>
            <button type="button" onClick={closeEvaluation}>평가 닫기</button>
          </div>
        </section> : null}
        <button type="button" onClick={closeHistory}>보관함 닫기</button>
      </section>
    </div> : null}
  </div>;
}
