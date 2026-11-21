'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createObserverPerformanceProbe } from '../_lib/observerPerformanceRuntime';
import { SIMULATION_ENGINE_VERSION } from '../_generated/simulationEngineVersion';
import { observerMemoryRegistry } from './observerMemoryLifetime';
import { downloadTextFile } from '../_lib/logExportRuntime';
import {
  buildObserverPerformanceReportDownload,
  canExportObserverPerformanceForReplayResult,
  canExportObserverPerformanceReport,
} from './observerPerformanceExport';

const EMPTY_REPORT = '측정 결과가 없습니다.';

export default function SimulationObserverPerformancePanel({ speed, seed, autoPlay, day, matchSec,
  isGameOver, replayMode, replayId, replayStatus, observerReportTarget } = {}) {
  const [label, setLabel] = useState('x1');
  const [running, setRunning] = useState(false);
  const [measurement, setMeasurement] = useState(null);
  const [attempt, setAttempt] = useState({ ended: Boolean(isGameOver), id: 0 });
  const [memoryLifetime, setMemoryLifetime] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const pendingStop = useRef(null);
  const context = useMemo(() => ({ engineVersion: SIMULATION_ENGINE_VERSION, speed: Number(speed),
    seed: String(seed ?? ''), autoPlay: Boolean(autoPlay), day: Number(day), matchSec: Number(matchSec),
    isGameOver: Boolean(isGameOver), replayMode: Boolean(replayMode), replayId: replayId ?? null,
    comparisonMatched: replayStatus?.comparison?.matched ?? null,
    comparedEvents: replayStatus?.comparison?.actualEvents ?? null,
  }), [speed, seed, autoPlay, day, matchSec, isGameOver, replayMode, replayId, replayStatus]);
  const enabled = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('perfProbe') === '1', []);
  const probe = useMemo(() => enabled ? createObserverPerformanceProbe() : null, [enabled]);
  const result = measurement?.report;
  const reportJson = useMemo(() => result ? JSON.stringify(result, null, 2) : EMPTY_REPORT, [result]);
  const memoryJson = useMemo(() => memoryLifetime ? JSON.stringify(memoryLifetime, null, 2) : EMPTY_REPORT, [memoryLifetime]);
  const finishMeasurement = useCallback((reason) => {
    if (pendingStop.current) return;
    const completion = probe.stopAfterFrame({ reason });
    pendingStop.current = completion;
    void completion.then((value) => {
      if (pendingStop.current !== completion) return;
      pendingStop.current = null;
      setMeasurement({ report: value, attemptId: attempt.id });
      setRunning(false);
      setFinalizing(false);
    });
  }, [probe, attempt.id]);
  useEffect(() => {
    if (!probe) return undefined;
    const update = () => {
      // Once a stop resolves, retain its exact report rather than cloning it on every tick.
      const value = probe.snapshot();
      if (value) setMeasurement({ report: value });
      setMemoryLifetime(observerMemoryRegistry.snapshot());
    };
    const interval = window.setInterval(update, 1000);
    return () => { pendingStop.current = null; window.clearInterval(interval); probe.stop(); };
  }, [probe]);
  useEffect(() => {
    if (!probe || !running || finalizing) return;
    probe.updateContext(context);
    if (context.isGameOver && context.comparisonMatched != null) {
      finishMeasurement('replay-complete');
    }
  }, [probe, context, running, finalizing, finishMeasurement]);
  useEffect(() => {
    if (!probe || !running) return undefined;
    const onCaptureClick = (event) => {
      probe.recordInput(event.timeStamp);
    };
    document.addEventListener('click', onCaptureClick, true);
    return () => {
      document.removeEventListener('click', onCaptureClick, true);
    };
  }, [probe, running]);
  if (!enabled) return null;
  if (!probe) return <aside data-testid="observer-performance-panel" aria-label="관전자 성능 진단 패널"><output role="status">초기화 중</output></aside>;
  if (attempt.ended !== context.isGameOver) {
    // The same replay can produce identical final fields in a later match.
    setAttempt({ ended: context.isGameOver, id: context.isGameOver ? attempt.id : attempt.id + 1 });
  }
  const start = () => {
    setDownloadError(null);
    probe.start({ label, context });
    setRunning(true);
    setMeasurement({ report: probe.snapshot() });
  };
  const stop = () => {
    setFinalizing(true);
    finishMeasurement('manual');
  };
  const stopping = finalizing || running && context.isGameOver && context.comparisonMatched != null;
  const download = () => {
    if (running || stopping) return;
    setDownloadError(null);
    const file = buildObserverPerformanceReportDownload(result);
    if (!file.ok) {
      setDownloadError(file.reason === 'too-large'
        ? '측정 JSON이 저장 한도(2 MiB)를 넘었습니다. 내용은 자르지 않았습니다.'
        : '중지된 측정 결과를 저장할 수 없습니다. 측정 상태와 결과를 확인해 주세요.');
      return;
    }
    try {
      if (!downloadTextFile(file.filename, file.text, file.mimeType)) throw new Error('Download unavailable');
    } catch {
      setDownloadError('측정 JSON을 저장하지 못했습니다. 브라우저의 다운로드 상태를 확인해 주세요.');
    }
  };
  let replayReportControl = null;
  if (observerReportTarget && context.isGameOver && context.replayMode) {
    if (running || stopping) {
      replayReportControl = <p role="status">성능 측정 결과를 정리하는 중입니다.</p>;
    } else if (measurement?.attemptId === attempt.id && canExportObserverPerformanceForReplayResult(result, context)) {
      replayReportControl = <>
        <button type="button" data-testid="observer-performance-result-download" onClick={download}>이번 경기 성능 JSON 저장</button>
        {downloadError && <p role="alert">{downloadError}</p>}
      </>;
    }
  }
  return <>
    <aside className="sim-observer-performance" data-testid="observer-performance-panel" aria-label="관전자 성능 진단 패널">
      <label htmlFor="observer-performance-label">측정 라벨</label>
      <input id="observer-performance-label" data-testid="observer-performance-label" aria-label="측정 라벨" value={label} onChange={(event) => setLabel(event.target.value)} />
      <button type="button" data-testid="observer-performance-start" aria-label="성능 측정 시작" onClick={start} disabled={running}>시작</button>
      <button type="button" data-testid="observer-performance-stop" aria-label="성능 측정 중지" onClick={stop} disabled={!running || stopping}>중지</button>
      <button type="button" data-testid="observer-performance-download" aria-label="성능 측정 JSON 저장" onClick={download} disabled={running || stopping || !canExportObserverPerformanceReport(result)}>JSON 저장</button>
      <output data-testid="observer-performance-status" role="status">{stopping ? '종료 표본 수집 중' : running ? '측정 중' : result ? '측정 완료' : '대기 중'}</output>
      {downloadError && !replayReportControl && <output role="alert">{downloadError}</output>}
      <p>동일 재경기는 결과 비교 뒤 자동 중지합니다. 측정 완료는 성능 합격을 뜻하지 않습니다.</p>
      <details className="sim-observer-performance-result">
        <summary>측정 JSON 보기</summary>
        <pre data-testid="observer-performance-result" aria-label="성능 측정 JSON">{reportJson}</pre>
      </details>
      <details className="sim-observer-performance-result">
        <summary>자료 회수 진단 JSON 보기</summary>
        <p>종료한 화면의 일부 자료만 관찰합니다. 미회수는 누수 확정이 아니며, 회수도 전체 메모리 정상 판정은 아닙니다. 기록 삭제나 강제 회수는 하지 않습니다.</p>
        <pre data-testid="observer-memory-lifetime-result" aria-label="자료 회수 진단 JSON">{memoryJson}</pre>
      </details>
    </aside>
    {replayReportControl && createPortal(replayReportControl, observerReportTarget)}
  </>;
}
