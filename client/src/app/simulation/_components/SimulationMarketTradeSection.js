'use client';

import SimulationMarketMyTradeOffers from './SimulationMarketMyTradeOffers';
import SimulationMarketOpenTradeOffers from './SimulationMarketOpenTradeOffers';
import SimulationMarketTradeCreateForm from './SimulationMarketTradeCreateForm';

export default function SimulationMarketTradeSection({
  acceptTradeOffer,
  cancelTradeOffer,
  createTradeOffer,
  inventoryOptions,
  loadTrades,
  myTradeOffers,
  publicItems,
  selectedCharId,
  setShowAllMarketRows,
  setTradeDraft,
  setTradeWantSearch,
  tradeDraft,
  tradeOffers,
  tradeWantItemOptions,
  tradeWantSearch,
  visibleMyTradeOffers,
  visibleTradeOffers,
}) {
  return (
    <div className="market-section">
      <SimulationMarketOpenTradeOffers
        acceptTradeOffer={acceptTradeOffer}
        loadTrades={loadTrades}
        selectedCharId={selectedCharId}
        setShowAllMarketRows={setShowAllMarketRows}
        tradeOffers={tradeOffers}
        visibleTradeOffers={visibleTradeOffers}
      />

      <SimulationMarketMyTradeOffers
        cancelTradeOffer={cancelTradeOffer}
        loadTrades={loadTrades}
        myTradeOffers={myTradeOffers}
        setShowAllMarketRows={setShowAllMarketRows}
        visibleMyTradeOffers={visibleMyTradeOffers}
      />

      <SimulationMarketTradeCreateForm
        createTradeOffer={createTradeOffer}
        inventoryOptions={inventoryOptions}
        publicItems={publicItems}
        selectedCharId={selectedCharId}
        setTradeDraft={setTradeDraft}
        setTradeWantSearch={setTradeWantSearch}
        tradeDraft={tradeDraft}
        tradeWantItemOptions={tradeWantItemOptions}
        tradeWantSearch={tradeWantSearch}
      />
    </div>
  );
}
