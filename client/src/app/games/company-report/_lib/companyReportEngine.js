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
  { id: 'book-akashi', name: '각시온 설정집 1권', category: 'BOOK', character: '각시온', unitPrice: 28000, unitCost: 9000, hype: 26 },
  { id: 'event-hwahwa', name: '화회원 전통문화 체험권', category: 'EVENT', character: '화회원', unitPrice: 45000, unitCost: 18000, hype: 34 },
  { id: 'goods-aero', name: '마스커드 에어로 아크릴 굿즈', category: 'GOODS', character: '에어로', unitPrice: 22000, unitCost: 7000, hype: 78 },
  { id: 'figure-hae', name: '사해린 프리미엄 피규어', category: 'FIGURE', character: '사해린', unitPrice: 98000, unitCost: 35000, hype: 65 },
  { id: 'video-borama', name: '보라매 프로모션 영상 패키지', category: 'VIDEO', character: '보라매', unitPrice: 38000, unitCost: 12000, hype: 44 },
  { id: 'goods-shiroko', name: '시로코 게스트 굿즈 세트', category: 'GOODS', character: '시로코', unitPrice: 26000, unitCost: 8500, hype: 42 },
  { id: 'video-furina', name: '푸리나 스페셜 영상 컬렉션', category: 'VIDEO', character: '푸리나', unitPrice: 52000, unitCost: 16000, hype: 70 },
];

const FIXED_EXPENSES = [
  { type: 'PAYROLL', label: '인건비', amount: 100800000 },
  { type: 'MARKETING', label: '기본 마케팅비', amount: 42000000 },
  { type: 'PRODUCTION', label: '생산 간접비', amount: 28000000 },
  { type: 'LICENSE', label: '외부 IP 라이선스', amount: 3600000 },
  { type: 'RENT', label: '운영 고정비', amount: 25000000 },
];

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
    reportBookmarks: [],
    exportHistory: [],
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
    settlements: Array.isArray(value.settlements) ? value.settlements : base.settlements,
    ledgerSnapshots: Array.isArray(value.ledgerSnapshots) ? value.ledgerSnapshots : [],
    reportBookmarks: Array.isArray(value.reportBookmarks) ? value.reportBookmarks.slice(0, 12) : [],
    exportHistory: Array.isArray(value.exportHistory) ? value.exportHistory.slice(0, 12) : [],
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

export function monthEndCloseAction(state) {
  const current = normalizeState(state);
  const year = Number(current.company.year || 2026);
  const month = Number(current.company.month || 1);
  const monthOrders = current.orders.filter((order) => order.year === year && order.month === month && (order.status === 'SHIPPED' || order.status === 'COMPLETED'));
  const sales = monthOrders.reduce((sum, order) => sum + order.unitPrice * Number(order.shippedQty || order.quantity || 0), 0);
  const cogs = monthOrders.reduce((sum, order) => sum + order.unitCost * Number(order.shippedQty || order.quantity || 0), 0);
  const expense = FIXED_EXPENSES.reduce((sum, item) => sum + item.amount, 0);
  const operatingProfit = sales - cogs - expense;
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
    rowCount: current.orders.length + current.receivables.length + Object.keys(current.inventory).length + current.settlements.length + 1,
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
  return addLog({
    ...current,
    ...snapshot.payload,
    ledgerSnapshots: current.ledgerSnapshots,
  }, `${snapshot.label} 기준으로 원장 상태를 복원했습니다.`);
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
    numberDiffRow('주문', before.orderCount, after.orderCount, '건'),
    numberDiffRow('출고 주문', before.shippedOrders, after.shippedOrders, '건'),
    numberDiffRow('미수 채권', before.openReceivables, after.openReceivables, '건'),
    numberDiffRow('결산', before.settlementCount, after.settlementCount, '건'),
    numberDiffRow('평판', before.reputation, after.reputation),
    numberDiffRow('팬덤', before.fanBase, after.fanBase, '명'),
  ];
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
    `Sales: ${formatMoney(management.income.sales)}`,
    `Operating Profit: ${formatMoney(management.income.operatingProfit)}`,
    `Snapshots: ${current.ledgerSnapshots.length}`,
    diffRows.length ? 'Ledger Diff:' : 'Ledger Diff: no snapshot',
    ...diffRows.map((row) => `- ${row.label}: ${row.before} -> ${row.after} (${row.deltaText})`),
  ].join('\n');
  const exportItem = {
    id: `EXP-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    exportType: 'MANAGEMENT_REPORT',
    itemCount: 8 + diffRows.length,
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

export function reportSummary(state) {
  const current = normalizeState(state);
  const inventoryAmount = inventoryRows(current).reduce((sum, row) => sum + row.amount, 0);
  const receivableAmount = receivableRows(current).reduce((sum, row) => sum + row.remaining, 0);
  const latestSettlement = current.settlements[0] || null;
  const assets = Number(current.company.cashKrw || 0) + inventoryAmount + receivableAmount;
  const liabilities = Math.max(0, receivableAmount * 0.08 + (latestSettlement?.tax || 0));
  const equity = assets - liabilities;
  const sales = latestSettlement?.totalSales || orderRows(current).filter((order) => order.status === 'SHIPPED' || order.status === 'COMPLETED').reduce((sum, order) => sum + order.amount, 0);
  return {
    assets,
    liabilities,
    equity,
    inventoryAmount,
    receivableAmount,
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
  const orders = orderRows(current);
  const receivables = receivableRows(current);
  const shipped = orders.filter((order) => order.status === 'SHIPPED' || order.status === 'COMPLETED');
  const categorySales = new Map();
  const characterSales = new Map();
  const productSales = new Map();
  const cogs = shipped.reduce((sum, order) => {
    const product = getProduct(order.productId);
    const shippedQty = Number(order.shippedQty || order.quantity || 0);
    const salesAmount = Number(order.unitPrice || 0) * shippedQty;
    categorySales.set(product?.category || 'UNKNOWN', (categorySales.get(product?.category || 'UNKNOWN') || 0) + salesAmount);
    characterSales.set(product?.character || 'UNKNOWN', (characterSales.get(product?.character || 'UNKNOWN') || 0) + salesAmount);
    productSales.set(product?.name || order.productName || order.productId, (productSales.get(product?.name || order.productName || order.productId) || 0) + salesAmount);
    return sum + Number(order.unitCost || 0) * shippedQty;
  }, 0);
  const fixedExpenses = FIXED_EXPENSES.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const grossProfit = summary.sales - cogs;
  const operatingProfit = summary.latestSettlement?.operatingProfit ?? grossProfit - fixedExpenses;
  const collectedCash = receivables.reduce((sum, row) => sum + Number(row.collected || 0), 0);
  const overdueAmount = receivables.filter((row) => row.status === 'OVERDUE').reduce((sum, row) => sum + Number(row.remaining || 0), 0);
  const inventoryTurnoverBase = Math.max(1, cogs);
  const inventoryMonths = Number(((summary.inventoryAmount / inventoryTurnoverBase) || 0).toFixed(2));
  const cashRunwayMonths = Number((Number(current.company.cashKrw || 0) / Math.max(1, fixedExpenses)).toFixed(2));
  const receivableRatio = summary.assets ? Number(((summary.receivableAmount / summary.assets) * 100).toFixed(1)) : 0;
  const recommendations = [];

  if (operatingProfit < 0) recommendations.push('영업손실 상태입니다. 고정비 또는 저마진 상품 비중을 먼저 점검하세요.');
  if (receivableRatio >= 25) recommendations.push('매출채권 비중이 높습니다. 월말 결산 전에 회수 액션을 우선 처리하는 편이 좋습니다.');
  if (overdueAmount > 0) recommendations.push('연체 채권이 있습니다. 신용한도와 신규 주문 승인 기준을 보수적으로 두세요.');
  if (inventoryMonths >= 2) recommendations.push('재고 회전이 느립니다. 캠페인이나 출고 주문으로 재고를 줄일 필요가 있습니다.');
  if (cashRunwayMonths < 6) recommendations.push('현금 런웨이가 짧습니다. 생산 입고보다 채권 회수와 흑자 주문을 우선하세요.');
  if (!current.ledgerSnapshots.length) recommendations.push('장부 스냅샷이 없습니다. 주요 액션 전후로 스냅샷을 남기면 복원 실험이 가능합니다.');
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
    },
    productRows: topRowsFromMap(productSales, formatMoney).slice(0, 5),
    categoryRows: topRowsFromMap(categorySales, formatMoney),
    characterRows: topRowsFromMap(characterSales, formatMoney).slice(0, 5),
    riskRows: [
      { label: '현금 런웨이', value: `${cashRunwayMonths}개월` },
      { label: '매출채권 비중', value: `${receivableRatio}%` },
      { label: '연체 채권', value: formatMoney(overdueAmount) },
      { label: '재고 회전 월수', value: `${inventoryMonths}개월` },
      { label: '장부 스냅샷', value: `${current.ledgerSnapshots.length}개` },
    ],
    recommendations,
  };
}

export function scoreState(state) {
  const current = normalizeState(state);
  const report = reportSummary(current);
  const latest = report.latestSettlement;
  return Math.max(0, Math.round(
    Number(current.company.cashKrw || 0) / 1000000
    + Number(current.company.reputation || 0) * 18
    + Number(current.company.fanBase || 0) / 300
    + report.shippedOrders * 120
    + (latest ? Number(latest.netProfit || 0) / 250000 : 0)
    - report.openReceivables * 80
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
  return {
    year: current.company.year,
    month: current.company.month,
    cashKrw: current.company.cashKrw,
    assets: report.assets,
    receivables: report.receivableAmount,
    inventory: report.inventoryAmount,
    snapshots: current.ledgerSnapshots.length,
    bookmarks: current.reportBookmarks.length,
    exports: current.exportHistory.length,
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
    settlements: JSON.parse(JSON.stringify(state.settlements)),
    nextOrderNo: state.nextOrderNo,
    nextReceivableNo: state.nextReceivableNo,
  };
}

function ledgerComparableSummary(payload) {
  const inventoryEntries = Object.values(payload.inventory || {});
  const receivableEntries = Object.values(payload.receivables || {});
  const orderEntries = Object.values(payload.orders || {});
  const company = payload.company || {};
  return {
    period: `${company.year || '-'}-${String(company.month || 0).padStart(2, '0')}`,
    cashKrw: Number(company.cashKrw || 0),
    inventoryAmount: inventoryEntries.reduce((sum, row) => sum + Number(row.onHand || 0) * Number(row.avgCost || 0), 0),
    receivableAmount: receivableEntries.reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0) - Number(row.collected || 0)), 0),
    orderCount: orderEntries.length,
    shippedOrders: orderEntries.filter((row) => row.status === 'SHIPPED' || row.status === 'COMPLETED').length,
    openReceivables: receivableEntries.filter((row) => Math.max(0, Number(row.amount || 0) - Number(row.collected || 0)) > 0).length,
    settlementCount: Array.isArray(payload.settlements) ? payload.settlements.length : 0,
    reputation: Number(company.reputation || 0),
    fanBase: Number(company.fanBase || 0),
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
