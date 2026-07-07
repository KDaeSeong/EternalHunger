import { ActionButton, SmallStat } from '../../_components/GamePlayPrimitives';
import SubmissionReadinessPanel, { ResultRow } from './SiCodingSubmissionReadinessPanel';
import { evaluateProjectAction, updateFileAction, updateReportAction } from '../_lib/siCodingSimEngine';

export default function SiCodingCodeTab({
  activeContent,
  activeFile,
  activeFileId,
  canRevealHint,
  codePanelRef,
  execution,
  executionPanelRef,
  files,
  outcome,
  reportText,
  resetCurrentTask,
  revealCurrentHint,
  scrollToPanel,
  setSelectedFileId,
  setState,
  submissionReadiness,
  submitCurrentTask,
  task,
}) {
  return (
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
                            <h2>작업 보고</h2>
                            <span>{reportText.trim().length}/{task.reportMinLength || 0}자</span>
                          </div>
                          <label className="game-save-json-field">
                            <span>검수 보고</span>
                            <textarea
                              value={reportText}
                              onChange={(event) => setState((current) => updateReportAction(current, task.id, event.target.value))}
                              placeholder={task.reportPlaceholder || '수정한 내용과 확인 결과를 적으세요.'}
                              style={{ minHeight: 160 }}
                            />
                          </label>
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
                          <div className="games-panel-title">
                            <h2>제출과 결과</h2>
                            <span>{outcome ? `${outcome.passCount}/${outcome.totalChecks}` : '미실행'}</span>
                          </div>
                          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                            <ActionButton onClick={submitCurrentTask}>현재 과제 검수</ActionButton>
                            <ActionButton onClick={resetCurrentTask}>현재 과제 초기화</ActionButton>
                            <ActionButton onClick={() => setState((current) => evaluateProjectAction(current))}>프로젝트 종료 판정</ActionButton>
                          </div>
                          <div className="game-save-list">
                            {outcome ? outcome.results.map((result, index) => (
                              <ResultRow result={result} key={`tab-result-${result.label}-${index}`} />
                            )) : <div className="games-empty">현재 과제를 검수하면 규칙별 통과 여부가 표시됩니다.</div>}
                          </div>
                        </section>
        
                        <section className="games-panel" ref={executionPanelRef}>
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
  );
}
