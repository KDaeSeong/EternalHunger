'use client';

import { useState } from 'react';
import {
  CAPITAL_DISCLOSURE_TYPES,
  CAPITAL_FINANCING_TYPES,
  GLOBAL_MARKETS,
  PARTNERS,
  PRODUCTS,
} from '../_lib/companyReportEngine';

const DEFAULT_RESTORE_TABLES = 'sales_order, account_receivable, inventory_balance, vat_payment, inventory_valuation, inventory_write_down';

export default function useCompanyReportSelections() {
  const [partnerId, setPartnerId] = useState(PARTNERS[0].id);
  const [productId, setProductId] = useState(PRODUCTS[0].id);
  const [quantity, setQuantity] = useState(40);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedReceivableId, setSelectedReceivableId] = useState('');
  const [globalMarketId, setGlobalMarketId] = useState(GLOBAL_MARKETS[0].id);
  const [globalProductId, setGlobalProductId] = useState(PRODUCTS[0].id);
  const [globalUnits, setGlobalUnits] = useState(120);
  const [selectedForeignArId, setSelectedForeignArId] = useState('');
  const [disclosureTypeId, setDisclosureTypeId] = useState(CAPITAL_DISCLOSURE_TYPES[0].id);
  const [financingTypeId, setFinancingTypeId] = useState(CAPITAL_FINANCING_TYPES[0].id);
  const [restoreMode, setRestoreMode] = useState('FULL_LEDGER');
  const [selectedRestoreTables, setSelectedRestoreTables] = useState(DEFAULT_RESTORE_TABLES);
  const [selectedVatKey, setSelectedVatKey] = useState('');
  const [vatPaymentAmount, setVatPaymentAmount] = useState('');

  const resetForNewRun = () => {
    setPartnerId(PARTNERS[0].id);
    setProductId(PRODUCTS[0].id);
    setQuantity(40);
    setSelectedOrderId('');
    setSelectedReceivableId('');
    setGlobalMarketId(GLOBAL_MARKETS[0].id);
    setGlobalProductId(PRODUCTS[0].id);
    setGlobalUnits(120);
    setSelectedForeignArId('');
    setDisclosureTypeId(CAPITAL_DISCLOSURE_TYPES[0].id);
    setFinancingTypeId(CAPITAL_FINANCING_TYPES[0].id);
    setRestoreMode('FULL_LEDGER');
    setSelectedRestoreTables(DEFAULT_RESTORE_TABLES);
    setSelectedVatKey('');
    setVatPaymentAmount('');
  };

  const resetForLoadedRun = () => {
    setSelectedOrderId('');
    setSelectedReceivableId('');
    setSelectedVatKey('');
    setVatPaymentAmount('');
  };

  return {
    disclosureTypeId,
    financingTypeId,
    globalMarketId,
    globalProductId,
    globalUnits,
    partnerId,
    productId,
    quantity,
    resetForLoadedRun,
    resetForNewRun,
    restoreMode,
    selectedForeignArId,
    selectedOrderId,
    selectedReceivableId,
    selectedRestoreTables,
    selectedVatKey,
    setDisclosureTypeId,
    setFinancingTypeId,
    setGlobalMarketId,
    setGlobalProductId,
    setGlobalUnits,
    setPartnerId,
    setProductId,
    setQuantity,
    setRestoreMode,
    setSelectedForeignArId,
    setSelectedOrderId,
    setSelectedReceivableId,
    setSelectedRestoreTables,
    setSelectedVatKey,
    setVatPaymentAmount,
    vatPaymentAmount,
  };
}
