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
  { id: 'goods-aero', name: '마스크드 피에로 아크릴 굿즈', category: 'GOODS', character: '마스크드 피에로', unitPrice: 22000, unitCost: 7000, hype: 78 },
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

export const FIXED_EXPENSES = [
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

export const LEDGER_TABLE_PARENT_DEPENDENCIES = {
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
