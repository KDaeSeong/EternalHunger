import { SmallStat } from '../../_components/GamePlayPrimitives';
import { formatMoney } from '../_lib/companyReportEngine';

export default function CompanyReportManagementPanels({
  ledgerDiff,
  latestSnapshot,
  management,
  restorePlan,
}) {
  return (
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

      <section className="games-panel">
        <div className="games-panel-title">
          <h2>복원 dry-run</h2>
          <span>{restorePlan.dryRunStatus}</span>
        </div>
        <div className="games-rank-split">
          <SmallStat label="모드" value={restorePlan.restoreModeLabel} />
          <SmallStat label="대상 테이블" value={restorePlan.targetTables.length} />
          <SmallStat label="삭제 예정" value={`${restorePlan.deletedRowCount} rows`} />
          <SmallStat label="삽입 예정" value={`${restorePlan.insertedRowCount} rows`} />
          <SmallStat label="FK 순환" value={restorePlan.cycleDetected ? '감지' : '없음'} />
        </div>
        <div className="game-save-list" style={{ marginTop: 12 }}>
          <article className="game-save-row">
            <div>
              <span>checksum {restorePlan.snapshotChecksum || '-'}</span>
              <strong>{restorePlan.message}</strong>
            </div>
            <strong>{restorePlan.beforeDiffStatus}</strong>
          </article>
          <article className="game-save-row">
            <div>
              <span>delete</span>
              <strong>{restorePlan.deleteOrder.slice(0, 5).join(' → ') || '-'}</strong>
            </div>
            <strong>{restorePlan.deleteOrder.length}</strong>
          </article>
          <article className="game-save-row">
            <div>
              <span>insert</span>
              <strong>{restorePlan.insertOrder.slice(0, 5).join(' → ') || '-'}</strong>
            </div>
            <strong>{restorePlan.insertOrder.length}</strong>
          </article>
          {restorePlan.warnings.slice(0, 3).map((warning) => (
            <article className="game-save-row" key={warning}>
              <div>
                <span>warning</span>
                <strong>{warning}</strong>
              </div>
              <strong>검토</strong>
            </article>
          ))}
          {restorePlan.tableDiffs.slice(0, 8).map((row) => (
            <article className="game-save-row" key={row.tableName}>
              <div>
                <span>{row.snapshotRowCount} rows snapshot / {row.currentRowCount} rows current</span>
                <strong>{row.label}</strong>
                <span>missing {row.missingInCurrentCount} / extra {row.extraInCurrentCount} / changed {row.changedRowCount}</span>
                <span>{row.snapshotChecksum} → {row.currentChecksum}</span>
              </div>
              <strong>{row.diffStatus}</strong>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
