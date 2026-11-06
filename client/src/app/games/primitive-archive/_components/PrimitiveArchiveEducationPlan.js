'use client';

import { useState } from 'react';
import { GameControlButton } from '../../_components/GamePlayPrimitives';

function EducationPlanForm({ education, onConfigure, blockedReason }) {
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
    <p>종이·진행할 제도·인원이 부족해 수업에 쓰이지 않은 기록대 일손은 일반 연구로 돌아갑니다. 가공대 제지(나무 1개 + 섬유 1개 → 종이 2장)는 제지 연구와 실제 가공 계획·일손이 필요합니다. 같은 아침 뒤에 생산한 종이는 다음 날 교육부터 사용합니다.</p>
  </div>;
}

export default function PrimitiveArchiveEducationPlan({ education, runId, onConfigure, blockedReason = '' }) {
  if (!education) return null;
  // Stock and day updates must not discard an unsaved draft.
  return <EducationPlanForm key={JSON.stringify([runId, education.plan.teachers])}
    education={education} onConfigure={onConfigure} blockedReason={blockedReason} />;
}
