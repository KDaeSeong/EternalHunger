'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell from '../../_components/GamePlayShell';
import {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  applyLocalPackAction,
  auditLogoPackAction,
  buildEvents,
  buildTracks,
  clearLocalPackAction,
  createNewState,
  generateRaceCardAction,
  getPlayTimeSec,
  latestAudit,
  normalizeState,
  parseLocalPackText,
  sampleLocalPackText,
  scoreState,
  setFilterAction,
  summaryForState,
  visibleEvents,
  visibleTracks,
} from '../_lib/racingLogosEngine';

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

function LogoPreview({ alt, fallbackLogo, localCandidates, preferLocalLogos, showDebug }) {
  const sources = useMemo(() => {
    const candidates = preferLocalLogos ? localCandidates : [];
    return [...candidates, fallbackLogo].filter(Boolean);
  }, [fallbackLogo, localCandidates, preferLocalLogos]);
  const [index, setIndex] = useState(0);

  const safeIndex = Math.min(index, Math.max(0, sources.length - 1));
  const src = sources[safeIndex] || fallbackLogo;
  return (
    <div
      className="games-logo-preview"
      title={showDebug ? src : alt}
      style={{
        width: 58,
        height: 58,
        borderRadius: 14,
        border: '1px solid rgba(26, 82, 118, 0.24)',
        background: '#f7fbff',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        flex: '0 0 auto',
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={48}
        height={48}
        unoptimized
        onError={() => setIndex((current) => current < sources.length - 1 ? current + 1 : current)}
      />
    </div>
  );
}

function TrackCard({ track, filters }) {
  return (
    <article className="game-save-row">
      <LogoPreview
        key={`${track.logoKey}:${track.fallbackLogo}:${filters.preferLocalLogos ? 'local' : 'placeholder'}`}
        alt={track.name}
        fallbackLogo={track.fallbackLogo}
        localCandidates={track.localCandidates}
        preferLocalLogos={filters.preferLocalLogos}
        showDebug={filters.showDebug}
      />
      <div>
        <span>{track.regionLabel} / {track.surfaceName} / {track.directionName}</span>
        <strong>{track.name}</strong>
        <span>{track.distanceM.toLocaleString('ko-KR')}m / logoKey: {track.logoKey}</span>
      </div>
      <span className="game-save-chip">{track.hasLogoOverride ? '로컬키' : 'placeholder'}</span>
    </article>
  );
}

function EventRow({ event, filters }) {
  return (
    <article className="game-save-row">
      <LogoPreview
        key={`${event.trackLogoKey}:${event.fallbackLogo}:${filters.preferLocalLogos ? 'local' : 'placeholder'}`}
        alt={event.trackName}
        fallbackLogo={event.fallbackLogo}
        localCandidates={event.localCandidates}
        preferLocalLogos={filters.preferLocalLogos}
        showDebug={filters.showDebug}
      />
      <div>
        <span>{event.trackName}</span>
        <strong>{event.raceName}</strong>
        <span>{event.regionLabel} / {event.surfaceName} / {event.directionName} / {event.distanceM.toLocaleString('ko-KR')}m</span>
      </div>
      <span className="game-save-chip">{event.hasLocalName ? '실명' : 'core id'}</span>
    </article>
  );
}

export default function RacingLogosDemoPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [state, setState] = useState(() => createNewState());
  const [packText, setPackText] = useState(() => sampleLocalPackText());
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const tracks = useMemo(() => visibleTracks(state), [state]);
  const events = useMemo(() => visibleEvents(state), [state]);
  const allTracks = useMemo(() => buildTracks(state), [state]);
  const allEvents = useMemo(() => buildEvents(state), [state]);
  const audit = latestAudit(state);
  const score = scoreState(state);
  const latestRaceCard = state.raceCards[0];

  const startNewRun = () => {
    setState(createNewState());
    setPackText(sampleLocalPackText());
    setMessage('');
  };

  const applyTextPack = () => {
    const parsed = parseLocalPackText(packText);
    if (!parsed.ok) {
      setMessage(parsed.error);
      showToast({ tone: 'danger', message: parsed.error });
      return;
    }
    setState((current) => applyLocalPackAction(current, parsed.value));
    setMessage('로컬팩 JSON을 적용했습니다.');
  };

  const loadPublicLocalPack = async () => {
    if (busy) return;
    setBusy('local-pack');
    try {
      const res = await fetch('/local_pack/real_names.json', { cache: 'no-store' });
      if (!res.ok) {
        setMessage('public/local_pack/real_names.json을 찾지 못했습니다. 수동 JSON을 사용할 수 있습니다.');
        return;
      }
      const json = await res.json();
      setPackText(JSON.stringify(json, null, 2));
      setState((current) => applyLocalPackAction(current, json, 'fetch'));
      setMessage('public/local_pack/real_names.json을 불러왔습니다.');
    } catch (err) {
      setMessage(err?.message || '로컬팩을 불러오지 못했습니다.');
    } finally {
      setBusy('');
    }
  };

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 Racing Logos Demo 검수 상태를 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `Racing Logos ${audit.completeness}%`,
        version: SAVE_VERSION,
        summary: summaryForState(state),
        payload: { state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('Racing Logos Demo 검수 상태를 저장했습니다.');
      showToast({ tone: 'success', message: 'Racing Logos Demo 검수 상태를 저장했습니다.' });
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
      setMessage('로그인하면 저장된 Racing Logos Demo 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 Racing Logos Demo 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const nextState = normalizeState(detail?.save?.payload?.state);
      setState(nextState);
      setPackText(JSON.stringify(nextState.localPack, null, 2));
      setMessage('저장된 Racing Logos Demo 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 Racing Logos Demo 상태를 불러왔습니다.' });
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
      setMessage('로그인하면 Racing Logos Demo 감사 결과를 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `Racing Logos Demo - ${audit.completeness}%`,
        mode: 'asset-lab',
        result: 'asset-audit',
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('Racing Logos Demo 감사 결과를 전적에 남겼습니다.');
      showToast({ tone: 'success', message: 'Racing Logos Demo 감사 결과를 전적에 남겼습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const actions = (
    <>
      <button type="button" onClick={startNewRun}>새 검수</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</button>
      <Link href="/games/racing-logos-demo">상세</Link>
    </>
  );

  const metrics = [
    { label: '트랙', value: `${tracks.length}/${allTracks.length}` },
    { label: '이벤트', value: `${events.length}/${allEvents.length}` },
    { label: '완성도', value: `${audit.completeness}%` },
    { label: 'placeholder', value: audit.placeholderOnly },
    { label: '카드', value: state.raceCards.length },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 검수는 가능하지만 저장, 불러오기, 전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    audit.placeholderOnly > 0 ? { key: 'placeholder', text: '일부 트랙은 아직 공개 placeholder 로고만 사용합니다.' } : null,
  ];

  return (
    <GamePlayShell
      kicker="Racing Logos Demo"
      title="레이싱 로고팩 검수"
      description="업로드된 Racing Logos Demo의 core 트랙/이벤트 데이터, local pack 우선 로고 규칙, 공개 placeholder fallback을 사이트용 에셋 검수 루프로 이식했습니다."
      summaryLabel="로고팩 요약"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>로컬팩</h2>
            <span>{Object.keys(state.localPack.trackNames).length} tracks</span>
          </div>
          <label className="game-save-json-field">
            <span>real_names.json</span>
            <textarea
              rows={12}
              value={packText}
              onChange={(event) => setPackText(event.target.value)}
              spellCheck={false}
            />
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={applyTextPack}>수동 JSON 적용</ActionButton>
            <ActionButton onClick={() => void loadPublicLocalPack()} disabled={busy === 'local-pack'}>{busy === 'local-pack' ? '불러오는 중...' : 'public/local_pack 불러오기'}</ActionButton>
            <ActionButton onClick={() => setState((current) => clearLocalPackAction(current))}>로컬팩 비우기</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>필터 / 액션</h2>
            <span>{state.filters.preferLocalLogos ? 'local first' : 'fallback only'}</span>
          </div>
          <label className="game-save-json-field">
            <span>지역</span>
            <select value={state.filters.region} onChange={(event) => setState((current) => setFilterAction(current, { region: event.target.value }))}>
              <option value="all">전체</option>
              <option value="japan">일본</option>
              <option value="europe">유럽</option>
              <option value="usa">미국</option>
            </select>
          </label>
          <label className="game-save-json-field">
            <span>주로</span>
            <select value={state.filters.surface} onChange={(event) => setState((current) => setFilterAction(current, { surface: event.target.value }))}>
              <option value="all">전체</option>
              <option value="turf">잔디</option>
              <option value="dirt">더트</option>
            </select>
          </label>
          <label className="game-save-json-field">
            <span>로고 모드</span>
            <select value={state.filters.preferLocalLogos ? 'local' : 'placeholder'} onChange={(event) => setState((current) => setFilterAction(current, { preferLocalLogos: event.target.value === 'local' }))}>
              <option value="local">로컬팩 우선</option>
              <option value="placeholder">placeholder만</option>
            </select>
          </label>
          <label className="game-save-json-field">
            <span>경로 디버그</span>
            <select value={state.filters.showDebug ? 'on' : 'off'} onChange={(event) => setState((current) => setFilterAction(current, { showDebug: event.target.value === 'on' }))}>
              <option value="off">끄기</option>
              <option value="on">켜기</option>
            </select>
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={() => setState((current) => auditLogoPackAction(current))}>로고팩 감사</ActionButton>
            <ActionButton onClick={() => setState((current) => generateRaceCardAction(current))}>이벤트 카드 생성</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>감사 결과</h2>
            <span>{audit.id}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="트랙 실명" value={`${audit.namedTracks}/${audit.tracks}`} />
            <SmallStat label="이벤트 실명" value={`${audit.namedEvents}/${audit.events}`} />
            <SmallStat label="로고키" value={`${audit.overriddenLogos}/${audit.tracks}`} />
            <SmallStat label="후보 경로" value={audit.localCandidateCount} />
          </div>
          <div className="game-save-list">
            {state.auditHistory.slice(0, 4).map((item) => (
              <article className="game-save-row" key={item.id}>
                <div>
                  <span>{new Date(item.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <strong>완성도 {item.completeness}%</strong>
                </div>
                <strong>{item.score.toLocaleString('ko-KR')}</strong>
              </article>
            ))}
            {!state.auditHistory.length ? <div className="games-empty">아직 감사 기록이 없습니다.</div> : null}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>트랙 로고</h2>
            <span>{tracks.length}개</span>
          </div>
          <div className="game-save-list">
            {tracks.map((track) => <TrackCard key={track.id} track={track} filters={state.filters} />)}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>이벤트</h2>
            <span>{events.length}개</span>
          </div>
          <div className="game-save-list">
            {events.map((event) => <EventRow key={event.id} event={event} filters={state.filters} />)}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>이벤트 카드</h2>
            <span>{latestRaceCard ? latestRaceCard.results.length : 0} races</span>
          </div>
          <div className="game-save-list">
            {latestRaceCard ? latestRaceCard.results.map((result) => (
              <article className="game-save-row" key={result.eventId}>
                <div>
                  <span>{result.trackName} / {result.surface.toUpperCase()} / {result.distanceM.toLocaleString('ko-KR')}m</span>
                  <strong>{result.raceName}</strong>
                  <span>2위 {result.runnerUp}</span>
                </div>
                <strong>{result.winner}</strong>
              </article>
            )) : <div className="games-empty">이벤트 카드를 생성하면 간단한 레이스 결과가 표시됩니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>운영 로그</h2>
            <span>{state.runId}</span>
          </div>
          <div className="games-activity-list">
            {state.log.slice(0, 12).map((line, index) => (
              <div key={`${line}-${index}`}>
                <strong>{line}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>
    </GamePlayShell>
  );
}
