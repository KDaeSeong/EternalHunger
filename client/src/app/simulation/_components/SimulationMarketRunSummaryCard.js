'use client';

export default function SimulationMarketRunSummaryCard({ runProgressSummary }) {
  return (
    <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
      <div className="market-title">🌍 런 전체 요약</div>
      <div className="market-small">drone: <b>{Number(runProgressSummary?.droneCalls || 0)}</b> / kiosk: <b>{Number(runProgressSummary?.kioskGains || 0)}</b> / craft: <b>{Number(runProgressSummary?.craftCount || 0)}</b></div>
      <div className="market-small" style={{ marginTop: 6 }}>legend chars: <b>{Number(runProgressSummary?.legendCount || 0)}</b> / transcend chars: <b>{Number(runProgressSummary?.transCount || 0)}</b></div>
      <div className="market-small" style={{ marginTop: 6 }}>death: <b>{Number(runProgressSummary?.totalDeaths || 0)}</b> / revive: <b>{Number(runProgressSummary?.totalRevives || 0)}</b> / flee: <b>{Number(runProgressSummary?.totalFlees || 0)}</b></div>
      <div className="market-small" style={{ marginTop: 6 }}>revive ratio: <b>{Number(runProgressSummary?.reviveRate || 0).toFixed(2)}</b> / flee ratio: <b>{Number(runProgressSummary?.fleeRate || 0).toFixed(2)}</b></div>
      <div className="market-small" style={{ marginTop: 6 }}>legend pace: <b>{String(runProgressSummary?.legendPace || 'pending')}</b> / transcend pace: <b>{String(runProgressSummary?.transPace || 'pending')}</b></div>
      <div className="market-small" style={{ marginTop: 6 }}>first legend: {String(runProgressSummary?.firstLegendText || '-')} / first transcend: {String(runProgressSummary?.firstTransText || '-')}</div>
      <div className="market-small" style={{ marginTop: 6 }}>latest legend: {String(runProgressSummary?.latestLegendText || '-')} / latest transcend: {String(runProgressSummary?.latestTransText || '-')}</div>
    </div>
  );
}
