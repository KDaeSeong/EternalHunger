import { apiGet, updateStoredUser } from '../../../utils/api';
import { autoEquipBest, normalizeRuntimeSurvivor } from './simulationEngine';
import { getApiErrorMessage, loadMarketData, loadTradeData } from './simulationInitRuntime';
import { mergeServerCharacterIntoRuntimeSurvivor } from './runtimeParticipantRuntime';

export function applyUserEconomyProgressToState(patch = {}, actions = {}) {
  const {
    setCredits = () => {},
    setViewerLp = () => {},
    setViewerPerks = () => {},
  } = actions;

  const hasCredits = Number.isFinite(Number(patch?.credits));
  const hasLp = Number.isFinite(Number(patch?.lp));
  const hasPerks = Array.isArray(patch?.perks);

  if (hasCredits) setCredits(Math.max(0, Number(patch.credits || 0)));
  if (hasLp) setViewerLp(Math.max(0, Number(patch.lp || 0)));
  if (hasPerks) setViewerPerks((patch.perks || []).map((x) => String(x || '')).filter(Boolean));

  updateStoredUser((currentUser) => ({
    ...(currentUser || {}),
    ...(hasCredits ? { credits: Math.max(0, Number(patch.credits || 0)) } : {}),
    ...(hasLp ? { lp: Math.max(0, Number(patch.lp || 0)) } : {}),
    ...(hasPerks ? { perks: (patch.perks || []).map((x) => String(x || '')).filter(Boolean) } : {}),
  }));
}

export async function loadMarketIntoState(actions = {}) {
  const {
    setDroneOffers = () => {},
    setKiosks = () => {},
    setMarketMessage = () => {},
    setPublicItems = () => {},
    setPublicPerks = () => {},
  } = actions;

  try {
    setMarketMessage('');
    const result = await loadMarketData();
    setPublicItems(result.publicItems);
    setKiosks(result.kiosks);
    setDroneOffers(result.droneOffers);
    setPublicPerks(result.publicPerks);
    if (result.failedLabels.length) setMarketMessage(`${result.failedLabels.join(', ')} 로드 실패`);
  } catch (error) {
    setMarketMessage(getApiErrorMessage(error));
  }
}

export async function loadTradesIntoState(actions = {}) {
  const {
    setMarketMessage = () => {},
    setMyTradeOffers = () => {},
    setTradeOffers = () => {},
  } = actions;

  try {
    setMarketMessage('');
    const result = await loadTradeData();
    setTradeOffers(result.tradeOffers);
    setMyTradeOffers(result.myTradeOffers);
    if (result.failedLabels.length) setMarketMessage(`${result.failedLabels.join(', ')} 로드 실패`);
  } catch (error) {
    setMarketMessage(getApiErrorMessage(error));
  }
}

export function createMarketStateRuntime(context = {}) {
  const state = context.state || {};
  const actions = context.actions || {};

  const {
    itemMetaById,
    qtyMap,
  } = state;

  const {
    setCredits = () => {},
    setDroneOffers = () => {},
    setKiosks = () => {},
    setMarketMessage = () => {},
    setMarketTab = () => {},
    setMyTradeOffers = () => {},
    setPublicItems = () => {},
    setPublicPerks = () => {},
    setQtyMap = () => {},
    setShowAllMarketRows = () => {},
    setSurvivors = () => {},
    setTradeOffers = () => {},
    setViewerLp = () => {},
    setViewerPerks = () => {},
  } = actions;

  function selectMarketTab(nextTab) {
    setMarketTab(nextTab);
    setShowAllMarketRows(false);
  }

  function getQty(key, fallback = 1) {
    const v = Number(qtyMap?.[key]);
    if (!Number.isFinite(v) || v <= 0) return fallback;
    return Math.floor(v);
  }

  function setQty(key, v) {
    setQtyMap((prev) => ({ ...prev, [key]: v }));
  }

  function patchServerCharacterState(serverCharacter) {
    if (!serverCharacter?._id) return;
    setSurvivors((prev) => (Array.isArray(prev) ? prev : []).map((survivor) => (
      String(survivor?._id) === String(serverCharacter?._id)
        ? (() => {
          const merged = mergeServerCharacterIntoRuntimeSurvivor(survivor, serverCharacter);
          autoEquipBest(merged, itemMetaById);
          return normalizeRuntimeSurvivor(merged);
        })()
        : normalizeRuntimeSurvivor(survivor)
    )));
  }

  function applyUserEconomyProgress(patch = {}) {
    return applyUserEconomyProgressToState(patch, {
      setCredits,
      setViewerLp,
      setViewerPerks,
    });
  }

  async function syncMyState() {
    try {
      const [me, chars] = await Promise.all([
        apiGet('/user/me'),
        apiGet('/characters?view=simulation'),
      ]);
      applyUserEconomyProgress({
        credits: me?.credits,
        lp: me?.lp,
        perks: Array.isArray(me?.perks) ? me.perks : undefined,
      });
      const list = Array.isArray(chars) ? chars : [];
      setSurvivors((prev) => (Array.isArray(prev) ? prev : []).map((survivor) => {
        const found = list.find((character) => String(character?._id) === String(survivor?._id));
        if (!found) return normalizeRuntimeSurvivor(survivor);
        const merged = mergeServerCharacterIntoRuntimeSurvivor(survivor, found);
        autoEquipBest(merged, itemMetaById);
        return normalizeRuntimeSurvivor(merged);
      }));
    } catch (error) {
      console.error(error);
    }
  }

  async function loadMarket() {
    return loadMarketIntoState({
      setDroneOffers,
      setKiosks,
      setMarketMessage,
      setPublicItems,
      setPublicPerks,
    });
  }

  async function loadTrades() {
    return loadTradesIntoState({
      setMarketMessage,
      setMyTradeOffers,
      setTradeOffers,
    });
  }

  return {
    applyUserEconomyProgress,
    getQty,
    loadMarket,
    loadTrades,
    patchServerCharacterState,
    selectMarketTab,
    setQty,
    syncMyState,
  };
}
