import {
  ActionButton,
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import {
  SchaleIdleIconRow,
  SchaleIdlePanelTitle,
} from './SchaleIdleVisuals';

export default function SchaleIdleSyncTab(props) {
  const {
    busy,
    hydrated,
    saveRun,
    recordRun,
    syncReport,
    token,
  } = props;

  return (
    <section className="games-dashboard">
                  <section className="games-panel">
                    <SchaleIdlePanelTitle action="sync" title="동기화 상태" meta={syncReport.statusLabel} />
                    <div className="games-rank-split" style={{ marginBottom: 12 }}>
                      <SmallStat label="동기화 점수" value={`${syncReport.syncScore}%`} />
                      <SmallStat label="미저장" value={syncReport.dirtyMinutes ? `${syncReport.dirtyMinutes}분` : '없음'} />
                      <SmallStat label="최고 층" value={`F${syncReport.summary.floor}`} />
                      <SmallStat label="탑" value={`${syncReport.summary.tower}층`} />
                      <SmallStat label="전투력" value={syncReport.summary.power.toLocaleString('ko-KR')} />
                      <SmallStat label="점수" value={syncReport.summary.score.toLocaleString('ko-KR')} />
                    </div>
                    <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                      <ActionButton action="save" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>
                        {busy === 'save' ? '저장 중...' : '서버 저장'}
                      </ActionButton>
                      <ActionButton action="archive" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>
                        {busy === 'record' ? '기록 중...' : '전적 스냅샷'}
                      </ActionButton>
                    </div>
                    {!token && hydrated ? (
                      <div className="games-empty schale-sync-note">저장·불러오기·전적 스냅샷은 로그인 후 사용할 수 있습니다.</div>
                    ) : null}
                    <div className="game-save-list">
                      {syncReport.syncRows.map((row) => (
                        <SchaleIdleIconRow action={row.status === 'complete' ? 'complete' : row.status === 'ready' ? 'wait' : 'status'} key={row.id}>
                          <div>
                            <span>{row.status === 'complete' ? '완료' : row.status === 'ready' ? '대기' : '참고'}</span>
                            <strong>{row.label} · {row.value}</strong>
                            <small>{row.detail}</small>
                          </div>
                          <strong>{row.status === 'complete' ? 'OK' : row.status === 'ready' ? '처리' : '정보'}</strong>
                        </SchaleIdleIconRow>
                      ))}
                    </div>
                  </section>
                  <section className="games-panel">
                    <SchaleIdlePanelTitle action="archive" title="동기화 payload" meta="저장 · 전적 · 복귀" />
                    <div className="game-save-list">
                      {syncReport.payloadRows.map((row) => (
                        <SchaleIdleIconRow action="archive" key={row.label}>
                          <div>
                            <span>{row.label}</span>
                            <strong>{row.value}</strong>
                            <small>{row.detail}</small>
                          </div>
                        </SchaleIdleIconRow>
                      ))}
                    </div>
                  </section>
                  <section className="games-panel">
                    <SchaleIdlePanelTitle action="advisor" title="동기화 추천" meta="다음 순서" />
                    <div className="games-activity-list">
                      {syncReport.recommendations.map((line) => (
                        <div key={line}><strong>{line}</strong></div>
                      ))}
                    </div>
                  </section>
                </section>
  );
}
