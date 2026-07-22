import { GameControlButton, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  Rail3dIconRow,
  Rail3dPanelTitle,
  railTrainAction,
  railTrainTone,
} from './Rail3dVisuals';

export default function Rail3dTrainsTab(props) {
  const {
    focusTrain,
    rows,
    selectedTrain,
    selectedTrainId,
  } = props;

  return (
              <section className="games-detail-grid">
                <section className="games-panel">
                  <Rail3dPanelTitle
                    action={railTrainAction(selectedTrain)}
                    title="선택 열차"
                    meta={selectedTrain?.signalState || '-'}
                  />
                  <label className="game-save-json-field">
                    <span>열차</span>
                    <select data-game-sfx="select" value={selectedTrain?.id || selectedTrainId} onChange={(event) => focusTrain(event.target.value, 'trains')}>
                      {rows.map((row) => <option value={row.id} key={row.id}>{row.id} / {row.serviceName}</option>)}
                    </select>
                  </label>
                  {selectedTrain ? (
                    <>
                      <div className="games-rank-split">
                        <SmallStat label="상태" value={selectedTrain.phase} />
                        <SmallStat label="현재 역" value={selectedTrain.currentStation} />
                        <SmallStat label="다음 역" value={selectedTrain.nextStation} />
                        <SmallStat label="속도" value={`${selectedTrain.speedKmh || 0}km/h`} />
                        <SmallStat label="대기" value={`${selectedTrain.waitSeconds || 0}s`} />
                        <SmallStat label="세그먼트" value={selectedTrain.segmentId || '-'} />
                      </div>
                      <div className="game-save-list" style={{ marginTop: 12 }}>
                        <Rail3dIconRow
                          action={railTrainAction(selectedTrain)}
                          className={railTrainTone(selectedTrain)}
                          label={selectedTrain.id}
                        >
                          <div>
                            <span>{selectedTrain.pose.edgeId} / {Math.round(selectedTrain.pose.headS)}m</span>
                            <strong>{selectedTrain.blockedBy ? `${selectedTrain.blockedBy} 때문에 대기` : '진행 가능'}</strong>
                            <small>{selectedTrain.stopReason ? selectedTrain.stopReason.kind : '신호 대기 없음'}</small>
                          </div>
                          <strong>{selectedTrain.signalState}</strong>
                        </Rail3dIconRow>
                      </div>
                    </>
                  ) : <div className="games-empty">선택할 열차가 없습니다.</div>}
                </section>
                <section className="games-panel">
                  <Rail3dPanelTitle action="dispatch" title="열차 목록" meta={`${rows.length}편성`} />
                  <div className="game-save-list">
                    {rows.map((row) => (
                      <Rail3dIconRow
                        action={railTrainAction(row)}
                        className={railTrainTone(row)}
                        label={row.id}
                        key={row.id}
                      >
                        <div>
                          <span>{row.serviceName} · 다음 {row.nextStation}</span>
                          <strong>{row.id} {row.signalState} · {row.phase}</strong>
                          <small>{row.stopReason ? `${row.stopReason.kind}${row.blockedBy ? ` by ${row.blockedBy}` : ''}` : '진행 가능'}</small>
                        </div>
                        <GameControlButton
                          action="dispatch"
                          aria-label={`${row.id} 열차 보기, 대기 ${row.waitSeconds}초`}
                          className="tcg-primary-action"
                          onClick={() => focusTrain(row.id, 'trains')}
                        >
                          보기 · {row.waitSeconds}s
                        </GameControlButton>
                      </Rail3dIconRow>
                    ))}
                  </div>
                </section>
              </section>
  );
}
