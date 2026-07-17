import { GameControlButton } from '../../_components/GamePlayPrimitives';
import { SiCodingIconRow, SiCodingPanelTitle } from './SiCodingVisuals';

export default function SiCodingTasksTab({
  filteredRows,
  packRows,
  rows,
  selectTask,
  selectTaskPack,
  state,
  taskFilters,
  updateTaskFilter,
}) {
  return (
    <section className="games-detail-grid">
                        <section className="games-panel">
                          <SiCodingPanelTitle
                            action="load"
                            title="과제팩"
                            meta={state.activeTasks?.length ? '생성 현장' : state.taskSet?.packId || 'stepAQ_AR'}
                          />
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
                              <SiCodingIconRow action={pack.selected ? 'equip' : 'load'} key={`pack-${pack.id}`} style={pack.selected ? { borderColor: '#2673a6' } : null}>
                                <div>
                                  <span>{pack.version || 'version unknown'} · 보상 {pack.rewardScore}pt</span>
                                  <strong>{pack.label}</strong>
                                  <span>{pack.title}</span>
                                </div>
                                <GameControlButton action="load" className="tcg-primary-action" onClick={() => selectTaskPack(pack.id)}>
                                  불러오기 · {pack.taskCount}개
                                </GameControlButton>
                              </SiCodingIconRow>
                            ))}
                          </div>
                        </section>
        
                        <section className="games-panel">
                          <SiCodingPanelTitle action="task-select" title="빠른 과제 선택" meta={`${filteredRows.length}/${rows.length}`} />
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
                              <SiCodingIconRow action={row.score === null ? 'task-select' : row.score >= 75 ? 'coding-test-pass' : 'coding-test-fail'} key={`task-tab-${row.id}`}>
                                <div>
                                  <span>{row.difficulty} / {row.modeLabel} · 문서 {row.documentCount} · 실행 {row.executionCount + row.hiddenExecutionCount} · 정적 {row.checkCount}</span>
                                  <strong>{row.id}</strong>
                                  <span>{row.projectName}</span>
                                </div>
                                <GameControlButton action="target" className="tcg-primary-action" onClick={() => selectTask(row.id)}>
                                  열기 · {row.score === null ? row.status : `${row.score}점`}
                                </GameControlButton>
                              </SiCodingIconRow>
                            ))}
                          </div>
                        </section>
                      </section>
  );
}
