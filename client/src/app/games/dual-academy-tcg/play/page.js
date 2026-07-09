'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../../../components/SiteHeader';
import { useToast } from '../../../../components/ToastProvider';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GameAdvisorPanel from '../../_components/GameAdvisorPanel';
import { RecentActionResult } from '../../_components/GamePlayPrimitives';
import { useGameSfxEventHandlers } from '../../_lib/useGameSfx';
import DualAcademyTcgFeatureTabs from '../_components/DualAcademyTcgFeatureTabs';
import {
  TCG_GAME_SLUG,
  getTcgCharacter,
  normalizeTcgCharacters,
  renderTcgQuote,
} from '../_lib/tcgCatalog';
import {
  PLAYER_LABELS,
  activateFromHand,
  autoPlayEnemy,
  cardEffectCoverageReport,
  createDuelState,
  matchReportForState,
  normalSummon,
  replayExportForState,
  replayTimelineForState,
  setSpellTrap,
  turnAdvisorForState,
} from '../_lib/tcgDuelEngine';
import useDualAcademyTcgPersistence from '../_hooks/useDualAcademyTcgPersistence';
import { afterRender, buildZoneInspection } from '../_lib/tcgPlayPageRuntime';

import {
  CharacterPanel,
  PromptPanel,
  cardKind,
  firstEmptySlot,
  roomConcurrencyAudit,
} from '../_components/TcgPlayBoard';

export default function DualAcademyTcgPlayPage() {
  return (
    <Suspense fallback={(
      <main className="tcg-page-shell">
        <SiteHeader />
        <section className="tcg-arena">
          <div className="tcg-deck-message">매치를 불러오는 중입니다.</div>
        </section>
      </main>
    )}>
      <DualAcademyTcgPlayContent />
    </Suspense>
  );
}

function DualAcademyTcgPlayContent() {
  const mounted = useHydrated();
  const token = useAuthToken();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId') || '';
  const { showToast } = useToast();
  const [selectedHandId, setSelectedHandId] = useState('');
  const [selectedAttacker, setSelectedAttacker] = useState(null);
  const [zoneView, setZoneView] = useState(null);
  const [activeTcgTab, setActiveTcgTab] = useState('board');
  const [state, setState] = useState(() => createDuelState());
  const {
    handleGameSfxChangeCapture,
    handleGameSfxPointerDownCapture,
  } = useGameSfxEventHandlers();

  const {
    cardCatalog,
    deckMessage,
    deckName,
    loadingDeck,
    loadMatch,
    localRoomDirty,
    markDirty,
    recordMessage,
    reloadRoomMatch,
    resetMatch,
    room,
    roomBusy,
    roomSyncMessage,
    saveBusy,
    saveMatch,
    saveRoomMatch,
  } = useDualAcademyTcgPersistence({
    mounted,
    roomId,
    setSelectedAttacker,
    setSelectedHandId,
    setState,
    setZoneView,
    showToast,
    state,
    token,
  });

  const turnAdvisor = useMemo(() => turnAdvisorForState(state, 'player'), [state]);
  const advisorTone = turnAdvisor.riskLabel === '위험'
    ? 'red'
    : turnAdvisor.riskLabel === '주의'
      ? 'gold'
      : turnAdvisor.riskLabel === '종료'
        ? 'green'
        : 'violet';
  const matchReport = useMemo(() => matchReportForState(state), [state]);
  const replayTimeline = useMemo(() => replayTimelineForState(state), [state]);
  const replayExport = useMemo(() => replayExportForState(state), [state]);
  const effectCoverage = useMemo(() => cardEffectCoverageReport(cardCatalog), [cardCatalog]);
  const zoneInspection = useMemo(() => buildZoneInspection(state, turnAdvisor), [state, turnAdvisor]);
  const concurrencyAudit = useMemo(() => roomConcurrencyAudit({
    roomId,
    room,
    localRoomDirty,
    roomSyncMessage,
    roomBusy,
  }), [localRoomDirty, room, roomBusy, roomId, roomSyncMessage]);
  useEffect(() => {
    if (state.turnPlayer !== 'enemy') return;
    if (state.prompt.kind === 'RESPOND' && state.prompt.player !== 'enemy') return;
    const timer = window.setTimeout(() => {
      setState((current) => autoPlayEnemy(current));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [state.turnPlayer, state.phase, state.prompt.kind, state.prompt.player, state.chain.length]);

  const duelCharacters = normalizeTcgCharacters(state.characters);
  const playerCharacter = getTcgCharacter(duelCharacters.player, 'YUUKA');
  const enemyCharacter = getTcgCharacter(duelCharacters.enemy, 'HINA');
  const latestEvent = Array.isArray(state.events) ? state.events[0] : null;
  const latestActor = latestEvent?.actor === 'enemy' ? 'enemy' : 'player';
  const latestCharacter = latestActor === 'enemy' ? enemyCharacter : playerCharacter;
  const latestQuote = latestEvent ? renderTcgQuote(latestCharacter, latestEvent) : '이벤트 대기 중입니다.';
  const recentActionText = latestEvent
    ? `T${latestEvent.turn} · ${latestEvent.phase} · ${PLAYER_LABELS[latestEvent.actor] || latestEvent.actor}: ${latestEvent.text}`
    : state.log?.[0] || deckMessage || '아직 실행한 듀얼 액션이 없습니다.';
  const selectedCard = state.players.player.hand.find((card) => card.instanceId === selectedHandId) || null;
  const canAct = !state.winner && state.turnPlayer === 'player' && state.prompt.kind === 'NONE' && state.chain.length === 0;
  const canMain = canAct && (state.phase === 'MAIN1' || state.phase === 'MAIN2');
  const canAutoPlayPlayer = !state.winner
    && (state.turnPlayer === 'player' || state.prompt.player === 'player')
    && !(state.prompt.kind === 'NONE' && state.chain.length > 0);
  const promptTargets = useMemo(() => {
    const out = new Set();
    if (state.prompt.kind === 'SELECT_TARGET') {
      state.prompt.options.forEach((opt) => out.add(`${opt.player}:${opt.zone}:${opt.slot}`));
    }
    return out;
  }, [state.prompt]);
  const monsterEffectRows = useMemo(() => (
    state.players.player.monster
      .map((card, slot) => ({ card, slot }))
      .filter(({ card }) => card?.id === 'GEH-HINA-01' || card?.id === 'MIL-YUUKA-01')
      .map(({ card, slot }) => {
        const isHina = card.id === 'GEH-HINA-01';
        const key = isHina ? 'GEH-HINA-01:HINA_IGNITION_2' : 'MIL-YUUKA-01:YUUKA_IGNITION_2';
        const used = Boolean(state.players.player.flags.usedEffects?.[key]);
        const disabled = !canMain || used || (isHina && Number(state.players.player.lp || 0) <= 800);
        return {
          id: `${card.id}-${slot}`,
          slot,
          name: card.name,
          disabled,
          label: isHina ? `히나 ② · M${slot + 1}` : `유우카 ② · M${slot + 1}`,
          detail: isHina ? 'LP 800 지불, 필드 카드 1장 파괴' : '자신 필드 카드 DATA +1 / 보호막',
          action: isHina ? 'hina' : 'yuuka',
          status: used ? '사용됨' : disabled ? '대기' : '발동 가능',
        };
      })
  ), [canMain, state.players.player.flags.usedEffects, state.players.player.lp, state.players.player.monster]);

  useEffect(() => {
    if (!selectedHandId) return;
    if (!state.players.player.hand.some((card) => card.instanceId === selectedHandId)) {
      afterRender(() => setSelectedHandId(''));
    }
  }, [selectedHandId, state.players.player.hand]);

  const act = (mutator) => {
    markDirty();
    setState((current) => mutator(current));
  };

  const downloadReplayExport = useCallback(() => {
    if (typeof window === 'undefined') return;
    const blob = new Blob([replayExport.jsonText], { type: 'application/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = replayExport.fileName;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    showToast({ tone: 'success', message: `리플레이 파일을 준비했습니다. (${replayExport.sizeLabel})` });
  }, [replayExport, showToast]);

  const playSelected = () => {
    if (!selectedCard || !canMain) return;
    if (cardKind(selectedCard) === 'Monster') {
      const slot = firstEmptySlot(state.players.player.monster);
      if (slot >= 0) act((current) => normalSummon(current, selectedCard.instanceId, slot));
      setSelectedHandId('');
      return;
    }
    if (cardKind(selectedCard) === 'Trap') {
      const slot = firstEmptySlot(state.players.player.spellTrap);
      if (slot >= 0) act((current) => setSpellTrap(current, selectedCard.instanceId, slot));
      setSelectedHandId('');
      return;
    }
    act((current) => activateFromHand(current, selectedCard.instanceId));
    setSelectedHandId('');
  };

  const updateCharacter = (player, characterId) => {
    markDirty();
    setState((current) => ({
      ...current,
      characters: normalizeTcgCharacters({
        ...current.characters,
        [player]: characterId,
      }),
    }));
  };

  const openZoneView = (player, zone, reveal = true) => {
    setZoneView({ player, zone, reveal });
    setActiveTcgTab('logs');
  };

  const tcgGuide = {
    title: '턴 코치',
    badge: `${turnAdvisor.riskLabel} ${turnAdvisor.readinessPct}%`,
    primaryTitle: state.winner ? `${PLAYER_LABELS[state.winner]} 승리` : turnAdvisor.recommendedAction,
    primaryText: state.winner
      ? '매치 리포트와 리플레이를 확인한 뒤 저장하거나 새 매치를 시작하세요.'
      : turnAdvisor.headline,
    focusRows: [
      { label: '차례', value: state.winner ? '종료' : `${PLAYER_LABELS[state.turnPlayer]} ${state.phase}` },
      { label: '내 LP', value: state.players.player.lp },
      { label: 'AI LP', value: state.players.enemy.lp },
      { label: '보드', value: turnAdvisor.boardDelta >= 0 ? `+${turnAdvisor.boardDelta}` : turnAdvisor.boardDelta },
    ],
    adviceLines: turnAdvisor.recommendations.slice(0, 4).map((item, index) => ({
      kind: item.priority === 'high' ? '우선' : `${index + 1}순위`,
      title: item.title,
      detail: item.detail,
    })),
  };

  return (
    <main
      className="tcg-page-shell"
      onChangeCapture={handleGameSfxChangeCapture}
      onPointerDownCapture={handleGameSfxPointerDownCapture}
    >
      <SiteHeader />
      <section className="tcg-arena">
        <header className="tcg-topbar">
          <div>
            <p>Dual Academy TCG</p>
            <h1>v13 듀얼</h1>
          </div>
          <nav>
            <Link href="/myanime/dual-academy-tcg">상세</Link>
            <Link href="/myanime/dual-academy-tcg/deck">덱 편집</Link>
            <Link href="/board?category=game&gameSlug=dual-academy-tcg">게시판</Link>
            <button type="button" onClick={saveMatch} disabled={saveBusy}>저장</button>
            <button type="button" onClick={loadMatch} disabled={saveBusy}>불러오기</button>
            {roomId ? <Link href={`/games/rooms/${roomId}`}>게임방</Link> : <Link href={`/games/rooms?gameSlug=${TCG_GAME_SLUG}&create=1`}>방 만들기</Link>}
            {roomId ? <button type="button" onClick={saveRoomMatch} disabled={roomBusy}>방 저장</button> : null}
            {roomId ? <button type="button" onClick={reloadRoomMatch} disabled={roomBusy}>방 불러오기</button> : null}
            <button type="button" onClick={downloadReplayExport}>리플레이 저장</button>
            <button type="button" onClick={resetMatch}>새 매치</button>
          </nav>
        </header>

        {roomId ? (
          <section className="tcg-room-banner">
            <div>
              <strong>{room?.title || '게임방 매치'}</strong>
              <span>{room?.status || 'loading'} · rev {Number(room?.revision || 0)}{localRoomDirty ? ' · 로컬 변경 있음' : ''}</span>
              {roomSyncMessage ? <small>{roomSyncMessage}</small> : null}
            </div>
            <Link href={`/games/rooms/${roomId}`}>로비로 이동</Link>
          </section>
        ) : null}

        <section className="tcg-scoreboard" aria-label="match status">
          <div>
            <span>내 LP</span>
            <strong>{state.players.player.lp}</strong>
          </div>
          <div>
            <span>AI LP</span>
            <strong>{state.players.enemy.lp}</strong>
          </div>
          <div>
            <span>턴</span>
            <strong>{state.turn}</strong>
          </div>
          <div>
            <span>차례</span>
            <strong>{PLAYER_LABELS[state.turnPlayer]}</strong>
          </div>
          <div>
            <span>페이즈</span>
            <strong>{state.phase}</strong>
          </div>
          <div>
            <span>체인</span>
            <strong>{state.chain.length}</strong>
          </div>
        </section>

        <GameAdvisorPanel {...tcgGuide} />
        <RecentActionResult label="최근 듀얼 이벤트" text={recentActionText} pinned />

        <section className="tcg-character-strip" aria-label="duel characters">
          <CharacterPanel
            label="P1"
            profile={playerCharacter}
            value={duelCharacters.player}
            active={latestActor === 'player'}
            quote={latestActor === 'player' ? latestQuote : ''}
            onChange={(characterId) => updateCharacter('player', characterId)}
          />
          <CharacterPanel
            label="AI"
            profile={enemyCharacter}
            value={duelCharacters.enemy}
            active={latestActor === 'enemy'}
            quote={latestActor === 'enemy' ? latestQuote : ''}
            onChange={(characterId) => updateCharacter('enemy', characterId)}
          />
        </section>

        {state.winner ? (
          <section className={`tcg-result is-${state.winner}`}>
            {state.winner === 'player' ? '승리했습니다.' : '패배했습니다.'}
            {recordMessage ? <span>{recordMessage}</span> : null}
          </section>
        ) : null}

        <PromptPanel state={state} setState={(updater) => {
          markDirty();
          setState(updater);
        }} />

        <DualAcademyTcgFeatureTabs
          act={act}
          activeTcgTab={activeTcgTab}
          advisorTone={advisorTone}
          canAct={canAct}
          canAutoPlayPlayer={canAutoPlayPlayer}
          canMain={canMain}
          concurrencyAudit={concurrencyAudit}
          deckMessage={deckMessage}
          deckName={deckName}
          downloadReplayExport={downloadReplayExport}
          effectCoverage={effectCoverage}
          latestCharacter={latestCharacter}
          latestQuote={latestQuote}
          loadingDeck={loadingDeck}
          matchReport={matchReport}
          monsterEffectRows={monsterEffectRows}
          openZoneView={openZoneView}
          playSelected={playSelected}
          promptTargets={promptTargets}
          replayExport={replayExport}
          replayTimeline={replayTimeline}
          selectedAttacker={selectedAttacker}
          selectedCard={selectedCard}
          selectedHandId={selectedHandId}
          setActiveTcgTab={setActiveTcgTab}
          setSelectedAttacker={setSelectedAttacker}
          setSelectedHandId={setSelectedHandId}
          setState={setState}
          setZoneView={setZoneView}
          state={state}
          turnAdvisor={turnAdvisor}
          zoneInspection={zoneInspection}
          zoneView={zoneView}
        />
      </section>
    </main>
  );
}
