import { GameFeatureTabs } from '../../_components/GamePlayShell';
import RacingLogosAuditTab from './RacingLogosAuditTab';
import RacingLogosLocalPackTab from './RacingLogosLocalPackTab';
import RacingLogosTracksTab from './RacingLogosTracksTab';
import RacingLogosCalendarTab from './RacingLogosCalendarTab';
import RacingLogosDataPackTab from './RacingLogosDataPackTab';
import RacingLogosEventsTab from './RacingLogosEventsTab';
import RacingLogosMatrixTab from './RacingLogosMatrixTab';
import RacingLogosLogTab from './RacingLogosLogTab';
import RacingLogosAdvancedTab from './RacingLogosAdvancedTab';

export default function RacingLogosFeatureTabs(props) {
  const {
    activeFeatureTabId,
    allTracks,
    audit,
    calendar,
    dataPack,
    events,
    packMatrix,
    setActiveFeatureTabId,
    state,
    tracks,
  } = props;

  return (
    <GameFeatureTabs
      activeTabId={activeFeatureTabId}
      onTabChange={setActiveFeatureTabId}
      tabs={[
        {
          id: 'audit',
          label: '검수 보드',
          badge: `${audit.completeness}%`,
          children: <RacingLogosAuditTab {...props} />,
        },
        {
          id: 'local-pack',
          label: '로컬팩',
          badge: `${Object.keys(state.localPack.trackNames).length}T`,
          children: <RacingLogosLocalPackTab {...props} />,
        },
        {
          id: 'tracks',
          label: '트랙',
          badge: `${tracks.length}/${allTracks.length}`,
          children: <RacingLogosTracksTab {...props} />,
        },
        {
          id: 'calendar',
          label: '캘린더',
          badge: `${calendar.averageReadiness}%`,
          children: <RacingLogosCalendarTab {...props} />,
        },
        {
          id: 'data-pack',
          label: '데이터팩/결과',
          badge: `${dataPack.releaseScore}%`,
          children: <RacingLogosDataPackTab {...props} />,
        },
        {
          id: 'events',
          label: '이벤트/카드',
          badge: `${events.length}`,
          children: <RacingLogosEventsTab {...props} />,
        },
        {
          id: 'matrix',
          label: '매트릭스',
          badge: `${packMatrix.totals.completed}/${packMatrix.totals.rows}`,
          children: <RacingLogosMatrixTab {...props} />,
        },
        {
          id: 'log',
          label: '로그',
          badge: `${state.log.length}`,
          children: <RacingLogosLogTab {...props} />,
        },
        {
          id: 'advanced',
          label: '상세 제작',
          badge: `${packMatrix.totals.rows}행`,
          children: <RacingLogosAdvancedTab {...props} />,
        },
      ]}
    />
  );
}
