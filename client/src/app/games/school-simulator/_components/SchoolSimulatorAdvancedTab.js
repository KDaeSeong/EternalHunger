import { GameFeatureTabs } from '../../_components/GamePlayShell';
import SchoolSimulatorAdvancedVisionEvents from './SchoolSimulatorAdvancedVisionEvents';
import SchoolSimulatorAdvancedOperations from './SchoolSimulatorAdvancedOperations';
import SchoolSimulatorAdvancedReports from './SchoolSimulatorAdvancedReports';
import SchoolSimulatorAdvancedPeople from './SchoolSimulatorAdvancedPeople';

export default function SchoolSimulatorAdvancedTab(props) {
  const { events, longTerm, state } = props;
  return (
    <GameFeatureTabs
      tabs={[
        {
          id: 'advanced-operations',
          label: '주간 운영',
          icon: 'school',
          badge: `AP ${state.player.weeklyActionPoint}`,
          children: <SchoolSimulatorAdvancedOperations {...props} />,
        },
        {
          id: 'advanced-people',
          label: '사람·행사',
          icon: 'counsel',
          badge: `${state.students.length}명`,
          children: <SchoolSimulatorAdvancedPeople {...props} />,
        },
        {
          id: 'advanced-vision-events',
          label: '비전·사건',
          icon: 'policy',
          badge: events.pending ? '대응' : longTerm.evaluation.grade,
          children: <SchoolSimulatorAdvancedVisionEvents {...props} />,
        },
        {
          id: 'advanced-reports',
          label: '보고서',
          icon: 'archive',
          badge: `${state.semesterHistory.length}학기`,
          children: <SchoolSimulatorAdvancedReports {...props} />,
        },
      ]}
    />
  );
}
