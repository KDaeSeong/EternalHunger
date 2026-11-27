import { GameControlButton } from '../../_components/GamePlayPrimitives';
import { RIVAL_TRIBES } from '../_lib/primitiveArchiveData';
import { itemName } from '../_lib/primitiveArchiveEngine';
import { ANNUAL_TRADE_JOBS } from '../_lib/primitiveArchiveTradeRoute';

const gainsText = gains => Object.entries(gains || {}).filter(([, qty]) => Number(qty) > 0)
  .map(([id, qty]) => `${itemName(id)} ${qty}개`).join(' · ') || '생산 없음';

export function PrimitiveArchiveAnnualTransition({ annual, control, onNavigate, blocked = false, ended = false }) {
  if (!annual || annual.annualMode || blocked || ended) return null;
  const requirements = annual.startRequirements || [];
  const completed = requirements.filter(row => row.done).length;
  const openRequirement = (row) => {
    if (row.kind === 'research') onNavigate?.('growth', { technologyId: row.id });
    else if (row.kind === 'camp') onNavigate?.('camp', { elementId: `primitive-archive-camp-action-${row.id}` });
    else onNavigate?.('tribe', { elementId: 'primitive-archive-workforce' });
  };
  return <div className="primitive-annual-transition">
    <strong>{annual.canStart ? '정착 기반 완성 · 공동체 운영으로 전환' : '공동체 연간 운영을 위한 준비'}</strong>
    <p>준비 완료 {completed}/{requirements.length} · 전환 뒤에는 공동체의 생산·배식·교육을 1년씩 운영합니다.</p>
    <ul className="primitive-annual-checklist">
      {requirements.map(row => <li key={row.id} data-ready={row.done}>
        <GameControlButton action={row.kind === 'research' ? 'research' : row.kind === 'camp' ? 'camp' : 'primitive-job'}
          cue="off" disabled={typeof onNavigate !== 'function'}
          aria-label={`${row.label} 확인`} onClick={() => openRequirement(row)}>
          {row.label} · {row.done ? '완료' : '미완료'}
        </GameControlButton>
      </li>)}
    </ul>
    {!annual.canStart && completed === requirements.length && annual.startReason ? <p>{annual.startReason}</p> : null}
    {annual.canStart ? <>
      <p>{annual.lineageMode === 'legacy' ? '이전 런의 생애 정책을 이어갑니다.' : '20년 활동 뒤 인계를 안내하고, 25년이 되면 준비된 후계에게 인계합니다. 관찰 생애는 60년입니다.'}</p>
      <p>전환 자체는 시간·행동력·자원을 쓰지 않습니다. 기존 일차 기록은 보존하며 직접 선택할 때만 전환합니다.</p>
      {control}
    </> : null}
  </div>;
}

export default function PrimitiveArchiveAnnualOperations({ annual, yearControl, onNavigate, blocked = false }) {
  if (!annual?.annualMode) return null;
  const plan = annual.plan || {};
  const census = annual.census || {};
  const receipt = annual.lastReceipt;
  const trade = receipt?.tradeRoute;
  const tradeRival = trade && RIVAL_TRIBES.find(row => row.id === trade.rivalId)?.name;
  const tradeJob = trade && ANNUAL_TRADE_JOBS.find(row => row.id === trade.fromJobId)?.name;
  const firstReceipt = receipt && annual.completedYears === 1;
  const counted = annual.lastCensus;
  const finished = !annual.canAdvance;
  const receiptContent = receipt ? <dl className="primitive-operations__rows">
    <div><dt>정산 당시 배식 인구</dt><dd>{counted ? `${counted.total}명 · 필요 ${counted.foodNeed}단위` : '인구 기록 없음'}</dd></div>
    <div><dt>실제 생산</dt><dd>{gainsText(receipt.gains)}</dd></div>
    <div><dt>실제 배식</dt><dd>제공 {receipt.foodProvided ?? 0} / 필요 {receipt.foodNeed ?? 0} · 부족 {receipt.shortage ?? 0}단위</dd></div>
    <div><dt>실제 투자·교육</dt><dd>사업 작업 +{receipt.projectWork || 0} · 연구 +{receipt.researchPoints || 0}RP{receipt.education ? ` · 공교육 +${receipt.education.appliedPoints}CP` : ' · 공교육 영수증 없음'}</dd></div>
    {trade ? <div><dt>실제 연간 교역</dt><dd>{tradeRival} · {trade.status === 'applied'
      ? `${tradeJob} ${trade.workers}명 전용 · 제공 ${gainsText(trade.spent)} → 받음 ${gainsText(trade.received)}`
      : `교역 건너뜀 · ${trade.reason}`}</dd></div> : null}
  </dl> : <p>정착 전의 일일 영수증을 연간 실적으로 바꾸지 않습니다. 1년 운영 뒤 실제 결과를 표시합니다.</p>;
  const successionText = annual.lineageMode === 'legacy' ? '기존 생애 정책 유지 · 새 후계·자연사 추가 없음'
    : `20년 활동 뒤 인계 안내 · 25년 활동 시 준비된 후계 인계 · ${annual.observedLifetimeYears === null ? '자동 생애 종료 없음' : `관찰 생애 ${annual.observedLifetimeYears}년`}`;
  return <article className="primitive-focus-night primitive-annual-operations" data-tone={plan.shortage > 0 ? 'warning' : 'ready'} aria-label="연간 공동체 운영">
    <span className="primitive-focus-eyebrow">{finished ? `정착 ${annual.completedYears}년 정산 완료 · 운영 종료` : `정착 ${annual.year}년 · 올해 운영`}</span>
    <h2>{finished ? '마지막 공동체 운영 기록' : plan.shortage > 0 ? `공동 배식 ${plan.shortage}단위 부족 전망` : '공동체의 생산과 다음 세대'}</h2>
    {!finished && annual.completedYears === 0 ? <div className="primitive-annual-first-year">
      <strong>첫해 운영 순서</strong>
      <ol>
        <li>올해 생산·배식 전망에서 식량 부족 여부를 확인합니다.</li>
        <li><GameControlButton action="primitive-job" cue="off" disabled={blocked || typeof onNavigate !== 'function'}
          onClick={() => onNavigate?.('tribe', { elementId: 'primitive-archive-workforce' })}>일손 배치 확인</GameControlButton> 생산에 필요한 일손을 배치합니다.</li>
        <li>아래 1년 운영을 실행한 뒤 실제 정산에서 생산·배식 결과를 비교합니다.</li>
      </ol>
    </div> : null}
    {firstReceipt ? <section className="primitive-annual-receipt" aria-label="첫해 실제 정산">
      <h3>첫해 실제 정산 · 정착 {annual.receiptYear}년</h3>
      {receiptContent}
    </section> : null}
    <dl className="primitive-operations__rows">
      <div><dt>함께 살아가는 인구</dt><dd>일손 {census.workers || 0}명 · 활동 대원 {census.active || 0}명 · 준비 후계 {census.prepared || 0}명 · 생존 은퇴자 {census.retired || 0}명 · 총 {census.total || 0}명</dd></div>
      {!finished ? <div><dt>올해 생산·배식 전망</dt><dd>{plan.productionText || '생산 전망 확인 중'}<br />현재 식량 {plan.foodStock ?? 0} + 생산 {plan.producedFood ?? 0} → 필요 {plan.foodNeed ?? census.foodNeed ?? 0} / 제공 {plan.provided ?? 0} / 부족 {plan.shortage ?? 0}단위 · 배식 후 {plan.remainingFood ?? 0}단위</dd></div> : null}
      {!finished ? <div><dt>투자와 공교육</dt><dd>{plan.investmentText || '공동체에서 일손 배치를 확인하세요.'}<br />{plan.educationText || '공교육 계획을 확인하세요.'}</dd></div> : null}
      <div><dt>세대와 계승</dt><dd>{plan.successionText || successionText}</dd></div>
    </dl>
    {!finished ? <p className="primitive-annual-note">현재 인구와 운영 배치에 따른 전망입니다. 사업 자재·완성 보상·정산 중 인구 변화가 실제 결과를 바꿀 수 있습니다. 식량 부족은 공동체 사기와 성장에 영향을 줍니다.</p> : null}
    <div className="primitive-operations__day-control">
      {yearControl}
      {!annual.canAdvance && annual.advanceReason ? <span>{annual.advanceReason}</span> : null}
    </div>
    {!firstReceipt ? <details className="primitive-annual-receipt">
      <summary>{receipt ? `최근 실제 정산 · 정착 ${annual.receiptYear}년` : '연간 실제 정산 전'}</summary>
      {receiptContent}
    </details> : null}
    <div className="primitive-annual-links">
      <GameControlButton action="map" cue="off" disabled={blocked} onClick={() => onNavigate?.('map')}>지도 보기</GameControlButton>
      <GameControlButton action="archive" cue="off" disabled={blocked} onClick={() => {
        if (finished) onNavigate?.('founders');
        else onNavigate?.('founders', { elementId: 'primitive-archive-active-people' });
      }}>현역 대원 보기</GameControlButton>
      <GameControlButton action="primitive-job" cue="off" disabled={blocked} onClick={() => onNavigate?.('tribe')}>생산·배식·교육</GameControlButton>
      <GameControlButton action="camp" cue="off" disabled={blocked} onClick={() => onNavigate?.('camp')}>시설 투자</GameControlButton>
    </div>
  </article>;
}
