import { SmallStat } from '../../_components/GamePlayPrimitives';

export default function Rail3dBlocksTab(props) {
  const {
    blocks,
    rows,
    segments,
  } = props;

  return (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>블록 상태</h2>
                    <span>{blocks.OCCUPIED}/{blocks.total}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="FREE" value={blocks.FREE} />
                    <SmallStat label="OCCUPIED" value={blocks.OCCUPIED} />
                    <SmallStat label="RESERVED" value={blocks.RESERVED} />
                    <SmallStat label="대기초" value={rows.reduce((sum, row) => sum + row.waitSeconds, 0)} />
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>세그먼트 토큰</h2>
                    <span>{segments.length}개</span>
                  </div>
                  <div className="game-save-list">
                    {segments.map((segment) => (
                      <article className="game-save-row" key={segment.id}>
                        <div>
                          <span>{segment.id} · {segment.edgeIds.join(', ')} · 진입 {segment.entryStations.join(', ') || '-'}</span>
                          <strong>{segment.name}</strong>
                        </div>
                        <strong>{segment.owner ? `${segment.owner} 점유` : 'FREE'}{segment.waiting.length ? ` · 대기 ${segment.waiting.join(', ')}` : ''}</strong>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
  );
}
