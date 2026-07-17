'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import GameActionIcon from '../../_components/GameActionIcon';
import { useGameBgm } from '../../_components/GameBgmProvider';
import RacingLogosFeatureTabs from '../_components/RacingLogosFeatureTabs';
import GamePlayShell from '../../_components/GamePlayShell';
import { GameControlButton, RecentActionResult } from '../../_components/GamePlayPrimitives';
import useGameSfx from '../../_lib/useGameSfx';
import {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  applyLocalPackAction,
  auditLogoPackAction,
  buildEvents,
  buildTracks,
  createNewState,
  dataPackReleaseReportForState,
  generateRaceCardAction,
  generateSeasonCardAction,
  getPlayTimeSec,
  latestAudit,
  localPackMatrix,
  normalizeState,
  parseLocalPackText,
  sampleLocalPackText,
  scoreState,
  seasonCalendarReport,
  summaryForState,
  visibleEvents,
  visibleTracks,
} from '../_lib/racingLogosEngine';
import {
  racingLogosResultPresentation,
  racingLogosTextPresentation,
} from '../_lib/racingLogosFeedback';
import {
  racingLogosResultMusic,
  resolveRacingLogosBgmScene,
} from '../_lib/racingLogosSoundtrack';

function buildLogoDraftText(currentPack) {
  const sample = parseLocalPackText(sampleLocalPackText());
  const fallback = sample.ok ? sample.value : { trackNames: {}, eventNames: {}, trackLogoKeyOverrides: {} };
  return JSON.stringify({
    trackNames: { ...fallback.trackNames, ...(currentPack.trackNames || {}) },
    eventNames: { ...fallback.eventNames, ...(currentPack.eventNames || {}) },
    trackLogoKeyOverrides: { ...fallback.trackLogoKeyOverrides, ...(currentPack.trackLogoKeyOverrides || {}) },
  }, null, 2);
}

function buildAssetProductionQueue({ packMatrix, calendar, dataPack }) {
  const incompleteRows = packMatrix.rows.filter((row) => !row.complete);
  const queueRows = [
    ...incompleteRows.slice(0, 5).map((row, index) => ({
      id: `matrix-${row.id}`,
      kind: index === 0 ? '우선' : row.kindLabel,
      title: row.name,
      detail: `${row.status} · ${row.requiredKey}${row.hasLogo ? '' : ` · ${row.logoKeyPath}`}`,
      action: 'draft',
      actionLabel: '초안 보기',
      tone: row.kind,
    })),
    ...calendar.missingRows.slice(0, 2).map((row) => ({
      id: `calendar-${row.id}`,
      kind: '캘린더',
      title: row.raceName,
      detail: `${row.week} · ${row.missing.join(', ')} 보강 필요 · 준비도 ${row.readiness}%`,
      action: 'calendar',
      actionLabel: '캘린더',
      tone: 'calendar',
    })),
  ];

  if (!dataPack.eventCards) {
    queueRows.push({
      id: 'event-card',
      kind: '결과',
      title: '이벤트 카드 생성',
      detail: '필터 기준 단기 결과 카드를 만들어 결과 원장과 평균 레이팅을 확인하세요.',
      action: 'event-card',
      actionLabel: '생성',
      tone: 'result',
    });
  }

  if (!dataPack.seasonCards) {
    queueRows.push({
      id: 'season-card',
      kind: '시즌',
      title: '시즌 카드 생성',
      detail: '시즌 캘린더 전체 결과를 만들어 장기 데이터팩 출시 점수를 확인하세요.',
      action: 'season-card',
      actionLabel: '생성',
      tone: 'result',
    });
  }

  return {
    headline: incompleteRows.length
      ? `${incompleteRows[0].name}부터 ${incompleteRows[0].status} 항목을 보강하세요.`
      : dataPack.releaseScore < 90
        ? '이름/로고는 준비됐고 결과 카드 생성이 다음 단계입니다.'
        : '에셋과 결과 데이터팩이 배포 준비권입니다.',
    rows: queueRows.slice(0, 6),
  };
}

export default function RacingLogosDemoPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const { setMusicScene } = useGameBgm();
  const playGameSfx = useGameSfx({ theme: 'racing' });
  const [state, setStateInternal] = useState(() => createNewState());
  const stateRef = useRef(state);
  const [packText, setPackText] = useState(() => sampleLocalPackText());
  const [activeFeatureTabId, setActiveFeatureTabId] = useState('audit');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [actionResult, setActionResult] = useState('');
  const [actionPresentation, setActionPresentation] = useState(() => racingLogosResultPresentation(state, state));
  const musicSceneTimerRef = useRef(null);

  const tracks = useMemo(() => visibleTracks(state), [state]);
  const events = useMemo(() => visibleEvents(state), [state]);
  const allTracks = useMemo(() => buildTracks(state), [state]);
  const allEvents = useMemo(() => buildEvents(state), [state]);
  const audit = latestAudit(state);
  const packMatrix = useMemo(() => localPackMatrix(state), [state]);
  const calendar = useMemo(() => seasonCalendarReport(state), [state]);
  const dataPack = useMemo(() => dataPackReleaseReportForState(state), [state]);
  const logoDraftText = useMemo(() => buildLogoDraftText(state.localPack), [state.localPack]);
  const productionQueue = useMemo(
    () => buildAssetProductionQueue({ packMatrix, calendar, dataPack }),
    [packMatrix, calendar, dataPack],
  );
  const score = scoreState(state);
  const latestRaceCard = state.raceCards[0];
  const recentActionText = actionResult || state.log?.[0] || '아직 실행한 검수 결과가 없습니다.';
  const resultPresentation = racingLogosTextPresentation(recentActionText, actionPresentation);
  const baseMusicScene = useMemo(() => resolveRacingLogosBgmScene({
    activeTabId: activeFeatureTabId,
    eventCount: events.length,
    releaseScore: dataPack.releaseScore,
  }), [activeFeatureTabId, dataPack.releaseScore, events.length]);

  useEffect(() => {
    if (musicSceneTimerRef.current) window.clearTimeout(musicSceneTimerRef.current);
    musicSceneTimerRef.current = null;
    setMusicScene(baseMusicScene);
  }, [baseMusicScene, setMusicScene]);

  useEffect(() => () => {
    if (musicSceneTimerRef.current) window.clearTimeout(musicSceneTimerRef.current);
    setMusicScene('');
  }, [setMusicScene]);

  const playMusicTransition = (presentation, cue = '') => {
    const transition = racingLogosResultMusic(presentation, cue);
    if (!transition) return;
    if (musicSceneTimerRef.current) window.clearTimeout(musicSceneTimerRef.current);
    setMusicScene(transition.theme);
    musicSceneTimerRef.current = window.setTimeout(() => {
      setMusicScene(baseMusicScene);
      musicSceneTimerRef.current = null;
    }, transition.durationMs);
  };

  const applyRacingState = (updater) => {
    const previousState = stateRef.current;
    const nextState = typeof updater === 'function' ? updater(previousState) : updater;
    const presentation = racingLogosResultPresentation(previousState, nextState);
    stateRef.current = nextState;
    setStateInternal(nextState);
    setActionPresentation(presentation);
    setActionResult(presentation.detail || nextState.log?.[0] || '에셋 검수 상태를 갱신했습니다.');
    if (presentation.cue) playGameSfx(presentation.cue);
    playMusicTransition(presentation, presentation.cue);
    return nextState;
  };

  const publishResult = (nextMessage, cue = '') => {
    const presentation = racingLogosTextPresentation(nextMessage);
    setMessage(nextMessage);
    setActionResult(nextMessage);
    setActionPresentation(presentation);
    if (cue) playGameSfx(cue);
    playMusicTransition(presentation, cue);
  };

  const startNewRun = () => {
    const previousState = stateRef.current;
    const nextState = createNewState();
    stateRef.current = nextState;
    setStateInternal(nextState);
    setPackText(sampleLocalPackText());
    setActiveFeatureTabId('audit');
    setMessage('');
    setActionResult('새 레이싱 로고팩 검수를 시작했습니다.');
    setActionPresentation(racingLogosResultPresentation(previousState, nextState));
    playGameSfx('start');
    playMusicTransition({ key: 'newRun' }, 'start');
  };

  const applyTextPack = () => {
    const parsed = parseLocalPackText(packText);
    if (!parsed.ok) {
      publishResult(parsed.error, 'packInvalid');
      showToast({ tone: 'danger', message: parsed.error });
      return;
    }
    applyRacingState((current) => applyLocalPackAction(current, parsed.value));
    setMessage('로컬팩 JSON을 적용했습니다.');
  };

  const applyDraftPack = () => {
    const parsed = parseLocalPackText(logoDraftText);
    if (!parsed.ok) {
      publishResult(parsed.error, 'packInvalid');
      showToast({ tone: 'danger', message: parsed.error });
      return;
    }
    setPackText(logoDraftText);
    applyRacingState((current) => auditLogoPackAction(applyLocalPackAction(current, parsed.value, 'draft')));
    setActiveFeatureTabId('audit');
    setMessage('보강 JSON 초안을 적용하고 로고팩 감사를 실행했습니다.');
  };

  const showDraftPack = () => {
    setPackText(logoDraftText);
    setActiveFeatureTabId('local-pack');
    publishResult('보강 JSON 초안을 로컬팩 편집기에 불러왔습니다.', 'draftLoaded');
  };

  const runQueueAction = (item) => {
    if (item.action === 'draft') {
      showDraftPack();
      return;
    }
    if (item.action === 'calendar') {
      setActiveFeatureTabId('calendar');
      return;
    }
    if (item.action === 'event-card') {
      applyRacingState((current) => generateRaceCardAction(current));
      setActiveFeatureTabId('data-pack');
      return;
    }
    if (item.action === 'season-card') {
      applyRacingState((current) => generateSeasonCardAction(current));
      setActiveFeatureTabId('data-pack');
    }
  };

  const loadPublicLocalPack = async () => {
    if (busy) return;
    setBusy('local-pack');
    try {
      const res = await fetch('/local_pack/real_names.json', { cache: 'no-store' });
      if (!res.ok) {
        publishResult('public/local_pack/real_names.json을 찾지 못했습니다. 수동 JSON을 사용할 수 있습니다.', 'packInvalid');
        return;
      }
      const json = await res.json();
      setPackText(JSON.stringify(json, null, 2));
      applyRacingState((current) => applyLocalPackAction(current, json, 'fetch'));
      setMessage('public/local_pack/real_names.json을 불러왔습니다.');
    } catch (err) {
      publishResult(err?.message || '로컬팩을 불러오지 못했습니다.', 'packInvalid');
    } finally {
      setBusy('');
    }
  };

  const saveRun = async () => {
    if (!token || busy) {
      publishResult('로그인하면 Racing Logos Demo 검수 상태를 저장할 수 있습니다.');
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
      publishResult('Racing Logos Demo 검수 상태를 저장했습니다.');
      showToast({ tone: 'success', message: 'Racing Logos Demo 검수 상태를 저장했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '저장에 실패했습니다.';
      publishResult(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (!token || busy) {
      publishResult('로그인하면 저장된 Racing Logos Demo 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        publishResult('저장된 Racing Logos Demo 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const nextState = normalizeState(detail?.save?.payload?.state);
      stateRef.current = nextState;
      setStateInternal(nextState);
      setPackText(JSON.stringify(nextState.localPack, null, 2));
      publishResult('저장된 Racing Logos Demo 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 Racing Logos Demo 상태를 불러왔습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '불러오기에 실패했습니다.';
      publishResult(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (!token || busy) {
      publishResult('로그인하면 Racing Logos Demo 감사 결과를 전적에 남길 수 있습니다.');
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
      publishResult('Racing Logos Demo 감사 결과를 전적에 남겼습니다.');
      showToast({ tone: 'success', message: 'Racing Logos Demo 감사 결과를 전적에 남겼습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      publishResult(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const actions = (
    <>
      <GameControlButton action="new" cue="off" onClick={startNewRun}>새 검수</GameControlButton>
      <GameControlButton action="save" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</GameControlButton>
      <GameControlButton action="load" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</GameControlButton>
      <GameControlButton action="archive" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</GameControlButton>
      <Link className="game-control-button" data-game-sfx="nav" href="/myanime/racing-logos-demo">
        <GameActionIcon action="settings" label="상세" />
        <span className="game-action-button__label">상세</span>
      </Link>
    </>
  );

  const metrics = [
    { label: '트랙', value: `${tracks.length}/${allTracks.length}` },
    { label: '이벤트', value: `${events.length}/${allEvents.length}` },
    { label: '완성도', value: `${audit.completeness}%` },
    { label: '캘린더', value: `${calendar.averageReadiness}%` },
    { label: '데이터팩', value: `${dataPack.releaseScore}%` },
    { label: 'placeholder', value: audit.placeholderOnly },
    { label: '카드', value: state.raceCards.length },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 검수는 가능하지만 저장, 불러오기, 전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    audit.placeholderOnly > 0 ? { key: 'placeholder', text: '일부 트랙은 아직 공개 placeholder 로고만 사용합니다.' } : null,
  ];

  const guide = {
    title: '에셋 감사 코치',
    badge: `${audit.completeness}%`,
    primaryTitle: audit.placeholderOnly > 0 ? 'placeholder 로고 보강 필요' : '로컬팩 감사 안정',
    primaryText: audit.placeholderOnly > 0
      ? productionQueue.headline
      : '트랙/이벤트 로고가 대부분 연결되어 있습니다. 캘린더와 데이터팩 출시 점수를 확인하세요.',
    focusRows: [
      { label: '완성도', value: `${audit.completeness}%` },
      { label: 'placeholder', value: audit.placeholderOnly },
      { label: '캘린더', value: `${calendar.averageReadiness}%` },
      { label: '데이터팩', value: `${dataPack.releaseScore}%` },
    ],
    adviceLines: productionQueue.rows.slice(0, 4).map((item, index) => ({
      kind: index === 0 ? '우선' : item.kind,
      title: item.title,
      detail: item.detail,
    })),
  };

  return (
    <GamePlayShell
      className="racing-logos-page-shell"
      kicker="Racing Logos Demo"
      title="레이싱 로고팩 검수"
      description="업로드된 Racing Logos Demo의 core 트랙/이벤트 데이터, local pack 우선 로고 규칙, 공개 placeholder fallback을 사이트용 에셋 검수 루프로 이식했습니다."
      summaryLabel="로고팩 요약"
      summaryDensity="micro"
      primaryMetricLimit={8}
      heroLayout="compact"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameAdvisorPanel {...guide} compact minimal storageKey="racing-logos-asset-coach" />
      <RecentActionResult
        action={resultPresentation.action}
        label={resultPresentation.label}
        text={recentActionText}
        tone={resultPresentation.tone}
        pinned
      />

      <RacingLogosFeatureTabs
        activeFeatureTabId={activeFeatureTabId}
        allEvents={allEvents}
        allTracks={allTracks}
        applyDraftPack={applyDraftPack}
        applyTextPack={applyTextPack}
        audit={audit}
        busy={busy}
        calendar={calendar}
        dataPack={dataPack}
        events={events}
        latestRaceCard={latestRaceCard}
        loadPublicLocalPack={loadPublicLocalPack}
        packMatrix={packMatrix}
        packText={packText}
        productionQueue={productionQueue}
        recentActionText={recentActionText}
        resultPresentation={resultPresentation}
        runQueueAction={runQueueAction}
        score={score}
        setActiveFeatureTabId={setActiveFeatureTabId}
        setPackText={setPackText}
        setState={applyRacingState}
        showDraftPack={showDraftPack}
        state={state}
        tracks={tracks}
      />
    </GamePlayShell>
  );
}
