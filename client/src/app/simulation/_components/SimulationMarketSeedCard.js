'use client';

export default function SimulationMarketSeedCard({
  day,
  isAdvancing,
  isGameOver,
  matchSec,
  runSeed,
  seedDraft,
  setRunSeed,
  setSeedDraft,
}) {
  const locked = isAdvancing || isGameOver || day !== 0 || matchSec !== 0;

  return (
    <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
      <div className="market-title">🎲 시드(재현)</div>
      <div className="market-small">같은 시드면 랜덤 결과가 재현됩니다. (게임 시작 전에만 변경 권장)</div>
      <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
        <input
          value={seedDraft}
          onChange={(e) => setSeedDraft(e.target.value)}
          placeholder="예) 1700000000000"
          style={{ width: '100%' }}
          disabled={isAdvancing || isGameOver}
        />
        <button
          className="market-mini-btn"
          onClick={() => setRunSeed(String(seedDraft || '').trim() || String(Date.now()))}
          disabled={locked}
          title={(day !== 0 || matchSec !== 0) ? '게임 시작 후에는 변경을 권장하지 않습니다.' : ''}
        >
          적용
        </button>
        <button
          className="market-mini-btn"
          onClick={() => {
            const nextSeed = String(Date.now());
            setSeedDraft(nextSeed);
            setRunSeed(nextSeed);
          }}
          disabled={locked}
        >
          새 시드
        </button>
      </div>
      <div className="market-small">현재: <strong>{runSeed}</strong></div>
    </div>
  );
}
