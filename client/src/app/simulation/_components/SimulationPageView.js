'use client';

import Link from 'next/link';
import SiteHeader from '../../../components/SiteHeader';
import { getRuleset } from '../../../utils/rulesets';
import { normalizeMatchMode } from '../_lib/matchRosterRuntime';
import { formatClock } from '../_lib/simulationFormattingRuntime';
import {
  extractActorNameFromLog,
  getAliveTeams,
  getTimeOfDayFromPhase,
} from '../_lib/simulationEngine';
import SimulationControlPanel from './SimulationControlPanel';
import SimulationLogPanel from './SimulationLogPanel';
import SimulationMarketPanel from './SimulationMarketPanel';
import SimulationMatchStatusPanel from './SimulationMatchStatusPanel';
import SimulationMinimapPanel from './SimulationMinimapPanel';
import SimulationResultModal from './SimulationResultModal';
import SimulationSurvivorBoard from './SimulationSurvivorBoard';
import SimulationWorldSpawnToolbar from './SimulationWorldSpawnToolbar';

export default function SimulationPageView({
  acceptTradeOffer,
  activeMap,
  activeMapId,
  activeViewerPerkBundle,
  addLog,
  applyParticipantPresetToCurrent,
  actorAvatarByName,
  assistCounts,
  autoPlay,
  autoSpeed,
  candidateSurvivors,
  cancelTradeOffer,
  characterSkillsEnabled,
  closeUiModal,
  createTradeOffer,
  craftables,
  creditSourceSummary,
  credits,
  day,
  dead,
  deleteSelectedParticipantPreset,
  detonationRiskSummary,
  devEventPreviewLimit,
  devForceUseConsumable,
  devGrantItemId,
  devGrantItemOptions,
  devGrantItemToSelected,
  devGrantQty,
  devGrantSearch,
  doCraft,
  doDroneBuy,
  doHyperloopJump,
  doKioskTransaction,
  doPerkPurchase,
  droneOffers,
  exportBattleLog,
  fireAndReport,
  forbiddenAddedNow,
  forbiddenNow,
  gainDetailSummary,
  gainSourceSummary,
  gameEndReason,
  getQty,
  getTeamStateForActor,
  getZoneName,
  handleCharacterSkillsToggle,
  handleMatchModeChange,
  hyperloopCharId,
  hyperloopDestId,
  hyperloopDestIds,
  hyperloopPadName,
  hyperloopPadZoneId,
  hyperloopZoneSet,
  inventoryOptions,
  isAdvancing,
  isGameOver,
  isRefreshingMapSettings,
  isSelectedCharOnHyperloopPad,
  itemNameById,
  killCounts,
  kiosks,
  loadMarket,
  loadTrades,
  loading,
  logBoxMaxH,
  logBoxRef,
  logWindowRef,
  logs,
  mapRefreshToast,
  maps,
  marketCardRenderLimit,
  marketMessage,
  marketTab,
  matchSec,
  myTradeOffers,
  objectiveSummary,
  onToggleDevTools = () => {},
  ownedPerkCodeSet,
  participantPresetName,
  participantPresets,
  pendingTranscendPick,
  phase,
  prevPhaseLogs,
  proceedPhaseGuarded,
  publicItems,
  publicPerks,
  recentPings,
  refreshMapSettingsFromServer,
  resolvePendingTranscendPick,
  resultSummary,
  runActionSummary,
  runEvents,
  runEventsPreviewText,
  runProgressSummary,
  runSeed,
  runSupportSummary,
  saveCurrentParticipantPreset,
  saveSelectedParticipantPresetId,
  seedDraft,
  selectedChar,
  selectedCharId,
  selectedDevGrantItem,
  selectedParticipantPresetId,
  setAutoPlay,
  setDevGrantItemId,
  setDevGrantQty,
  setDevGrantSearch,
  setEquipForSurvivor,
  setHyperloopDestId,
  setMarketTab,
  setParticipantPresetName,
  setQty,
  setRunSeed,
  setSeedDraft,
  setSelectedCharId,
  setShowAllMarketRows,
  setShowDevDebugDetails,
  setShowDevEventLog,
  setShowDetailedLogs,
  setShowMarketPanel,
  setShowPrevLogs,
  setShowResultModal,
  setTradeDraft,
  setTradeWantSearch,
  setUiModal,
  settings,
  showAllMarketRows,
  showDevDebugDetails,
  showDevEventLog,
  showDetailedLogs,
  showMarketPanel,
  showPrevLogs,
  showResultModal,
  simulationDiagnostics,
  simulationDiagnosticsLine,
  specialSourceSummary,
  spawnState,
  startBlocked,
  startBlockedText,
  survivors,
  syncMyState,
  topRankedCharacters,
  tradeDraft,
  tradeOffers,
  tradeWantItemOptions,
  tradeWantSearch,
  uiModal,
  updateAutoSpeed,
  viewerLp,
  viewerPerks,
  visibleCraftables,
  visibleDevGrantItemOptions,
  visibleDroneOffers,
  visibleKiosks,
  visibleMyTradeOffers,
  visiblePublicPerks,
  visibleTradeOffers,
  winner,
  zones,
  zoneEdges,
  zonePos,
}) {
  const timeOfDay = getTimeOfDayFromPhase(phase);
  const actionDisabled = loading || isAdvancing || startBlocked || (showMarketPanel && !!pendingTranscendPick);
  const aliveTeamCount = getAliveTeams(survivors).length;
  const primaryProceedLabel = (() => {
    if (loading) return '로딩 중...';
    if (isAdvancing) return '진행 중...';
    if (startBlocked) return startBlockedText || '시작 조건 부족';
    if (isGameOver) return '다시 하기';
    if (day === 0) return '게임 시작';
    if (aliveTeamCount <= 1) return '결과 확인';
    if (phase === 'morning') return day >= 6 ? '서든데스' : '밤 진행';
    return day >= 6 ? '서든데스' : '낮 진행';
  })();

  return (
    <main className="simulation-page">
      <SiteHeader className="simulation-site-header" />

      {uiModal ? (
        <div
          className="eh-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeUiModal();
          }}
        />
      ) : null}

      <div className={`simulation-container modal-layout ${showMarketPanel ? 'devtools-open' : ''}`}>
        <SimulationSurvivorBoard
          activeMap={activeMap}
          closeUiModal={closeUiModal}
          day={day}
          dead={dead}
          forbiddenNow={forbiddenNow}
          getTeamStateForActor={getTeamStateForActor}
          getZoneName={getZoneName}
          killCounts={killCounts}
          phase={phase}
          settings={settings}
          survivors={survivors}
          timeOfDay={timeOfDay}
          uiModal={uiModal}
          zones={zones}
        />
        {/* 게임 화면 */}
        <section className={`game-screen ${phase === 'morning' ? 'morning-mode' : 'night-mode'}`}>
          <div className="screen-header">
            <Link href="/" className="simulation-mobile-logo" aria-label="ETERNAL HUNGER 메인">
              <span className="logo-top">ETERNAL</span>
              <span className="logo-main">HUNGER</span>
            </Link>
            <h1>{day === 0 ? 'GAME READY' : `DAY ${day} - ${timeOfDay === 'day' ? 'DAY' : 'NIGHT'}`}</h1>
            <div className="screen-header-right">
              <span className="weather-badge">{timeOfDay === 'day' ? '☀ 낮' : '🌙 밤'}</span>
              <span className="weather-badge">⏱ {formatClock(matchSec)}</span>

              {isGameOver ? (
                <button
                  className="btn-restart sim-header-proceed"
                  type="button"
                  onClick={() => window.location.reload()}
                >
                  {primaryProceedLabel}
                </button>
              ) : (
                <button
                  className="btn-proceed sim-header-proceed"
                  type="button"
                  onClick={proceedPhaseGuarded}
                  disabled={actionDisabled}
                  title={startBlocked ? startBlockedText : '현재 페이즈를 진행합니다.'}
                >
                  {primaryProceedLabel}
                </button>
              )}

              <button
                className="btn-secondary sim-mobile-core-btn"
                onClick={() => setUiModal('map')}
                disabled={loading || isAdvancing}
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                🗺️ 미니맵
              </button>
              <button
                className="btn-secondary sim-mobile-core-btn"
                onClick={() => setUiModal('chars')}
                disabled={loading || isAdvancing}
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                👥 캐릭터
              </button>
              <button
                className="btn-secondary sim-mobile-core-btn"
                onClick={() => setUiModal('log')}
                disabled={loading || isAdvancing}
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                🧾 로그
              </button>

              <button
                className={`btn-secondary sim-devtools-btn ${showMarketPanel ? 'active' : ''}`}
                onClick={onToggleDevTools}
                style={{ padding: '6px 10px', fontSize: 12 }}
                title="상점/조합/교환 및 테스트용 개발자 도구를 엽니다."
              >
                {showMarketPanel ? '🛠 도구 닫기' : '🛠 개발자'}
              </button>

              <button
                className="btn-secondary sim-refresh-btn"
                onClick={() => { void fireAndReport('refreshMapSettings.manual', () => refreshMapSettingsFromServer('manual')); }}
                disabled={loading || isAdvancing || isGameOver}
                style={{ padding: '6px 10px', fontSize: 12 }}
                title="서버에 저장된 맵 설정(crateAllowDeny 등)을 새로 불러옵니다."
              >
                {isRefreshingMapSettings ? '⏳ 새로고침 중...' : '🔄 맵 새로고침'}
              </button>

              {/* 🌀 하이퍼루프: 맵 내 장치(패드) 상호작용은 미니맵 아래에서 제공 */}

              {mapRefreshToast ? (
                <span
                  className="weather-badge"
                  style={{ fontSize: 12, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  title={mapRefreshToast.text}
                >
                  {mapRefreshToast.kind === 'error' ? '⚠️' : '✅'} {mapRefreshToast.text}
                </span>
              ) : null}
            </div>
          </div>

          {detonationRiskSummary?.visible ? (
            <div className="forbidden-top-bar">
              <span className="fz-title">🚫 금지구역</span>
              <span className="fz-chip" title="6번째 밤부터는 교전을 강하게 유도(서든데스)하고, 마지막 1명 생존 시 게임이 종료됩니다.">
                🔥 서든데스: <b>6번째 밤 이후</b>
              </span>
              <span className="fz-chip" title={detonationRiskSummary?.fzHoverText || '현재 금지구역 없음'}>금지 <b>{detonationRiskSummary?.forbiddenCnt || 0}</b> / 전체 <b>{detonationRiskSummary?.total || 0}</b> · 안전 <b>{detonationRiskSummary?.safeLeft || 0}</b></span>
              <span
                className={`fz-chip ${(detonationRiskSummary?.riskyCount || 0) > 0 ? 'fz-danger' : ''}`}
                title={detonationRiskSummary?.riskyTitle || '폭발 타이머 임계치 이하 생존자 수'}
              >
                ⚠️ 위험 <b>{detonationRiskSummary?.riskyCount || 0}</b>명
              </span>
              {Array.isArray(forbiddenAddedNow) && forbiddenAddedNow.length ? (
                <span className="fz-chip fz-danger" title={`이번 진행에서 새로 금지된 구역: ${forbiddenAddedNow.map((z) => getZoneName(z)).join(', ')}`}>
                  +{forbiddenAddedNow.length} 신규 금지
                </span>
              ) : null}
              {detonationRiskSummary?.willForceAllThisPhase ? (
                <span className="fz-chip fz-danger" title="안전구역이 1~2개 남은 상태에서 현 페이즈 길이가 기준 이상이면 폭발이 전 구역에 적용됩니다.">
                  ☢️ 이번 페이즈 전구역 폭발 가능
                </span>
              ) : null}
            </div>
          ) : null}


          <div className="simulation-stage">
            <div className="simulation-battlefield-column">
              <SimulationWorldSpawnToolbar
                activeMapId={activeMapId}
                day={day}
                spawnState={spawnState}
                zones={zones}
              />

              <SimulationMinimapPanel
                activeMapId={activeMapId}
                closeUiModal={closeUiModal}
                day={day}
                dead={dead}
                doHyperloopJump={doHyperloopJump}
                forbiddenNow={forbiddenNow}
                getTeamStateForActor={getTeamStateForActor}
                getZoneName={getZoneName}
                hyperloopCharId={hyperloopCharId}
                hyperloopDestId={hyperloopDestId}
                hyperloopDestIds={hyperloopDestIds}
                hyperloopPadName={hyperloopPadName}
                hyperloopPadZoneId={hyperloopPadZoneId}
                hyperloopZoneSet={hyperloopZoneSet}
                isAdvancing={isAdvancing}
                isGameOver={isGameOver}
                isSelectedCharOnHyperloopPad={isSelectedCharOnHyperloopPad}
                loading={loading}
                maps={maps}
                recentPings={recentPings}
                selectedCharId={selectedCharId}
                setHyperloopDestId={setHyperloopDestId}
                survivors={survivors}
                uiModal={uiModal}
                zones={zones}
                zoneEdges={zoneEdges}
                zonePos={zonePos}
              />
            </div>

            <aside className="simulation-side-column" aria-label="Simulation status and logs">
              <SimulationMatchStatusPanel
                day={day}
                phase={phase}
                matchSec={formatClock(matchSec)}
                survivors={survivors}
                dead={dead}
                killCounts={killCounts}
                activeMap={activeMap}
                zones={zones}
                forbiddenNow={forbiddenNow}
                spawnState={spawnState}
                getZoneName={getZoneName}
              />

              <SimulationLogPanel
                uiModal={uiModal}
                closeUiModal={closeUiModal}
                day={day}
                activeMap={activeMap}
                zones={zones}
                forbiddenNow={forbiddenNow}
                forbiddenAddedNow={forbiddenAddedNow}
                settings={settings}
                getRuleset={getRuleset}
                getZoneName={getZoneName}
                prevPhaseLogs={prevPhaseLogs}
                showPrevLogs={showPrevLogs}
                setShowPrevLogs={setShowPrevLogs}
                logs={logs}
                showDetailedLogs={showDetailedLogs}
                setShowDetailedLogs={setShowDetailedLogs}
                logWindowRef={logWindowRef}
                logBoxRef={logBoxRef}
                logBoxMaxH={logBoxMaxH}
                actorAvatarByName={actorAvatarByName}
                extractActorNameFromLog={extractActorNameFromLog}
              />
            </aside>
          </div>

          <SimulationControlPanel
            matchMode={normalizeMatchMode(settings?.matchMode)}
            onMatchModeChange={handleMatchModeChange}
            matchModeDisabled={loading || isAdvancing || day !== 0}
            characterSkillsEnabled={characterSkillsEnabled}
            onCharacterSkillsToggle={handleCharacterSkillsToggle}
            characterSkillsDisabled={loading || isAdvancing}
            isGameOver={isGameOver}
            onRestart={() => window.location.reload()}
            onProceed={proceedPhaseGuarded}
            actionDisabled={actionDisabled}
            loading={loading}
            isAdvancing={isAdvancing}
            startBlocked={startBlocked}
            startBlockedText={startBlockedText}
            day={day}
            phase={phase}
            aliveTeamCount={aliveTeamCount}
            showMarketPanel={showMarketPanel}
            onToggleDevTools={onToggleDevTools}
            autoPlay={autoPlay}
            onToggleAutoPlay={() => setAutoPlay((v) => !v)}
            autoDisabled={loading || isGameOver || startBlocked}
            autoSpeed={autoSpeed}
            onAutoSpeedChange={updateAutoSpeed}
            speedDisabled={loading || isGameOver}
          />

        </section>

        <SimulationMarketPanel
          acceptTradeOffer={acceptTradeOffer}
          activeViewerPerkBundle={activeViewerPerkBundle}
          addLog={addLog}
          applyParticipantPresetToCurrent={applyParticipantPresetToCurrent}
          candidateSurvivors={candidateSurvivors}
          cancelTradeOffer={cancelTradeOffer}
          createTradeOffer={createTradeOffer}
          craftables={craftables}
          credits={credits}
          day={day}
          deleteSelectedParticipantPreset={deleteSelectedParticipantPreset}
          devEventPreviewLimit={devEventPreviewLimit}
          devForceUseConsumable={devForceUseConsumable}
          devGrantItemId={devGrantItemId}
          devGrantItemOptions={devGrantItemOptions}
          devGrantItemToSelected={devGrantItemToSelected}
          devGrantQty={devGrantQty}
          devGrantSearch={devGrantSearch}
          doCraft={doCraft}
          doDroneBuy={doDroneBuy}
          doKioskTransaction={doKioskTransaction}
          doPerkPurchase={doPerkPurchase}
          droneOffers={droneOffers}
          exportBattleLog={exportBattleLog}
          fireAndReport={fireAndReport}
          getQty={getQty}
          getZoneName={getZoneName}
          inventoryOptions={inventoryOptions}
          isAdvancing={isAdvancing}
          isGameOver={isGameOver}
          itemNameById={itemNameById}
          kiosks={kiosks}
          loadMarket={loadMarket}
          loadTrades={loadTrades}
          marketCardRenderLimit={marketCardRenderLimit}
          marketMessage={marketMessage}
          marketTab={marketTab}
          matchSec={matchSec}
          myTradeOffers={myTradeOffers}
          ownedPerkCodeSet={ownedPerkCodeSet}
          participantPresetName={participantPresetName}
          participantPresets={participantPresets}
          pendingTranscendPick={pendingTranscendPick}
          publicItems={publicItems}
          publicPerks={publicPerks}
          resolvePendingTranscendPick={resolvePendingTranscendPick}
          runActionSummary={runActionSummary}
          runEvents={runEvents}
          runEventsPreviewText={runEventsPreviewText}
          runProgressSummary={runProgressSummary}
          runSeed={runSeed}
          runSupportSummary={runSupportSummary}
          saveCurrentParticipantPreset={saveCurrentParticipantPreset}
          saveSelectedParticipantPresetId={saveSelectedParticipantPresetId}
          seedDraft={seedDraft}
          selectedChar={selectedChar}
          selectedCharId={selectedCharId}
          selectedDevGrantItem={selectedDevGrantItem}
          selectedParticipantPresetId={selectedParticipantPresetId}
          setDevGrantItemId={setDevGrantItemId}
          setDevGrantQty={setDevGrantQty}
          setDevGrantSearch={setDevGrantSearch}
          setParticipantPresetName={setParticipantPresetName}
          setQty={setQty}
          setRunSeed={setRunSeed}
          setSeedDraft={setSeedDraft}
          setEquipForSurvivor={setEquipForSurvivor}
          setMarketTab={setMarketTab}
          setShowAllMarketRows={setShowAllMarketRows}
          setShowDevDebugDetails={setShowDevDebugDetails}
          setShowDevEventLog={setShowDevEventLog}
          setShowMarketPanel={setShowMarketPanel}
          setSelectedCharId={setSelectedCharId}
          setTradeDraft={setTradeDraft}
          setTradeWantSearch={setTradeWantSearch}
          showAllMarketRows={showAllMarketRows}
          showDevDebugDetails={showDevDebugDetails}
          showDevEventLog={showDevEventLog}
          showMarketPanel={showMarketPanel}
          simulationDiagnostics={simulationDiagnostics}
          simulationDiagnosticsLine={simulationDiagnosticsLine}
          survivors={survivors}
          syncMyState={syncMyState}
          tradeDraft={tradeDraft}
          tradeOffers={tradeOffers}
          tradeWantItemOptions={tradeWantItemOptions}
          tradeWantSearch={tradeWantSearch}
          viewerLp={viewerLp}
          viewerPerks={viewerPerks}
          visibleCraftables={visibleCraftables}
          visibleDevGrantItemOptions={visibleDevGrantItemOptions}
          visibleDroneOffers={visibleDroneOffers}
          visibleKiosks={visibleKiosks}
          visibleMyTradeOffers={visibleMyTradeOffers}
          visiblePublicPerks={visiblePublicPerks}
          visibleTradeOffers={visibleTradeOffers}
        />
      </div>

      {/* 결과 모달창 */}
      <SimulationResultModal
        open={showResultModal}
        gameEndReason={gameEndReason}
        winner={winner}
        resultSummary={resultSummary}
        specialSourceSummary={specialSourceSummary}
        gainSourceSummary={gainSourceSummary}
        creditSourceSummary={creditSourceSummary}
        gainDetailSummary={gainDetailSummary}
        runSupportSummary={runSupportSummary}
        runActionSummary={runActionSummary}
        objectiveSummary={objectiveSummary}
        topRankedCharacters={topRankedCharacters}
        killCounts={killCounts}
        assistCounts={assistCounts}
        onExportBattleLog={exportBattleLog}
        onClose={() => setShowResultModal(false)}
      />

    </main>
  );
}
