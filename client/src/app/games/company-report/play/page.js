'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell from '../../_components/GamePlayShell';
import {
  CAPITAL_DISCLOSURE_TYPES,
  CAPITAL_FINANCING_TYPES,
  GAME_SLUG,
  GLOBAL_MARKETS,
  PARTNERS,
  PRODUCTS,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  capitalMarketSummary,
  createNewState,
  createProgressExportAction,
  globalMarketRows,
  globalReceivableRows,
  globalTradeSummary,
  getPlayTimeSec,
  inventoryRows,
  inventoryValuationRows,
  inventoryWriteDownRows,
  ledgerDiffRows,
  ledgerRestorePlan,
  managementReport,
  normalizeState,
  orderRows,
  payVatAction,
  receivableRows,
  reportSummary,
  reportHistoryTrend,
  scoreState,
  summaryForState,
  vatPaymentRows,
  vatScheduleRows,
} from '../_lib/companyReportEngine';
import {
  buildCompanyReportExportCsv,
  buildCompanyReportExportPayload,
} from '../_lib/companyReportExportRuntime';
import {
  buildCompanyReportExportBaseName,
  buildCompanyReportMessages,
  buildCompanyReportMetrics,
} from '../_lib/companyReportPageRuntime';
import CompanyReportDetailPanels from '../_components/CompanyReportDetailPanels';
import CompanyReportFeatureTabs from '../_components/CompanyReportFeatureTabs';
import {
  CompanyReportGuidancePanel,
  buildCompanyReportGuidance,
  normalizeCompanyReportGuidanceLevel,
} from '../_components/CompanyReportGuidancePanel';
import { actionFeedbackText, downloadTextFile, safeFilePart } from '../_lib/companyReportPlayHelpers';

export default function CompanyReportPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [state, setState] = useState(() => createNewState());
  const [guidanceLevel, setGuidanceLevel] = useState('outsider');
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
  const [selectedRestoreTables, setSelectedRestoreTables] = useState('sales_order, account_receivable, inventory_balance, vat_payment, inventory_valuation, inventory_write_down');
  const [selectedVatKey, setSelectedVatKey] = useState('');
  const [vatPaymentAmount, setVatPaymentAmount] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [actionResult, setActionResult] = useState('');

  const score = scoreState(state);
  const report = useMemo(() => reportSummary(state), [state]);
  const management = useMemo(() => managementReport(state), [state]);
  const reportTrend = useMemo(() => reportHistoryTrend(state), [state]);
  const globalSummary = useMemo(() => globalTradeSummary(state), [state]);
  const capitalSummary = useMemo(() => capitalMarketSummary(state), [state]);
  const markets = useMemo(() => globalMarketRows(), []);
  const stocks = useMemo(() => inventoryRows(state), [state]);
  const inventoryValuations = useMemo(() => inventoryValuationRows(state), [state]);
  const inventoryWriteDowns = useMemo(() => inventoryWriteDownRows(state), [state]);
  const orders = useMemo(() => orderRows(state), [state]);
  const receivables = useMemo(() => receivableRows(state), [state]);
  const vatSchedule = useMemo(() => vatScheduleRows(state), [state]);
  const vatPayments = useMemo(() => vatPaymentRows(state), [state]);
  const foreignReceivables = useMemo(() => globalReceivableRows(state), [state]);
  const ledgerDiff = useMemo(() => ledgerDiffRows(state), [state]);
  const restorePlan = useMemo(() => ledgerRestorePlan(state, restoreMode, selectedRestoreTables), [state, restoreMode, selectedRestoreTables]);
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || orders.find((order) => order.status === 'CONFIRMED') || orders[0];
  const selectedReceivable = receivables.find((ar) => ar.id === selectedReceivableId) || receivables.find((ar) => ar.remaining > 0) || receivables[0];
  const selectedVatRow = vatSchedule.find((row) => row.id === selectedVatKey) || vatSchedule.find((row) => row.remainingAmount > 0) || vatSchedule[0];
  const guidance = buildCompanyReportGuidance({
    level: guidanceLevel,
    state,
    report,
    management,
    globalSummary,
    capitalSummary,
    reportTrend,
    restorePlan,
    selectedVatRow,
  });
  const selectedForeignAr = foreignReceivables.find((ar) => ar.id === selectedForeignArId) || foreignReceivables.find((ar) => ar.remainingKrw > 0) || foreignReceivables[0];
  const vatPayAmount = Math.max(0, Math.round(Number(vatPaymentAmount || selectedVatRow?.remainingAmount || 0)));
  const latestSettlement = report.latestSettlement;
  const latestSnapshot = state.ledgerSnapshots[0];
  const latestBookmark = state.reportBookmarks[0];
  const latestExport = state.exportHistory[0];
  const latestRestore = state.restoreHistory[0];
  const exportBaseName = buildCompanyReportExportBaseName(state);
  const recentActionText = actionResult || state.log?.[0] || '아직 실행한 원장 액션이 없습니다.';

  const applyLedgerAction = (label, updater, fallback = '') => {
    const nextState = updater(state);
    setState(nextState);
    setActionResult(actionFeedbackText(state, nextState, label, fallback));
  };

  const buildExportPayload = (exportedState = state) => {
    return buildCompanyReportExportPayload({
      restoreMode,
      selectedRestoreTables,
      state: exportedState,
    });
  };

  const downloadProgressJson = () => {
    const exportedState = createProgressExportAction(state);
    const payload = buildExportPayload(exportedState);
    setState(exportedState);
    setActionResult(actionFeedbackText(state, exportedState, 'JSON 다운로드', '진행 보고서 JSON 다운로드 이력을 추가했습니다.'));
    downloadTextFile(
      `${safeFilePart(exportBaseName)}-progress.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8',
    );
    showToast({ tone: 'success', message: '진행 보고서 JSON 다운로드를 준비했습니다.' });
  };

  const downloadProgressCsv = () => {
    const exportedState = createProgressExportAction(state);
    const payload = buildExportPayload(exportedState);
    setState(exportedState);
    setActionResult(actionFeedbackText(state, exportedState, 'CSV 다운로드', '진행 보고서 CSV 다운로드 이력을 추가했습니다.'));
    downloadTextFile(
      `${safeFilePart(exportBaseName)}-progress.csv`,
      buildCompanyReportExportCsv(payload),
      'text/csv;charset=utf-8',
    );
    showToast({ tone: 'success', message: '진행 보고서 CSV 다운로드를 준비했습니다.' });
  };

  const downloadRestorePlanJson = () => {
    const payload = buildExportPayload(state);
    setActionResult('복원 계획 JSON 다운로드를 준비했습니다.');
    downloadTextFile(
      `${safeFilePart(exportBaseName)}-restore-plan.json`,
      JSON.stringify({
        gameSlug: GAME_SLUG,
        version: SAVE_VERSION,
        exportedAt: payload.exportedAt,
        period: payload.period,
        restorePlan: payload.restorePlan,
        ledgerDiff: payload.ledgerDiff,
      }, null, 2),
      'application/json;charset=utf-8',
    );
    showToast({ tone: 'success', message: '복원 계획 JSON 다운로드를 준비했습니다.' });
  };

  const handleVatSelect = (key) => {
    const row = vatSchedule.find((item) => item.id === key);
    setSelectedVatKey(key);
    setVatPaymentAmount(row?.remainingAmount ? String(row.remainingAmount) : '');
  };

  const runVatPayment = () => {
    if (!selectedVatRow) return;
    applyLedgerAction('VAT 납부', (current) => payVatAction(current, selectedVatRow.targetYear, selectedVatRow.targetMonth, vatPayAmount));
    setVatPaymentAmount('');
  };

  const startNewRun = () => {
    const nextState = createNewState();
    setState(nextState);
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
    setSelectedRestoreTables('sales_order, account_receivable, inventory_balance, vat_payment, inventory_valuation, inventory_write_down');
    setSelectedVatKey('');
    setVatPaymentAmount('');
    setActionResult('새 Company Report 원장을 시작했습니다.');
    setMessage('');
  };

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 Company Report 원장 상태를 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `Company Report ${state.company.year}-${String(state.company.month).padStart(2, '0')}`,
        version: SAVE_VERSION,
        summary: summaryForState(state),
        payload: { state, guidanceLevel },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('Company Report 원장 상태를 저장했습니다.');
      setActionResult('Company Report 원장 상태를 저장 슬롯에 저장했습니다.');
      showToast({ tone: 'success', message: 'Company Report 원장 상태를 저장했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 저장된 Company Report 원장 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 Company Report 원장 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const payload = detail?.save?.payload || {};
      const nextState = normalizeState(payload.state);
      setState(nextState);
      setGuidanceLevel(normalizeCompanyReportGuidanceLevel(payload.guidanceLevel));
      setSelectedOrderId('');
      setSelectedReceivableId('');
      setSelectedVatKey('');
      setVatPaymentAmount('');
      setMessage('저장된 Company Report 원장 상태를 불러왔습니다.');
      setActionResult(nextState.log?.[0] || '저장된 Company Report 원장 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 Company Report 원장 상태를 불러왔습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '불러오기에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 Company Report 결산 기록을 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `Company Report - ${state.company.year}-${String(state.company.month).padStart(2, '0')}`,
        mode: 'business-ledger',
        result: 'ledger-score',
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state, guidanceLevel },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('Company Report 결산 기록을 전적에 남겼습니다.');
      setActionResult('Company Report 결산 기록을 전적에 남겼습니다.');
      showToast({ tone: 'success', message: 'Company Report 결산 기록을 전적에 남겼습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const actions = (
    <>
      <button type="button" onClick={startNewRun}>새 원장</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</button>
      <Link href="/myanime/company-report">상세</Link>
    </>
  );

  const metrics = buildCompanyReportMetrics({
    capitalSummary,
    globalSummary,
    guidance,
    report,
    reportTrend,
    score,
    state,
  });

  const messages = buildCompanyReportMessages({
    capitalSummary,
    hydrated,
    message,
    report,
    token,
  });

  return (
    <GamePlayShell
      kicker="Company Report"
      title="회사 리포트 원장 시뮬레이터"
      description="업로드된 Company Report StepG-6의 거래, 재고, 매출채권, 월말 손익, 원장 스냅샷 흐름을 사이트용 business ledger slice로 이식했습니다."
      summaryLabel="Company Report 요약"
      summaryDensity="compact"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <CompanyReportGuidancePanel
        guidance={guidance}
        level={guidanceLevel}
        onLevelChange={setGuidanceLevel}
      />

      <CompanyReportFeatureTabs
        applyLedgerAction={applyLedgerAction}
        capitalSummary={capitalSummary}
        disclosureTypeId={disclosureTypeId}
        downloadProgressCsv={downloadProgressCsv}
        downloadProgressJson={downloadProgressJson}
        downloadRestorePlanJson={downloadRestorePlanJson}
        financingTypeId={financingTypeId}
        foreignReceivables={foreignReceivables}
        globalMarketId={globalMarketId}
        globalProductId={globalProductId}
        globalSummary={globalSummary}
        globalUnits={globalUnits}
        guidance={guidance}
        latestSettlement={latestSettlement}
        latestSnapshot={latestSnapshot}
        ledgerDiff={ledgerDiff}
        management={management}
        orders={orders}
        partnerId={partnerId}
        productId={productId}
        quantity={quantity}
        recentActionText={recentActionText}
        report={report}
        reportTrend={reportTrend}
        restoreMode={restoreMode}
        restorePlan={restorePlan}
        runVatPayment={runVatPayment}
        selectedForeignAr={selectedForeignAr}
        selectedOrder={selectedOrder}
        selectedReceivable={selectedReceivable}
        selectedRestoreTables={selectedRestoreTables}
        selectedVatRow={selectedVatRow}
        state={state}
        stocks={stocks}
        vatPayAmount={vatPayAmount}
      />

      <CompanyReportDetailPanels
        applyLedgerAction={applyLedgerAction}
        capitalSummary={capitalSummary}
        disclosureTypeId={disclosureTypeId}
        downloadProgressCsv={downloadProgressCsv}
        downloadProgressJson={downloadProgressJson}
        downloadRestorePlanJson={downloadRestorePlanJson}
        financingTypeId={financingTypeId}
        foreignReceivables={foreignReceivables}
        globalMarketId={globalMarketId}
        globalProductId={globalProductId}
        globalSummary={globalSummary}
        globalUnits={globalUnits}
        handleVatSelect={handleVatSelect}
        inventoryValuations={inventoryValuations}
        inventoryWriteDowns={inventoryWriteDowns}
        latestBookmark={latestBookmark}
        latestExport={latestExport}
        latestRestore={latestRestore}
        latestSettlement={latestSettlement}
        latestSnapshot={latestSnapshot}
        ledgerDiff={ledgerDiff}
        management={management}
        markets={markets}
        orders={orders}
        partnerId={partnerId}
        productId={productId}
        quantity={quantity}
        receivables={receivables}
        recentActionText={recentActionText}
        report={report}
        restoreMode={restoreMode}
        restorePlan={restorePlan}
        runVatPayment={runVatPayment}
        selectedForeignAr={selectedForeignAr}
        selectedOrder={selectedOrder}
        selectedReceivable={selectedReceivable}
        selectedRestoreTables={selectedRestoreTables}
        selectedVatRow={selectedVatRow}
        setDisclosureTypeId={setDisclosureTypeId}
        setFinancingTypeId={setFinancingTypeId}
        setGlobalMarketId={setGlobalMarketId}
        setGlobalProductId={setGlobalProductId}
        setGlobalUnits={setGlobalUnits}
        setPartnerId={setPartnerId}
        setProductId={setProductId}
        setQuantity={setQuantity}
        setRestoreMode={setRestoreMode}
        setSelectedForeignArId={setSelectedForeignArId}
        setSelectedOrderId={setSelectedOrderId}
        setSelectedReceivableId={setSelectedReceivableId}
        setSelectedRestoreTables={setSelectedRestoreTables}
        setVatPaymentAmount={setVatPaymentAmount}
        state={state}
        stocks={stocks}
        vatPayAmount={vatPayAmount}
        vatPaymentAmount={vatPaymentAmount}
        vatPayments={vatPayments}
        vatSchedule={vatSchedule}
      />
    </GamePlayShell>
  );
}
