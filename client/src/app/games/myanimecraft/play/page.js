'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell from '../../_components/GamePlayShell';
import {
  GAME_SLUG,
  MAPS,
  QUICK_SAVE_SLOT,
  RACE_LABELS,
  SAVE_VERSION,
  createNewState,
  fixtureLabel,
  getCurrentFixtures,
  getPlayedCount,
  getPlayTimeSec,
  getSourceSummary,
  getTeam,
  getTopTeams,
  getTotalFixtureCount,
  normalizeState,
  scoreState,
  simulateNextMatchAction,
  simulateWeekAction,
  startNextSeasonAction,
  summaryForState,
  teamPower,
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

export default function MyAnimeCraftPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [state, setState] = useState(() => createNewState());
  const [selectedTeamId, setSelectedTeamId] = useState(() => createNewState().teams[0].id);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const currentFixtures = useMemo(() => getCurrentFixtures(state), [state]);
  const standings = useMemo(() => getTopTeams(state, 10), [state]);
  const selectedTeam = getTeam(state, selectedTeamId);
  const selectedStanding = standings.find((row) => row.teamId === selectedTeam.id);
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
    setMessage('');
  };

  const actions = (
    <>
      <button type="button" onClick={startNewRun}>새 시즌</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</button>
      <Link href="/games/myanimecraft">상세</Link>
    </>
  );

  const metrics = [
    { label: '시즌', value: state.seasonNo },
    { label: '주차', value: `${state.week}/9` },
    { label: '경기', value: `${played}/${total}` },
    { label: '선두', value: leader?.teamName || '-' },
    { label: '팀', value: state.teams.length },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 진행은 가능하지만 저장/불러오기/전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    ended ? { key: 'ended', tone: 'error', text: `${leader?.teamName || '선두 팀'}이 시즌 우승을 확정했습니다. 전적에 기록하거나 다음 시즌을 시작하세요.` } : null,
  ];

  return (
    <GamePlayShell
      kicker="Starleague Sim"
      title="MyAnimeCraft Starleague"
      description="업로드된 Starleague Sim 데이터를 기반으로 팀 리그 시즌을 진행하는 1차 이식 slice입니다. 경기 결과, 순위표, 저장 슬롯, 전적 기록까지 사이트 규격에 맞춰 연결했습니다."
      summaryLabel="Starleague Sim 요약"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>진행</h2>
            <span>{ended ? '시즌 종료' : `${state.week}주차`}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="원본 팀" value={sourceSummary.teams} />
            <SmallStat label="원본 맵" value={sourceSummary.maps} />
            <SmallStat label="사용 맵" value={sourceSummary.importedMaps} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={ended} onClick={() => setState((current) => simulateNextMatchAction(current))}>다음 경기 진행</ActionButton>
            <ActionButton disabled={ended} onClick={() => setState((current) => simulateWeekAction(current))}>이번 주 전체 진행</ActionButton>
            <ActionButton disabled={!ended} onClick={() => setState((current) => startNextSeasonAction(current))}>다음 시즌 시작</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>이번 주 일정</h2>
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
            <SmallStat label="전력" value={teamPower(selectedTeam)} />
            <SmallStat label="자금" value={`${Number(selectedStanding?.money || selectedTeam.money || 0).toLocaleString('ko-KR')} Cr`} />
          </div>
        </section>
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
            <h2>{selectedTeam.name} 로스터</h2>
            <span>{selectedTeam.roster.length}명</span>
          </div>
          <div className="game-save-list">
            {selectedTeam.roster.slice(0, 8).map((member) => (
              <article className="game-save-row" key={member.id}>
                <div>
                  <span>{RACE_LABELS[member.race] || member.race} · Lv.{member.level} · 컨디션 {member.condition}</span>
                  <strong>{member.name}</strong>
                </div>
                <strong>{member.fame.toLocaleString('ko-KR')}</strong>
              </article>
            ))}
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
            <h2>시즌 맵풀</h2>
            <span>{MAPS.length}개</span>
          </div>
          <div className="games-chip-row">
            {MAPS.map((map) => <span className="games-tag" key={map.id}>{map.name}</span>)}
          </div>
        </section>
      </section>
    </GamePlayShell>
  );
}
