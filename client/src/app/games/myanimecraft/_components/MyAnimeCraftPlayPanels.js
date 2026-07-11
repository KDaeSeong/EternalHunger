'use client';

import { getMatchArchiveRows, getPlayedCount, getTeam } from '../_lib/myAnimeCraftEngine';

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
      <summary>{title}</summary>
      <ol className="games-broadcast-timeline">
        {lines.map((line, index) => (
          <li key={`${line.t}-${index}`}>
            <span>{formatTimelineTime(line.t)} · {line.caster || '중계'}</span>
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

export function starleagueFeedbackSnapshot(state) {
  const latestMatch = getMatchArchiveRows(state, 1)[0];
  const personalMatches = Array.isArray(state?.personalLeague?.matches) ? state.personalLeague.matches : [];
  const winnersSets = Array.isArray(state?.winnersLeague?.sets) ? state.winnersLeague.sets : [];
  return {
    runId: String(state?.runId || ''),
    seasonNo: Number(state?.seasonNo || 1),
    regularPlayed: getPlayedCount(state),
    personalPlayed: personalMatches.filter((match) => match?.played).length,
    personalStage: String(state?.personalLeague?.stage || 'NOT_STARTED'),
    winnersPlayed: winnersSets.length,
    winnersStage: String(state?.winnersLeague?.stage || 'NOT_STARTED'),
    ended: Boolean(state?.ended),
    latestMatchId: String(latestMatch?.id || ''),
    latestWinnerTeamId: String(latestMatch?.winnerTeamId || ''),
    latestHomeTeamId: String(latestMatch?.homeTeamId || ''),
    latestAwayTeamId: String(latestMatch?.awayTeamId || ''),
  };
}

export function starleagueFeedbackCue(previous, current, selectedTeamId = '') {
  if (!previous || !current || previous.runId !== current.runId) return '';
  if (!previous.ended && current.ended) return 'champion';
  if (previous.personalStage !== 'DONE' && current.personalStage === 'DONE') return 'champion';
  if (previous.winnersStage !== 'DONE' && current.winnersStage === 'DONE') return 'champion';
  if (current.regularPlayed > previous.regularPlayed) {
    const teamId = String(selectedTeamId || '');
    const involved = teamId && [current.latestHomeTeamId, current.latestAwayTeamId].includes(teamId);
    if (!involved) return 'match';
    return current.latestWinnerTeamId === teamId ? 'victory' : 'defeat';
  }
  if (current.personalPlayed > previous.personalPlayed || current.winnersPlayed > previous.winnersPlayed) return 'match';
  if (current.seasonNo > previous.seasonNo) return 'season';
  return '';
}
