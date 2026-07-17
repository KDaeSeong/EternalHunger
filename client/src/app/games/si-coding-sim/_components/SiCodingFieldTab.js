import { GameControlButton, SmallStat } from '../../_components/GamePlayPrimitives';
import SubmissionReadinessPanel from './SiCodingSubmissionReadinessPanel';
import { SiCodingIconRow, SiCodingPanelTitle } from './SiCodingVisuals';

export default function SiCodingFieldTab({
  activeTasks,
  canRevealHint,
  insightRows,
  latestEvaluation,
  profileSummary,
  projectRows,
  resetCurrentTask,
  revealCurrentHint,
  score,
  scrollToPanel,
  selectTask,
  state,
  submissionReadiness,
  submitCurrentTask,
  support,
  task,
}) {
  return (
    <section className="games-detail-grid">
                        <section className="games-panel">
                          <SiCodingPanelTitle action="code" title="현재 현장" meta={state.taskSet?.title || '기본 현장'} />
                          <div className="games-rank-split">
                            <SmallStat icon="growth" label="직급" value={profileSummary.career.rankTitle} />
                            <SmallStat icon="task-select" label="과제" value={`${Object.keys(state.taskOutcomes).length}/${activeTasks.length}`} />
                            <SmallStat icon="trophy" label="점수" value={score.toLocaleString('ko-KR')} />
                            <SmallStat icon="judge" label="판정" value={latestEvaluation?.grade || '대기'} />
                            <SmallStat icon="sponsor" label="예비비" value={`${support.cashReserve}pt`} />
                            <SmallStat icon="warning" label="기술부채" value={state.resources.techDebt} />
                          </div>
                          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>
                            {task.projectName} / {task.summary}
                          </p>
                          <div className="games-chip-row">
                            {(task.tags || []).slice(0, 8).map((tag) => <span className="game-save-chip" key={`field-${tag}`}>{tag}</span>)}
                          </div>
                        </section>
        
                        <SubmissionReadinessPanel
                          readiness={submissionReadiness}
                          canRevealHint={canRevealHint}
                          onSubmit={submitCurrentTask}
                          onRevealHint={revealCurrentHint}
                          onReset={resetCurrentTask}
                          onJump={scrollToPanel}
                        />
        
                        <section className="games-panel">
                          <SiCodingPanelTitle action="project" title="프로젝트 진행" meta={`${projectRows.length}개`} />
                          <div className="game-save-list">
                            {projectRows.slice(0, 5).map((project) => (
                              <SiCodingIconRow action={project.active ? 'project-select' : 'project'} key={`tab-${project.projectName}`} style={project.active ? { borderColor: '#2673a6' } : null}>
                                <div>
                                  <span>완료 {project.submittedTasks}/{project.totalTasks} · 평균 {project.averageScore}점</span>
                                  <strong>{project.projectName}</strong>
                                  <span>문서 {project.documentTasks} · 실행 {project.executionTasks} · 위험 {project.riskyTasks}</span>
                                </div>
                                <GameControlButton action="project" className="tcg-primary-action" onClick={() => selectTask(project.firstTaskId)}>
                                  열기 · {project.progressPct}%
                                </GameControlButton>
                              </SiCodingIconRow>
                            ))}
                          </div>
                        </section>
        
                        <section className="games-panel">
                          <SiCodingPanelTitle action="analysis" title="자원과 인사이트" meta={profileSummary.career.reputationLabel} />
                          <div className="games-rank-split">
                            <SmallStat icon="status" label="체력" value={state.resources.stamina} />
                            <SmallStat icon="support" label="멘탈" value={state.resources.mentality} />
                            <SmallStat icon="guard" label="고객신뢰" value={state.resources.clientTrust} />
                            <SmallStat icon="growth" label="성장 제출" value={`${profileSummary.totalImprovedRuns}회`} />
                          </div>
                          <div className="game-save-list" style={{ marginTop: 12 }}>
                            {insightRows.length ? insightRows.slice(0, 5).map((item) => (
                              <SiCodingIconRow action="analysis" key={`field-${item.id}`}>
                                <div>
                                  <span>{item.label}</span>
                                  <strong>{item.detail}</strong>
                                </div>
                              </SiCodingIconRow>
                            )) : <div className="games-empty">현재 과제 인사이트가 없습니다.</div>}
                          </div>
                        </section>
                      </section>
  );
}
