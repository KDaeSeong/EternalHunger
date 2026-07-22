import { SmallStat } from '../../_components/GamePlayPrimitives';
import {
  Rail3dIconRow,
  Rail3dPanelTitle,
  railSegmentAction,
  railSegmentTone,
} from './Rail3dVisuals';

export default function Rail3dBlocksTab(props) {
  const {
    blocks,
    rows,
    segments,
  } = props;

  return (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <Rail3dPanelTitle action="signal" title="블록 상태" meta={`${blocks.OCCUPIED}/${blocks.total}`} />
                  <div className="games-rank-split">
                    <SmallStat label="FREE" value={blocks.FREE} />
                    <SmallStat label="OCCUPIED" value={blocks.OCCUPIED} />
                    <SmallStat label="RESERVED" value={blocks.RESERVED} />
                    <SmallStat label="대기초" value={rows.reduce((sum, row) => sum + row.waitSeconds, 0)} />
                  </div>
                </section>
                <section className="games-panel">
                  <Rail3dPanelTitle action="rail-token" title="세그먼트 토큰" meta={`${segments.length}개`} />
                  <div className="game-save-list">
                    {segments.map((segment) => (
                      <Rail3dIconRow
                        action={railSegmentAction(segment)}
                        className={railSegmentTone(segment)}
                        label={segment.name}
                        key={segment.id}
                      >
                        <div>
                          <span>{segment.id} · {segment.edgeIds.join(', ')} · 진입 {segment.entryStations.join(', ') || '-'}</span>
                          <strong>{segment.name}</strong>
                        </div>
                        <strong>{segment.owner ? `${segment.owner} 점유` : 'FREE'}{segment.waiting.length ? ` · 대기 ${segment.waiting.join(', ')}` : ''}</strong>
                      </Rail3dIconRow>
                    ))}
                  </div>
                </section>
              </section>
  );
}
