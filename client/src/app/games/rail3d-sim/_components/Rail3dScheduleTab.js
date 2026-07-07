import { SmallStat } from '../../_components/GamePlayPrimitives';
import { formatTime } from '../_lib/rail3dEngine';

export default function Rail3dScheduleTab(props) {
  const {
    completed,
    report,
    stationBoard,
  } = props;

  return (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>시간표 리포트</h2>
                    <span>{report.totals.arrivedStops}/{report.totals.totalStops} stops</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="종착" value={`${report.totals.completed}/${report.totals.trains}`} />
                    <SmallStat label="누적 지연" value={`${report.totals.totalDelayS}s`} />
                    <SmallStat label="최대 지연" value={`${report.totals.maxDelayS}s`} />
                    <SmallStat label="총 대기" value={`${report.totals.totalWaitS}s`} />
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>역별 운행판</h2>
                    <span>{stationBoard.length}역</span>
                  </div>
                  <div className="game-save-list">
                    {stationBoard.map((station) => (
                      <article className="game-save-row" key={station.stationId}>
                        <div>
                          <span>도착 {station.arrived}/{station.totalCalls} · 출발 {station.departed}/{station.totalCalls}</span>
                          <strong>{station.stationName}</strong>
                          <small>{station.nextCall ? `다음 ${station.nextCall.trainId} · ${formatTime(station.nextCall.scheduledArriveS)}` : '남은 호출 없음'}</small>
                        </div>
                        <strong>{station.open ? `${station.open} 대기` : '완료'}</strong>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
  );
}
