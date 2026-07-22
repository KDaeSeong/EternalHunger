'use client';

import GameActionIcon from '../../_components/GameActionIcon';
import { getMatchArchiveRows, getPlayedCount, getTeam } from '../_lib/myAnimeCraftEngine';
import { starleagueBroadcastLineAction } from '../_lib/starleaguePresentation';

function formatTimelineTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function BroadcastTimeline({ lines, title = '중계 타임라인' }) {
  if (!Array.isArray(lines) || !lines.length) return null;
  return (
    <details className="games-broadcast-details">
      <summary>
        <GameActionIcon action="replay" label={title} />
        {title}
      </summary>
      <ol className="games-broadcast-timeline">
        {lines.map((line, index) => (
          <li key={`${line.t}-${index}`}>
            <span className="games-broadcast-line-meta">
              <GameActionIcon action={starleagueBroadcastLineAction(line.caster, line.text)} label={line.caster || '중계'} />
              {formatTimelineTime(line.t)} · {line.caster || '중계'}
            </span>
            <p>{line.text}</p>
          </li>
        ))}
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
