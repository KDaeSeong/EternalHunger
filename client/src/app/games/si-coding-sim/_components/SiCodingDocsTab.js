import { ActionButton } from '../../_components/GamePlayPrimitives';
import { toggleDocumentReviewAction } from '../_lib/siCodingSimEngine';
import { SiCodingIconRow, SiCodingPanelTitle } from './SiCodingVisuals';

export default function SiCodingDocsTab({
  canRevealHint,
  documentPanelRef,
  documentPlay,
  documentProgress,
  hintPanelRef,
  revealCurrentHint,
  revealedHints,
  setState,
  task,
}) {
  return (
    <section className="games-detail-grid">
                        <section className="games-panel" ref={documentPanelRef}>
                          <SiCodingPanelTitle action="document-review" title="문서 체크" meta={documentPlay?.title || '문서 없음'} />
                          {documentPlay ? (
                            <div className="game-save-list">
                              {(documentPlay.reviewItems || []).map((item) => (
                                <SiCodingIconRow
                                  action={documentProgress?.selectedIds?.includes(item.id) ? 'document-review' : item.required ? 'coding-ready' : 'warning'}
                                  key={`tab-doc-${item.id}`}
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
                            </div>
                          ) : <div className="games-empty">문서 체크 과제가 아닙니다.</div>}
                        </section>
        
                        <section className="games-panel" ref={hintPanelRef}>
                          <SiCodingPanelTitle action="hint" title="힌트" meta={`${revealedHints.length}/${task.hints?.length || 0}`} />
                          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                            <ActionButton action="hint" onClick={revealCurrentHint} disabled={!canRevealHint}>
                              힌트 열기
                            </ActionButton>
                          </div>
                          <div className="game-save-list">
                            {revealedHints.length ? revealedHints.map((hint, index) => (
                              <SiCodingIconRow action="hint" key={`tab-hint-${hint}-${index}`}>
                                <div>
                                  <span>힌트 {index + 1}</span>
                                  <strong>{hint}</strong>
                                </div>
                              </SiCodingIconRow>
                            )) : <div className="games-empty">아직 열람한 힌트가 없습니다.</div>}
                          </div>
                        </section>
        
                        <section className="games-panel">
                          <SiCodingPanelTitle action="archive" title="원문 문서" meta={`${task.documents?.length || 0}개`} />
                          <div className="game-save-list">
                            {(task.documents || []).slice(0, 4).map((doc) => (
                              <SiCodingIconRow action="archive" key={`tab-source-${doc.id}`}>
                                <div>
                                  <span>{doc.id}</span>
                                  <strong>{doc.title}</strong>
                                  <span style={{ whiteSpace: 'pre-wrap' }}>{doc.content}</span>
                                </div>
                              </SiCodingIconRow>
                            ))}
                          </div>
                        </section>
                      </section>
  );
}
