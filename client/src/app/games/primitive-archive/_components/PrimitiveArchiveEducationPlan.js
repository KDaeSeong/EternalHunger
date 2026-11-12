'use client';

import { useState } from 'react';
import { GameControlButton } from '../../_components/GamePlayPrimitives';
import PrimitiveArchiveProductionRequirementGuide from './PrimitiveArchiveProductionRequirementGuide';

function EducationPlanForm({ education, onConfigure, blockedReason, tradition, onReserve, onCancel, hydrated, busy, ended, requirementGuide, onOpenRequirementHelp }) {
  const [teachers, setTeachers] = useState(String(education.plan.teachers));
  const count = Number(teachers);
  const valid = teachers.trim() !== '' && Number.isSafeInteger(count) && count >= 0 && count <= 24;
  const unchanged = valid && count === education.plan.teachers;
  const controlsBlocked = Boolean(blockedReason) || !education.canConfigure || typeof onConfigure !== 'function';
  const lockedSelection = valid && count > 0 && !education.unlocked;
  const submitBlocked = controlsBlocked || !valid || unchanged || lockedSelection;
  const reason = blockedReason || (!education.canConfigure ? education.blockedReason : '')
    || (lockedSelection ? '공교육 제도를 완료해야 교원을 배치하는 계획을 저장할 수 있습니다.' : '');

  return <div className="primitive-education-plan">
    <h3>공교육 운영</h3>
    <p>기록대 일손 중 저장한 상한까지 교원으로 전환합니다. 초기 계획과 공교육 계획이 없는 이전 저장 기록은 가동 안 함(0명)으로 시작합니다. 실제 수업에 참여한 교원은 같은 날 일반 연구 RP를 중복 생산하지 않습니다.</p>
    <form className="primitive-education-plan__form" aria-label="공교육 교원 계획"
      onSubmit={(event) => {
        event.preventDefault();
        if (!submitBlocked) onConfigure({ teachers: count });
      }}>
      <label><span>교원 상한 · 0명은 가동 안 함</span>
        <input type="number" inputMode="numeric" min="0" max="24" step="1" required
          value={teachers} disabled={controlsBlocked} aria-describedby="primitive-education-plan-help"
          onChange={(event) => setTeachers(event.target.value)} />
      </label>
      <GameControlButton action="research" cue="off" type="submit" disabled={submitBlocked}
        aria-describedby="primitive-education-plan-help"
        title={reason || (!valid ? '교원 상한은 0~24명의 정수여야 합니다.' : unchanged ? '현재 저장된 계획입니다.' : '교원 상한을 저장합니다.')}>
        설정 적용
      </GameControlButton>
      <p id="primitive-education-plan-help">입력 중인 상한은 적용 전 초안입니다. 설정은 개인 AP·ST를 쓰지 않으며 지금 종이를 소비하거나 성과를 지급하지 않습니다.</p>
      {reason ? <p role="status">{reason}</p> : null}
    </form>
    {!education.unlocked ? <p>공교육 제도 완료 전에는 가동 안 함만 저장할 수 있습니다.</p> : null}
    <div className="primitive-education-plan__preview" aria-label="저장된 공교육 계획의 현재 비축 기준 전망">
      <strong>저장된 계획 · 교원 상한 {education.plan.teachers}명{education.plan.teachers === 0 ? ' · 가동 안 함' : ''}</strong>
      <span>현재 배치 고정 전망 · 기록대 {education.scholars}명 중 실제 교원 {education.teachers}명 · 일반 연구로 남는 일손 {education.generalScholars}명</span>
      <span>현재 종이 {education.paperStock === null ? '확인 불가' : `${education.paperStock}장`} · 교원 1명당 하루 1장 소비 → 최대 2CP</span>
      <span>대상 제도 · {education.civicName || '진행 가능한 제도 없음'} · 요청 {education.requestedPoints}CP / 예상 실제 적용 {education.expectedPoints}CP</span>
      <span>{education.statusText}</span>
      <small>{education.timingText}</small>
    </div>
    <PrimitiveArchiveProductionRequirementGuide guide={requirementGuide} scope="education" onOpenRequirementHelp={onOpenRequirementHelp} />
    <PrimitiveArchiveEducationTradition tradition={tradition} education={education} onReserve={onReserve} onCancel={onCancel}
      hydrated={hydrated} busy={busy} ended={ended} />
    <p>종이·진행할 제도·인원이 부족해 수업에 쓰이지 않은 기록대 일손은 일반 연구로 돌아갑니다. 가공대 제지(나무 1개 + 섬유 1개 → 종이 2장)는 제지 연구와 실제 가공 계획·일손이 필요합니다. 같은 아침 뒤에 생산한 종이는 다음 날 교육부터 사용합니다.</p>
  </div>;
}

export function PrimitiveArchiveEducationTradition({ tradition, education, onReserve, onCancel, hydrated, busy, ended }) {
  if (!tradition) return null;
  const blocked = !hydrated || busy || ended;
  const canReserve = !blocked && tradition.enabled && tradition.canReserve && typeof onReserve === 'function';
  const canCancel = !blocked && tradition.canCancel && typeof onCancel === 'function';
  const reason = !hydrated ? '진행 기록 확인이 끝난 뒤 예약할 수 있습니다.'
    : busy ? '저장 또는 진행 보호 작업 중에는 예약할 수 없습니다.'
      : ended ? '종료된 런에서는 전승을 예약할 수 없습니다.' : tradition.reason || '';
  const settlement = tradition.lastSettlement;
  const educationSettlement = settlement?.kind === 'education';
  const descriptionId = 'primitive-education-tradition-conditions';
  return <details className="primitive-processing-tradition-disclosure">
    <summary><strong>공교육 전승 투자</strong><span>{ended ? '런 종료' : tradition.pending
      ? tradition.pending.kind === 'education' ? `${tradition.pending.dueDay}일차 수업 예약` : '다른 공동 작업에 예약됨'
      : canReserve ? '전승 1회 예약 가능' : `학습 전승 ${tradition.availableCharges}회`}</span></summary>
    <div className="primitive-processing-tradition" role="group" aria-label="저장된 공교육 계획의 전승 예약">
      <dl>
        <div><dt>전승 제공자</dt><dd>{tradition.founderName || '활성 학습 전승 없음'}{tradition.modeLabel ? ` · ${tradition.modeLabel}` : ''} · 개인 학습과 공유하는 남은 사용권 {tradition.availableCharges}회</dd></div>
        <div><dt>집행 대원</dt><dd>{tradition.executorName || '활동 대원 없음'}</dd></div>
        <div><dt>다음 아침 대상 · 저장된 계획</dt><dd>{tradition.selectedCivicName || '진행 가능한 제도 없음'} · 교원 상한 {tradition.selectedTeachers}명</dd></div>
        <div><dt>현재 비축 기준 전망</dt><dd>예상 교원 {tradition.teachers}명 · 종이 {education.paperStock === null ? '확인 불가' : `${education.paperStock}장`} · 기본 {tradition.basePoints}CP / 전승 추가 {tradition.bonusPoints}CP 예상</dd></div>
        {tradition.evidenceText ? <div><dt>시조 기여</dt><dd>{tradition.evidenceText}</dd></div> : null}
        <div><dt>예약 비용·조건</dt><dd>{tradition.costText}</dd></div>
        <div><dt>실제 추가 효과·유효기간</dt><dd>{tradition.effectText}</dd></div>
        <div><dt>현재 공유 예약</dt><dd>{tradition.pendingText || '현재 예약 없음'}</dd></div>
        <div><dt>{educationSettlement ? '최근 공교육 전승 정산' : '최근 공유 예약 정산'}</dt><dd>{tradition.lastSettlementText || '전승 정산 미기록'}</dd></div>
        {educationSettlement ? <div><dt>최근 실제 적용 CP</dt><dd>기본 수업 {settlement.basePoints}CP / 전승 추가 {settlement.bonusPoints}CP</dd></div> : null}
      </dl>
      <p id={descriptionId}>입력 중인 초안이 아닌 저장된 교원 계획과 제도에 사용권 1회를 즉시 소비해 예약합니다. 공동 프로젝트·가공대·공교육은 하루 한 건의 예약을 공유합니다. 바로 다음 아침에 같은 계획·제도의 실제 기본 수업이 있어야 전승이 적용됩니다. 계획·대상 변경, 수업 불가, 기한 경과나 취소로 만료되어도 환급하거나 다음 날로 넘기지 않습니다.</p>
      <GameControlButton action="research" cue="off" type="button" disabled={!canReserve}
        aria-describedby={descriptionId} title={canReserve ? tradition.costText : reason}
        onClick={() => { if (canReserve) onReserve(); }}>
        다음 아침 공교육에 전승 1회 예약
      </GameControlButton>
      {tradition.pending?.kind === 'education' ? <GameControlButton action="research" cue="off" type="button" disabled={!canCancel}
        aria-describedby={descriptionId} title="사용권을 돌려받지 않고 예약을 취소합니다. 오늘의 공유 예약은 다시 할 수 없습니다."
        onClick={() => { if (canCancel) onCancel(); }}>예약 취소 · 환급 없음</GameControlButton> : null}
      <p className="primitive-processing-tradition__status">{reason || tradition.summaryText}</p>
    </div>
  </details>;
}

export default function PrimitiveArchiveEducationPlan({ education, runId, onConfigure, blockedReason = '',
  tradition, onReserve, onCancel, hydrated = false, busy = false, ended = false, requirementGuide, onOpenRequirementHelp }) {
  if (!education) return null;
  // Stock and day updates must not discard an unsaved draft.
  return <EducationPlanForm key={JSON.stringify([runId, education.plan.teachers])}
    education={education} onConfigure={onConfigure} blockedReason={blockedReason} tradition={tradition}
    onReserve={onReserve} onCancel={onCancel} hydrated={hydrated} busy={busy} ended={ended}
    requirementGuide={requirementGuide} onOpenRequirementHelp={onOpenRequirementHelp} />;
}
