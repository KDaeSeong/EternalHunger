import { GameFeatureTabs } from '../../_components/GamePlayShell';
import { formatTime } from '../_lib/rail3dEngine';
import Rail3dOperationsTab from './Rail3dOperationsTab';
import Rail3dMapTab from './Rail3dMapTab';
import Rail3dTrainsTab from './Rail3dTrainsTab';
import Rail3dAnalysisTab from './Rail3dAnalysisTab';
import Rail3dScheduleTab from './Rail3dScheduleTab';
import Rail3dBlocksTab from './Rail3dBlocksTab';
import Rail3dLogTab from './Rail3dLogTab';
import Rail3dAdvancedTab from './Rail3dAdvancedTab';

export default function Rail3dFeatureTabs(props) {
  const {
    activeFeatureTabId,
    blocks,
    bottleneck,
    report,
    selectedTrain,
    selectedTrainId,
    setActiveFeatureTabId,
    state,
    stationBoard,
    tokenWaits,
  } = props;

  return (
    <section className="rail3d-workspace">
      <GameFeatureTabs
        activeTabId={activeFeatureTabId}
        onTabChange={setActiveFeatureTabId}
        tabs={[
          {
            id: 'operations',
            label: '운행 보드',
            icon: 'dispatch',
            badge: formatTime(state.nowS),
            children: <Rail3dOperationsTab {...props} />,
          },
          {
            id: 'map',
            label: '미니맵',
            icon: 'map',
            badge: `${blocks.OCCUPIED}/${blocks.total}`,
            children: <Rail3dMapTab {...props} />,
          },
          {
            id: 'trains',
            label: '열차',
            icon: 'dispatch',
            badge: selectedTrain?.id || selectedTrainId,
            children: <Rail3dTrainsTab {...props} />,
          },
          {
            id: 'analysis',
            label: '병목/다이아',
            icon: 'analysis',
            badge: `${bottleneck.healthScore}점`,
            children: <Rail3dAnalysisTab {...props} />,
          },
          {
            id: 'schedule',
            label: '시간표',
            icon: 'calendar',
            badge: `${report.totals.arrivedStops}/${report.totals.totalStops}`,
            children: <Rail3dScheduleTab {...props} />,
          },
          {
            id: 'blocks',
            label: '블록/토큰',
            icon: 'zone',
            badge: `${tokenWaits}대기`,
            children: <Rail3dBlocksTab {...props} />,
          },
          {
            id: 'log',
            label: '로그',
            icon: 'archive',
            badge: `${state.log.length}`,
            children: <Rail3dLogTab {...props} />,
          },
          {
            id: 'advanced',
            label: '상세 운행',
            icon: 'settings',
            badge: `${stationBoard.length}역`,
            children: <Rail3dAdvancedTab {...props} />,
          },
        ]}
      />
    </section>
  );
}
