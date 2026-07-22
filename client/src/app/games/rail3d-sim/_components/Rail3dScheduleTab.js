import GameActionIcon from '../../_components/GameActionIcon';
import { SmallStat } from '../../_components/GamePlayPrimitives';
import { formatTime } from '../_lib/rail3dEngine';
import { Rail3dPanelTitle } from './Rail3dVisuals';

function trainStatus(train) {
  if (train.phase === 'DONE') return { action: 'rail-clear', label: '종착', tone: 'is-complete' };
  if (train.signalState === 'STOP') return { action: 'signal', label: '정지', tone: 'is-stopped' };
  if (train.positiveDelayS > 0) return { action: 'rail-delay', label: `+${train.positiveDelayS}s`, tone: 'is-delayed' };
  return { action: 'dispatch', label: train.phase === 'DWELL' ? '정차' : '운행', tone: 'is-running' };
}

export default function Rail3dScheduleTab(props) {
  const {
    report,
    stationBoard,
  } = props;

  return (
    <section className="rail-schedule-layout">
      <section className="games-panel rail-schedule-summary">
        <Rail3dPanelTitle
          action={report.totals.totalDelayS ? 'rail-delay' : 'rail-clear'}
          title="시간표 리포트"
          meta={`${report.totals.arrivedStops}/${report.totals.totalStops} 정차`}
        />
        <div className="games-rank-split">
          <SmallStat label="종착" value={`${report.totals.completed}/${report.totals.trains}`} />
          <SmallStat label="누적 지연" value={`${report.totals.totalDelayS}s`} />
          <SmallStat label="최대 지연" value={`${report.totals.maxDelayS}s`} />
          <SmallStat label="총 대기" value={`${report.totals.totalWaitS}s`} />
        </div>
      </section>

      <section className="games-panel rail-timetable-panel">
        <Rail3dPanelTitle action="rail-junction" title="운행 다이아" meta={`양방향 ${report.trains.length}편성`} />
        <div className="rail-timetable-grid">
          {report.trains.map((train) => {
            const status = trainStatus(train);
            const progress = Math.round((train.arrived / Math.max(1, train.totalStops)) * 100);
            return (
              <article
                className={`rail-timetable-row ${status.tone}`}
                key={train.id}
                style={{ '--rail-service-color': train.color }}
              >
                <GameActionIcon action={status.action} label={`${train.serviceCode} ${status.label}`} />
                <div className="rail-timetable-row__main">
                  <div className="rail-timetable-row__heading">
                    <span>{train.serviceClass} · {train.direction}</span>
                    <strong>{train.serviceCode} {train.serviceName}</strong>
                  </div>
                  <div className="rail-timetable-row__route">
                    <span>{train.origin}</span>
                    <b aria-hidden="true">→</b>
                    <span>{train.destination}</span>
                    <time>{formatTime(train.scheduledStartS)}–{formatTime(train.scheduledEndS)}</time>
                  </div>
                  <div className="rail-timetable-progress" aria-label={`${train.serviceCode} 정차 진행 ${progress}%`}>
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <small>{train.arrived}/{train.totalStops} 정차 · 다음 {train.nextStation} {formatTime(train.nextScheduledS)}</small>
                </div>
                <strong className="rail-timetable-row__status">{status.label}</strong>
              </article>
            );
          })}
        </div>
      </section>

      <section className="games-panel rail-station-board-panel">
        <Rail3dPanelTitle action="station" title="역별 운행판" meta={`${stationBoard.length}역`} />
        <div className="rail-station-board-grid">
          {stationBoard.map((station) => (
            <article className="rail-station-board-card" key={station.stationId}>
              <GameActionIcon action="station" label={station.stationName} />
              <div>
                <span>도착 {station.arrived}/{station.totalCalls} · 출발 {station.departed}/{station.totalCalls}</span>
                <strong>{station.stationName}</strong>
                <small>
                  {station.nextCall
                    ? `다음 ${station.nextCall.serviceCode} · ${formatTime(station.nextCall.scheduledArriveS)} · ${station.nextCall.direction}`
                    : '남은 호출 없음'}
                </small>
              </div>
              <strong>{station.open ? `${station.open} 대기` : '완료'}</strong>
              <div className="rail-station-call-strip" aria-label={`${station.stationName} 운행 호출`}>
                {station.calls.slice(0, 4).map((call) => (
                  <span
                    className={call.actualDepartS !== null ? 'is-passed' : call.delayS ? 'is-delayed' : ''}
                    key={`${station.stationId}-${call.trainId}`}
                    style={{ '--rail-service-color': call.color }}
                  >
                    <time>{formatTime(call.scheduledArriveS)}</time>
                    <b>{call.serviceCode}</b>
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
