'use client';

import { useEffect, useState } from 'react';
import GameActionIcon from '../../_components/GameActionIcon';
import useGameSfx from '../../_lib/useGameSfx';
import { getMatchArchiveRows, getPlayedCount, getTeam } from '../_lib/myAnimeCraftEngine';
import {
  starleagueBroadcastLineCue,
  starleagueBroadcastLinePresentation,
} from '../_lib/starleaguePresentation';

const BROADCAST_PLAYBACK_STEP_MS = 1100;

function formatTimelineTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function timelinePhase(seconds, durationSec) {
  const elapsed = Math.max(0, Number(seconds || 0));
  const duration = Math.max(1, Number(durationSec || 1));
  if (elapsed <= 45) return { key: 'opening', label: '오프닝' };
  const ratio = elapsed / duration;
  if (ratio < 0.36) return { key: 'early', label: '초반' };
  if (ratio < 0.66) return { key: 'mid', label: '중반' };
  if (ratio < 0.93) return { key: 'late', label: '후반' };
  return { key: 'result', label: '결과' };
}

export function BroadcastTimeline({ lines, title = '중계 타임라인', durationSec = 0, defaultOpen = false }) {
  const timelineLines = Array.isArray(lines) ? lines : [];
  const [playbackIndex, setPlaybackIndex] = useState(-1);
  const playGameSfx = useGameSfx({ theme: 'starleague', volume: 0.1 });
  const activeLine = timelineLines[playbackIndex] || null;
  const playbackActive = Boolean(activeLine);

  useEffect(() => {
    if (!activeLine) return undefined;
    playGameSfx(starleagueBroadcastLineCue(activeLine.caster, activeLine.text));
    const timer = window.setTimeout(() => {
      setPlaybackIndex((current) => (
        current >= timelineLines.length - 1 ? -1 : current + 1
      ));
    }, BROADCAST_PLAYBACK_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [activeLine, playGameSfx, timelineLines.length]);

  if (!timelineLines.length) return null;
  return (
    <details className="games-broadcast-details" open={defaultOpen || undefined}>
      <summary data-game-sfx="replay">
        <GameActionIcon action="replay" label={title} />
        {title}
      </summary>
      <div className="games-broadcast-controls">
        <button
          type="button"
          className="game-control-button starleague-broadcast-playback"
          data-game-sfx="off"
          onClick={() => setPlaybackIndex(playbackActive ? -1 : 0)}
        >
          <GameActionIcon action={playbackActive ? 'pause' : 'starleague-broadcast'} label={playbackActive ? '중계 중지' : '중계 재생'} />
          {playbackActive ? '중계 중지' : '중계 재생'}
        </button>
        <span className="games-broadcast-progress" aria-live="polite">
          {playbackActive ? `${playbackIndex + 1}/${timelineLines.length}` : `${timelineLines.length}개 장면`}
        </span>
      </div>
      <ol className="games-broadcast-timeline">
        {timelineLines.map((line, index) => {
          const phase = timelinePhase(line.t, durationSec);
          const linePresentation = starleagueBroadcastLinePresentation(line.caster, line.text);
          const isActive = index === playbackIndex;
          const isPlayed = playbackActive && index < playbackIndex;
          return (
            <li
              key={`${line.t}-${index}`}
              className={isActive ? 'is-broadcast-active' : isPlayed ? 'is-broadcast-played' : ''}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="games-broadcast-line-meta">
                <GameActionIcon action={linePresentation.action} label={linePresentation.label} />
                <span className={`games-broadcast-phase is-${phase.key}`}>{phase.label}</span>
                <span className="games-broadcast-event" data-event={linePresentation.action}>{linePresentation.label}</span>
                {formatTimelineTime(line.t)} · {line.caster || '중계'}
              </span>
              <p>{line.text}</p>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

export function actionFeedbackText(previous, next, label, fallback = '') {
  const beforePlayed = getPlayedCount(previous);
  const afterPlayed = getPlayedCount(next);
  const playedDelta = Math.max(0, afterPlayed - beforePlayed);
  const latestMatch = getMatchArchiveRows(next, 1)[0];
  if (playedDelta > 0 && latestMatch) {
    return `${label}: ${playedDelta}경기 진행 · 최근 ${latestMatch.homeTeamName} ${latestMatch.scoreHome}:${latestMatch.scoreAway} ${latestMatch.awayTeamName} · ${latestMatch.winnerTeamName} 승`;
  }
  if (next.ended && !previous.ended) {
    const champion = next.championTeamId ? getTeam(next, next.championTeamId)?.name : '';
    return `시즌 종료: ${champion || '우승팀'} 우승이 확정되었습니다.`;
  }
  const latestLog = next.log?.[0];
  if (latestLog && latestLog !== previous.log?.[0]) return latestLog;
  return fallback || `${label} 처리했습니다.`;
}
