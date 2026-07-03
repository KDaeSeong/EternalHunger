'use client';

import {
  EQUIP_SLOTS,
  clampTier4,
  ensureEquipped,
  getInvItemId,
  inferEquipSlot,
  inferItemCategory,
  itemDisplayName,
  itemIcon,
  tierLabelKo,
} from '../_lib/simulationEngine';
import SimulationMarketDebugDetailsPanel from './SimulationMarketDebugDetailsPanel';
import SimulationMarketDiagnosticsPanel from './SimulationMarketDiagnosticsPanel';
import SimulationMarketHeaderPanel from './SimulationMarketHeaderPanel';
import SimulationMarketTabsPanel from './SimulationMarketTabsPanel';

export default function SimulationMarketPanel({
  acceptTradeOffer,
  activeViewerPerkBundle,
  addLog,
  applyParticipantPresetToCurrent,
  candidateSurvivors,
  cancelTradeOffer,
  createTradeOffer,
  craftables,
  credits,
  day,
  deleteSelectedParticipantPreset,
  devEventPreviewLimit,
  devForceUseConsumable,
  devGrantItemId,
  devGrantItemOptions,
  devGrantItemToSelected,
  devGrantQty,
  devGrantSearch,
  doCraft,
  doDroneBuy,
  doKioskTransaction,
  doPerkPurchase,
  droneOffers,
  exportBattleLog,
  fireAndReport,
  getQty,
  getZoneName,
  inventoryOptions,
  isAdvancing,
  isGameOver,
  itemNameById,
  kiosks,
  loadMarket,
  loadTrades,
  marketCardRenderLimit,
  marketMessage,
  marketTab,
  matchSec,
  myTradeOffers,
  ownedPerkCodeSet,
  participantPresetName,
  participantPresets,
  pendingTranscendPick,
  publicItems,
  publicPerks,
  resolvePendingTranscendPick,
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
  setDevGrantItemId,
  setDevGrantQty,
  setDevGrantSearch,
  setParticipantPresetName,
  setQty,
  setRunSeed,
  setSeedDraft,
  setEquipForSurvivor,
  setMarketTab,
  setShowAllMarketRows,
  setShowDevDebugDetails,
  setShowDevEventLog,
  setShowMarketPanel,
  setSelectedCharId,
  setTradeDraft,
  setTradeWantSearch,
  showAllMarketRows,
  showDevDebugDetails,
  showDevEventLog,
  showMarketPanel,
  simulationDiagnostics,
  simulationDiagnosticsLine,
  survivors,
  syncMyState,
  tradeDraft,
  tradeOffers,
  tradeWantItemOptions,
  tradeWantSearch,
  viewerLp,
  viewerPerks,
  visibleCraftables,
  visibleDevGrantItemOptions,
  visibleDroneOffers,
  visibleKiosks,
  visibleMyTradeOffers,
  visiblePublicPerks,
  visibleTradeOffers,
}) {
  if (!showMarketPanel) return null;

  const marketCardLimit = marketCardRenderLimit;
  const devEventLimit = devEventPreviewLimit;

  return (
    <aside className="market-panel">
      <SimulationMarketHeaderPanel
        addLog={addLog}
        applyParticipantPresetToCurrent={applyParticipantPresetToCurrent}
        candidateSurvivors={candidateSurvivors}
        day={day}
        deleteSelectedParticipantPreset={deleteSelectedParticipantPreset}
        devEventPreviewLimit={devEventLimit}
        exportBattleLog={exportBattleLog}
        isAdvancing={isAdvancing}
        isGameOver={isGameOver}
        marketCardRenderLimit={marketCardLimit}
        matchSec={matchSec}
        participantPresetName={participantPresetName}
        participantPresets={participantPresets}
        runEvents={runEvents}
        runEventsPreviewText={runEventsPreviewText}
        runProgressSummary={runProgressSummary}
        runSeed={runSeed}
        saveCurrentParticipantPreset={saveCurrentParticipantPreset}
        saveSelectedParticipantPresetId={saveSelectedParticipantPresetId}
        seedDraft={seedDraft}
        selectedChar={selectedChar}
        selectedCharId={selectedCharId}
        selectedParticipantPresetId={selectedParticipantPresetId}
        setParticipantPresetName={setParticipantPresetName}
        setRunSeed={setRunSeed}
        setSeedDraft={setSeedDraft}
        setSelectedCharId={setSelectedCharId}
        setShowAllMarketRows={setShowAllMarketRows}
        setShowDevDebugDetails={setShowDevDebugDetails}
        setShowDevEventLog={setShowDevEventLog}
        setShowMarketPanel={setShowMarketPanel}
        showAllMarketRows={showAllMarketRows}
        showDevDebugDetails={showDevDebugDetails}
        showDevEventLog={showDevEventLog}
        survivors={survivors}
      />

      <SimulationMarketDiagnosticsPanel
        runActionSummary={runActionSummary}
        runSupportSummary={runSupportSummary}
        simulationDiagnostics={simulationDiagnostics}
        simulationDiagnosticsLine={simulationDiagnosticsLine}
      />

      {pendingTranscendPick ? (
        <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
          <div className="market-title">🎁 초월 장비 선택 상자(대기)</div>
          <div className="market-small">[{pendingTranscendPick.characterName || pendingTranscendPick.characterId}] {getZoneName(pendingTranscendPick.zoneId)} · 선택 완료 전에는 진행이 잠깁니다.</div>
          <div className="market-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            {(Array.isArray(pendingTranscendPick.options) ? pendingTranscendPick.options : []).map((option, idx) => {
              const item = (Array.isArray(publicItems) ? publicItems : [])
                .find((row) => String(row?._id) === String(option?.itemId)) || null;
              const name = itemDisplayName(item || { _id: option?.itemId, name: option?.name });
              const tierText = tierLabelKo(clampTier4(item?.tier ?? option?.tier ?? 4));
              const slotText = String(item?.equipSlot || option?.slot || '');
              return (
                <button
                  key={`tp-${pendingTranscendPick.id || 'p'}-${String(option?.itemId || idx)}`}
                  onClick={() => resolvePendingTranscendPick(idx, 'manual')}
                  disabled={isAdvancing || isGameOver}
                >
                  {itemIcon(item)} {name} ({tierText}{slotText ? `/${slotText}` : ''})
                </button>
              );
            })}
            <button onClick={() => resolvePendingTranscendPick(-1, 'auto')} disabled={isAdvancing || isGameOver}>자동(추천)</button>
          </div>
        </div>
      ) : null}

      {selectedCharId && selectedChar ? (
        <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
          <div className="market-title">🛠 아이템 지급(개발자)</div>
          <div className="market-small">선택 캐릭터에게 아이템을 직접 지급합니다. 장비 아이템은 지급 후 자동 장착 규칙을 다시 적용합니다.</div>
          <input
            value={devGrantSearch}
            onChange={(e) => setDevGrantSearch(e.target.value)}
            placeholder={`아이템 검색 후 선택 (표시 ${visibleDevGrantItemOptions.length}/${devGrantItemOptions.length})`}
            style={{ width: '100%', marginTop: 8 }}
            disabled={isAdvancing || isGameOver}
          />
          <div className="dev-grant-list" role="listbox" aria-label="developer item grant list">
            {visibleDevGrantItemOptions.length === 0 ? (
              <div className="market-small">검색 결과가 없습니다.</div>
            ) : (
              visibleDevGrantItemOptions.map((item) => {
                const id = String(item?._id || '');
                const selected = id && id === String(devGrantItemId || '');
                return (
                  <button
                    type="button"
                    key={`dev-grant-${id}`}
                    className={`dev-grant-option ${selected ? 'selected' : ''}`}
                    onClick={() => setDevGrantItemId(id)}
                    disabled={isAdvancing || isGameOver || !id}
                    role="option"
                    aria-selected={selected}
                    title={item?._label || item?.name || id}
                  >
                    <span>{item?._label || item?.name || id}</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
            <div className="dev-grant-picked" title={selectedDevGrantItem?._label || ''}>
              선택: {selectedDevGrantItem?._label || '-'}
            </div>
            <input
              type="number"
              min="1"
              max="99"
              value={devGrantQty}
              onChange={(e) => setDevGrantQty(e.target.value)}
              style={{ width: 76 }}
              disabled={isAdvancing || isGameOver}
            />
            <button
              className="market-mini-btn"
              onClick={devGrantItemToSelected}
              disabled={isAdvancing || isGameOver || !devGrantItemId}
            >
              지급
            </button>
          </div>
        </div>
      ) : null}

      {selectedCharId && selectedChar ? (() => {
        const consumables = (Array.isArray(selectedChar.inventory) ? selectedChar.inventory : [])
          .map((item, idx) => ({ item, idx }))
          .filter((row) => inferItemCategory(row.item) === 'consumable');

        return (
          <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
            <div className="market-title">🧪 소모품 강제 사용(개발자)</div>
            <div className="market-small">시뮬은 기본적으로 플레이어가 자동 사용합니다. 이 영역은 개발자 도구가 켜졌을 때만 노출됩니다.</div>
            <div className="market-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              {consumables.length === 0 ? (
                <div className="market-small">소모품이 없습니다.</div>
              ) : (
                consumables.slice(0, 12).map(({ item, idx }) => {
                  const qty = Math.max(1, Number(item?.qty || 1));
                  return (
                    <button
                      key={`dev-cons-${idx}-${String(item?._id || item?.itemId || '')}`}
                      onClick={() => devForceUseConsumable(selectedCharId, idx)}
                      disabled={isAdvancing || isGameOver}
                      title={isAdvancing ? '진행 중에는 사용할 수 없습니다.' : '개발자 도구: 임의로 사용'}
                    >
                      {itemIcon(item)} {itemDisplayName(item)}{qty > 1 ? ` x${qty}` : ''}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })() : null}

      <SimulationMarketDebugDetailsPanel
        runProgressSummary={runProgressSummary}
        selectedChar={selectedChar}
        selectedCharId={selectedCharId}
        showDevDebugDetails={showDevDebugDetails}
      />

      {selectedCharId && selectedChar ? (() => {
        const equippedBySlot = ensureEquipped(selectedChar);
        const inventory = Array.isArray(selectedChar?.inventory) ? selectedChar.inventory : [];
        const equipmentRows = inventory
          .map((item, idx) => ({ item, idx }))
          .map(({ item, idx }) => {
            const category = String(item?.category || inferItemCategory(item));
            const slot = String(item?.equipSlot || inferEquipSlot(item));
            const itemId = getInvItemId(item);
            const isEquip = category === 'equipment' && slot && EQUIP_SLOTS.includes(String(slot));
            return { item, idx, slot, itemId, isEquip };
          })
          .filter((row) => row.isEquip && row.itemId);

        return (
          <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
            <div className="market-title">🎒 장비 장착/해제</div>
            <div className="market-small">무기/방어구는 장착 상태(equipped)를 우선 적용합니다.</div>
            <div className="market-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              {equipmentRows.length === 0 ? (
                <div className="market-small">장착 가능한 장비가 없습니다.</div>
              ) : (
                equipmentRows.slice(0, 30).map(({ item, idx, slot, itemId }) => {
                  const tierText = tierLabelKo(clampTier4(item?.tier || 1));
                  const name = itemDisplayName(item);
                  const equipped = String(equippedBySlot?.[slot] || '') === String(itemId);
                  return (
                    <div key={`eq-${idx}-${itemId}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{itemIcon(item)}</span>
                      <span style={{ fontWeight: 800 }}>{name}</span>
                      <span className="market-small">({tierText}{slot ? `/${slot}` : ''})</span>
                      <button
                        className={`invEquipBtn ${equipped ? 'off' : 'on'}`}
                        onClick={() => setEquipForSurvivor(selectedCharId, slot, equipped ? null : itemId)}
                        disabled={isAdvancing || isGameOver}
                      >
                        {equipped ? '해제' : '장착'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })() : null}

      <SimulationMarketTabsPanel
        acceptTradeOffer={acceptTradeOffer}
        activeViewerPerkBundle={activeViewerPerkBundle}
        cancelTradeOffer={cancelTradeOffer}
        craftables={craftables}
        createTradeOffer={createTradeOffer}
        credits={credits}
        doCraft={doCraft}
        doDroneBuy={doDroneBuy}
        doKioskTransaction={doKioskTransaction}
        doPerkPurchase={doPerkPurchase}
        droneOffers={droneOffers}
        fireAndReport={fireAndReport}
        getQty={getQty}
        inventoryOptions={inventoryOptions}
        itemNameById={itemNameById}
        kiosks={kiosks}
        loadMarket={loadMarket}
        loadTrades={loadTrades}
        marketCardRenderLimit={marketCardLimit}
        marketMessage={marketMessage}
        marketTab={marketTab}
        myTradeOffers={myTradeOffers}
        ownedPerkCodeSet={ownedPerkCodeSet}
        publicItems={publicItems}
        publicPerks={publicPerks}
        selectedCharId={selectedCharId}
        setMarketTab={setMarketTab}
        setQty={setQty}
        setShowAllMarketRows={setShowAllMarketRows}
        setTradeDraft={setTradeDraft}
        setTradeWantSearch={setTradeWantSearch}
        showAllMarketRows={showAllMarketRows}
        syncMyState={syncMyState}
        tradeDraft={tradeDraft}
        tradeOffers={tradeOffers}
        tradeWantItemOptions={tradeWantItemOptions}
        tradeWantSearch={tradeWantSearch}
        viewerLp={viewerLp}
        viewerPerks={viewerPerks}
        visibleCraftables={visibleCraftables}
        visibleDroneOffers={visibleDroneOffers}
        visibleKiosks={visibleKiosks}
        visibleMyTradeOffers={visibleMyTradeOffers}
        visiblePublicPerks={visiblePublicPerks}
        visibleTradeOffers={visibleTradeOffers}
      />
    </aside>
  );
}
