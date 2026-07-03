'use client';

import SimulationMarketCraftSection from './SimulationMarketCraftSection';
import SimulationMarketDroneSection from './SimulationMarketDroneSection';
import SimulationMarketKioskSection from './SimulationMarketKioskSection';
import SimulationMarketOverview from './SimulationMarketOverview';
import SimulationMarketPerkSection from './SimulationMarketPerkSection';
import SimulationMarketTradeSection from './SimulationMarketTradeSection';

export default function SimulationMarketTabsPanel({
  acceptTradeOffer,
  activeViewerPerkBundle,
  cancelTradeOffer,
  craftables,
  createTradeOffer,
  credits,
  doCraft,
  doDroneBuy,
  doKioskTransaction,
  doPerkPurchase,
  droneOffers,
  fireAndReport,
  getQty,
  inventoryOptions,
  itemNameById,
  kiosks,
  loadMarket,
  loadTrades,
  marketCardRenderLimit,
  marketMessage,
  marketTab,
  myTradeOffers,
  ownedPerkCodeSet,
  publicItems,
  publicPerks,
  selectedCharId,
  setMarketTab,
  setQty,
  setShowAllMarketRows,
  setTradeDraft,
  setTradeWantSearch,
  showAllMarketRows,
  syncMyState,
  tradeDraft,
  tradeOffers,
  tradeWantItemOptions,
  tradeWantSearch,
  viewerLp,
  viewerPerks,
  visibleCraftables,
  visibleDroneOffers,
  visibleKiosks,
  visibleMyTradeOffers,
  visiblePublicPerks,
  visibleTradeOffers,
}) {
  return (
    <>
      <SimulationMarketOverview
        activeViewerPerkBundle={activeViewerPerkBundle}
        credits={credits}
        fireAndReport={fireAndReport}
        loadMarket={loadMarket}
        marketMessage={marketMessage}
        marketTab={marketTab}
        setMarketTab={setMarketTab}
        syncMyState={syncMyState}
        viewerLp={viewerLp}
        viewerPerks={viewerPerks}
      />

      {marketTab === 'craft' ? (
        <SimulationMarketCraftSection
          craftables={craftables}
          doCraft={doCraft}
          getQty={getQty}
          itemNameById={itemNameById}
          selectedCharId={selectedCharId}
          setQty={setQty}
          setShowAllMarketRows={setShowAllMarketRows}
          visibleCraftables={visibleCraftables}
        />
      ) : null}

      {marketTab === 'kiosk' ? (
        <SimulationMarketKioskSection
          doKioskTransaction={doKioskTransaction}
          fireAndReport={fireAndReport}
          getQty={getQty}
          itemNameById={itemNameById}
          kiosks={kiosks}
          loadMarket={loadMarket}
          marketCardRenderLimit={marketCardRenderLimit}
          selectedCharId={selectedCharId}
          setQty={setQty}
          setShowAllMarketRows={setShowAllMarketRows}
          showAllMarketRows={showAllMarketRows}
          visibleKiosks={visibleKiosks}
        />
      ) : null}

      {marketTab === 'drone' ? (
        <SimulationMarketDroneSection
          doDroneBuy={doDroneBuy}
          droneOffers={droneOffers}
          fireAndReport={fireAndReport}
          getQty={getQty}
          loadMarket={loadMarket}
          selectedCharId={selectedCharId}
          setQty={setQty}
          setShowAllMarketRows={setShowAllMarketRows}
          visibleDroneOffers={visibleDroneOffers}
        />
      ) : null}

      {marketTab === 'perk' ? (
        <SimulationMarketPerkSection
          doPerkPurchase={doPerkPurchase}
          fireAndReport={fireAndReport}
          loadMarket={loadMarket}
          ownedPerkCodeSet={ownedPerkCodeSet}
          publicPerks={publicPerks}
          setShowAllMarketRows={setShowAllMarketRows}
          viewerLp={viewerLp}
          visiblePublicPerks={visiblePublicPerks}
        />
      ) : null}

      {marketTab === 'trade' ? (
        <SimulationMarketTradeSection
          acceptTradeOffer={acceptTradeOffer}
          cancelTradeOffer={cancelTradeOffer}
          createTradeOffer={createTradeOffer}
          inventoryOptions={inventoryOptions}
          loadTrades={loadTrades}
          myTradeOffers={myTradeOffers}
          publicItems={publicItems}
          selectedCharId={selectedCharId}
          setShowAllMarketRows={setShowAllMarketRows}
          setTradeDraft={setTradeDraft}
          setTradeWantSearch={setTradeWantSearch}
          tradeDraft={tradeDraft}
          tradeOffers={tradeOffers}
          tradeWantItemOptions={tradeWantItemOptions}
          tradeWantSearch={tradeWantSearch}
          visibleMyTradeOffers={visibleMyTradeOffers}
          visibleTradeOffers={visibleTradeOffers}
        />
      ) : null}
    </>
  );
}
