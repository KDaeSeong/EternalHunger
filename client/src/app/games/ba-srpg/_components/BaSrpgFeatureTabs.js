import { GameFeatureTabs } from '../../_components/GamePlayShell';
import BaSrpgMissionTab from './BaSrpgMissionTab';
import BaSrpgCampaignExpansionTab from './BaSrpgCampaignExpansionTab';
import BaSrpgTownTab from './BaSrpgTownTab';
import BaSrpgBattleTab from './BaSrpgBattleTab';
import BaSrpgInventoryTab from './BaSrpgInventoryTab';

export default function BaSrpgFeatureTabs(props) {
  const {
    activeTabId,
    battle,
    campaignExpansion,
    formationCount,
    guildRank,
    onTabChange,
    rows,
  } = props;

  return (
    <GameFeatureTabs
      activeTabId={activeTabId}
      onTabChange={onTabChange}
      tabs={[
        {
          id: 'mission',
          label: '작전 준비',
          icon: 'deploy',
          cue: 'srpgTabMission',
          badge: `${formationCount}/4`,
          children: <BaSrpgMissionTab {...props} />,
        },
        {
          id: 'campaign-expansion',
          label: '캠페인 확장',
          icon: 'map',
          cue: 'srpgTabCampaign',
          badge: `${campaignExpansion.readinessPct}%`,
          children: <BaSrpgCampaignExpansionTab {...props} />,
        },
        {
          id: 'town',
          label: '거점 경제',
          icon: 'property',
          cue: 'srpgTabTown',
          badge: guildRank.rank,
          children: <BaSrpgTownTab {...props} />,
        },
        {
          id: 'battle',
          label: '현장/제작',
          icon: 'combat',
          cue: 'srpgTabBattle',
          badge: battle.phase,
          children: <BaSrpgBattleTab {...props} />,
        },
        {
          id: 'inventory',
          label: '보유/퀘스트',
          icon: 'inventory',
          cue: 'srpgTabInventory',
          badge: `${rows.length}종`,
          children: <BaSrpgInventoryTab {...props} />,
        },
      ]}
    />
  );
}
