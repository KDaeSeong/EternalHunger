import { useEffect, useMemo, useRef, useState } from 'react';
import { AUTH_SYNC_EVENT, getUser } from '../../../utils/api';
import {
  buildPerkRuntimeBundle,
  applyPerkBundleToActor,
  normalizeRuntimeSurvivorList,
} from './simulationEngine';
import {
  buildItemNameById,
  buildItemMetaById,
  buildItemKeyById,
  buildCraftableItems,
  buildInventoryOptions,
  buildDevGrantItemOptions,
  filterVisibleDevGrantItemOptions,
  getSelectedDevGrantItem,
  buildTradeWantItemOptions,
  limitVisibleRows,
} from './itemOptionsRuntime';
import {
  createMarketStateRuntime,
  loadMarketIntoState,
  loadTradesIntoState,
} from './marketStateRuntime';

function getInitialViewerPerks() {
  const user = getUser();
  return Array.isArray(user?.perks) ? user.perks : [];
}

function createTradeDraft() {
  return {
    give: [{ itemId: '', qty: 1 }],
    want: [{ itemId: '', qty: 1 }],
    wantCredits: 0,
    note: '',
  };
}

function resolveSelectedCharId(survivors, selectedCharIdRaw) {
  const list = Array.isArray(survivors) ? survivors : [];
  if (!list.length) return '';
  const rawId = String(selectedCharIdRaw || '');
  if (rawId && list.some((actor) => String(actor?._id || '') === rawId)) return rawId;
  return String(list[0]?._id || '');
}

function resolveSelectedChar(survivors, selectedCharId) {
  const list = Array.isArray(survivors) ? survivors : [];
  return list.find((survivor) => String(survivor?._id) === String(selectedCharId)) || null;
}

export function useSimulationMarketState({
  devEventPreviewLimit,
  devSelectRenderLimit,
  fireAndReport,
  marketCardRenderLimit,
  runEvents,
  setDead,
  setSurvivors,
  survivors,
}) {
  const fireAndReportRef = useRef(fireAndReport);
  const [marketTab, setMarketTab] = useState('craft');
  const [selectedCharIdRaw, setSelectedCharId] = useState('');
  const selectedCharId = resolveSelectedCharId(survivors, selectedCharIdRaw);
  const selectedChar = useMemo(() => resolveSelectedChar(survivors, selectedCharId), [survivors, selectedCharId]);

  const [credits, setCredits] = useState(0);
  const [publicItems, setPublicItems] = useState([]);
  const [kiosks, setKiosks] = useState([]);
  const [droneOffers, setDroneOffers] = useState([]);
  const [publicPerks, setPublicPerks] = useState([]);
  const [tradeOffers, setTradeOffers] = useState([]);
  const [viewerLp, setViewerLp] = useState(() => Number(getUser()?.lp || 0));
  const [viewerPerks, setViewerPerks] = useState(getInitialViewerPerks);
  const [myTradeOffers, setMyTradeOffers] = useState([]);
  const [qtyMap, setQtyMap] = useState({});
  const [marketMessage, setMarketMessage] = useState('');
  const [devGrantItemId, setDevGrantItemId] = useState('');
  const [devGrantQty, setDevGrantQty] = useState(1);
  const [tradeDraft, setTradeDraft] = useState(createTradeDraft);

  const [showMarketPanel, setShowMarketPanel] = useState(false);
  const [showDevDebugDetails, setShowDevDebugDetails] = useState(false);
  const [showDevEventLog, setShowDevEventLog] = useState(false);
  const [showAllMarketRows, setShowAllMarketRows] = useState(false);
  const [devGrantSearch, setDevGrantSearch] = useState('');
  const [tradeWantSearch, setTradeWantSearch] = useState('');
  const [pendingTranscendPick, setPendingTranscendPick] = useState(null);

  const itemNameById = useMemo(() => buildItemNameById(publicItems), [publicItems]);
  const itemMetaById = useMemo(() => buildItemMetaById(publicItems), [publicItems]);
  const itemKeyById = useMemo(() => buildItemKeyById(publicItems), [publicItems]);
  const craftables = useMemo(() => buildCraftableItems(publicItems), [publicItems]);
  const inventoryOptions = useMemo(() => buildInventoryOptions(selectedChar), [selectedChar]);
  const devGrantItemOptions = useMemo(() => buildDevGrantItemOptions(publicItems), [publicItems]);
  const visibleDevGrantItemOptions = useMemo(
    () => filterVisibleDevGrantItemOptions(devGrantItemOptions, devGrantSearch, devGrantItemId),
    [devGrantItemOptions, devGrantSearch, devGrantItemId]
  );
  const selectedDevGrantItem = useMemo(
    () => getSelectedDevGrantItem(devGrantItemOptions, devGrantItemId),
    [devGrantItemOptions, devGrantItemId]
  );
  const tradeWantItemOptions = useMemo(
    () => buildTradeWantItemOptions(publicItems, tradeWantSearch, tradeDraft?.want, devSelectRenderLimit),
    [publicItems, tradeWantSearch, tradeDraft?.want, devSelectRenderLimit]
  );
  const visibleCraftables = useMemo(
    () => limitVisibleRows(craftables, showAllMarketRows, marketCardRenderLimit),
    [craftables, showAllMarketRows, marketCardRenderLimit]
  );
  const visibleKiosks = useMemo(
    () => limitVisibleRows(kiosks, showAllMarketRows, marketCardRenderLimit),
    [kiosks, showAllMarketRows, marketCardRenderLimit]
  );
  const visibleDroneOffers = useMemo(
    () => limitVisibleRows(droneOffers, showAllMarketRows, marketCardRenderLimit),
    [droneOffers, showAllMarketRows, marketCardRenderLimit]
  );
  const visiblePublicPerks = useMemo(
    () => limitVisibleRows(publicPerks, showAllMarketRows, marketCardRenderLimit),
    [publicPerks, showAllMarketRows, marketCardRenderLimit]
  );
  const visibleTradeOffers = useMemo(
    () => limitVisibleRows(tradeOffers, showAllMarketRows, marketCardRenderLimit),
    [tradeOffers, showAllMarketRows, marketCardRenderLimit]
  );
  const visibleMyTradeOffers = useMemo(
    () => limitVisibleRows(myTradeOffers, showAllMarketRows, marketCardRenderLimit),
    [myTradeOffers, showAllMarketRows, marketCardRenderLimit]
  );
  const runEventsPreviewText = useMemo(() => {
    if (!showDevEventLog) return '';
    return JSON.stringify((Array.isArray(runEvents) ? runEvents : []).slice(-devEventPreviewLimit), null, 2);
  }, [runEvents, showDevEventLog, devEventPreviewLimit]);

  const ownedPerkCodeSet = useMemo(
    () => new Set((Array.isArray(viewerPerks) ? viewerPerks : []).map((value) => String(value || ''))),
    [viewerPerks]
  );
  const activeViewerPerkBundle = useMemo(
    () => buildPerkRuntimeBundle(viewerPerks, publicPerks),
    [viewerPerks, publicPerks]
  );

  const marketStateActions = useMemo(() => createMarketStateRuntime({
    state: {
      itemMetaById,
      qtyMap,
    },
    actions: {
      setCredits,
      setDroneOffers,
      setKiosks,
      setMarketMessage,
      setMarketTab,
      setMyTradeOffers,
      setPublicItems,
      setPublicPerks,
      setQtyMap,
      setShowAllMarketRows,
      setSurvivors,
      setTradeOffers,
      setViewerLp,
      setViewerPerks,
    },
  }), [itemMetaById, qtyMap, setSurvivors]);

  useEffect(() => {
    fireAndReportRef.current = fireAndReport;
  }, [fireAndReport]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncViewerProgress = () => {
      const user = getUser();
      setViewerLp(Math.max(0, Number(user?.lp || 0)));
      setViewerPerks(Array.isArray(user?.perks) ? user.perks.map((value) => String(value || '')).filter(Boolean) : []);
      if (Number.isFinite(Number(user?.credits))) setCredits(Math.max(0, Number(user.credits || 0)));
    };
    syncViewerProgress();
    window.addEventListener(AUTH_SYNC_EVENT, syncViewerProgress);
    return () => window.removeEventListener(AUTH_SYNC_EVENT, syncViewerProgress);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSurvivors((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        if (!list.length) return prev;
        return normalizeRuntimeSurvivorList(list.map((survivor) => applyPerkBundleToActor({ ...survivor }, activeViewerPerkBundle, { applyCredits: true })));
      });
      setDead((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        if (!list.length) return prev;
        return normalizeRuntimeSurvivorList(list.map((survivor) => applyPerkBundleToActor({ ...survivor }, activeViewerPerkBundle, { applyCredits: false })));
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [activeViewerPerkBundle, setDead, setSurvivors]);

  useEffect(() => {
    const report = typeof fireAndReportRef.current === 'function'
      ? fireAndReportRef.current
      : (_label, job) => job();
    if (marketTab === 'trade') {
      void report('marketTab.loadTrades', () => loadTradesIntoState({
        setMarketMessage,
        setMyTradeOffers,
        setTradeOffers,
      }));
    }
    if (marketTab === 'craft' || marketTab === 'kiosk' || marketTab === 'drone' || marketTab === 'perk') {
      void report('marketTab.loadMarket', () => loadMarketIntoState({
        setDroneOffers,
        setKiosks,
        setMarketMessage,
        setPublicItems,
        setPublicPerks,
      }));
    }
  }, [marketTab]);

  return {
    activeViewerPerkBundle,
    applyUserEconomyProgress: marketStateActions.applyUserEconomyProgress,
    craftables,
    credits,
    devGrantItemId,
    devGrantItemOptions,
    devGrantQty,
    devGrantSearch,
    droneOffers,
    getQty: marketStateActions.getQty,
    inventoryOptions,
    itemKeyById,
    itemMetaById,
    itemNameById,
    kiosks,
    loadMarket: marketStateActions.loadMarket,
    loadTrades: marketStateActions.loadTrades,
    marketMessage,
    marketTab,
    myTradeOffers,
    ownedPerkCodeSet,
    patchServerCharacterState: marketStateActions.patchServerCharacterState,
    pendingTranscendPick,
    publicItems,
    publicPerks,
    runEventsPreviewText,
    selectedChar,
    selectedCharId,
    selectedDevGrantItem,
    selectMarketTab: marketStateActions.selectMarketTab,
    setCredits,
    setDevGrantItemId,
    setDevGrantQty,
    setDevGrantSearch,
    setDroneOffers,
    setKiosks,
    setMarketMessage,
    setMyTradeOffers,
    setPendingTranscendPick,
    setPublicItems,
    setPublicPerks,
    setQty: marketStateActions.setQty,
    setSelectedCharId,
    setShowAllMarketRows,
    setShowDevDebugDetails,
    setShowDevEventLog,
    setShowMarketPanel,
    setTradeDraft,
    setTradeOffers,
    setTradeWantSearch,
    setViewerLp,
    setViewerPerks,
    showAllMarketRows,
    showDevDebugDetails,
    showDevEventLog,
    showMarketPanel,
    syncMyState: marketStateActions.syncMyState,
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
  };
}
