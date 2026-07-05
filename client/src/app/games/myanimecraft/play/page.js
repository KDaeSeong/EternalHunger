'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell, { GameFeatureTabs } from '../../_components/GamePlayShell';
import {
  BUILD_STYLE_LABELS,
  EQUIPMENT_SLOT_LABELS,
  GAME_SLUG,
  MAPS,
  QUICK_SAVE_SLOT,
  RACE_LABELS,
  SAVE_VERSION,
  advancePersonalLeagueAction,
  advanceWinnersLeagueAction,
  applyTradeAction,
  buyShopItemAction,
  careerSummary,
  createNewState,
  econSummary,
  equipInventoryItemAction,
  equipmentRowsForPlayer,
  fixtureLabel,
  getCurrentFixtures,
  getBuildMetaReport,
  getFreeAgentPreview,
  getMatchArchiveRows,
  getPersonalLeagueRows,
  getPersonalLeagueSummary,
  getSeasonShopRows,
  getPlayedCount,
  getPlayTimeSec,
  getSeasonReportRows,
  getSeasonStageSummary,
  getSeasonFinaleReport,
  getSourceSummary,
  getPostseasonRows,
  getTopPlayers,
  getTeam,
  getTeamContractRows,
  getTopTeams,
  getTotalFixtureCount,
  normalizeState,
  investTrainingAction,
  inventoryRowsForTeam,
  negotiateSponsorAction,
  scoreState,
  signFreeAgentAction,
  simulateNextMatchAction,
  simulateSeasonAction,
  simulateWeekAction,
  startPersonalLeagueAction,
  startWinnersLeagueAction,
  startNextSeasonAction,
  summaryForState,
  runTeamActionAction,
  teamPower,
  tradeCandidateRows,
  tradePreview,
  teamActionRows,
  unequipSlotAction,
  consumeInventoryItemAction,
  getWinnersLeagueRows,
  getWinnersLeagueSummary,
} from '../_lib/myAnimeCraftEngine';

function ActionButton({ children, disabled, onClick }) {
  return (
    <button type="button" className="tcg-primary-action" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function SmallStat({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatTimelineTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function BroadcastTimeline({ lines, title = '중계 타임라인' }) {
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

export default function MyAnimeCraftPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [state, setState] = useState(() => createNewState());
  const [selectedTeamId, setSelectedTeamId] = useState(() => createNewState().teams[0].id);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [tradeTargetTeamId, setTradeTargetTeamId] = useState(() => createNewState().teams[1]?.id || '');
  const [tradeTargetPlayerId, setTradeTargetPlayerId] = useState('');
  const [tradeCash, setTradeCash] = useState(0);
  const [selectedArchiveMatchId, setSelectedArchiveMatchId] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const currentFixtures = useMemo(() => getCurrentFixtures(state), [state]);
  const standings = useMemo(() => getTopTeams(state, 10), [state]);
  const playerRankings = useMemo(() => getTopPlayers(state, 10), [state]);
  const personalSummary = useMemo(() => getPersonalLeagueSummary(state), [state]);
  const personalRows = useMemo(() => getPersonalLeagueRows(state, 12), [state]);
  const winnersSummary = useMemo(() => getWinnersLeagueSummary(state), [state]);
  const winnersRows = useMemo(() => getWinnersLeagueRows(state, 10), [state]);
  const seasonStage = useMemo(() => getSeasonStageSummary(state), [state]);
  const postseasonRows = useMemo(() => getPostseasonRows(state), [state]);
  const seasonReports = useMemo(() => getSeasonReportRows(state, 8), [state]);
  const seasonFinaleReport = useMemo(() => getSeasonFinaleReport(state), [state]);
  const matchArchiveRows = useMemo(() => getMatchArchiveRows(state, 18), [state]);
  const buildMetaReport = useMemo(() => getBuildMetaReport(state), [state]);
  const selectedArchiveMatch = matchArchiveRows.find((row) => row.id === selectedArchiveMatchId) || matchArchiveRows[0];
  const selectedTeam = getTeam(state, selectedTeamId);
  const selectedPlayer = selectedTeam.roster.find((member) => member.id === selectedPlayerId) || selectedTeam.roster[0];
  const tradeTeams = useMemo(() => tradeCandidateRows(state, selectedTeam.id), [state, selectedTeam.id]);
  const tradeTargetTeam = tradeTeams.find((team) => team.teamId === tradeTargetTeamId) || tradeTeams[0];
  const tradeTargetPlayer = tradeTargetTeam?.roster.find((member) => member.playerId === tradeTargetPlayerId) || tradeTargetTeam?.roster[0];
  const tradeInfo = tradeTargetTeam && selectedPlayer && tradeTargetPlayer
    ? tradePreview(state, selectedTeam.id, selectedPlayer.id, tradeTargetTeam.teamId, tradeTargetPlayer.playerId, tradeCash)
    : null;
  const selectedStanding = standings.find((row) => row.teamId === selectedTeam.id);
  const selectedCareer = careerSummary(state, selectedTeam.id);
  const freeAgentPreview = getFreeAgentPreview(state, selectedTeam.id);
  const selectedEconomy = econSummary(state, selectedTeam.id);
  const selectedContracts = getTeamContractRows(state, selectedTeam.id);
  const shopRows = useMemo(() => getSeasonShopRows(state), [state]);
  const inventoryRows = useMemo(() => inventoryRowsForTeam(state, selectedTeam.id), [state, selectedTeam.id]);
  const equipmentRows = useMemo(() => (
    selectedPlayer ? equipmentRowsForPlayer(state, selectedTeam.id, selectedPlayer.id) : []
  ), [state, selectedTeam.id, selectedPlayer]);
  const teamActions = useMemo(() => (
    selectedPlayer ? teamActionRows(state, selectedTeam.id, selectedPlayer.id) : []
  ), [state, selectedTeam.id, selectedPlayer]);
  const sourceSummary = getSourceSummary();
  const played = getPlayedCount(state);
  const total = getTotalFixtureCount(state);
  const score = scoreState(state);
  const leader = standings[0];
  const ended = Boolean(state.ended);

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 Starleague Sim 시즌 상태를 서버 저장 슬롯에 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `Starleague Sim S${state.seasonNo} W${state.week}`,
        version: SAVE_VERSION,
        summary: summaryForState(state),
        payload: { state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('Starleague Sim 시즌 상태를 저장했습니다.');
      showToast({ tone: 'success', message: 'Starleague Sim 시즌 상태를 저장했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 저장된 Starleague Sim 시즌을 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 Starleague Sim 시즌이 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const nextState = normalizeState(detail?.save?.payload?.state);
      setState(nextState);
      setSelectedTeamId(nextState.teams[0]?.id || '');
      setTradeTargetTeamId(nextState.teams[1]?.id || '');
      setTradeTargetPlayerId('');
      setMessage('저장된 Starleague Sim 시즌을 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 Starleague Sim 시즌을 불러왔습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '불러오기에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 Starleague Sim 시즌 결과를 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `Starleague Sim Season ${state.seasonNo}`,
        mode: 'league-sim',
        result: ended ? 'season-complete' : 'season-snapshot',
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('Starleague Sim 시즌 스냅샷을 전적에 기록했습니다.');
      showToast({ tone: 'success', message: 'Starleague Sim 시즌 스냅샷을 전적에 기록했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const startNewRun = () => {
    const nextState = createNewState();
    setState(nextState);
    setSelectedTeamId(nextState.teams[0]?.id || '');
    setTradeTargetTeamId(nextState.teams[1]?.id || '');
    setTradeTargetPlayerId('');
    setTradeCash(0);
    setSelectedArchiveMatchId('');
    setMessage('');
  };

  const actions = (
    <>
      <button type="button" onClick={startNewRun}>새 시즌</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</button>
      <Link href="/myanime/myanimecraft">상세</Link>
    </>
  );

  const metrics = [
    { label: '시즌', value: state.seasonNo },
    { label: '단계', value: seasonStage.label },
    { label: '경기', value: `${played}/${total}` },
    { label: '선두', value: leader?.teamName || '-' },
    { label: '개인리그', value: personalSummary.stage === 'DONE' ? personalSummary.championName || '완료' : personalSummary.phaseLabel || `${personalSummary.played}/${personalSummary.total || '-'}` },
    { label: '위너스', value: winnersSummary.stage === 'DONE' ? winnersSummary.championTeamName || '완료' : `${winnersSummary.scoreHome}:${winnersSummary.scoreAway}` },
    { label: '리포트', value: seasonReports.length },
    { label: '팀', value: state.teams.length },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 진행은 가능하지만 저장/불러오기/전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    ended ? { key: 'ended', tone: 'error', text: `${seasonStage.postseasonChampionTeamName || leader?.teamName || '선두 팀'}이 시즌 우승을 확정했습니다. 전적에 기록하거나 다음 시즌을 시작하세요.` } : null,
  ];

  return (
    <GamePlayShell
      kicker="Starleague Sim"
      title="MyAnimeCraft Starleague"
      description="업로드된 Starleague Sim 데이터를 기반으로 팀 리그, 개인리그, 위너스리그를 함께 진행합니다. 경기 결과, 순위표, 저장 슬롯, 전적 기록까지 사이트 규격에 맞춰 연결했습니다."
      summaryLabel="Starleague Sim 요약"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameFeatureTabs
        tabs={[
          {
            id: 'league',
            label: '리그 진행/운영',
            badge: `${played}/${total}`,
            children: (
              <>
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>진행</h2>
            <span>{seasonStage.label}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="원본 팀" value={sourceSummary.teams} />
            <SmallStat label="원본 맵" value={sourceSummary.maps} />
            <SmallStat label="사용 맵" value={sourceSummary.importedMaps} />
            <SmallStat label="포스트시즌" value={seasonStage.postseasonTotal ? `${seasonStage.postseasonPlayed}/${seasonStage.postseasonTotal}` : '대기'} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={ended} onClick={() => setState((current) => simulateNextMatchAction(current))}>다음 경기 진행</ActionButton>
            <ActionButton disabled={ended} onClick={() => setState((current) => simulateWeekAction(current))}>이번 주 전체 진행</ActionButton>
            <ActionButton disabled={ended} onClick={() => setState((current) => simulateSeasonAction(current))}>시즌 끝까지 진행</ActionButton>
            <ActionButton disabled={!ended} onClick={() => setState((current) => startNextSeasonAction(current))}>다음 시즌 시작</ActionButton>
          </div>
          {matchArchiveRows.length ? (
            <div className="game-save-list" style={{ marginTop: 16 }}>
              {matchArchiveRows.slice(0, 6).map((match) => (
                <button
                  type="button"
                  className="game-save-row"
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
                </button>
              ))}
            </div>
          ) : null}
          {selectedArchiveMatch ? (
            <div className="games-activity-list" style={{ marginTop: 16 }}>
              <div>
                <strong>경기 다시보기 · {selectedArchiveMatch.stageLabel}</strong>
                <span>{selectedArchiveMatch.homeTeamName} {selectedArchiveMatch.scoreHome}:{selectedArchiveMatch.scoreAway} {selectedArchiveMatch.awayTeamName}</span>
              </div>
              {selectedArchiveMatch.sets.map((setResult) => (
                <div key={`${selectedArchiveMatch.matchId}-${setResult.setNo}`}>
                  <strong>
                    {setResult.setNo}세트{setResult.isAceSet ? ' · 에이스전' : ''} · {setResult.mapName} · {setResult.homePlayerName} {BUILD_STYLE_LABELS[setResult.homeBuildStyle] || setResult.homeBuildStyle}
                    {' vs '}
                    {setResult.awayPlayerName} {BUILD_STYLE_LABELS[setResult.awayBuildStyle] || setResult.awayBuildStyle}
                  </strong>
                  <span>
                    {setResult.homeBuildName} / {setResult.awayBuildName} · 홈 승률 {setResult.probabilityHome}% · 맵 보정 {setResult.mapBiasHome >= 0 ? '+' : ''}{setResult.mapBiasHome}% · 노이즈 {setResult.noiseAmp}
                    {setResult.isAceSet ? ` · 에이스 보정 ${setResult.aceBoostHome >= 0 ? '+' : ''}${setResult.aceBoostHome}%/${setResult.aceBoostAway >= 0 ? '+' : ''}${setResult.aceBoostAway}%` : ''}
                  </span>
                  <BroadcastTimeline lines={setResult.timeline} />
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>시즌 메타</h2>
            <span>{buildMetaReport.sampleLabel}</span>
          </div>
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
              <article className="game-save-row" key={row.playerId}>
                <div>
                  <span>{row.teamName || '소속 없음'} · {row.styleLabel}</span>
                  <strong>{row.playerName}</strong>
                  <small>{row.styleLabel} {row.count}회 · 승률 {row.winRate}% · 전체 표본 {row.total}세트</small>
                </div>
                <strong>{row.winRate}%</strong>
              </article>
            )) : (
              <div className="games-empty">경기를 진행하면 선수별 강세 빌드가 표시됩니다.</div>
            )}
          </div>
          <div className="game-save-list">
            {buildMetaReport.mapRows.length ? buildMetaReport.mapRows.slice(0, 3).map((row) => (
              <article className="game-save-row" key={row.mapKey}>
                <div>
                  <span>맵 메타 · {row.total}표본</span>
                  <strong>{row.mapName}</strong>
                  <small>{row.styleLabel} {row.count}회 · 승률 {row.winRate}%</small>
                </div>
                <strong>{row.styleLabel}</strong>
              </article>
            )) : (
              <div className="games-empty">맵별 빌드 메타가 아직 없습니다.</div>
            )}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>{seasonStage.stage === 'POSTSEASON' ? '포스트시즌 일정' : '이번 주 일정'}</h2>
            <span>{currentFixtures.filter((fixture) => fixture.played).length}/{currentFixtures.length}</span>
          </div>
          <div className="game-save-list">
            {currentFixtures.map((fixture) => (
              <article className="game-save-row" key={fixture.id}>
                <div>
                  <span>{fixture.id}</span>
                  <strong>{fixtureLabel(state, fixture)}</strong>
                </div>
                <strong>{fixture.played ? '완료' : '대기'}</strong>
              </article>
            ))}
          </div>
        </section>

        {postseasonRows.length ? (
          <section className="games-panel">
            <div className="games-panel-title">
              <h2>포스트시즌</h2>
              <span>{seasonStage.postseasonPlayed}/{seasonStage.postseasonTotal}</span>
            </div>
            <div className="game-save-list">
              {postseasonRows.map((fixture) => (
                <article className="game-save-row" key={fixture.id}>
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
                </article>
              ))}
            </div>
          </section>
        ) : null}

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
            <ActionButton disabled={personalSummary.stage === 'DONE'} onClick={() => setState((current) => (
              personalSummary.stage === 'NOT_STARTED' ? startPersonalLeagueAction(current) : advancePersonalLeagueAction(current)
            ))}>
              {personalSummary.stage === 'NOT_STARTED' ? '개인리그 시작' : `${personalSummary.phaseLabel || '개인전'} 진행`}
            </ActionButton>
          </div>
          {personalSummary.stageReports?.length ? (
            <div className="game-save-list" style={{ marginTop: 16 }}>
              {personalSummary.stageReports.map((report) => (
                <article className="game-save-row" key={`${report.phase}-${report.playedAt}`}>
                  <div>
                    <span>{report.label} · 참가 {report.entrantCount}명</span>
                    <strong>{report.summary}</strong>
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
                      title={`마지막 세트 중계 · ${match.setDetails[match.setDetails.length - 1].mapName}`}
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
            <ActionButton disabled={winnersSummary.stage === 'DONE'} onClick={() => setState((current) => (
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
                  <BroadcastTimeline lines={setResult.timeline} />
                </div>
                <strong>{setResult.winnerTeamName}</strong>
              </article>
            )) : (
              <div className="games-empty">위너스리그 세트 기록이 아직 없습니다.</div>
            )}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>팀 분석</h2>
            <span>{selectedStanding ? `${selectedStanding.wins}승 ${selectedStanding.losses}패` : '대기'}</span>
          </div>
          <label className="game-save-json-field">
            <span>팀</span>
            <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>
              {state.teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}
            </select>
          </label>
          <div className="games-rank-split">
            <SmallStat label="감독" value={selectedTeam.coach} />
            <SmallStat label="전력" value={teamPower(selectedTeam, state)} />
            <SmallStat label="자금" value={`${Number(selectedStanding?.money || selectedTeam.money || 0).toLocaleString('ko-KR')} Cr`} />
          </div>
          <div className="games-rank-split">
            <SmallStat label="스폰서" value={`Lv.${selectedCareer.sponsorTier}`} />
            <SmallStat label="팬" value={selectedCareer.fanBase.toLocaleString('ko-KR')} />
            <SmallStat label="훈련" value={`Lv.${selectedCareer.trainingLevel}`} />
            <SmallStat label="스카우팅" value={`Lv.${selectedCareer.scoutingLevel}`} />
            <SmallStat label="예상 연봉" value={`${selectedCareer.payroll.toLocaleString('ko-KR')} Cr`} />
            <SmallStat label="FA 후보" value={`${freeAgentPreview.player.name} · ${freeAgentPreview.signingBonus} Cr`} />
          </div>
          <div className="games-rank-split">
            <SmallStat label="시즌 수입" value={`${selectedEconomy.income.toLocaleString('ko-KR')} Cr`} />
            <SmallStat label="시즌 지출" value={`${selectedEconomy.expense.toLocaleString('ko-KR')} Cr`} />
            <SmallStat label="순이익" value={`${selectedEconomy.net.toLocaleString('ko-KR')} Cr`} />
            <SmallStat label="만료 임박" value={`${selectedEconomy.expiringCount}명`} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={ended} onClick={() => setState((current) => negotiateSponsorAction(current, selectedTeam.id))}>스폰서 협상</ActionButton>
            <ActionButton disabled={ended} onClick={() => setState((current) => investTrainingAction(current, selectedTeam.id))}>훈련 투자</ActionButton>
            <ActionButton disabled={ended} onClick={() => setState((current) => signFreeAgentAction(current, selectedTeam.id))}>FA 영입</ActionButton>
          </div>
          <div className="games-panel-title" style={{ marginTop: 16 }}>
            <h2>주간 운영</h2>
            <span>{selectedPlayer?.name || '선수 없음'}</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {teamActions.map((action) => (
              <ActionButton
                key={action.id}
                disabled={!action.canRun}
                onClick={() => setState((current) => runTeamActionAction(current, selectedTeam.id, selectedPlayer.id, action.id))}
              >
                {action.label} · {action.effectText}{action.disabledReason ? ` · ${action.disabledReason}` : ''}
              </ActionButton>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>주간 상점</h2>
            <span>{state.shop?.week || state.week}주차</span>
          </div>
          <div className="game-save-list">
            {shopRows.map((offer) => (
              <article className="game-save-row" key={offer.offerId}>
                <div>
                  <span>
                    {offer.featured ? '추천 · ' : ''}{EQUIPMENT_SLOT_LABELS[offer.slot] || offer.kind}
                    {offer.salePct ? ` · ${offer.salePct}% 할인` : ''}
                  </span>
                  <strong>{offer.name}</strong>
                  <small>
                    {offer.effects?.statsDelta ? Object.entries(offer.effects.statsDelta).map(([key, amount]) => `${key}+${amount}`).join(' · ') : ''}
                    {offer.effects?.conditionDelta ? `컨디션 +${offer.effects.conditionDelta}` : ''}
                    {offer.effects?.fameDelta ? ` · 명성 +${offer.effects.fameDelta}` : ''}
                  </small>
                </div>
                <button type="button" disabled={ended || offer.stock <= 0} onClick={() => setState((current) => buyShopItemAction(current, selectedTeam.id, offer.offerId))}>
                  {offer.stock <= 0 ? '품절' : `${offer.price} Cr`}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>트레이드</h2>
            <span>{tradeInfo ? `${Math.round(tradeInfo.acceptChance * 100)}%` : '대기'}</span>
          </div>
          <label className="game-save-json-field">
            <span>상대 팀</span>
            <select value={tradeTargetTeam?.teamId || ''} onChange={(event) => {
              setTradeTargetTeamId(event.target.value);
              setTradeTargetPlayerId('');
            }}>
              {tradeTeams.map((team) => (
                <option value={team.teamId} key={team.teamId}>{team.teamName} · 전력 {team.power}</option>
              ))}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>상대 선수</span>
            <select value={tradeTargetPlayer?.playerId || ''} onChange={(event) => setTradeTargetPlayerId(event.target.value)} disabled={!tradeTargetTeam}>
              {(tradeTargetTeam?.roster || []).map((member) => (
                <option value={member.playerId} key={member.playerId}>
                  {member.playerName} · {RACE_LABELS[member.race] || member.race} · 가치 {member.marketValue}
                </option>
              ))}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>현금 보정</span>
            <input
              type="number"
              min="0"
              step="25"
              value={tradeCash}
              onChange={(event) => setTradeCash(Math.max(0, Number(event.target.value || 0)))}
            />
          </label>
          <div className="games-rank-split">
            <SmallStat label="우리 선수" value={`${selectedPlayer?.name || '-'} · ${tradeInfo?.ourValue || 0}`} />
            <SmallStat label="상대 선수" value={`${tradeTargetPlayer?.playerName || '-'} · ${tradeInfo?.theirValue || 0}`} />
            <SmallStat label="가치비" value={tradeInfo ? tradeInfo.ratio.toFixed(2) : '-'} />
          </div>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
            {tradeInfo?.note || '트레이드할 선수와 상대 팀을 선택하세요.'}
          </p>
          <ActionButton
            disabled={!tradeInfo?.canTrade}
            onClick={() => setState((current) => applyTradeAction(
              current,
              selectedTeam.id,
              selectedPlayer.id,
              tradeTargetTeam.teamId,
              tradeTargetPlayer.playerId,
              tradeCash,
            ))}
          >
            1:1 트레이드 제안
          </ActionButton>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>장비 관리</h2>
            <span>{selectedPlayer?.name || '선수 없음'}</span>
          </div>
          <label className="game-save-json-field">
            <span>대상 선수</span>
            <select value={selectedPlayer?.id || ''} onChange={(event) => setSelectedPlayerId(event.target.value)}>
              {selectedTeam.roster.map((member) => (
                <option value={member.id} key={member.id}>{member.name} · {RACE_LABELS[member.race] || member.race}</option>
              ))}
            </select>
          </label>
          <div className="game-save-list">
            {equipmentRows.map((row) => (
              <article className="game-save-row" key={row.slot}>
                <div>
                  <span>{row.label}</span>
                  <strong>{row.itemName || '미장착'}</strong>
                </div>
                <button type="button" disabled={!row.itemId} onClick={() => setState((current) => unequipSlotAction(current, selectedTeam.id, selectedPlayer.id, row.slot))}>해제</button>
              </article>
            ))}
          </div>
          <div className="games-panel-title" style={{ marginTop: 16 }}>
            <h2>인벤토리</h2>
            <span>{inventoryRows.reduce((sum, item) => sum + Number(item.qty || 0), 0)}개</span>
          </div>
          <div className="game-save-list">
            {inventoryRows.length ? inventoryRows.map((item) => (
              <article className="game-save-row" key={item.itemId}>
                <div>
                  <span>
                    {EQUIPMENT_SLOT_LABELS[item.slot] || '소모품'} · 보유 {item.qty}
                    {item.equippedCount ? ` · 장착 ${item.equippedCount}` : ''}
                  </span>
                  <strong>{item.name}</strong>
                </div>
                {item.slot ? (
                  <button type="button" disabled={!selectedPlayer || item.qty <= item.equippedCount} onClick={() => setState((current) => equipInventoryItemAction(current, selectedTeam.id, selectedPlayer.id, item.itemId))}>장착</button>
                ) : (
                  <button type="button" disabled={!selectedPlayer || item.qty <= 0} onClick={() => setState((current) => consumeInventoryItemAction(current, selectedTeam.id, selectedPlayer.id, item.itemId))}>사용</button>
                )}
              </article>
            )) : (
              <div className="games-empty">보유 아이템이 없습니다.</div>
            )}
          </div>
          </section>
        </section>
              </>
            ),
          },
          {
            id: 'records',
            label: '기록/랭킹',
            badge: `${standings.length}팀`,
            children: (
              <>

      <section className="games-panel" style={{ marginBottom: 14 }}>
        <div className="games-panel-title">
          <h2>시즌 결산 보드</h2>
          <span>{seasonFinaleReport.stageLabel}</span>
        </div>
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
            <article className="game-save-row" key={`season-finale-highlight-${index}`}>
              <div>
                <span>결산 하이라이트</span>
                <strong>{line}</strong>
              </div>
              <strong>{index + 1}</strong>
            </article>
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

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>순위표</h2>
            <span>{standings.length}팀</span>
          </div>
          <div className="game-save-list">
            {standings.map((row, index) => (
              <article className="game-save-row" key={row.teamId}>
                <div>
                  <span>{index + 1}위 · {row.coach}</span>
                  <strong>{row.teamName}</strong>
                </div>
                <strong>{row.wins}승 {row.losses}패 · {row.diff >= 0 ? '+' : ''}{row.diff}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>시즌 리포트</h2>
            <span>{seasonReports.length}개</span>
          </div>
          <div className="game-save-list">
            {seasonReports.length ? seasonReports.map((report) => (
              <article className="game-save-row" key={`season-report-${report.seasonNo}`}>
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
              </article>
            )) : (
              <article className="game-save-row">
                <div>
                  <span>시즌 종료 후 자동 생성</span>
                  <strong>아직 시즌 리포트가 없습니다.</strong>
                </div>
                <strong>대기</strong>
              </article>
            )}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>선수 랭킹</h2>
            <span>{playerRankings.length}명</span>
          </div>
          <div className="game-save-list">
            {playerRankings.map((row, index) => (
              <article className="game-save-row" key={row.playerId}>
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
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>{selectedTeam.name} 로스터</h2>
            <span>{selectedTeam.roster.length}명</span>
          </div>
          <div className="game-save-list">
            {selectedTeam.roster.slice(0, 8).map((member) => {
              const contract = selectedContracts.find((item) => item.playerId === member.id);
              return (
                <article className="game-save-row" key={member.id}>
                  <div>
                    <span>
                      {RACE_LABELS[member.race] || member.race} · Lv.{member.level} · 컨디션 {member.condition}
                      {contract ? ` · 연봉 ${contract.salary}Cr · ${contract.yearsLeft}년` : ''}
                    </span>
                    <strong>{member.name}</strong>
                  </div>
                  <strong>{member.fame.toLocaleString('ko-KR')}</strong>
                </article>
              );
            })}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>최근 로그</h2>
            <span>{state.runId}</span>
          </div>
          <div className="games-activity-list">
            {state.log.slice(0, 12).map((line, index) => (
              <div key={`${line}-${index}`}>
                <strong>{line}</strong>
              </div>
            ))}
          </div>
          <div className="games-panel-title" style={{ marginTop: 16 }}>
            <h2>경제 로그</h2>
            <span>{selectedEconomy.count}건</span>
          </div>
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
          <div className="games-panel-title" style={{ marginTop: 16 }}>
            <h2>시즌 맵풀</h2>
            <span>{MAPS.length}개</span>
          </div>
          <div className="games-chip-row">
            {MAPS.map((map) => <span className="games-tag" key={map.id}>{map.name}</span>)}
          </div>
        </section>
      </section>
              </>
            ),
          },
        ]}
      />
    </GamePlayShell>
  );
}
