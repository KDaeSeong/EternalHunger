'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import GamePlayShell, { GameFeatureTabs } from '../../_components/GamePlayShell';
import { ActionButton, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  applyCompanySupportAction,
  companySupportSummary,
  createNewState,
  evaluateProjectAction,
  getActiveTasks,
  getCurrentTask,
  getFileContent,
  getDocumentReviewProgress,
  getPlayTimeSec,
  getReportText,
  getRevealedHints,
  normalizeState,
  passiveInsightRows,
  playerProfileSummary,
  portingCompletionReport,
  projectProgressRows,
  projectSeedRoadmap,
  resetTaskAction,
  revealHintAction,
  scoreState,
  selectTaskPackAction,
  selectProjectSeedAction,
  selectTaskAction,
  startSelectedProjectSeedAction,
  submissionComparisonReport,
  submitTaskAction,
  summaryForState,
  taskPackAuditReport,
  taskRows,
  taskPackRows,
  toggleDocumentReviewAction,
  updateFileAction,
  updateReportAction,
} from '../_lib/siCodingSimEngine';

function ResultRow({ result }) {
  const detail = (result.rules || []).map((rule) => rule.value).filter(Boolean).join(' · ');
  return (
    <article className="game-save-row">
      <div>
        <span>{result.resultType === 'document' ? 'DOC' : result.passed ? 'PASS' : 'FAIL'}</span>
        <strong>{result.label}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
      <strong>{result.passed ? '통과' : '미통과'}</strong>
    </article>
  );
}

export default function SiCodingSimPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [state, setState] = useState(() => createNewState());
  const [selectedFileId, setSelectedFileId] = useState('');
  const [taskFilters, setTaskFilters] = useState({
    query: '',
    difficulty: 'all',
    status: 'all',
    tag: 'all',
    capability: 'all',
  });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const codePanelRef = useRef(null);
  const hintPanelRef = useRef(null);
  const documentPanelRef = useRef(null);
  const executionPanelRef = useRef(null);

  const rows = useMemo(() => taskRows(state), [state]);
  const activeTasks = useMemo(() => getActiveTasks(state), [state]);
  const packRows = useMemo(() => taskPackRows(state), [state]);
  const projectRows = useMemo(() => projectProgressRows(state), [state]);
  const taskTagOptions = useMemo(() => Array.from(new Set(rows.flatMap((row) => row.tags || []))).sort((a, b) => a.localeCompare(b, 'ko-KR')), [rows]);
  const filteredRows = useMemo(() => {
    const query = taskFilters.query.trim().toLowerCase();
    return rows.filter((row) => {
      const searchable = [
        row.id,
        row.projectName,
        row.client,
        row.modeLabel,
        row.difficulty,
        row.status,
        ...(row.tags || []),
      ].join(' ').toLowerCase();
      if (query && !searchable.includes(query)) return false;
      if (taskFilters.difficulty !== 'all' && row.difficulty !== taskFilters.difficulty) return false;
      if (taskFilters.status !== 'all' && row.status !== taskFilters.status) return false;
      if (taskFilters.tag !== 'all' && !(row.tags || []).includes(taskFilters.tag)) return false;
      if (taskFilters.capability === 'execution' && !row.executionCount && !row.hiddenExecutionCount && !row.checkCount) return false;
      if (taskFilters.capability === 'document' && !row.documentCount && !row.checkpointCount) return false;
      if (taskFilters.capability === 'hint' && !row.hintCount) return false;
      return true;
    });
  }, [rows, taskFilters]);
  const task = getCurrentTask(state);
  const files = task?.files || [];
  const activeFile = files.find((file) => file.id === selectedFileId) || files[0] || null;
  const activeFileId = activeFile?.id || '';
  const activeContent = activeFileId ? getFileContent(state, task.id, activeFileId) : '';
  const reportText = task ? getReportText(state, task.id) : '';
  const revealedHints = task ? getRevealedHints(state, task.id) : [];
  const outcome = task ? state.taskOutcomes[task.id] : null;
  const latestEvaluation = state.projectEvaluations[0] || null;
  const score = scoreState(state);
  const documentPlay = task?.documentPlay || null;
  const documentProgress = task ? getDocumentReviewProgress(state, task.id) : null;
  const execution = task?.execution || null;
  const taskId = task?.id;
  const profileSummary = playerProfileSummary(state, taskId);
  const insightRows = passiveInsightRows(state, taskId);
  const currentTaskRow = rows.find((row) => row.id === task?.id) || null;
  const support = companySupportSummary(state, taskId);
  const seedRoadmap = useMemo(() => projectSeedRoadmap(state), [state]);
  const packAudit = useMemo(() => taskPackAuditReport(state), [state]);
  const submissionComparison = useMemo(() => submissionComparisonReport(state), [state]);
  const portingCompletion = useMemo(() => portingCompletionReport(state), [state]);

  const updateTaskFilter = (key, value) => {
    setTaskFilters((current) => ({ ...current, [key]: value }));
  };

  const startNewRun = () => {
    const nextState = createNewState();
    setState(nextState);
    setSelectedFileId(getCurrentTask(nextState)?.files?.[0]?.id || '');
    setMessage('');
  };

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 SI Coding Sim 진행 상태를 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `SI Coding ${summaryForState(state).submittedTasks}/${summaryForState(state).totalTasks}`,
        version: SAVE_VERSION,
        summary: summaryForState(state),
        payload: { state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('SI Coding Sim 진행 상태를 저장했습니다.');
      showToast({ tone: 'success', message: 'SI Coding Sim 진행 상태를 저장했습니다.' });
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
      setMessage('로그인하면 저장된 SI Coding Sim 진행 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 SI Coding Sim 진행 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const nextState = normalizeState(detail?.save?.payload?.state);
      const nextTask = getCurrentTask(nextState);
      setState(nextState);
      setSelectedFileId(nextTask?.files?.[0]?.id || '');
      setMessage('저장된 SI Coding Sim 진행 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 SI Coding Sim 진행 상태를 불러왔습니다.' });
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
      setMessage('로그인하면 SI Coding Sim 결과를 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `SI Coding Sim - ${latestEvaluation?.grade || 'snapshot'}`,
        mode: 'challenge-sim',
        result: latestEvaluation?.grade || 'challenge-snapshot',
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('SI Coding Sim 결과를 전적에 남겼습니다.');
      showToast({ tone: 'success', message: 'SI Coding Sim 결과를 전적에 남겼습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const scrollToPanel = (panel) => {
    const refByPanel = {
      code: codePanelRef,
      hint: hintPanelRef,
      document: documentPanelRef,
      execution: executionPanelRef,
    };
    const ref = refByPanel[panel];
    if (!ref?.current) return;
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  };

  const selectTask = (taskId, panel) => {
    const nextTask = activeTasks.find((item) => item.id === taskId) || activeTasks[0];
    setSelectedFileId(nextTask?.files?.[0]?.id || '');
    setState((current) => selectTaskAction(current, taskId));
    scrollToPanel(panel);
  };

  const selectTaskPack = (packId) => {
    setSelectedFileId('');
    setState((current) => selectTaskPackAction(current, packId));
    scrollToPanel('code');
  };

  const startSelectedSeed = () => {
    setSelectedFileId('');
    setState((current) => startSelectedProjectSeedAction(current));
    setMessage('선택한 후보로 차기 현장을 시작했습니다.');
    scrollToPanel('code');
  };

  const actions = (
    <>
      <button type="button" onClick={startNewRun}>새 현장</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</button>
      <Link href="/myanime/si-coding-sim">상세</Link>
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
        kicker="SI Coding Sim"
        title="SI 코딩 시뮬레이터"
        description="불러올 과제 데이터가 없습니다."
        actions={actions}
        metrics={metrics}
        messages={messages}
      >
        <GameAdvisorPanel {...guide} />
      </GamePlayShell>
    );
  }

  return (
    <GamePlayShell
      kicker="SI Coding Sim"
      title="SI 코딩 시뮬레이터"
      description="업로드된 Step AQ/AR 과제팩의 문서, 코드 파일, 문자열 기반 검수 규칙, 힌트 비용, 프로젝트 종료 판정을 사이트용 challenge slice로 이식했습니다."
      summaryLabel="SI Coding Sim 요약"
      summaryDensity="compact"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameAdvisorPanel {...guide} />

      <GameFeatureTabs
        tabs={[
          {
            id: 'field',
            label: '현장 보드',
            badge: `${Object.keys(state.taskOutcomes).length}/${activeTasks.length}`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>현재 현장</h2>
                    <span>{state.taskSet?.title || '기본 현장'}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="직급" value={profileSummary.career.rankTitle} />
                    <SmallStat label="과제" value={`${Object.keys(state.taskOutcomes).length}/${activeTasks.length}`} />
                    <SmallStat label="점수" value={score.toLocaleString('ko-KR')} />
                    <SmallStat label="판정" value={latestEvaluation?.grade || '대기'} />
                    <SmallStat label="예비비" value={`${support.cashReserve}pt`} />
                    <SmallStat label="기술부채" value={state.resources.techDebt} />
                  </div>
                  <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>
                    {task.projectName} / {task.summary}
                  </p>
                  <div className="games-chip-row">
                    {(task.tags || []).slice(0, 8).map((tag) => <span className="game-save-chip" key={`field-${tag}`}>{tag}</span>)}
                  </div>
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>프로젝트 진행</h2>
                    <span>{projectRows.length}개</span>
                  </div>
                  <div className="game-save-list">
                    {projectRows.slice(0, 5).map((project) => (
                      <article className="game-save-row" key={`tab-${project.projectName}`} style={project.active ? { borderColor: '#2673a6' } : null}>
                        <div>
                          <span>완료 {project.submittedTasks}/{project.totalTasks} · 평균 {project.averageScore}점</span>
                          <strong>{project.projectName}</strong>
                          <span>문서 {project.documentTasks} · 실행 {project.executionTasks} · 위험 {project.riskyTasks}</span>
                        </div>
                        <button type="button" className="tcg-primary-action" onClick={() => selectTask(project.firstTaskId)}>
                          {project.progressPct}%
                        </button>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>자원과 인사이트</h2>
                    <span>{profileSummary.career.reputationLabel}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="체력" value={state.resources.stamina} />
                    <SmallStat label="멘탈" value={state.resources.mentality} />
                    <SmallStat label="고객신뢰" value={state.resources.clientTrust} />
                    <SmallStat label="성장 제출" value={`${profileSummary.totalImprovedRuns}회`} />
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {insightRows.length ? insightRows.slice(0, 5).map((item) => (
                      <article className="game-save-row" key={`field-${item.id}`}>
                        <div>
                          <span>{item.label}</span>
                          <strong>{item.detail}</strong>
                        </div>
                      </article>
                    )) : <div className="games-empty">현재 과제 인사이트가 없습니다.</div>}
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'tasks',
            label: '과제/팩',
            badge: `${filteredRows.length}개`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>과제팩</h2>
                    <span>{state.activeTasks?.length ? '생성 현장' : state.taskSet?.packId || 'stepAQ_AR'}</span>
                  </div>
                  <label className="game-save-json-field">
                    <span>원본 챕터</span>
                    <select
                      value={state.activeTasks?.length ? '' : state.taskSet?.packId || 'stepAQ_AR'}
                      onChange={(event) => selectTaskPack(event.target.value)}
                    >
                      {state.activeTasks?.length ? <option value="">생성 현장</option> : null}
                      {packRows.map((pack) => (
                        <option value={pack.id} key={`tab-${pack.id}`}>
                          {pack.label} / {pack.taskCount}개 / {pack.version || 'v?'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="game-save-list">
                    {packRows.slice(0, 6).map((pack) => (
                      <article className="game-save-row" key={`pack-${pack.id}`} style={pack.selected ? { borderColor: '#2673a6' } : null}>
                        <div>
                          <span>{pack.version || 'version unknown'} · 보상 {pack.rewardScore}pt</span>
                          <strong>{pack.label}</strong>
                          <span>{pack.title}</span>
                        </div>
                        <button type="button" className="tcg-primary-action" onClick={() => selectTaskPack(pack.id)}>
                          {pack.taskCount}개
                        </button>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>빠른 과제 선택</h2>
                    <span>{filteredRows.length}/{rows.length}</span>
                  </div>
                  <div className="games-rank-split" style={{ marginBottom: 12 }}>
                    <label className="game-save-json-field" style={{ margin: 0 }}>
                      <span>검색</span>
                      <input
                        value={taskFilters.query}
                        onChange={(event) => updateTaskFilter('query', event.target.value)}
                        placeholder="과제, 프로젝트, 태그"
                      />
                    </label>
                    <label className="game-save-json-field" style={{ margin: 0 }}>
                      <span>특성</span>
                      <select value={taskFilters.capability} onChange={(event) => updateTaskFilter('capability', event.target.value)}>
                        <option value="all">전체</option>
                        <option value="execution">실행/정적 채점</option>
                        <option value="document">문서 체크</option>
                        <option value="hint">힌트 있음</option>
                      </select>
                    </label>
                  </div>
                  <div className="game-save-list">
                    {filteredRows.slice(0, 8).map((row) => (
                      <article className="game-save-row" key={`task-tab-${row.id}`}>
                        <div>
                          <span>{row.difficulty} / {row.modeLabel} · 문서 {row.documentCount} · 실행 {row.executionCount + row.hiddenExecutionCount} · 정적 {row.checkCount}</span>
                          <strong>{row.id}</strong>
                          <span>{row.projectName}</span>
                        </div>
                        <button type="button" className="tcg-primary-action" onClick={() => selectTask(row.id)}>
                          {row.score === null ? row.status : `${row.score}점`}
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'docs',
            label: '문서/힌트',
            badge: documentProgress ? `${documentProgress.checkedRequiredCount}/${documentProgress.requiredCount}` : `${revealedHints.length}`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>문서 체크</h2>
                    <span>{documentPlay?.title || '문서 없음'}</span>
                  </div>
                  {documentPlay ? (
                    <div className="game-save-list">
                      {(documentPlay.reviewItems || []).map((item) => (
                        <article className="game-save-row" key={`tab-doc-${item.id}`}>
                          <div>
                            <span>{item.detail} · 출처 {item.sourceDocId}</span>
                            <strong>{item.title}</strong>
                          </div>
                          <label className="game-save-chip" style={{ cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(documentProgress?.selectedIds?.includes(item.id))}
                              onChange={() => setState((current) => toggleDocumentReviewAction(current, task.id, item.id))}
                              style={{ marginRight: 6 }}
                            />
                            {item.required ? '필수' : '함정'}
                          </label>
                        </article>
                      ))}
                    </div>
                  ) : <div className="games-empty">문서 체크 과제가 아닙니다.</div>}
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>힌트</h2>
                    <span>{revealedHints.length}/{task.hints?.length || 0}</span>
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                    <ActionButton onClick={() => setState((current) => revealHintAction(current, task.id))} disabled={revealedHints.length >= (task.hints?.length || 0)}>
                      힌트 열기
                    </ActionButton>
                  </div>
                  <div className="game-save-list">
                    {revealedHints.length ? revealedHints.map((hint, index) => (
                      <article className="game-save-row" key={`tab-hint-${hint}-${index}`}>
                        <div>
                          <span>힌트 {index + 1}</span>
                          <strong>{hint}</strong>
                        </div>
                      </article>
                    )) : <div className="games-empty">아직 열람한 힌트가 없습니다.</div>}
                  </div>
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>원문 문서</h2>
                    <span>{task.documents?.length || 0}개</span>
                  </div>
                  <div className="game-save-list">
                    {(task.documents || []).slice(0, 4).map((doc) => (
                      <article className="game-save-row" key={`tab-source-${doc.id}`}>
                        <div>
                          <span>{doc.id}</span>
                          <strong>{doc.title}</strong>
                          <span style={{ whiteSpace: 'pre-wrap' }}>{doc.content}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'code',
            label: '코드/검수',
            badge: outcome ? `${outcome.score}점` : '미제출',
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>코드 파일</h2>
                    <span>{activeFile?.path || activeFileId}</span>
                  </div>
                  <label className="game-save-json-field">
                    <span>파일</span>
                    <select value={activeFileId} onChange={(event) => setSelectedFileId(event.target.value)}>
                      {files.map((file) => (
                        <option value={file.id} key={`tab-file-${file.id}`}>{file.path || file.id}</option>
                      ))}
                    </select>
                  </label>
                  <label className="game-save-json-field">
                    <span>패치 내용</span>
                    <textarea
                      value={activeContent}
                      onChange={(event) => setState((current) => updateFileAction(current, task.id, activeFileId, event.target.value))}
                      spellCheck={false}
                      style={{ minHeight: 280, fontFamily: 'var(--font-mono, Consolas, monospace)' }}
                    />
                  </label>
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>제출과 결과</h2>
                    <span>{outcome ? `${outcome.passCount}/${outcome.totalChecks}` : '미실행'}</span>
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                    <ActionButton onClick={() => setState((current) => submitTaskAction(current, task.id))}>현재 과제 검수</ActionButton>
                    <ActionButton onClick={() => setState((current) => resetTaskAction(current, task.id))}>현재 과제 초기화</ActionButton>
                    <ActionButton onClick={() => setState((current) => evaluateProjectAction(current))}>프로젝트 종료 판정</ActionButton>
                  </div>
                  <div className="game-save-list">
                    {outcome ? outcome.results.map((result, index) => (
                      <ResultRow result={result} key={`tab-result-${result.label}-${index}`} />
                    )) : <div className="games-empty">현재 과제를 검수하면 규칙별 통과 여부가 표시됩니다.</div>}
                  </div>
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>실행 규칙</h2>
                    <span>{execution?.mockType || task.judgeMode || 'static'}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="공개 테스트" value={execution?.tests?.length || 0} />
                    <SmallStat label="숨김 테스트" value={execution?.hiddenTests?.length || 0} />
                    <SmallStat label="정적 체크" value={task.judge?.checks?.length || 0} />
                    <SmallStat label="엔트리" value={execution?.entryFileId || '-'} />
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'career',
            label: '성장/지원',
            badge: profileSummary.career.rankTitle,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>플레이어 성장</h2>
                    <span>{profileSummary.career.reputationLabel}</span>
                  </div>
                  <div className="game-save-list">
                    {profileSummary.statRows.map((item) => (
                      <article className="game-save-row" key={`tab-stat-${item.key}`}>
                        <div>
                          <span>{item.summary}</span>
                          <strong>{item.label}</strong>
                        </div>
                        <strong>Lv.{item.level}</strong>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>회사 지원</h2>
                    <span>예비비 {support.cashReserve}pt</span>
                  </div>
                  <div className="game-save-list">
                    {(support.actions || []).map((item) => (
                      <article className="game-save-row" key={`tab-support-${item.key}`}>
                        <div>
                          <span>{item.detail}</span>
                          <strong>{item.title}</strong>
                        </div>
                        <button
                          type="button"
                          className="tcg-primary-action"
                          disabled={item.disabled}
                          onClick={() => setState((current) => applyCompanySupportAction(current, task.id, item.key))}
                        >
                          {item.cost}pt
                        </button>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>후속 현장</h2>
                    <span>{seedRoadmap.generatedSeeds.length}종</span>
                  </div>
                  {seedRoadmap.followUpPlan ? (
                    <div className="game-save-list">
                      {seedRoadmap.generatedSeeds.slice(0, 4).map((seed) => (
                        <article className="game-save-row" key={`tab-seed-${seed.id}`} style={seed.id === seedRoadmap.selectedSeed?.id ? { borderColor: '#2673a6' } : null}>
                          <div>
                            <span>{seed.recommendation} · 적합도 {seed.fitScore}점</span>
                            <strong>{seed.projectName}</strong>
                            <span>{seed.client} · {seed.module}</span>
                          </div>
                          <button type="button" className="tcg-primary-action" onClick={() => setState((current) => selectProjectSeedAction(current, seed.id))}>
                            {seed.id === seedRoadmap.selectedSeed?.id ? '선택됨' : `${seed.rewardScore}pt`}
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : <div className="games-empty">프로젝트 종료 판정 후 차기 현장 후보가 생성됩니다.</div>}
                </section>
              </section>
            ),
          },
          {
            id: 'audit',
            label: '검수/비교',
            badge: `${submissionComparison.deliveryScore}점`,
            children: (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>이식 완성 감사</h2>
                    <span>{portingCompletion.headline}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="완성도" value={`${portingCompletion.completionPct}%`} />
                    <SmallStat label="통과" value={`${portingCompletion.rows.filter((row) => row.ready).length}/${portingCompletion.rows.length}`} />
                    <SmallStat label="과제팩" value={`${packRows.length}팩`} />
                    <SmallStat label="기준선" value={`${submissionComparison.benchmarkRows.length}개`} />
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {portingCompletion.rows.map((row) => (
                      <article className="game-save-row" key={`porting-${row.id}`} style={row.ready ? { borderColor: '#2b8a5f' } : null}>
                        <div>
                          <span>{row.ready ? '완료' : '점검'} · {row.value}</span>
                          <strong>{row.label}</strong>
                          <span>{row.detail}</span>
                        </div>
                        <strong>{row.ready ? 'OK' : '확인'}</strong>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>과제팩 난이도 감사</h2>
                    <span>{packAudit.packLabel || '생성 현장'} · {packAudit.grade}등급</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="감사 점수" value={`${packAudit.averageAuditScore}점`} />
                    <SmallStat label="과제 수" value={`${packAudit.totalTasks}개`} />
                    <SmallStat label="문서 과제" value={`${packAudit.docTaskCount}/${packAudit.totalTasks}`} />
                    <SmallStat label="검수 과제" value={`${packAudit.executionTaskCount}/${packAudit.totalTasks}`} />
                    <SmallStat label="힌트 과제" value={`${packAudit.hintTaskCount}/${packAudit.totalTasks}`} />
                    <SmallStat label="Hard 비중" value={`${packAudit.hardRatio}%`} />
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {packAudit.issueRows.length ? packAudit.issueRows.slice(0, 6).map((row) => (
                      <article className="game-save-row" key={`audit-issue-${row.id}`}>
                        <div>
                          <span>{row.difficulty} · {row.modeLabel} · 점수 {row.auditScore}</span>
                          <strong>{row.id}</strong>
                          <span>{row.projectName}</span>
                          <span>{row.blockers.length ? row.blockers.join(' / ') : '검수 구성 양호'}</span>
                        </div>
                        <button type="button" className="tcg-primary-action" onClick={() => selectTask(row.id, 'code')}>
                          열기
                        </button>
                      </article>
                    )) : <div className="games-empty">보강이 필요한 과제는 없습니다.</div>}
                  </div>
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>제출 기준선 비교</h2>
                    <span>{submissionComparison.tier}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="납품 점수" value={`${submissionComparison.deliveryScore}점`} />
                    <SmallStat label="제출률" value={`${submissionComparison.completionPct}%`} />
                    <SmallStat label="평균 점수" value={`${submissionComparison.averageScore}점`} />
                    <SmallStat label="완전 통과" value={`${submissionComparison.fullPassCount}/${submissionComparison.totalTasks}`} />
                    <SmallStat label="열린 리스크" value={`${submissionComparison.riskOpenCount}건`} />
                    <SmallStat label="문서 패널티" value={`${submissionComparison.documentPenalty}건`} />
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {submissionComparison.benchmarkRows.map((row) => (
                      <article className="game-save-row" key={`benchmark-${row.id}`} style={row.status === '도달' ? { borderColor: '#2b8a5f' } : null}>
                        <div>
                          <span>목표 {row.target}점 · 현재 차이 {row.delta >= 0 ? '+' : ''}{row.delta}</span>
                          <strong>{row.label}</strong>
                          <span>{row.detail}</span>
                        </div>
                        <strong>{row.status}</strong>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>보강 체크리스트</h2>
                    <span>{submissionComparison.recommendations.length + packAudit.warnings.length}개</span>
                  </div>
                  <div className="game-save-list">
                    {packAudit.warnings.map((line, index) => (
                      <article className="game-save-row" key={`audit-warning-${line}-${index}`}>
                        <div>
                          <span>과제팩</span>
                          <strong>{line}</strong>
                        </div>
                      </article>
                    ))}
                    {submissionComparison.recommendations.map((line, index) => (
                      <article className="game-save-row" key={`compare-recommendation-${line}-${index}`}>
                        <div>
                          <span>제출</span>
                          <strong>{line}</strong>
                        </div>
                      </article>
                    ))}
                    {!packAudit.warnings.length && !submissionComparison.recommendations.length ? (
                      <div className="games-empty">현재 제출은 납품 안정권에 가깝습니다.</div>
                    ) : null}
                  </div>
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>세부 지표</h2>
                    <span>{submissionComparison.metricRows.filter((row) => row.ok).length}/{submissionComparison.metricRows.length}</span>
                  </div>
                  <div className="game-save-list">
                    {submissionComparison.metricRows.map((row) => (
                      <article className="game-save-row" key={`compare-metric-${row.id}`} style={row.ok ? { borderColor: '#2b8a5f' } : null}>
                        <div>
                          <span>목표 {row.target}</span>
                          <strong>{row.label}</strong>
                        </div>
                        <strong>{row.value}</strong>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
            ),
          },
          {
            id: 'advanced',
            label: '상세 현장',
            badge: `${rows.length}과제`,
            children: (
              <>
      <section className="games-detail-grid">
        <section className="games-panel" ref={documentPanelRef}>
          <div className="games-panel-title">
            <h2>문서 체크포인트</h2>
            <span>{task.documents?.length || 0}개 문서</span>
          </div>
          {documentPlay ? (
            <div className="game-save-list" style={{ marginBottom: 14 }}>
              <article className="game-save-row">
                <div>
                  <span>{documentPlay.summary}</span>
                  <strong>{documentPlay.title}</strong>
                </div>
                <strong>{documentProgress?.checkedRequiredCount || 0}/{documentProgress?.requiredCount || 0}</strong>
              </article>
              {(documentPlay.reviewItems || []).map((item) => (
                <article className="game-save-row" key={item.id}>
                  <div>
                    <span>{item.detail} · 출처 {item.sourceDocId}</span>
                    <strong>{item.title}</strong>
                  </div>
                  <label className="game-save-chip" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(documentProgress?.selectedIds?.includes(item.id))}
                      onChange={() => setState((current) => toggleDocumentReviewAction(current, task.id, item.id))}
                      style={{ marginRight: 6 }}
                    />
                    {item.required ? '필수' : '함정'}
                  </label>
                </article>
              ))}
              {documentProgress && !documentProgress.passed ? (
                <div className="games-empty">
                  문서 체크 미완료: 필수 누락 {documentProgress.missingRequiredCount}개 · 재확인 {documentProgress.wrongSelectedCount}개
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="game-save-list">
            {(task.documents || []).map((doc) => (
              <article className="game-save-row" key={doc.id}>
                <div>
                  <span>{doc.id}</span>
                  <strong>{doc.title}</strong>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{doc.content}</span>
                </div>
              </article>
            ))}
            {!(task.documents || []).length ? <div className="games-empty">연결된 문서가 없습니다.</div> : null}
          </div>
        </section>

        <section className="games-panel" ref={executionPanelRef}>
          <div className="games-panel-title">
            <h2>실행/채점 피드백</h2>
            <span>{execution?.mockType || task.judgeMode || 'static'}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="공개 테스트" value={execution?.tests?.length || 0} />
            <SmallStat label="숨김 테스트" value={execution?.hiddenTests?.length || 0} />
            <SmallStat label="정적 체크" value={task.judge?.checks?.length || 0} />
            <SmallStat label="엔트리" value={execution?.entryFileId || '-'} />
          </div>
          <div className="game-save-list" style={{ marginTop: 12 }}>
            {(execution?.tests || []).map((test, index) => (
              <article className="game-save-row" key={`${test.description}-${index}`}>
                <div>
                  <span>{test.assertions?.length || 0}개 assertion</span>
                  <strong>{test.description}</strong>
                </div>
                <strong>{test.invoke?.type || 'none'}</strong>
              </article>
            ))}
            {(task.judge?.checks || []).map((check) => (
              <article className="game-save-row" key={check.id || check.description}>
                <div>
                  <span>{check.failReason || '정적 규칙 검사'}</span>
                  <strong>{check.description || check.label}</strong>
                </div>
                <strong>{check.rules?.length || 0}</strong>
              </article>
            ))}
            {!execution?.tests?.length && !task.judge?.checks?.length ? <div className="games-empty">실행 또는 정적 채점 규칙이 없습니다.</div> : null}
          </div>
        </section>
      </section>

      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>현재 과제</h2>
            <span>{task.difficulty}</span>
          </div>
          <label className="game-save-json-field">
            <span>원본 챕터</span>
            <select
              value={state.activeTasks?.length ? '' : state.taskSet?.packId || 'stepAQ_AR'}
              onChange={(event) => selectTaskPack(event.target.value)}
            >
              {state.activeTasks?.length ? <option value="">생성 현장</option> : null}
              {packRows.map((pack) => (
                <option value={pack.id} key={pack.id}>
                  {pack.label} / {pack.taskCount}개 / {pack.version || 'v?'}
                </option>
              ))}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>과제 선택</span>
            <select value={task.id} onChange={(event) => selectTask(event.target.value)}>
              {activeTasks.map((item) => (
                <option value={item.id} key={item.id}>{item.id} / {item.modeLabel}</option>
              ))}
            </select>
          </label>
          <div className="games-rank-split">
            <SmallStat label="고객" value={task.client} />
            <SmallStat label="검수" value={outcome ? `${outcome.score}점` : '미제출'} />
            <SmallStat label="힌트" value={`${revealedHints.length}/${task.hints?.length || 0}`} />
            <SmallStat label="마감" value={task.deadline} />
            <SmallStat label="파일" value={`${files.length}개`} />
            <SmallStat label="문서/체크" value={`${currentTaskRow?.documentCount || 0}/${currentTaskRow?.checkpointCount || 0}`} />
            <SmallStat label="문서확인" value={documentProgress ? `${documentProgress.checkedRequiredCount}/${documentProgress.requiredCount}` : '-'} />
            <SmallStat label="실행/정적" value={`${(currentTaskRow?.executionCount || 0) + (currentTaskRow?.hiddenExecutionCount || 0)}/${currentTaskRow?.checkCount || 0}`} />
            <SmallStat label="상태" value={currentTaskRow?.status || '미제출'} />
          </div>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>{task.summary}</p>
          <div className="games-chip-row">
            {(task.tags || []).map((tag) => <span className="game-save-chip" key={tag}>{tag}</span>)}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>요구사항</h2>
            <span>{task.goals?.length || 0}개</span>
          </div>
          <div className="game-save-list">
            {(task.goals || []).map((goal, index) => (
              <article className="game-save-row" key={`${goal}-${index}`}>
                <div>
                  <span>목표 {index + 1}</span>
                  <strong>{goal}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>실행</h2>
            <span>{latestEvaluation?.grade || '진행 중'}</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={() => setState((current) => submitTaskAction(current, task.id))}>현재 과제 검수</ActionButton>
            <ActionButton onClick={() => setState((current) => revealHintAction(current, task.id))} disabled={revealedHints.length >= (task.hints?.length || 0)}>힌트 열기</ActionButton>
            <ActionButton onClick={() => setState((current) => resetTaskAction(current, task.id))}>현재 과제 초기화</ActionButton>
            <ActionButton onClick={() => setState((current) => evaluateProjectAction(current))}>프로젝트 종료 판정</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>회사 지원</h2>
            <span>예비비 {support.cashReserve}pt</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="누적 지원비" value={`${support.totalSpent}pt`} />
            <SmallStat label="힌트 보전" value={`${support.usage?.hintCredits || 0}회`} />
            <SmallStat label="QA 완충" value={`${support.usage?.riskReliefCredits || 0}회`} />
            <SmallStat label="열린 리스크" value={`${support.openRiskCount || 0}건`} />
          </div>
          <div className="game-save-list" style={{ marginTop: 12 }}>
            {(support.actions || []).map((item) => (
              <article className="game-save-row" key={item.key}>
                <div>
                  <span>{item.detail}</span>
                  <strong>{item.title}</strong>
                </div>
                <button
                  type="button"
                  className="tcg-primary-action"
                  disabled={item.disabled}
                  onClick={() => setState((current) => applyCompanySupportAction(current, task.id, item.key))}
                >
                  {item.cost}pt
                </button>
              </article>
            ))}
            {(support.entries || []).slice(0, 3).map((entry) => (
              <article className="game-save-row" key={entry.id}>
                <div>
                  <span>{entry.detail}</span>
                  <strong>{entry.title}</strong>
                </div>
                <strong>-{entry.amount}pt</strong>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>플레이어 성장</h2>
            <span>{profileSummary.career.rankTitle}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="평판" value={profileSummary.career.reputationLabel} />
            <SmallStat label="성장 제출" value={`${profileSummary.totalImprovedRuns}회`} />
            <SmallStat label="완전 통과" value={`${profileSummary.perfectRuns}회`} />
            <SmallStat label="시작 보정" value={`체력 ${profileSummary.career.nextStartBonus.stamina >= 0 ? '+' : ''}${profileSummary.career.nextStartBonus.stamina}`} />
          </div>
          {profileSummary.lastProgressLog.length ? (
            <div className="games-empty" style={{ textAlign: 'left', marginTop: 12 }}>
              최근 성장: {profileSummary.lastProgressLog.join(' · ')}
            </div>
          ) : null}
          <div className="game-save-list" style={{ marginTop: 12 }}>
            {profileSummary.statRows.map((item) => (
              <article className="game-save-row" key={item.key}>
                <div>
                  <span>{item.summary}</span>
                  <strong>{item.label}</strong>
                </div>
                <strong>Lv.{item.level}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>숙련도와 특성</h2>
            <span>{profileSummary.traitRows.filter((item) => item.unlocked).length}/{profileSummary.traitRows.length}</span>
          </div>
          <div className="games-chip-row">
            {profileSummary.domainRows.map((item) => (
              <span className="game-save-chip" key={item.key}>{item.label} Lv.{item.level}</span>
            ))}
          </div>
          <div className="game-save-list" style={{ marginTop: 12 }}>
            {profileSummary.traitRows.map((item) => (
              <article className="game-save-row" key={item.key} style={!item.unlocked ? { opacity: 0.5 } : null}>
                <div>
                  <span>{item.unlocked ? '해금됨' : '잠김'}</span>
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>프로젝트 진행도</h2>
            <span>{projectRows.length}개 프로젝트</span>
          </div>
          <div className="game-save-list">
            {projectRows.map((project) => (
              <article className="game-save-row" key={project.projectName} style={project.active ? { borderColor: '#2673a6' } : null}>
                <div>
                  <span>완료 {project.submittedTasks}/{project.totalTasks} · 문서 {project.documentTasks} · 실행 {project.executionTasks}</span>
                  <strong>{project.projectName}</strong>
                  <span>평균 {project.averageScore}점 · 완전 {project.perfectTasks} · 부분 {project.partialTasks} · 위험 {project.riskyTasks}</span>
                </div>
                <button type="button" className="tcg-primary-action" onClick={() => selectTask(project.firstTaskId, 'code')}>
                  {project.progressPct}%
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>현재 과제 인사이트</h2>
            <span>{task.cardSummary?.execution || 'static-check'}</span>
          </div>
          <div className="game-save-list">
            {insightRows.length ? insightRows.map((item) => (
              <article className="game-save-row" key={item.id}>
                <div>
                  <span>{item.label}</span>
                  <strong>{item.detail}</strong>
                </div>
              </article>
            )) : <div className="games-empty">이 과제에는 별도 인사이트가 없습니다.</div>}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>과제 목록</h2>
            <span>{filteredRows.length}/{rows.length}개</span>
          </div>
          <div className="games-rank-split" style={{ marginBottom: 12 }}>
            <label className="game-save-json-field" style={{ margin: 0 }}>
              <span>검색</span>
              <input
                value={taskFilters.query}
                onChange={(event) => updateTaskFilter('query', event.target.value)}
                placeholder="과제, 프로젝트, 태그"
              />
            </label>
            <label className="game-save-json-field" style={{ margin: 0 }}>
              <span>난이도</span>
              <select value={taskFilters.difficulty} onChange={(event) => updateTaskFilter('difficulty', event.target.value)}>
                <option value="all">전체</option>
                {Array.from(new Set(rows.map((row) => row.difficulty))).map((difficulty) => <option value={difficulty} key={difficulty}>{difficulty}</option>)}
              </select>
            </label>
            <label className="game-save-json-field" style={{ margin: 0 }}>
              <span>상태</span>
              <select value={taskFilters.status} onChange={(event) => updateTaskFilter('status', event.target.value)}>
                <option value="all">전체</option>
                {Array.from(new Set(rows.map((row) => row.status))).map((status) => <option value={status} key={status}>{status}</option>)}
              </select>
            </label>
            <label className="game-save-json-field" style={{ margin: 0 }}>
              <span>태그</span>
              <select value={taskFilters.tag} onChange={(event) => updateTaskFilter('tag', event.target.value)}>
                <option value="all">전체</option>
                {taskTagOptions.map((tag) => <option value={tag} key={tag}>{tag}</option>)}
              </select>
            </label>
            <label className="game-save-json-field" style={{ margin: 0 }}>
              <span>특성</span>
              <select value={taskFilters.capability} onChange={(event) => updateTaskFilter('capability', event.target.value)}>
                <option value="all">전체</option>
                <option value="execution">실행/정적 채점</option>
                <option value="document">문서 체크</option>
                <option value="hint">힌트 있음</option>
              </select>
            </label>
          </div>
          <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
            <strong>필터 결과 {filteredRows.length}개</strong>
            {' · '}
            실행형 {filteredRows.filter((row) => row.executionCount || row.hiddenExecutionCount || row.checkCount).length}개
            {' · '}
            문서 체크 {filteredRows.filter((row) => row.documentCount || row.checkpointCount).length}개
            {' · '}
            힌트 {filteredRows.filter((row) => row.hintCount).length}개
          </div>
          <div className="game-save-list">
            {filteredRows.map((row) => (
              <article className="game-save-row" key={row.id}>
                <div>
                  <span>{row.difficulty} / {row.modeLabel} · 문서 {row.documentCount} · 체크 {row.checkpointCount} · 실행 {row.executionCount + row.hiddenExecutionCount} · 정적 {row.checkCount}</span>
                  <strong>{row.id}</strong>
                  <span>{row.projectName}</span>
                  <div className="games-chip-row">
                    {(row.tags || []).slice(0, 5).map((tag) => <span className="game-save-chip" key={`${row.id}-${tag}`}>{tag}</span>)}
                  </div>
                  <div className="games-chip-row" style={{ marginTop: 8 }}>
                    <button type="button" className="tcg-primary-action" onClick={() => selectTask(row.id, 'code')}>코드</button>
                    <button type="button" className="tcg-primary-action" onClick={() => selectTask(row.id, 'hint')} disabled={!row.hintCount}>힌트</button>
                    <button type="button" className="tcg-primary-action" onClick={() => selectTask(row.id, 'document')} disabled={!row.documentCount && !row.checkpointCount}>문서</button>
                    <button type="button" className="tcg-primary-action" onClick={() => selectTask(row.id, 'execution')} disabled={!row.executionCount && !row.checkCount}>실행</button>
                  </div>
                </div>
                <button type="button" className="tcg-primary-action" onClick={() => selectTask(row.id, 'code')}>
                  {row.score === null ? row.status : `${row.score}점`}
                </button>
              </article>
            ))}
            {!filteredRows.length ? <div className="games-empty">현재 필터에 맞는 과제가 없습니다.</div> : null}
          </div>
        </section>

        <section className="games-panel" ref={hintPanelRef}>
          <div className="games-panel-title">
            <h2>힌트</h2>
            <span>{revealedHints.length}/{task.hints?.length || 0}</span>
          </div>
          <div className="game-save-list">
            {revealedHints.length ? revealedHints.map((hint, index) => (
              <article className="game-save-row" key={`${hint}-${index}`}>
                <div>
                  <span>힌트 {index + 1}</span>
                  <strong>{hint}</strong>
                </div>
              </article>
            )) : <div className="games-empty">아직 열람한 힌트가 없습니다.</div>}
          </div>
        </section>
      </section>

      <section className="games-detail-grid">
        <section className="games-panel" ref={codePanelRef}>
          <div className="games-panel-title">
            <h2>코드 파일</h2>
            <span>{activeFile?.path || activeFileId}</span>
          </div>
          <label className="game-save-json-field">
            <span>파일</span>
            <select value={activeFileId} onChange={(event) => setSelectedFileId(event.target.value)}>
              {files.map((file) => (
                <option value={file.id} key={file.id}>{file.path || file.id}</option>
              ))}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>패치 내용</span>
            <textarea
              value={activeContent}
              onChange={(event) => setState((current) => updateFileAction(current, task.id, activeFileId, event.target.value))}
              spellCheck={false}
              style={{ minHeight: 420, fontFamily: 'var(--font-mono, Consolas, monospace)' }}
            />
          </label>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>작업 보고</h2>
            <span>{reportText.trim().length}/{task.reportMinLength || 0}자</span>
          </div>
          <label className="game-save-json-field">
            <span>검수 보고</span>
            <textarea
              value={reportText}
              onChange={(event) => setState((current) => updateReportAction(current, task.id, event.target.value))}
              placeholder={task.reportPlaceholder || '수정한 내용과 확인 결과를 적으세요.'}
              style={{ minHeight: 180 }}
            />
          </label>

          <div className="games-panel-title" style={{ marginTop: 18 }}>
            <h2>검수 결과</h2>
            <span>{outcome ? `${outcome.passCount}/${outcome.totalChecks}` : '미실행'}</span>
          </div>
          <div className="game-save-list">
            {outcome ? outcome.results.map((result, index) => (
              <ResultRow result={result} key={`${result.label}-${index}`} />
            )) : <div className="games-empty">현재 과제를 검수하면 규칙별 통과 여부가 표시됩니다.</div>}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>프로젝트 판정</h2>
            <span>{latestEvaluation?.grade || '대기'}</span>
          </div>
          {latestEvaluation ? (
            <div className="games-rank-split">
              <SmallStat label="등급" value={latestEvaluation.grade} />
              <SmallStat label="제출" value={`${latestEvaluation.submittedTasks}/${latestEvaluation.totalTasks}`} />
              <SmallStat label="완전 통과" value={latestEvaluation.fullPassCount} />
              <SmallStat label="리스크" value={latestEvaluation.openRiskCount} />
              <SmallStat label="문서 누락" value={latestEvaluation.documentMetrics?.missingRequiredCount || 0} />
              <SmallStat label="문서 재확인" value={latestEvaluation.documentMetrics?.wrongSelectedCount || 0} />
            </div>
          ) : <div className="games-empty">프로젝트 종료 판정을 실행하면 전체 제출 상태와 리스크 기준으로 등급이 계산됩니다.</div>}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>후속 현장 후보</h2>
            <span>{seedRoadmap.generatedSeeds.length}종</span>
          </div>
          {seedRoadmap.followUpPlan ? (
            <>
              <div className="game-save-list" style={{ marginBottom: 12 }}>
                <article className="game-save-row">
                  <div>
                    <span>{seedRoadmap.followUpPlan.badge} · {seedRoadmap.followUpPlan.contract} · {seedRoadmap.followUpPlan.duration}</span>
                    <strong>{seedRoadmap.followUpPlan.title}</strong>
                    <span>{seedRoadmap.followUpPlan.summary}</span>
                    <span>다음 포커스: {seedRoadmap.followUpPlan.nextFocus}</span>
                    <span>이월 정산: {seedRoadmap.followUpPlan.carryOverSummary}</span>
                  </div>
                  <strong>{seedRoadmap.followUpPlan.code}</strong>
                </article>
              </div>
              <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                <ActionButton onClick={startSelectedSeed} disabled={!seedRoadmap.selectedSeed}>
                  선택한 후보로 차기 현장 시작
                </ActionButton>
              </div>
              <div className="game-save-list">
                {seedRoadmap.generatedSeeds.map((seed) => (
                  <article className="game-save-row" key={seed.id} style={seed.id === seedRoadmap.selectedSeed?.id ? { borderColor: '#2673a6' } : null}>
                    <div>
                      <span>{seed.recommendation} · 적합도 {seed.fitBand} {seed.fitScore}점 · 압박 {seed.pressure}</span>
                      <strong>{seed.projectName}</strong>
                      <span>{seed.client} · {seed.module} · {seed.seedGroupLabel}</span>
                      <span>{seed.title} · {seed.summary}</span>
                      <span>{seed.contractSummary}</span>
                      <span>{seed.startingSummary}</span>
                      <span>{seed.kickoffFocus}</span>
                      <div className="games-chip-row">
                        {(seed.tags || []).map((tag) => <span className="game-save-chip" key={`${seed.id}-${tag}`}>{tag}</span>)}
                      </div>
                    </div>
                    <button type="button" className="tcg-primary-action" onClick={() => setState((current) => selectProjectSeedAction(current, seed.id))}>
                      {seed.id === seedRoadmap.selectedSeed?.id ? '선택됨' : `${seed.rewardScore}pt`}
                    </button>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="games-empty">프로젝트 종료 판정을 실행하면 등급과 자원 상태를 바탕으로 차기 현장 후보가 생성됩니다.</div>
          )}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>최근 로그</h2>
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
      </section>
              </>
            ),
          },
        ]}
      />
    </GamePlayShell>
  );
}
