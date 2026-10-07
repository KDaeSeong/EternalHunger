'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createObserverPerformanceProbe } from '../_lib/observerPerformanceRuntime';
import { SIMULATION_ENGINE_VERSION } from '../_generated/simulationEngineVersion';
import { observerMemoryRegistry } from './observerMemoryLifetime';

export default function SimulationObserverPerformancePanel({ speed, seed, autoPlay, day, matchSec,
  isGameOver, replayMode, replayId, replayStatus } = {}) {
  const [label, setLabel] = useState('x1');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [memoryLifetime, setMemoryLifetime] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const mounted = useRef(false);
  const context = useMemo(() => ({ engineVersion: SIMULATION_ENGINE_VERSION, speed: Number(speed),
    seed: String(seed ?? ''), autoPlay: Boolean(autoPlay), day: Number(day), matchSec: Number(matchSec),
    isGameOver: Boolean(isGameOver), replayMode: Boolean(replayMode), replayId: replayId ?? null,
    comparisonMatched: replayStatus?.comparison?.matched ?? null,
    comparedEvents: replayStatus?.comparison?.actualEvents ?? null,
  }), [speed, seed, autoPlay, day, matchSec, isGameOver, replayMode, replayId, replayStatus]);
  const enabled = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('perfProbe') === '1', []);
  const probe = useMemo(() => enabled ? createObserverPerformanceProbe() : null, [enabled]);
  useEffect(() => {
    if (!probe) return undefined;
    mounted.current = true;
    const update = () => {
      const value = probe.snapshot() || probe.getLastResult();
      if (value) setResult(value);
      if (!probe.isRunning()) { setRunning(false); setFinalizing(false); }
      setMemoryLifetime(observerMemoryRegistry.snapshot());
    };
    const interval = window.setInterval(update, 1000);
    return () => { mounted.current = false; window.clearInterval(interval); probe.stop(); };
  }, [probe]);
  useEffect(() => {
    if (!probe || !running || finalizing) return;
    probe.updateContext(context);
    if (context.isGameOver && context.comparisonMatched != null) {
      void probe.stopAfterFrame({ reason: 'replay-complete' }).then((value) => {
        if (!mounted.current) return;
        setResult(value); setRunning(false); setFinalizing(false);
      });
    }
  }, [probe, context, running, finalizing]);
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
    probe.start({ label, context });
    setRunning(true);
    setResult(probe.snapshot());
  };
  const stop = async () => {
    setFinalizing(true);
    const value = await probe.stopAfterFrame();
    if (!mounted.current) return;
    setRunning(false); setFinalizing(false); setResult(value);
  };
  const stopping = finalizing || running && context.isGameOver && context.comparisonMatched != null;
  return <aside className="sim-observer-performance" data-testid="observer-performance-panel" aria-label="관전자 성능 진단 패널">
    <label htmlFor="observer-performance-label">측정 라벨</label>
    <input id="observer-performance-label" data-testid="observer-performance-label" aria-label="측정 라벨" value={label} onChange={(event) => setLabel(event.target.value)} />
    <button type="button" data-testid="observer-performance-start" aria-label="성능 측정 시작" onClick={start} disabled={running}>시작</button>
    <button type="button" data-testid="observer-performance-stop" aria-label="성능 측정 중지" onClick={stop} disabled={!running || stopping}>중지</button>
    <output data-testid="observer-performance-status" role="status">{stopping ? '종료 표본 수집 중' : running ? '측정 중' : result ? '측정 완료' : '대기 중'}</output>
    <p>동일 재경기는 결과 비교 뒤 자동 중지합니다. 측정 완료는 성능 합격을 뜻하지 않습니다.</p>
    <details className="sim-observer-performance-result">
      <summary>측정 JSON 보기</summary>
      <pre data-testid="observer-performance-result" aria-label="성능 측정 JSON">{result ? JSON.stringify(result, null, 2) : '측정 결과가 없습니다.'}</pre>
    </details>
    <details className="sim-observer-performance-result">
      <summary>자료 회수 진단 JSON 보기</summary>
      <p>종료한 화면의 일부 자료만 관찰합니다. 미회수는 누수 확정이 아니며, 회수도 전체 메모리 정상 판정은 아닙니다. 기록 삭제나 강제 회수는 하지 않습니다.</p>
      <pre data-testid="observer-memory-lifetime-result" aria-label="자료 회수 진단 JSON">{memoryLifetime ? JSON.stringify(memoryLifetime, null, 2) : '측정 결과가 없습니다.'}</pre>
    </details>
  </aside>;
}
