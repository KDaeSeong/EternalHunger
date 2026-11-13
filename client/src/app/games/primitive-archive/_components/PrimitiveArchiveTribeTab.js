'use client';

import { Minus, Plus } from 'lucide-react';
import GameActionIcon from '../../_components/GameActionIcon';
import {
  GameControlButton,
  RecentActionResult,
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import { PrimitiveArchivePanelTitle } from './PrimitiveArchiveVisuals';
import PrimitiveArchiveProcessingPlan, { PrimitiveArchiveProcessingTradition } from './PrimitiveArchiveProcessingPlan';
import PrimitiveArchiveEducationPlan from './PrimitiveArchiveEducationPlan';
import { productionRequirementGuide } from '../_lib/primitiveArchiveProductionRequirementGuide';

function diplomacyDisabledText(rival, action, annualMode = false) {
  if (rival.actedToday) return annualMode ? '올해 교섭을 완료했습니다.' : '오늘 교섭을 완료했습니다.';
  if (!rival.canAct) return rival.statusText;
  if (action === 'trade') return `필요: ${rival.tradeCostText}`;
  if (action === 'gift') return `필요: ${rival.giftCostText}`;
  if (action === 'exchange') {
    if (Number(rival.relation || 0) < 20) return '관계 20 이상 필요';
    return rival.exchangeBlockedReason || `필요: ${rival.exchangeCostText}`;
  }
  if (action === 'raid') return '수렵 연구 완료 필요';
  return rival.statusText;
}

export default function PrimitiveArchiveTribeTab({
  actionFeedback,
  annual,
  annualYearControl,
  nationalControlsBlocked = false,
  projects = [],
  selectNationalProject,
  runNationalDiplomacy,
  adjustNationalTribeJob,
  changeNationalTribeWorkPolicy,
  actor,
  actorId,
  setActorId,
  adjustTribeJob,
  changeTribeWorkPolicy,
  configureTribeProcess,
  configureTribeEducation,
  busy,
  recentActionText,
  rivals = [],
  runDiplomacy,
  supplies,
  projectTradition,
  processingTradition,
  reserveProcessingTradition,
  educationTradition,
  reserveEducationTradition,
  cancelEducationTradition,
  hydrated = false,
  state,
  tribe,
  regions = [],
  onOpenRequirementHelp,
  utilityActions = [],
  runUtility,
  canAct,
}) {
  const annualMode = Boolean(annual?.annualMode);
  const annualBlocked = nationalControlsBlocked || Boolean(busy) || !hydrated || Boolean(state?.ended);
  const nationalUnlocked = Boolean(tribe.workPolicy?.unlocked);
  const executeDiplomacy = annualMode ? runNationalDiplomacy : runDiplomacy;
  const executeJobAdjustment = annualMode ? adjustNationalTribeJob : adjustTribeJob;
  const executeWorkPolicy = annualMode ? changeNationalTribeWorkPolicy : changeTribeWorkPolicy;
  const annualManagement = utilityActions.filter(row => !['patrol', 'drill', 'treatment', 'season_plan', 'irrigation', 'road'].includes(row.id));
  const requirements = productionRequirementGuide({ processing: tribe.processing, education: tribe.education, regions });
  const knownCount = rivals.filter((rival) => rival.known).length;
  const lastProduction = annualMode ? annual.lastReceipt || {} : tribe.lastProduction || {};
  const nextFood = tribe.foodForecast?.days?.[0];
  const jobEditBlockedReason = tribe.jobEditBlockedReason || (busy ? '저장 작업이 끝난 뒤 직업 배치를 변경할 수 있습니다.' : '');
  const tradeRouteCharges = Number(rivals[0]?.tradeRouteCharges || 0);
  const foodResult = Number(tribe.productionSerial || 0) > 0
    ? `${Number(lastProduction.foodProvided || 0)}/${Number(lastProduction.foodNeed || 0)}`
    : '정산 전';
  const workPolicy = tribe.workPolicy;
  const policyControlsBlockedReason = busy ? '저장 작업이 끝난 뒤 운영 방침을 변경할 수 있습니다.'
    : tribe.jobEditBlockedReason || '';
  const policyStatusReason = policyControlsBlockedReason || workPolicy?.blockedReason || '';
  const completedTraditions = (projectTradition?.records || []).filter((row) => row.completedDay > 0 && row.appliedWork > 0)
    .slice().sort((a, b) => b.completedDay - a.completedDay).slice(0, 3);
  const recordedPolicy = workPolicy?.options?.find((option) => option.id === lastProduction.workPolicy);
  const recordedAssignments = lastProduction.assignments;
  const hasRecordedWorkforce = recordedAssignments && ['builder', 'scholar'].every((id) =>
    Number.isSafeInteger(recordedAssignments[id]) && recordedAssignments[id] >= 0);
  const workPolicyReceipt = Number(tribe.productionSerial || 0) > 0
    ? recordedPolicy && hasRecordedWorkforce
      ? `직전 정산 당시 선택: ${recordedPolicy.label} · 실제 건설 ${recordedAssignments.builder}명/기록 ${recordedAssignments.scholar}명`
      : '방침·배치 미기록'
    : '정산 전';

  return (
    <>
      <RecentActionResult action={actionFeedback?.action || 'primitive-job'} label={actionFeedback?.label || '최근 부족 운영 결과'} text={recentActionText} tone={actionFeedback?.tone || 'ready'} pinned />

      <section className="games-panel primitive-tribe-overview">
        <PrimitiveArchivePanelTitle
          action="primitive-growth"
          title={annualMode ? nationalUnlocked ? '국가 운영 · 노동력과 공공사업' : '공동체 운영' : '부족 운영'}
          meta={annualMode ? `정착 ${annual.year}년 · ${annual.completedYears}년 정산 완료` : `일일 정산 ${tribe.productionSerial}회 · 접촉 ${knownCount}/${rivals.length}`}
        >
          <strong>{tribe.population}/{tribe.capacity}명</strong>
        </PrimitiveArchivePanelTitle>
        <div className="games-rank-split games-rank-split--compact primitive-tribe-stats">
          <SmallStat label="인구" value={`${tribe.population}/${tribe.capacity}`} />
          <SmallStat label="배치" value={`${tribe.assigned}/${tribe.population}`} />
          <SmallStat label="미배치" value={tribe.unassigned} />
          <SmallStat label="사기" value={Math.round(tribe.morale)} />
          <SmallStat label="식량" value={`${tribe.foodStock} / ${annualMode ? annual.census.foodNeed : tribe.foodNeed}`} />
        </div>
        <div className="primitive-tribe-growth">
          <div>
            <span>{tribe.atCapacity ? '수용력 한계' : '다음 인구 성장'}</span>
            <strong>{Math.round(tribe.growthProgress)}/{tribe.growthTarget}</strong>
          </div>
          <div className="primitive-project-progress" aria-label={`부족 성장도 ${tribe.growthPct}%`}>
            <i style={{ width: `${tribe.growthPct}%` }} />
          </div>
          <small>{tribe.atCapacity ? '대피소·정착·국가 노동력 연구로 수용력을 늘릴 수 있습니다.' : annualMode ? `올해 예상 생산: ${annual.plan?.productionText || '전망 확인 중'}` : `다음 날 예상 생산: ${tribe.nextProductionText}`}</small>
          {!annualMode && nextFood && (
            <>
              <small>다음 날 부족 배식(현재 인구 {tribe.population}명 기준): 재고 {nextFood.stock} + 생산 {nextFood.produced} → 필요 {nextFood.need}단위 · {nextFood.shortage > 0 ? `부족 ${nextFood.shortage}단위` : `잔여 ${nextFood.reserve}단위`}</small>
              <small>부족 전용 식량 전망(2일): {tribe.foodForecast.totalShortage > 0 ? `부족 ${tribe.foodForecast.totalShortage}단위` : '부족 없음'} · 현재 인구·재고·직업 배치 기준이며, 파티 식사분·인구 증가·추가 행동·사업 보상은 포함하지 않습니다.</small>
              {supplies ? (
                <small>오늘 저녁 비축 점검(공동 배식 몫 제외): 필요 영양 {supplies.partyNeed} · 비축 영양 {supplies.partyNutrition} · 부족 {supplies.foodShortage} 영양 단위</small>
              ) : null}
            </>
          )}
        </div>
      </section>

      <section className="games-panel primitive-job-panel">
        <PrimitiveArchivePanelTitle action="primitive-job" title="직업 배치" meta={`미배치 ${tribe.unassigned}명 · AP 소모 없음`} />
        <p>{jobEditBlockedReason || (annualMode ? '1년 운영 때 자동·미배치 일손을 생산과 실행 가능한 사업에 맞춰 배분합니다. 직접 고정한 일손은 유지하며 활동 대원·준비 후계·생존 은퇴자도 공동 배식에 포함합니다.' : '하루 자동 운영 또는 정착 이후 다음 정산 때 자동 배치 일손과 미배치 인원을 식량·실행 가능한 사업에 맞춰 다시 배분합니다. 직접 조정한 직업의 일손은 유지하며, 이전 저장 기록의 배치도 보존합니다.')}</p>
        {workPolicy ? <div className="primitive-work-policy" role="group" aria-label="자동 일손 운영 방침">
          <h3>자동 일손 운영 방침 · {workPolicy.label}</h3>
          <p>{workPolicy.costText || '방침 설정은 AP를 쓰지 않습니다.'}</p>
          <p>{annualMode ? '다음 1년 운영 때 자동·미배치 일손에 적용합니다.' : workPolicy.timingText || '다음 하루 자동 운영 또는 정산 때 자동·미배치 일손에 적용합니다.'} 방침을 선택해도 지금 배치는 바뀌지 않으며, 직접 고정한 일손과 식량 확보를 먼저 지킵니다.</p>
          {policyStatusReason ? <p className="primitive-work-policy__reason">{policyStatusReason}</p> : null}
          <div className="primitive-work-policy__options">
            {(workPolicy.options || []).map((option) => {
              const selected = option.id === workPolicy.id;
              const blocked = Boolean(policyControlsBlockedReason) || !option.canSelect || selected
                || typeof executeWorkPolicy !== 'function' || (annualMode && annualBlocked);
              const reason = policyControlsBlockedReason || option.blockedReason || (selected ? '현재 선택한 방침입니다.' : '');
              return <button type="button" key={option.id} data-game-sfx="off" aria-pressed={selected} disabled={blocked}
                aria-describedby={'primitive-work-policy-' + option.id} title={reason || option.description}
                onClick={() => { if (!blocked && !(annualMode && annualBlocked)) executeWorkPolicy?.(option.id); }}>
                <strong>{option.label}{selected ? ' · 선택 중' : ''}</strong>
                <span id={'primitive-work-policy-' + option.id}>{option.description}</span>
                {reason ? <small>{reason}</small> : null}
              </button>;
            })}
          </div>
          {completedTraditions.length ? <details className="primitive-work-policy__history">
            <summary>최근 완공에 남은 전승 기록</summary>
            <ul>{completedTraditions.map((row) => <li key={row.projectId + ':' + row.founderId}>{row.text || `${row.projectName || '사업명 미기록'} · ${row.founderName || '창건자 미기록'} · ${row.completedDay}일차 완공 · 실제 전승 작업 ${row.appliedWork}`}</li>)}</ul>
            <p>이 기록은 운영 방침의 해금 조건이나 추가 효과가 아닙니다.</p>
          </details> : null}
        </div> : null}
        <div className="primitive-job-grid">
          {tribe.jobs.map((job) => (
            <article className={[job.unlocked ? '' : 'is-locked', job.id === 'artisan' ? 'primitive-processing-job' : ''].filter(Boolean).join(' ')} key={job.id}>
              <GameActionIcon action={job.action} className="primitive-job-icon" />
              <div className="primitive-job-copy">
                <span>{job.unlocked ? job.outputText : '기술 연구 후 해금'}</span>
                <strong>{job.name}</strong>
                <small>{job.description}</small>
                <small>직접 배치 {job.manualCount}명 · 자동 배치 {job.autoCount}명</small>
                {job.id !== 'artisan' ? <em>다음 정산 · {job.dailyText}</em> : null}
              </div>
              <div className="primitive-job-stepper">
                <button
                  type="button"
                  data-game-sfx="off"
                  disabled={Boolean(jobEditBlockedReason) || !job.canRemove || (annualMode && annualBlocked)}
                  onClick={() => { if (!(annualMode && annualBlocked)) executeJobAdjustment?.(job.id, -1); }}
                  aria-label={`${job.name} 배치 1명 감소`}
                  title={jobEditBlockedReason || `${job.name} 배치 1명 감소`}
                >
                  <Minus size={16} strokeWidth={2.4} />
                </button>
                <strong>{job.count}</strong>
                <button
                  type="button"
                  data-game-sfx="off"
                  disabled={Boolean(jobEditBlockedReason) || !job.canAdd || (annualMode && annualBlocked)}
                  onClick={() => { if (!(annualMode && annualBlocked)) executeJobAdjustment?.(job.id, 1); }}
                  aria-label={`${job.name} 배치 1명 증가`}
                  title={jobEditBlockedReason || (job.unlocked ? `${job.name} 배치 1명 증가` : job.lockedReason)}
                >
                  <Plus size={16} strokeWidth={2.4} />
                </button>
              </div>
              {job.id === 'artisan' ? <PrimitiveArchiveProcessingPlan processing={tribe.processing} runId={state?.runId || ''}
                onConfigure={configureTribeProcess} blockedReason={jobEditBlockedReason}
                requirementGuide={requirements.processing} onOpenRequirementHelp={onOpenRequirementHelp} /> : null}
              {job.id === 'artisan' ? <PrimitiveArchiveProcessingTradition tradition={processingTradition}
                processing={tribe.processing} actor={actor} hydrated={hydrated} busy={busy} ended={Boolean(state?.ended)}
                onReserve={reserveProcessingTradition} /> : null}
            </article>
          ))}
        </div>
        <PrimitiveArchiveEducationPlan education={tribe.education} runId={state?.runId || ''}
          onConfigure={configureTribeEducation}
          requirementGuide={requirements.education} onOpenRequirementHelp={onOpenRequirementHelp}
          tradition={educationTradition} onReserve={reserveEducationTradition} onCancel={cancelEducationTradition}
          hydrated={hydrated} busy={busy} ended={Boolean(state?.ended)}
          blockedReason={state?.ended ? '종료된 런에서는 공교육 계획을 변경할 수 없습니다.' : !hydrated ? '진행 기록 확인이 끝난 뒤 계획을 변경할 수 있습니다.' : jobEditBlockedReason} />
        {(!annualMode || annual.lastReceipt) ? <div className="primitive-tribe-ledger">
          <div className="primitive-work-policy__receipt"><span>직전 운영 방침·배치</span><strong>{workPolicyReceipt}</strong></div>
          <div><span>최근 생산</span><strong>{tribe.lastProductionText}</strong></div>
          {tribe.processing ? <div className="primitive-processing-receipt"><span>직전 정산 실제 가공</span><strong>{tribe.processing.receiptText || '가공 영수증 미기록'}</strong></div> : null}
          {tribe.education ? <div className="primitive-education-receipt"><span>직전 정산 실제 공교육</span><strong>{tribe.education.receiptText || '공교육 영수증 미기록'}</strong></div> : null}
          <div><span>최근 배식</span><strong>{foodResult}</strong></div>
          <div><span>자동 건설</span><strong>{lastProduction.projectWork ? `${lastProduction.projectName} +${lastProduction.projectWork}` : '진행 없음'}</strong></div>
          <div><span>기록대 실제 연구</span><strong>{Object.hasOwn(lastProduction, 'researchRequested') ? `+${Number(lastProduction.researchPoints || 0)}RP` : Number(tribe.productionSerial || 0) > 0 ? '이전 영수증: 적용량 미기록' : '정산 전'}</strong></div>
        </div> : <p>연간 실제 정산 전입니다. 정착 전의 생산 기록은 기존 일차 기록에 보존됩니다.</p>}
      </section>

      {annualMode ? <section className="games-panel primitive-annual-management">
        <PrimitiveArchivePanelTitle action="target" title="공공사업 우선 목표" meta="목표 지정 → 연간 건설" />
        <p>목표 지정은 시간·행동력·재료를 쓰지 않습니다. 연간 운영 때 실제 건설대와 자재가 있으면 착수하며, 직접 고정한 일손과 식량 확보를 먼저 지킵니다.</p>
        {projects.map(project => <div key={project.id} className="primitive-work-policy__receipt">
          <span>{project.name} · {project.progress}/{project.work} · {project.statusLabel}<br />
            {project.committed ? '착수 자재 투입 완료' : `착수 재료: ${project.costText}`}<br />
            {!project.available && !project.completed ? `필요 연구: ${project.missingPrereqs.join(' · ')}` : !project.hasCost && !project.committed ? '현재 자재 부족 · 목표 지정 후 확보 가능' : project.effectText}</span>
          <GameControlButton action="target" cue="off"
            disabled={annualBlocked || project.completed || !project.available || project.selected}
            onClick={() => selectNationalProject?.(project.id)}>
            {project.completed ? '완성' : project.selected ? '현재 목표' : !project.available ? '잠김' : '목표 지정'}
          </GameControlButton>
        </div>)}
      </section> : null}

      {annualMode ? <section className="games-panel primitive-annual-management">
        <PrimitiveArchivePanelTitle action="primitive-job" title="공동체 관리" meta={`관리 AP ${state.ap}/${state.apMax}`} />
        <label className="game-save-json-field"><span>관리 담당</span><select value={actorId} onChange={event => setActorId?.(event.target.value)}>
          {state.party.filter(member => member.hp > 0).map(member => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}
        </select></label>
        <p>실제 재료와 관리 행동력을 사용하는 운영입니다. 1년 운영은 관리 행동력이 0이어도 진행할 수 있습니다.</p>
        <div className="primitive-specialized-actions__buttons">
          {annualManagement.map(row => <GameControlButton key={row.id} action={row.icon} cue="off"
            disabled={Boolean(busy) || !canAct || !row.available} title={row.available ? `${row.outcome} · ${row.cost}` : row.lockedReason}
            onClick={() => runUtility?.(row.id)}>{row.label} · {row.available ? '실행' : '대기'}</GameControlButton>)}
        </div>
      </section> : null}

      <section className="games-panel primitive-diplomacy-panel">
        <PrimitiveArchivePanelTitle action="primitive-diplomacy" title="경쟁 부족 외교" meta={`접촉 ${knownCount}/${rivals.length} · 교역로 ${tradeRouteCharges}/3`} />
        {annualMode ? <p>교역·선물·지식 교류는 다음 해 예약이 아니라 현재 관리 AP와 실제 재고로 즉시 실행합니다. 상대별 올해 교섭 제한을 적용하며, 실행 뒤 바뀐 재고로 연간 운영을 정산합니다.</p> : null}
        <div className="primitive-rival-list">
          {rivals.map((rival) => (
            <article className={`${rival.known ? `is-${rival.relationTone}` : 'is-unknown'}`} key={rival.id}>
              <div className="primitive-rival-head">
                <GameActionIcon action="diplomacy" />
                <div>
                  <span>{rival.known ? `${rival.temperament} · ${rival.specialty}` : '탐사 경계 너머'}</span>
                  <strong>{rival.known ? rival.name : '미접촉 부족'}</strong>
                </div>
                <b>{rival.known ? `${rival.relationLabel} ${Math.round(rival.relation)}` : '미확인'}</b>
              </div>

              {rival.known ? (
                <>
                  <div className="primitive-relation-meter" aria-label={`${rival.name} 관계 ${Math.round(rival.relation)}`}>
                    <i style={{ width: `${rival.relationPct}%` }} />
                  </div>
                  <div className="primitive-rival-terms">
                    <span>교역{rival.tradeRouteActive ? ' · 교역로 적용' : ''} · {rival.tradeCostText} → {rival.tradeRewardText}</span>
                    <span>선물 · {rival.giftCostText}</span>
                    <span>지식 · 관계 20 / {rival.exchangeCostText} / +{rival.exchangePoints}RP</span>
                    <span>교섭 담당 · {rival.actorName || '없음'}</span>
                    <span>{rival.statusText}</span>
                  </div>
                  <div className="primitive-diplomacy-actions">
                    <GameControlButton
                      action="trade"
                      cue="off"
                      disabled={!rival.canTrade || (annualMode && annualBlocked)}
                      title={rival.canTrade ? `교역 실행${rival.tradeRouteActive ? ` · 교역로 ${rival.tradeRouteCharges}회 남음` : ''}` : diplomacyDisabledText(rival, 'trade', annualMode)}
                      onClick={() => executeDiplomacy?.(rival.id, 'trade')}
                    >교역</GameControlButton>
                    <GameControlButton
                      action="claim"
                      cue="off"
                      disabled={!rival.canGift || (annualMode && annualBlocked)}
                      title={rival.canGift ? '선물 전달' : diplomacyDisabledText(rival, 'gift', annualMode)}
                      onClick={() => executeDiplomacy?.(rival.id, 'gift')}
                    >선물</GameControlButton>
                    <GameControlButton
                      action="research"
                      cue="off"
                      disabled={!rival.canExchange || (annualMode && annualBlocked)}
                      title={rival.canExchange ? '지식 교류 실행' : diplomacyDisabledText(rival, 'exchange', annualMode)}
                      onClick={() => executeDiplomacy?.(rival.id, 'exchange')}
                    >지식 교류</GameControlButton>
                    {!annualMode ? <GameControlButton
                      action="combat"
                      cue="off"
                      disabled={!rival.canRaid}
                      title={rival.canRaid ? '약탈 시도' : diplomacyDisabledText(rival, 'raid')}
                      onClick={() => runDiplomacy(rival.id, 'raid')}
                    >약탈</GameControlButton> : null}
                    {annualMode && rival.raidBlockedReason ? <small>{rival.raidBlockedReason}</small> : null}
                  </div>
                </>
              ) : (
                <div className="primitive-rival-unknown">경쟁 부족의 거점 지역을 발견하면 교섭 정보가 기록됩니다.</div>
              )}
            </article>
          ))}
        </div>
      </section>
      {annualMode ? <section className="games-panel primitive-annual-management">
        <PrimitiveArchivePanelTitle action="primitive-job" title="선택 후 연간 운영" />
        <p>노동 방침·공공사업·즉시 교섭 후의 실제 재고로 한 해를 정산합니다. 관리 AP가 0이어도 1년 운영은 가능합니다.</p>
        {annualYearControl}
        {!annual.canAdvance ? <p>{annual.advanceReason}</p> : null}
        {annual.lastReceipt ? <div className="primitive-tribe-ledger">
          <div><span>실제 연간 정산</span><strong>{annual.completedYears}년 · {annual.lastCensus?.total}명 · 배식 {lastProduction.foodProvided}/{lastProduction.foodNeed} · 부족 {lastProduction.shortage}</strong></div>
          <div><span>공공사업 실제 작업</span><strong>{lastProduction.projectName || '진행 없음'} +{lastProduction.projectWork || 0}</strong></div>
        </div> : <p>아직 연간 정산 기록이 없습니다.</p>}
      </section> : null}
    </>
  );
}
