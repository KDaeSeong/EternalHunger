import GameActionIcon from '../../_components/GameActionIcon';
import { ActionButton, SmallStat, RecentActionResult } from '../../_components/GamePlayPrimitives';
import {
  BUILD_STYLE_LABELS,
  fixtureLabel,
  simulateNextMatchAction,
  simulateSeasonAction,
  simulateWeekAction,
  startNextSeasonAction,
} from '../_lib/myAnimeCraftEngine';
import { starleagueBuildAction } from '../_lib/starleaguePresentation';
import { BroadcastTimeline } from './MyAnimeCraftPlayPanels';
import { MyAnimeCraftIconRow, MyAnimeCraftPanelTitle } from './MyAnimeCraftVisuals';

function formatSetDuration(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}분 ${String(rest).padStart(2, '0')}초`;
}

function winningBuildStyle(match, setResult) {
  return String(setResult?.winnerTeamId || '') === String(match?.homeTeamId || '')
    ? setResult?.homeBuildStyle
    : setResult?.awayBuildStyle;
}

export default function MyAnimeCraftLeagueTab(props) {
  const {
    applyStateAction,
    broadcastSignal,
    buildMetaReport,
    currentFixtures,
    ended,
    matchArchiveRows,
    played,
    postseasonBriefing,
    postseasonRows,
    recentActionText,
    resultPresentation,
    rivalryReport,
    seasonStage,
    selectedArchiveMatch,
    seriesReplayReport,
    setSelectedArchiveMatchId,
    sourceSummary,
    state,
    total,
  } = props;

  return (
              <>
      <section className="games-detail-grid">
        <section className="games-panel starleague-league-main">
          <MyAnimeCraftPanelTitle action="match" title="진행" meta={seasonStage.label} />
          <div className={`starleague-broadcast-signal is-${broadcastSignal.tone}`} role="status" aria-live="polite">
            <GameActionIcon action={broadcastSignal.action} label={broadcastSignal.label} />
            <span>
              <strong>{broadcastSignal.label}</strong>
              <small>{broadcastSignal.detail}</small>
            </span>
            <em>LIVE</em>
          </div>
          <div className="games-rank-split">
            <SmallStat label="원본 팀" value={sourceSummary.teams} />
            <SmallStat label="원본 맵" value={sourceSummary.maps} />
            <SmallStat label="사용 맵" value={sourceSummary.importedMaps} />
            <SmallStat label="포스트시즌" value={seasonStage.postseasonTotal ? `${seasonStage.postseasonPlayed}/${seasonStage.postseasonTotal}` : '대기'} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton action="match" cue="off" disabled={ended} onClick={() => applyStateAction('다음 경기 진행', (current) => simulateNextMatchAction(current), { selectLatestMatch: true })}>다음 경기 진행</ActionButton>
            <ActionButton action="match" cue="off" disabled={ended} onClick={() => applyStateAction('이번 주 전체 진행', (current) => simulateWeekAction(current), { selectLatestMatch: true })}>이번 주 전체 진행</ActionButton>
            <ActionButton action="match" cue="off" disabled={ended} onClick={() => applyStateAction('시즌 끝까지 진행', (current) => simulateSeasonAction(current), { selectLatestMatch: true })}>시즌 끝까지 진행</ActionButton>
            <ActionButton action="new" cue="off" disabled={!ended} onClick={() => applyStateAction('다음 시즌 시작', (current) => startNextSeasonAction(current), { clearArchiveSelection: true })}>다음 시즌 시작</ActionButton>
          </div>
          <RecentActionResult action={resultPresentation.action} label={resultPresentation.label} text={recentActionText} tone={resultPresentation.tone} pinned />
          {matchArchiveRows.length ? (
            <div className="game-save-list" style={{ marginTop: 16 }}>
              {matchArchiveRows.slice(0, 6).map((match) => (
                <MyAnimeCraftIconRow
                  action="replay"
                  as="button"
                  label={`${match.homeTeamName} 대 ${match.awayTeamName} 다시보기`}
                  type="button"
                  data-game-sfx="select"
                  key={match.id}
                  onClick={() => setSelectedArchiveMatchId(match.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    borderColor: selectedArchiveMatch?.id === match.id ? 'rgba(56, 189, 248, 0.7)' : undefined,
                  }}
                >
                  <div>
                    <span>{match.stageLabel} · {match.setCount}세트{match.aceSetLabel ? ' · 에이스전' : ''}</span>
                    <strong>{match.homeTeamName} {match.scoreHome}:{match.scoreAway} {match.awayTeamName}</strong>
                  </div>
                  <strong>{match.winnerTeamName}</strong>
                </MyAnimeCraftIconRow>
              ))}
            </div>
          ) : null}
          {selectedArchiveMatch ? (
            <div className="games-activity-list" style={{ marginTop: 16 }}>
              <div>
                <strong>경기 다시보기 · {selectedArchiveMatch.stageLabel}</strong>
                <span>{selectedArchiveMatch.homeTeamName} {selectedArchiveMatch.scoreHome}:{selectedArchiveMatch.scoreAway} {selectedArchiveMatch.awayTeamName}</span>
              </div>
              <div style={{ display: 'grid', gap: 10, padding: '4px 0' }}>
                <MyAnimeCraftPanelTitle action="analysis" title="시리즈 총평" meta={seriesReplayReport.tempoLabel} />
                <p style={{ color: '#5f6c78', fontWeight: 850, lineHeight: 1.5, margin: 0 }}>
                  {seriesReplayReport.headline}
                </p>
                <div className="games-rank-split games-rank-split--compact">
                  <SmallStat label="승부처" value={seriesReplayReport.keySetLabel} />
                  <SmallStat label="대표 빌드" value={seriesReplayReport.styleLabel} />
                  <SmallStat label="맵 폭" value={seriesReplayReport.mapLabel} />
                </div>
                <div className="game-save-list">
                  {seriesReplayReport.highlights.map((line, index) => (
                    <MyAnimeCraftIconRow action="replay" label={`리플레이 포인트 ${index + 1}`} key={`series-replay-${selectedArchiveMatch.id}-${index}`}>
                      <div>
                        <span>리플레이 포인트 {index + 1}</span>
                        <strong>{line}</strong>
                      </div>
                    </MyAnimeCraftIconRow>
                  ))}
                </div>
              </div>
              {selectedArchiveMatch.sets.map((setResult, setIndex) => (
                <div className="starleague-set-replay" key={`${selectedArchiveMatch.matchId}-${setResult.setNo}`}>
                  <strong>
                    {setResult.setNo}세트{setResult.isAceSet ? ' · 에이스전' : ''} · {setResult.mapName} · {setResult.homePlayerName} {BUILD_STYLE_LABELS[setResult.homeBuildStyle] || setResult.homeBuildStyle}
                    {' vs '}
                    {setResult.awayPlayerName} {BUILD_STYLE_LABELS[setResult.awayBuildStyle] || setResult.awayBuildStyle}
                  </strong>
                  <span className="starleague-set-context">
                    <GameActionIcon action={starleagueBuildAction(winningBuildStyle(selectedArchiveMatch, setResult))} label="승리 빌드" />
                    {setResult.homeBuildName} / {setResult.awayBuildName} · {formatSetDuration(setResult.durationSec)}
                    {setResult.tempoLabel ? ` · ${setResult.tempoLabel}` : ''}
                  </span>
                  <details className="starleague-sim-details">
                    <summary data-game-sfx="select">
                      <GameActionIcon action="analysis" label="시뮬레이션 분석" />
                      시뮬레이션 분석
                    </summary>
                    <dl>
                      <div><dt>홈 사전 승률</dt><dd>{setResult.probabilityHome}%</dd></div>
                      <div><dt>맵 보정</dt><dd>{setResult.mapBiasHome >= 0 ? '+' : ''}{setResult.mapBiasHome}%</dd></div>
                      <div><dt>변동 폭</dt><dd>{setResult.noiseAmp}</dd></div>
                      {setResult.isAceSet ? (
                        <div><dt>에이스 보정</dt><dd>{setResult.aceBoostHome >= 0 ? '+' : ''}{setResult.aceBoostHome}% / {setResult.aceBoostAway >= 0 ? '+' : ''}{setResult.aceBoostAway}%</dd></div>
                      ) : null}
                    </dl>
                    {setResult.homeBuildReason || setResult.awayBuildReason ? (
                      <p>빌드 근거 · {setResult.homeBuildReason || '-'} / {setResult.awayBuildReason || '-'}</p>
                    ) : null}
                  </details>
                  {setResult.keyEventLabel || setResult.tempoLabel ? (
                    <small>
                      핵심 장면: {setResult.keyEventLabel || '-'}{setResult.tempoLabel ? ` · 템포 ${setResult.tempoLabel}` : ''}
                    </small>
                  ) : null}
                  {setResult.broadcastHeadline ? <span>{setResult.broadcastHeadline}</span> : null}
                  {setResult.turningPoint ? <small>{setResult.turningPoint}</small> : null}
                  <BroadcastTimeline
                    lines={setResult.timeline}
                    durationSec={setResult.durationSec}
                    defaultOpen={setIndex === selectedArchiveMatch.sets.length - 1}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="games-panel">
          <MyAnimeCraftPanelTitle action="analysis" title="포스트시즌 브리핑" meta={postseasonBriefing.sampleLabel} />
          <p style={{ color: '#5f6c78', fontWeight: 850, lineHeight: 1.5, margin: 0 }}>
            {postseasonBriefing.headline}
          </p>
          <div className="games-rank-split games-rank-split--compact">
            {postseasonBriefing.focusRows.map((row) => (
              <SmallStat key={`${row.label}-${row.value}`} label={row.label} value={row.value} />
            ))}
          </div>
          <div className="game-save-list">
            {postseasonBriefing.storyLines.length ? postseasonBriefing.storyLines.map((line, index) => (
              <MyAnimeCraftIconRow action="advisor" label={`포스트시즌 브리핑 ${index + 1}`} key={`postseason-brief-${index}`}>
                <div>
                  <span>브리핑 {index + 1}</span>
                  <strong>{line}</strong>
                </div>
              </MyAnimeCraftIconRow>
            )) : (
              <div className="games-empty">정규리그를 진행하면 포스트시즌 브리핑이 누적됩니다.</div>
            )}
          </div>
        </section>

        <section className="games-panel">
          <MyAnimeCraftPanelTitle action="match" title="라이벌리 브리핑" meta={rivalryReport.sampleLabel} />
          <p style={{ color: '#5f6c78', fontWeight: 800, lineHeight: 1.5, margin: 0 }}>
            {rivalryReport.headline}
          </p>
          <div className="game-save-list">
            {rivalryReport.rows.length ? rivalryReport.rows.slice(0, 3).map((row) => (
              <MyAnimeCraftIconRow action="match" label={`${row.playerAName} 대 ${row.playerBName}`} key={row.key}>
                <div>
                  <span>{row.playerATeamName || '무소속'} · {row.playerBTeamName || '무소속'}</span>
                  <strong>{row.playerAName} vs {row.playerBName}</strong>
                  <small>{row.detail || '추가 표본 대기'}</small>
                </div>
                <strong>{row.recordLabel}</strong>
              </MyAnimeCraftIconRow>
            )) : (
              <div className="games-empty">경기를 진행하면 맞대결 브리핑이 표시됩니다.</div>
            )}
          </div>
        </section>

        <section className="games-panel">
          <MyAnimeCraftPanelTitle action="analysis" title="시즌 메타" meta={buildMetaReport.sampleLabel} />
          <p style={{ color: '#5f6c78', fontWeight: 800, lineHeight: 1.5, margin: 0 }}>
            {buildMetaReport.insight}
          </p>
          <div className="games-rank-split">
            {buildMetaReport.styleRows.slice(0, 5).map((row) => (
              <SmallStat
                key={row.style}
                label={row.label}
                value={row.count ? `${row.count}회 · ${row.winRate}%` : '0회'}
              />
            ))}
          </div>
          <div className="game-save-list">
            {buildMetaReport.playerRows.length ? buildMetaReport.playerRows.slice(0, 3).map((row) => (
              <MyAnimeCraftIconRow action={starleagueBuildAction(row.style)} label={`${row.playerName} 메타`} key={row.playerId}>
                <div>
                  <span>{row.teamName || '소속 없음'} · {row.styleLabel}</span>
                  <strong>{row.playerName}</strong>
                  <small>{row.styleLabel} {row.count}회 · 승률 {row.winRate}% · 전체 표본 {row.total}세트</small>
                </div>
                <strong>{row.winRate}%</strong>
              </MyAnimeCraftIconRow>
            )) : (
              <div className="games-empty">경기를 진행하면 선수별 강세 빌드가 표시됩니다.</div>
            )}
          </div>
          <div className="game-save-list">
            {buildMetaReport.mapRows.length ? buildMetaReport.mapRows.slice(0, 3).map((row) => (
              <MyAnimeCraftIconRow action={starleagueBuildAction(row.style)} label={`${row.mapName} 메타`} key={row.mapKey}>
                <div>
                  <span>맵 메타 · {row.total}표본</span>
                  <strong>{row.mapName}</strong>
                  <small>{row.styleLabel} {row.count}회 · 승률 {row.winRate}%</small>
                </div>
                <strong>{row.styleLabel}</strong>
              </MyAnimeCraftIconRow>
            )) : (
              <div className="games-empty">맵별 빌드 메타가 아직 없습니다.</div>
            )}
          </div>
        </section>

        <section className="games-panel">
          <MyAnimeCraftPanelTitle
            action="calendar"
            title={seasonStage.stage === 'POSTSEASON' ? '포스트시즌 일정' : '이번 주 일정'}
            meta={`${currentFixtures.filter((fixture) => fixture.played).length}/${currentFixtures.length}`}
          />
          <div className="game-save-list">
            {currentFixtures.map((fixture) => (
              <MyAnimeCraftIconRow action={fixture.played ? 'match' : 'clock'} label={fixtureLabel(state, fixture)} key={fixture.id}>
                <div>
                  <span>{fixture.id}</span>
                  <strong>{fixtureLabel(state, fixture)}</strong>
                </div>
                <strong>{fixture.played ? '완료' : '대기'}</strong>
              </MyAnimeCraftIconRow>
            ))}
          </div>
        </section>

        {postseasonRows.length ? (
          <section className="games-panel">
            <MyAnimeCraftPanelTitle action="tournament" title="포스트시즌" meta={`${seasonStage.postseasonPlayed}/${seasonStage.postseasonTotal}`} />
            <div className="game-save-list">
              {postseasonRows.map((fixture) => (
                <MyAnimeCraftIconRow action={fixture.played ? 'tournament' : 'clock'} label={fixture.label} key={fixture.id}>
                  <div>
                    <span>{fixture.label}</span>
                    <strong>
                      {fixture.played
                        ? `${fixture.homeTeamName} ${fixture.scoreHome}:${fixture.scoreAway} ${fixture.awayTeamName}`
                        : `${fixture.homeTeamName} vs ${fixture.awayTeamName}`}
                    </strong>
                    {fixture.winnerTeamName ? (
                      <small style={{ display: 'block', color: '#94a3b8', marginTop: 4 }}>
                        승자 {fixture.winnerTeamName}
                      </small>
                    ) : null}
                  </div>
                  <strong>{fixture.played ? '완료' : fixture.awayTeamId === '__TBD__' ? '대기' : '예정'}</strong>
                </MyAnimeCraftIconRow>
              ))}
            </div>
            {postseasonBriefing.rows.length ? (
              <div className="game-save-list" style={{ marginTop: 12 }}>
                {postseasonBriefing.rows.map((row) => (
                  <MyAnimeCraftIconRow action={row.played ? 'tournament' : 'clock'} label={row.label} key={`postseason-route-${row.id}`}>
                    <div>
                      <span>{row.seedText}</span>
                      <strong>{row.label} · {row.resultText}</strong>
                      <small>{row.note}</small>
                    </div>
                    <strong>{row.winnerTeamName || (row.played ? '완료' : '대기')}</strong>
                  </MyAnimeCraftIconRow>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </section>
              </>
  );
}
