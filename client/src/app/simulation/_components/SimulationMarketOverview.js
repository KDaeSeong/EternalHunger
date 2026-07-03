'use client';

export default function SimulationMarketOverview({
  activeViewerPerkBundle,
  credits,
  fireAndReport,
  loadMarket,
  marketMessage,
  marketTab,
  setMarketTab,
  syncMyState,
  viewerLp,
  viewerPerks,
}) {
  return (
    <>
      <div className="market-tabs">
        <button className={`market-tab ${marketTab === 'craft' ? 'active' : ''}`} onClick={() => setMarketTab('craft')}>🛠️ 조합</button>
        <button className={`market-tab ${marketTab === 'kiosk' ? 'active' : ''}`} onClick={() => setMarketTab('kiosk')}>🏪 키오스크</button>
        <button className={`market-tab ${marketTab === 'drone' ? 'active' : ''}`} onClick={() => setMarketTab('drone')}>🚁 드론</button>
        <button className={`market-tab ${marketTab === 'perk' ? 'active' : ''}`} onClick={() => setMarketTab('perk')}>🎖️ 특전</button>
        <button className={`market-tab ${marketTab === 'trade' ? 'active' : ''}`} onClick={() => setMarketTab('trade')}>🔁 교환</button>
      </div>

      <div className="market-card" style={{ marginTop: 10 }}>
        <div className="market-row">
          <div>
            <div className="market-title">💳 계정 진행</div>
            <div className="market-small" style={{ marginTop: 6 }}>현재 보유 크레딧 {Number(credits || 0)} Cr · LP {Number(viewerLp || 0)} · 보유 특전 {Number((Array.isArray(viewerPerks) ? viewerPerks.length : 0) || 0)}개</div>
            {activeViewerPerkBundle?.summary ? (<div className="market-small">적용 중: {activeViewerPerkBundle.summary}</div>) : null}
          </div>
          <button onClick={() => { void fireAndReport('market.sync', () => Promise.allSettled([syncMyState(), loadMarket()])); }} className="market-mini-btn">동기화</button>
        </div>
      </div>

      {marketMessage ? (
        <div className="market-card" style={{ borderColor: '#ffcdd2', background: '#fff5f5' }}>
          <div style={{ fontWeight: 800, color: '#c62828' }}>알림</div>
          <div className="market-small" style={{ marginTop: 6, color: '#c62828' }}>{marketMessage}</div>
        </div>
      ) : null}
    </>
  );
}
