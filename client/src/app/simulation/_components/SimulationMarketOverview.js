'use client';

import GameActionIcon from '../../games/_components/GameActionIcon';

const MARKET_TABS = [
  { id: 'craft', label: '조합', action: 'craft' },
  { id: 'kiosk', label: '키오스크', action: 'kiosk' },
  { id: 'drone', label: '드론', action: 'drone' },
  { id: 'perk', label: '특전', action: 'trophy' },
  { id: 'trade', label: '교환', action: 'trade' },
];

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
      <div className="market-tabs" role="tablist" aria-label="개발자 도구 기능">
        {MARKET_TABS.map((tab) => (
          <button
            className={`market-tab ${marketTab === tab.id ? 'active' : ''}`}
            type="button"
            role="tab"
            aria-selected={marketTab === tab.id}
            data-game-sfx="tab"
            onClick={() => setMarketTab(tab.id)}
            key={tab.id}
          >
            <GameActionIcon action={tab.action} label={tab.label} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="market-card" style={{ marginTop: 10 }}>
        <div className="market-row">
          <div>
            <div className="market-title sim-icon-label">
              <GameActionIcon action="trade" label="계정 진행" />
              계정 진행
            </div>
            <div className="market-small" style={{ marginTop: 6 }}>현재 보유 크레딧 {Number(credits || 0)} Cr · LP {Number(viewerLp || 0)} · 보유 특전 {Number((Array.isArray(viewerPerks) ? viewerPerks.length : 0) || 0)}개</div>
            {activeViewerPerkBundle?.summary ? (<div className="market-small">적용 중: {activeViewerPerkBundle.summary}</div>) : null}
          </div>
          <button
            type="button"
            data-game-sfx="save"
            onClick={() => { void fireAndReport('market.sync', () => Promise.allSettled([syncMyState(), loadMarket()])); }}
            className="market-mini-btn sim-icon-label"
          >
            <GameActionIcon action="sync" label="동기화" />
            동기화
          </button>
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
