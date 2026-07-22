import GameActionIcon from '../../_components/GameActionIcon';
import { RailMap } from './Rail3dPlayPanels';
import { Rail3dPanelTitle } from './Rail3dVisuals';

export default function Rail3dMapTab(props) {
  const {
    blocks,
    focusTrain,
    selectedTrain,
    selectedTrainId,
    state,
  } = props;
  const selectedAction = selectedTrain?.stopReason?.kind === 'TOKEN_WAIT'
    ? 'rail-token'
    : selectedTrain?.signalState === 'STOP'
      ? 'signal'
      : selectedTrain?.phase === 'DONE'
        ? 'trophy'
        : 'dispatch';

  return (
    <section className="games-panel">
      <Rail3dPanelTitle action="map" title="노선 미니맵" meta={`점유 ${blocks.OCCUPIED} · 예약 ${blocks.RESERVED}`} />
      <div className="rail-map-shell">
        <RailMap
          state={state}
          selectedTrainId={selectedTrain?.id || selectedTrainId}
          onSelectTrain={(trainId) => focusTrain(trainId, 'map')}
        />
        <div className="rail-map-legend" aria-label="미니맵 범례">
          <span><GameActionIcon action="station" label="역" />역</span>
          <span><GameActionIcon action="dispatch" label="열차" />열차</span>
          <span><GameActionIcon action="signal" label="점유 및 예약 신호" />점유·예약</span>
          <span><GameActionIcon action="rail-token" label="세그먼트 토큰" />토큰</span>
          <span><GameActionIcon action="block-conflict" label="정지 및 충돌" />STOP</span>
        </div>
        {selectedTrain ? (
          <div className={`rail-map-selection${selectedTrain.signalState === 'STOP' ? ' is-warning' : ''}`}>
            <GameActionIcon action={selectedAction} label={`${selectedTrain.id} 상태`} />
            <span>
              <small>선택 열차</small>
              <strong>{selectedTrain.id} · {selectedTrain.phase}</strong>
            </span>
            <span>
              <small>현재 → 다음</small>
              <strong>{selectedTrain.currentStation} → {selectedTrain.nextStation}</strong>
            </span>
            <span>
              <small>신호 / 속도</small>
              <strong>{selectedTrain.signalState} · {selectedTrain.speedKmh || 0}km/h</strong>
            </span>
            <span>
              <small>블록 / 토큰</small>
              <strong>{selectedTrain.occupiedBlockId || '-'} · {selectedTrain.segmentOwner || 'FREE'}</strong>
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
