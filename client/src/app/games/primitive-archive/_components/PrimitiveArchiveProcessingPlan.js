'use client';

import { useState } from 'react';
import { GameControlButton } from '../../_components/GamePlayPrimitives';
import { isValidTribeProcessingPlan } from '../_lib/primitiveArchiveProcessing';

function ProcessingPlanForm({ processing, onConfigure, blockedReason }) {
  const { plan, options = [] } = processing;
  const [actionId, setActionId] = useState(plan.actionId);
  const [targetStock, setTargetStock] = useState(String(plan.targetStock));
  const selected = options.find(option => option.id === actionId);
  const patch = { actionId, targetStock: actionId ? Number(targetStock) : 0 };
  const valid = (actionId === '' || targetStock.trim() !== '') && isValidTribeProcessingPlan(patch);
  const unchanged = patch.actionId === plan.actionId && patch.targetStock === plan.targetStock;
  const controlsBlocked = Boolean(blockedReason) || !processing.canConfigure || typeof onConfigure !== 'function';
  const submitBlocked = controlsBlocked || !valid || unchanged;
  const reason = blockedReason || (!processing.canConfigure ? processing.blockedReason : '') || '';

  return (
    <form className="primitive-processing-plan" aria-label="가공대 생산 계획"
      onSubmit={(event) => {
        event.preventDefault();
        if (!submitBlocked) onConfigure(patch);
      }}>
      <label>
        <span>공정</span>
        <select value={actionId} disabled={controlsBlocked} aria-describedby="primitive-processing-plan-help"
          onChange={(event) => {
            const nextActionId = event.target.value;
            setActionId(nextActionId);
            if (!nextActionId) setTargetStock('0');
            else if (!Number.isSafeInteger(Number(targetStock)) || Number(targetStock) <= 0) setTargetStock('1');
          }}>
          <option value="">가동 안 함</option>
          {options.map(option => (
            <option value={option.id} key={option.id}>{option.label}{option.unlocked ? '' : ' · 연구 필요'}</option>
          ))}
        </select>
      </label>
      <label>
        <span>목표 비축 · 산출품 개수</span>
        <input type="number" inputMode="numeric" min={actionId ? 1 : 0} max={Number.MAX_SAFE_INTEGER} step="1"
          required={Boolean(actionId)} value={targetStock} disabled={controlsBlocked || !actionId}
          aria-describedby="primitive-processing-plan-help"
          onChange={(event) => setTargetStock(event.target.value)} />
      </label>
      <GameControlButton action="craft" cue="off" type="submit" disabled={submitBlocked}
        aria-describedby="primitive-processing-plan-help" title={reason || (!valid ? '목표 비축은 양의 정수여야 합니다.' : unchanged ? '현재 저장된 계획입니다.' : '공정과 목표 비축을 함께 저장합니다.')}>
        설정 적용
      </GameControlButton>
      <p id="primitive-processing-plan-help" className="primitive-processing-plan__help">
        설정은 AP를 쓰지 않으며 지금 재료를 소비하거나 생산하지 않습니다. 가공대는 직접 배치한 일손만 사용합니다.
        목표 비축에 도달하면 멈추며, 묶음 단위 생산으로 목표를 넘길 수 있습니다.
      </p>
      {selected ? <p className="primitive-processing-plan__selection">
        선택 공정 · 투입 {selected.costText} → 산출 {selected.outputText}
        {!selected.unlocked ? ` · ${selected.lockedReason} · 미래 계획으로 저장할 수 있습니다.` : ''}
      </p> : null}
      {reason ? <p className="primitive-processing-plan__reason">{reason}</p> : null}
      <div className="primitive-processing-plan__preview" aria-label="저장된 가공 계획의 현재 비축 기준 전망">
        <strong>저장된 계획 · 현재 비축 기준 전망</strong>
        <span>실제 배치 {processing.workers}명 · 현재 산출품 비축 {processing.currentStock === null ? '확인 불가' : `${processing.currentStock}개`}</span>
        <span>예상 {processing.expectedBatches}묶음 · 산출 {processing.expectedOutput}개</span>
        {plan.actionId ? <span>1묶음 투입 {processing.costText} → 산출 {processing.outputText}</span> : null}
        <span>{processing.statusText}</span>
        <small>{processing.timingText}</small>
      </div>
    </form>
  );
}

export default function PrimitiveArchiveProcessingPlan({ processing, runId, onConfigure, blockedReason = '' }) {
  if (!processing) return null;
  const { plan } = processing;
  // Reset drafts only when the saved plan or run changes, not on stock/day updates.
  return <ProcessingPlanForm key={JSON.stringify([runId, plan.actionId, plan.targetStock])}
    processing={processing} onConfigure={onConfigure} blockedReason={blockedReason} />;
}

export function PrimitiveArchiveProcessingTradition({ tradition, processing, actor, hydrated = false, busy = false,
  ended = false, onReserve }) {
  if (!tradition || !processing) return null;
  const selected = processing.options?.find(option => option.id === tradition.selectedActionId);
  const canReserve = hydrated && !busy && !ended && tradition.enabled && tradition.canReserve
    && typeof onReserve === 'function';
  const reason = !hydrated ? '진행 기록 확인이 끝난 뒤 예약할 수 있습니다.'
    : busy ? '저장 또는 진행 보호 작업 중에는 예약할 수 없습니다.'
      : ended ? '종료된 런에서는 전승을 예약할 수 없습니다.' : tradition.reason || '';
  const processingRecords = (tradition.records || []).filter(record => record.kind === 'processing' || record.actionId);
  const projectPending = tradition.pending && tradition.pending.kind !== 'processing';
  const projectSettlement = tradition.lastSettlement && tradition.lastSettlement.kind !== 'processing';
  const descriptionId = 'primitive-processing-tradition-conditions';
  return <details className="primitive-processing-tradition-disclosure">
    <summary><strong>가공대 전승 투자</strong><span>{ended ? '런 종료' : tradition.pending
      ? tradition.pending.kind === 'processing' ? `${tradition.pending.dueDay}일차 가공 예약` : '공동 사업에 예약됨'
      : canReserve ? '전승 1회 예약 가능' : `제작·건설 전승 ${tradition.availableCharges}회`}</span></summary>
    <div className="primitive-processing-tradition" role="group" aria-label="저장된 가공 계획의 전승 예약">
    <dl>
      <div><dt>전승 제공자</dt><dd>{tradition.founderName || '활성 제작·건설 전승 없음'}{tradition.modeLabel ? ` · ${tradition.modeLabel}` : ''} · 개인 제작과 공유하는 실제 남은 횟수 {tradition.availableCharges}</dd></div>
      <div><dt>집행 대원</dt><dd>{tradition.executorName || actor?.name || '활동 대원 없음'}</dd></div>
      <div><dt>예약 대상 · 적용된 계획</dt><dd>{selected ? `${selected.label} · 목표 비축 ${tradition.selectedTargetStock}개` : '저장된 가공 계획 없음'}</dd></div>
      <div><dt>실제 일손·재료</dt><dd>가공대 {processing.workers}명 · 1묶음 투입 {processing.costText || '공정 선택 필요'} → 산출 {processing.outputText || '공정 선택 필요'}</dd></div>
      {tradition.evidenceText ? <div><dt>시조 기여</dt><dd>{tradition.evidenceText}</dd></div> : null}
      <div><dt>예약 비용·조건</dt><dd>{tradition.costText}</dd></div>
      <div><dt>실제 추가 효과·유효기간</dt><dd>{tradition.effectText}</dd></div>
      <div><dt>{projectPending ? '현재 공유 예약 · 공동 프로젝트' : '현재 예약'}</dt><dd>{tradition.pendingText || '현재 예약 없음'}</dd></div>
      <div><dt>{projectSettlement ? '최근 공유 예약 정산 · 공동 프로젝트' : tradition.lastSettlement ? '최근 실제 가공 전승 정산' : '전승 정산 안내'}</dt><dd>{tradition.lastSettlementText || '가공 전승 정산 미기록'}</dd></div>
    </dl>
    <p id={descriptionId}>공동 프로젝트와 가공대 예약은 하루 한 건을 공유합니다. 입력 중인 초안이 아닌 적용된 생산 계획에 사용권 1회를 맡깁니다. 예약한 대상은 나중에 계획을 바꿔도 옮겨지거나 환급되지 않습니다.</p>
    <GameControlButton action="primitive-kiln" cue="off" type="button" disabled={!canReserve}
      aria-describedby={descriptionId} title={canReserve ? tradition.costText : reason}
      onClick={() => { if (canReserve) onReserve(); }}>
      다음 아침 {selected?.label || '가공대'}에 전승 1회 예약
    </GameControlButton>
    <p className="primitive-processing-tradition__status">{reason || tradition.summaryText}</p>
    {processingRecords.length ? <div className="primitive-processing-tradition__records" aria-label="가공에 남은 실제 시조 기여">
      <strong>실제 가공에 남은 전승</strong>
      <ul>{processingRecords.map((record, index) => <li key={`${record.founderId}:${record.actionId}:${index}`}>{record.text}</li>)}</ul>
    </div> : null}
    </div>
  </details>;
}
