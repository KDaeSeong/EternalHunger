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
import { normalizeSatiety } from '../_lib/satietyRuntime';
import {
  PARTICIPANT_PRESET_LIMIT,
  RANDOM_PARTICIPANT_PRESET_ID,
  normalizeParticipantPresetIds,
} from '../_lib/participantPresetRuntime';

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

  const MARKET_CARD_RENDER_LIMIT = marketCardRenderLimit;
  const DEV_EVENT_PREVIEW_LIMIT = devEventPreviewLimit;

  return (
        <aside className="market-panel">
          <div className="market-header">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <h2 style={{ margin: 0 }}>상점/조합/교환</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>                <button className="market-close" onClick={() => setShowMarketPanel(false)} title="패널 닫기">✕</button>
              </div>
            </div>

            <div className="market-row" style={{ marginTop: 10 }}>
              <div className="market-small">사용 캐릭터</div>
              <select value={selectedCharId} onChange={(e) => setSelectedCharId(e.target.value)} style={{ width: '100%' }}>
                <option value="">(선택)</option>
                {survivors.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
              {selectedChar ? (
                <div className="market-small" style={{ marginTop: 4 }}>
                  HP {Math.round(Number(selectedChar.hp || 0))}/{Math.round(Number(selectedChar.maxHp || 100))}
                  {' · '}포만감 {normalizeSatiety(selectedChar.satiety)}/100
                </div>
              ) : null}
            </div>

            <div className="market-row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="market-mini-btn"
                onClick={() => exportBattleLog('md')}
                title="1일차 낮부터 현재까지 누적된 전투 로그를 Markdown 파일로 저장합니다."
              >
                로그 MD
              </button>
              <button
                type="button"
                className="market-mini-btn"
                onClick={() => exportBattleLog('json')}
                title="1일차 낮부터 현재까지 누적된 전투 로그와 runEvents를 JSON 파일로 저장합니다."
              >
                로그 JSON
              </button>
              <button
                type="button"
                className={`market-mini-btn ${showDevEventLog ? 'active' : ''}`}
                onClick={() => setShowDevEventLog((v) => !v)}
                title="큰 JSON 문자열 생성은 필요할 때만 켭니다."
              >
                {showDevEventLog ? '이벤트 JSON 숨김' : '이벤트 JSON'}
              </button>
              <button
                type="button"
                className={`market-mini-btn ${showDevDebugDetails ? 'active' : ''}`}
                onClick={() => setShowDevDebugDetails((v) => !v)}
                title="AI/제작/런 메트릭 상세 카드를 필요할 때만 렌더합니다."
              >
                {showDevDebugDetails ? '상세 디버그 숨김' : '상세 디버그'}
              </button>
              <button
                type="button"
                className={`market-mini-btn ${showAllMarketRows ? 'active' : ''}`}
                onClick={() => setShowAllMarketRows((v) => !v)}
                title={`상점 목록은 기본 ${MARKET_CARD_RENDER_LIMIT}개만 렌더합니다.`}
              >
                {showAllMarketRows ? '목록 빠르게' : `목록 ${MARKET_CARD_RENDER_LIMIT}개`}
              </button>
            </div>

            <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">🎲 시드(재현)</div>
              <div className="market-small">같은 시드면 랜덤 결과가 재현됩니다. (게임 시작 전에만 변경 권장)</div>
              <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
                <input
                  value={seedDraft}
                  onChange={(e) => setSeedDraft(e.target.value)}
                  placeholder="예) 1700000000000"
                  style={{ width: '100%' }}
                  disabled={isAdvancing || isGameOver}
                />
                <button
                  className="market-mini-btn"
                  onClick={() => setRunSeed(String(seedDraft || '').trim() || String(Date.now()))}
                  disabled={isAdvancing || isGameOver || day !== 0 || matchSec !== 0}
                  title={(day !== 0 || matchSec !== 0) ? '게임 시작 후에는 변경을 권장하지 않습니다.' : ''}
                >
                  적용
                </button>
                <button
                  className="market-mini-btn"
                  onClick={() => { const n = String(Date.now()); setSeedDraft(n); setRunSeed(n); }}
                  disabled={isAdvancing || isGameOver || day !== 0 || matchSec !== 0}
                >
                  새 시드
                </button>
              </div>
              <div className="market-small">현재: <strong>{runSeed}</strong></div>
            </div>

            <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">👥 참가자 프리셋</div>
              <div className="market-small">
                기본은 무작위 24명입니다. 현재 참가자 24명을 최대 {PARTICIPANT_PRESET_LIMIT}개까지 저장해 시작 전에 적용할 수 있습니다.
              </div>
              <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
                <select
                  value={selectedParticipantPresetId}
                  onChange={(e) => {
                    const id = e.target.value;
                    saveSelectedParticipantPresetId(id);
                    const preset = (Array.isArray(participantPresets) ? participantPresets : [])
                      .find((row) => String(row?.id || '') === String(id));
                    setParticipantPresetName(preset?.name || '');
                  }}
                  style={{ width: '100%' }}
                  disabled={isAdvancing || isGameOver}
                >
                  <option value={RANDOM_PARTICIPANT_PRESET_ID}>무작위 24명</option>
                  {(Array.isArray(participantPresets) ? participantPresets : []).map((preset, index) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name || `프리셋 ${index + 1}`} ({normalizeParticipantPresetIds(preset.characterIds).length}명)
                    </option>
                  ))}
                </select>
                <button
                  className="market-mini-btn"
                  onClick={() => applyParticipantPresetToCurrent(selectedParticipantPresetId)}
                  disabled={isAdvancing || isGameOver || day !== 0 || matchSec !== 0}
                  title={(day !== 0 || matchSec !== 0) ? '게임 시작 전에만 적용할 수 있습니다.' : ''}
                >
                  적용
                </button>
              </div>
              <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
                <input
                  value={participantPresetName}
                  onChange={(e) => setParticipantPresetName(e.target.value)}
                  placeholder="프리셋 이름"
                  style={{ width: '100%' }}
                  disabled={isAdvancing || isGameOver}
                />
                <button
                  className="market-mini-btn"
                  onClick={saveCurrentParticipantPreset}
                  disabled={isAdvancing || isGameOver || !survivors.length}
                  title="현재 참가자 목록을 저장합니다."
                >
                  저장
                </button>
                <button
                  className="market-mini-btn"
                  onClick={deleteSelectedParticipantPreset}
                  disabled={isAdvancing || isGameOver || selectedParticipantPresetId === RANDOM_PARTICIPANT_PRESET_ID}
                >
                  삭제
                </button>
              </div>
              <div className="market-small" style={{ marginTop: 6 }}>
                저장됨: <strong>{(Array.isArray(participantPresets) ? participantPresets : []).length}</strong>/{PARTICIPANT_PRESET_LIMIT}
                {' · '}후보: <strong>{(Array.isArray(candidateSurvivors) && candidateSurvivors.length) || survivors.length}</strong>명
              </div>
            </div>

            {showDevEventLog ? (
              <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                <div className="market-title">🧾 이벤트 로그(JSON)</div>
                <div className="market-small">runEvents: <strong>{runEvents.length}</strong>개 (최근 {DEV_EVENT_PREVIEW_LIMIT}개만 표시)</div>
                <textarea
                  readOnly
                  value={runEventsPreviewText}
                  style={{ width: '100%', minHeight: 160, marginTop: 8 }}
                />
                <div className="market-actions" style={{ marginTop: 8 }}>
                  <button
                    onClick={() => {
                      try {
                        navigator.clipboard?.writeText(JSON.stringify(runEvents, null, 2));
                        addLog('✅ 이벤트 로그 복사 완료', 'system');
                      } catch (e) {
                        addLog('⚠️ 이벤트 로그 복사 실패', 'death');
                      }
                    }}
                    disabled={!runEvents.length}
                  >
                    전체 복사
                  </button>
                </div>
              </div>
            ) : (
              <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                <div className="market-title">🧾 이벤트 로그(JSON)</div>
                <div className="market-small">runEvents: <strong>{runEvents.length}</strong>개 · 필요할 때만 위의 이벤트 JSON 버튼을 켜세요.</div>
              </div>
            )}

            <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">🌍 런 전체 요약</div>
              <div className="market-small">drone: <b>{Number(runProgressSummary?.droneCalls || 0)}</b> / kiosk: <b>{Number(runProgressSummary?.kioskGains || 0)}</b> / craft: <b>{Number(runProgressSummary?.craftCount || 0)}</b></div>
              <div className="market-small" style={{ marginTop: 6 }}>legend chars: <b>{Number(runProgressSummary?.legendCount || 0)}</b> / transcend chars: <b>{Number(runProgressSummary?.transCount || 0)}</b></div>
              <div className="market-small" style={{ marginTop: 6 }}>death: <b>{Number(runProgressSummary?.totalDeaths || 0)}</b> / revive: <b>{Number(runProgressSummary?.totalRevives || 0)}</b> / flee: <b>{Number(runProgressSummary?.totalFlees || 0)}</b></div>
              <div className="market-small" style={{ marginTop: 6 }}>revive ratio: <b>{Number(runProgressSummary?.reviveRate || 0).toFixed(2)}</b> / flee ratio: <b>{Number(runProgressSummary?.fleeRate || 0).toFixed(2)}</b></div>
              <div className="market-small" style={{ marginTop: 6 }}>legend pace: <b>{String(runProgressSummary?.legendPace || 'pending')}</b> / transcend pace: <b>{String(runProgressSummary?.transPace || 'pending')}</b></div>
              <div className="market-small" style={{ marginTop: 6 }}>first legend: {String(runProgressSummary?.firstLegendText || '-')} / first transcend: {String(runProgressSummary?.firstTransText || '-')}</div>
              <div className="market-small" style={{ marginTop: 6 }}>latest legend: {String(runProgressSummary?.latestLegendText || '-')} / latest transcend: {String(runProgressSummary?.latestTransText || '-')}</div>
            </div>

            <div className="market-card sim-diagnostics-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">밸런스 진단</div>
              <div className="market-small">{simulationDiagnosticsLine}</div>
              <div className="sim-diagnostics-grid" style={{ marginTop: 8 }}>
                <div>
                  <b>{Number(simulationDiagnostics?.deaths?.byBand?.opening || 0)}</b>
                  <span>1일차</span>
                </div>
                <div>
                  <b>{Number(simulationDiagnostics?.deaths?.byBand?.mid || 0)}</b>
                  <span>중반 사망</span>
                </div>
                <div>
                  <b>{Number(simulationDiagnostics?.deaths?.byBand?.end || 0)}</b>
                  <span>후반 사망</span>
                </div>
                <div>
                  <b>{Number(simulationDiagnostics?.chase?.caught || 0)}</b>
                  <span>추격 성공</span>
                </div>
              </div>
              {(Array.isArray(simulationDiagnostics?.recommendations) ? simulationDiagnostics.recommendations : []).slice(0, 3).map((note, idx) => (
                <div key={`sim-diag-note-${idx}`} className="market-small sim-diagnostics-note">
                  {note}
                </div>
              ))}
            </div>


            <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">🩹 사용/상태 요약</div>
              <div className="market-small">{runSupportSummary?.line}</div>
              {runSupportSummary?.topItems ? (
                <div className="market-small" style={{ marginTop: 6 }}>top use: {runSupportSummary.topItems}</div>
              ) : null}
              {runSupportSummary?.topEffects ? (
                <div className="market-small" style={{ marginTop: 6 }}>top effects: {runSupportSummary.topEffects}</div>
              ) : null}
            </div>

            <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
              <div className="market-title">⏱️ 행동 큐/추격 요약</div>
              <div className="market-small">{runActionSummary?.line}</div>
              <div className="market-small" style={{ marginTop: 6 }}>{runActionSummary?.chaseLine}</div>
              {runActionSummary?.tuningLine ? (
                <div className="market-small" style={{ marginTop: 6 }}>{runActionSummary.tuningLine}</div>
              ) : null}
              {runActionSummary?.topObjectiveMoves ? (
                <div className="market-small" style={{ marginTop: 6 }}>top objective: {runActionSummary.topObjectiveMoves}</div>
              ) : null}
              {runActionSummary?.topBlocked ? (
                <div className="market-small" style={{ marginTop: 6 }}>top blocked: {runActionSummary.topBlocked}</div>
              ) : null}
              {runActionSummary?.topDeferred ? (
                <div className="market-small" style={{ marginTop: 6 }}>top deferred: {runActionSummary.topDeferred}</div>
              ) : null}
            </div>

            {pendingTranscendPick ? (
              <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                <div className="market-title">🎁 초월 장비 선택 상자(대기)</div>
                <div className="market-small">[{pendingTranscendPick.characterName || pendingTranscendPick.characterId}] {getZoneName(pendingTranscendPick.zoneId)} · 선택 완료 전에는 진행이 잠깁니다.</div>
                <div className="market-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  {(Array.isArray(pendingTranscendPick.options) ? pendingTranscendPick.options : []).map((o, idx) => {
                    const it = (Array.isArray(publicItems) ? publicItems : []).find((x) => String(x?._id) === String(o?.itemId)) || null;
                    const nm = itemDisplayName(it || { _id: o?.itemId, name: o?.name });
                    const tierText = tierLabelKo(clampTier4(it?.tier ?? o?.tier ?? 4));
                    const slotText = String(it?.equipSlot || o?.slot || '');
                    return (
                      <button
                        key={`tp-${pendingTranscendPick.id || 'p'}-${String(o?.itemId || idx)}`}
                        onClick={() => resolvePendingTranscendPick(idx, 'manual')}
                        disabled={isAdvancing || isGameOver}
                      >
                        {itemIcon(it)} {nm} ({tierText}{slotText ? `/${slotText}` : ''})
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
                    visibleDevGrantItemOptions.map((it) => {
                      const id = String(it?._id || '');
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
                          title={it?._label || it?.name || id}
                        >
                          <span>{it?._label || it?.name || id}</span>
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

            {/* 🛠 개발자 도구: 유저가 선택 캐릭터에게 소모품을 임의로 사용 */}
            {selectedCharId && selectedChar ? (() => {
              const list = (Array.isArray(selectedChar.inventory) ? selectedChar.inventory : [])
                .map((it, idx) => ({ it, idx }))
                .filter((x) => inferItemCategory(x.it) === 'consumable');

              return (
                <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                  <div className="market-title">🧪 소모품 강제 사용(개발자)</div>
                  <div className="market-small">시뮬은 기본적으로 플레이어가 자동 사용합니다. 이 영역은 개발자 도구가 켜졌을 때만 노출됩니다.</div>
                  <div className="market-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                    {list.length === 0 ? (
                      <div className="market-small">소모품이 없습니다.</div>
                    ) : (
                      list.slice(0, 12).map(({ it, idx }) => {
                        const q = Math.max(1, Number(it?.qty || 1));
                        return (
                          <button
                            key={`dev-cons-${idx}-${String(it?._id || it?.itemId || '')}`}
                            onClick={() => devForceUseConsumable(selectedCharId, idx)}
                            disabled={isAdvancing || isGameOver}
                            title={isAdvancing ? '진행 중에는 사용할 수 없습니다.' : '개발자 도구: 임의로 사용'}
                          >
                            {itemIcon(it)} {itemDisplayName(it)}{q > 1 ? ` x${q}` : ''}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })() : null}

            {showDevDebugDetails && selectedCharId && selectedChar ? (() => {
              const dbg = selectedChar?._craftDebug || null;
              return (
                <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                  <div className="market-title">🧪 제작 디버그</div>
                  {!dbg ? (
                    <div className="market-small">아직 제작 판정 로그가 없습니다.</div>
                  ) : (
                    <>
                      <div className="market-small">code: <b>{String(dbg?.code || '-')}</b>{dbg?.targetName ? ` / target: ${dbg.targetName}` : ''}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>{String(dbg?.text || '')}</div>
                      {Array.isArray(dbg?.missing) && dbg.missing.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>missing: {dbg.missing.slice(0, 5).join(', ')}</div>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })() : null}

            {showDevDebugDetails && selectedCharId && selectedChar ? (() => {
              const ai = selectedChar?._aiDebug || null;
              return (
                <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                  <div className="market-title">🤖 AI 디버그</div>
                  {!ai ? (
                    <div className="market-small">아직 AI 판단 로그가 없습니다.</div>
                  ) : (
                    <>
                      <div className="market-small">action: <b>{String(ai?.action || '-')}</b>{ai?.itemName ? ` / item: ${ai.itemName}` : ''}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>zone: {String(ai?.zoneName || '-')} {ai?.targetZoneName ? `→ ${ai.targetZoneName}` : ''}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>reason: {String(ai?.reason || '-')}</div>
                      {Array.isArray(ai?.queuePreview) && ai.queuePreview.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>queue: {ai.queuePreview.join(' → ')}</div>
                      ) : null}
                      {Array.isArray(ai?.candidatePreview) && ai.candidatePreview.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>candidates: {ai.candidatePreview.join(' > ')}</div>
                      ) : null}
                      {Array.isArray(ai?.candidateScores) && ai.candidateScores.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>scores: {ai.candidateScores.join(' | ')}</div>
                      ) : null}
                      {Array.isArray(ai?.blockedReasons) && ai.blockedReasons.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>blocked: {ai.blockedReasons.join(', ')}</div>
                      ) : null}
                      {ai?.goalName ? <div className="market-small" style={{ marginTop: 6 }}>goal: {String(ai.goalName)}</div> : null}
                      {Array.isArray(ai?.missingNames) && ai.missingNames.length > 0 ? (
                        <div className="market-small" style={{ marginTop: 6 }}>missing: {ai.missingNames.join(', ')}</div>
                      ) : null}
                      <div className="market-small" style={{ marginTop: 6 }}>
                        late: {ai?.wantLegend ? '전설 ' : ''}{ai?.wantTrans ? '초월 ' : ''}{ai?.farmCredits ? '/ 크레딧 파밍' : ''}{!ai?.wantLegend && !ai?.wantTrans && !ai?.farmCredits ? '일반 성장' : ''}
                      </div>
                      {ai?.fleeReason ? <div className="market-small" style={{ marginTop: 6 }}>flee: {String(ai.fleeReason)}</div> : null}
                    </>
                  )}
                </div>
              );
            })() : null}

            {showDevDebugDetails && selectedCharId && selectedChar ? (() => {
              const rp = runProgressSummary || null;
              return (
                <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                  <div className="market-title">📈 런 메트릭</div>
                  {!rp ? (
                    <div className="market-small">아직 메트릭이 없습니다.</div>
                  ) : (
                    <>
                      <div className="market-small">drone: <b>{Number(rp?.droneCalls || 0)}</b> / kiosk: <b>{Number(rp?.kioskGains || 0)}</b> / craft: <b>{Number(rp?.craftCount || 0)}</b></div>
                      <div className="market-small" style={{ marginTop: 6 }}>first legend: {String(rp?.firstLegendText || '-')}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>first transcend: {String(rp?.firstTransText || '-')}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>latest legend: {String(rp?.latestLegendText || '-')}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>latest transcend: {String(rp?.latestTransText || '-')}</div>
                    </>
                  )}
                </div>
              );
            })() : null}

            {/* 🎒 장비 장착/해제 (개발자/관전자) */}
            {selectedCharId && selectedChar ? (() => {
              const eq = ensureEquipped(selectedChar);
              const inv = Array.isArray(selectedChar?.inventory) ? selectedChar.inventory : [];
              const list = inv
                .map((it, idx) => ({ it, idx }))
                .map(({ it, idx }) => {
                  const category = String(it?.category || inferItemCategory(it));
                  const slot = String(it?.equipSlot || inferEquipSlot(it));
                  const itemId = getInvItemId(it);
                  const isEquip = category === 'equipment' && slot && EQUIP_SLOTS.includes(String(slot));
                  return { it, idx, slot, itemId, isEquip };
                })
                .filter((x) => x.isEquip && x.itemId);

              return (
                <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
                  <div className="market-title">🎒 장비 장착/해제</div>
                  <div className="market-small">무기/방어구는 장착 상태(equipped)를 우선 적용합니다.</div>
                  <div className="market-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                    {list.length === 0 ? (
                      <div className="market-small">장착 가능한 장비가 없습니다.</div>
                    ) : (
                      list.slice(0, 30).map(({ it, idx, slot, itemId }) => {
                        const tierText = tierLabelKo(clampTier4(it?.tier || 1));
                        const nm = itemDisplayName(it);
                        const equipped = String(eq?.[slot] || '') === String(itemId);
                        return (
                          <div key={`eq-${idx}-${itemId}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{itemIcon(it)}</span>
                            <span style={{ fontWeight: 800 }}>{nm}</span>
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

            <div className="market-tabs">
              <button className={`market-tab ${marketTab === 'craft' ? 'active' : ''}`} onClick={() => setMarketTab('craft')}>🛠️ 조합</button>
              <button className={`market-tab ${marketTab === 'kiosk' ? 'active' : ''}`} onClick={() => setMarketTab('kiosk')}>🏪 키오스크</button>
              <button className={`market-tab ${marketTab === 'drone' ? 'active' : ''}`} onClick={() => setMarketTab('drone')}>🚁 드론</button>
              <button className={`market-tab ${marketTab === 'perk' ? 'active' : ''}`} onClick={() => setMarketTab('perk')}>🎖️ 특전</button>
              <button className={`market-tab ${marketTab === 'trade' ? 'active' : ''}`} onClick={() => setMarketTab('trade')}>🔁 교환</button>
            </div>

            <div className="market-card" style={{ marginTop: 10 }}>
              <div className="market-row">
                <div>
                  <div className="market-title">💳 계정 진행</div>
                  <div className="market-small" style={{ marginTop: 6 }}>현재 보유 크레딧 {Number(credits || 0)} Cr · LP {Number(viewerLp || 0)} · 보유 특전 {Number((Array.isArray(viewerPerks) ? viewerPerks.length : 0) || 0)}개</div>
                  {activeViewerPerkBundle?.summary ? (<div className="market-small">적용 중: {activeViewerPerkBundle.summary}</div>) : null}
                </div>
                <button onClick={() => { void fireAndReport('market.sync', () => Promise.allSettled([syncMyState(), loadMarket()])); }} className="market-mini-btn">동기화</button>
              </div>
            </div>

            {marketMessage ? (
              <div className="market-card" style={{ borderColor: '#ffcdd2', background: '#fff5f5' }}>
                <div style={{ fontWeight: 800, color: '#c62828' }}>알림</div>
                <div className="market-small" style={{ marginTop: 6, color: '#c62828' }}>{marketMessage}</div>
              </div>
            ) : null}
          </div>

          {marketTab === 'craft' ? (
            <div className="market-section">
              <div className="market-small" style={{ marginBottom: 8 }}>레시피가 있는 아이템만 표시됩니다.</div>
              {craftables.length === 0 ? (
                <div className="market-card">조합 가능한 아이템이 없습니다. (관리자에서 레시피를 등록하세요)</div>
              ) : (
                <>
                  {visibleCraftables.map((it) => (
                    <div key={it._id} className="market-card">
                      <div className="market-row">
                        <div>
                          <div className="market-title">{it.name}</div>
                          <div className="market-small">tier {it.tier || 1} · {it.rarity || 'common'} · 비용 {Number(it?.recipe?.creditsCost || 0)} Cr</div>
                        </div>
                      </div>

                      <div className="market-small" style={{ marginTop: 8 }}>
                        재료: {(it.recipe.ingredients || []).map((ing) => {
                          const ingId = String(ing.itemId);
                          const ingName = itemNameById[ingId] || ingId;
                          return `${ingName} x${Number(ing.qty || 1)}`;
                        }).join(', ')}
                      </div>

                      <div className="market-actions" style={{ marginTop: 10 }}>
                        <input
                          type="number"
                          min={1}
                          value={getQty(`craft:${it._id}`, 1)}
                          onChange={(e) => setQty(`craft:${it._id}`, e.target.value)}
                        />
                        <button onClick={() => doCraft(it._id)} disabled={!selectedCharId}>조합</button>
                      </div>
                    </div>
                  ))}
                  {craftables.length > visibleCraftables.length ? (
                    <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
                      조합 목록 더 보기 ({visibleCraftables.length}/{craftables.length})
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {marketTab === 'kiosk' ? (
            <div className="market-section">
              {kiosks.length === 0 ? (
                <div className="market-card">키오스크가 없습니다. (관리자에서 키오스크/카탈로그를 등록하세요)</div>
              ) : (
                <>
                  {visibleKiosks.map((k) => (
                    <div key={k._id} className="market-card">
                      <div className="market-row">
                        <div>
                          <div className="market-title">{k.name || '키오스크'}</div>
                          <div className="market-small">위치: {k.mapId?.name || '미지정'}</div>
                        </div>
                        <button onClick={() => { void fireAndReport('market.refresh', () => loadMarket()); }} className="market-mini-btn">새로고침</button>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        {(Array.isArray(k.catalog) ? k.catalog : []).slice(0, showAllMarketRows ? undefined : MARKET_CARD_RENDER_LIMIT).map((entry, idx) => {
                          const mode = entry.mode || 'sell';
                          const label = mode === 'sell' ? '구매' : mode === 'buy' ? '판매' : '교환';
                          const price = Math.max(0, Number(entry.priceCredits || 0));

                          const itemId = entry.itemId?._id || entry.itemId;
                          const itemName = entry.itemId?.name || itemNameById[String(itemId)] || String(itemId || '미지정');

                          const exId = entry.exchange?.giveItemId?._id || entry.exchange?.giveItemId;
                          const exName = entry.exchange?.giveItemId?.name || (exId ? (itemNameById[String(exId)] || String(exId)) : '');
                          const exQty = Number(entry.exchange?.giveQty || 1);

                          return (
                            <div key={idx} className="market-subcard">
                              <div className="market-row">
                                <div>
                                  <div className="market-title">{label}: {itemName}</div>
                                  <div className="market-small">
                                    {mode === 'exchange'
                                      ? `재료: ${exName || '미지정'} x${exQty}`
                                      : `단가: ${price} Cr`}
                                  </div>
                                </div>
                              </div>

                              <div className="market-actions" style={{ marginTop: 8 }}>
                                <input
                                  type="number"
                                  min={1}
                                  value={getQty(`kiosk:${k._id}:${idx}`, 1)}
                                  onChange={(e) => setQty(`kiosk:${k._id}:${idx}`, e.target.value)}
                                />
                                <button onClick={() => doKioskTransaction(k._id, idx)} disabled={!selectedCharId || !itemId}>실행</button>
                              </div>
                            </div>
                          );
                        })}
                        {!showAllMarketRows && Array.isArray(k.catalog) && k.catalog.length > MARKET_CARD_RENDER_LIMIT ? (
                          <div className="market-small" style={{ marginTop: 8 }}>
                            카탈로그 {MARKET_CARD_RENDER_LIMIT}/{k.catalog.length}개 표시 중
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {kiosks.length > visibleKiosks.length ? (
                    <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
                      키오스크 더 보기 ({visibleKiosks.length}/{kiosks.length})
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {marketTab === 'drone' ? (
            <div className="market-section">
              {droneOffers.length === 0 ? (
                <div className="market-card">드론 판매 목록이 없습니다. (관리자에서 드론 판매를 등록하세요)</div>
              ) : (
                <>
                  {visibleDroneOffers.map((o) => (
                    <div key={o._id} className="market-card">
                      <div className="market-row">
                        <div>
                          <div className="market-title">{o.itemId?.name || '아이템'}</div>
                          <div className="market-small">가격: {Math.max(0, Number(o.priceCredits || 0))} Cr · 티어 제한 ≤ {Number(o.maxTier || 1)}</div>
                        </div>
                        <button onClick={() => { void fireAndReport('market.refresh', () => loadMarket()); }} className="market-mini-btn">새로고침</button>
                      </div>
                      <div className="market-actions" style={{ marginTop: 10 }}>
                        <input
                          type="number"
                          min={1}
                          value={getQty(`drone:${o._id}`, 1)}
                          onChange={(e) => setQty(`drone:${o._id}`, e.target.value)}
                        />
                        <button onClick={() => doDroneBuy(o._id)} disabled={!selectedCharId}>구매</button>
                      </div>
                    </div>
                  ))}
                  {droneOffers.length > visibleDroneOffers.length ? (
                    <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
                      드론 목록 더 보기 ({visibleDroneOffers.length}/{droneOffers.length})
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {marketTab === 'perk' ? (
            <div className="market-section">
              <div className="market-small" style={{ marginBottom: 8 }}>계정 단위 특전입니다. 구매 후 홈/시뮬 모두 즉시 반영됩니다.</div>
              {publicPerks.length === 0 ? (
                <div className="market-card">활성 특전이 없습니다. (관리자에서 특전을 등록하세요)</div>
              ) : (
                <>
                  {visiblePublicPerks.map((perk) => {
                    const code = String(perk?.code || '');
                    const owned = ownedPerkCodeSet.has(code);
                    const cost = Math.max(0, Number(perk?.lpCost || 0));
                    const desc = String(perk?.description || perk?.effectText || perk?.summary || '').trim();
                    return (
                      <div key={perk?._id || code} className="market-card">
                        <div className="market-row">
                          <div>
                            <div className="market-title">{perk?.name || code || '특전'}</div>
                            <div className="market-small">코드: {code || '-'} · 비용: {cost} LP{perk?.category ? ` · ${perk.category}` : ''}</div>
                          </div>
                          <button onClick={() => { void fireAndReport('market.refresh', () => loadMarket()); }} className="market-mini-btn">새로고침</button>
                        </div>
                        {desc ? <div className="market-small" style={{ marginTop: 8 }}>{desc}</div> : null}
                        <div className="market-actions" style={{ marginTop: 10 }}>
                          <button onClick={() => doPerkPurchase(code)} disabled={!code || owned || Number(viewerLp || 0) < cost}>
                            {owned ? '보유 중' : `구매 (${cost} LP)`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {publicPerks.length > visiblePublicPerks.length ? (
                    <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
                      특전 더 보기 ({visiblePublicPerks.length}/{publicPerks.length})
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {marketTab === 'trade' ? (
            <div className="market-section">
              <div className="market-row" style={{ marginBottom: 8 }}>
                <div className="market-small">오픈 오퍼</div>
                <button onClick={loadTrades} className="market-mini-btn">새로고침</button>
              </div>

              {tradeOffers.length === 0 ? (
                <div className="market-card">현재 오픈 오퍼가 없습니다.</div>
              ) : (
                <>
                  {visibleTradeOffers.map((off) => (
                    <div key={off._id} className="market-card">
                      <div className="market-title">{off.fromCharacterId?.name || '상대'}의 오퍼</div>
                      <div className="market-small" style={{ marginTop: 6 }}>
                        주는 것: {(Array.isArray(off.give) ? off.give : []).map((g) => `${g.itemId?.name || g.itemId} x${g.qty}`).join(', ')}
                      </div>
                      <div className="market-small" style={{ marginTop: 4 }}>
                        원하는 것: {(Array.isArray(off.want) ? off.want : []).length
                          ? (Array.isArray(off.want) ? off.want : []).map((w) => `${w.itemId?.name || w.itemId} x${w.qty}`).join(', ')
                          : '없음'}
                        {Number(off.wantCredits || 0) > 0 ? ` + ${Number(off.wantCredits)} Cr` : ''}
                      </div>
                      {off.note ? <div className="market-small" style={{ marginTop: 6 }}>메모: {off.note}</div> : null}

                      <div className="market-actions" style={{ marginTop: 10 }}>
                        <button onClick={() => acceptTradeOffer(off._id)} disabled={!selectedCharId || String(off?.fromCharacterId?._id || '') === String(selectedCharId)}>수락</button>
                      </div>
                    </div>
                  ))}
                  {tradeOffers.length > visibleTradeOffers.length ? (
                    <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
                      오픈 오퍼 더 보기 ({visibleTradeOffers.length}/{tradeOffers.length})
                    </button>
                  ) : null}
                </>
              )}

              <div className="market-row" style={{ marginTop: 16, marginBottom: 8 }}>
                <div className="market-small">내 오퍼</div>
                <button onClick={loadTrades} className="market-mini-btn">새로고침</button>
              </div>

              {myTradeOffers.length === 0 ? (
                <div className="market-card">내 오퍼가 없습니다.</div>
              ) : (
                <>
                  {visibleMyTradeOffers.map((off) => (
                    <div key={off._id} className="market-card">
                      <div className="market-title">상태: {off.status}</div>
                      <div className="market-small" style={{ marginTop: 6 }}>
                        주는 것: {(Array.isArray(off.give) ? off.give : []).map((g) => `${g.itemId?.name || g.itemId} x${g.qty}`).join(', ')}
                      </div>
                      <div className="market-small" style={{ marginTop: 4 }}>
                        원하는 것: {(Array.isArray(off.want) ? off.want : []).length
                          ? (Array.isArray(off.want) ? off.want : []).map((w) => `${w.itemId?.name || w.itemId} x${w.qty}`).join(', ')
                          : '없음'}
                        {Number(off.wantCredits || 0) > 0 ? ` + ${Number(off.wantCredits)} Cr` : ''}
                      </div>
                      <div className="market-actions" style={{ marginTop: 10 }}>
                        {off.status === 'open' ? (
                          <button onClick={() => cancelTradeOffer(off._id)}>취소</button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {myTradeOffers.length > visibleMyTradeOffers.length ? (
                    <button type="button" className="market-mini-btn" onClick={() => setShowAllMarketRows(true)}>
                      내 오퍼 더 보기 ({visibleMyTradeOffers.length}/{myTradeOffers.length})
                    </button>
                  ) : null}
                </>
              )}

              <div className="market-card" style={{ marginTop: 18 }}>
                <div className="market-title">오퍼 생성</div>
                <div className="market-small" style={{ marginTop: 6 }}>선택한 캐릭터 인벤토리에서 give를 고르고, 원하는 아이템/크레딧을 설정하세요.</div>

                <div style={{ marginTop: 12 }}>
                  <div className="market-small" style={{ fontWeight: 800 }}>주는 것 (give)</div>
                  {(Array.isArray(tradeDraft.give) ? tradeDraft.give : []).map((row, idx) => (
                    <div key={idx} className="market-row" style={{ marginTop: 8, gap: 8 }}>
                      <select
                        value={row.itemId}
                        onChange={(e) => {
                          const next = [...tradeDraft.give];
                          next[idx] = { ...next[idx], itemId: e.target.value };
                          setTradeDraft({ ...tradeDraft, give: next });
                        }}
                        style={{ flex: 1 }}
                      >
                        <option value="">(선택)</option>
                        {inventoryOptions.map((it) => (
                          <option key={it.itemId} value={it.itemId}>{it.name} (보유 {it.qty})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={row.qty}
                        onChange={(e) => {
                          const next = [...tradeDraft.give];
                          next[idx] = { ...next[idx], qty: e.target.value };
                          setTradeDraft({ ...tradeDraft, give: next });
                        }}
                        style={{ width: 70 }}
                      />
                      <button
                        className="market-mini-btn"
                        onClick={() => {
                          const next = tradeDraft.give.filter((_, i) => i !== idx);
                          setTradeDraft({ ...tradeDraft, give: next.length ? next : [{ itemId: '', qty: 1 }] });
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <button
                    className="market-mini-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => setTradeDraft({ ...tradeDraft, give: [...tradeDraft.give, { itemId: '', qty: 1 }] })}
                  >
                    + give 추가
                  </button>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="market-small" style={{ fontWeight: 800 }}>원하는 것 (want)</div>
                  <input
                    value={tradeWantSearch}
                    onChange={(e) => setTradeWantSearch(e.target.value)}
                    placeholder={`원하는 아이템 검색 (표시 ${tradeWantItemOptions.length}/${publicItems.length})`}
                    style={{ width: '100%', marginTop: 8 }}
                  />
                  {(Array.isArray(tradeDraft.want) ? tradeDraft.want : []).map((row, idx) => (
                    <div key={idx} className="market-row" style={{ marginTop: 8, gap: 8 }}>
                      <select
                        value={row.itemId}
                        onChange={(e) => {
                          const next = [...tradeDraft.want];
                          next[idx] = { ...next[idx], itemId: e.target.value };
                          setTradeDraft({ ...tradeDraft, want: next });
                        }}
                        style={{ flex: 1 }}
                      >
                        <option value="">(선택 안 함)</option>
                        {tradeWantItemOptions.map((it) => (
                          <option key={it._id} value={it._id}>{it.name} (tier {it.tier || 1})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={row.qty}
                        onChange={(e) => {
                          const next = [...tradeDraft.want];
                          next[idx] = { ...next[idx], qty: e.target.value };
                          setTradeDraft({ ...tradeDraft, want: next });
                        }}
                        style={{ width: 70 }}
                      />
                      <button
                        className="market-mini-btn"
                        onClick={() => {
                          const next = tradeDraft.want.filter((_, i) => i !== idx);
                          setTradeDraft({ ...tradeDraft, want: next.length ? next : [{ itemId: '', qty: 1 }] });
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <button
                    className="market-mini-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => setTradeDraft({ ...tradeDraft, want: [...tradeDraft.want, { itemId: '', qty: 1 }] })}
                  >
                    + want 추가
                  </button>
                </div>

                <div className="market-row" style={{ marginTop: 12, gap: 8 }}>
                  <div className="market-small" style={{ flex: 1 }}>추가 크레딧 요청</div>
                  <input
                    type="number"
                    min={0}
                    value={tradeDraft.wantCredits}
                    onChange={(e) => setTradeDraft({ ...tradeDraft, wantCredits: e.target.value })}
                    style={{ width: 120 }}
                  />
                </div>

                <div className="market-row" style={{ marginTop: 10 }}>
                  <textarea
                    value={tradeDraft.note}
                    onChange={(e) => setTradeDraft({ ...tradeDraft, note: e.target.value })}
                    placeholder="메모(선택)"
                    style={{ width: '100%', minHeight: 64 }}
                  />
                </div>

                <div className="market-actions" style={{ marginTop: 10 }}>
                  <button onClick={createTradeOffer} disabled={!selectedCharId}>오퍼 생성</button>
                </div>
              </div>
            </div>
          ) : null}
        </aside>
  );
}
