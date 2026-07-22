import { ActionButton, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  TRACK,
  formatTime,
  runForAction,
  setLookaheadBlocksAction,
  setStepSecondsAction,
  stepAction,
} from '../_lib/rail3dEngine';
import { RailMap } from './Rail3dPlayPanels';
import {
  Rail3dIconRow,
  Rail3dPanelTitle,
  railSegmentAction,
  railSegmentTone,
  railTrainAction,
  railTrainTone,
} from './Rail3dVisuals';

export default function Rail3dAdvancedTab(props) {
  const {
    applyRailAction,
    blocks,
    focusTrain,
    report,
    rows,
    segments,
    selectedTrain,
    selectedTrainId,
    state,
    stationBoard,
  } = props;

  return (
              <>
      <section className="games-detail-grid">
        <section className="games-panel">
          <Rail3dPanelTitle action="settings" title="운행 제어" meta={formatTime(state.nowS)} />
          <div className="games-rank-split">
            <SmallStat label="노드" value={TRACK.nodes.length} />
            <SmallStat label="엣지" value={TRACK.edges.length} />
            <SmallStat label="역" value={TRACK.stations.length} />
            <SmallStat label="블록" value={blocks.total} />
          </div>
          <label className="game-save-json-field">
            <span>선택 열차</span>
            <select data-game-sfx="select" value={selectedTrain?.id || selectedTrainId} onChange={(event) => focusTrain(event.target.value, 'advanced')}>
              {rows.map((row) => <option value={row.id} key={row.id}>{row.id} / {row.serviceName}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>스텝 초</span>
            <select data-game-sfx="off" value={state.stepSeconds} onChange={(event) => applyRailAction('스텝 초 변경', (current) => setStepSecondsAction(current, event.target.value))}>
              {[10, 30, 60, 120, 300].map((seconds) => <option value={seconds} key={seconds}>{seconds}s</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>Lookahead 블록</span>
            <select data-game-sfx="off" value={state.lookaheadBlocks} onChange={(event) => applyRailAction('Lookahead 변경', (current) => setLookaheadBlocksAction(current, event.target.value))}>
              {[0, 1, 2, 3].map((count) => <option value={count} key={count}>{count}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton action="turn" cue="off" onClick={() => applyRailAction('1 Step', (current) => stepAction(current))}>1 Step</ActionButton>
            <ActionButton action="advance" cue="off" onClick={() => applyRailAction('5분 진행', (current) => runForAction(current, 300))}>5분 진행</ActionButton>
            <ActionButton action="advance" cue="off" onClick={() => applyRailAction('20분 진행', (current) => runForAction(current, 1200))}>20분 진행</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <Rail3dPanelTitle action="signal" title="블록 상태" meta={`${blocks.OCCUPIED}/${blocks.total}`} />
          <div className="games-rank-split">
            <SmallStat label="FREE" value={blocks.FREE} />
            <SmallStat label="OCCUPIED" value={blocks.OCCUPIED} />
            <SmallStat label="RESERVED" value={blocks.RESERVED} />
            <SmallStat label="대기초" value={rows.reduce((sum, row) => sum + row.waitSeconds, 0)} />
          </div>
          <div className="game-save-list">
            {segments.map((segment) => (
              <Rail3dIconRow
                action={railSegmentAction(segment)}
                className={railSegmentTone(segment)}
                label={segment.id}
                key={segment.id}
              >
                <div>
                  <span>{segment.edgeIds.join(', ')} · entry {segment.entryStations.join(', ') || '-'}</span>
                  <strong>{segment.id}</strong>
                </div>
                <strong>{segment.owner ? `${segment.owner} 점유` : 'FREE'}{segment.waiting.length ? ` · 대기 ${segment.waiting.join(', ')}` : ''}</strong>
              </Rail3dIconRow>
            ))}
          </div>
        </section>
      </section>

      <section className="games-panel">
        <Rail3dPanelTitle action="map" title="미니맵" meta="sampleTrack.json" />
        <RailMap
          state={state}
          selectedTrainId={selectedTrain?.id || selectedTrainId}
          onSelectTrain={(trainId) => focusTrain(trainId, 'advanced')}
        />
      </section>

      {selectedTrain ? (
        <section className="games-dashboard">
          <section className="games-panel">
            <Rail3dPanelTitle
              action={railTrainAction(selectedTrain)}
              title="선택 열차 디버그"
              meta={`${selectedTrain.id} / ${selectedTrain.signalState}`}
            />
            <div className="games-rank-split">
              <SmallStat label="상태" value={selectedTrain.phase} />
              <SmallStat label="현재 역" value={selectedTrain.currentStation} />
              <SmallStat label="다음 역" value={selectedTrain.nextStation} />
              <SmallStat label="속도" value={`${selectedTrain.speedKmh || 0}km/h`} />
              <SmallStat label="현재 블록" value={selectedTrain.occupiedBlockId || '-'} />
              <SmallStat label="예약 블록" value={selectedTrain.reservedBlocks.length} />
              <SmallStat label="Lookahead" value={selectedTrain.reservationLookahead} />
              <SmallStat label="세그먼트" value={selectedTrain.segmentId || '-'} />
              <SmallStat label="토큰" value={selectedTrain.segmentOwner ? `${selectedTrain.segmentOwner} 점유` : 'FREE'} />
            </div>
            <div className="game-save-list" style={{ marginTop: 12 }}>
              <Rail3dIconRow
                action={railTrainAction(selectedTrain)}
                className={railTrainTone(selectedTrain)}
                label={selectedTrain.id}
              >
                <div>
                  <span>{selectedTrain.pose.edgeId} / {Math.round(selectedTrain.pose.headS)}m / dir {selectedTrain.pose.dir}</span>
                  <strong>{selectedTrain.blockedBy ? `${selectedTrain.blockedBy} 때문에 대기` : '진행 가능'}</strong>
                  <small>
                    {selectedTrain.stopReason
                      ? `${selectedTrain.stopReason.kind}${selectedTrain.stopReason.segmentId ? ` · ${selectedTrain.stopReason.segmentId}` : ''}`
                      : '신호 대기 없음'}
                  </small>
                </div>
                <strong>{selectedTrain.waitSeconds || 0}s</strong>
              </Rail3dIconRow>
              <Rail3dIconRow
                action={selectedTrain.reservedBlocks.length ? 'signal' : 'rail-clear'}
                className={selectedTrain.reservedBlocks.length ? 'is-watch' : 'is-good'}
                label={`${selectedTrain.id} 블록 예약`}
              >
                <div>
                  <span>{selectedTrain.segmentEdges.length ? selectedTrain.segmentEdges.join(', ') : '세그먼트 edge 없음'}</span>
                  <strong>예약: {selectedTrain.reservedBlocks.map((block) => block.id).join(', ') || '없음'}</strong>
                  <small>점유: {selectedTrain.occupiedBlocks.map((block) => block.id).join(', ') || '없음'}</small>
                </div>
                <strong>{selectedTrain.segmentEntries.join(', ') || '-'}</strong>
              </Rail3dIconRow>
            </div>
          </section>

          <section className="games-panel">
            <Rail3dPanelTitle action="station" title="선택 열차 정차표" meta={`${selectedTrain.stops.length} stops`} />
            <div className="game-save-list">
              {selectedTrain.stops.map((stop) => (
                <Rail3dIconRow
                  action={stop.arriveDelayS > 0 ? 'rail-delay' : stop.actualArriveS !== null ? 'station' : 'wait'}
                  className={stop.arriveDelayS > 0 ? 'is-watch' : stop.actualArriveS !== null ? 'is-good' : ''}
                  label={stop.stationName}
                  key={`${selectedTrain.id}-${stop.index}`}
                >
                  <div>
                    <span>
                      {formatTime(stop.scheduledArriveS)} 도착 / {formatTime(stop.scheduledDepartS)} 출발
                      {stop.arriveDelayS !== null ? ` · 지연 ${Math.max(0, stop.arriveDelayS)}s` : ''}
                    </span>
                    <strong>{stop.stationName}</strong>
                    <small>
                      실제 도착 {stop.actualArriveS === null ? '-' : formatTime(stop.actualArriveS)}
                      {' · '}
                      실제 출발 {stop.actualDepartS === null ? '-' : formatTime(stop.actualDepartS)}
                    </small>
                  </div>
                  <strong>{stop.status}</strong>
                </Rail3dIconRow>
              ))}
            </div>
          </section>
        </section>
      ) : null}

      <section className="games-dashboard">
        <section className="games-panel">
          <Rail3dPanelTitle
            action={report.totals.totalDelayS ? 'rail-delay' : 'rail-clear'}
            title="시간표 리포트"
            meta={`${report.totals.arrivedStops}/${report.totals.totalStops} stops`}
          />
          <div className="games-rank-split">
            <SmallStat label="종착" value={`${report.totals.completed}/${report.totals.trains}`} />
            <SmallStat label="누적 지연" value={`${report.totals.totalDelayS}s`} />
            <SmallStat label="최대 지연" value={`${report.totals.maxDelayS}s`} />
            <SmallStat label="총 대기" value={`${report.totals.totalWaitS}s`} />
          </div>
          <div className="games-activity-list" style={{ marginTop: 12 }}>
            {report.recommendations.map((line) => (
              <div key={line}><strong>{line}</strong></div>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <Rail3dPanelTitle action="dispatch" title="열차별 시간표" meta={`${report.trains.length}편성`} />
          <div className="game-save-list">
            {report.trains.map((train) => (
              <Rail3dIconRow
                action={railTrainAction(train)}
                className={railTrainTone(train)}
                label={train.id}
                key={train.id}
              >
                <div>
                  <span>{train.serviceName} · 다음 {train.nextStation} · {train.arrived}/{train.totalStops} stop</span>
                  <strong>{train.id} {train.signalState} · {train.phase}</strong>
                  <small>
                    지연 {train.positiveDelayS}s · 대기 {train.waitSeconds}s
                    {train.stopReason ? ` · ${train.stopReason.kind}${train.blockedBy ? ` by ${train.blockedBy}` : ''}` : ''}
                  </small>
                </div>
                <strong>{train.remaining ? `${train.remaining} 남음` : '완료'}</strong>
              </Rail3dIconRow>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <Rail3dPanelTitle action="station" title="역별 운행판" meta={`${stationBoard.length}역`} />
          <div className="game-save-list">
            {stationBoard.map((station) => (
              <Rail3dIconRow
                action={station.maxDelayS ? 'rail-delay' : station.open ? 'station' : 'rail-clear'}
                className={station.maxDelayS ? 'is-watch' : station.open ? '' : 'is-good'}
                label={station.stationName}
                key={station.stationId}
              >
                <div>
                  <span>
                    도착 {station.arrived}/{station.totalCalls} · 출발 {station.departed}/{station.totalCalls}
                    {station.maxDelayS ? ` · 최대 지연 ${station.maxDelayS}s` : ''}
                  </span>
                  <strong>{station.stationName}</strong>
                  <small>
                    {station.nextCall
                      ? `다음 ${station.nextCall.trainId} ${station.nextCall.serviceName} · ${formatTime(station.nextCall.scheduledArriveS)} · ${station.nextCall.status}${station.nextCall.delayS ? ` · +${station.nextCall.delayS}s` : ''}`
                      : '남은 호출 없음'}
                  </small>
                </div>
                <strong>{station.open ? `${station.open} 대기` : '완료'}</strong>
              </Rail3dIconRow>
            ))}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        {rows.map((row) => (
          <section className="games-panel" key={row.id}>
            <Rail3dPanelTitle
              action={railTrainAction(row)}
              title={`${row.id} / ${row.serviceName}`}
              meta={row.signalState}
            />
            <div className="games-rank-split">
              <SmallStat label="상태" value={row.phase} />
              <SmallStat label="다음 역" value={row.nextStation} />
              <SmallStat label="속도" value={`${row.speedKmh}km/h`} />
              <SmallStat label="대기" value={`${row.waitSeconds}s`} />
              <SmallStat label="Lookahead" value={row.reservationLookahead} />
            </div>
            <div className="game-save-list">
              <Rail3dIconRow
                action={railTrainAction(row)}
                className={railTrainTone(row)}
                label={row.id}
              >
                <div>
                  <span>{row.edgeId} / {row.headS}m · {row.segmentId || 'segment 없음'}</span>
                  <strong>{row.blockedBy ? `${row.blockedBy} 때문에 대기` : '진행 가능'}</strong>
                </div>
                <strong>{row.stopReason?.kind === 'TOKEN_WAIT' ? 'TOKEN_WAIT' : row.lastArrivalDelay > 0 ? `+${row.lastArrivalDelay}s` : '정시'}</strong>
              </Rail3dIconRow>
            </div>
          </section>
        ))}
      </section>

      <section className="games-panel">
        <Rail3dPanelTitle action="logs" title="운행 로그" meta={state.runId} />
        <div className="games-activity-list">
          {state.log.slice(0, 10).map((line, index) => (
            <div key={`${line}-${index}`}>
              <strong>{line}</strong>
            </div>
          ))}
        </div>
      </section>
              </>
  );
}
