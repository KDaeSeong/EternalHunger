import SchoolSimulatorAdvancedVisionEvents from './SchoolSimulatorAdvancedVisionEvents';
import SchoolSimulatorAdvancedOperations from './SchoolSimulatorAdvancedOperations';
import SchoolSimulatorAdvancedReports from './SchoolSimulatorAdvancedReports';
import SchoolSimulatorAdvancedPeople from './SchoolSimulatorAdvancedPeople';

export default function SchoolSimulatorAdvancedTab(props) {
  return (
    <>
      <SchoolSimulatorAdvancedVisionEvents {...props} />
      <SchoolSimulatorAdvancedOperations {...props} />
      <SchoolSimulatorAdvancedReports {...props} />
      <SchoolSimulatorAdvancedPeople {...props} />
    </>
  );
}
