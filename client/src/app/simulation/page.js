'use client';

import { useState } from 'react';
import SimulationHydrationPanel from './_components/SimulationHydrationPanel';
import SimulationPageView from './_components/SimulationPageView';
import { useSimulationPageController } from './_lib/useSimulationPageController';
import '../../styles/ERSimulation.css';

export default function SimulationPage({
  evaluationMode = false,
  evaluationCode = '',
  evaluationSeed = '',
} = {}) {
  const [session, setSession] = useState({ key: 0, mode: 'new', record: null });
  const openRecord = (mode, record) => setSession((current) => ({ key: current.key + 1, mode, record }));
  return <SimulationSession key={session.key}
    evaluationMode={evaluationMode}
    evaluationCode={evaluationCode}
    evaluationSeed={evaluationSeed}
    replayRecord={session.mode === 'replay' ? session.record : null}
    draftRecord={session.mode === 'variant' ? session.record : null}
    onReplay={(record) => openRecord('replay', record)}
    onVariant={(record) => openRecord('variant', record)} />;
}

function SimulationSession({
  evaluationMode,
  evaluationCode,
  evaluationSeed,
  replayRecord,
  draftRecord,
  onReplay,
  onVariant,
}) {
  const { hasHydrated, pageViewProps } = useSimulationPageController({
    evaluationMode,
    evaluationCode,
    evaluationSeed,
    replayRecord,
    draftRecord,
    onReplay,
    onVariant,
  });

  if (!hasHydrated) {
    return <SimulationHydrationPanel />;
  }

  return <SimulationPageView {...pageViewProps} />;
}
