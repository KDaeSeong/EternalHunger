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
