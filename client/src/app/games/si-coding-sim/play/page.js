'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import GameActionIcon from '../../_components/GameActionIcon';
import { useGameBgm } from '../../_components/GameBgmProvider';
import GamePlayShell from '../../_components/GamePlayShell';
import { GameControlButton, RecentActionResult } from '../../_components/GamePlayPrimitives';
import useGameSfx from '../../_lib/useGameSfx';
import {
  createNewState,
  getCurrentTask,
  resetTaskAction,
  revealHintAction,
  selectTaskPackAction,
  selectTaskAction,
  startSelectedProjectSeedAction,
  submitTaskAction,
} from '../_lib/siCodingSimEngine';
import { buildSiCodingSimPlayViewModel } from '../_lib/siCodingSimPlayViewModel';
import SiCodingSimFeatureTabs from '../_components/SiCodingSimFeatureTabs';
import useSiCodingSimPersistence from '../_hooks/useSiCodingSimPersistence';
import {
  siCodingFeedbackCue,
  siCodingFeedbackPresentation,
  siCodingFeedbackSnapshot,
  siCodingResultPresentation,
} from '../_lib/siCodingSimFeedback';
import {
  resolveSiCodingBgmScene,
  siCodingResultMusic,
} from '../_lib/siCodingSimSoundtrack';


export default function SiCodingSimPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const { setMusicScene } = useGameBgm();
  const playGameSfx = useGameSfx({ theme: 'coding' });
  const [state, setState] = useState(() => createNewState());
  const stateRef = useRef(state);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [taskFilters, setTaskFilters] = useState({
    query: '',
    difficulty: 'all',
    status: 'all',
    tag: 'all',
    capability: 'all',
  });
  const [activeFeatureTabId, setActiveFeatureTabId] = useState('field');
  const codePanelRef = useRef(null);
  const hintPanelRef = useRef(null);
  const documentPanelRef = useRef(null);
  const executionPanelRef = useRef(null);
  const musicSceneTimerRef = useRef(null);
  const [actionResult, setActionResult] = useState('');
  const [actionPresentation, setActionPresentation] = useState({
    action: '',
    cue: '',
    key: 'idle',
    label: '검수 결과',
    tone: '',
  });
  const feedbackRef = useRef(siCodingFeedbackSnapshot(state));

  const viewModel = useMemo(() => buildSiCodingSimPlayViewModel({
    selectedFileId,
    state,
    taskFilters,
  }), [selectedFileId, state, taskFilters]);

  const {
    activeContent,
    activeFile,
    activeFileId,
    activeTasks,
    canRevealHint,
    currentTaskRow,
    documentPlay,
    documentProgress,
    execution,
    files,
    filteredRows,
    insightRows,
    latestEvaluation,
    outcome,
    packAudit,
    packRows,
    portingCompletion,
    profileSummary,
    projectRows,
    reportText,
    revealedHints,
    rows,
    score,
    seedRoadmap,
    submissionComparison,
    submissionReadiness,
    support,
    task,
    taskId,
    taskTagOptions,
  } = viewModel;

  const baseMusicScene = useMemo(() => resolveSiCodingBgmScene({
    activeTabId: activeFeatureTabId,
    stamina: state.resources.stamina,
    mentality: state.resources.mentality,
    techDebt: state.resources.techDebt,
    outcomeScore: outcome?.score ?? null,
    evaluationGrade: latestEvaluation?.grade || '',
    submittedTasks: latestEvaluation?.submittedTasks || 0,
    totalTasks: latestEvaluation?.totalTasks || 0,
  }), [
    activeFeatureTabId,
    latestEvaluation?.grade,
    latestEvaluation?.submittedTasks,
    latestEvaluation?.totalTasks,
    outcome?.score,
    state.resources.mentality,
    state.resources.stamina,
    state.resources.techDebt,
  ]);

  useEffect(() => {
    if (musicSceneTimerRef.current) window.clearTimeout(musicSceneTimerRef.current);
    musicSceneTimerRef.current = null;
    setMusicScene(baseMusicScene);
  }, [baseMusicScene, setMusicScene]);

  useEffect(() => () => {
    if (musicSceneTimerRef.current) window.clearTimeout(musicSceneTimerRef.current);
    setMusicScene('');
  }, [setMusicScene]);

  const playMusicTransition = (presentation) => {
    const transition = siCodingResultMusic(presentation);
    if (!transition) return;
    if (musicSceneTimerRef.current) window.clearTimeout(musicSceneTimerRef.current);
    setMusicScene(transition.theme);
    musicSceneTimerRef.current = window.setTimeout(() => {
      setMusicScene(baseMusicScene);
      musicSceneTimerRef.current = null;
    }, transition.durationMs);
  };

  useEffect(() => {
    stateRef.current = state;
    const current = siCodingFeedbackSnapshot(state);
    const cue = siCodingFeedbackCue(feedbackRef.current, current);
    if (cue) playGameSfx(cue);
    feedbackRef.current = current;
  }, [playGameSfx, state]);

  const updateTaskFilter = (key, value) => {
    setTaskFilters((current) => ({ ...current, [key]: value }));
  };

  const applyCodingState = (updater) => {
    const previousState = stateRef.current;
    const nextState = typeof updater === 'function' ? updater(previousState) : updater;
    const presentation = siCodingFeedbackPresentation(previousState, nextState);
    stateRef.current = nextState;
    setState(nextState);
    if (presentation.key !== 'idle') {
      setActionPresentation(presentation);
      setActionResult(presentation.detail || nextState.log?.[0] || '상태가 변경되었습니다.');
      playMusicTransition(presentation);
    }
    return nextState;
  };

  const startNewRun = () => {
    const previousState = stateRef.current;
    const nextState = createNewState();
    stateRef.current = nextState;
    setState(nextState);
    setSelectedFileId(getCurrentTask(nextState)?.files?.[0]?.id || '');
    setMessage('');
    setActionResult('새 SI Coding Sim 현장을 시작했습니다.');
    const presentation = siCodingFeedbackPresentation(previousState, nextState);
    setActionPresentation(presentation);
    playMusicTransition(presentation);
    feedbackRef.current = siCodingFeedbackSnapshot(nextState);
  };

  const {
    busy,
    loadRun,
    message,
    recordRun,
    saveRun,
    setMessage,
  } = useSiCodingSimPersistence({
    onLoaded: (nextState) => {
      stateRef.current = nextState;
      feedbackRef.current = siCodingFeedbackSnapshot(nextState);
      setSelectedFileId(getCurrentTask(nextState)?.files?.[0]?.id || '');
    },
    score,
    setActionResult,
    setState,
    showToast,
    state,
    token,
  });
  const scrollToPanel = (panel) => {
    const tabByPanel = {
      code: 'code',
      hint: 'docs',
      document: 'docs',
      execution: 'code',
    };
    if (tabByPanel[panel]) setActiveFeatureTabId(tabByPanel[panel]);
    const refByPanel = {
      code: codePanelRef,
      hint: hintPanelRef,
      document: documentPanelRef,
      execution: executionPanelRef,
    };
    const ref = refByPanel[panel];
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const selectTask = (taskId, panel) => {
    const nextTask = activeTasks.find((item) => item.id === taskId) || activeTasks[0];
    setSelectedFileId(nextTask?.files?.[0]?.id || '');
    applyCodingState((current) => selectTaskAction(current, taskId));
    scrollToPanel(panel);
  };

  const selectTaskPack = (packId) => {
    setSelectedFileId('');
    applyCodingState((current) => selectTaskPackAction(current, packId));
    scrollToPanel('code');
  };

  const startSelectedSeed = () => {
    setSelectedFileId('');
    applyCodingState((current) => startSelectedProjectSeedAction(current));
    setMessage('선택한 후보로 차기 현장을 시작했습니다.');
    scrollToPanel('code');
  };

  const submitCurrentTask = () => {
    if (!task) return;
    applyCodingState((current) => submitTaskAction(current, task.id));
  };

  const revealCurrentHint = () => {
    if (!task || !canRevealHint) return;
    applyCodingState((current) => revealHintAction(current, task.id));
    scrollToPanel('hint');
  };

  const resetCurrentTask = () => {
    if (!task) return;
    applyCodingState((current) => resetTaskAction(current, task.id));
  };

  const actions = (
    <>
      <GameControlButton action="new" onClick={startNewRun}>새 현장</GameControlButton>
      <GameControlButton action="save" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</GameControlButton>
      <GameControlButton action="load" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</GameControlButton>
      <GameControlButton action="archive" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</GameControlButton>
      <Link className="game-control-button" data-game-sfx="nav" href="/myanime/si-coding-sim">
        <GameActionIcon action="settings" label="상세" />
        <span className="game-action-button__label">상세</span>
      </Link>
    </>
  );

  const metrics = [
    { label: '직급', value: profileSummary.career.rankTitle },
    { label: '성장', value: `${profileSummary.totalImprovedRuns}회` },
    { label: '현장', value: state.taskSet?.title || '기본 현장' },
    { label: '과제', value: `${Object.keys(state.taskOutcomes).length}/${activeTasks.length}` },
    { label: '체력', value: state.resources.stamina },
    { label: '멘탈', value: state.resources.mentality },
    { label: '고객신뢰', value: state.resources.clientTrust },
    { label: '기술부채', value: state.resources.techDebt },
    { label: '예비비', value: `${support.cashReserve}pt` },
    { label: '감사', value: `${packAudit.averageAuditScore}점` },
    { label: '납품', value: `${submissionComparison.deliveryScore}점` },
    { label: '이식', value: `${portingCompletion.completionPct}%` },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 플레이는 가능하지만 저장, 불러오기, 전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    state.resources.stamina <= 15 || state.resources.mentality <= 15
      ? { key: 'low-resource', tone: 'error', text: '체력 또는 멘탈이 위험 수치입니다. 힌트 사용과 재검수 비용을 조심해야 합니다.' }
      : null,
  ];
  const recentActionText = actionResult || state.log?.[0] || '아직 실행한 검수 결과가 없습니다.';
  const resultPresentation = siCodingResultPresentation(recentActionText, actionPresentation);

  const guide = {
    title: '현장 코치',
    badge: task?.difficulty || latestEvaluation?.grade || '대기',
    primaryTitle: task ? task.projectName : '과제 없음',
    primaryText: task
      ? task.summary
      : '불러온 과제 데이터가 없습니다. 새 현장을 시작하거나 저장 데이터를 다시 확인하세요.',
    focusRows: [
      { label: '체력', value: state.resources.stamina },
      { label: '멘탈', value: state.resources.mentality },
      { label: '기술부채', value: state.resources.techDebt },
      { label: '예비비', value: `${support.cashReserve}pt` },
    ],
    adviceLines: [
      state.resources.stamina <= 15 || state.resources.mentality <= 15
        ? { kind: '우선', title: '리소스 회복', detail: '체력이나 멘탈이 낮습니다. 힌트/지원/휴식성 행동을 먼저 고려하세요.' }
        : null,
      task ? { kind: '과제', title: '현재 과제 검수', detail: `${task.client} · ${task.deadline} · ${task.goals?.length || 0}개 목표` } : null,
      { kind: '품질', title: '납품 점수 확인', detail: `납품 ${submissionComparison.deliveryScore}점, 이식 ${portingCompletion.completionPct}%입니다.` },
      packAudit.warnings?.[0] ? { kind: '감사', title: packAudit.warnings[0], detail: `${packAudit.averageAuditScore}점 감사 결과를 확인하세요.` } : null,
    ],
  };

  if (!task) {
    return (
      <GamePlayShell
        className="si-coding-page-shell"
        kicker="SI Coding Sim"
        title="SI 코딩 시뮬레이터"
        description="불러올 과제 데이터가 없습니다."
        actions={actions}
        metrics={metrics}
        messages={messages}
      >
        <GameAdvisorPanel {...guide} compact minimal storageKey="si-coding-field-coach" />
        <RecentActionResult
          action={resultPresentation.action}
          label={resultPresentation.label}
          text={recentActionText}
          tone={resultPresentation.tone}
          pinned
        />
      </GamePlayShell>
    );
  }

  return (
    <GamePlayShell
      className="si-coding-page-shell"
      kicker="SI Coding Sim"
      title="SI 코딩 시뮬레이터"
      description="업로드된 Step AQ/AR 과제팩의 문서, 코드 파일, 문자열 기반 검수 규칙, 힌트 비용, 프로젝트 종료 판정을 사이트용 challenge slice로 이식했습니다."
      summaryLabel="SI Coding Sim 요약"
      summaryDensity="micro"
      primaryMetricLimit={10}
      heroLayout="compact"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameAdvisorPanel {...guide} compact minimal storageKey="si-coding-field-coach" />
      <RecentActionResult
        action={resultPresentation.action}
        label={resultPresentation.label}
        text={recentActionText}
        tone={resultPresentation.tone}
        pinned
      />

      <SiCodingSimFeatureTabs
        activeContent={activeContent}
        activeFeatureTabId={activeFeatureTabId}
        activeFile={activeFile}
        activeFileId={activeFileId}
        activeTasks={activeTasks}
        canRevealHint={canRevealHint}
        codePanelRef={codePanelRef}
        currentTaskRow={currentTaskRow}
        documentPanelRef={documentPanelRef}
        documentPlay={documentPlay}
        documentProgress={documentProgress}
        execution={execution}
        executionPanelRef={executionPanelRef}
        files={files}
        filteredRows={filteredRows}
        hintPanelRef={hintPanelRef}
        insightRows={insightRows}
        latestEvaluation={latestEvaluation}
        outcome={outcome}
        packAudit={packAudit}
        packRows={packRows}
        portingCompletion={portingCompletion}
        profileSummary={profileSummary}
        projectRows={projectRows}
        reportText={reportText}
        resetCurrentTask={resetCurrentTask}
        revealCurrentHint={revealCurrentHint}
        revealedHints={revealedHints}
        rows={rows}
        score={score}
        scrollToPanel={scrollToPanel}
        seedRoadmap={seedRoadmap}
        selectTask={selectTask}
        selectTaskPack={selectTaskPack}
        setActiveFeatureTabId={setActiveFeatureTabId}
        setSelectedFileId={setSelectedFileId}
        setState={applyCodingState}
        startSelectedSeed={startSelectedSeed}
        state={state}
        submissionComparison={submissionComparison}
        submissionReadiness={submissionReadiness}
        submitCurrentTask={submitCurrentTask}
        support={support}
        task={task}
        taskFilters={taskFilters}
        taskTagOptions={taskTagOptions}
        updateTaskFilter={updateTaskFilter}
      />
    </GamePlayShell>
  );
}
