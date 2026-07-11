'use client';

import { useState } from 'react';
import PrimitiveArchiveActionWorkspace from './PrimitiveArchiveActionWorkspace';
import PrimitiveArchiveCampWorkspace from './PrimitiveArchiveCampWorkspace';
import PrimitiveArchivePartyWorkspace from './PrimitiveArchivePartyWorkspace';
import PrimitiveArchiveWorkspaceTabs from './PrimitiveArchiveWorkspaceTabs';
import PrimitiveArchiveWorldMap from './PrimitiveArchiveWorldMap';

const SURVIVAL_WORKSPACE_TABS = [
  { id: 'actions', label: '행동', icon: 'survival' },
  { id: 'map', label: '지도', icon: 'map' },
  { id: 'party', label: '파티·목표', icon: 'formation' },
  { id: 'camp', label: '캠프·리포트', icon: 'camp' },
];

export default function PrimitiveArchiveSurvivalTab(props) {
  const [activeWorkspace, setActiveWorkspace] = useState('actions');
  const {
    exploration,
    partyCap,
    regions,
    selectRegion,
    selectedRegion,
    state,
    zoneSelectionUnlocked,
  } = props;
  const tabs = SURVIVAL_WORKSPACE_TABS.map((tab) => ({
    ...tab,
    badge: tab.id === 'actions'
      ? `AP ${state.ap}`
      : tab.id === 'map'
        ? `${exploration?.revealed || 0}/${regions?.length || 0}`
        : tab.id === 'party'
          ? `${state.party.length}/${partyCap}`
          : `연료 ${state.camp.fuel}`,
  }));

  return (
    <section className="primitive-survival-workspace">
      <PrimitiveArchiveWorkspaceTabs
        activeId={activeWorkspace}
        label="생존 운영 화면"
        onChange={setActiveWorkspace}
        tabs={tabs}
      />

      {activeWorkspace === 'actions' ? <PrimitiveArchiveActionWorkspace {...props} /> : null}
      {activeWorkspace === 'map' ? (
        <div className="primitive-workspace-panel" role="tabpanel">
          <PrimitiveArchiveWorldMap
            exploration={exploration}
            onSelect={selectRegion}
            regions={regions}
            selectedRegion={selectedRegion}
            selectionUnlocked={zoneSelectionUnlocked}
          />
        </div>
      ) : null}
      {activeWorkspace === 'party' ? <PrimitiveArchivePartyWorkspace {...props} /> : null}
      {activeWorkspace === 'camp' ? <PrimitiveArchiveCampWorkspace {...props} /> : null}
    </section>
  );
}
