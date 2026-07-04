'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell from '../../_components/GamePlayShell';
import {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  TASKS,
  createNewState,
  evaluateProjectAction,
  getCurrentTask,
  getFileContent,
  getDocumentReviewProgress,
  getPlayTimeSec,
  getReportText,
  getRevealedHints,
  normalizeState,
  projectProgressRows,
  resetTaskAction,
  revealHintAction,
  scoreState,
  selectTaskAction,
  submitTaskAction,
  summaryForState,
  taskRows,
  toggleDocumentReviewAction,
  updateFileAction,
  updateReportAction,
} from '../_lib/siCodingSimEngine';

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
  const insightRows = Object.entries(task?.passiveInsights || {});
  const currentTaskRow = rows.find((row) => row.id === task?.id) || null;

  const updateTaskFilter = (key, value) => {
    setTaskFilters((current) => ({ ...current, [key]: value }));
  };

  const startNewRun = () => {
    const nextState = createNewState();
    setState(nextState);
    setSelectedFileId(TASKS[0]?.files?.[0]?.id || '');
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
        saveName: `SI Coding ${summaryForState(state).submittedTasks}/${TASKS.length}`,
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
    const nextTask = TASKS.find((item) => item.id === taskId) || TASKS[0];
    setSelectedFileId(nextTask?.files?.[0]?.id || '');
    setState((current) => selectTaskAction(current, taskId));
    scrollToPanel(panel);
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
    { label: '과제', value: `${Object.keys(state.taskOutcomes).length}/${TASKS.length}` },
    { label: '체력', value: state.resources.stamina },
    { label: '멘탈', value: state.resources.mentality },
    { label: '고객신뢰', value: state.resources.clientTrust },
    { label: '기술부채', value: state.resources.techDebt },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 플레이는 가능하지만 저장, 불러오기, 전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    state.resources.stamina <= 15 || state.resources.mentality <= 15
      ? { key: 'low-resource', tone: 'error', text: '체력 또는 멘탈이 위험 수치입니다. 힌트 사용과 재검수 비용을 조심해야 합니다.' }
      : null,
  ];

  if (!task) {
    return (
      <GamePlayShell
        kicker="SI Coding Sim"
        title="SI 코딩 시뮬레이터"
        description="불러올 과제 데이터가 없습니다."
        actions={actions}
        metrics={metrics}
        messages={messages}
      />
    );
  }

  return (
    <GamePlayShell
      kicker="SI Coding Sim"
      title="SI 코딩 시뮬레이터"
      description="업로드된 Step AQ/AR 과제팩의 문서, 코드 파일, 문자열 기반 검수 규칙, 힌트 비용, 프로젝트 종료 판정을 사이트용 challenge slice로 이식했습니다."
      summaryLabel="SI Coding Sim 요약"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
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
            <span>과제 선택</span>
            <select value={task.id} onChange={(event) => selectTask(event.target.value)}>
              {TASKS.map((item) => (
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
            {insightRows.length ? insightRows.map(([key, value]) => (
              <article className="game-save-row" key={key}>
                <div>
                  <span>{key}</span>
                  <strong>{value}</strong>
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
    </GamePlayShell>
  );
}
