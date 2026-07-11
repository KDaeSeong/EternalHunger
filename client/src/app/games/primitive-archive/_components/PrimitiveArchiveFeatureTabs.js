import { GameFeatureTabs } from '../../_components/GamePlayShell';
import PrimitiveArchiveSurvivalTab from './PrimitiveArchiveSurvivalTab';
import PrimitiveArchiveReportTab from './PrimitiveArchiveReportTab';
import PrimitiveArchiveGrowthTab from './PrimitiveArchiveGrowthTab';
import PrimitiveArchiveTribeTab from './PrimitiveArchiveTribeTab';
import PrimitiveArchiveInventoryTab from './PrimitiveArchiveInventoryTab';

export default function PrimitiveArchiveFeatureTabs(props) {
  const {
    archiveReport,
    inventoryRows,
    rivals,
    research,
    state,
    tribe,
  } = props;

  return (
    <GameFeatureTabs
      tabs={[
        {
          id: 'survival',
          label: '생존 운영',
          badge: `AP ${state.ap}`,
          children: <PrimitiveArchiveSurvivalTab {...props} />,
        },
        {
          id: 'archive-report',
          label: '기록서',
          badge: archiveReport.grade,
          children: <PrimitiveArchiveReportTab {...props} />,
        },
        {
          id: 'growth',
          label: '연구/성장',
          badge: research.unlocked ? `핵심 ${research.archiveCompleted}/${research.archiveTotal}` : '잠김',
          children: <PrimitiveArchiveGrowthTab {...props} />,
        },
        {
          id: 'tribe',
          label: '부족/외교',
          badge: `${tribe.population}명 · 접촉 ${rivals.filter((rival) => rival.known).length}`,
          children: <PrimitiveArchiveTribeTab {...props} />,
        },
        {
          id: 'inventory',
          label: '인벤토리/로그',
          badge: `${inventoryRows.length}종`,
          children: <PrimitiveArchiveInventoryTab {...props} />,
        },
      ]}
    />
  );
}
