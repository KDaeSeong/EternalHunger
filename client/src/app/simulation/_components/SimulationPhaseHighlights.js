'use client';

import { useMemo } from 'react';
import { buildPhaseHighlights } from '../_lib/phaseHighlightsRuntime.js';

export default function SimulationPhaseHighlights({ model, events, survivors, dead, day, phase, matchSec, zoneName }) {
  const rows = useMemo(() => buildPhaseHighlights({ model, events, survivors, dead, day, phase, matchSec, zoneName }),
    [model, events, survivors, dead, day, phase, matchSec, zoneName]);
  if (!model?.team || !day) return null;
  return <section className="simulation-phase-highlights" aria-label="이번 페이즈 핵심 사건">
    <h3>{day}일차 {phase === 'morning' ? '낮' : '밤'} · 핵심 사건</h3>
    <p>{model.team.name} 관전 · 이번 페이즈의 주요 기록을 최대 3가지로 모았습니다.</p>
    {rows.length ? <ol>{rows.map((row) => <li key={row.key}>
      <strong>{row.label}</strong>{row.clock ? <time>{row.clock}</time> : null}<span>{row.text}</span>
    </li>)}</ol> : <p>아직 주요 사건이 없습니다. 제작·회복·후퇴·탈락이 발생하면 여기에 표시됩니다.</p>}
  </section>;
}
