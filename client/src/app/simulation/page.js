'use client';

import SimulationHydrationPanel from './_components/SimulationHydrationPanel';
import SimulationPageView from './_components/SimulationPageView';
import { useSimulationPageController } from './_lib/useSimulationPageController';
import '../../styles/ERSimulation.css';

export default function SimulationPage() {
  const { hasHydrated, pageViewProps } = useSimulationPageController();

  if (!hasHydrated) {
    return <SimulationHydrationPanel />;
  }

  return <SimulationPageView {...pageViewProps} />;
}
