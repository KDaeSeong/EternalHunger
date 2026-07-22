import { SmallStat } from '../../_components/GamePlayPrimitives';
import { MAPS, RACE_LABELS } from '../_lib/myAnimeCraftEngine';
import { MyAnimeCraftIconRow, MyAnimeCraftPanelTitle } from './MyAnimeCraftVisuals';

export default function MyAnimeCraftRecordsTab(props) {
  const {
    played,
    playerRankings,
    rivalryReport,
    seasonFinaleReport,
    seasonReports,
    selectedContracts,
    selectedEconomy,
    selectedTeam,
    standings,
    state,
    total,
  } = props;

  return (
              <>

      <section className="games-panel" style={{ marginBottom: 14 }}>
        <MyAnimeCraftPanelTitle action="champion" title="시즌 결산 보드" meta={seasonFinaleReport.stageLabel} />
        <p style={{ color: '#5f6c78', fontWeight: 850, lineHeight: 1.5, margin: 0 }}>
          {seasonFinaleReport.headline}
        </p>
        <div className="games-rank-split">
          <SmallStat label="진행률" value={`${seasonFinaleReport.progressPct}%`} />
          <SmallStat label="선두/우승" value={seasonFinaleReport.championTeamName || seasonFinaleReport.leaderTeamName || '-'} />
          <SmallStat label="에이스" value={seasonFinaleReport.topPlayerName || '-'} />
          <SmallStat label="시즌 수지" value={`${seasonFinaleReport.net >= 0 ? '+' : ''}${seasonFinaleReport.net.toLocaleString('ko-KR')} Cr`} />
          <SmallStat
            label="대표 빌드"
            value={seasonFinaleReport.meta.favoriteStyleLabel
              ? `${seasonFinaleReport.meta.favoriteStyleLabel} ${seasonFinaleReport.meta.favoriteStyleWinRate}%`
              : '-'}
          />
          <SmallStat label="메타 표본" value={seasonFinaleReport.meta.sampleLabel} />
        </div>
        <div className="game-save-list">
          {seasonFinaleReport.highlights.slice(0, 5).map((line, index) => (
            <MyAnimeCraftIconRow action="event" label={`결산 하이라이트 ${index + 1}`} key={`season-finale-highlight-${index}`}>
              <div>
                <span>결산 하이라이트</span>
                <strong>{line}</strong>
              </div>
              <strong>{index + 1}</strong>
            </MyAnimeCraftIconRow>
          ))}
        </div>
        {seasonFinaleReport.recommendations.length ? (
          <div className="games-activity-list">
            {seasonFinaleReport.recommendations.map((line, index) => (
              <div key={`season-finale-recommendation-${index}`}>
                <strong>{line}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="games-panel" style={{ marginBottom: 14 }}>
        <MyAnimeCraftPanelTitle action="match" title="라이벌리 기록소" meta={rivalryReport.sampleLabel} />
        <p style={{ color: '#5f6c78', fontWeight: 850, lineHeight: 1.5, margin: 0 }}>
          {rivalryReport.headline}
        </p>
        <div className="game-save-list">
          {rivalryReport.rows.length ? rivalryReport.rows.slice(0, 6).map((row, index) => (
            <MyAnimeCraftIconRow action="match" label={`${row.playerAName} 대 ${row.playerBName}`} key={row.key}>
              <div>
                <span>
                  {index + 1}위 · {RACE_LABELS[row.playerARace] || row.playerARace || '-'} vs {RACE_LABELS[row.playerBRace] || row.playerBRace || '-'}
                  {' · '}
                  평균 {row.avgDurationMin || '-'}분
                </span>
                <strong>{row.playerAName} vs {row.playerBName}</strong>
                <small style={{ display: 'block', color: '#94a3b8', marginTop: 4 }}>
                  {row.playerATeamName || '무소속'} / {row.playerBTeamName || '무소속'}
                  {row.detail ? ` · ${row.detail}` : ''}
                </small>
              </div>
              <strong>{row.recordLabel}</strong>
            </MyAnimeCraftIconRow>
          )) : (
            <MyAnimeCraftIconRow action="clock" label="라이벌리 표본 대기">
              <div>
                <span>세트 결과 누적 후 자동 생성</span>
                <strong>아직 라이벌리 표본이 없습니다.</strong>
              </div>
              <strong>대기</strong>
            </MyAnimeCraftIconRow>
          )}
        </div>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <MyAnimeCraftPanelTitle action="trophy" title="순위표" meta={`${standings.length}팀`} />
          <div className="game-save-list">
            {standings.map((row, index) => (
              <MyAnimeCraftIconRow action={index === 0 ? 'champion' : 'players'} label={`${index + 1}위 ${row.teamName}`} key={row.teamId}>
                <div>
                  <span>{index + 1}위 · {row.coach}</span>
                  <strong>{row.teamName}</strong>
                </div>
                <strong>{row.wins}승 {row.losses}패 · {row.diff >= 0 ? '+' : ''}{row.diff}</strong>
              </MyAnimeCraftIconRow>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <MyAnimeCraftPanelTitle action="archive" title="시즌 리포트" meta={`${seasonReports.length}개`} />
          <div className="game-save-list">
            {seasonReports.length ? seasonReports.map((report) => (
              <MyAnimeCraftIconRow action="archive" label={`시즌 ${report.seasonNo} 리포트`} key={`season-report-${report.seasonNo}`}>
                <div>
                  <span>
                    시즌 {report.seasonNo} · 경기 {report.played}/{report.total} · 수지 {report.net >= 0 ? '+' : ''}{report.net.toLocaleString('ko-KR')} Cr
                  </span>
                  <strong>{report.championTeamName || '우승팀 없음'}</strong>
                  <small style={{ display: 'block', color: '#94a3b8', marginTop: 4 }}>
                    정규 1위 {report.regularChampionTeamName || '-'}
                    {' · '}
                    포스트 {report.postseasonChampionTeamName || '-'}
                    {' · '}
                    개인리그 {report.personalChampionPlayerName || '-'}{report.personalChampionTeamName ? ` · ${report.personalChampionTeamName}` : ''}
                    {' · '}
                    위너스 {report.winnersChampionTeamName || '-'}
                  </small>
                </div>
                <strong>{report.score.toLocaleString('ko-KR')}</strong>
              </MyAnimeCraftIconRow>
            )) : (
              <MyAnimeCraftIconRow action="clock" label="시즌 리포트 대기">
                <div>
                  <span>시즌 종료 후 자동 생성</span>
                  <strong>아직 시즌 리포트가 없습니다.</strong>
                </div>
                <strong>대기</strong>
              </MyAnimeCraftIconRow>
            )}
          </div>
        </section>

        <section className="games-panel">
          <MyAnimeCraftPanelTitle action="players" title="선수 랭킹" meta={`${playerRankings.length}명`} />
          <div className="game-save-list">
            {playerRankings.map((row, index) => (
              <MyAnimeCraftIconRow action={index === 0 ? 'champion' : 'players'} label={`${index + 1}위 ${row.playerName}`} key={row.playerId}>
                <div>
                  <span>
                    {index + 1}위 · {row.teamName} · {RACE_LABELS[row.race] || row.race}
                    {' · '}
                    매치 {row.matchWins}-{row.matchLosses} · 세트 {row.setWins}-{row.setLosses} · 개인 {row.personalWins}-{row.personalLosses} · 위너스 {row.winnersWins}-{row.winnersLosses}
                  </span>
                  <strong>{row.playerName}</strong>
                  <span>전력 {row.skill} · 승률 {row.winRate}% · 명성 {row.fame.toLocaleString('ko-KR')}</span>
                </div>
                <strong>{row.score.toLocaleString('ko-KR')}</strong>
              </MyAnimeCraftIconRow>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <MyAnimeCraftPanelTitle action="players" title={`${selectedTeam.name} 로스터`} meta={`${selectedTeam.roster.length}명`} />
          <div className="game-save-list">
            {selectedTeam.roster.slice(0, 8).map((member) => {
              const contract = selectedContracts.find((item) => item.playerId === member.id);
              return (
                <MyAnimeCraftIconRow action="players" label={member.name} key={member.id}>
                  <div>
                    <span>
                      {RACE_LABELS[member.race] || member.race} · Lv.{member.level} · 컨디션 {member.condition}
                      {contract ? ` · 연봉 ${contract.salary}Cr · ${contract.yearsLeft}년` : ''}
                    </span>
                    <strong>{member.name}</strong>
                  </div>
                  <strong>{member.fame.toLocaleString('ko-KR')}</strong>
                </MyAnimeCraftIconRow>
              );
            })}
          </div>
        </section>

        <section className="games-panel">
          <MyAnimeCraftPanelTitle action="logs" title="최근 로그" meta={state.runId} />
          <div className="games-activity-list">
            {state.log.slice(0, 12).map((line, index) => (
              <div key={`${line}-${index}`}>
                <strong>{line}</strong>
              </div>
            ))}
          </div>
          <MyAnimeCraftPanelTitle action="finance" title="경제 로그" meta={`${selectedEconomy.count}건`} style={{ marginTop: 16 }} />
          <div className="games-activity-list">
            {selectedEconomy.last.length ? selectedEconomy.last.map((entry) => (
              <div key={entry.id}>
                <strong>{entry.note}</strong>
                <span>{entry.amount >= 0 ? '+' : ''}{entry.amount.toLocaleString('ko-KR')} Cr · {entry.week}주차</span>
              </div>
            )) : (
              <div>
                <strong>아직 경제 로그가 없습니다.</strong>
              </div>
            )}
          </div>
          <MyAnimeCraftPanelTitle action="map" title="시즌 맵풀" meta={`${MAPS.length}개`} style={{ marginTop: 16 }} />
          <div className="games-chip-row">
            {MAPS.map((map) => <span className="games-tag" key={map.id}>{map.name}</span>)}
          </div>
        </section>
      </section>
              </>
  );
}
