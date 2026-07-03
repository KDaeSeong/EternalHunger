import { getActorTeamName } from './teamRuntime';
import { getMatchConfig } from './matchRosterRuntime';
import { getRuntimeActorKey } from './runtimeParticipantRuntime';

export function getExportLogLines(fullLogs) {
  const lines = (Array.isArray(fullLogs) ? fullLogs : [])
    .map((line) => String(line || '').trimEnd())
    .filter(Boolean);
  const startIndex = lines.findIndex((line) => /1일차\s*낮|DAY\s*1\s*-\s*DAY/i.test(line));
  return startIndex >= 0 ? lines.slice(startIndex) : lines;
}

export function makeLogFileBaseName({ winner, resultSummary } = {}, ext = 'log') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const winnerName = String(winner?.name || resultSummary?.winnerTeam?.teamName || 'battle').replace(/[\\/:*?"<>|]+/g, '').trim();
  const compactWinner = winnerName ? `-${winnerName.slice(0, 24)}` : '';
  return `eternal-hunger-log${compactWinner}-${stamp}.${ext}`;
}

export function downloadTextFile(filename, text, mimeType) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
  return true;
}

export function buildLogExportSummary({
  lines,
  settings,
  resultSummary,
  runEvents,
  winner,
  killCounts,
  assistCounts,
} = {}) {
  const matchCfg = getMatchConfig(settings);
  const winnerTeam = resultSummary?.winnerTeam || null;
  return {
    exportedAt: new Date().toISOString(),
    title: 'Eternal Hunger Battle Log',
    range: '1일차 낮부터 게임 종료까지',
    logCount: Array.isArray(lines) ? lines.length : 0,
    runEventCount: Array.isArray(runEvents) ? runEvents.length : 0,
    match: {
      mode: matchCfg.matchMode,
      teamSize: matchCfg.teamSize,
      participantsCount: Number(resultSummary?.participantsCount || 0),
      teamCount: Number(resultSummary?.teamCount || 0),
    },
    winner: winner
      ? {
          id: getRuntimeActorKey(winner),
          name: winner.name,
          teamName: winnerTeam?.teamName || getActorTeamName(winner),
          kills: Number(killCounts?.[getRuntimeActorKey(winner)] || resultSummary?.myKills || 0),
          assists: Number(assistCounts?.[getRuntimeActorKey(winner)] || resultSummary?.myAssists || 0),
        }
      : null,
    winnerTeam: winnerTeam
      ? {
          teamId: winnerTeam.teamId || '',
          teamName: winnerTeam.teamName || '',
          aliveCount: Number(winnerTeam.aliveCount || 0),
          originalSize: Number(winnerTeam.originalSize || 0),
          rosterNames: Array.isArray(winnerTeam.rosterNames) ? winnerTeam.rosterNames : [],
        }
      : null,
    lpReward: {
      total: Number(resultSummary?.rewardLP || 0),
      base: Number(resultSummary?.rewardBaseLP || 0),
      predictionBonus: Number(resultSummary?.rewardPredictionBonusLP || 0),
      prediction: resultSummary?.winnerPrediction || null,
    },
  };
}

export function buildMarkdownLogExport(lines, summary) {
  const metaLines = [
    `- 내보낸 시간: ${summary.exportedAt}`,
    `- 범위: ${summary.range}`,
    `- 매치: ${summary.match.mode} / 참가자 ${summary.match.participantsCount}명 / 팀 ${summary.match.teamCount}개`,
    summary.winner ? `- 우승 대표: ${summary.winner.name}${summary.winner.teamName ? ` (${summary.winner.teamName})` : ''}` : '- 우승 대표: 없음',
    summary.winnerTeam ? `- 우승 팀 상태: 생존 ${summary.winnerTeam.aliveCount}/${summary.winnerTeam.originalSize}` : '',
    `- LP 보상: ${summary.lpReward.total} (기본 ${summary.lpReward.base} / 예측 ${summary.lpReward.predictionBonus})`,
    summary.lpReward.prediction?.predictedId
      ? `- 승자 예측: ${summary.lpReward.prediction.predictedName || '선택한 참가자'} / ${summary.lpReward.prediction.correct ? '성공' : '실패'}`
      : '- 승자 예측: 없음',
    `- 로그 수: ${summary.logCount}`,
  ].filter(Boolean);

  const body = (Array.isArray(lines) ? lines : []).map((line) => {
    const text = String(line || '').trim();
    const header = text.match(/^=+\s*(.+?)\s*=+$/);
    if (header) return `\n## ${header[1]}\n`;
    return `- ${text}`;
  }).join('\n');

  return [
    '# Eternal Hunger Battle Log',
    '',
    ...metaLines,
    '',
    '---',
    '',
    body || '_저장할 로그가 없습니다._',
    '',
  ].join('\n');
}
