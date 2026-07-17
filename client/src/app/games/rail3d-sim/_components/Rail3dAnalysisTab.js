import { ActionButton, GameControlButton, SmallStat } from '../../_components/GamePlayPrimitives';
import { formatTime, setLookaheadBlocksAction } from '../_lib/rail3dEngine';

export default function Rail3dAnalysisTab(props) {
  const {
    applyRailAction,
    bottleneck,
    focusTrain,
    portingCompletion,
    state,
  } = props;

  return (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>이식 완성 감사</h2>
                    <span>{portingCompletion.headline}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="완성도" value={`${portingCompletion.completionPct}%`} />
                    <SmallStat label="카메라 포커스" value={portingCompletion.cameraTarget} />
                    <SmallStat label="노선 길이" value={`${portingCompletion.routeLengthM}m`} />
                    <SmallStat label="통과" value={`${portingCompletion.rows.filter((row) => row.ready).length}/${portingCompletion.rows.length}`} />
                  </div>
                  <div className="game-save-list" style={{ marginTop: 12 }}>
                    {portingCompletion.rows.map((row) => (
                      <article className="game-save-row" key={`porting-${row.id}`} style={row.ready ? { borderColor: '#2b8a5f' } : null}>
                        <div>
                          <span>{row.ready ? '완료' : '점검'} · {row.value}</span>
                          <strong>{row.label}</strong>
                          <small>{row.detail}</small>
                        </div>
                        <strong>{row.ready ? 'OK' : '확인'}</strong>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>병목 자동 분석</h2>
                    <span>{bottleneck.grade}등급 · {bottleneck.topBottleneck}</span>
                  </div>
                  <div className="games-rank-split">
                    <SmallStat label="건강도" value={`${bottleneck.healthScore}점`} />
                    <SmallStat label="심각도" value={bottleneck.totalSeverity} />
                    <SmallStat label="최소 간격" value={bottleneck.minHeadwayS === null ? '-' : formatTime(bottleneck.minHeadwayS)} />
                    <SmallStat label="권장 간격" value={formatTime(bottleneck.idealHeadwayS)} />
                    <SmallStat label="권장 Lookahead" value={bottleneck.recommendedLookahead} />
                    <SmallStat label="출발 보정" value={bottleneck.proposedDepartureShiftS ? `+${bottleneck.proposedDepartureShiftS}s` : '유지'} />
                  </div>
                  <div className="games-activity-list" style={{ marginTop: 12 }}>
                    {bottleneck.recommendations.map((line) => (
                      <div key={line}><strong>{line}</strong></div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <ActionButton
                      action="guard"
                      cue="off"
                      disabled={Number(state.lookaheadBlocks) === Number(bottleneck.recommendedLookahead)}
                      onClick={() => applyRailAction('권장 Lookahead 적용', (current) => setLookaheadBlocksAction(current, bottleneck.recommendedLookahead))}
                    >
                      권장 Lookahead 적용
                    </ActionButton>
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>대기 열차</h2>
                    <span>{bottleneck.waitingTrains.length}건</span>
                  </div>
                  {bottleneck.waitingTrains.length ? (
                    <div className="game-save-list">
                      {bottleneck.waitingTrains.map((train) => (
                        <article className="game-save-row" key={train.id}>
                          <div>
                            <span>{train.serviceName} · {train.reason}{train.blockedBy ? ` by ${train.blockedBy}` : ''}</span>
                            <strong>{train.id} / {train.signalState}</strong>
                            <small>{train.tokenWait ? `토큰 ${train.tokenWait}` : '블록/시간표 대기'} · 지연 {train.delayS}s</small>
                          </div>
                          <GameControlButton
                            action="dispatch"
                            aria-label={`${train.id} 열차 보기, 대기 ${train.waitSeconds}초`}
                            className="tcg-primary-action"
                            onClick={() => focusTrain(train.id, 'trains')}
                          >
                            보기 · {train.waitSeconds}s
                          </GameControlButton>
                        </article>
                      ))}
                    </div>
                  ) : <div className="games-empty">현재 대기 중인 열차가 없습니다.</div>}
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>구간 병목</h2>
                    <span>{bottleneck.segmentRows.length}개</span>
                  </div>
                  <div className="game-save-list">
                    {bottleneck.segmentRows.map((segment) => (
                      <article className="game-save-row" key={segment.id}>
                        <div>
                          <span>{segment.id} · {segment.edgeIds.join(', ')} · 진입 {segment.entryStations.join(', ') || '-'}</span>
                          <strong>{segment.name}</strong>
                          <small>{segment.waiting.length ? `대기 ${segment.waiting.join(', ')}` : '대기 없음'} · {segment.waitSeconds}s</small>
                        </div>
                        <strong>{segment.status}</strong>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>다이아 간격</h2>
                    <span>{bottleneck.headwayRows.length}건</span>
                  </div>
                  <div className="game-save-list">
                    {bottleneck.headwayRows.map((row) => (
                      <article className="game-save-row" key={row.id}>
                        <div>
                          <span>{row.stationName} · {formatTime(row.fromDepartS)} → {formatTime(row.toDepartS)}</span>
                          <strong>{row.fromTrainId} → {row.toTrainId}</strong>
                          <small>권장 {formatTime(bottleneck.idealHeadwayS)} 이상</small>
                        </div>
                        <strong>{formatTime(row.headwayS)} · {row.status}</strong>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="games-panel">
                  <div className="games-panel-title">
                    <h2>역별 주의</h2>
                    <span>{bottleneck.stationHotspots.length}곳</span>
                  </div>
                  {bottleneck.stationHotspots.length ? (
                    <div className="game-save-list">
                      {bottleneck.stationHotspots.slice(0, 6).map((station) => (
                        <article className="game-save-row" key={station.id}>
                          <div>
                            <span>대기 호출 {station.open} · 다음 {station.nextTrainId || '-'}</span>
                            <strong>{station.name}</strong>
                          </div>
                          <strong>+{station.maxDelayS}s</strong>
                        </article>
                      ))}
                    </div>
                  ) : <div className="games-empty">역 단위 지연은 없습니다.</div>}
                </section>
              </section>
  );
}
