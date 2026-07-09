'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import GamePlayShell from '../../_components/GamePlayShell';
import {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  careerSummary,
  createNewState,
  econSummary,
  equipmentRowsForPlayer,
  getCurrentFixtures,
  getBuildMetaReport,
  getFreeAgentPreview,
  getMatchArchiveRows,
  getPersonalLeagueRows,
  getPersonalLeagueSummary,
  getPostseasonBriefing,
  getSeasonShopRows,
  getPlayedCount,
  getPlayTimeSec,
  getSeasonReportRows,
  getSeasonStageSummary,
  getSeasonFinaleReport,
  getSeriesReplayReport,
  getSourceSummary,
  getPostseasonRows,
  getRivalryReport,
  getTopPlayers,
  getTeam,
  getTeamContractRows,
  getTopTeams,
  getTotalFixtureCount,
  normalizeState,
  inventoryRowsForTeam,
  scoreState,
  summaryForState,
  tradeCandidateRows,
  tradePreview,
  teamActionRows,
  getWinnersLeagueRows,
  getWinnersLeagueSummary,
} from '../_lib/myAnimeCraftEngine';
import MyAnimeCraftFeatureTabs from '../_components/MyAnimeCraftFeatureTabs';
import { actionFeedbackText } from '../_components/MyAnimeCraftPlayPanels';

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
  const [actionResult, setActionResult] = useState('');

  const currentFixtures = useMemo(() => getCurrentFixtures(state), [state]);
  const standings = useMemo(() => getTopTeams(state, 10), [state]);
  const playerRankings = useMemo(() => getTopPlayers(state, 10), [state]);
  const personalSummary = useMemo(() => getPersonalLeagueSummary(state), [state]);
  const personalRows = useMemo(() => getPersonalLeagueRows(state, 12), [state]);
  const winnersSummary = useMemo(() => getWinnersLeagueSummary(state), [state]);
  const winnersRows = useMemo(() => getWinnersLeagueRows(state, 10), [state]);
  const seasonStage = useMemo(() => getSeasonStageSummary(state), [state]);
  const postseasonRows = useMemo(() => getPostseasonRows(state), [state]);
  const postseasonBriefing = useMemo(() => getPostseasonBriefing(state), [state]);
  const seasonReports = useMemo(() => getSeasonReportRows(state, 8), [state]);
  const seasonFinaleReport = useMemo(() => getSeasonFinaleReport(state), [state]);
  const matchArchiveRows = useMemo(() => getMatchArchiveRows(state, 18), [state]);
  const buildMetaReport = useMemo(() => getBuildMetaReport(state), [state]);
  const rivalryReport = useMemo(() => getRivalryReport(state, 8), [state]);
  const selectedArchiveMatch = matchArchiveRows.find((row) => row.id === selectedArchiveMatchId) || matchArchiveRows[0];
  const seriesReplayReport = useMemo(() => getSeriesReplayReport(selectedArchiveMatch), [selectedArchiveMatch]);
  const selectedTeam = getTeam(state, selectedTeamId);
  const selectedPlayer = selectedTeam.roster.find((member) => member.id === selectedPlayerId) || selectedTeam.roster[0];
  const tradeTeams = tradeCandidateRows(state, selectedTeam.id);
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
  const inventoryRows = inventoryRowsForTeam(state, selectedTeam.id);
  const equipmentRows = selectedPlayer ? equipmentRowsForPlayer(state, selectedTeam.id, selectedPlayer.id) : [];
  const teamActions = selectedPlayer ? teamActionRows(state, selectedTeam.id, selectedPlayer.id) : [];
  const sourceSummary = getSourceSummary();
  const played = getPlayedCount(state);
  const total = getTotalFixtureCount(state);
  const score = scoreState(state);
  const leader = standings[0];
  const ended = Boolean(state.ended);
  const recentActionText = actionResult || state.log?.[0] || '아직 진행한 행동이 없습니다.';

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
      setActionResult('Starleague Sim 시즌 상태를 저장 슬롯에 저장했습니다.');
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
      setActionResult(nextState.log?.[0] || '저장된 Starleague Sim 시즌을 불러왔습니다.');
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
      setActionResult('Starleague Sim 시즌 스냅샷을 전적에 기록했습니다.');
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
    setActionResult('새 Starleague Sim 시즌을 시작했습니다.');
    setMessage('');
  };

  const applyStateAction = (label, updater, options = {}) => {
    const nextState = updater(state);
    setState(nextState);
    setActionResult(actionFeedbackText(state, nextState, label, options.fallback));
    if (options.selectLatestMatch) {
      const latestMatch = getMatchArchiveRows(nextState, 1)[0];
      if (latestMatch?.id) setSelectedArchiveMatchId(latestMatch.id);
    }
    if (options.clearArchiveSelection) setSelectedArchiveMatchId('');
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

  const guide = {
    title: '시즌 운영 코치',
    badge: seasonStage.label,
    primaryTitle: ended ? '시즌 종료' : '다음 경기 진행',
    primaryText: ended
      ? '전적을 기록하거나 다음 시즌을 시작해 장기 리그 이력을 이어가세요.'
      : `${played}/${total}경기 진행 중입니다. 정규리그와 개인리그, 위너스리그 상태를 같이 확인하세요.`,
    focusRows: [
      { label: '경기', value: `${played}/${total}` },
      { label: '선두', value: leader?.teamName || '-' },
      { label: '개인리그', value: personalSummary.stage === 'DONE' ? personalSummary.championName || '완료' : personalSummary.phaseLabel || '-' },
      { label: '라이벌리', value: rivalryReport.sampleLabel },
      { label: '리포트', value: seasonReports.length },
    ],
    adviceLines: [
      ended ? { kind: '우선', title: '시즌 결과 기록', detail: '명예/전적 기록 후 다음 시즌으로 넘어가세요.' } : { kind: '우선', title: '다음 경기 진행', detail: '최근 경기 아카이브가 갱신되도록 1경기 또는 1주 단위로 진행하세요.' },
      rivalryReport.rows[0] ? { kind: '관전', title: '라이벌리 체크', detail: rivalryReport.rows[0].headline } : null,
      personalSummary.stage !== 'DONE' ? { kind: '병행', title: '개인리그 추적', detail: personalSummary.phaseLabel || '개인리그 진행 상황을 확인하세요.' } : null,
      winnersSummary.stage !== 'DONE' ? { kind: '병행', title: '위너스리그 추적', detail: `${winnersSummary.scoreHome}:${winnersSummary.scoreAway} 스코어를 확인하세요.` } : null,
    ],
  };

  return (
    <GamePlayShell
      kicker="Starleague Sim"
      title="MyAnimeCraft Starleague"
      description="업로드된 Starleague Sim 데이터를 기반으로 팀 리그, 개인리그, 위너스리그를 함께 진행합니다. 경기 결과, 순위표, 저장 슬롯, 전적 기록까지 사이트 규격에 맞춰 연결했습니다."
      summaryLabel="Starleague Sim 요약"
      summaryDensity="micro"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameAdvisorPanel {...guide} />

      <MyAnimeCraftFeatureTabs
        applyStateAction={applyStateAction}
        buildMetaReport={buildMetaReport}
        currentFixtures={currentFixtures}
        ended={ended}
        equipmentRows={equipmentRows}
        freeAgentPreview={freeAgentPreview}
        inventoryRows={inventoryRows}
        matchArchiveRows={matchArchiveRows}
        personalRows={personalRows}
        personalSummary={personalSummary}
        played={played}
        playerRankings={playerRankings}
        postseasonBriefing={postseasonBriefing}
        postseasonRows={postseasonRows}
        recentActionText={recentActionText}
        rivalryReport={rivalryReport}
        seasonFinaleReport={seasonFinaleReport}
        seasonReports={seasonReports}
        seasonStage={seasonStage}
        selectedArchiveMatch={selectedArchiveMatch}
        selectedCareer={selectedCareer}
        selectedContracts={selectedContracts}
        selectedEconomy={selectedEconomy}
        selectedPlayer={selectedPlayer}
        selectedStanding={selectedStanding}
        selectedTeam={selectedTeam}
        selectedTeamId={selectedTeamId}
        seriesReplayReport={seriesReplayReport}
        setSelectedArchiveMatchId={setSelectedArchiveMatchId}
        setSelectedPlayerId={setSelectedPlayerId}
        setSelectedTeamId={setSelectedTeamId}
        setTradeCash={setTradeCash}
        setTradeTargetPlayerId={setTradeTargetPlayerId}
        setTradeTargetTeamId={setTradeTargetTeamId}
        shopRows={shopRows}
        sourceSummary={sourceSummary}
        standings={standings}
        state={state}
        teamActions={teamActions}
        total={total}
        tradeCash={tradeCash}
        tradeInfo={tradeInfo}
        tradeTargetPlayer={tradeTargetPlayer}
        tradeTargetTeam={tradeTargetTeam}
        tradeTargetTeamId={tradeTargetTeamId}
        tradeTeams={tradeTeams}
        winnersRows={winnersRows}
        winnersSummary={winnersSummary}
      />
    </GamePlayShell>
  );
}
