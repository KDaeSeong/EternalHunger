export const GAME_SLUG = 'company-report';
export const QUICK_SAVE_SLOT = 'company-report-main';
export const SAVE_VERSION = 'company-report-v1';

export const PARTNERS = [
  { id: 'future-book', name: '미래문고', type: 'RETAIL', termDays: 30, creditLimit: 50000000 },
  { id: 'blue-collect', name: '청해컬렉션', type: 'WHOLESALE', termDays: 45, creditLimit: 80000000 },
  { id: 'globe-media', name: '글로브미디어', type: 'BROADCAST', termDays: 60, creditLimit: 120000000 },
  { id: 'hanbit-event', name: '한빛이벤트', type: 'EVENT', termDays: 0, creditLimit: 30000000 },
];

export const PRODUCTS = [
  { id: 'book-akashi', name: '각시탈 설정집 1권', category: 'BOOK', character: '각시탈', unitPrice: 28000, unitCost: 9000, hype: 26 },
  { id: 'event-hwahwa', name: '화회원 전통문화 체험권', category: 'EVENT', character: '화회원', unitPrice: 45000, unitCost: 18000, hype: 34 },
  { id: 'goods-aero', name: '마스크드 피에로 아크릴 굿즈', category: 'GOODS', character: '피에로', unitPrice: 22000, unitCost: 7000, hype: 78 },
  { id: 'figure-hae', name: '사해린 프리미엄 피규어', category: 'FIGURE', character: '사해린', unitPrice: 98000, unitCost: 35000, hype: 65 },
  { id: 'video-borama', name: '보라매 프로모션 영상 패키지', category: 'VIDEO', character: '보라매', unitPrice: 38000, unitCost: 12000, hype: 44 },
  { id: 'goods-shiroko', name: '시로코 게스트 굿즈 세트', category: 'GOODS', character: '시로코', unitPrice: 26000, unitCost: 8500, hype: 42 },
  { id: 'video-furina', name: '푸리나 스페셜 영상 컬렉션', category: 'VIDEO', character: '푸리나', unitPrice: 52000, unitCost: 16000, hype: 70 },
];

export const GLOBAL_MARKETS = [
  { id: 'jp-retail', name: '일본 오프라인 서점', currency: 'JPY', exchangeRateKrw: 9.2, demand: 78, logisticsCostPerUnitKrw: 1400, localizationCostKrw: 7200000, tariffRate: 2.5 },
  { id: 'na-stream', name: '북미 스트리밍 플랫폼', currency: 'USD', exchangeRateKrw: 1370, demand: 66, logisticsCostPerUnitKrw: 2600, localizationCostKrw: 11800000, tariffRate: 4.0 },
  { id: 'eu-event', name: '유럽 이벤트 벤더', currency: 'EUR', exchangeRateKrw: 1490, demand: 58, logisticsCostPerUnitKrw: 3100, localizationCostKrw: 9400000, tariffRate: 5.5 },
];

export const CAPITAL_DISCLOSURE_TYPES = [
  { id: 'EARNINGS_CALL', label: '실적 발표', trustDelta: 4, riskDelta: -3, costKrw: 2400000 },
  { id: 'AUDIT_RESPONSE', label: '감사 대응', trustDelta: 2, riskDelta: -6, costKrw: 5200000 },
  { id: 'GOVERNANCE_FIX', label: '지배구조 개선', trustDelta: 5, riskDelta: -4, costKrw: 7800000 },
  { id: 'CLARIFICATION', label: '정정 공시', trustDelta: 1, riskDelta: -2, costKrw: 1800000 },
];

export const CAPITAL_FINANCING_TYPES = [
  { id: 'RIGHTS_OFFERING', label: '유상증자', cashKrw: 240000000, trustDelta: -3, riskDelta: 2, shareDelta: 18000 },
  { id: 'CORPORATE_BOND', label: '회사채 발행', cashKrw: 180000000, trustDelta: -1, riskDelta: 4, debtKrw: 180000000 },
  { id: 'CONVERTIBLE_BOND', label: '전환사채', cashKrw: 160000000, trustDelta: 1, riskDelta: 3, debtKrw: 120000000, shareDelta: 6000 },
];

const FIXED_EXPENSES = [
  { type: 'PAYROLL', label: '인건비', amount: 100800000 },
  { type: 'MARKETING', label: '기본 마케팅비', amount: 42000000 },
  { type: 'PRODUCTION', label: '생산 간접비', amount: 28000000 },
  { type: 'LICENSE', label: '외부 IP 라이선스', amount: 3600000 },
  { type: 'RENT', label: '운영 고정비', amount: 25000000 },
];

export const LEDGER_RESTORE_MODES = [
  { id: 'CORE_STATE', label: '핵심 상태 복원' },
  { id: 'FULL_LEDGER', label: '전체 원장 복원' },
  { id: 'SELECTED_TABLES', label: '선택 테이블 복원' },
];

export const LEDGER_RESTORE_TABLES = [
  { tableName: 'company_info', label: '회사 상태', key: 'company', kind: 'object' },
  { tableName: 'inventory_balance', label: '재고 장부', key: 'inventory', kind: 'objectMap' },
  { tableName: 'sales_order', label: '주문', key: 'orders', kind: 'array' },
  { tableName: 'account_receivable', label: '매출채권', key: 'receivables', kind: 'array' },
  { tableName: 'vat_payment', label: '부가세 납부', key: 'vatPayments', kind: 'array' },
  { tableName: 'inventory_valuation', label: '재고평가', key: 'inventoryValuations', kind: 'array' },
  { tableName: 'inventory_write_down', label: '재고 손상/환입', key: 'inventoryWriteDowns', kind: 'array' },
  { tableName: 'monthly_settlement', label: '월말 결산', key: 'settlements', kind: 'array' },
  { tableName: 'global_export_plan', label: '수출 계획', key: 'global.exportPlans', kind: 'array' },
  { tableName: 'global_import_plan', label: '수입 계획', key: 'global.importPlans', kind: 'array' },
  { tableName: 'global_export_result', label: '수출 실적', key: 'global.exportResults', kind: 'array' },
  { tableName: 'global_import_result', label: '수입 실적', key: 'global.importResults', kind: 'array' },
  { tableName: 'foreign_receivable', label: '외화채권', key: 'global.foreignReceivables', kind: 'array' },
  { tableName: 'hedge_contract', label: '환헤지', key: 'global.hedgeContracts', kind: 'array' },
  { tableName: 'capital_disclosure', label: '공시', key: 'capitalMarket.disclosures', kind: 'array' },
  { tableName: 'dividend_decision', label: '배당', key: 'capitalMarket.dividends', kind: 'array' },
  { tableName: 'financing_plan', label: '자금조달', key: 'capitalMarket.financingPlans', kind: 'array' },
  { tableName: 'stock_price_history', label: '주가 이력', key: 'capitalMarket.stockHistory', kind: 'array' },
];

const LEDGER_TABLE_PARENT_DEPENDENCIES = {
  company_info: [],
  inventory_balance: ['company_info'],
  sales_order: ['company_info'],
  account_receivable: ['company_info', 'sales_order'],
  vat_payment: ['company_info'],
  inventory_valuation: ['company_info', 'inventory_balance'],
  inventory_write_down: ['company_info', 'inventory_balance'],
  monthly_settlement: ['company_info'],
  global_export_plan: ['company_info'],
  global_import_plan: ['company_info'],
  global_export_result: ['company_info', 'global_export_plan'],
  global_import_result: ['company_info', 'global_import_plan'],
  foreign_receivable: ['company_info', 'global_export_plan'],
  hedge_contract: ['company_info'],
  capital_disclosure: ['company_info'],
  dividend_decision: ['company_info'],
  financing_plan: ['company_info'],
  stock_price_history: ['company_info'],
};

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  return {
    runId: options.runId || `company-${Date.now().toString(36)}`,
    startedAt: now,
    updatedAt: now,
    company: {
      name: '청람',
      year: 2026,
      month: 2,
      cashKrw: 1500000000,
      paidInCapital: 100000000,
      reputation: 60,
      fanBase: 50000,
      employeeCount: 24,
      status: 'ACTIVE',
    },
    inventory: {
      'book-akashi': { onHand: 480, reserved: 0, avgCost: 9000 },
      'event-hwahwa': { onHand: 150, reserved: 50, avgCost: 18000 },
      'goods-aero': { onHand: 650, reserved: 0, avgCost: 7000 },
      'figure-hae': { onHand: 90, reserved: 0, avgCost: 35000 },
      'video-borama': { onHand: 200, reserved: 60, avgCost: 12000 },
      'goods-shiroko': { onHand: 360, reserved: 0, avgCost: 8500 },
      'video-furina': { onHand: 120, reserved: 40, avgCost: 16000 },
    },
    orders: [
      createOrderSeed(1, 'future-book', 'book-akashi', 120, 'COMPLETED', 120),
      createOrderSeed(2, 'blue-collect', 'goods-aero', 250, 'SHIPPED', 250),
      createOrderSeed(3, 'blue-collect', 'figure-hae', 30, 'SHIPPED', 30),
      createOrderSeed(4, 'globe-media', 'video-borama', 60, 'CONFIRMED', 0),
    ],
    receivables: [
      createReceivableSeed(1, 'future-book', 3960000, 3960000, 'COLLECTED'),
      createReceivableSeed(2, 'blue-collect', 9680000, 3000000, 'PARTIAL'),
      createReceivableSeed(3, 'globe-media', 5016000, 0, 'OVERDUE'),
    ],
    vatPayments: [],
    inventoryValuations: [],
    inventoryWriteDowns: [],
    settlements: [
      {
        year: 2026,
        month: 1,
        totalSales: 41089920,
        totalCost: 199400000,
        operatingProfit: -158310080,
        tax: 0,
        netProfit: -158310080,
        netCashflow: -164473568,
      },
    ],
    ledgerSnapshots: [],
    restoreHistory: [],
    reportBookmarks: [],
    exportHistory: [],
    global: {
      exportPlans: [],
      importPlans: [],
      exportResults: [],
      importResults: [],
      foreignReceivables: [],
      hedgeContracts: [],
      exchangeRateLog: GLOBAL_MARKETS.map((market) => ({
        marketId: market.id,
        currency: market.currency,
        year: 2026,
        month: 2,
        exchangeRateKrw: market.exchangeRateKrw,
      })),
      nextExportNo: 1,
      nextImportNo: 1,
      nextForeignArNo: 1,
      nextHedgeNo: 1,
    },
    capitalMarket: {
      listed: true,
      sharePrice: 12800,
      sharesOutstanding: 120000,
      investorTrust: 64,
      disclosureRisk: 14,
      debtKrw: 0,
      disclosures: [],
      dividends: [],
      financingPlans: [],
      riskEvents: [],
      stockHistory: [
        { year: 2026, month: 1, sharePrice: 12400, investorTrust: 61, disclosureRisk: 18 },
      ],
      nextDisclosureNo: 1,
      nextDividendNo: 1,
      nextFinancingNo: 1,
      nextRiskNo: 1,
    },
    nextOrderNo: 5,
    nextReceivableNo: 4,
    log: ['청람 경영 원장을 불러왔습니다. 주문, 출고, 회수, 월말 결산을 진행해 보고서를 갱신하세요.'],
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  return {
    ...base,
    ...value,
    company: value.company && typeof value.company === 'object' ? { ...base.company, ...value.company } : base.company,
    inventory: value.inventory && typeof value.inventory === 'object' ? { ...base.inventory, ...value.inventory } : base.inventory,
    orders: Array.isArray(value.orders) ? value.orders : base.orders,
    receivables: Array.isArray(value.receivables) ? value.receivables : base.receivables,
    vatPayments: Array.isArray(value.vatPayments) ? value.vatPayments.slice(0, 36) : base.vatPayments,
    inventoryValuations: Array.isArray(value.inventoryValuations) ? value.inventoryValuations.slice(0, 72) : base.inventoryValuations,
    inventoryWriteDowns: Array.isArray(value.inventoryWriteDowns) ? value.inventoryWriteDowns.slice(0, 36) : base.inventoryWriteDowns,
    settlements: Array.isArray(value.settlements) ? value.settlements : base.settlements,
    ledgerSnapshots: Array.isArray(value.ledgerSnapshots) ? value.ledgerSnapshots : [],
    restoreHistory: Array.isArray(value.restoreHistory) ? value.restoreHistory.slice(0, 12) : [],
    reportBookmarks: Array.isArray(value.reportBookmarks) ? value.reportBookmarks.slice(0, 12) : [],
    exportHistory: Array.isArray(value.exportHistory) ? value.exportHistory.slice(0, 12) : [],
    global: normalizeGlobalState(value.global, base.global),
    capitalMarket: normalizeCapitalMarketState(value.capitalMarket, base.capitalMarket),
    log: Array.isArray(value.log) ? value.log.slice(0, 120) : base.log,
  };
}

export function createOrderAction(state, partnerId, productId, quantity) {
  const current = normalizeState(state);
  const partner = getPartner(partnerId);
  const product = getProduct(productId);
  const qty = Math.max(1, Math.round(Number(quantity || 1)));
  if (!partner || !product) return current;
  const availableCredit = partner.creditLimit - outstandingByPartner(current, partner.id);
  const supplyAmount = product.unitPrice * qty;
  if (supplyAmount * 1.1 > availableCredit) return addLog(current, `${partner.name} 여신 한도가 부족해 주문을 받을 수 없습니다.`);
  const order = {
    id: `SO-${current.company.year}-${String(current.nextOrderNo).padStart(4, '0')}`,
    no: `SO-${current.company.year}-${String(current.nextOrderNo).padStart(4, '0')}`,
    partnerId: partner.id,
    productId: product.id,
    quantity: qty,
    shippedQty: 0,
    unitPrice: product.unitPrice,
    unitCost: product.unitCost,
    status: 'CONFIRMED',
    year: current.company.year,
    month: current.company.month,
  };
  return addLog({
    ...current,
    orders: [order, ...current.orders],
    nextOrderNo: Number(current.nextOrderNo || 1) + 1,
  }, `${partner.name} 주문 ${order.no}를 생성했습니다. ${product.name} ${qty}개.`);
}

export function shipOrderAction(state, orderId) {
  const current = normalizeState(state);
  const order = current.orders.find((item) => item.id === orderId);
  if (!order) return current;
  if (order.status === 'SHIPPED' || order.status === 'COMPLETED') return addLog(current, '이미 출고된 주문입니다.');
  const stock = current.inventory[order.productId] || { onHand: 0, reserved: 0, avgCost: order.unitCost };
  const remaining = Math.max(0, Number(order.quantity || 0) - Number(order.shippedQty || 0));
  if (stock.onHand < remaining) return addLog(current, '재고가 부족해 출고할 수 없습니다. 먼저 입고를 진행하세요.');
  const receivableAmount = Math.round(order.unitPrice * remaining * 1.1);
  const receivable = {
    id: `AR-${current.company.year}-${String(current.nextReceivableNo).padStart(4, '0')}`,
    partnerId: order.partnerId,
    orderId: order.id,
    amount: receivableAmount,
    collected: 0,
    status: 'OPEN',
    year: current.company.year,
    month: current.company.month,
  };
  return addLog({
    ...current,
    inventory: {
      ...current.inventory,
      [order.productId]: { ...stock, onHand: stock.onHand - remaining },
    },
    orders: current.orders.map((item) => item.id === order.id ? { ...item, shippedQty: item.quantity, status: 'SHIPPED' } : item),
    receivables: [receivable, ...current.receivables],
    nextReceivableNo: Number(current.nextReceivableNo || 1) + 1,
  }, `${order.no} 출고 완료. 매출채권 ${formatMoney(receivableAmount)}이 발생했습니다.`);
}

export function collectReceivableAction(state, receivableId) {
  const current = normalizeState(state);
  const receivable = current.receivables.find((item) => item.id === receivableId);
  if (!receivable) return current;
  const remaining = Math.max(0, Number(receivable.amount || 0) - Number(receivable.collected || 0));
  if (!remaining) return addLog(current, '이미 회수 완료된 채권입니다.');
  return addLog({
    ...current,
    company: { ...current.company, cashKrw: Number(current.company.cashKrw || 0) + remaining },
    receivables: current.receivables.map((item) => item.id === receivable.id ? { ...item, collected: item.amount, status: 'COLLECTED' } : item),
  }, `${getPartner(receivable.partnerId)?.name || '거래처'} 채권 ${formatMoney(remaining)}을 회수했습니다.`);
}

export function inboundInventoryAction(state, productId, quantity) {
  const current = normalizeState(state);
  const product = getProduct(productId);
  const qty = Math.max(1, Math.round(Number(quantity || 1)));
  if (!product) return current;
  const cost = product.unitCost * qty;
  if (Number(current.company.cashKrw || 0) < cost) return addLog(current, '현금이 부족해 생산 입고를 진행할 수 없습니다.');
  const stock = current.inventory[product.id] || { onHand: 0, reserved: 0, avgCost: product.unitCost };
  const totalCost = stock.onHand * stock.avgCost + cost;
  const nextQty = stock.onHand + qty;
  return addLog({
    ...current,
    company: { ...current.company, cashKrw: Number(current.company.cashKrw || 0) - cost },
    inventory: {
      ...current.inventory,
      [product.id]: { ...stock, onHand: nextQty, avgCost: Math.round(totalCost / Math.max(1, nextQty)) },
    },
  }, `${product.name} ${qty}개를 생산 입고했습니다. ${formatMoney(cost)} 지출.`);
}

export function closeInventoryValuationAction(state) {
  const current = normalizeState(state);
  const year = Number(current.company.year || 2026);
  const month = Number(current.company.month || 1);
  const existingRows = current.inventoryValuations.filter((row) => !(row.year === year && row.month === month));
  const existingWriteDowns = current.inventoryWriteDowns.filter((row) => !(row.year === year && row.month === month));
  let inventory = JSON.parse(JSON.stringify(current.inventory));
  let totalWriteDown = 0;
  let totalReversal = 0;
  const valuationRows = inventoryRows(current).map((row) => {
    const onHand = Number(row.onHand || 0);
    const avgCost = Number(row.avgCost || row.unitCost || 0);
    const bookAmount = Number(row.amount || 0);
    const nrvRate = estimateInventoryNrvRate(row, current);
    const nrvUnitAmount = Math.round(avgCost * nrvRate);
    const nrvTotalAmount = Math.round(nrvUnitAmount * onHand);
    const priorBalance = priorInventoryWriteDownBalance(current, row.id, year, month);
    let writeDownAmount = 0;
    let reversalAmount = 0;
    let closingAmount = bookAmount;
    let valuationStatus = 'BOOKED';
    if (onHand > 0 && nrvTotalAmount < bookAmount) {
      writeDownAmount = bookAmount - nrvTotalAmount;
      totalWriteDown += writeDownAmount;
      closingAmount = bookAmount - writeDownAmount;
      valuationStatus = 'WRITE_DOWN';
    } else if (onHand > 0 && nrvTotalAmount > bookAmount && priorBalance > 0) {
      reversalAmount = Math.min(priorBalance, nrvTotalAmount - bookAmount);
      totalReversal += reversalAmount;
      closingAmount = bookAmount + reversalAmount;
      valuationStatus = 'REVERSAL';
    }
    const closingAvgCost = onHand > 0 ? Math.round(closingAmount / Math.max(1, onHand)) : avgCost;
    inventory = {
      ...inventory,
      [row.id]: {
        ...(inventory[row.id] || {}),
        onHand,
        reserved: Number(row.reserved || 0),
        avgCost: closingAvgCost,
      },
    };
    return {
      id: `VAL-${year}-${String(month).padStart(2, '0')}-${row.id}`,
      year,
      month,
      productId: row.id,
      productName: row.name,
      onHand,
      avgUnitCostBefore: avgCost,
      bookAmountBefore: bookAmount,
      nrvUnitAmount,
      nrvTotalAmount,
      writeDownAmount,
      reversalAmount,
      closingAvgUnitCost: closingAvgCost,
      closingInventoryAmount: closingAmount,
      valuationStatus,
    };
  });
  const writeDownRows = valuationRows
    .filter((row) => row.writeDownAmount > 0 || row.reversalAmount > 0)
    .map((row) => ({
      id: `WD-${row.year}-${String(row.month).padStart(2, '0')}-${row.productId}`,
      year: row.year,
      month: row.month,
      productId: row.productId,
      productName: row.productName,
      eventType: row.writeDownAmount > 0 ? 'WRITE_DOWN' : 'REVERSAL',
      writeDownAmount: row.writeDownAmount,
      reversalAmount: row.reversalAmount,
      netEffectAmount: row.writeDownAmount - row.reversalAmount,
      note: row.writeDownAmount > 0 ? `${row.productName} NRV 손상 반영` : `${row.productName} NRV 회복에 따른 손상 환입`,
    }));
  return addLog({
    ...current,
    inventory,
    inventoryValuations: [...valuationRows, ...existingRows].slice(0, 72),
    inventoryWriteDowns: [...writeDownRows, ...existingWriteDowns].slice(0, 36),
    company: {
      ...current.company,
      reputation: clamp(Number(current.company.reputation || 0) + (totalWriteDown > 0 ? -1 : totalReversal > 0 ? 1 : 0), 0, 100),
    },
  }, `${year}-${String(month).padStart(2, '0')} 재고평가 완료. 손상 ${formatMoney(totalWriteDown)} / 환입 ${formatMoney(totalReversal)}.`);
}

export function payVatAction(state, targetYear, targetMonth, paymentAmount = null) {
  const current = normalizeState(state);
  const year = Number(targetYear || current.company.year || 2026);
  const month = Math.max(1, Math.min(12, Number(targetMonth || current.company.month || 1)));
  const schedule = vatScheduleRows(current, year).find((row) => row.targetMonth === month);
  if (!schedule || schedule.invoiceVatAmount <= 0) return addLog(current, '납부할 부가세가 없습니다.');
  const amount = Math.max(0, Math.round(Number(paymentAmount == null ? schedule.remainingAmount : paymentAmount)));
  if (!amount) return addLog(current, '부가세 납부액을 입력하세요.');
  if (amount > schedule.remainingAmount) return addLog(current, `부가세 납부액이 잔액을 초과했습니다. 잔액 ${formatMoney(schedule.remainingAmount)}.`);
  if (Number(current.company.cashKrw || 0) < amount) return addLog(current, '현금이 부족해 부가세를 납부할 수 없습니다.');
  const payment = {
    id: `VAT-${year}-${String(month).padStart(2, '0')}-${Date.now().toString(36)}`,
    targetYear: year,
    targetMonth: month,
    paymentDate: `${current.company.year}-${String(current.company.month).padStart(2, '0')}-25`,
    payableBefore: schedule.remainingAmount,
    paymentAmount: amount,
    remainingAfter: Math.max(0, schedule.remainingAmount - amount),
    paymentMethod: 'BANK',
    referenceNo: `AUTO-${current.company.year}${String(current.company.month).padStart(2, '0')}`,
    note: `${year}-${String(month).padStart(2, '0')} 부가세 납부`,
  };
  return addLog({
    ...current,
    company: {
      ...current.company,
      cashKrw: Number(current.company.cashKrw || 0) - amount,
    },
    vatPayments: [payment, ...current.vatPayments].slice(0, 36),
  }, `${year}-${String(month).padStart(2, '0')} 부가세 ${formatMoney(amount)} 납부 완료.`);
}

export function marketingCampaignAction(state, productId) {
  const current = normalizeState(state);
  const product = getProduct(productId);
  if (!product) return current;
  const cost = 12000000 + product.hype * 80000;
  if (Number(current.company.cashKrw || 0) < cost) return addLog(current, '현금이 부족해 캠페인을 집행할 수 없습니다.');
  return addLog({
    ...current,
    company: {
      ...current.company,
      cashKrw: Number(current.company.cashKrw || 0) - cost,
      reputation: clamp(Number(current.company.reputation || 0) + Math.ceil(product.hype / 28), 0, 100),
      fanBase: Number(current.company.fanBase || 0) + product.hype * 90,
    },
  }, `${product.name} 캠페인을 집행했습니다. 평판과 팬덤이 상승했습니다.`);
}

export function createExportPlanAction(state, marketId, productId, plannedUnits) {
  const current = normalizeState(state);
  const market = getMarket(marketId);
  const product = getProduct(productId);
  const units = Math.max(1, Math.round(Number(plannedUnits || 1)));
  if (!market || !product) return current;
  const plan = {
    id: `EX-${current.company.year}-${String(current.global.nextExportNo).padStart(4, '0')}`,
    marketId: market.id,
    productId: product.id,
    plannedUnits: units,
    exchangeRateKrw: market.exchangeRateKrw,
    status: 'ACTIVE',
    year: current.company.year,
    month: current.company.month,
  };
  return addLog({
    ...current,
    global: {
      ...current.global,
      exportPlans: [plan, ...current.global.exportPlans].slice(0, 16),
      nextExportNo: Number(current.global.nextExportNo || 1) + 1,
    },
  }, `${market.name} 수출 계획 ${plan.id}를 등록했습니다. ${product.name} ${units}개.`);
}

export function createImportPlanAction(state, marketId, productId, plannedUnits) {
  const current = normalizeState(state);
  const market = getMarket(marketId);
  const product = getProduct(productId);
  const units = Math.max(1, Math.round(Number(plannedUnits || 1)));
  if (!market || !product) return current;
  const plan = {
    id: `IM-${current.company.year}-${String(current.global.nextImportNo).padStart(4, '0')}`,
    marketId: market.id,
    productId: product.id,
    plannedUnits: units,
    exchangeRateKrw: market.exchangeRateKrw,
    status: 'ACTIVE',
    year: current.company.year,
    month: current.company.month,
  };
  return addLog({
    ...current,
    global: {
      ...current.global,
      importPlans: [plan, ...current.global.importPlans].slice(0, 16),
      nextImportNo: Number(current.global.nextImportNo || 1) + 1,
    },
  }, `${market.name} 수입 계획 ${plan.id}를 등록했습니다. ${product.name} ${units}개.`);
}

export function createHedgeContractAction(state) {
  const current = normalizeState(state);
  const summary = globalTradeSummary(current);
  const notionalKrw = Math.max(50000000, Math.round((summary.openForeignReceivableKrw || 0) * 0.65));
  const premiumKrw = Math.round(notionalKrw * 0.012);
  if (Number(current.company.cashKrw || 0) < premiumKrw) return addLog(current, '현금이 부족해 환헤지 프리미엄을 납부할 수 없습니다.');
  const hedge = {
    id: `HG-${current.company.year}-${String(current.global.nextHedgeNo).padStart(4, '0')}`,
    notionalKrw,
    premiumKrw,
    status: 'ACTIVE',
    year: current.company.year,
    month: current.company.month,
  };
  return addLog({
    ...current,
    company: { ...current.company, cashKrw: Number(current.company.cashKrw || 0) - premiumKrw },
    global: {
      ...current.global,
      hedgeContracts: [hedge, ...current.global.hedgeContracts].slice(0, 12),
      nextHedgeNo: Number(current.global.nextHedgeNo || 1) + 1,
    },
  }, `${hedge.id} 환헤지 계약을 체결했습니다. 프리미엄 ${formatMoney(premiumKrw)}.`);
}

export function settleGlobalTradeAction(state) {
  const current = normalizeState(state);
  const activeExports = current.global.exportPlans.filter((plan) => plan.status === 'ACTIVE');
  const activeImports = current.global.importPlans.filter((plan) => plan.status === 'ACTIVE');
  if (!activeExports.length && !activeImports.length) return addLog(current, '정산할 활성 수출입 계획이 없습니다.');

  let cashKrw = Number(current.company.cashKrw || 0);
  let nextForeignNo = Number(current.global.nextForeignArNo || 1);
  let nextInventory = JSON.parse(JSON.stringify(current.inventory));
  const exportResults = [];
  const importResults = [];
  const foreignReceivables = [];
  const hedgeEffectKrw = current.global.hedgeContracts
    .filter((hedge) => hedge.status === 'ACTIVE')
    .reduce((sum, hedge) => sum + Math.round(Number(hedge.notionalKrw || 0) * 0.018), 0);

  for (const plan of activeExports) {
    const market = getMarket(plan.marketId);
    const product = getProduct(plan.productId);
    if (!market || !product) continue;
    const soldUnits = Math.max(1, Math.round(Number(plan.plannedUnits || 0) * Math.min(1.15, (market.demand + Number(current.company.reputation || 0)) / 165)));
    const salesKrw = Math.round(product.unitPrice * soldUnits * (1 + market.demand / 230));
    const exportCostKrw = Math.round(product.unitCost * soldUnits + market.logisticsCostPerUnitKrw * soldUnits + market.localizationCostKrw);
    if (cashKrw < exportCostKrw) return addLog(current, `${plan.id} 정산에 필요한 현금 ${formatMoney(exportCostKrw)}이 부족합니다.`);
    cashKrw -= exportCostKrw;
    const fxGainLossKrw = Math.round(salesKrw * ((market.exchangeRateKrw - Number(plan.exchangeRateKrw || market.exchangeRateKrw)) / Math.max(1, Number(plan.exchangeRateKrw || market.exchangeRateKrw))));
    const receivableAmountKrw = Math.max(0, salesKrw + fxGainLossKrw);
    const foreignAr = {
      id: `FAR-${current.company.year}-${String(nextForeignNo).padStart(4, '0')}`,
      marketId: market.id,
      productId: product.id,
      amountKrw: receivableAmountKrw,
      collectedKrw: 0,
      currency: market.currency,
      status: 'OPEN',
      year: current.company.year,
      month: current.company.month,
    };
    nextForeignNo += 1;
    foreignReceivables.push(foreignAr);
    exportResults.push({
      id: `EXR-${plan.id}`,
      planId: plan.id,
      marketId: market.id,
      productId: product.id,
      soldUnits,
      salesKrw,
      exportCostKrw,
      fxGainLossKrw,
      receivableAmountKrw,
      year: current.company.year,
      month: current.company.month,
    });
  }

  for (const plan of activeImports) {
    const market = getMarket(plan.marketId);
    const product = getProduct(plan.productId);
    if (!market || !product) continue;
    const units = Math.max(1, Math.round(Number(plan.plannedUnits || 0)));
    const landedUnitCostKrw = Math.round(product.unitCost * 0.72 + market.logisticsCostPerUnitKrw + product.unitCost * (market.tariffRate / 100));
    const landedCostKrw = landedUnitCostKrw * units;
    if (cashKrw < landedCostKrw) return addLog(current, `${plan.id} 수입 입고에 필요한 현금 ${formatMoney(landedCostKrw)}이 부족합니다.`);
    cashKrw -= landedCostKrw;
    const stock = nextInventory[product.id] || { onHand: 0, reserved: 0, avgCost: product.unitCost };
    const nextQty = Number(stock.onHand || 0) + units;
    const totalCost = Number(stock.onHand || 0) * Number(stock.avgCost || product.unitCost) + landedCostKrw;
    nextInventory[product.id] = { ...stock, onHand: nextQty, avgCost: Math.round(totalCost / Math.max(1, nextQty)) };
    importResults.push({
      id: `IMR-${plan.id}`,
      planId: plan.id,
      marketId: market.id,
      productId: product.id,
      units,
      landedUnitCostKrw,
      landedCostKrw,
      year: current.company.year,
      month: current.company.month,
    });
  }

  cashKrw += hedgeEffectKrw;
  return addLog({
    ...current,
    company: {
      ...current.company,
      cashKrw,
      reputation: clamp(Number(current.company.reputation || 0) + exportResults.length * 2 + importResults.length, 0, 100),
      fanBase: Number(current.company.fanBase || 0) + exportResults.reduce((sum, row) => sum + row.soldUnits * 12, 0),
    },
    inventory: nextInventory,
    global: {
      ...current.global,
      exportPlans: current.global.exportPlans.map((plan) => plan.status === 'ACTIVE' ? { ...plan, status: 'COMPLETED' } : plan),
      importPlans: current.global.importPlans.map((plan) => plan.status === 'ACTIVE' ? { ...plan, status: 'COMPLETED' } : plan),
      exportResults: [...exportResults, ...current.global.exportResults].slice(0, 18),
      importResults: [...importResults, ...current.global.importResults].slice(0, 18),
      foreignReceivables: [...foreignReceivables, ...current.global.foreignReceivables].slice(0, 18),
      hedgeContracts: current.global.hedgeContracts.map((hedge) => hedge.status === 'ACTIVE' ? { ...hedge, status: 'SETTLED', settlementKrw: Math.round(Number(hedge.notionalKrw || 0) * 0.018) } : hedge),
      nextForeignArNo: nextForeignNo,
    },
  }, `글로벌 수출입 정산 완료. 수출 ${exportResults.length}건, 수입 ${importResults.length}건, 헤지효과 ${formatMoney(hedgeEffectKrw)}.`);
}

export function collectForeignReceivableAction(state, foreignArId) {
  const current = normalizeState(state);
  const row = current.global.foreignReceivables.find((item) => item.id === foreignArId);
  if (!row) return current;
  const remaining = Math.max(0, Number(row.amountKrw || 0) - Number(row.collectedKrw || 0));
  if (!remaining) return addLog(current, '이미 회수 완료된 외화채권입니다.');
  return addLog({
    ...current,
    company: { ...current.company, cashKrw: Number(current.company.cashKrw || 0) + remaining },
    global: {
      ...current.global,
      foreignReceivables: current.global.foreignReceivables.map((item) => item.id === row.id ? { ...item, collectedKrw: item.amountKrw, status: 'COLLECTED' } : item),
    },
  }, `${getMarket(row.marketId)?.name || '해외 시장'} 외화채권 ${formatMoney(remaining)}을 회수했습니다.`);
}

export function createDisclosureAction(state, disclosureTypeId) {
  const current = normalizeState(state);
  const type = CAPITAL_DISCLOSURE_TYPES.find((item) => item.id === disclosureTypeId) || CAPITAL_DISCLOSURE_TYPES[0];
  if (Number(current.company.cashKrw || 0) < type.costKrw) return addLog(current, '현금이 부족해 공시 대응을 진행할 수 없습니다.');
  const disclosure = {
    id: `DSC-${current.company.year}-${String(current.capitalMarket.nextDisclosureNo).padStart(4, '0')}`,
    type: type.id,
    label: type.label,
    costKrw: type.costKrw,
    trustDelta: type.trustDelta,
    riskDelta: type.riskDelta,
    year: current.company.year,
    month: current.company.month,
  };
  return addLog({
    ...current,
    company: { ...current.company, cashKrw: Number(current.company.cashKrw || 0) - type.costKrw },
    capitalMarket: {
      ...current.capitalMarket,
      investorTrust: clamp(Number(current.capitalMarket.investorTrust || 0) + type.trustDelta, 0, 100),
      disclosureRisk: clamp(Number(current.capitalMarket.disclosureRisk || 0) + type.riskDelta, 0, 100),
      disclosures: [disclosure, ...current.capitalMarket.disclosures].slice(0, 16),
      nextDisclosureNo: Number(current.capitalMarket.nextDisclosureNo || 1) + 1,
    },
  }, `${type.label} 공시 대응을 진행했습니다. 투자자 신뢰 ${type.trustDelta >= 0 ? '+' : ''}${type.trustDelta}.`);
}

export function decideDividendAction(state) {
  const current = normalizeState(state);
  const amountKrw = Math.round(Number(current.capitalMarket.sharesOutstanding || 0) * 120);
  if (Number(current.company.cashKrw || 0) < amountKrw) return addLog(current, '현금이 부족해 배당을 결정할 수 없습니다.');
  const dividend = {
    id: `DIV-${current.company.year}-${String(current.capitalMarket.nextDividendNo).padStart(4, '0')}`,
    amountKrw,
    perShareKrw: 120,
    year: current.company.year,
    month: current.company.month,
  };
  return addLog({
    ...current,
    company: { ...current.company, cashKrw: Number(current.company.cashKrw || 0) - amountKrw },
    capitalMarket: {
      ...current.capitalMarket,
      investorTrust: clamp(Number(current.capitalMarket.investorTrust || 0) + 3, 0, 100),
      dividends: [dividend, ...current.capitalMarket.dividends].slice(0, 12),
      nextDividendNo: Number(current.capitalMarket.nextDividendNo || 1) + 1,
    },
  }, `주당 ${formatMoney(dividend.perShareKrw)} 배당을 결정했습니다. 총 ${formatMoney(amountKrw)}.`);
}

export function raiseCapitalAction(state, financingTypeId) {
  const current = normalizeState(state);
  const type = CAPITAL_FINANCING_TYPES.find((item) => item.id === financingTypeId) || CAPITAL_FINANCING_TYPES[0];
  const plan = {
    id: `FIN-${current.company.year}-${String(current.capitalMarket.nextFinancingNo).padStart(4, '0')}`,
    type: type.id,
    label: type.label,
    cashKrw: type.cashKrw,
    debtKrw: type.debtKrw || 0,
    shareDelta: type.shareDelta || 0,
    year: current.company.year,
    month: current.company.month,
  };
  return addLog({
    ...current,
    company: { ...current.company, cashKrw: Number(current.company.cashKrw || 0) + type.cashKrw },
    capitalMarket: {
      ...current.capitalMarket,
      sharesOutstanding: Number(current.capitalMarket.sharesOutstanding || 0) + Number(type.shareDelta || 0),
      debtKrw: Number(current.capitalMarket.debtKrw || 0) + Number(type.debtKrw || 0),
      investorTrust: clamp(Number(current.capitalMarket.investorTrust || 0) + type.trustDelta, 0, 100),
      disclosureRisk: clamp(Number(current.capitalMarket.disclosureRisk || 0) + type.riskDelta, 0, 100),
      financingPlans: [plan, ...current.capitalMarket.financingPlans].slice(0, 12),
      nextFinancingNo: Number(current.capitalMarket.nextFinancingNo || 1) + 1,
    },
  }, `${type.label}으로 ${formatMoney(type.cashKrw)}을 조달했습니다.`);
}

export function closeCapitalMarketAction(state) {
  const current = normalizeState(state);
  const summary = reportSummary(current);
  const global = globalTradeSummary(current);
  const trust = Number(current.capitalMarket.investorTrust || 0);
  const risk = Number(current.capitalMarket.disclosureRisk || 0);
  const salesMomentum = Math.min(8, Math.round((summary.sales + global.exportSalesKrw) / 25000000));
  const profitSignal = (summary.latestSettlement?.netProfit || managementReport(current).income.operatingProfit) >= 0 ? 2 : -3;
  const trustDelta = profitSignal + salesMomentum - Math.round(risk / 28);
  const nextTrust = clamp(trust + trustDelta, 0, 100);
  const priceMovePct = (nextTrust - trust) * 0.018 + salesMomentum * 0.006 - risk * 0.0015;
  const nextSharePrice = Math.max(1000, Math.round(Number(current.capitalMarket.sharePrice || 1000) * (1 + priceMovePct)));
  const stockPoint = {
    year: current.company.year,
    month: current.company.month,
    sharePrice: nextSharePrice,
    investorTrust: nextTrust,
    disclosureRisk: clamp(risk - 1, 0, 100),
  };
  return addLog({
    ...current,
    capitalMarket: {
      ...current.capitalMarket,
      sharePrice: nextSharePrice,
      investorTrust: nextTrust,
      disclosureRisk: stockPoint.disclosureRisk,
      stockHistory: [stockPoint, ...current.capitalMarket.stockHistory].slice(0, 18),
    },
  }, `자본시장 월마감 완료. 주가 ${formatMoney(nextSharePrice)}, 투자자 신뢰 ${nextTrust}.`);
}

export function monthEndCloseAction(state) {
  const current = normalizeState(state);
  const year = Number(current.company.year || 2026);
  const month = Number(current.company.month || 1);
  const monthOrders = current.orders.filter((order) => order.year === year && order.month === month && (order.status === 'SHIPPED' || order.status === 'COMPLETED'));
  const sales = monthOrders.reduce((sum, order) => sum + order.unitPrice * Number(order.shippedQty || order.quantity || 0), 0);
  const cogs = monthOrders.reduce((sum, order) => sum + order.unitCost * Number(order.shippedQty || order.quantity || 0), 0);
  const expense = FIXED_EXPENSES.reduce((sum, item) => sum + item.amount, 0);
  const inventoryWriteDownNet = current.inventoryWriteDowns
    .filter((row) => Number(row.year || 0) === year && Number(row.month || 0) === month)
    .reduce((sum, row) => sum + Number(row.netEffectAmount || 0), 0);
  const operatingProfit = sales - cogs - expense - inventoryWriteDownNet;
  const tax = operatingProfit > 0 ? Math.round(operatingProfit * 0.22) : 0;
  const netProfit = operatingProfit - tax;
  const cashOutflow = cogs + expense + tax;
  const cashInflow = current.receivables
    .filter((ar) => ar.status === 'COLLECTED' && ar.year === year && ar.month === month)
    .reduce((sum, ar) => sum + Number(ar.amount || 0), 0);
  const settlement = {
    year,
    month,
    totalSales: sales,
    totalCost: cogs + expense,
    inventoryWriteDownNet,
    operatingProfit,
    tax,
    netProfit,
    netCashflow: cashInflow - cashOutflow,
  };
  const nextDate = advanceMonth(year, month);
  return addLog({
    ...current,
    company: {
      ...current.company,
      year: nextDate.year,
      month: nextDate.month,
      cashKrw: Number(current.company.cashKrw || 0) - tax,
      reputation: clamp(Number(current.company.reputation || 0) + (netProfit >= 0 ? 1 : -2), 0, 100),
    },
    settlements: [settlement, ...current.settlements].slice(0, 18),
  }, `${year}-${String(month).padStart(2, '0')} 월말 결산 완료. 순손익 ${formatMoney(netProfit)}.`);
}

export function createLedgerSnapshotAction(state) {
  const current = normalizeState(state);
  const payload = snapshotPayload(current);
  const checksum = simpleChecksum(JSON.stringify(payload));
  const snapshot = {
    id: `SNAP-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    label: `${current.company.year}-${String(current.company.month).padStart(2, '0')} 원장 스냅샷`,
    checksum,
    manifestChecksum: ledgerManifestChecksum(payload, LEDGER_RESTORE_TABLES),
    rowCount: ledgerRowCount(current),
    payload,
  };
  return addLog({
    ...current,
    ledgerSnapshots: [snapshot, ...current.ledgerSnapshots].slice(0, 8),
  }, `${snapshot.label}을 생성했습니다. checksum ${checksum}.`);
}

export function restoreLatestSnapshotAction(state) {
  const current = normalizeState(state);
  const snapshot = current.ledgerSnapshots[0];
  if (!snapshot?.payload) return addLog(current, '복원할 원장 스냅샷이 없습니다.');
  const restored = normalizeState({
    ...current,
    ...snapshot.payload,
    ledgerSnapshots: current.ledgerSnapshots,
    restoreHistory: current.restoreHistory,
  });
  return addLog(restored, `${snapshot.label} 기준으로 원장 상태를 복원했습니다.`);
}

export function dryRunLedgerRestoreAction(state, restoreMode = 'FULL_LEDGER', tablesText = '') {
  const current = normalizeState(state);
  const plan = ledgerRestorePlan(current, restoreMode, tablesText);
  const historyItem = {
    id: `DRY-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    type: 'DRY_RUN',
    restoreMode: plan.restoreMode,
    status: plan.dryRunStatus,
    targetTableCount: plan.targetTables.length,
    deleteOrder: plan.deleteOrder,
    insertOrder: plan.insertOrder,
    cycleDetected: plan.cycleDetected,
    message: plan.message,
    checksum: plan.snapshotChecksum,
  };
  return addLog({
    ...current,
    restoreHistory: [historyItem, ...current.restoreHistory].slice(0, 12),
  }, `원장 복원 dry-run: ${plan.dryRunStatus} / ${plan.message}`);
}

export function restoreLedgerSnapshotAction(state, restoreMode = 'FULL_LEDGER', tablesText = '') {
  const current = normalizeState(state);
  const snapshot = current.ledgerSnapshots[0];
  if (!snapshot?.payload) return addLog(current, '복원할 원장 스냅샷이 없습니다.');
  const plan = ledgerRestorePlan(current, restoreMode, tablesText);
  if (!plan.restorable) return addLog(current, `물리 복원 차단: ${plan.message}`);

  const payload = snapshot.payload;
  const targetTableNames = new Set(plan.targetTables.map((row) => row.tableName));
  const restoredPayload = restoreMode !== 'SELECTED_TABLES'
    ? payload
    : LEDGER_RESTORE_TABLES.reduce((next, table) => {
      if (!targetTableNames.has(table.tableName)) return next;
      return setPathValue(next, table.key, cloneValue(getPathValue(payload, table.key)));
    }, {});

  const restored = normalizeState({
    ...current,
    ...restoredPayload,
    global: {
      ...current.global,
      ...(restoredPayload.global || {}),
    },
    capitalMarket: {
      ...current.capitalMarket,
      ...(restoredPayload.capitalMarket || {}),
    },
    ledgerSnapshots: current.ledgerSnapshots,
    restoreHistory: current.restoreHistory,
    reportBookmarks: current.reportBookmarks,
    exportHistory: current.exportHistory,
  });
  const afterPlan = ledgerRestorePlan(restored, restoreMode, tablesText);
  const historyItem = {
    id: `RST-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    type: 'RESTORE',
    restoreMode: plan.restoreMode,
    status: afterPlan.afterDiffStatus === 'MATCH' ? 'SUCCESS' : 'CHECK',
    physicalRestore: restoreMode !== 'CORE_STATE',
    dryRunPassed: plan.dryRunStatus === 'READY',
    beforeDiffStatus: plan.beforeDiffStatus,
    afterDiffStatus: afterPlan.afterDiffStatus,
    targetTableCount: plan.targetTables.length,
    deletedRowCount: plan.deletedRowCount,
    insertedRowCount: plan.insertedRowCount,
    deleteOrder: plan.deleteOrder,
    insertOrder: plan.insertOrder,
    cycleDetected: plan.cycleDetected,
    checksum: plan.snapshotChecksum,
  };
  return addLog({
    ...restored,
    restoreHistory: [historyItem, ...current.restoreHistory].slice(0, 12),
  }, `${plan.restoreModeLabel} 완료. 대상 ${plan.targetTables.length}개 테이블, ${plan.insertedRowCount} rows 복원.`);
}

export function bookmarkCurrentReportAction(state) {
  const current = normalizeState(state);
  const summary = reportSummary(current);
  const management = managementReport(current);
  const latest = summary.latestSettlement;
  const label = latest
    ? `${latest.year}-${String(latest.month).padStart(2, '0')} 결산 리포트`
    : `${current.company.year}-${String(current.company.month).padStart(2, '0')} 진행 리포트`;
  const bookmark = {
    id: `BM-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    label,
    favorite: true,
    year: latest?.year || current.company.year,
    month: latest?.month || current.company.month,
    sales: management.income.sales,
    operatingProfit: management.income.operatingProfit,
    netProfit: latest?.netProfit ?? management.income.operatingProfit,
    cashKrw: current.company.cashKrw,
    assets: summary.assets,
    receivableAmount: summary.receivableAmount,
    score: scoreState(current),
    note: management.recommendations[0] || '특이사항 없음',
  };
  return addLog({
    ...current,
    reportBookmarks: [bookmark, ...current.reportBookmarks.filter((item) => item.label !== label)].slice(0, 12),
  }, `${label}를 북마크했습니다.`);
}

export function ledgerDiffRows(state) {
  const current = normalizeState(state);
  const snapshot = current.ledgerSnapshots[0];
  if (!snapshot?.payload) return [];
  const before = ledgerComparableSummary(snapshot.payload);
  const after = ledgerComparableSummary(snapshotPayload(current));
  return [
    textDiffRow('월', before.period, after.period),
    moneyDiffRow('현금', before.cashKrw, after.cashKrw),
    moneyDiffRow('재고 장부', before.inventoryAmount, after.inventoryAmount),
    moneyDiffRow('채권 잔액', before.receivableAmount, after.receivableAmount),
    moneyDiffRow('외화채권', before.foreignReceivableAmount, after.foreignReceivableAmount),
    moneyDiffRow('시가총액', before.marketCapKrw, after.marketCapKrw),
    numberDiffRow('주문', before.orderCount, after.orderCount, '건'),
    numberDiffRow('출고 주문', before.shippedOrders, after.shippedOrders, '건'),
    numberDiffRow('미수 채권', before.openReceivables, after.openReceivables, '건'),
    numberDiffRow('VAT 납부', before.vatPaymentCount, after.vatPaymentCount, '건'),
    moneyDiffRow('재고 손상 순액', before.inventoryWriteDownAmount, after.inventoryWriteDownAmount),
    numberDiffRow('수출 결과', before.exportResultCount, after.exportResultCount, '건'),
    numberDiffRow('수입 결과', before.importResultCount, after.importResultCount, '건'),
    numberDiffRow('결산', before.settlementCount, after.settlementCount, '건'),
    numberDiffRow('평판', before.reputation, after.reputation),
    numberDiffRow('팬덤', before.fanBase, after.fanBase, '명'),
    numberDiffRow('투자자 신뢰', before.investorTrust, after.investorTrust),
    numberDiffRow('공시위험', before.disclosureRisk, after.disclosureRisk),
  ];
}

export function ledgerRestorePlan(state, restoreMode = 'FULL_LEDGER', tablesText = '') {
  const current = normalizeState(state);
  const snapshot = current.ledgerSnapshots[0];
  const mode = LEDGER_RESTORE_MODES.some((item) => item.id === restoreMode) ? restoreMode : 'FULL_LEDGER';
  const modeLabel = LEDGER_RESTORE_MODES.find((item) => item.id === mode)?.label || mode;
  if (!snapshot?.payload) {
    return {
      restoreMode: mode,
      restoreModeLabel: modeLabel,
      dryRunStatus: 'BLOCKED',
      restorable: false,
      physicalRestore: mode !== 'CORE_STATE',
      beforeDiffStatus: 'NO_SNAPSHOT',
      afterDiffStatus: 'NO_SNAPSHOT',
      message: '복원할 스냅샷이 없습니다.',
      warnings: ['먼저 원장 스냅샷을 생성하세요.'],
      targetTables: [],
      deleteOrder: [],
      insertOrder: [],
      cycleDetected: false,
      missingDependencies: [],
      tableDiffs: [],
      deletedRowCount: 0,
      insertedRowCount: 0,
      snapshotChecksum: '',
      recalculatedSnapshotChecksum: '',
      currentChecksum: '',
    };
  }

  const selection = resolveRestoreTables(mode, tablesText);
  const snapshotChecksum = snapshot.manifestChecksum || snapshot.checksum || simpleChecksum(JSON.stringify(snapshot.payload || {}));
  const fullManifestChecksum = ledgerManifestChecksum(snapshot.payload, LEDGER_RESTORE_TABLES);
  const snapshotChecksumValid = snapshot.manifestChecksum ? snapshot.manifestChecksum === fullManifestChecksum : true;
  const recalculatedSnapshotChecksum = ledgerManifestChecksum(snapshot.payload, selection.tables);
  const currentChecksum = ledgerManifestChecksum(snapshotPayload(current), selection.tables);
  const tableDiffs = selection.tables.map((table) => tableDiffFor(snapshot.payload, snapshotPayload(current), table));
  const changedCount = tableDiffs.filter((row) => row.diffStatus !== 'MATCH').length;
  const restoreOrder = buildLedgerRestoreOrder(selection.tables);
  const warnings = [
    ...selection.warnings,
    ...(!snapshotChecksumValid ? ['스냅샷 manifest checksum이 전체 row JSON 재계산값과 다릅니다.'] : []),
    ...(restoreOrder.cycleDetected ? ['FK 의존성 그래프에 순환이 감지되어 자동 물리 복원 전 별도 검토가 필요합니다.'] : []),
    ...restoreOrder.missingDependencies.map((entry) => `${entry.tableName} 복원 시 부모 테이블 ${entry.missing.join(', ')}이(가) 선택되지 않았습니다.`),
    ...(changedCount ? [`현재 원장과 스냅샷 사이에 ${changedCount}개 테이블 차이가 있습니다.`] : ['현재 원장과 선택 스냅샷이 이미 일치합니다.']),
  ];
  const blocked = Boolean(selection.blocked || !snapshotChecksumValid || restoreOrder.cycleDetected);
  const deletedRowCount = tableDiffs.reduce((sum, row) => sum + row.currentRowCount, 0);
  const insertedRowCount = tableDiffs.reduce((sum, row) => sum + row.snapshotRowCount, 0);
  return {
    restoreMode: mode,
    restoreModeLabel: modeLabel,
    dryRunStatus: blocked ? 'BLOCKED' : 'READY',
    restorable: !blocked,
    physicalRestore: mode !== 'CORE_STATE',
    beforeDiffStatus: changedCount ? 'DIFF' : 'MATCH',
    afterDiffStatus: changedCount ? 'PENDING_RESTORE' : 'MATCH',
    message: blocked
      ? selection.message || '복원 검증에 실패했습니다.'
      : `${modeLabel} dry-run 준비 완료. 삭제 ${deletedRowCount} rows / 삽입 ${insertedRowCount} rows 예정.`,
    warnings,
    targetTables: selection.tables.map((table) => ({
      tableName: table.tableName,
      label: table.label,
      snapshotRowCount: tableRows(snapshot.payload, table).length,
      currentRowCount: tableRows(snapshotPayload(current), table).length,
    })),
    deleteOrder: restoreOrder.deleteOrder,
    insertOrder: restoreOrder.insertOrder,
    cycleDetected: restoreOrder.cycleDetected,
    missingDependencies: restoreOrder.missingDependencies,
    tableDiffs,
    deletedRowCount,
    insertedRowCount,
    snapshotChecksum,
    recalculatedSnapshotChecksum,
    currentChecksum,
  };
}

export function createProgressExportAction(state) {
  const current = normalizeState(state);
  const summary = reportSummary(current);
  const management = managementReport(current);
  const diffRows = ledgerDiffRows(current);
  const content = [
    `Company Report Export / ${current.company.name}`,
    `Period: ${current.company.year}-${String(current.company.month).padStart(2, '0')}`,
    `Score: ${scoreState(current)}`,
    `Cash: ${formatMoney(current.company.cashKrw)}`,
    `Assets: ${formatMoney(summary.assets)}`,
    `Receivables: ${formatMoney(summary.receivableAmount)}`,
    `Foreign Receivables: ${formatMoney(summary.foreignReceivableAmount)}`,
    `Sales: ${formatMoney(management.income.sales)}`,
    `Operating Profit: ${formatMoney(management.income.operatingProfit)}`,
    `Global Export Sales: ${formatMoney(management.global.exportSalesKrw)}`,
    `Market Cap: ${formatMoney(management.capital.marketCapKrw)}`,
    `Investor Trust: ${management.capital.investorTrust}`,
    `Snapshots: ${current.ledgerSnapshots.length}`,
    diffRows.length ? 'Ledger Diff:' : 'Ledger Diff: no snapshot',
    ...diffRows.map((row) => `- ${row.label}: ${row.before} -> ${row.after} (${row.deltaText})`),
  ].join('\n');
  const exportItem = {
    id: `EXP-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    exportType: 'MANAGEMENT_REPORT',
    itemCount: 12 + diffRows.length,
    exportNote: `${current.company.year}-${String(current.company.month).padStart(2, '0')} 진행 보고서`,
    checksum: simpleChecksum(content),
    content,
  };
  return addLog({
    ...current,
    exportHistory: [exportItem, ...current.exportHistory].slice(0, 12),
  }, `진행 보고서를 내보냈습니다. checksum ${exportItem.checksum}.`);
}

export function inventoryRows(state) {
  const current = normalizeState(state);
  return PRODUCTS.map((product) => {
    const stock = current.inventory[product.id] || { onHand: 0, reserved: 0, avgCost: product.unitCost };
    return {
      ...product,
      ...stock,
      amount: Number(stock.onHand || 0) * Number(stock.avgCost || product.unitCost || 0),
    };
  });
}

export function inventoryValuationRows(state) {
  return normalizeState(state).inventoryValuations
    .map((row) => ({
      ...row,
      productName: row.productName || getProduct(row.productId)?.name || row.productId,
    }))
    .sort((a, b) => b.year - a.year || b.month - a.month || String(a.productName).localeCompare(String(b.productName)));
}

export function inventoryWriteDownRows(state) {
  return normalizeState(state).inventoryWriteDowns
    .map((row) => ({
      ...row,
      productName: row.productName || getProduct(row.productId)?.name || row.productId,
    }))
    .sort((a, b) => b.year - a.year || b.month - a.month || String(a.productName).localeCompare(String(b.productName)));
}

export function vatPaymentRows(state) {
  return normalizeState(state).vatPayments
    .slice()
    .sort((a, b) => b.targetYear - a.targetYear || b.targetMonth - a.targetMonth || String(b.id).localeCompare(String(a.id)));
}

export function vatScheduleRows(state, year = null) {
  const current = normalizeState(state);
  const targetYear = Number(year || current.company.year || 2026);
  const orders = orderRows(current).filter((order) => order.year === targetYear && (order.status === 'SHIPPED' || order.status === 'COMPLETED'));
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const invoiceVatAmount = orders
      .filter((order) => Number(order.month || 0) === month)
      .reduce((sum, order) => sum + Number(order.vatAmount || 0), 0);
    const paidAmount = current.vatPayments
      .filter((payment) => Number(payment.targetYear || 0) === targetYear && Number(payment.targetMonth || 0) === month)
      .reduce((sum, payment) => sum + Number(payment.paymentAmount || 0), 0);
    const remainingAmount = Math.max(0, invoiceVatAmount - paidAmount);
    const due = advanceMonth(targetYear, month);
    const overdue = Number(current.company.year || 0) > due.year
      || (Number(current.company.year || 0) === due.year && Number(current.company.month || 0) > due.month);
    const status = invoiceVatAmount <= 0
      ? 'NO_TAX'
      : remainingAmount <= 0
        ? 'PAID'
        : overdue
          ? 'OVERDUE'
          : 'DUE';
    return {
      id: `${targetYear}-${String(month).padStart(2, '0')}`,
      targetYear,
      targetMonth: month,
      dueDate: `${due.year}-${String(due.month).padStart(2, '0')}-25`,
      invoiceVatAmount,
      paidAmount,
      remainingAmount,
      status,
      note: status === 'NO_TAX' ? '발급된 세금계산서 부가세가 없습니다.' : status === 'PAID' ? '납부 완료' : status === 'OVERDUE' ? '납부 예정일 경과' : '납부 예정',
    };
  });
}

export function orderRows(state) {
  const current = normalizeState(state);
  return current.orders.map((order) => {
    const product = getProduct(order.productId);
    const partner = getPartner(order.partnerId);
    const amount = Number(order.unitPrice || 0) * Number(order.quantity || 0);
    return {
      ...order,
      productName: product?.name || order.productId,
      partnerName: partner?.name || order.partnerId,
      amount,
      vatAmount: Math.round(amount * 0.1),
      totalAmount: Math.round(amount * 1.1),
    };
  });
}

export function receivableRows(state) {
  const current = normalizeState(state);
  return current.receivables.map((ar) => ({
    ...ar,
    partnerName: getPartner(ar.partnerId)?.name || ar.partnerId,
    remaining: Math.max(0, Number(ar.amount || 0) - Number(ar.collected || 0)),
  }));
}

export function globalMarketRows() {
  return GLOBAL_MARKETS.map((market) => ({
    ...market,
    exchangeRateLabel: `${market.currency} ${market.exchangeRateKrw.toLocaleString('ko-KR')}원`,
    demandLabel: `${market.demand}/100`,
    tariffLabel: `${market.tariffRate}%`,
  }));
}

export function globalReceivableRows(state) {
  const current = normalizeState(state);
  return current.global.foreignReceivables.map((row) => ({
    ...row,
    marketName: getMarket(row.marketId)?.name || row.marketId,
    productName: getProduct(row.productId)?.name || row.productId,
    remainingKrw: Math.max(0, Number(row.amountKrw || 0) - Number(row.collectedKrw || 0)),
  }));
}

export function globalTradeSummary(state) {
  const current = normalizeState(state);
  const exportSalesKrw = current.global.exportResults.reduce((sum, row) => sum + Number(row.salesKrw || 0), 0);
  const exportCostKrw = current.global.exportResults.reduce((sum, row) => sum + Number(row.exportCostKrw || 0), 0);
  const importLandedCostKrw = current.global.importResults.reduce((sum, row) => sum + Number(row.landedCostKrw || 0), 0);
  const openForeignReceivableKrw = globalReceivableRows(current).reduce((sum, row) => sum + Number(row.remainingKrw || 0), 0);
  const hedgeNotionalKrw = current.global.hedgeContracts
    .filter((hedge) => hedge.status === 'ACTIVE')
    .reduce((sum, hedge) => sum + Number(hedge.notionalKrw || 0), 0);
  return {
    activeExports: current.global.exportPlans.filter((plan) => plan.status === 'ACTIVE').length,
    activeImports: current.global.importPlans.filter((plan) => plan.status === 'ACTIVE').length,
    completedExports: current.global.exportResults.length,
    completedImports: current.global.importResults.length,
    exportSalesKrw,
    exportCostKrw,
    exportProfitKrw: exportSalesKrw - exportCostKrw,
    importLandedCostKrw,
    openForeignReceivableKrw,
    collectedForeignReceivableKrw: current.global.foreignReceivables.reduce((sum, row) => sum + Number(row.collectedKrw || 0), 0),
    hedgeNotionalKrw,
    hedgeCount: current.global.hedgeContracts.length,
  };
}

export function capitalMarketSummary(state) {
  const current = normalizeState(state);
  const marketCapKrw = Number(current.capitalMarket.sharePrice || 0) * Number(current.capitalMarket.sharesOutstanding || 0);
  const latestStock = current.capitalMarket.stockHistory[0] || null;
  const previousStock = current.capitalMarket.stockHistory[1] || null;
  const priceDelta = latestStock && previousStock ? Number(latestStock.sharePrice || 0) - Number(previousStock.sharePrice || 0) : 0;
  const alerts = [];
  if (Number(current.capitalMarket.disclosureRisk || 0) >= 35) alerts.push('공시위험이 높습니다. 감사 대응이나 정정 공시가 필요합니다.');
  if (Number(current.capitalMarket.investorTrust || 0) < 45) alerts.push('투자자 신뢰가 낮습니다. 실적 발표 또는 배당 정책을 검토하세요.');
  if (Number(current.capitalMarket.debtKrw || 0) > marketCapKrw * 0.3) alerts.push('상장 부채 비중이 커졌습니다. 추가 차입은 보수적으로 봐야 합니다.');
  if (!alerts.length) alerts.push('상장 상태가 안정권입니다. 글로벌 매출 확대와 정기 공시를 유지하세요.');
  return {
    marketCapKrw,
    sharePrice: Number(current.capitalMarket.sharePrice || 0),
    sharesOutstanding: Number(current.capitalMarket.sharesOutstanding || 0),
    investorTrust: Number(current.capitalMarket.investorTrust || 0),
    disclosureRisk: Number(current.capitalMarket.disclosureRisk || 0),
    debtKrw: Number(current.capitalMarket.debtKrw || 0),
    priceDelta,
    disclosureCount: current.capitalMarket.disclosures.length,
    dividendCount: current.capitalMarket.dividends.length,
    financingCount: current.capitalMarket.financingPlans.length,
    stockHistoryCount: current.capitalMarket.stockHistory.length,
    alerts,
  };
}

export function reportSummary(state) {
  const current = normalizeState(state);
  const inventoryAmount = inventoryRows(current).reduce((sum, row) => sum + row.amount, 0);
  const receivableAmount = receivableRows(current).reduce((sum, row) => sum + row.remaining, 0);
  const global = globalTradeSummary(current);
  const capital = capitalMarketSummary(current);
  const latestSettlement = current.settlements[0] || null;
  const vatPayableAmount = vatScheduleRows(current, current.company.year).reduce((sum, row) => sum + Number(row.remainingAmount || 0), 0);
  const inventoryWriteDownBalance = current.inventoryWriteDowns.reduce((sum, row) => sum + Number(row.writeDownAmount || 0) - Number(row.reversalAmount || 0), 0);
  const assets = Number(current.company.cashKrw || 0) + inventoryAmount + receivableAmount + global.openForeignReceivableKrw;
  const liabilities = Math.max(0, receivableAmount * 0.08 + vatPayableAmount + (latestSettlement?.tax || 0) + capital.debtKrw);
  const equity = assets - liabilities;
  const sales = (latestSettlement?.totalSales || orderRows(current).filter((order) => order.status === 'SHIPPED' || order.status === 'COMPLETED').reduce((sum, order) => sum + order.amount, 0)) + global.exportSalesKrw;
  return {
    assets,
    liabilities,
    equity,
    inventoryAmount,
    vatPayableAmount,
    inventoryWriteDownBalance,
    receivableAmount,
    foreignReceivableAmount: global.openForeignReceivableKrw,
    latestSettlement,
    sales,
    openReceivables: receivableRows(current).filter((row) => row.remaining > 0).length,
    shippedOrders: orderRows(current).filter((row) => row.status === 'SHIPPED' || row.status === 'COMPLETED').length,
  };
}

function topRowsFromMap(map, formatter = (value) => value) {
  return [...map.entries()]
    .map(([label, value]) => ({ label, value, formatted: formatter(value) }))
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
}

export function managementReport(state) {
  const current = normalizeState(state);
  const summary = reportSummary(current);
  const global = globalTradeSummary(current);
  const capital = capitalMarketSummary(current);
  const orders = orderRows(current);
  const receivables = receivableRows(current);
  const shipped = orders.filter((order) => order.status === 'SHIPPED' || order.status === 'COMPLETED');
  const categorySales = new Map();
  const characterSales = new Map();
  const productSales = new Map();
  const localCogs = shipped.reduce((sum, order) => {
    const product = getProduct(order.productId);
    const shippedQty = Number(order.shippedQty || order.quantity || 0);
    const salesAmount = Number(order.unitPrice || 0) * shippedQty;
    categorySales.set(product?.category || 'UNKNOWN', (categorySales.get(product?.category || 'UNKNOWN') || 0) + salesAmount);
    characterSales.set(product?.character || 'UNKNOWN', (characterSales.get(product?.character || 'UNKNOWN') || 0) + salesAmount);
    productSales.set(product?.name || order.productName || order.productId, (productSales.get(product?.name || order.productName || order.productId) || 0) + salesAmount);
    return sum + Number(order.unitCost || 0) * shippedQty;
  }, 0);
  const cogs = localCogs + global.exportCostKrw;
  const fixedExpenses = FIXED_EXPENSES.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const grossProfit = summary.sales - cogs;
  const operatingProfit = summary.latestSettlement?.operatingProfit ?? grossProfit - fixedExpenses;
  const collectedCash = receivables.reduce((sum, row) => sum + Number(row.collected || 0), 0);
  const overdueAmount = receivables.filter((row) => row.status === 'OVERDUE').reduce((sum, row) => sum + Number(row.remaining || 0), 0);
  const inventoryTurnoverBase = Math.max(1, cogs);
  const inventoryMonths = Number(((summary.inventoryAmount / inventoryTurnoverBase) || 0).toFixed(2));
  const cashRunwayMonths = Number((Number(current.company.cashKrw || 0) / Math.max(1, fixedExpenses)).toFixed(2));
  const receivableRatio = summary.assets ? Number(((summary.receivableAmount / summary.assets) * 100).toFixed(1)) : 0;
  const currentVatRows = vatScheduleRows(current, current.company.year);
  const overdueVatAmount = currentVatRows.filter((row) => row.status === 'OVERDUE').reduce((sum, row) => sum + Number(row.remainingAmount || 0), 0);
  const currentInventoryWriteDownNet = current.inventoryWriteDowns
    .filter((row) => Number(row.year || 0) === Number(current.company.year || 0))
    .reduce((sum, row) => sum + Number(row.netEffectAmount || 0), 0);
  const recommendations = [];

  if (operatingProfit < 0) recommendations.push('영업손실 상태입니다. 고정비 또는 저마진 상품 비중을 먼저 점검하세요.');
  if (receivableRatio >= 25) recommendations.push('매출채권 비중이 높습니다. 월말 결산 전에 회수 액션을 우선 처리하는 편이 좋습니다.');
  if (overdueAmount > 0) recommendations.push('연체 채권이 있습니다. 신용한도와 신규 주문 승인 기준을 보수적으로 두세요.');
  if (inventoryMonths >= 2) recommendations.push('재고 회전이 느립니다. 캠페인이나 출고 주문으로 재고를 줄일 필요가 있습니다.');
  if (summary.vatPayableAmount > 0) recommendations.push('부가세 미납 잔액이 있습니다. 결산 전 VAT 예정표를 확인하고 납부를 반영하세요.');
  if (overdueVatAmount > 0) recommendations.push('기한이 지난 부가세가 있습니다. 현금 유출 계획을 조정하세요.');
  if (currentInventoryWriteDownNet > 0) recommendations.push('재고 손상 순액이 누적되고 있습니다. 저회전 상품 입고와 캠페인을 재점검하세요.');
  if (cashRunwayMonths < 6) recommendations.push('현금 런웨이가 짧습니다. 생산 입고보다 채권 회수와 흑자 주문을 우선하세요.');
  if (!current.ledgerSnapshots.length) recommendations.push('장부 스냅샷이 없습니다. 주요 액션 전후로 스냅샷을 남기면 복원 실험이 가능합니다.');
  if (global.activeExports || global.activeImports) recommendations.push('활성 수출입 계획이 있습니다. 글로벌 정산으로 해외 매출과 수입 재고를 원장에 반영하세요.');
  if (global.openForeignReceivableKrw > summary.assets * 0.18) recommendations.push('외화채권 비중이 큽니다. 환헤지 또는 외화채권 회수를 먼저 처리하는 편이 좋습니다.');
  if (capital.disclosureRisk >= 35) recommendations.push('공시위험이 높습니다. 자본시장 월마감 전 공시 대응을 실행하세요.');
  if (!recommendations.length) recommendations.push('재무 구조가 안정권입니다. 주문 확대나 캠페인 테스트를 진행해도 됩니다.');

  return {
    income: {
      sales: summary.sales,
      cogs,
      grossProfit,
      grossMarginPct: summary.sales ? Number(((grossProfit / summary.sales) * 100).toFixed(1)) : 0,
      fixedExpenses,
      operatingProfit,
    },
    cashFlow: {
      cash: Number(current.company.cashKrw || 0),
      collectedCash,
      receivableAmount: summary.receivableAmount,
      overdueAmount,
      cashRunwayMonths,
    },
    balance: {
      assets: summary.assets,
      liabilities: summary.liabilities,
      equity: summary.equity,
      inventoryAmount: summary.inventoryAmount,
      inventoryMonths,
      receivableRatio,
      vatPayableAmount: summary.vatPayableAmount,
      inventoryWriteDownBalance: summary.inventoryWriteDownBalance,
      currentInventoryWriteDownNet,
    },
    productRows: topRowsFromMap(productSales, formatMoney).slice(0, 5),
    categoryRows: topRowsFromMap(categorySales, formatMoney),
    characterRows: topRowsFromMap(characterSales, formatMoney).slice(0, 5),
    riskRows: [
      { label: '현금 런웨이', value: `${cashRunwayMonths}개월` },
      { label: '매출채권 비중', value: `${receivableRatio}%` },
      { label: '연체 채권', value: formatMoney(overdueAmount) },
      { label: '재고 회전 월수', value: `${inventoryMonths}개월` },
      { label: 'VAT 미납', value: formatMoney(summary.vatPayableAmount) },
      { label: '재고 손상잔액', value: formatMoney(summary.inventoryWriteDownBalance) },
      { label: '외화채권', value: formatMoney(global.openForeignReceivableKrw) },
      { label: '공시위험', value: `${capital.disclosureRisk}/100` },
      { label: '장부 스냅샷', value: `${current.ledgerSnapshots.length}개` },
    ],
    global,
    capital,
    recommendations,
  };
}

export function reportHistoryTrend(state) {
  const current = normalizeState(state);
  const management = managementReport(current);
  const liveSummary = reportSummary(current);
  const settlementRows = [...current.settlements]
    .sort((a, b) => Number(a.year || 0) - Number(b.year || 0) || Number(a.month || 0) - Number(b.month || 0))
    .map((settlement) => ({
      id: `${settlement.year}-${String(settlement.month).padStart(2, '0')}`,
      year: Number(settlement.year || 0),
      month: Number(settlement.month || 0),
      period: `${settlement.year}-${String(settlement.month).padStart(2, '0')}`,
      sales: Number(settlement.totalSales || 0),
      cost: Number(settlement.totalCost || 0),
      operatingProfit: Number(settlement.operatingProfit || 0),
      netProfit: Number(settlement.netProfit || 0),
      netCashflow: Number(settlement.netCashflow || 0),
      source: 'settlement',
    }));
  const latestSettlement = settlementRows[settlementRows.length - 1] || null;
  const livePeriod = `${current.company.year}-${String(current.company.month).padStart(2, '0')}`;
  const liveRow = {
    id: `live-${livePeriod}`,
    year: Number(current.company.year || 0),
    month: Number(current.company.month || 0),
    period: livePeriod,
    sales: Number(management.income.sales || 0),
    cost: Number(management.income.cogs || 0),
    operatingProfit: Number(management.income.operatingProfit || 0),
    netProfit: Number(liveSummary.latestSettlement?.netProfit ?? management.income.operatingProfit ?? 0),
    netCashflow: Number(current.company.cashKrw || 0),
    source: 'live',
  };
  const hasLiveSettlement = latestSettlement
    && latestSettlement.year === liveRow.year
    && latestSettlement.month === liveRow.month;
  const baseRows = hasLiveSettlement ? settlementRows : [...settlementRows, liveRow];
  const rows = baseRows.map((row, index) => {
    const previous = baseRows[index - 1] || null;
    const salesDelta = previous ? row.sales - previous.sales : 0;
    const profitDelta = previous ? row.operatingProfit - previous.operatingProfit : 0;
    const cashflowDelta = previous ? row.netCashflow - previous.netCashflow : 0;
    return {
      ...row,
      salesDelta,
      profitDelta,
      cashflowDelta,
      marginPct: row.sales ? Number(((row.operatingProfit / row.sales) * 100).toFixed(1)) : 0,
      trend: profitDelta > 0 ? '개선' : profitDelta < 0 ? '악화' : '유지',
    };
  });
  const latest = rows[rows.length - 1] || liveRow;
  const previous = rows[rows.length - 2] || null;
  const snapshotRows = current.ledgerSnapshots.slice(0, 6).map((snapshot) => ({
    id: snapshot.id,
    label: snapshot.label,
    createdAt: snapshot.createdAt,
    rowCount: snapshot.rowCount,
    checksum: snapshot.checksum,
  }));
  const bookmarkRows = current.reportBookmarks.slice(0, 6).map((bookmark) => ({
    id: bookmark.id,
    label: bookmark.label,
    note: bookmark.note,
    score: Number(bookmark.score || 0),
    assets: Number(bookmark.assets || 0),
    receivableAmount: Number(bookmark.receivableAmount || 0),
    favorite: Boolean(bookmark.favorite),
  }));
  const exportRows = current.exportHistory.slice(0, 6).map((item) => ({
    id: item.id,
    exportType: item.exportType,
    exportNote: item.exportNote,
    checksum: item.checksum,
    itemCount: item.itemCount,
  }));
  const positiveProfitMonths = rows.filter((row) => row.operatingProfit >= 0).length;
  const archiveScore = Math.max(0, Math.min(100, Math.round(
    rows.length * 12
    + current.reportBookmarks.length * 6
    + current.exportHistory.length * 5
    + current.ledgerSnapshots.length * 5
    + positiveProfitMonths * 4
    + (latest?.operatingProfit > 0 ? 8 : 0)
  )));
  const recommendations = [];
  if (rows.length < 3) recommendations.push('월말 결산을 3개월 이상 쌓으면 매출/이익 추세 판단이 훨씬 안정됩니다.');
  if (!current.reportBookmarks.length) recommendations.push('중요한 결산 시점은 리포트 북마크로 남겨 두면 장기 비교가 쉬워집니다.');
  if (!current.exportHistory.length) recommendations.push('진행 보고서 내보내기를 실행하면 저장형 리포트 이력이 누적됩니다.');
  if (!current.ledgerSnapshots.length) recommendations.push('스냅샷이 없으면 복원 비교 기준이 약합니다. 큰 액션 전후로 스냅샷을 남기세요.');
  if (previous && latest.operatingProfit < previous.operatingProfit) recommendations.push('최근 영업이익이 전월보다 악화되었습니다. 고정비와 미수 채권 회수를 먼저 점검하세요.');
  if (!recommendations.length) recommendations.push('리포트 이력은 안정적으로 쌓이고 있습니다. 다음 결산 전 글로벌/자본시장 이벤트를 추가해 장기 변동성을 확인하세요.');
  return {
    rows: rows.slice(-8).reverse(),
    latest,
    previous,
    archiveScore,
    positiveProfitMonths,
    snapshotRows,
    bookmarkRows,
    exportRows,
    recommendations,
  };
}

export function scoreState(state) {
  const current = normalizeState(state);
  const report = reportSummary(current);
  const management = managementReport(current);
  const latest = report.latestSettlement;
  return Math.max(0, Math.round(
    Number(current.company.cashKrw || 0) / 1000000
    + Number(current.company.reputation || 0) * 18
    + Number(current.company.fanBase || 0) / 300
    + management.global.exportProfitKrw / 350000
    + management.capital.investorTrust * 12
    + report.shippedOrders * 120
    + (latest ? Number(latest.netProfit || 0) / 250000 : 0)
    - report.openReceivables * 80
    - Number(report.vatPayableAmount || 0) / 900000
    - Number(report.inventoryWriteDownBalance || 0) / 500000
    - management.capital.disclosureRisk * 15
  ));
}

export function getPlayTimeSec(state) {
  const start = new Date(state.startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function summaryForState(state) {
  const current = normalizeState(state);
  const report = reportSummary(current);
  const trend = reportHistoryTrend(current);
  return {
    year: current.company.year,
    month: current.company.month,
    cashKrw: current.company.cashKrw,
    assets: report.assets,
    receivables: report.receivableAmount,
    foreignReceivables: report.foreignReceivableAmount,
    inventory: report.inventoryAmount,
    vatPayable: report.vatPayableAmount,
    inventoryWriteDownBalance: report.inventoryWriteDownBalance,
    vatPayments: current.vatPayments.length,
    inventoryValuations: current.inventoryValuations.length,
    snapshots: current.ledgerSnapshots.length,
    bookmarks: current.reportBookmarks.length,
    exports: current.exportHistory.length,
    reportArchiveScore: trend.archiveScore,
    reportPeriods: trend.rows.length,
    globalExports: current.global.exportResults.length,
    globalImports: current.global.importResults.length,
    investorTrust: current.capitalMarket.investorTrust,
    disclosureRisk: current.capitalMarket.disclosureRisk,
    score: scoreState(current),
  };
}

export function formatMoney(value) {
  return `${Math.round(Number(value || 0)).toLocaleString('ko-KR')}원`;
}

function createOrderSeed(id, partnerId, productId, quantity, status, shippedQty) {
  const product = getProduct(productId);
  return {
    id: `SO-2026-${String(id).padStart(4, '0')}`,
    no: `SO-2026-${String(id).padStart(4, '0')}`,
    partnerId,
    productId,
    quantity,
    shippedQty,
    unitPrice: product?.unitPrice || 0,
    unitCost: product?.unitCost || 0,
    status,
    year: 2026,
    month: 2,
  };
}

function createReceivableSeed(id, partnerId, amount, collected, status) {
  return {
    id: `AR-2026-${String(id).padStart(4, '0')}`,
    partnerId,
    orderId: `SO-2026-${String(id).padStart(4, '0')}`,
    amount,
    collected,
    status,
    year: 2026,
    month: 2,
  };
}

function getPartner(id) {
  return PARTNERS.find((partner) => partner.id === id) || null;
}

function getProduct(id) {
  return PRODUCTS.find((product) => product.id === id) || null;
}

function getMarket(id) {
  return GLOBAL_MARKETS.find((market) => market.id === id) || null;
}

function estimateInventoryNrvRate(row, state) {
  const product = getProduct(row.id || row.productId);
  const hype = Number(product?.hype || row.hype || 50);
  const onHand = Number(row.onHand || 0);
  const reserved = Number(row.reserved || 0);
  const turnoverPressure = onHand > Math.max(120, reserved * 4) ? 0.1 : onHand < reserved + 40 ? -0.04 : 0;
  const hypeDiscount = hype < 35 ? 0.12 : hype < 50 ? 0.06 : hype >= 70 ? -0.05 : 0;
  const reputationLift = Number(state.company?.reputation || 50) >= 68 ? -0.03 : 0;
  return Math.max(0.62, Math.min(1.08, 1 - turnoverPressure - hypeDiscount - reputationLift));
}

function priorInventoryWriteDownBalance(state, productId, year, month) {
  return normalizeState(state).inventoryWriteDowns
    .filter((row) => row.productId === productId)
    .filter((row) => Number(row.year || 0) < year || (Number(row.year || 0) === year && Number(row.month || 0) < month))
    .reduce((sum, row) => sum + Number(row.writeDownAmount || 0) - Number(row.reversalAmount || 0), 0);
}

function outstandingByPartner(state, partnerId) {
  return receivableRows(state)
    .filter((row) => row.partnerId === partnerId)
    .reduce((sum, row) => sum + row.remaining, 0);
}

function advanceMonth(year, month) {
  if (month >= 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

function snapshotPayload(state) {
  return {
    company: { ...state.company },
    inventory: JSON.parse(JSON.stringify(state.inventory)),
    orders: JSON.parse(JSON.stringify(state.orders)),
    receivables: JSON.parse(JSON.stringify(state.receivables)),
    vatPayments: JSON.parse(JSON.stringify(state.vatPayments || [])),
    inventoryValuations: JSON.parse(JSON.stringify(state.inventoryValuations || [])),
    inventoryWriteDowns: JSON.parse(JSON.stringify(state.inventoryWriteDowns || [])),
    settlements: JSON.parse(JSON.stringify(state.settlements)),
    global: JSON.parse(JSON.stringify(state.global)),
    capitalMarket: JSON.parse(JSON.stringify(state.capitalMarket)),
    nextOrderNo: state.nextOrderNo,
    nextReceivableNo: state.nextReceivableNo,
  };
}

function ledgerComparableSummary(payload) {
  const inventoryEntries = Object.values(payload.inventory || {});
  const receivableEntries = Object.values(payload.receivables || {});
  const orderEntries = Object.values(payload.orders || {});
  const vatPaymentEntries = Object.values(payload.vatPayments || {});
  const inventoryWriteDownEntries = Object.values(payload.inventoryWriteDowns || {});
  const company = payload.company || {};
  const global = normalizeGlobalState(payload.global, createNewState().global);
  const capitalMarket = normalizeCapitalMarketState(payload.capitalMarket, createNewState().capitalMarket);
  const foreignReceivableAmount = global.foreignReceivables.reduce((sum, row) => sum + Math.max(0, Number(row.amountKrw || 0) - Number(row.collectedKrw || 0)), 0);
  const marketCapKrw = Number(capitalMarket.sharePrice || 0) * Number(capitalMarket.sharesOutstanding || 0);
  return {
    period: `${company.year || '-'}-${String(company.month || 0).padStart(2, '0')}`,
    cashKrw: Number(company.cashKrw || 0),
    inventoryAmount: inventoryEntries.reduce((sum, row) => sum + Number(row.onHand || 0) * Number(row.avgCost || 0), 0),
    receivableAmount: receivableEntries.reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0) - Number(row.collected || 0)), 0),
    foreignReceivableAmount,
    marketCapKrw,
    orderCount: orderEntries.length,
    shippedOrders: orderEntries.filter((row) => row.status === 'SHIPPED' || row.status === 'COMPLETED').length,
    openReceivables: receivableEntries.filter((row) => Math.max(0, Number(row.amount || 0) - Number(row.collected || 0)) > 0).length,
    exportResultCount: global.exportResults.length,
    importResultCount: global.importResults.length,
    settlementCount: Array.isArray(payload.settlements) ? payload.settlements.length : 0,
    vatPaymentCount: vatPaymentEntries.length,
    inventoryWriteDownAmount: inventoryWriteDownEntries.reduce((sum, row) => sum + Number(row.netEffectAmount || 0), 0),
    reputation: Number(company.reputation || 0),
    fanBase: Number(company.fanBase || 0),
    investorTrust: Number(capitalMarket.investorTrust || 0),
    disclosureRisk: Number(capitalMarket.disclosureRisk || 0),
  };
}

function resolveRestoreTables(restoreMode, tablesText = '') {
  if (restoreMode !== 'SELECTED_TABLES') return { tables: LEDGER_RESTORE_TABLES, warnings: [], blocked: false, message: '' };
  const requested = String(tablesText || '')
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (!requested.length) {
    return {
      tables: [],
      warnings: ['선택 테이블 복원은 최소 1개 이상의 테이블명을 입력해야 합니다.'],
      blocked: true,
      message: '선택된 복원 테이블이 없습니다.',
    };
  }
  const tableByName = new Map(LEDGER_RESTORE_TABLES.map((table) => [table.tableName, table]));
  const missing = requested.filter((name) => !tableByName.has(name));
  const tables = requested.map((name) => tableByName.get(name)).filter(Boolean);
  return {
    tables,
    warnings: missing.length ? [`스냅샷 복원 대상이 아닌 테이블: ${missing.join(', ')}`] : [],
    blocked: Boolean(missing.length),
    message: missing.length ? '지원하지 않는 테이블이 포함되어 있습니다.' : '',
  };
}

function buildLedgerRestoreOrder(tables) {
  const selectedNames = tables.map((table) => table.tableName);
  const selected = new Set(selectedNames);
  const availableTables = new Set(LEDGER_RESTORE_TABLES.map((table) => table.tableName));
  const parentDependencies = new Map();
  const missingDependencies = [];

  selectedNames.forEach((tableName) => {
    const parents = (LEDGER_TABLE_PARENT_DEPENDENCIES[tableName] || []).filter((parent) => availableTables.has(parent));
    const selectedParents = parents.filter((parent) => selected.has(parent));
    const missing = parents.filter((parent) => !selected.has(parent));
    parentDependencies.set(tableName, selectedParents);
    if (missing.length) missingDependencies.push({ tableName, missing });
  });

  const insertOrder = [];
  const visiting = new Set();
  const visited = new Set();
  let cycleDetected = false;

  const visit = (tableName) => {
    if (visited.has(tableName)) return;
    if (visiting.has(tableName)) {
      cycleDetected = true;
      return;
    }
    visiting.add(tableName);
    (parentDependencies.get(tableName) || []).forEach(visit);
    visiting.delete(tableName);
    visited.add(tableName);
    if (!insertOrder.includes(tableName)) insertOrder.push(tableName);
  };

  selectedNames.forEach(visit);

  const stableInsertOrder = cycleDetected ? selectedNames : insertOrder;
  return {
    insertOrder: stableInsertOrder,
    deleteOrder: [...stableInsertOrder].reverse(),
    cycleDetected,
    missingDependencies,
  };
}

function getPathValue(source, path) {
  return String(path || '').split('.').reduce((current, key) => (current == null ? undefined : current[key]), source);
}

function setPathValue(source, path, value) {
  const keys = String(path || '').split('.').filter(Boolean);
  if (!keys.length) return source;
  const next = { ...source };
  let cursor = next;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }
    cursor[key] = { ...(cursor[key] || {}) };
    cursor = cursor[key];
  });
  return next;
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function tableRows(payload, table) {
  const value = getPathValue(payload, table.key);
  if (table.kind === 'object') return value && typeof value === 'object' ? [{ _pk: table.tableName, ...value }] : [];
  if (table.kind === 'objectMap') {
    return Object.entries(value || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, row]) => ({ _pk: key, ...(row || {}) }));
  }
  if (Array.isArray(value)) return value.map((row, index) => ({ _pk: row?.id || row?.no || row?.yearMonth || String(index), ...(row || {}) }));
  return [];
}

function rowKey(row) {
  return String(row?._pk || row?.id || row?.no || JSON.stringify(row));
}

function rowChecksum(row) {
  return simpleChecksum(JSON.stringify(row));
}

function tableChecksum(payload, table) {
  const rows = tableRows(payload, table);
  return simpleChecksum(rows.map((row) => `${rowKey(row)}:${rowChecksum(row)}`).join('\n'));
}

function ledgerManifestChecksum(payload, tables = LEDGER_RESTORE_TABLES) {
  return simpleChecksum(tables.map((table) => `${table.tableName}:${tableRows(payload, table).length}:${tableChecksum(payload, table)}`).join('\n'));
}

function tableDiffFor(snapshotPayloadValue, currentPayloadValue, table) {
  const snapshotRows = tableRows(snapshotPayloadValue, table);
  const currentRows = tableRows(currentPayloadValue, table);
  const currentByKey = new Map(currentRows.map((row) => [rowKey(row), rowChecksum(row)]));
  const snapshotByKey = new Map(snapshotRows.map((row) => [rowKey(row), rowChecksum(row)]));
  let missingInCurrentCount = 0;
  let changedRowCount = 0;
  snapshotByKey.forEach((checksum, key) => {
    if (!currentByKey.has(key)) {
      missingInCurrentCount += 1;
      return;
    }
    if (currentByKey.get(key) !== checksum) changedRowCount += 1;
  });
  let extraInCurrentCount = 0;
  currentByKey.forEach((_, key) => {
    if (!snapshotByKey.has(key)) extraInCurrentCount += 1;
  });
  const diffStatus = missingInCurrentCount || extraInCurrentCount || changedRowCount ? 'DIFF' : 'MATCH';
  return {
    tableName: table.tableName,
    label: table.label,
    snapshotRowCount: snapshotRows.length,
    currentRowCount: currentRows.length,
    missingInCurrentCount,
    extraInCurrentCount,
    changedRowCount,
    snapshotChecksum: tableChecksum(snapshotPayloadValue, table),
    currentChecksum: tableChecksum(currentPayloadValue, table),
    diffStatus,
  };
}

function ledgerRowCount(state) {
  return currentArrayCount(state.orders)
    + currentArrayCount(state.receivables)
    + currentArrayCount(state.vatPayments)
    + currentArrayCount(state.inventoryValuations)
    + currentArrayCount(state.inventoryWriteDowns)
    + Object.keys(state.inventory || {}).length
    + currentArrayCount(state.settlements)
    + currentArrayCount(state.global?.exportPlans)
    + currentArrayCount(state.global?.importPlans)
    + currentArrayCount(state.global?.exportResults)
    + currentArrayCount(state.global?.importResults)
    + currentArrayCount(state.global?.foreignReceivables)
    + currentArrayCount(state.global?.hedgeContracts)
    + currentArrayCount(state.capitalMarket?.disclosures)
    + currentArrayCount(state.capitalMarket?.dividends)
    + currentArrayCount(state.capitalMarket?.financingPlans)
    + currentArrayCount(state.capitalMarket?.stockHistory)
    + 1;
}

function currentArrayCount(value) {
  return Array.isArray(value) ? value.length : 0;
}

function normalizeGlobalState(value, fallback) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ...fallback,
    ...source,
    exportPlans: Array.isArray(source.exportPlans) ? source.exportPlans.slice(0, 16) : fallback.exportPlans,
    importPlans: Array.isArray(source.importPlans) ? source.importPlans.slice(0, 16) : fallback.importPlans,
    exportResults: Array.isArray(source.exportResults) ? source.exportResults.slice(0, 18) : fallback.exportResults,
    importResults: Array.isArray(source.importResults) ? source.importResults.slice(0, 18) : fallback.importResults,
    foreignReceivables: Array.isArray(source.foreignReceivables) ? source.foreignReceivables.slice(0, 18) : fallback.foreignReceivables,
    hedgeContracts: Array.isArray(source.hedgeContracts) ? source.hedgeContracts.slice(0, 12) : fallback.hedgeContracts,
    exchangeRateLog: Array.isArray(source.exchangeRateLog) ? source.exchangeRateLog.slice(0, 24) : fallback.exchangeRateLog,
    nextExportNo: Number(source.nextExportNo || fallback.nextExportNo || 1),
    nextImportNo: Number(source.nextImportNo || fallback.nextImportNo || 1),
    nextForeignArNo: Number(source.nextForeignArNo || fallback.nextForeignArNo || 1),
    nextHedgeNo: Number(source.nextHedgeNo || fallback.nextHedgeNo || 1),
  };
}

function normalizeCapitalMarketState(value, fallback) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ...fallback,
    ...source,
    sharePrice: Math.max(1000, Math.round(Number(source.sharePrice || fallback.sharePrice || 1000))),
    sharesOutstanding: Math.max(1, Math.round(Number(source.sharesOutstanding || fallback.sharesOutstanding || 1))),
    investorTrust: clamp(source.investorTrust ?? fallback.investorTrust, 0, 100),
    disclosureRisk: clamp(source.disclosureRisk ?? fallback.disclosureRisk, 0, 100),
    debtKrw: Math.max(0, Math.round(Number(source.debtKrw || fallback.debtKrw || 0))),
    disclosures: Array.isArray(source.disclosures) ? source.disclosures.slice(0, 16) : fallback.disclosures,
    dividends: Array.isArray(source.dividends) ? source.dividends.slice(0, 12) : fallback.dividends,
    financingPlans: Array.isArray(source.financingPlans) ? source.financingPlans.slice(0, 12) : fallback.financingPlans,
    riskEvents: Array.isArray(source.riskEvents) ? source.riskEvents.slice(0, 12) : fallback.riskEvents,
    stockHistory: Array.isArray(source.stockHistory) ? source.stockHistory.slice(0, 18) : fallback.stockHistory,
    nextDisclosureNo: Number(source.nextDisclosureNo || fallback.nextDisclosureNo || 1),
    nextDividendNo: Number(source.nextDividendNo || fallback.nextDividendNo || 1),
    nextFinancingNo: Number(source.nextFinancingNo || fallback.nextFinancingNo || 1),
    nextRiskNo: Number(source.nextRiskNo || fallback.nextRiskNo || 1),
  };
}

function moneyDiffRow(label, before, after) {
  const delta = Number(after || 0) - Number(before || 0);
  return {
    label,
    before: formatMoney(before),
    after: formatMoney(after),
    deltaValue: delta,
    deltaText: `${delta >= 0 ? '+' : ''}${formatMoney(delta)}`,
  };
}

function numberDiffRow(label, before, after, suffix = '') {
  const delta = Number(after || 0) - Number(before || 0);
  const format = (value) => `${Math.round(Number(value || 0)).toLocaleString('ko-KR')}${suffix}`;
  return {
    label,
    before: format(before),
    after: format(after),
    deltaValue: delta,
    deltaText: `${delta >= 0 ? '+' : ''}${format(delta)}`,
  };
}

function textDiffRow(label, before, after) {
  return {
    label,
    before,
    after,
    deltaValue: before === after ? 0 : 1,
    deltaText: before === after ? '변동 없음' : '변경',
  };
}

function simpleChecksum(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function addLog(state, message) {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    log: [message, ...state.log].slice(0, 120),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(value || 0))));
}
