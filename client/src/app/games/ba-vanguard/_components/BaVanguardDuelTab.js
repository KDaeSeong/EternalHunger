import { GameControlButton, RecentActionResult, SmallStat } from '../../_components/GamePlayPrimitives';
import { BattlePanel, Field, ZoneExplorer } from './BaVanguardBoard';
import { BaVanguardPanelTitle } from './BaVanguardVisuals';
import { PRESET_DECKS, SIDE_LABELS } from '../_lib/baVanguardCatalog';

export default function BaVanguardDuelTab(props) {
  const {
    autoGuardMe,
    autoRideState,
    canControl,
    canMulligan,
    deck,
    duel,
    gzoneFilter,
    markRoomDirty,
    me,
    nextPhase,
    onAutoRide,
    onGGuard,
    onGuardAdd,
    onGuardEnd,
    onMulligan,
    onMyCircleClick,
    onOppCircleClick,
    onStride,
    onVCAct,
    openZone,
    opp,
    opponentPresetId,
    presetId,
    recentDuelText,
    resultPresentation,
    rules,
    runAiUntilStop,
    seed,
    selectedAttacker,
    selectedHandId,
    setAutoGuardMe,
    setGzoneFilter,
    setOpponentPresetId,
    setPresetId,
    setRuleOption,
    setSeed,
    setZoneView,
    startNewDuel,
    zoneView,
  } = props;

  return (
    <>
      <section className="games-detail-grid">
        <section className="games-panel">
          <BaVanguardPanelTitle action="settings" title="플레이 설정" meta={deck.clan} />
          <label className="game-save-json-field">
            <span>내 프리셋</span>
            <select value={presetId} onChange={(event) => {
              markRoomDirty();
              setPresetId(event.target.value);
            }}>
              {PRESET_DECKS.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>AI 프리셋</span>
            <select value={opponentPresetId} onChange={(event) => {
              markRoomDirty();
              setOpponentPresetId(event.target.value);
            }}>
              {PRESET_DECKS.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>시드</span>
            <input value={seed} onChange={(event) => {
              markRoomDirty();
              setSeed(Number(event.target.value) || 0);
            }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontWeight: 900 }}>
            <input type="checkbox" checked={autoGuardMe} onChange={(event) => {
              markRoomDirty();
              setAutoGuardMe(event.target.checked);
            }} />
            내 방어 자동 처리
          </label>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontWeight: 900 }}>
              <input type="checkbox" checked={rules.allowMixedClan} onChange={(event) => setRuleOption('allowMixedClan', event.target.checked)} />
              학원(클랜) 혼합 허용
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontWeight: 900 }}>
              <input type="checkbox" checked={rules.firstTurnNoDraw} onChange={(event) => setRuleOption('firstTurnNoDraw', event.target.checked)} />
              선공 1턴 드로우/공격 제한
            </label>
            <p style={{ margin: 0, color: '#94a3b8', fontWeight: 800, lineHeight: 1.45 }}>
              룰 옵션은 덱 검증과 새 듀얼 시작부터 적용됩니다.
            </p>
          </div>
          <div className="game-save-actions" style={{ marginTop: 12 }}>
            <GameControlButton action="new" cue="off" onClick={() => startNewDuel(seed)}>설정으로 재시작</GameControlButton>
            <GameControlButton action="advance" cue="off" onClick={() => runAiUntilStop(true)}>AI 진행</GameControlButton>
          </div>
        </section>

        <section className="games-panel">
          <BaVanguardPanelTitle
            action="turn"
            title="진행 컨트롤"
            meta={duel.winner ? `${SIDE_LABELS[duel.winner]} 승리` : `${SIDE_LABELS[duel.active]} 차례`}
          />
          <div className="games-rank-split">
            <SmallStat label="선공 제한" value={rules.firstTurnNoDraw ? 'ON' : 'OFF'} />
            <SmallStat label="혼합 클랜" value={rules.allowMixedClan ? '허용' : '금지'} />
            <SmallStat label="패" value={`${me.hand.length}/${opp.hand.length}`} />
            <SmallStat label="덱" value={`${me.deck.length}/${opp.deck.length}`} />
          </div>
          <div className="game-save-actions" style={{ marginTop: 12 }}>
            <GameControlButton action="advance" cue="off" onClick={nextPhase} disabled={Boolean(duel.winner || duel.battle)}>다음 페이즈</GameControlButton>
            <GameControlButton action="shuffle" cue="off" onClick={onMulligan} disabled={!canMulligan}>멀리건</GameControlButton>
            <GameControlButton
              action="ride"
              cue="off"
              onClick={onAutoRide}
              disabled={!autoRideState.canRide}
              title={autoRideState.canRide ? autoRideState.detail : autoRideState.reason}
            >
              {autoRideState.source === 'assist' ? '라이드 어시스트' : '자동 라이드'}
            </GameControlButton>
            <GameControlButton action="vanguard-stride" cue="off" onClick={onStride} disabled={!canControl || duel.phase !== 'MAIN'}>스트라이드</GameControlButton>
            <GameControlButton action="vanguard-skill" cue="off" onClick={onVCAct} disabled={!canControl || duel.phase !== 'MAIN'}>VC 스킬</GameControlButton>
          </div>
          <p style={{ margin: '10px 0 0', color: autoRideState.canRide ? '#a7f3d0' : '#94a3b8', fontWeight: 800, lineHeight: 1.45 }}>
            {autoRideState.canRide ? autoRideState.detail : autoRideState.reason}
          </p>
          {selectedAttacker ? <p style={{ color: '#cbd5e1', fontWeight: 800 }}>공격자 {selectedAttacker} 선택 중입니다. AI 필드의 목표를 누르세요.</p> : null}
          <RecentActionResult
            action={resultPresentation.action}
            label={resultPresentation.label}
            text={recentDuelText}
            tone={resultPresentation.tone}
          />
        </section>

        <BattlePanel
          battle={duel.battle}
          selectedHandId={selectedHandId}
          onGuardAdd={onGuardAdd}
          onGGuard={onGGuard}
          onGuardEnd={onGuardEnd}
        />
      </section>

      <section className="games-detail-grid">
        <Field
          title="AI 필드"
          player={opp}
          side="opp"
          selectedAttacker={selectedAttacker}
          zoneView={zoneView}
          onCircleClick={onOppCircleClick}
          onZoneClick={openZone}
        />
        <Field
          title="내 필드"
          player={me}
          side="me"
          selectedAttacker={selectedAttacker}
          zoneView={zoneView}
          onCircleClick={onMyCircleClick}
          onZoneClick={openZone}
        />
      </section>

      <ZoneExplorer
        duel={duel}
        zoneView={zoneView}
        gzoneFilter={gzoneFilter}
        onFilterChange={setGzoneFilter}
        onClose={() => setZoneView(null)}
      />
    </>
  );
}
