import { createMarketActionRuntime } from './marketActionRuntime';

export function useSimulationMarketActions({
  actions = {},
  state = {},
} = {}) {
  const getMarketActions = () => createMarketActionRuntime({ state, actions });

  return {
    acceptTradeOffer: (offerId) => getMarketActions().acceptTradeOffer(offerId),
    cancelTradeOffer: (offerId) => getMarketActions().cancelTradeOffer(offerId),
    createTradeOffer: () => getMarketActions().createTradeOffer(),
    devGrantItemToSelected: () => getMarketActions().devGrantItemToSelected(),
    doCraft: (itemId) => getMarketActions().doCraft(itemId),
    doDroneBuy: (offerId) => getMarketActions().doDroneBuy(offerId),
    doKioskTransaction: (kioskId, catalogIndex) => (
      getMarketActions().doKioskTransaction(kioskId, catalogIndex)
    ),
    doPerkPurchase: (code) => getMarketActions().doPerkPurchase(code),
  };
}
