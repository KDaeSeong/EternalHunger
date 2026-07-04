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
  SEGMENTS,
  TRACK,
  blockSummary,
  createNewState,
  formatTime,
  getPlayTimeSec,
  mapViewState,
  normalizeState,
  pointOnEdge,
  runForAction,
  scheduleReport,
  scoreState,
  segmentSummary,
  setLookaheadBlocksAction,
  setStepSecondsAction,
  stepAction,
  summaryForState,
  trainDebugDetail,
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

function RailMap({ state, selectedTrainId }) {
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
        const selected = train.id === selectedTrainId;
        return (
          <g key={train.id}>
            <circle cx={train.point.x} cy={train.point.z + yOffset} r={selected ? 21 : 15} fill={selected ? '#fbbf24' : fill} stroke="#f7fbff" strokeWidth={selected ? 5 : 4} />
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
  const [selectedTrainId, setSelectedTrainId] = useState('T1');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const rows = useMemo(() => trainRows(state), [state]);
  const blocks = useMemo(() => blockSummary(state), [state]);
  const segments = useMemo(() => segmentSummary(state), [state]);
  const report = useMemo(() => scheduleReport(state), [state]);
  const selectedTrain = useMemo(() => trainDebugDetail(state, selectedTrainId), [state, selectedTrainId]);
  const score = scoreState(state);
  const completed = rows.filter((row) => row.phase === 'DONE').length;
  const stopped = rows.filter((row) => row.signalState === 'STOP').length;
  const tokenWaits = rows.filter((row) => row.stopReason?.kind === 'TOKEN_WAIT').length;

  const startNewRun = () => {
    const nextState = createNewState();
    setState(nextState);
    setSelectedTrainId(nextState.trains[0]?.id || 'T1');
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
      const nextState = normalizeState(detail?.save?.payload?.state);
      setState(nextState);
      setSelectedTrainId(nextState.trains[0]?.id || 'T1');
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
    { label: 'TOKEN', value: tokenWaits },
    { label: 'SEG', value: SEGMENTS.length },
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
            <span>선택 열차</span>
            <select value={selectedTrain?.id || selectedTrainId} onChange={(event) => setSelectedTrainId(event.target.value)}>
              {rows.map((row) => <option value={row.id} key={row.id}>{row.id} / {row.serviceName}</option>)}
            </select>
          </label>
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
          <div className="game-save-list">
            {segments.map((segment) => (
              <article className="game-save-row" key={segment.id}>
                <div>
                  <span>{segment.edgeIds.join(', ')} · entry {segment.entryStations.join(', ') || '-'}</span>
                  <strong>{segment.id}</strong>
                </div>
                <strong>{segment.owner ? `${segment.owner} 점유` : 'FREE'}{segment.waiting.length ? ` · 대기 ${segment.waiting.join(', ')}` : ''}</strong>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="games-panel">
        <div className="games-panel-title">
          <h2>미니맵</h2>
          <span>sampleTrack.json</span>
        </div>
        <RailMap state={state} selectedTrainId={selectedTrain?.id || selectedTrainId} />
      </section>

      {selectedTrain ? (
        <section className="games-dashboard">
          <section className="games-panel">
            <div className="games-panel-title">
              <h2>선택 열차 디버그</h2>
              <span>{selectedTrain.id} / {selectedTrain.signalState}</span>
            </div>
            <div className="games-rank-split">
              <SmallStat label="상태" value={selectedTrain.phase} />
              <SmallStat label="현재 역" value={selectedTrain.currentStation} />
              <SmallStat label="다음 역" value={selectedTrain.nextStation} />
              <SmallStat label="속도" value={`${selectedTrain.speedKmh || 0}km/h`} />
              <SmallStat label="현재 블록" value={selectedTrain.occupiedBlockId || '-'} />
              <SmallStat label="예약 블록" value={selectedTrain.reservedBlocks.length} />
              <SmallStat label="세그먼트" value={selectedTrain.segmentId || '-'} />
              <SmallStat label="토큰" value={selectedTrain.segmentOwner ? `${selectedTrain.segmentOwner} 점유` : 'FREE'} />
            </div>
            <div className="game-save-list" style={{ marginTop: 12 }}>
              <article className="game-save-row">
                <div>
                  <span>{selectedTrain.pose.edgeId} / {Math.round(selectedTrain.pose.headS)}m / dir {selectedTrain.pose.dir}</span>
                  <strong>{selectedTrain.blockedBy ? `${selectedTrain.blockedBy} 때문에 대기` : '진행 가능'}</strong>
                  <small>
                    {selectedTrain.stopReason
                      ? `${selectedTrain.stopReason.kind}${selectedTrain.stopReason.segmentId ? ` · ${selectedTrain.stopReason.segmentId}` : ''}`
                      : '신호 대기 없음'}
                  </small>
                </div>
                <strong>{selectedTrain.waitSeconds || 0}s</strong>
              </article>
              <article className="game-save-row">
                <div>
                  <span>{selectedTrain.segmentEdges.length ? selectedTrain.segmentEdges.join(', ') : '세그먼트 edge 없음'}</span>
                  <strong>예약: {selectedTrain.reservedBlocks.map((block) => block.id).join(', ') || '없음'}</strong>
                  <small>점유: {selectedTrain.occupiedBlocks.map((block) => block.id).join(', ') || '없음'}</small>
                </div>
                <strong>{selectedTrain.segmentEntries.join(', ') || '-'}</strong>
              </article>
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>선택 열차 정차표</h2>
              <span>{selectedTrain.stops.length} stops</span>
            </div>
            <div className="game-save-list">
              {selectedTrain.stops.map((stop) => (
                <article className="game-save-row" key={`${selectedTrain.id}-${stop.index}`}>
                  <div>
                    <span>
                      {formatTime(stop.scheduledArriveS)} 도착 / {formatTime(stop.scheduledDepartS)} 출발
                      {stop.arriveDelayS !== null ? ` · 지연 ${Math.max(0, stop.arriveDelayS)}s` : ''}
                    </span>
                    <strong>{stop.stationName}</strong>
                    <small>
                      실제 도착 {stop.actualArriveS === null ? '-' : formatTime(stop.actualArriveS)}
                      {' · '}
                      실제 출발 {stop.actualDepartS === null ? '-' : formatTime(stop.actualDepartS)}
                    </small>
                  </div>
                  <strong>{stop.status}</strong>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : null}

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>시간표 리포트</h2>
            <span>{report.totals.arrivedStops}/{report.totals.totalStops} stops</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="종착" value={`${report.totals.completed}/${report.totals.trains}`} />
            <SmallStat label="누적 지연" value={`${report.totals.totalDelayS}s`} />
            <SmallStat label="최대 지연" value={`${report.totals.maxDelayS}s`} />
            <SmallStat label="총 대기" value={`${report.totals.totalWaitS}s`} />
          </div>
          <div className="games-activity-list" style={{ marginTop: 12 }}>
            {report.recommendations.map((line) => (
              <div key={line}><strong>{line}</strong></div>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>열차별 시간표</h2>
            <span>{report.trains.length}편성</span>
          </div>
          <div className="game-save-list">
            {report.trains.map((train) => (
              <article className="game-save-row" key={train.id}>
                <div>
                  <span>{train.serviceName} · 다음 {train.nextStation} · {train.arrived}/{train.totalStops} stop</span>
                  <strong>{train.id} {train.signalState} · {train.phase}</strong>
                  <small>
                    지연 {train.positiveDelayS}s · 대기 {train.waitSeconds}s
                    {train.stopReason ? ` · ${train.stopReason.kind}${train.blockedBy ? ` by ${train.blockedBy}` : ''}` : ''}
                  </small>
                </div>
                <strong>{train.remaining ? `${train.remaining} 남음` : '완료'}</strong>
              </article>
            ))}
          </div>
        </section>
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
                  <span>{row.edgeId} / {row.headS}m · {row.segmentId || 'segment 없음'}</span>
                  <strong>{row.blockedBy ? `${row.blockedBy} 때문에 대기` : '진행 가능'}</strong>
                </div>
                <strong>{row.stopReason?.kind === 'TOKEN_WAIT' ? 'TOKEN_WAIT' : row.lastArrivalDelay > 0 ? `+${row.lastArrivalDelay}s` : '정시'}</strong>
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
