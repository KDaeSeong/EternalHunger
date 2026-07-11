import { GameFeatureTabs } from '../../_components/GamePlayShell';
import SiCodingAdvancedTab from './SiCodingAdvancedTab';
import SiCodingAuditTab from './SiCodingAuditTab';
import SiCodingCareerTab from './SiCodingCareerTab';
import SiCodingCodeTab from './SiCodingCodeTab';
import SiCodingDocsTab from './SiCodingDocsTab';
import SiCodingFieldTab from './SiCodingFieldTab';
import SiCodingTasksTab from './SiCodingTasksTab';

export default function SiCodingSimFeatureTabs(props) {
  const {
    activeFeatureTabId,
    activeFile,
    activeTasks,
    documentProgress,
    filteredRows,
    outcome,
    profileSummary,
    revealedHints,
    rows,
    setActiveFeatureTabId,
    state,
    submissionComparison,
  } = props;

  return (
    <section className="si-coding-workspace">
      <GameFeatureTabs
        activeTabId={activeFeatureTabId}
        onTabChange={setActiveFeatureTabId}
        tabs={[
        {
          id: 'field',
          label: '현장 보드',
          icon: 'tactics',
          badge: `${Object.keys(state.taskOutcomes).length}/${activeTasks.length}`,
          children: <SiCodingFieldTab {...props} />,
        },
        {
          id: 'tasks',
          label: '과제/팩',
          icon: 'project',
          badge: `${filteredRows.length}개`,
          children: <SiCodingTasksTab {...props} />,
        },
        {
          id: 'docs',
          label: '문서/힌트',
          icon: 'archive',
          badge: documentProgress ? `${documentProgress.checkedRequiredCount}/${documentProgress.requiredCount}` : `${revealedHints.length}`,
          children: <SiCodingDocsTab {...props} />,
        },
        {
          id: 'code',
          label: '코드/검수',
          icon: 'code',
          badge: outcome ? `${outcome.score}점` : '미제출',
          children: <SiCodingCodeTab {...props} />,
        },
        {
          id: 'career',
          label: '성장/지원',
          icon: 'growth',
          badge: profileSummary.career.rankTitle,
          children: <SiCodingCareerTab {...props} />,
        },
        {
          id: 'audit',
          label: '검수 비교',
          icon: 'judge',
          badge: `${submissionComparison.deliveryScore}점`,
          children: <SiCodingAuditTab {...props} />,
        },
        {
          id: 'advanced',
          label: '상세 현장',
          icon: 'settings',
          badge: `${rows.length}과제`,
          children: <SiCodingAdvancedTab {...props} />,
        },
        ]}
      />
    </section>
  );
}
