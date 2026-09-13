'use client';

import { useEffect, useRef } from 'react';
import { createNewSimulationSeed } from '../_lib/useSimulationRunSeed';

export default function SimulationMarketSeedCard({
  day,
  isAdvancing,
  isGameOver,
  matchSec,
  replayMode = false,
  runSeed,
  seedDraft,
  setRunSeed,
  setSeedDraft,
}) {
  const locked = replayMode || isAdvancing || isGameOver || day !== 0 || matchSec !== 0;
  const latestSeedRef = useRef(runSeed);

  useEffect(() => {
    latestSeedRef.current = runSeed;
  }, [runSeed]);

  function commitSeed(nextSeed) {
    latestSeedRef.current = nextSeed;
    setRunSeed(nextSeed);
  }

  return (
    <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
      <div className="market-title">🎲 경기 시드</div>
      <div className="market-small">경기 난수의 시작값입니다. 같은 경기를 재현하려면 시드뿐 아니라 시작 편성·장비·지도·규칙도 같아야 합니다. 시드만으로 이전 편성을 복원하지는 않습니다.</div>
      <div className="market-row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
        <input
          value={seedDraft}
          onChange={(e) => setSeedDraft(e.target.value)}
          placeholder="예) 1700000000000"
          aria-label="경기 시드"
          style={{ flex: '1 1 180px', minWidth: 0, width: '100%' }}
          disabled={locked}
        />
        <button
          className="market-mini-btn"
          onClick={() => commitSeed(String(seedDraft || '').trim() || createNewSimulationSeed(latestSeedRef.current))}
          disabled={locked}
          title={(day !== 0 || matchSec !== 0) ? '게임 시작 후에는 시드를 변경할 수 없습니다.' : ''}
        >
          적용
        </button>
        <button
          className="market-mini-btn"
          onClick={() => {
            const nextSeed = createNewSimulationSeed(latestSeedRef.current);
            setSeedDraft(nextSeed);
            commitSeed(nextSeed);
          }}
          disabled={locked}
        >
          새 시드
        </button>
      </div>
      <div className="market-small">현재 시드: <strong>{runSeed}</strong></div>
    </div>
  );
}
