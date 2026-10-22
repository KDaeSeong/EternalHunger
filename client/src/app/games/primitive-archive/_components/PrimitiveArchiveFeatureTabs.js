import PrimitiveArchiveActionWorkspace from './PrimitiveArchiveActionWorkspace';
import PrimitiveArchiveCampWorkspace from './PrimitiveArchiveCampWorkspace';
import PrimitiveArchiveGrowthTab from './PrimitiveArchiveGrowthTab';
import PrimitiveArchiveDeveloperTab from './PrimitiveArchiveDeveloperTab';
import PrimitiveArchiveInventoryTab from './PrimitiveArchiveInventoryTab';
import PrimitiveArchivePartyWorkspace from './PrimitiveArchivePartyWorkspace';
import PrimitiveArchiveReportTab from './PrimitiveArchiveReportTab';
import PrimitiveArchiveRunTab from './PrimitiveArchiveRunTab';
import PrimitiveArchiveTribeTab from './PrimitiveArchiveTribeTab';
import PrimitiveArchiveWorldMap from './PrimitiveArchiveWorldMap';

export default function PrimitiveArchiveFeatureTabs(props) {
  const {
    activeTabId,
    archiveReport,
    civics,
    exploration,
    inventoryRows,
    partyCap,
    regions,
    research,
    setActiveTabId,
    selectRegion,
    selectedRegion,
    state,
    tribe,
    zoneSelectionUnlocked,
  } = props;

  const tabs = [
    {
      id: 'actions',
      label: '행동',
      badge: `AP ${state.ap}`,
      children: <PrimitiveArchiveActionWorkspace {...props} />,
    },
    {
      id: 'map',
      label: '지도',
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
      badge: `${state.party.length}/${partyCap}`,
      children: <PrimitiveArchivePartyWorkspace {...props} />,
    },
    {
      id: 'camp',
      label: '캠프',
      badge: `연료 ${state.camp.fuel}`,
      children: <PrimitiveArchiveCampWorkspace {...props} />,
    },
    {
      id: 'archive-report',
      label: '기록서',
      badge: archiveReport.grade,
      children: <PrimitiveArchiveReportTab {...props} />,
    },
    {
      id: 'growth',
      label: '발전',
      badge: research.unlocked ? `${research.completed + civics.completed}/${research.total + civics.total}` : '잠김',
      children: <PrimitiveArchiveGrowthTab {...props} />,
    },
    {
      id: 'tribe',
      label: '부족',
      badge: `${tribe.population}명`,
      children: <PrimitiveArchiveTribeTab {...props} />,
    },
    {
      id: 'inventory',
      label: '장비',
      badge: `${inventoryRows.length}종`,
      children: <PrimitiveArchiveInventoryTab {...props} />,
    },
    {
      id: 'developer',
      label: '개발자',
      badge: props.developerTools?.enabled ? 'ON' : 'OFF',
      children: <PrimitiveArchiveDeveloperTab {...props} />,
    },
    {
      id: 'run',
      label: '런 관리',
      badge: props.currentDifficulty.label,
      children: <PrimitiveArchiveRunTab {...props} />,
    },
  ];
  const primaryTabIds = new Set(['actions', 'camp', 'growth']);
  const primaryTabs = tabs.filter((tab) => primaryTabIds.has(tab.id));
  const secondaryTabs = tabs.filter((tab) => !primaryTabIds.has(tab.id));
  const activeTab = tabs.find((tab) => tab.id === activeTabId) || primaryTabs[0];
  const selectTab = (tabId) => setActiveTabId?.(tabId);

  return (
    <section className="primitive-archive-workspace primitive-play-navigation">
      <nav aria-label="문명 아카이브 화면 선택">
        <div className="primitive-primary-tabs" role="group" aria-label="주요 화면">
          {primaryTabs.map((tab) => {
            const selected = activeTab.id === tab.id;
            return (
              <button
                type="button"
                aria-current={selected ? 'page' : undefined}
                aria-controls="primitive-archive-feature-panel"
                id={`primitive-archive-tab-${tab.id}`}
                className={selected ? 'is-active' : ''}
                key={tab.id}
                onClick={() => selectTab(tab.id)}
              >
                <span>{tab.label}</span>
                <strong>{tab.badge}</strong>
              </button>
            );
          })}
        </div>
        <details className="primitive-secondary-navigation">
          <summary>
            다른 화면 <span>현재: {activeTab.label}</span>
          </summary>
          <div
            className="primitive-secondary-navigation__items"
            role="group"
            aria-label="다른 화면"
          >
            {secondaryTabs.map((tab) => {
              const selected = activeTab.id === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  id={`primitive-archive-tab-${tab.id}`}
                  aria-current={selected ? 'page' : undefined}
                  aria-controls="primitive-archive-feature-panel"
                  className={selected ? 'is-active' : ''}
                  onClick={(event) => {
                    selectTab(tab.id);
                    const menu = event.currentTarget.closest('details');
                    if (menu) {
                      menu.open = false;
                      menu.querySelector('summary')?.focus();
                    }
                  }}
                >
                  <span>{tab.label}</span>
                  <strong>{tab.badge}</strong>
                </button>
              );
            })}
          </div>
        </details>
      </nav>
      <div
        className="primitive-archive-feature-panel"
        id="primitive-archive-feature-panel"
        role="region"
        aria-labelledby={`primitive-archive-tab-${activeTab.id}`}
        tabIndex={0}
      >
        {activeTab.children}
      </div>
    </section>
  );
}
