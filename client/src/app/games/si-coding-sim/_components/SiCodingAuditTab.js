import { GameControlButton, SmallStat } from '../../_components/GamePlayPrimitives';
import { SiCodingIconRow, SiCodingPanelTitle } from './SiCodingVisuals';

export default function SiCodingAuditTab({
  packAudit,
  packRows,
  portingCompletion,
  selectTask,
  submissionComparison,
}) {
  return (
    <section className="games-detail-grid">
                        <section className="games-panel">
                          <SiCodingPanelTitle action="coding-audit" title="이식 완성 감사" meta={portingCompletion.headline} />
                          <div className="games-rank-split">
                            <SmallStat icon="coding-audit" label="완성도" value={`${portingCompletion.completionPct}%`} />
                            <SmallStat icon="coding-test-pass" label="통과" value={`${portingCompletion.rows.filter((row) => row.ready).length}/${portingCompletion.rows.length}`} />
                            <SmallStat icon="load" label="과제팩" value={`${packRows.length}팩`} />
                            <SmallStat icon="target" label="기준선" value={`${submissionComparison.benchmarkRows.length}개`} />
                          </div>
                          <div className="game-save-list" style={{ marginTop: 12 }}>
                            {portingCompletion.rows.map((row) => (
                              <SiCodingIconRow action={row.ready ? 'coding-test-pass' : 'coding-blocked'} key={`porting-${row.id}`} style={row.ready ? { borderColor: '#2b8a5f' } : null}>
                                <div>
                                  <span>{row.ready ? '완료' : '점검'} · {row.value}</span>
                                  <strong>{row.label}</strong>
                                  <span>{row.detail}</span>
                                </div>
                                <strong>{row.ready ? 'OK' : '확인'}</strong>
                              </SiCodingIconRow>
                            ))}
                          </div>
                        </section>
        
                        <section className="games-panel">
                          <SiCodingPanelTitle action="analysis" title="과제팩 난이도 감사" meta={`${packAudit.packLabel || '생성 현장'} · ${packAudit.grade}등급`} />
                          <div className="games-rank-split">
                            <SmallStat icon="coding-audit" label="감사 점수" value={`${packAudit.averageAuditScore}점`} />
                            <SmallStat icon="task-select" label="과제 수" value={`${packAudit.totalTasks}개`} />
                            <SmallStat icon="archive" label="문서 과제" value={`${packAudit.docTaskCount}/${packAudit.totalTasks}`} />
                            <SmallStat icon="execute" label="검수 과제" value={`${packAudit.executionTaskCount}/${packAudit.totalTasks}`} />
                            <SmallStat icon="hint" label="힌트 과제" value={`${packAudit.hintTaskCount}/${packAudit.totalTasks}`} />
                            <SmallStat icon="warning" label="Hard 비중" value={`${packAudit.hardRatio}%`} />
                          </div>
                          <div className="game-save-list" style={{ marginTop: 12 }}>
                            {packAudit.issueRows.length ? packAudit.issueRows.slice(0, 6).map((row) => (
                              <SiCodingIconRow action={row.blockers.length ? 'coding-blocked' : 'coding-audit'} key={`audit-issue-${row.id}`}>
                                <div>
                                  <span>{row.difficulty} · {row.modeLabel} · 점수 {row.auditScore}</span>
                                  <strong>{row.id}</strong>
                                  <span>{row.projectName}</span>
                                  <span>{row.blockers.length ? row.blockers.join(' / ') : '검수 구성 양호'}</span>
                                </div>
                                <GameControlButton action="search" className="tcg-primary-action" onClick={() => selectTask(row.id, 'code')}>
                                  열기
                                </GameControlButton>
                              </SiCodingIconRow>
                            )) : <div className="games-empty">보강이 필요한 과제는 없습니다.</div>}
                          </div>
                        </section>
        
                        <section className="games-panel">
                          <SiCodingPanelTitle action="target" title="제출 기준선 비교" meta={submissionComparison.tier} />
                          <div className="games-rank-split">
                            <SmallStat icon="trophy" label="납품 점수" value={`${submissionComparison.deliveryScore}점`} />
                            <SmallStat icon="status" label="제출률" value={`${submissionComparison.completionPct}%`} />
                            <SmallStat icon="analysis" label="평균 점수" value={`${submissionComparison.averageScore}점`} />
                            <SmallStat icon="coding-test-pass" label="완전 통과" value={`${submissionComparison.fullPassCount}/${submissionComparison.totalTasks}`} />
                            <SmallStat icon="support-risk" label="열린 리스크" value={`${submissionComparison.riskOpenCount}건`} />
                            <SmallStat icon="document-unreview" label="문서 패널티" value={`${submissionComparison.documentPenalty}건`} />
                          </div>
                          <div className="game-save-list" style={{ marginTop: 12 }}>
                            {submissionComparison.benchmarkRows.map((row) => (
                              <SiCodingIconRow action={row.status === '도달' ? 'coding-test-pass' : 'target'} key={`benchmark-${row.id}`} style={row.status === '도달' ? { borderColor: '#2b8a5f' } : null}>
                                <div>
                                  <span>목표 {row.target}점 · 현재 차이 {row.delta >= 0 ? '+' : ''}{row.delta}</span>
                                  <strong>{row.label}</strong>
                                  <span>{row.detail}</span>
                                </div>
                                <strong>{row.status}</strong>
                              </SiCodingIconRow>
                            ))}
                          </div>
                        </section>
        
                        <section className="games-panel">
                          <SiCodingPanelTitle action="warning" title="보강 체크리스트" meta={`${submissionComparison.recommendations.length + packAudit.warnings.length}개`} />
                          <div className="game-save-list">
                            {packAudit.warnings.map((line, index) => (
                              <SiCodingIconRow action="warning" key={`audit-warning-${line}-${index}`}>
                                <div>
                                  <span>과제팩</span>
                                  <strong>{line}</strong>
                                </div>
                              </SiCodingIconRow>
                            ))}
                            {submissionComparison.recommendations.map((line, index) => (
                              <SiCodingIconRow action="counsel" key={`compare-recommendation-${line}-${index}`}>
                                <div>
                                  <span>제출</span>
                                  <strong>{line}</strong>
                                </div>
                              </SiCodingIconRow>
                            ))}
                            {!packAudit.warnings.length && !submissionComparison.recommendations.length ? (
                              <div className="games-empty">현재 제출은 납품 안정권에 가깝습니다.</div>
                            ) : null}
                          </div>
                        </section>
        
                        <section className="games-panel">
                          <SiCodingPanelTitle action="analysis" title="세부 지표" meta={`${submissionComparison.metricRows.filter((row) => row.ok).length}/${submissionComparison.metricRows.length}`} />
                          <div className="game-save-list">
                            {submissionComparison.metricRows.map((row) => (
                              <SiCodingIconRow action={row.ok ? 'coding-test-pass' : 'coding-blocked'} key={`compare-metric-${row.id}`} style={row.ok ? { borderColor: '#2b8a5f' } : null}>
                                <div>
                                  <span>목표 {row.target}</span>
                                  <strong>{row.label}</strong>
                                </div>
                                <strong>{row.value}</strong>
                              </SiCodingIconRow>
                            ))}
                          </div>
                        </section>
                      </section>
  );
}
