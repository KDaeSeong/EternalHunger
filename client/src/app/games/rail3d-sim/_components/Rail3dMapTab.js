import { RailMap } from './Rail3dPlayPanels';

export default function Rail3dMapTab(props) {
  const {
    blocks,
    selectedTrain,
    selectedTrainId,
    state,
  } = props;

  return (
              <section className="games-panel">
                <div className="games-panel-title">
                  <h2>노선 미니맵</h2>
                  <span>점유 {blocks.OCCUPIED} · 예약 {blocks.RESERVED}</span>
                </div>
                <RailMap state={state} selectedTrainId={selectedTrain?.id || selectedTrainId} />
              </section>
  );
}
