import { GameFeatureTabs } from '../../_components/GamePlayShell';
import BaSrpgMissionTab from './BaSrpgMissionTab';
import BaSrpgCampaignExpansionTab from './BaSrpgCampaignExpansionTab';
import BaSrpgTownTab from './BaSrpgTownTab';
import BaSrpgBattleTab from './BaSrpgBattleTab';
import BaSrpgInventoryTab from './BaSrpgInventoryTab';

export default function BaSrpgFeatureTabs(props) {
  const {
    battle,
    campaignExpansion,
    formationCount,
    guildRank,
    rows,
  } = props;

  return (
    <GameFeatureTabs
      tabs={[
        {
          id: 'mission',
          label: '작전 준비',
          icon: 'deploy',
          badge: `${formationCount}/4`,
          children: <BaSrpgMissionTab {...props} />,
        },
        {
          id: 'campaign-expansion',
          label: '캠페인 확장',
          icon: 'map',
          badge: `${campaignExpansion.readinessPct}%`,
          children: <BaSrpgCampaignExpansionTab {...props} />,
        },
        {
          id: 'town',
          label: '거점 경제',
          icon: 'property',
          badge: guildRank.rank,
          children: <BaSrpgTownTab {...props} />,
        },
        {
          id: 'battle',
          label: '현장/제작',
          icon: 'combat',
          badge: battle.phase,
          children: <BaSrpgBattleTab {...props} />,
        },
        {
          id: 'inventory',
          label: '보유/퀘스트',
          icon: 'inventory',
          badge: `${rows.length}종`,
          children: <BaSrpgInventoryTab {...props} />,
        },
      ]}
    />
  );
}
