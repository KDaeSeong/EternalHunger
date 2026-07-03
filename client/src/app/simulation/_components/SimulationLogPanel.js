'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  getCombatDetailLogs,
  getHiddenLogCount,
  getKillLogs,
  getVisibleLogs,
} from '../_lib/logPresentation';

const LOG_VIEW = {
  SUMMARY: 'summary',
  KILL: 'kill',
  COMBAT: 'combat',
};

function LogMessage({ log, actorAvatarByName, extractActorNameFromLog, prefix = '' }) {
  const who = extractActorNameFromLog ? extractActorNameFromLog(log.text) : '';
  const avatar = who ? actorAvatarByName?.[who] : '';

  return (
    <div
      className={`log-message ${log.type || 'system'}`}
      style={{
        maxWidth: '100%',
        whiteSpace: 'pre-line',
        overflowWrap: 'anywhere',
        wordBreak: 'keep-all',
        lineHeight: 1.45,
      }}
    >
      {avatar ? (
        <Image
          className="log-avatar"
          src={avatar}
          alt=""
          width={44}
          height={44}
          aria-hidden="true"
          loading="lazy"
          unoptimized
        />
      ) : null}
      <div className="log-text">{prefix}{log.text}</div>
    </div>
  );
}

export default function SimulationLogPanel({
  uiModal,
  closeUiModal,
  day,
  activeMap,
  zones,
  forbiddenNow,
  forbiddenAddedNow,
  settings,
  getRuleset,
  getZoneName,
  prevPhaseLogs,
  showPrevLogs,
  setShowPrevLogs,
  logs,
  showDetailedLogs,
  setShowDetailedLogs,
  logWindowRef,
  logBoxRef,
  logBoxMaxH,
  actorAvatarByName,
  extractActorNameFromLog,
}) {
  const detailed = !!showDetailedLogs;
  const [logViewMode, setLogViewMode] = useState(() => (detailed ? LOG_VIEW.COMBAT : LOG_VIEW.SUMMARY));
  const isKillView = logViewMode === LOG_VIEW.KILL;
  const isCombatView = logViewMode === LOG_VIEW.COMBAT;
  const visibleLogs = isKillView
    ? getKillLogs(logs)
    : isCombatView
      ? getCombatDetailLogs(logs)
      : getVisibleLogs(logs, { detailed: false });
  const hiddenCount = logViewMode === LOG_VIEW.SUMMARY ? getHiddenLogCount(logs, visibleLogs, { detailed: false }) : 0;
  const visiblePrevLogs = isKillView
    ? getKillLogs(prevPhaseLogs)
    : isCombatView
      ? getCombatDetailLogs(prevPhaseLogs)
      : getVisibleLogs(prevPhaseLogs, { detailed: false });
  const hiddenPrevCount = logViewMode === LOG_VIEW.SUMMARY ? getHiddenLogCount(prevPhaseLogs, visiblePrevLogs, { detailed: false }) : 0;
  const forbiddenSet = forbiddenNow instanceof Set ? forbiddenNow : new Set();
  const currentKillCount = isKillView ? visibleLogs.length : 0;
  const prevKillCount = isKillView ? visiblePrevLogs.length : 0;
  const currentCombatCount = isCombatView ? visibleLogs.length : 0;

  const selectLogMode = (mode) => {
    setLogViewMode(mode);
    setShowDetailedLogs(mode === LOG_VIEW.COMBAT);
  };

  return (
    <div className={`log-window ${uiModal === 'log' ? 'modal-open' : ''}`} ref={logWindowRef} style={{ minWidth: 0 }}>
      {uiModal === 'log' ? (
        <button className="eh-modal-close" onClick={closeUiModal} aria-label="닫기">x</button>
      ) : null}

      <div className="log-content">
        {day > 0 && (
          <div className="log-top-status">
            <div className="log-top-row">
              <span className="log-top-label">금지구역</span>
              <span className="log-top-value">
                {forbiddenSet.size ? Array.from(forbiddenSet).map((z) => getZoneName(z)).join(', ') : '없음'}
              </span>
            </div>
            {forbiddenSet.size ? (
              <div className="log-top-sub">
                {(() => {
                  const total = Array.isArray(activeMap?.zones) ? activeMap.zones.length : (Array.isArray(zones) ? zones.length : 0);
                  const safeLeft = Math.max(0, total - forbiddenSet.size);
                  const detForceAll = Math.max(0, Number(getRuleset(settings?.rulesetId)?.detonation?.forceAllAfterSec ?? 40));
                  const extra = safeLeft <= 2 ? ` · 안전구역 2곳 이하 → ${detForceAll}s 후 강제 교전 위험` : '';
                  return `안전구역 ${safeLeft}곳 남음${extra}`;
                })()}
              </div>
            ) : null}
            {Array.isArray(forbiddenAddedNow) && forbiddenAddedNow.length ? (
              <div className="log-top-sub">이번 페이즈 신규: {forbiddenAddedNow.map((z) => getZoneName(z)).join(', ')}</div>
            ) : null}
          </div>
        )}

        <div className="log-toolbar">
          <span className="log-toolbar-title">
            {isKillView ? '킬 로그' : (isCombatView ? '전투 상세' : '요약 로그')}
            {isKillView ? ` · ${currentKillCount}개` : ''}
            {isCombatView ? ` · ${currentCombatCount}개` : ''}
            {logViewMode === LOG_VIEW.SUMMARY && hiddenCount > 0 ? ` · ${hiddenCount}개 숨김` : ''}
          </span>
          <div className="log-toolbar-actions">
            <button
              type="button"
              className={`log-toggle-btn ${logViewMode === LOG_VIEW.SUMMARY ? 'active' : ''}`}
              onClick={() => selectLogMode(LOG_VIEW.SUMMARY)}
              title="핵심 이벤트만 간단히 봅니다."
            >
              요약
            </button>
            <button
              type="button"
              className={`log-toggle-btn ${isKillView ? 'active' : ''}`}
              onClick={() => selectLogMode(LOG_VIEW.KILL)}
              title="처치 결과만 따로 봅니다."
            >
              킬
            </button>
            <button
              type="button"
              className={`log-toggle-btn ${isCombatView ? 'active' : ''}`}
              onClick={() => selectLogMode(LOG_VIEW.COMBAT)}
              title="장비, 스킬, 피해량 같은 전투 계산 로그를 봅니다."
            >
              전투 상세
            </button>
          </div>
        </div>

        {Array.isArray(prevPhaseLogs) && prevPhaseLogs.length ? (
          <div className="prevlogs-row">
            <button
              className="prevlogs-btn"
              onClick={() => setShowPrevLogs((v) => !v)}
              title="이전 페이즈 로그를 펼치거나 숨깁니다."
            >
              {showPrevLogs ? '이전 페이즈 로그 숨기기' : '이전 페이즈 로그 보기'}
              {isKillView ? ` (${prevKillCount}개)` : (logViewMode === LOG_VIEW.SUMMARY && hiddenPrevCount > 0 ? ` (${hiddenPrevCount}개 숨김)` : '')}
            </button>
          </div>
        ) : null}

        {showPrevLogs && Array.isArray(prevPhaseLogs) && prevPhaseLogs.length ? (
          <div className="prevlogs-box">
            <div className="prevlogs-scroll">
              {visiblePrevLogs.map((log, idx) => (
                <LogMessage
                  key={`prev-${log.id || idx}`}
                  log={log}
                  actorAvatarByName={actorAvatarByName}
                  extractActorNameFromLog={extractActorNameFromLog}
                />
              ))}
              {(isKillView || isCombatView) && !visiblePrevLogs.length ? (
                <div className="log-empty-state">이전 페이즈에 표시할 {isKillView ? '킬 로그' : '전투 상세 로그'}가 없습니다.</div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="log-scroll-area" ref={logBoxRef} style={{ maxHeight: logBoxMaxH }}>
          {visibleLogs.map((log, idx) => (
            <LogMessage
              key={log.id || idx}
              log={log}
              actorAvatarByName={actorAvatarByName}
              extractActorNameFromLog={extractActorNameFromLog}
            />
          ))}
          {(isKillView || isCombatView) && !visibleLogs.length ? (
            <div className="log-empty-state">표시할 {isKillView ? '킬 로그' : '전투 상세 로그'}가 없습니다.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
