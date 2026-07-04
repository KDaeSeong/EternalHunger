'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell from '../../_components/GamePlayShell';
import {
  GAME_SLUG,
  PARTNERS,
  PRODUCTS,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  collectReceivableAction,
  bookmarkCurrentReportAction,
  createLedgerSnapshotAction,
  createNewState,
  createOrderAction,
  createProgressExportAction,
  formatMoney,
  getPlayTimeSec,
  inboundInventoryAction,
  inventoryRows,
  ledgerDiffRows,
  marketingCampaignAction,
  managementReport,
  monthEndCloseAction,
  normalizeState,
  orderRows,
  receivableRows,
  reportSummary,
  restoreLatestSnapshotAction,
  scoreState,
  shipOrderAction,
  summaryForState,
} from '../_lib/companyReportEngine';

function ActionButton({ children, disabled, onClick }) {
  return (
    <button type="button" className="tcg-primary-action" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function SmallStat({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ value }) {
  const tone = value === 'COLLECTED' || value === 'COMPLETED' ? '통과' : value === 'OVERDUE' ? '위험' : '진행';
  return <span className="game-save-chip">{tone} {value}</span>;
}

export default function CompanyReportPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [state, setState] = useState(() => createNewState());
  const [partnerId, setPartnerId] = useState(PARTNERS[0].id);
  const [productId, setProductId] = useState(PRODUCTS[0].id);
  const [quantity, setQuantity] = useState(40);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedReceivableId, setSelectedReceivableId] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const score = scoreState(state);
  const report = useMemo(() => reportSummary(state), [state]);
  const management = useMemo(() => managementReport(state), [state]);
  const stocks = useMemo(() => inventoryRows(state), [state]);
  const orders = useMemo(() => orderRows(state), [state]);
  const receivables = useMemo(() => receivableRows(state), [state]);
  const ledgerDiff = useMemo(() => ledgerDiffRows(state), [state]);
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || orders.find((order) => order.status === 'CONFIRMED') || orders[0];
  const selectedReceivable = receivables.find((ar) => ar.id === selectedReceivableId) || receivables.find((ar) => ar.remaining > 0) || receivables[0];
  const latestSettlement = report.latestSettlement;
  const latestSnapshot = state.ledgerSnapshots[0];
  const latestBookmark = state.reportBookmarks[0];
  const latestExport = state.exportHistory[0];

  const startNewRun = () => {
    const nextState = createNewState();
    setState(nextState);
    setPartnerId(PARTNERS[0].id);
    setProductId(PRODUCTS[0].id);
    setQuantity(40);
    setSelectedOrderId('');
    setSelectedReceivableId('');
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
        payload: { state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('Company Report 원장 상태를 저장했습니다.');
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
      setState(normalizeState(detail?.save?.payload?.state));
      setSelectedOrderId('');
      setSelectedReceivableId('');
      setMessage('저장된 Company Report 원장 상태를 불러왔습니다.');
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
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('Company Report 결산 기록을 전적에 남겼습니다.');
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

  const metrics = [
    { label: '회사', value: state.company.name },
    { label: '월', value: `${state.company.year}-${String(state.company.month).padStart(2, '0')}` },
    { label: '현금', value: formatMoney(state.company.cashKrw) },
    { label: '채권', value: formatMoney(report.receivableAmount) },
    { label: '스냅샷', value: state.ledgerSnapshots.length },
    { label: '북마크', value: state.reportBookmarks.length },
    { label: '내보내기', value: state.exportHistory.length },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 플레이는 가능하지만 저장, 불러오기, 전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    report.openReceivables >= 3 ? { key: 'ar-risk', tone: 'error', text: '미수 채권이 많습니다. 월말 결산 전 회수를 진행하는 편이 좋습니다.' } : null,
  ];

  return (
    <GamePlayShell
      kicker="Company Report"
      title="회사 리포트 원장 시뮬레이터"
      description="업로드된 Company Report StepG-6의 거래, 재고, 매출채권, 월말 손익, 원장 스냅샷 흐름을 사이트용 business ledger slice로 이식했습니다."
      summaryLabel="Company Report 요약"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>주문 생성</h2>
            <span>{quantity}개</span>
          </div>
          <label className="game-save-json-field">
            <span>거래처</span>
            <select value={partnerId} onChange={(event) => setPartnerId(event.target.value)}>
              {PARTNERS.map((partner) => <option value={partner.id} key={partner.id}>{partner.name} / {partner.type}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>상품</span>
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              {PRODUCTS.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>수량</span>
            <input type="number" min="1" max="999" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={() => setState((current) => createOrderAction(current, partnerId, productId, quantity))}>주문 생성</ActionButton>
            <ActionButton onClick={() => setState((current) => inboundInventoryAction(current, productId, quantity))}>선택 상품 생산 입고</ActionButton>
            <ActionButton onClick={() => setState((current) => marketingCampaignAction(current, productId))}>선택 상품 캠페인</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>출고 / 회수</h2>
            <span>{selectedOrder?.status || '-'}</span>
          </div>
          <label className="game-save-json-field">
            <span>출고 주문</span>
            <select value={selectedOrder?.id || ''} onChange={(event) => setSelectedOrderId(event.target.value)}>
              {orders.map((order) => <option value={order.id} key={order.id}>{order.no} / {order.partnerName} / {order.status}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>회수 채권</span>
            <select value={selectedReceivable?.id || ''} onChange={(event) => setSelectedReceivableId(event.target.value)}>
              {receivables.map((ar) => <option value={ar.id} key={ar.id}>{ar.id} / {ar.partnerName} / {formatMoney(ar.remaining)}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={!selectedOrder} onClick={() => setState((current) => shipOrderAction(current, selectedOrder?.id))}>선택 주문 출고</ActionButton>
            <ActionButton disabled={!selectedReceivable || selectedReceivable.remaining <= 0} onClick={() => setState((current) => collectReceivableAction(current, selectedReceivable?.id))}>선택 채권 전액 회수</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>결산 / 스냅샷</h2>
            <span>{latestSnapshot?.checksum || '대기'}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="평판" value={state.company.reputation} />
            <SmallStat label="팬덤" value={state.company.fanBase.toLocaleString('ko-KR')} />
            <SmallStat label="자산" value={formatMoney(report.assets)} />
            <SmallStat label="자본" value={formatMoney(report.equity)} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={() => setState((current) => monthEndCloseAction(current))}>월말 결산</ActionButton>
            <ActionButton onClick={() => setState((current) => createLedgerSnapshotAction(current))}>원장 스냅샷 생성</ActionButton>
            <ActionButton disabled={!latestSnapshot} onClick={() => setState((current) => restoreLatestSnapshotAction(current))}>최근 스냅샷 복원</ActionButton>
            <ActionButton onClick={() => setState((current) => bookmarkCurrentReportAction(current))}>리포트 북마크</ActionButton>
            <ActionButton onClick={() => setState((current) => createProgressExportAction(current))}>진행 내보내기</ActionButton>
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>경영 리포트</h2>
            <span>손익 / 현금흐름</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="매출" value={formatMoney(management.income.sales)} />
            <SmallStat label="매출총이익" value={formatMoney(management.income.grossProfit)} />
            <SmallStat label="매출총이익률" value={`${management.income.grossMarginPct}%`} />
            <SmallStat label="영업손익" value={formatMoney(management.income.operatingProfit)} />
          </div>
          <div className="games-rank-split" style={{ marginTop: 12 }}>
            <SmallStat label="현금" value={formatMoney(management.cashFlow.cash)} />
            <SmallStat label="회수액" value={formatMoney(management.cashFlow.collectedCash)} />
            <SmallStat label="채권잔액" value={formatMoney(management.cashFlow.receivableAmount)} />
            <SmallStat label="런웨이" value={`${management.cashFlow.cashRunwayMonths}개월`} />
          </div>
          <div className="games-activity-list" style={{ marginTop: 12 }}>
            {management.recommendations.map((line) => (
              <div key={line}><strong>{line}</strong></div>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>매출 분석</h2>
            <span>상품 / 캐릭터</span>
          </div>
          <div className="game-save-list">
            {management.productRows.length ? management.productRows.map((row) => (
              <article className="game-save-row" key={row.label}>
                <div>
                  <span>상품 매출</span>
                  <strong>{row.label}</strong>
                </div>
                <strong>{row.formatted}</strong>
              </article>
            )) : <div className="games-empty">출고된 상품 매출이 없습니다.</div>}
          </div>
          <div className="games-rank-split" style={{ marginTop: 12 }}>
            {management.characterRows.slice(0, 4).map((row) => (
              <SmallStat label={row.label} value={row.formatted} key={row.label} />
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>리스크 체크</h2>
            <span>{management.riskRows.length}개 지표</span>
          </div>
          <div className="game-save-list">
            {management.riskRows.map((row) => (
              <article className="game-save-row" key={row.label}>
                <div>
                  <span>관리 지표</span>
                  <strong>{row.label}</strong>
                </div>
                <strong>{row.value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>스냅샷 diff</h2>
            <span>{latestSnapshot?.checksum || '스냅샷 없음'}</span>
          </div>
          <div className="game-save-list">
            {ledgerDiff.length ? ledgerDiff.map((row) => (
              <article className="game-save-row" key={row.label}>
                <div>
                  <span>{row.before} → {row.after}</span>
                  <strong>{row.label}</strong>
                </div>
                <strong>{row.deltaText}</strong>
              </article>
            )) : <div className="games-empty">스냅샷을 생성하면 현재 원장과의 차이를 볼 수 있습니다.</div>}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>재무 요약</h2>
            <span>{latestSettlement ? `${latestSettlement.year}-${String(latestSettlement.month).padStart(2, '0')}` : '결산 전'}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="총자산" value={formatMoney(report.assets)} />
            <SmallStat label="부채" value={formatMoney(report.liabilities)} />
            <SmallStat label="재고" value={formatMoney(report.inventoryAmount)} />
            <SmallStat label="매출" value={formatMoney(report.sales)} />
          </div>
          {latestSettlement ? (
            <div className="game-save-list">
              <article className="game-save-row">
                <div>
                  <span>최근 월말 결산</span>
                  <strong>영업손익 {formatMoney(latestSettlement.operatingProfit)}</strong>
                </div>
                <strong>{formatMoney(latestSettlement.netProfit)}</strong>
              </article>
            </div>
          ) : <div className="games-empty">월말 결산을 실행하면 손익과 현금흐름이 표시됩니다.</div>}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>스냅샷</h2>
            <span>{state.ledgerSnapshots.length}개</span>
          </div>
          <div className="game-save-list">
            {state.ledgerSnapshots.length ? state.ledgerSnapshots.map((snapshot) => (
              <article className="game-save-row" key={snapshot.id}>
                <div>
                  <span>{snapshot.rowCount} rows / {snapshot.checksum}</span>
                  <strong>{snapshot.label}</strong>
                </div>
                <strong>{new Date(snapshot.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</strong>
              </article>
            )) : <div className="games-empty">아직 원장 스냅샷이 없습니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>리포트 아카이브</h2>
            <span>{latestBookmark?.label || '북마크 없음'}</span>
          </div>
          <div className="game-save-list">
            {state.reportBookmarks.length ? state.reportBookmarks.slice(0, 5).map((bookmark) => (
              <article className="game-save-row" key={bookmark.id}>
                <div>
                  <span>{bookmark.favorite ? '즐겨찾기' : '일반'} / {bookmark.note}</span>
                  <strong>{bookmark.label}</strong>
                  <span>자산 {formatMoney(bookmark.assets)} / 채권 {formatMoney(bookmark.receivableAmount)}</span>
                </div>
                <strong>{Number(bookmark.score || 0).toLocaleString('ko-KR')}</strong>
              </article>
            )) : <div className="games-empty">중요한 결산이나 진행 리포트를 북마크할 수 있습니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>내보내기 기록</h2>
            <span>{latestExport?.checksum || '기록 없음'}</span>
          </div>
          <div className="game-save-list">
            {state.exportHistory.length ? state.exportHistory.slice(0, 5).map((item) => (
              <article className="game-save-row" key={item.id}>
                <div>
                  <span>{item.exportType} / {item.itemCount} items</span>
                  <strong>{item.exportNote}</strong>
                  <span>{String(item.content || '').split('\n').slice(0, 2).join(' / ')}</span>
                </div>
                <strong>{item.checksum}</strong>
              </article>
            )) : <div className="games-empty">진행 내보내기를 실행하면 감사용 기록이 남습니다.</div>}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>주문 원장</h2>
            <span>{orders.length}건</span>
          </div>
          <div className="game-save-list">
            {orders.slice(0, 8).map((order) => (
              <article className="game-save-row" key={order.id}>
                <div>
                  <span>{order.partnerName} / {order.productName}</span>
                  <strong>{order.no}</strong>
                  <span>{order.quantity}개 / {formatMoney(order.totalAmount)}</span>
                </div>
                <StatusBadge value={order.status} />
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>매출채권</h2>
            <span>{formatMoney(report.receivableAmount)}</span>
          </div>
          <div className="game-save-list">
            {receivables.slice(0, 8).map((ar) => (
              <article className="game-save-row" key={ar.id}>
                <div>
                  <span>{ar.partnerName} / 회수 {formatMoney(ar.collected)}</span>
                  <strong>{ar.id}</strong>
                  <span>잔액 {formatMoney(ar.remaining)}</span>
                </div>
                <StatusBadge value={ar.status} />
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>재고 원장</h2>
            <span>{stocks.length}품목</span>
          </div>
          <div className="game-save-list">
            {stocks.map((stock) => (
              <article className="game-save-row" key={stock.id}>
                <div>
                  <span>{stock.category} / {stock.character}</span>
                  <strong>{stock.name}</strong>
                  <span>평균원가 {formatMoney(stock.avgCost)} / 장부 {formatMoney(stock.amount)}</span>
                </div>
                <strong>{stock.onHand}개</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>운영 로그</h2>
            <span>{state.runId}</span>
          </div>
          <div className="games-activity-list">
            {state.log.slice(0, 12).map((line, index) => (
              <div key={`${line}-${index}`}>
                <strong>{line}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>
    </GamePlayShell>
  );
}
