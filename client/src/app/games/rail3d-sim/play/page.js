'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell from '../../_components/GamePlayShell';
import {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  TRACK,
  blockSummary,
  createNewState,
  formatTime,
  getPlayTimeSec,
  mapViewState,
  normalizeState,
  pointOnEdge,
  runForAction,
  scoreState,
  setLookaheadBlocksAction,
  setStepSecondsAction,
  stepAction,
  summaryForState,
  trainRows,
} from '../_lib/rail3dEngine';

function ActionButton({ children, disabled, onClick }) {
  return (
    <button type="button" className="tcg-primary-action" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function SmallStat({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RailMap({ state }) {
  const view = mapViewState(state);
  const xs = view.nodes.map((node) => node.x);
  const zs = view.nodes.map((node) => node.z);
  const minX = Math.min(...xs, 0) - 40;
  const maxX = Math.max(...xs, 500) + 40;
  const minZ = Math.min(...zs, 0) - 80;
  const maxZ = Math.max(...zs, 120) + 80;
  const stationByStop = new Map(TRACK.stations.map((station) => [station.stopPoint.edgeId + ':' + station.stopPoint.sM, station]));

  return (
    <svg className="rail-map" viewBox={`${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`} role="img" aria-label="Rail3D minimap">
      <rect x={minX} y={minZ} width={maxX - minX} height={maxZ - minZ} rx="18" fill="#071923" />
      {view.edges.map((edge) => {
        const from = view.nodes.find((node) => node.id === edge.from);
        const to = view.nodes.find((node) => node.id === edge.to);
        if (!from || !to) return null;
        return <line key={edge.id} x1={from.x} y1={from.z} x2={to.x} y2={to.z} stroke="#94a9b8" strokeWidth="8" strokeLinecap="round" />;
      })}
      {view.blocks.map((block) => {
        const a = pointOnEdge(block.edgeId, block.s0);
        const b = pointOnEdge(block.edgeId, block.s1);
        const color = block.state === 'OCCUPIED' ? '#ff9f1c' : block.state === 'RESERVED' ? '#39c6f0' : '#335463';
        return <line key={block.id} x1={a.x} y1={a.z + 16} x2={b.x} y2={b.z + 16} stroke={color} strokeWidth="5" strokeLinecap="round" />;
      })}
      {view.stations.map((station) => {
        const point = pointOnEdge(station.stopPoint.edgeId, station.stopPoint.sM);
        return (
          <g key={station.id}>
            <circle cx={point.x} cy={point.z} r="14" fill="#f7fbff" stroke="#2673a6" strokeWidth="5" />
            <text x={point.x} y={point.z - 24} fill="#f7fbff" textAnchor="middle" fontSize="18" fontWeight="800">{station.name}</text>
          </g>
        );
      })}
      {view.trains.map((train, index) => {
        const yOffset = index % 2 === 0 ? -18 : 42;
        const fill = train.signalState === 'STOP' ? '#e84855' : train.phase === 'DONE' ? '#8ea3ad' : '#39c6f0';
        const station = stationByStop.get(train.pose.edgeId + ':' + train.pose.headS);
        return (
          <g key={train.id}>
            <circle cx={train.point.x} cy={train.point.z + yOffset} r="15" fill={fill} stroke="#f7fbff" strokeWidth="4" />
            <text x={train.point.x} y={train.point.z + yOffset + 5} fill="#071923" textAnchor="middle" fontSize="12" fontWeight="900">{train.id}</text>
            {station ? <title>{station.name}</title> : null}
          </g>
        );
      })}
    </svg>
  );
}

export default function Rail3dSimPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [state, setState] = useState(() => createNewState());
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const rows = useMemo(() => trainRows(state), [state]);
  const blocks = useMemo(() => blockSummary(state), [state]);
  const score = scoreState(state);
  const completed = rows.filter((row) => row.phase === 'DONE').length;
  const stopped = rows.filter((row) => row.signalState === 'STOP').length;

  const startNewRun = () => {
    setState(createNewState());
    setMessage('');
  };

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 Rail3D Sim 진행 상태를 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `Rail3D ${formatTime(state.nowS)}`,
        version: SAVE_VERSION,
        summary: summaryForState(state),
        payload: { state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('Rail3D Sim 진행 상태를 저장했습니다.');
      showToast({ tone: 'success', message: 'Rail3D Sim 진행 상태를 저장했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 저장된 Rail3D Sim 진행 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 Rail3D Sim 진행 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      setState(normalizeState(detail?.save?.payload?.state));
      setMessage('저장된 Rail3D Sim 진행 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 Rail3D Sim 진행 상태를 불러왔습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '불러오기에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 Rail3D Sim 운행 기록을 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `Rail3D Sim - ${formatTime(state.nowS)}`,
        mode: 'transport-sim',
        result: completed === rows.length ? 'service-complete' : 'route-snapshot',
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('Rail3D Sim 운행 기록을 전적에 남겼습니다.');
      showToast({ tone: 'success', message: 'Rail3D Sim 운행 기록을 전적에 남겼습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const actions = (
    <>
      <button type="button" onClick={startNewRun}>초기화</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</button>
      <Link href="/games/rail3d-sim">상세</Link>
    </>
  );

  const metrics = [
    { label: '시각', value: formatTime(state.nowS) },
    { label: '열차', value: rows.length },
    { label: '종착', value: `${completed}/${rows.length}` },
    { label: 'STOP', value: stopped },
    { label: '점유 블록', value: blocks.OCCUPIED },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 플레이는 가능하지만 저장, 불러오기, 전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    stopped ? { key: 'stop', tone: 'error', text: 'STOP 신호가 발생했습니다. 같은 블록을 먼저 점유한 열차가 있어 뒤 열차가 대기 중입니다.' } : null,
  ];

  return (
    <GamePlayShell
      kicker="Rail3D Sim"
      title="Rail3D 운행 디버그"
      description="업로드된 rail3d-sim MVP의 샘플 노선, 서비스 시간표, 블록 점유와 STOP/GO 디버그 흐름을 사이트용 transport slice로 이식했습니다."
      summaryLabel="Rail3D Sim 요약"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>운행 제어</h2>
            <span>{formatTime(state.nowS)}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="노드" value={TRACK.nodes.length} />
            <SmallStat label="엣지" value={TRACK.edges.length} />
            <SmallStat label="역" value={TRACK.stations.length} />
            <SmallStat label="블록" value={blocks.total} />
          </div>
          <label className="game-save-json-field">
            <span>스텝 초</span>
            <select value={state.stepSeconds} onChange={(event) => setState((current) => setStepSecondsAction(current, event.target.value))}>
              {[10, 30, 60, 120, 300].map((seconds) => <option value={seconds} key={seconds}>{seconds}s</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>Lookahead 블록</span>
            <select value={state.lookaheadBlocks} onChange={(event) => setState((current) => setLookaheadBlocksAction(current, event.target.value))}>
              {[0, 1, 2, 3].map((count) => <option value={count} key={count}>{count}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={() => setState((current) => stepAction(current))}>1 Step</ActionButton>
            <ActionButton onClick={() => setState((current) => runForAction(current, 300))}>5분 진행</ActionButton>
            <ActionButton onClick={() => setState((current) => runForAction(current, 1200))}>20분 진행</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>블록 상태</h2>
            <span>{blocks.OCCUPIED}/{blocks.total}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="FREE" value={blocks.FREE} />
            <SmallStat label="OCCUPIED" value={blocks.OCCUPIED} />
            <SmallStat label="RESERVED" value={blocks.RESERVED} />
            <SmallStat label="대기초" value={rows.reduce((sum, row) => sum + row.waitSeconds, 0)} />
          </div>
          <div className="games-empty">
            현재 slice는 원본 MVP의 디버그 목적에 맞춰 블록 점유와 STOP 신호를 우선 표시합니다. 전체 3D 렌더링은 다음 단계에서 Three.js로 분리하는 편이 맞습니다.
          </div>
        </section>
      </section>

      <section className="games-panel">
        <div className="games-panel-title">
          <h2>미니맵</h2>
          <span>sampleTrack.json</span>
        </div>
        <RailMap state={state} />
      </section>

      <section className="games-dashboard">
        {rows.map((row) => (
          <section className="games-panel" key={row.id}>
            <div className="games-panel-title">
              <h2>{row.id} / {row.serviceName}</h2>
              <span>{row.signalState}</span>
            </div>
            <div className="games-rank-split">
              <SmallStat label="상태" value={row.phase} />
              <SmallStat label="다음 역" value={row.nextStation} />
              <SmallStat label="속도" value={`${row.speedKmh}km/h`} />
              <SmallStat label="대기" value={`${row.waitSeconds}s`} />
            </div>
            <div className="game-save-list">
              <article className="game-save-row">
                <div>
                  <span>{row.edgeId} / {row.headS}m</span>
                  <strong>{row.blockedBy ? `${row.blockedBy} 때문에 대기` : '진행 가능'}</strong>
                </div>
                <strong>{row.lastArrivalDelay > 0 ? `+${row.lastArrivalDelay}s` : '정시'}</strong>
              </article>
            </div>
          </section>
        ))}
      </section>

      <section className="games-panel">
        <div className="games-panel-title">
          <h2>운행 로그</h2>
          <span>{state.runId}</span>
        </div>
        <div className="games-activity-list">
          {state.log.slice(0, 10).map((line, index) => (
            <div key={`${line}-${index}`}>
              <strong>{line}</strong>
            </div>
          ))}
        </div>
      </section>
    </GamePlayShell>
  );
}
