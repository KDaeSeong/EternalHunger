import { GameFeatureTabs } from '../../_components/GamePlayShell';
import PrimitiveArchiveActionWorkspace from './PrimitiveArchiveActionWorkspace';
import PrimitiveArchiveCampWorkspace from './PrimitiveArchiveCampWorkspace';
import PrimitiveArchiveGrowthTab from './PrimitiveArchiveGrowthTab';
import PrimitiveArchiveInventoryTab from './PrimitiveArchiveInventoryTab';
import PrimitiveArchivePartyWorkspace from './PrimitiveArchivePartyWorkspace';
import PrimitiveArchiveReportTab from './PrimitiveArchiveReportTab';
import PrimitiveArchiveRunTab from './PrimitiveArchiveRunTab';
import PrimitiveArchiveTribeTab from './PrimitiveArchiveTribeTab';
import PrimitiveArchiveWorldMap from './PrimitiveArchiveWorldMap';

export default function PrimitiveArchiveFeatureTabs(props) {
  const {
    archiveReport,
    civics,
    exploration,
    inventoryRows,
    partyCap,
    regions,
    research,
    selectRegion,
    selectedRegion,
    state,
    tribe,
    zoneSelectionUnlocked,
  } = props;

  return (
    <section className="primitive-archive-workspace">
      <GameFeatureTabs
        tabs={[
          {
            id: 'actions',
            label: '행동',
            icon: 'survival',
            badge: `AP ${state.ap}`,
            children: <PrimitiveArchiveActionWorkspace {...props} />,
          },
          {
            id: 'map',
            label: '지도',
            icon: 'map',
            badge: `${exploration?.revealed || 0}/${regions?.length || 0}`,
            children: (
              <PrimitiveArchiveWorldMap
                exploration={exploration}
                onSelect={selectRegion}
                regions={regions}
                selectedRegion={selectedRegion}
                selectionUnlocked={zoneSelectionUnlocked}
              />
            ),
          },
          {
            id: 'party',
            label: '파티',
            icon: 'formation',
            badge: `${state.party.length}/${partyCap}`,
            children: <PrimitiveArchivePartyWorkspace {...props} />,
          },
          {
            id: 'camp',
            label: '캠프',
            icon: 'camp',
            badge: `연료 ${state.camp.fuel}`,
            children: <PrimitiveArchiveCampWorkspace {...props} />,
          },
          {
            id: 'archive-report',
            label: '기록서',
            icon: 'archive',
            badge: archiveReport.grade,
            children: <PrimitiveArchiveReportTab {...props} />,
          },
          {
            id: 'growth',
            label: '발전',
            icon: 'research',
            badge: research.unlocked ? `${research.completed + civics.completed}/${research.total + civics.total}` : '잠김',
            children: <PrimitiveArchiveGrowthTab {...props} />,
          },
          {
            id: 'tribe',
            label: '부족',
            icon: 'diplomacy',
            badge: `${tribe.population}명`,
            children: <PrimitiveArchiveTribeTab {...props} />,
          },
          {
            id: 'inventory',
            label: '장비',
            icon: 'inventory',
            badge: `${inventoryRows.length}종`,
            children: <PrimitiveArchiveInventoryTab {...props} />,
          },
          {
            id: 'run',
            label: '런 관리',
            icon: 'settings',
            badge: props.currentDifficulty.label,
            children: <PrimitiveArchiveRunTab {...props} />,
          },
        ]}
      />
    </section>
  );
}
