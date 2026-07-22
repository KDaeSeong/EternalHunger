import { ActionButton, GameControlButton, SmallStat } from '../../_components/GamePlayPrimitives';
import { ResultRow } from './SiCodingSubmissionReadinessPanel';
import { applyCompanySupportAction, evaluateProjectAction, selectProjectSeedAction, toggleDocumentReviewAction, updateFileAction, updateReportAction } from '../_lib/siCodingSimEngine';
import { SiCodingIconRow, SiCodingPanelTitle } from './SiCodingVisuals';

function evaluationAction(evaluation) {
  if (!evaluation) return 'project';
  if (evaluation.grade === 'FAIL') return 'coding-blocked';
  if (evaluation.grade === '보류') return 'project-held';
  if (evaluation.grade === 'A') return 'trophy';
  return 'coding-audit';
}

function evaluationClassName(evaluation) {
  if (!evaluation) return '';
  if (evaluation.grade === 'FAIL') return 'is-danger';
  if (evaluation.grade === '보류') return 'is-warning';
  return 'is-good';
}

export default function SiCodingAdvancedTab({
  activeContent,
  activeFile,
  activeFileId,
  activeTasks,
  canRevealHint,
  codePanelRef,
  currentTaskRow,
  documentPanelRef,
  documentPlay,
  documentProgress,
  execution,
  executionPanelRef,
  files,
  filteredRows,
  hintPanelRef,
  insightRows,
  latestEvaluation,
  outcome,
  packRows,
  profileSummary,
  projectRows,
  reportText,
  resetCurrentTask,
  revealCurrentHint,
  revealedHints,
  rows,
  seedRoadmap,
  selectTask,
  selectTaskPack,
  setSelectedFileId,
  setState,
  startSelectedSeed,
  state,
  submitCurrentTask,
  support,
  task,
  taskFilters,
  taskTagOptions,
  updateTaskFilter,
}) {
  return (
    <>
              <section className="games-detail-grid">
                <section className="games-panel" ref={documentPanelRef}>
                  <SiCodingPanelTitle action="document-review" title="문서 체크포인트" meta={`${task.documents?.length || 0}개 문서`} />
                  {documentPlay ? (
                    <div className="game-save-list" style={{ marginBottom: 14 }}>
                      <SiCodingIconRow
                        action={documentProgress?.passed ? 'coding-test-pass' : 'document-review'}
                        className={documentProgress?.passed ? 'is-good' : 'is-warning'}
                        label={documentPlay.title}
                      >
                        <div>
                          <span>{documentPlay.summary}</span>
                          <strong>{documentPlay.title}</strong>
                        </div>
                        <strong>{documentProgress?.checkedRequiredCount || 0}/{documentProgress?.requiredCount || 0}</strong>
                      </SiCodingIconRow>
                      {(documentPlay.reviewItems || []).map((item) => (
                        <SiCodingIconRow
                          action={documentProgress?.selectedIds?.includes(item.id)
                            ? item.required ? 'document-review' : 'coding-blocked'
                            : item.required ? 'coding-ready' : 'warning'}
                          className={documentProgress?.selectedIds?.includes(item.id)
                            ? item.required ? 'is-good' : 'is-danger'
                            : item.required ? 'is-warning' : ''}
                          label={item.title}
                          key={item.id}
                        >
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
                        </SiCodingIconRow>
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
                      <SiCodingIconRow action="archive" label={doc.title} key={doc.id}>
                        <div>
                          <span>{doc.id}</span>
                          <strong>{doc.title}</strong>
                          <span style={{ whiteSpace: 'pre-wrap' }}>{doc.content}</span>
                        </div>
                      </SiCodingIconRow>
                    ))}
                    {!(task.documents || []).length ? <div className="games-empty">연결된 문서가 없습니다.</div> : null}
                  </div>
                </section>
        
                <section className="games-panel" ref={executionPanelRef}>
                  <SiCodingPanelTitle action="coding-audit" title="실행/채점 피드백" meta={execution?.mockType || task.judgeMode || 'static'} />
                  <div className="games-rank-split">
                    <SmallStat icon="coding-test-pass" label="공개 테스트" value={execution?.tests?.length || 0} />
                    <SmallStat icon="lock" label="숨김 테스트" value={execution?.hiddenTests?.length || 0} />
                    <SmallStat icon="coding-audit" label="정적 체크" value={task.judge?.checks?.length || 0} />
                    <SmallStat icon="coding-file" label="엔트리" value={execution?.entryFileId || '-'} />
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {(execution?.tests || []).map((test, index) => (
                      <SiCodingIconRow action="execute" label={test.description} key={`${test.description}-${index}`}>
                        <div>
                          <span>{test.assertions?.length || 0}개 assertion</span>
                          <strong>{test.description}</strong>
                        </div>
                        <strong>{test.invoke?.type || 'none'}</strong>
                      </SiCodingIconRow>
                    ))}
                    {(task.judge?.checks || []).map((check) => (
                      <SiCodingIconRow action="coding-audit" label={check.description || check.label} key={check.id || check.description}>
                        <div>
                          <span>{check.failReason || '정적 규칙 검사'}</span>
                          <strong>{check.description || check.label}</strong>
                        </div>
                        <strong>{check.rules?.length || 0}</strong>
                      </SiCodingIconRow>
                    ))}
                    {!execution?.tests?.length && !task.judge?.checks?.length ? <div className="games-empty">실행 또는 정적 채점 규칙이 없습니다.</div> : null}
                  </div>
                </section>
              </section>
        
              <section className="games-detail-grid">
                <section className="games-panel">
                  <SiCodingPanelTitle action="task-select" title="현재 과제" meta={task.difficulty} />
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
                    <SmallStat icon="sponsor" label="고객" value={task.client} />
                    <SmallStat icon="coding-audit" label="검수" value={outcome ? `${outcome.score}점` : '미제출'} />
                    <SmallStat icon="hint" label="힌트" value={`${revealedHints.length}/${task.hints?.length || 0}`} />
                    <SmallStat icon="clock" label="마감" value={task.deadline} />
                    <SmallStat icon="coding-file" label="파일" value={`${files.length}개`} />
                    <SmallStat icon="archive" label="문서/체크" value={`${currentTaskRow?.documentCount || 0}/${currentTaskRow?.checkpointCount || 0}`} />
                    <SmallStat icon="document-review" label="문서확인" value={documentProgress ? `${documentProgress.checkedRequiredCount}/${documentProgress.requiredCount}` : '-'} />
                    <SmallStat icon="execute" label="실행/정적" value={`${(currentTaskRow?.executionCount || 0) + (currentTaskRow?.hiddenExecutionCount || 0)}/${currentTaskRow?.checkCount || 0}`} />
                    <SmallStat icon="status" label="상태" value={currentTaskRow?.status || '미제출'} />
                  </div>
                  <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>{task.summary}</p>
                  <div className="games-chip-row">
                    {(task.tags || []).map((tag) => <span className="game-save-chip" key={tag}>{tag}</span>)}
                  </div>
                </section>
        
                <section className="games-panel">
                  <SiCodingPanelTitle action="target" title="요구사항" meta={`${task.goals?.length || 0}개`} />
                  <div className="game-save-list">
                    {(task.goals || []).map((goal, index) => (
                      <SiCodingIconRow action="target" label={goal} key={`${goal}-${index}`}>
                        <div>
                          <span>목표 {index + 1}</span>
                          <strong>{goal}</strong>
                        </div>
                      </SiCodingIconRow>
                    ))}
                  </div>
                </section>
        
                <section className="games-panel">
                  <SiCodingPanelTitle action="coding-submit" title="실행" meta={latestEvaluation?.grade || '진행 중'} />
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionButton action="coding-submit" cue="codeSubmit" onClick={submitCurrentTask}>현재 과제 검수</ActionButton>
                    <ActionButton action="hint" onClick={revealCurrentHint} disabled={!canRevealHint}>힌트 열기</ActionButton>
                    <ActionButton action="reset" onClick={resetCurrentTask}>현재 과제 초기화</ActionButton>
                    <ActionButton action="judge" onClick={() => setState((current) => evaluateProjectAction(current))}>프로젝트 종료 판정</ActionButton>
                  </div>
                </section>
        
                <section className="games-panel">
                  <SiCodingPanelTitle action="sponsor" title="회사 지원" meta={`예비비 ${support.cashReserve}pt`} />
                  <div className="games-rank-split">
                    <SmallStat icon="sponsor" label="누적 지원비" value={`${support.totalSpent}pt`} />
                    <SmallStat icon="support-hint" label="힌트 보전" value={`${support.usage?.hintCredits || 0}회`} />
                    <SmallStat icon="support-risk" label="QA 완충" value={`${support.usage?.riskReliefCredits || 0}회`} />
                    <SmallStat icon="coding-blocked" label="열린 리스크" value={`${support.openRiskCount || 0}건`} />
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {(support.actions || []).map((item) => (
                      <SiCodingIconRow
                        action={item.key === 'hint' ? 'support-hint' : 'support-risk'}
                        className={item.disabled ? 'is-locked' : ''}
                        label={item.title}
                        key={item.key}
                      >
                        <div>
                          <span>{item.detail}</span>
                          <strong>{item.title}</strong>
                        </div>
                        <GameControlButton
                          action="sponsor"
                          className="tcg-primary-action"
                          disabled={item.disabled}
                          onClick={() => setState((current) => applyCompanySupportAction(current, task.id, item.key))}
                        >
                          {item.key === 'hint' ? '지식 지원' : 'QA 지원'} · {item.cost}pt
                        </GameControlButton>
                      </SiCodingIconRow>
                    ))}
                    {(support.entries || []).slice(0, 3).map((entry) => (
                      <SiCodingIconRow action="sponsor" label={entry.title} key={entry.id}>
                        <div>
                          <span>{entry.detail}</span>
                          <strong>{entry.title}</strong>
                        </div>
                        <strong>-{entry.amount}pt</strong>
                      </SiCodingIconRow>
                    ))}
                  </div>
                </section>
              </section>
        
              <section className="games-dashboard">
                <section className="games-panel">
                  <SiCodingPanelTitle action="growth" title="플레이어 성장" meta={profileSummary.career.rankTitle} />
                  <div className="games-rank-split">
                    <SmallStat icon="title" label="평판" value={profileSummary.career.reputationLabel} />
                    <SmallStat icon="growth" label="성장 제출" value={`${profileSummary.totalImprovedRuns}회`} />
                    <SmallStat icon="trophy" label="완전 통과" value={`${profileSummary.perfectRuns}회`} />
                    <SmallStat icon="status" label="시작 보정" value={`체력 ${profileSummary.career.nextStartBonus.stamina >= 0 ? '+' : ''}${profileSummary.career.nextStartBonus.stamina}`} />
                  </div>
                  {profileSummary.lastProgressLog.length ? (
                    <div className="games-empty" style={{ textAlign: 'left', marginTop: 12 }}>
                      최근 성장: {profileSummary.lastProgressLog.join(' · ')}
                    </div>
                  ) : null}
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {profileSummary.statRows.map((item) => (
                      <SiCodingIconRow action="growth" className="is-good" label={item.label} key={item.key}>
                        <div>
                          <span>{item.summary}</span>
                          <strong>{item.label}</strong>
                        </div>
                        <strong>Lv.{item.level}</strong>
                      </SiCodingIconRow>
                    ))}
                  </div>
                </section>
        
                <section className="games-panel">
                  <SiCodingPanelTitle
                    action="upgrade"
                    title="숙련도와 특성"
                    meta={`${profileSummary.traitRows.filter((item) => item.unlocked).length}/${profileSummary.traitRows.length}`}
                  />
                  <div className="games-chip-row">
                    {profileSummary.domainRows.map((item) => (
                      <span className="game-save-chip" key={item.key}>{item.label} Lv.{item.level}</span>
                    ))}
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {profileSummary.traitRows.map((item) => (
                      <SiCodingIconRow
                        action={item.unlocked ? 'complete' : 'lock'}
                        className={item.unlocked ? 'is-good' : 'is-locked'}
                        label={item.label}
                        key={item.key}
                        style={!item.unlocked ? { opacity: 0.5 } : null}
                      >
                        <div>
                          <span>{item.unlocked ? '해금됨' : '잠김'}</span>
                          <strong>{item.label}</strong>
                          <span>{item.description}</span>
                        </div>
                      </SiCodingIconRow>
                    ))}
                  </div>
                </section>
              </section>
        
              <section className="games-dashboard">
                <section className="games-panel">
                  <SiCodingPanelTitle action="project" title="프로젝트 진행도" meta={`${projectRows.length}개 프로젝트`} />
                  <div className="game-save-list">
                    {projectRows.map((project) => (
                      <SiCodingIconRow
                        action={project.active ? 'project-select' : 'project'}
                        className={project.active ? 'is-good' : ''}
                        label={project.projectName}
                        key={project.projectName}
                        style={project.active ? { borderColor: '#2673a6' } : null}
                      >
                        <div>
                          <span>완료 {project.submittedTasks}/{project.totalTasks} · 문서 {project.documentTasks} · 실행 {project.executionTasks}</span>
                          <strong>{project.projectName}</strong>
                          <span>평균 {project.averageScore}점 · 완전 {project.perfectTasks} · 부분 {project.partialTasks} · 위험 {project.riskyTasks}</span>
                        </div>
                        <GameControlButton action="project" className="tcg-primary-action" onClick={() => selectTask(project.firstTaskId, 'code')}>
                          열기 · {project.progressPct}%
                        </GameControlButton>
                      </SiCodingIconRow>
                    ))}
                  </div>
                </section>
        
                <section className="games-panel">
                  <SiCodingPanelTitle action="analysis" title="현재 과제 인사이트" meta={task.cardSummary?.execution || 'static-check'} />
                  <div className="game-save-list">
                    {insightRows.length ? insightRows.map((item) => (
                      <SiCodingIconRow action="analysis" label={item.label} key={item.id}>
                        <div>
                          <span>{item.label}</span>
                          <strong>{item.detail}</strong>
                        </div>
                      </SiCodingIconRow>
                    )) : <div className="games-empty">이 과제에는 별도 인사이트가 없습니다.</div>}
                  </div>
                </section>
              </section>
        
              <section className="games-dashboard">
                <section className="games-panel">
                  <SiCodingPanelTitle action="task-select" title="과제 목록" meta={`${filteredRows.length}/${rows.length}개`} />
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
                      <SiCodingIconRow
                        action={row.score === null ? 'task-select' : row.score >= 75 ? 'coding-test-pass' : 'coding-test-fail'}
                        className={row.score === null ? '' : row.score >= 75 ? 'is-good' : 'is-danger'}
                        label={row.id}
                        key={row.id}
                      >
                        <div>
                          <span>{row.difficulty} / {row.modeLabel} · 문서 {row.documentCount} · 체크 {row.checkpointCount} · 실행 {row.executionCount + row.hiddenExecutionCount} · 정적 {row.checkCount}</span>
                          <strong>{row.id}</strong>
                          <span>{row.projectName}</span>
                          <div className="games-chip-row">
                            {(row.tags || []).slice(0, 5).map((tag) => <span className="game-save-chip" key={`${row.id}-${tag}`}>{tag}</span>)}
                          </div>
                          <div className="games-chip-row" style={{ marginTop: 8 }}>
                            <GameControlButton action="code" className="tcg-primary-action" onClick={() => selectTask(row.id, 'code')}>코드</GameControlButton>
                            <GameControlButton action="guide" className="tcg-primary-action" onClick={() => selectTask(row.id, 'hint')} disabled={!row.hintCount}>힌트</GameControlButton>
                            <GameControlButton action="archive" className="tcg-primary-action" onClick={() => selectTask(row.id, 'document')} disabled={!row.documentCount && !row.checkpointCount}>문서</GameControlButton>
                            <GameControlButton action="execute" className="tcg-primary-action" onClick={() => selectTask(row.id, 'execution')} disabled={!row.executionCount && !row.checkCount}>실행</GameControlButton>
                          </div>
                        </div>
                        <GameControlButton action="target" className="tcg-primary-action" onClick={() => selectTask(row.id, 'code')}>
                          열기 · {row.score === null ? row.status : `${row.score}점`}
                        </GameControlButton>
                      </SiCodingIconRow>
                    ))}
                    {!filteredRows.length ? <div className="games-empty">현재 필터에 맞는 과제가 없습니다.</div> : null}
                  </div>
                </section>
        
                <section className="games-panel" ref={hintPanelRef}>
                  <SiCodingPanelTitle action="hint" title="힌트" meta={`${revealedHints.length}/${task.hints?.length || 0}`} />
                  <div className="game-save-list">
                    {revealedHints.length ? revealedHints.map((hint, index) => (
                      <SiCodingIconRow action="hint" className="is-warning" label={`힌트 ${index + 1}`} key={`${hint}-${index}`}>
                        <div>
                          <span>힌트 {index + 1}</span>
                          <strong>{hint}</strong>
                        </div>
                      </SiCodingIconRow>
                    )) : <div className="games-empty">아직 열람한 힌트가 없습니다.</div>}
                  </div>
                </section>
              </section>
        
              <section className="games-detail-grid">
                <section className="games-panel" ref={codePanelRef}>
                  <SiCodingPanelTitle action="coding-file" title="코드 파일" meta={activeFile?.path || activeFileId} />
                  <label className="game-save-json-field">
                    <span>파일</span>
                    <select value={activeFileId} onChange={(event) => setSelectedFileId(event.target.value)} data-game-sfx-change="codeFileSelect">
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
                  <SiCodingPanelTitle action="archive" title="작업 보고" meta={`${reportText.trim().length}/${task.reportMinLength || 0}자`} />
                  <label className="game-save-json-field">
                    <span>검수 보고</span>
                    <textarea
                      value={reportText}
                      onChange={(event) => setState((current) => updateReportAction(current, task.id, event.target.value))}
                      placeholder={task.reportPlaceholder || '수정한 내용과 확인 결과를 적으세요.'}
                      style={{ minHeight: 180 }}
                    />
                  </label>
        
                  <SiCodingPanelTitle
                    action={outcome ? outcome.score >= 75 ? 'coding-test-pass' : 'coding-test-fail' : 'coding-audit'}
                    title="검수 결과"
                    meta={outcome ? `${outcome.passCount}/${outcome.totalChecks}` : '미실행'}
                    style={{ marginTop: 18 }}
                  />
                  <div className="game-save-list">
                    {outcome ? outcome.results.map((result, index) => (
                      <ResultRow result={result} key={`${result.label}-${index}`} />
                    )) : <div className="games-empty">현재 과제를 검수하면 규칙별 통과 여부가 표시됩니다.</div>}
                  </div>
                </section>
              </section>
        
              <section className="games-dashboard">
                <section className="games-panel">
                  <SiCodingPanelTitle action={evaluationAction(latestEvaluation)} title="프로젝트 판정" meta={latestEvaluation?.grade || '대기'} />
                  {latestEvaluation ? (
                    <div className="games-rank-split">
                      <SmallStat icon={evaluationAction(latestEvaluation)} label="등급" value={latestEvaluation.grade} />
                      <SmallStat icon="coding-submit" label="제출" value={`${latestEvaluation.submittedTasks}/${latestEvaluation.totalTasks}`} />
                      <SmallStat icon="trophy" label="완전 통과" value={latestEvaluation.fullPassCount} />
                      <SmallStat icon="coding-blocked" label="리스크" value={latestEvaluation.openRiskCount} />
                      <SmallStat icon="document-unreview" label="문서 누락" value={latestEvaluation.documentMetrics?.missingRequiredCount || 0} />
                      <SmallStat icon="document-review" label="문서 재확인" value={latestEvaluation.documentMetrics?.wrongSelectedCount || 0} />
                    </div>
                  ) : <div className="games-empty">프로젝트 종료 판정을 실행하면 전체 제출 상태와 리스크 기준으로 등급이 계산됩니다.</div>}
                </section>
        
                <section className="games-panel">
                  <SiCodingPanelTitle action="project-select" title="후속 현장 후보" meta={`${seedRoadmap.generatedSeeds.length}종`} />
                  {seedRoadmap.followUpPlan ? (
                    <>
                      <div className="game-save-list" style={{ marginBottom: 12 }}>
                        <SiCodingIconRow action={evaluationAction(latestEvaluation)} className={evaluationClassName(latestEvaluation)} label={seedRoadmap.followUpPlan.title}>
                          <div>
                            <span>{seedRoadmap.followUpPlan.badge} · {seedRoadmap.followUpPlan.contract} · {seedRoadmap.followUpPlan.duration}</span>
                            <strong>{seedRoadmap.followUpPlan.title}</strong>
                            <span>{seedRoadmap.followUpPlan.summary}</span>
                            <span>다음 포커스: {seedRoadmap.followUpPlan.nextFocus}</span>
                            <span>이월 정산: {seedRoadmap.followUpPlan.carryOverSummary}</span>
                          </div>
                          <strong>{seedRoadmap.followUpPlan.code}</strong>
                        </SiCodingIconRow>
                      </div>
                      <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                        <ActionButton action="deploy" onClick={startSelectedSeed} disabled={!seedRoadmap.selectedSeed}>
                          선택한 후보로 차기 현장 시작
                        </ActionButton>
                      </div>
                      <div className="game-save-list">
                        {seedRoadmap.generatedSeeds.map((seed) => (
                          <SiCodingIconRow
                            action={seed.id === seedRoadmap.selectedSeed?.id ? 'project-select' : 'project'}
                            className={seed.id === seedRoadmap.selectedSeed?.id ? 'is-good' : ''}
                            label={seed.projectName}
                            key={seed.id}
                            style={seed.id === seedRoadmap.selectedSeed?.id ? { borderColor: '#2673a6' } : null}
                          >
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
                            <GameControlButton action="target" className="tcg-primary-action" onClick={() => setState((current) => selectProjectSeedAction(current, seed.id))}>
                              {seed.id === seedRoadmap.selectedSeed?.id ? '선택됨' : `선택 · ${seed.rewardScore}pt`}
                            </GameControlButton>
                          </SiCodingIconRow>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="games-empty">프로젝트 종료 판정을 실행하면 등급과 자원 상태를 바탕으로 차기 현장 후보가 생성됩니다.</div>
                  )}
                </section>
        
                <section className="games-panel">
                  <SiCodingPanelTitle action="logs" title="최근 로그" meta={state.runId} />
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
  );
}
