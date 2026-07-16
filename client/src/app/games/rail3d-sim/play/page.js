'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import GameActionIcon from '../../_components/GameActionIcon';
import Rail3dFeatureTabs from '../_components/Rail3dFeatureTabs';
import GamePlayShell from '../../_components/GamePlayShell';
import { GameControlButton, RecentActionResult } from '../../_components/GamePlayPrimitives';
import useGameSfx from '../../_lib/useGameSfx';
import {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  SEGMENTS,
  bottleneckAnalysisReport,
  blockSummary,
  createNewState,
  formatTime,
  getPlayTimeSec,
  normalizeState,
  portingCompletionReport,
  runForAction,
  scheduleReport,
  scoreState,
  segmentSummary,
  setLookaheadBlocksAction,
  setStepSecondsAction,
  stationBoardRows,
  stepAction,
  summaryForState,
  trainDebugDetail,
  trainRows,
} from '../_lib/rail3dEngine';
import {
  rail3dFeedbackCue,
  rail3dFeedbackPresentation,
  rail3dFeedbackSnapshot,
  rail3dResultPresentation,
} from '../_lib/rail3dFeedback';
import { actionFeedbackText } from '../_components/Rail3dPlayPanels';

function buildDispatchPlan({ rows, completed, stopped, tokenWaits, bottleneck, report, state }) {
  const topWaiting = bottleneck.waitingTrains[0] || null;
  const nextTrain = rows.find((row) => row.phase !== 'DONE') || rows[0] || null;
  const items = [];

  if (topWaiting) {
    items.push({
      id: 'top-waiting',
      kind: '우선',
      title: `${topWaiting.id} 대기 원인 포커스`,
      detail: `${topWaiting.reason}${topWaiting.blockedBy ? ` by ${topWaiting.blockedBy}` : ''} · 대기 ${topWaiting.waitSeconds}s · 지연 ${topWaiting.delayS}s`,
      action: 'focus-train',
      trainId: topWaiting.id,
      actionLabel: '열차 보기',
    });
  }

  if (Number(state.lookaheadBlocks) !== Number(bottleneck.recommendedLookahead)) {
    items.push({
      id: 'lookahead',
      kind: '신호',
      title: `Lookahead ${bottleneck.recommendedLookahead} 적용`,
      detail: `현재 ${state.lookaheadBlocks}블록 · STOP ${stopped}편 · 토큰 대기 ${tokenWaits}편`,
      action: 'apply-lookahead',
      actionLabel: '적용',
    });
  }

  if (bottleneck.proposedDepartureShiftS) {
    items.push({
      id: 'departure-shift',
      kind: '다이아',
      title: `후속 출발 +${bottleneck.proposedDepartureShiftS}s 검토`,
      detail: `최소 간격 ${bottleneck.minHeadwayS === null ? '-' : formatTime(bottleneck.minHeadwayS)} · 권장 ${formatTime(bottleneck.idealHeadwayS)}`,
      action: 'show-analysis',
      actionLabel: '다이아 보기',
    });
  }

  if (completed < rows.length) {
    items.push({
      id: 'advance',
      kind: stopped ? '확인' : '진행',
      title: stopped ? '1 Step으로 정지 원인 재확인' : '5분 진행으로 흐름 확인',
      detail: report.recommendations[0] || `${nextTrain?.id || '열차'} 운행을 계속 관찰하세요.`,
      action: stopped ? 'step' : 'run-5',
      trainId: nextTrain?.id || '',
      actionLabel: stopped ? '1 Step' : '5분 진행',
    });
  } else {
    items.push({
      id: 'record',
      kind: '완료',
      title: '운행 완료 기록',
      detail: '모든 열차가 종착했습니다. 현재 스냅샷을 전적에 남길 수 있습니다.',
      action: 'record',
      actionLabel: '전적 기록',
    });
  }

  return {
    headline: topWaiting
      ? `${topWaiting.id} 대기 해소가 최우선입니다.`
      : completed >= rows.length
        ? '운행이 완료됐습니다.'
        : bottleneck.healthScore >= 88
          ? '현재 흐름은 안정권입니다.'
          : '병목 점검 후 진행하세요.',
    items: items.slice(0, 4),
  };
}

export default function Rail3dSimPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const playGameSfx = useGameSfx({ theme: 'rail' });
  const [state, setState] = useState(() => createNewState());
  const [selectedTrainId, setSelectedTrainId] = useState('T1');
  const [activeFeatureTabId, setActiveFeatureTabId] = useState('operations');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [actionResult, setActionResult] = useState('');
  const [actionPresentation, setActionPresentation] = useState({
    action: '',
    cue: '',
    key: 'idle',
    label: '운행 결과',
    tone: '',
  });
  const feedbackRef = useRef(rail3dFeedbackSnapshot(state));

  const rows = useMemo(() => trainRows(state), [state]);
  const blocks = useMemo(() => blockSummary(state), [state]);
  const segments = useMemo(() => segmentSummary(state), [state]);
  const report = useMemo(() => scheduleReport(state), [state]);
  const bottleneck = useMemo(() => bottleneckAnalysisReport(state), [state]);
  const portingCompletion = useMemo(() => portingCompletionReport(state), [state]);
  const stationBoard = useMemo(() => stationBoardRows(state), [state]);
  const selectedTrain = useMemo(() => trainDebugDetail(state, selectedTrainId), [state, selectedTrainId]);
  const score = scoreState(state);
  const completed = rows.filter((row) => row.phase === 'DONE').length;
  const stopped = rows.filter((row) => row.signalState === 'STOP').length;
  const tokenWaits = rows.filter((row) => row.stopReason?.kind === 'TOKEN_WAIT').length;
  const dispatchPlan = useMemo(
    () => buildDispatchPlan({ rows, completed, stopped, tokenWaits, bottleneck, report, state }),
    [rows, completed, stopped, tokenWaits, bottleneck, report, state],
  );
  const recentActionText = actionResult || state.log?.[0] || '아직 실행한 운행 액션이 없습니다.';

  useEffect(() => {
    const current = rail3dFeedbackSnapshot(state);
    const cue = rail3dFeedbackCue(feedbackRef.current, current);
    if (cue) playGameSfx(cue);
    feedbackRef.current = current;
  }, [playGameSfx, state]);

  const applyRailAction = (label, updater, fallback = '') => {
    const nextState = updater(state);
    setState(nextState);
    setActionResult(actionFeedbackText(state, nextState, label, fallback));
    setActionPresentation(rail3dFeedbackPresentation(state, nextState));
  };

  const startNewRun = () => {
    const nextState = createNewState();
    setState(nextState);
    setSelectedTrainId(nextState.trains[0]?.id || 'T1');
    setActiveFeatureTabId('operations');
    setMessage('');
    setActionResult('새 Rail3D Sim 운행을 시작했습니다.');
    setActionPresentation(rail3dFeedbackPresentation(state, nextState));
    feedbackRef.current = rail3dFeedbackSnapshot(nextState);
  };

  const focusTrain = (trainId, tabId = 'trains') => {
    if (trainId) {
      setSelectedTrainId(trainId);
      const row = rows.find((item) => item.id === trainId);
      setActionResult(`${trainId} 열차를 선택했습니다.${row ? ` ${row.serviceName} · ${row.signalState} · 다음 ${row.nextStation}.` : ''}`);
      setActionPresentation({
        action: 'dispatch',
        cue: '',
        key: 'trainSelect',
        label: '열차 선택',
        tone: 'highlight',
      });
    }
    setActiveFeatureTabId(tabId);
  };

  const runDispatchAction = (item) => {
    if (item.action === 'focus-train') {
      focusTrain(item.trainId, 'trains');
      setActionResult(`${item.trainId} 열차를 선택했습니다. ${item.detail}`);
      return;
    }
    if (item.action === 'apply-lookahead') {
      applyRailAction('권장 Lookahead 적용', (current) => setLookaheadBlocksAction(current, bottleneck.recommendedLookahead));
      setActiveFeatureTabId('analysis');
      return;
    }
    if (item.action === 'show-analysis') {
      setActiveFeatureTabId('analysis');
      setActionResult(item.detail);
      return;
    }
    if (item.action === 'step') {
      applyRailAction('1 Step', (current) => stepAction(current));
      if (item.trainId) setSelectedTrainId(item.trainId);
      return;
    }
    if (item.action === 'run-5') {
      applyRailAction('5분 진행', (current) => runForAction(current, 300));
      if (item.trainId) setSelectedTrainId(item.trainId);
      return;
    }
    if (item.action === 'record') void recordRun();
  };

  const openAnalysisTab = () => {
    setActiveFeatureTabId('analysis');
  };

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 Rail3D Sim 진행 상태를 저장할 수 있습니다.');
      setActionResult('로그인하면 Rail3D Sim 진행 상태를 저장할 수 있습니다.');
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
      setActionResult(`Rail3D Sim 진행 상태를 저장했습니다. 현재 시각 ${formatTime(state.nowS)}.`);
      showToast({ tone: 'success', message: 'Rail3D Sim 진행 상태를 저장했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '저장에 실패했습니다.';
      setMessage(nextMessage);
      setActionResult(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 저장된 Rail3D Sim 진행 상태를 불러올 수 있습니다.');
      setActionResult('로그인하면 저장된 Rail3D Sim 진행 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 Rail3D Sim 진행 상태가 없습니다.');
        setActionResult('저장된 Rail3D Sim 진행 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const nextState = normalizeState(detail?.save?.payload?.state);
      setState(nextState);
      feedbackRef.current = rail3dFeedbackSnapshot(nextState);
      setSelectedTrainId(nextState.trains[0]?.id || 'T1');
      setMessage('저장된 Rail3D Sim 진행 상태를 불러왔습니다.');
      setActionResult(actionFeedbackText(state, nextState, '불러오기', '저장된 Rail3D Sim 진행 상태를 불러왔습니다.'));
      showToast({ tone: 'success', message: '저장된 Rail3D Sim 진행 상태를 불러왔습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '불러오기에 실패했습니다.';
      setMessage(nextMessage);
      setActionResult(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 Rail3D Sim 운행 기록을 전적에 남길 수 있습니다.');
      setActionResult('로그인하면 Rail3D Sim 운행 기록을 전적에 남길 수 있습니다.');
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
      setActionResult(`Rail3D Sim 운행 기록을 전적에 남겼습니다. 점수 ${score.toLocaleString('ko-KR')}.`);
      showToast({ tone: 'success', message: 'Rail3D Sim 운행 기록을 전적에 남겼습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      setActionResult(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const actions = (
    <>
      <GameControlButton action="new" onClick={startNewRun}>새 운행</GameControlButton>
      <GameControlButton action="save" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</GameControlButton>
      <GameControlButton action="load" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</GameControlButton>
      <GameControlButton action="archive" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</GameControlButton>
      <Link className="game-control-button" data-game-sfx="nav" href="/myanime/rail3d-sim">
        <GameActionIcon action="settings" label="상세" />
        <span className="game-action-button__label">상세</span>
      </Link>
    </>
  );

  const metrics = [
    { label: '시각', value: formatTime(state.nowS) },
    { label: '열차', value: rows.length },
    { label: '종착', value: `${completed}/${rows.length}` },
    { label: 'STOP', value: stopped },
    { label: 'TOKEN', value: tokenWaits },
    { label: '병목', value: `${bottleneck.healthScore}점` },
    { label: '다이아', value: bottleneck.proposedDepartureShiftS ? `+${bottleneck.proposedDepartureShiftS}s` : '유지' },
    { label: '이식', value: `${portingCompletion.completionPct}%` },
    { label: 'SEG', value: SEGMENTS.length },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 플레이는 가능하지만 저장, 불러오기, 전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    stopped ? { key: 'stop', tone: 'error', text: 'STOP 신호가 발생했습니다. 같은 블록을 먼저 점유한 열차가 있어 뒤 열차가 대기 중입니다.' } : null,
  ];

  const resultPresentation = rail3dResultPresentation(recentActionText, actionPresentation);

  const guide = {
    title: '운행 코치',
    badge: stopped ? 'STOP' : `${completed}/${rows.length}`,
    primaryTitle: stopped ? '정차 원인 확인' : completed === rows.length ? '운행 완료' : '다음 운행 Step',
    primaryText: stopped
      ? '같은 블록에 열차가 겹치거나 토큰 대기가 길어졌습니다. 병목 탭에서 제안 시프트를 확인하세요.'
      : dispatchPlan.headline || report.recommendations[0] || '1 Step 또는 5분 진행으로 운행 흐름을 확인하세요.',
    focusRows: [
      { label: '종착', value: `${completed}/${rows.length}` },
      { label: 'STOP', value: stopped },
      { label: 'TOKEN', value: tokenWaits },
      { label: '병목', value: `${bottleneck.healthScore}점` },
    ],
    adviceLines: dispatchPlan.items.slice(0, 4).map((item, index) => ({
      kind: index === 0 ? '우선' : `${index + 1}순위`,
      title: item.title,
      detail: item.detail,
    })),
  };

  return (
    <GamePlayShell
      className="rail3d-page-shell"
      kicker="Rail3D Sim"
      title="Rail3D 운행 디버그"
      description="업로드된 rail3d-sim MVP의 샘플 노선, 서비스 시간표, 블록 점유와 STOP/GO 디버그 흐름을 사이트용 transport slice로 이식했습니다."
      summaryLabel="Rail3D Sim 요약"
      summaryDensity="micro"
      primaryMetricLimit={10}
      heroLayout="compact"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameAdvisorPanel {...guide} compact minimal storageKey="rail3d-operation-coach" />
      <RecentActionResult
        action={resultPresentation.action}
        label={resultPresentation.label}
        text={recentActionText}
        tone={resultPresentation.tone}
        pinned
      />

      <Rail3dFeatureTabs
        activeFeatureTabId={activeFeatureTabId}
        applyRailAction={applyRailAction}
        blocks={blocks}
        bottleneck={bottleneck}
        completed={completed}
        dispatchPlan={dispatchPlan}
        focusTrain={focusTrain}
        openAnalysisTab={openAnalysisTab}
        portingCompletion={portingCompletion}
        report={report}
        runDispatchAction={runDispatchAction}
        rows={rows}
        score={score}
        segments={segments}
        selectedTrain={selectedTrain}
        selectedTrainId={selectedTrainId}
        setActiveFeatureTabId={setActiveFeatureTabId}
        setSelectedTrainId={setSelectedTrainId}
        state={state}
        stationBoard={stationBoard}
        stopped={stopped}
        tokenWaits={tokenWaits}
      />
    </GamePlayShell>
  );
}
