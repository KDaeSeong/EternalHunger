import { GameFeatureTabs } from '../../_components/GamePlayShell';
import BaVanguardDuelTab from './BaVanguardDuelTab';
import BaVanguardTacticsTab from './BaVanguardTacticsTab';
import BaVanguardHandLogTab from './BaVanguardHandLogTab';
import BaVanguardDeckTab from './BaVanguardDeckTab';

export default function BaVanguardFeatureTabs(props) {
  const {
    duel,
    me,
    tacticalReport,
    valid,
  } = props;

  return (
    <GameFeatureTabs
      tabs={[
        {
          id: 'duel',
          label: '듀얼 진행',
          badge: duel.phase,
          children: <BaVanguardDuelTab {...props} />,
        },
        {
          id: 'tactics',
          label: '전술 리포트',
          badge: tacticalReport.riskLabel,
          children: <BaVanguardTacticsTab {...props} />,
        },
        {
          id: 'hand',
          label: '패/로그',
          badge: `${me.hand.length}장`,
          children: <BaVanguardHandLogTab {...props} />,
        },
        {
          id: 'deck',
          label: '덱 분석',
          badge: valid ? '검증 통과' : '오류',
          children: <BaVanguardDeckTab {...props} />,
        },
      ]}
    />
  );
}
