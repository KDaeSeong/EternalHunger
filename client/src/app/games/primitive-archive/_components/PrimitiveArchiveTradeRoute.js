import { GameControlButton } from '../../_components/GamePlayPrimitives';

export default function PrimitiveArchiveTradeRoute({ tradeRoute, onConfigure, blocked = false }) {
  if (!tradeRoute) return null;
  const disabled = blocked || typeof onConfigure !== 'function';
  return <section className="primitive-operations primitive-annual-trade-route" aria-label="근세 교역로">
    <h3>근세 교역로 · 연간 교역 최대 1회</h3>
    <p>근세 교역로 사업을 완성하면 접촉한 이웃 한 곳과 매년 교역합니다. 교역이 가능한 해에만 건설대 또는 기록대의 실제 일손 1명을 전용하며 원래 직업 배치는 유지됩니다.</p>
    <p>올해 시작 비축에서 정가 자재를 먼저 내고 물자를 받습니다. 자재나 일손이 부족하면 교역과 일손 전용 모두 실행하지 않습니다. 설정·해제는 시간과 행동력을 쓰지 않습니다.</p>
    <p role="status">{tradeRoute.reason || `올해 교역 가능 · 제공 ${tradeRoute.costText} → 받음 ${tradeRoute.rewardText}`}</p>
    {tradeRoute.unlocked ? <div className="primitive-annual-links">
      {tradeRoute.rivals.map(rival => <div key={rival.id}>
        <strong>{rival.name}</strong><p>제공 {rival.costText} → 받음 {rival.rewardText}</p>
        {tradeRoute.jobs.map(job => <GameControlButton key={job.id} action="primitive-job" cue="off"
          disabled={disabled || (tradeRoute.rivalId === rival.id && tradeRoute.fromJobId === job.id)} aria-pressed={tradeRoute.rivalId === rival.id && tradeRoute.fromJobId === job.id}
          onClick={() => onConfigure?.({ rivalId: rival.id, fromJobId: job.id })}>
          {rival.name} · {job.name}에서 1명 전용 (다음 배치 전망 {job.workers}명)
        </GameControlButton>)}
      </div>)}
      {!tradeRoute.rivals.length ? <p>먼저 이웃 부족과 접촉해야 교역 상대를 선택할 수 있습니다.</p> : null}
      {tradeRoute.configured ? <GameControlButton action="target" cue="off" disabled={disabled}
        onClick={() => onConfigure?.({ rivalId: '' })}>연간 교역로 해제</GameControlButton> : null}
    </div> : null}
    {tradeRoute.lastReceipt ? <div aria-label="최근 연간 교역 정산">
      <strong>{tradeRoute.lastReceiptRivalName} · {tradeRoute.lastReceipt.status === 'applied' ? '실제 교역 완료' : '교역 건너뜀'}</strong>
      <p>{tradeRoute.lastReceiptJobName}에서 실제 전용 {tradeRoute.lastReceipt.workers}명 · 제공 {tradeRoute.lastReceiptCostText} → 받음 {tradeRoute.lastReceiptRewardText}</p>
      {tradeRoute.lastReceipt.reason ? <p>{tradeRoute.lastReceipt.reason} 자원 소비와 일손 전용은 없었습니다.</p> : null}
    </div> : null}
  </section>;
}
