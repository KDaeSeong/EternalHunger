'use client';

import { useState } from 'react';
import { getHiddenLogCount, getKillLogs, getVisibleLogs } from '../_lib/logPresentation';

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
      {avatar ? <img className="log-avatar" src={avatar} alt="" aria-hidden="true" loading="lazy" /> : null}
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
  const [showKillLogsOnly, setShowKillLogsOnly] = useState(false);
  const visibleLogs = showKillLogsOnly ? getKillLogs(logs) : getVisibleLogs(logs, { detailed });
  const hiddenCount = showKillLogsOnly ? 0 : getHiddenLogCount(logs, visibleLogs, { detailed });
  const visiblePrevLogs = showKillLogsOnly ? getKillLogs(prevPhaseLogs) : getVisibleLogs(prevPhaseLogs, { detailed });
  const hiddenPrevCount = showKillLogsOnly ? 0 : getHiddenLogCount(prevPhaseLogs, visiblePrevLogs, { detailed });
  const forbiddenSet = forbiddenNow instanceof Set ? forbiddenNow : new Set();
  const currentKillCount = showKillLogsOnly ? visibleLogs.length : 0;
  const prevKillCount = showKillLogsOnly ? visiblePrevLogs.length : 0;

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
            {showKillLogsOnly ? '킬 로그' : (detailed ? '전체 로그' : '요약 로그')}
            {showKillLogsOnly ? ` · ${currentKillCount}개` : (!detailed && hiddenCount > 0 ? ` · ${hiddenCount}개 숨김` : '')}
          </span>
          <div className="log-toolbar-actions">
            <button
              type="button"
              className={`log-toggle-btn ${showKillLogsOnly ? 'active' : ''}`}
              onClick={() => setShowKillLogsOnly((v) => !v)}
              title="전투 처치와 킬 관련 로그만 따로 봅니다."
            >
              킬 로그
            </button>
            <button
              type="button"
              className="log-toggle-btn"
              onClick={() => setShowDetailedLogs((v) => !v)}
              title="요약은 킬, 사망, 제작, 전투, 금지구역 같은 핵심 이벤트만 보여줍니다."
              disabled={showKillLogsOnly}
            >
              {detailed ? '요약 보기' : '전체 보기'}
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
              {showKillLogsOnly ? ` (${prevKillCount}개)` : (!detailed && hiddenPrevCount > 0 ? ` (${hiddenPrevCount}개 숨김)` : '')}
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
              {showKillLogsOnly && !visiblePrevLogs.length ? (
                <div className="log-empty-state">이전 페이즈에 표시할 킬 로그가 없습니다.</div>
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
          {showKillLogsOnly && !visibleLogs.length ? (
            <div className="log-empty-state">표시할 킬 로그가 없습니다.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
