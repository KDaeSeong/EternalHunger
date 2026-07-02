import { apiPost } from '../../../utils/api';
import { getRuleset } from '../../../utils/rulesets';
import { gainText } from './runEventRuntime';
import { getApiErrorMessage } from './simulationInitRuntime';
import {
  addItemToInventory,
  autoEquipBest,
  compactIO,
  formatInvAddNote,
  itemDisplayName,
  itemIcon,
  normalizeRuntimeSurvivor,
} from './simulationEngine';

const DEFAULT_TRADE_DRAFT = {
  give: [{ itemId: '', qty: 1 }],
  note: '',
  want: [{ itemId: '', qty: 1 }],
  wantCredits: 0,
};

export function createMarketActionRuntime(context = {}) {
  const runtimeState = context.state || {};
  const actions = context.actions || {};

  const {
    day,
    devGrantItemId,
    devGrantItemOptions,
    devGrantQty,
    isAdvancing,
    isGameOver,
    itemMetaById,
    matchSec,
    phase,
    selectedChar,
    selectedCharId,
    settings,
    showMarketPanel,
    tradeDraft,
  } = runtimeState;

  const {
    addLog = () => {},
    applyUserEconomyProgress = () => {},
    emitItemGainIfAny = () => {},
    getQty = (_key, fallback = 1) => fallback,
    loadMarket = async () => {},
    loadTrades = async () => {},
    patchServerCharacterState = () => {},
    setMarketMessage = () => {},
    setSurvivors = () => {},
    setTradeDraft = () => {},
    syncMyState = async () => {},
  } = actions;

  function ensureCharSelected() {
    if (!selectedCharId) {
      setMarketMessage('생존자를 선택해주세요.');
      return false;
    }
    return true;
  }

  function grantRuntimeItem(actor, item, itemId, qty, ruleset) {
    const ch = {
      ...(actor || {}),
      inventory: Array.isArray(actor?.inventory) ? actor.inventory.map((entry) => ({ ...entry })) : [],
    };
    ch.inventory = addItemToInventory(ch.inventory, item, itemId, qty, day, ruleset);
    const meta = ch.inventory?._lastAdd || null;
    const got = Math.max(0, Number(meta?.acceptedQty ?? qty));
    if (got > 0) autoEquipBest(ch, itemMetaById);
    return { actor: normalizeRuntimeSurvivor(ch), meta, got };
  }

  function devGrantItemToSelected() {
    if (!showMarketPanel) return;
    if (isAdvancing || isGameOver) {
      setMarketMessage('진행 중이거나 종료된 게임에서는 개발자 아이템 지급을 사용할 수 없습니다.');
      return;
    }
    if (!ensureCharSelected()) return;

    const itemId = String(devGrantItemId || '').trim();
    const item = (Array.isArray(devGrantItemOptions) ? devGrantItemOptions : []).find((it) => String(it?._id || '') === itemId) || null;
    if (!item) {
      setMarketMessage('지급할 아이템을 선택해주세요.');
      return;
    }

    const qty = Math.max(1, Math.min(99, Math.floor(Number(devGrantQty || 1))));
    const ruleset = getRuleset(settings?.rulesetId);
    const current = selectedChar;
    if (!current) {
      setMarketMessage('선택 캐릭터를 찾을 수 없습니다.');
      return;
    }

    const res = grantRuntimeItem(current, item, itemId, qty, ruleset);
    const nm = itemDisplayName(item);
    setMarketMessage('');

    setSurvivors((prev) => (Array.isArray(prev) ? prev : []).map((s) => {
      if (String(s?._id) !== String(selectedCharId)) return s;
      return res.actor;
    }));

    addLog(`🛠 [${current.name}] 개발자 아이템 지급: ${itemIcon(item)} ${nm} ${gainText(res.got)}${formatInvAddNote(res.meta, qty, res.actor.inventory, ruleset)}`, res.got > 0 ? 'highlight' : 'death');
    emitItemGainIfAny(res.got, {
      itemId,
      source: 'dev_tool',
      sourceKind: 'manual_grant',
      who: current.name,
      whoId: current._id,
      zoneId: current.zoneId,
    }, { day, phase, sec: matchSec });
    setMarketMessage(res.got > 0
      ? `${current.name}에게 ${nm} x${res.got} 지급 완료`
      : `${current.name}에게 ${nm} 지급 실패`);
  }

  async function doCraft(itemId) {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const qty = getQty(`craft:${itemId}`, 1);
      const res = await apiPost('/items/craft', { characterId: selectedCharId, itemId, qty });
      applyUserEconomyProgress({ credits: res?.credits, lp: res?.lp, perks: Array.isArray(res?.perks) ? res.perks : undefined });
      if (res?.character) patchServerCharacterState(res.character);
      addLog(`🛠️ [조합] ${res?.message || '조합 완료'} (x${qty})`, 'system');
      await Promise.allSettled([syncMyState(), loadMarket()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [조합 실패] ${msg}`, 'death');
    }
  }

  async function doKioskTransaction(kioskId, catalogIndex) {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const qty = getQty(`kiosk:${kioskId}:${catalogIndex}`, 1);
      const res = await apiPost(`/kiosks/${kioskId}/transaction`, { characterId: selectedCharId, catalogIndex, qty });
      applyUserEconomyProgress({ credits: res?.credits, lp: res?.lp, perks: Array.isArray(res?.perks) ? res.perks : undefined });
      if (res?.character) patchServerCharacterState(res.character);
      addLog(`🏪 [키오스크] ${res?.message || '거래 완료'} (x${qty})`, 'system');
      await Promise.allSettled([syncMyState(), loadMarket()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [키오스크 실패] ${msg}`, 'death');
    }
  }

  async function doDroneBuy(offerId) {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const qty = getQty(`drone:${offerId}`, 1);
      const res = await apiPost('/drone/buy', { characterId: selectedCharId, offerId, qty });
      applyUserEconomyProgress({ credits: res?.credits, lp: res?.lp, perks: Array.isArray(res?.perks) ? res.perks : undefined });
      if (res?.character) patchServerCharacterState(res.character);
      addLog(`🚁 [드론] ${res?.message || '구매 완료'} (x${qty})`, 'system');
      await Promise.allSettled([syncMyState(), loadMarket()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [드론 구매 실패] ${msg}`, 'death');
    }
  }

  async function doPerkPurchase(code) {
    try {
      setMarketMessage('');
      const perkCode = String(code || '').trim();
      if (!perkCode) {
        setMarketMessage('특전 코드가 올바르지 않습니다.');
        return;
      }
      const res = await apiPost('/perks/purchase', { code: perkCode });
      applyUserEconomyProgress({ lp: res?.lp, perks: Array.isArray(res?.perks) ? res.perks : undefined });
      addLog(`🎖️ [특전] ${res?.message || '구매 완료'} (${perkCode})`, 'system');
      await Promise.allSettled([syncMyState(), loadMarket()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [특전 구매 실패] ${msg}`, 'death');
    }
  }

  async function createTradeOffer() {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const give = compactIO(tradeDraft?.give);
      const want = compactIO(tradeDraft?.want);
      const wantCredits = Math.max(0, Number(tradeDraft?.wantCredits || 0));
      const note = String(tradeDraft?.note || '');

      if (give.length === 0) {
        setMarketMessage('give 항목이 비었습니다.');
        return;
      }

      await apiPost('/trades', {
        fromCharacterId: selectedCharId,
        give,
        want,
        wantCredits,
        note,
      });

      addLog('🔁 [거래] 오퍼 생성 완료', 'system');
      setTradeDraft({
        give: DEFAULT_TRADE_DRAFT.give.map((entry) => ({ ...entry })),
        note: DEFAULT_TRADE_DRAFT.note,
        want: DEFAULT_TRADE_DRAFT.want.map((entry) => ({ ...entry })),
        wantCredits: DEFAULT_TRADE_DRAFT.wantCredits,
      });
      await Promise.allSettled([loadTrades(), syncMyState()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [거래 오퍼 실패] ${msg}`, 'death');
    }
  }

  async function cancelTradeOffer(offerId) {
    try {
      setMarketMessage('');
      await apiPost(`/trades/${offerId}/cancel`, {});
      addLog('🧾 [거래] 오퍼 취소 완료', 'system');
      await Promise.allSettled([loadTrades(), syncMyState()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [거래 취소 실패] ${msg}`, 'death');
    }
  }

  async function acceptTradeOffer(offerId) {
    if (!ensureCharSelected()) return;
    try {
      setMarketMessage('');
      const res = await apiPost(`/trades/${offerId}/accept`, { toCharacterId: selectedCharId });
      applyUserEconomyProgress({ credits: res?.credits, lp: res?.lp, perks: Array.isArray(res?.perks) ? res.perks : undefined });
      if (res?.character) patchServerCharacterState(res.character);
      addLog('✅ [거래] 수락 완료', 'system');
      await Promise.allSettled([loadTrades(), syncMyState()]);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setMarketMessage(msg);
      addLog(`⚠️ [거래 수락 실패] ${msg}`, 'death');
    }
  }

  return {
    acceptTradeOffer,
    cancelTradeOffer,
    createTradeOffer,
    devGrantItemToSelected,
    doCraft,
    doDroneBuy,
    doKioskTransaction,
    doPerkPurchase,
  };
}
