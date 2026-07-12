import { GameFeatureTabs } from '../../_components/GamePlayShell';
import TonkatsuOperationsTab from './TonkatsuOperationsTab';
import TonkatsuTutorialTab from './TonkatsuTutorialTab';
import TonkatsuProductionTab from './TonkatsuProductionTab';
import TonkatsuKitchenTab from './TonkatsuKitchenTab';
import TonkatsuStudentsTab from './TonkatsuStudentsTab';
import TonkatsuGrowthTab from './TonkatsuGrowthTab';
import TonkatsuJudgeTab from './TonkatsuJudgeTab';
import TonkatsuAdvancedTab from './TonkatsuAdvancedTab';

export default function TonkatsuTeacherFeatureTabs(props) {
  const {
    inventoryRows,
    judge,
    operationsReport,
    productionReport,
    selectedRecipePlan,
    tokenRows,
    tournament,
    winRatePreview,
  } = props;

  return (
    <div className="tonkatsu-teacher-workspace">
    <GameFeatureTabs
      tabs={[
        {
          id: 'kitchen',
          label: '주방 루프',
          icon: 'cook',
          badge: `${selectedRecipePlan.planScore}%`,
          children: <TonkatsuKitchenTab {...props} />,
        },
        {
          id: 'students',
          label: '학생/전투',
          icon: 'serve',
          badge: `${winRatePreview}%`,
          children: <TonkatsuStudentsTab {...props} />,
        },
        {
          id: 'growth',
          label: '성장/대회',
          icon: 'tournament',
          badge: tournament.win ? '우승권' : '준비',
          children: <TonkatsuGrowthTab {...props} />,
        },
        {
          id: 'operations',
          label: '운영 리포트',
          icon: 'finance',
          badge: `${operationsReport.readinessPct}%`,
          children: <TonkatsuOperationsTab {...props} />,
        },
        {
          id: 'production',
          label: '연출/이벤트',
          icon: 'event',
          badge: `${productionReport.productionScore}%`,
          children: <TonkatsuProductionTab {...props} />,
        },
        {
          id: 'judge',
          label: '심사 모드',
          icon: 'verdict',
          badge: `${judge.accuracy}%`,
          children: <TonkatsuJudgeTab {...props} />,
        },
        {
          id: 'tutorial',
          label: '튜토리얼/밸런스',
          icon: 'guide',
          badge: `${operationsReport.tutorialPct}%`,
          children: <TonkatsuTutorialTab {...props} />,
        },
        {
          id: 'advanced',
          label: '상세 관리',
          icon: 'settings',
          badge: `${inventoryRows.length + tokenRows.length}종`,
          children: <TonkatsuAdvancedTab {...props} />,
        },
      ]}
    />
    </div>
  );
}
