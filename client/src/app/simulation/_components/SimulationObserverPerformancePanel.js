'use client';

import { useEffect, useMemo, useState } from 'react';
import { createObserverPerformanceProbe } from '../_lib/observerPerformanceRuntime';

export default function SimulationObserverPerformancePanel() {
  const [label, setLabel] = useState('x1');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const enabled = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('perfProbe') === '1', []);
  const probe = useMemo(() => enabled ? createObserverPerformanceProbe() : null, [enabled]);
  useEffect(() => {
    if (!probe) return undefined;
    const update = () => {
      const value = probe.snapshot();
      if (value) setResult(value);
    };
    const interval = window.setInterval(update, 1000);
    return () => { window.clearInterval(interval); probe.stop(); };
  }, [probe]);
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
  const start = () => {
    probe.start({ label });
    setRunning(true);
    setResult(probe.snapshot());
  };
  const stop = () => {
    const value = probe.stop();
    setRunning(false);
    setResult(value);
  };
  return <aside className="sim-observer-performance" data-testid="observer-performance-panel" aria-label="관전자 성능 진단 패널">
    <label htmlFor="observer-performance-label">측정 라벨</label>
    <input id="observer-performance-label" data-testid="observer-performance-label" aria-label="측정 라벨" value={label} onChange={(event) => setLabel(event.target.value)} />
    <button type="button" data-testid="observer-performance-start" aria-label="성능 측정 시작" onClick={start} disabled={running}>시작</button>
    <button type="button" data-testid="observer-performance-stop" aria-label="성능 측정 중지" onClick={stop} disabled={!running}>중지</button>
    <output data-testid="observer-performance-status" role="status">{running ? '측정 중' : result ? '측정 완료' : '대기 중'}</output>
    <details className="sim-observer-performance-result">
      <summary>측정 JSON 보기</summary>
      <pre data-testid="observer-performance-result" aria-label="성능 측정 JSON">{result ? JSON.stringify(result, null, 2) : '측정 결과가 없습니다.'}</pre>
    </details>
  </aside>;
}
