'use client';

import { useState } from 'react';
import { GameControlButton } from '../../_components/GamePlayPrimitives';

const destinations = {
  actions: { action: 'gather', label: '식량 확보' },
  camp: { action: 'camp', label: '캠프 확인' },
  tribe: { action: 'primitive-job', label: '직업 배치 확인' },
};

export default function PrimitiveArchiveOperationsSummary({ operations, onNavigate, blocked = false }) {
  const [expanded, setExpanded] = useState(false);
  if (!operations) return null;
  const ended = Boolean(operations.ended);
  const issues = ended ? [] : operations.issues || [];
  const investments = ended ? [] : operations.investments || [];
  const focusSummary = (event) => {
    event?.currentTarget?.closest('.primitive-operations')?.querySelector('summary')?.focus();
  };
  const navigate = (tabId, event) => {
    if (blocked || !Object.hasOwn(destinations, tabId)) return;
    setExpanded(false);
    focusSummary(event);
    onNavigate?.(tabId);
  };
  const close = (event) => {
    setExpanded(false);
    focusSummary(event);
  };

  return (
    <section className="primitive-operations" aria-label="정착 운영 요약" data-tone={operations.tone}>
      <details className="primitive-operations__details" open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          close(event);
        }}>
        <summary aria-expanded={expanded}>
          <strong>{ended ? '운영 종료' : operations.enabled ? '정착 운영' : '정착 준비'}</strong>
          <span className="primitive-operations__summary" title={operations.summaryText}>{operations.summaryText}</span>
          <span className="primitive-operations__toggle">{expanded ? '접기' : '상세'}</span>
        </summary>
        <div className="primitive-operations__body" role="region" aria-label="정착 운영 상세">
          <div className="primitive-operations__heading">
            <strong>{ended ? '종료된 운영 기록' : '정착 운영 상세'}</strong>
            <GameControlButton action="cancel" cue="off" onClick={close}>운영 상세 닫기</GameControlButton>
          </div>
          {operations.timingText ? <div className="primitive-operations__timing">{operations.timingText}</div> : null}
          <dl className="primitive-operations__rows">
            {(operations.rows || []).map((row) => (
              <div key={row.id}><dt>{row.title}</dt><dd>{row.text}</dd></div>
            ))}
          </dl>
          {investments.length ? (
            <div className="primitive-operations__investments" aria-label="생산 이후의 일손 투자">
              {investments.map((investment) => (
                <div key={investment.id} data-available={Boolean(investment.available)}>
                  <strong>{investment.title}</strong>
                  <span>{investment.text}</span>
                  {investment.reason ? <small>{investment.reason}</small> : null}
                </div>
              ))}
            </div>
          ) : null}
          {!ended ? (
            <GameControlButton action="primitive-job" cue="off" disabled={blocked}
              onClick={(event) => navigate('tribe', event)}>직업 배치 열기</GameControlButton>
          ) : null}
        </div>
      </details>
      {issues.length ? (
        <ul className="primitive-operations__issues" aria-label="현재 운영 주의사항">
          {issues.map((issue) => {
            const destination = Object.hasOwn(destinations, issue.tabId) ? destinations[issue.tabId] : null;
            return (
              <li key={issue.id}>
                <span>{issue.text}</span>
                {destination ? (
                  <GameControlButton action={destination.action} cue="off" disabled={blocked}
                    onClick={(event) => navigate(issue.tabId, event)}>{destination.label}</GameControlButton>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
