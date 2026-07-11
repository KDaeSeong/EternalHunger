import { ActionButton, SmallStat, RecentActionResult } from '../../_components/GamePlayPrimitives';
import {
  advancePersonalLeagueAction,
  advanceWinnersLeagueAction,
  startPersonalLeagueAction,
  startWinnersLeagueAction,
} from '../_lib/myAnimeCraftEngine';
import { BroadcastTimeline } from './MyAnimeCraftPlayPanels';

export default function MyAnimeCraftCupsTab(props) {
  const {
    applyStateAction,
    personalRows,
    personalSummary,
    played,
    recentActionText,
    selectedTeam,
    total,
    winnersRows,
    winnersSummary,
  } = props;

  return (
              <>
      <section className="games-detail-grid">

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>개인리그</h2>
            <span>
              {personalSummary.stage === 'NOT_STARTED'
                ? '대기'
                : personalSummary.stage === 'DONE'
                  ? '완료'
                  : personalSummary.phaseLabel || personalSummary.phase}
            </span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="참가" value={`${personalSummary.participants || 0}명`} />
            <SmallStat label="진행" value={`${personalSummary.played}/${personalSummary.total || 0}`} />
            <SmallStat label="우승" value={personalSummary.championName || '-'} />
          </div>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
            {personalSummary.nextMatchLabel || (personalSummary.championName
              ? `${personalSummary.championName} · ${personalSummary.championTeamName}`
              : personalSummary.stage === 'NOT_STARTED'
                ? 'PC방 예선, 듀얼 토너먼트, 32강 듀얼을 거쳐 개인리그 본선으로 이어집니다.'
                : `${personalSummary.phaseLabel || personalSummary.phase} 진행 대기`)}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton action="match" disabled={personalSummary.stage === 'DONE'} onClick={() => applyStateAction('개인리그 진행', (current) => (
              personalSummary.stage === 'NOT_STARTED' ? startPersonalLeagueAction(current) : advancePersonalLeagueAction(current)
            ))}>
              {personalSummary.stage === 'NOT_STARTED' ? '개인리그 시작' : `${personalSummary.phaseLabel || '개인전'} 진행`}
            </ActionButton>
          </div>
          <RecentActionResult label="최근 컵/특별전 결과" text={recentActionText} />
          {personalSummary.stageReports?.length ? (
            <div className="game-save-list" style={{ marginTop: 16 }}>
              {personalSummary.stageReports.map((report) => (
                <article className="game-save-row" key={`${report.phase}-${report.playedAt}`}>
                  <div>
                    <span>{report.label} · 참가 {report.entrantCount}명</span>
                    <strong>{report.summary}</strong>
                    {report.profileText ? <small>{report.profileText}</small> : null}
                    {report.seedText ? <small>시드 분포: {report.seedText}</small> : null}
                    {report.upsetText ? <small>{report.upsetText}</small> : null}
                    <small>진출 {report.qualifierNames.slice(0, 8).join(' / ')}</small>
                  </div>
                  <strong>완료</strong>
                </article>
              ))}
            </div>
          ) : null}
          <div className="game-save-list" style={{ marginTop: 16 }}>
            {personalRows.length ? personalRows.map((match) => (
              <article className="game-save-row" key={match.id}>
                <div>
                  <span>{match.roundLabel} · {match.played ? '완료' : '대기'}</span>
                  <strong>{match.playerAName} {match.played ? match.scoreA : '-'}:{match.played ? match.scoreB : '-'} {match.playerBName}</strong>
                  <small>{match.played ? `승자 ${match.winnerName} · ${match.mapNames.join(' / ')}` : `${match.playerATeamName} vs ${match.playerBTeamName}`}</small>
                  {match.played && match.setDetails?.length ? (
                    <BroadcastTimeline
                      title={match.setDetails[match.setDetails.length - 1].broadcastHeadline || `마지막 세트 중계 · ${match.setDetails[match.setDetails.length - 1].mapName}`}
                      lines={match.setDetails[match.setDetails.length - 1].timeline}
                    />
                  ) : null}
                </div>
                <strong>{match.played ? '결과' : '예정'}</strong>
              </article>
            )) : (
              <div className="games-empty">개인리그 대진이 아직 없습니다.</div>
            )}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>위너스리그</h2>
            <span>
              {winnersSummary.stage === 'NOT_STARTED'
                ? '대기'
                : winnersSummary.stage === 'DONE'
                  ? '완료'
                  : `${winnersSummary.scoreHome}:${winnersSummary.scoreAway}`}
            </span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="HOME" value={winnersSummary.homeTeamName || selectedTeam.name} />
            <SmallStat label="AWAY" value={winnersSummary.awayTeamName || '상위 팀'} />
            <SmallStat label="진행" value={`${winnersSummary.played}/${winnersSummary.total}`} />
            <SmallStat label="우승" value={winnersSummary.championTeamName || '-'} />
          </div>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
            {winnersSummary.nextMatchLabel || (winnersSummary.championTeamName
              ? `${winnersSummary.championTeamName} 우승`
              : '선택한 팀과 상위 팀이 7판 4선 승자연전으로 맞붙습니다.')}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton action="match" disabled={winnersSummary.stage === 'DONE'} onClick={() => applyStateAction('위너스리그 진행', (current) => (
              winnersSummary.stage === 'NOT_STARTED'
                ? startWinnersLeagueAction(current, selectedTeam.id)
                : advanceWinnersLeagueAction(current)
            ))}>
              {winnersSummary.stage === 'NOT_STARTED' ? '위너스리그 시작' : '다음 세트 진행'}
            </ActionButton>
          </div>
          <div className="game-save-list" style={{ marginTop: 16 }}>
            {winnersRows.length ? winnersRows.map((setResult) => (
              <article className="game-save-row" key={setResult.id}>
                <div>
                  <span>{setResult.label} · {setResult.mapName} · 홈 승률 {setResult.probabilityHome}%</span>
                  <strong>{setResult.homePlayerName} vs {setResult.awayPlayerName}</strong>
                  <small>승자 {setResult.winnerPlayerName} · {setResult.homeBuildName} / {setResult.awayBuildName}</small>
                  {setResult.homeBuildReason || setResult.awayBuildReason ? (
                    <small>빌드 근거: {setResult.homeBuildReason || '-'} / {setResult.awayBuildReason || '-'}</small>
                  ) : null}
                  {setResult.keyEventLabel || setResult.tempoLabel ? (
                    <small>핵심 장면: {setResult.keyEventLabel || '-'}{setResult.tempoLabel ? ` · 템포 ${setResult.tempoLabel}` : ''}</small>
                  ) : null}
                  {setResult.broadcastHeadline ? <small>{setResult.broadcastHeadline}</small> : null}
                  {setResult.turningPoint ? <small>{setResult.turningPoint}</small> : null}
                  <BroadcastTimeline lines={setResult.timeline} />
                </div>
                <strong>{setResult.winnerTeamName}</strong>
              </article>
            )) : (
              <div className="games-empty">위너스리그 세트 기록이 아직 없습니다.</div>
            )}
          </div>
        </section>
      </section>
              </>
  );
}
