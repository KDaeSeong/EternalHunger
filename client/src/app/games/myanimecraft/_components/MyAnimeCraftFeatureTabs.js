import { GameFeatureTabs } from '../../_components/GamePlayShell';
import MyAnimeCraftLeagueTab from './MyAnimeCraftLeagueTab';
import MyAnimeCraftCupsTab from './MyAnimeCraftCupsTab';
import MyAnimeCraftTeamTab from './MyAnimeCraftTeamTab';
import MyAnimeCraftMarketTab from './MyAnimeCraftMarketTab';
import MyAnimeCraftRecordsTab from './MyAnimeCraftRecordsTab';

export default function MyAnimeCraftFeatureTabs(props) {
  const {
    inventoryRows,
    personalSummary,
    played,
    selectedTeam,
    standings,
    total,
    winnersSummary,
  } = props;

  return (
    <GameFeatureTabs
      tabs={[
        {
          id: 'league',
          label: '정규리그',
          badge: `${played}/${total}`,
          children: <MyAnimeCraftLeagueTab {...props} />,
        },
        {
          id: 'cups',
          label: '컵/특별전',
          badge: `${personalSummary.played + winnersSummary.played}`,
          children: <MyAnimeCraftCupsTab {...props} />,
        },
        {
          id: 'team',
          label: '팀 운영',
          badge: selectedTeam.name,
          children: <MyAnimeCraftTeamTab {...props} />,
        },
        {
          id: 'market',
          label: '시장/장비',
          badge: `${inventoryRows.reduce((sum, item) => sum + Number(item.qty || 0), 0)}개`,
          children: <MyAnimeCraftMarketTab {...props} />,
        },
        {
          id: 'records',
          label: '기록/랭킹',
          badge: `${standings.length}팀`,
          children: <MyAnimeCraftRecordsTab {...props} />,
        },
      ]}
    />
  );
}
