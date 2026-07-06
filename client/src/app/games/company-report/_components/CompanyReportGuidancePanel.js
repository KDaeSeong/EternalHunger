'use client';

import { formatMoney } from '../_lib/companyReportEngine';

export const COMPANY_REPORT_GUIDANCE_LEVELS = [
  {
    id: 'outsider',
    label: '경영 문외한',
    shortLabel: '문외한',
    depth: 0,
    description: '숫자를 게임 행동으로 번역합니다.',
  },
  {
    id: 'beginner',
    label: '경영 초보',
    shortLabel: '초보',
    depth: 1,
    description: '핵심 용어와 현재 수치를 함께 보여줍니다.',
  },
  {
    id: 'intermediate',
    label: '경영 중급',
    shortLabel: '중급',
    depth: 2,
    description: 'KPI와 위험 신호를 중심으로 판단합니다.',
  },
  {
    id: 'advanced',
    label: '경영 고급',
    shortLabel: '고급',
    depth: 3,
    description: '원장, VAT, 공시, 자본시장 흐름까지 엮어 봅니다.',
  },
  {
    id: 'master',
    label: '경영 달인',
    shortLabel: '달인',
    depth: 4,
    description: '감사 추적과 원자료 중심으로 직접 판정합니다.',
  },
];

const LEVEL_BY_ID = COMPANY_REPORT_GUIDANCE_LEVELS.reduce((map, level) => {
  map[level.id] = level;
  return map;
}, {});

const DEFAULT_LEVEL_ID = COMPANY_REPORT_GUIDANCE_LEVELS[0].id;

export function normalizeCompanyReportGuidanceLevel(value, fallback = DEFAULT_LEVEL_ID) {
  if (LEVEL_BY_ID[value]) return value;
  return LEVEL_BY_ID[fallback] ? fallback : DEFAULT_LEVEL_ID;
}

function toPct(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}%`;
}

function buildPrimaryAction({ report, globalSummary, capitalSummary, selectedVatRow, restorePlan }) {
  if (Number(report.openReceivables || 0) >= 2) {
    return {
      title: '미수 채권 회수',
      action: '거래/채권 탭에서 선택 채권 회수를 먼저 실행하세요.',
      reason: '팔았지만 아직 못 받은 돈이 많으면 현금이 묶입니다.',
    };
  }
  if (Number(selectedVatRow?.remainingAmount || 0) > 0) {
    return {
      title: 'VAT 납부',
      action: '결산/VAT 탭에서 납부 가능 금액을 확인하고 처리하세요.',
      reason: '세금 미납은 결산 점수와 현금흐름 판단을 흐립니다.',
    };
  }
  if (Number(globalSummary.openForeignReceivableKrw || 0) > 0) {
    return {
      title: '외화 채권 정리',
      action: '글로벌 탭에서 외화채권 회수나 헤지를 검토하세요.',
      reason: '환율 변동에 노출된 매출채권은 장기 리스크가 됩니다.',
    };
  }
  if (Number(capitalSummary.disclosureRisk || 0) >= 30) {
    return {
      title: '공시 리스크 낮추기',
      action: '자본시장 탭에서 공시 대응을 실행하세요.',
      reason: '공시 리스크가 높으면 투자자 신뢰와 주가가 같이 흔들립니다.',
    };
  }
  if (restorePlan?.dryRunStatus === 'NEEDS_REVIEW') {
    return {
      title: '원장 복원 dry-run 검토',
      action: '원장/복원 탭에서 dry-run 결과를 확인하세요.',
      reason: '복원 전 차이를 먼저 보면 의도치 않은 삭제를 줄일 수 있습니다.',
    };
  }
  return {
    title: '월말 결산 준비',
    action: '재고평가, 채권 회수, VAT를 확인한 뒤 월말 결산을 진행하세요.',
    reason: '결산 전 정리할 항목이 적을수록 보고서 점수가 안정됩니다.',
  };
}

function buildGlossary(depth) {
  const basic = [
    ['현금', '지금 바로 쓸 수 있는 돈입니다. 부족하면 좋은 주문이 있어도 실행이 막힙니다.'],
    ['채권', '이미 팔았지만 아직 받지 못한 돈입니다. 회수하면 현금이 늘어납니다.'],
    ['재고', '창고에 남아 있는 상품입니다. 너무 많으면 돈이 물건에 묶입니다.'],
  ];
  const intermediate = [
    ['매출총이익률', '판매가에서 원가를 뺀 뒤 매출 대비 얼마가 남는지 보는 비율입니다.'],
    ['VAT', '거래에서 발생한 부가세입니다. 납부 전까지는 현금처럼 보여도 회사 돈이 아닙니다.'],
    ['런웨이', '현재 현금으로 몇 개월 버틸 수 있는지 보는 생존 지표입니다.'],
  ];
  const advanced = [
    ['외화채권', '수출로 생긴 받을 돈입니다. 환율이 움직이면 원화 가치가 달라집니다.'],
    ['공시 리스크', '상장사가 투자자에게 설명해야 할 정보가 밀린 정도입니다.'],
    ['원장 스냅샷', '복원과 감사 비교를 위해 특정 시점의 거래 장부를 저장한 기록입니다.'],
  ];
  const master = [
    ['checksum', '내보낸 보고서나 스냅샷이 같은 데이터에서 나온 것인지 빠르게 대조하는 값입니다.'],
    ['dry-run', '복원 실행 전에 어떤 행이 바뀌는지 미리 계산하는 안전 점검입니다.'],
  ];

  if (depth <= 0) return basic.slice(0, 2);
  if (depth === 1) return basic.concat(intermediate.slice(0, 1));
  if (depth === 2) return basic.concat(intermediate);
  if (depth === 3) return basic.concat(intermediate, advanced);
  return basic.concat(intermediate, advanced, master);
}

function buildCoachLines({ depth, report, management, globalSummary, capitalSummary, reportTrend, restorePlan }) {
  if (depth <= 0) {
    return [
      `먼저 돈 받을 것 ${Number(report.openReceivables || 0)}건을 줄이고, 현금 ${formatMoney(management.cashFlow.cash)}을 지키세요.`,
      `이번 달은 매출 ${formatMoney(management.income.sales)}에서 실제로 남는 돈을 확인하는 단계입니다.`,
      '버튼을 누르기 전 “현금이 늘어나는가, 위험이 줄어드는가”만 먼저 보면 됩니다.',
    ];
  }

  if (depth === 1) {
    return [
      `영업이익은 ${formatMoney(management.income.operatingProfit)}입니다. 매출이 있어도 비용이 크면 손실일 수 있습니다.`,
      `채권 잔액은 ${formatMoney(report.receivableAmount)}입니다. 회수 전까지는 장부상 받을 돈입니다.`,
      `VAT 미납액은 ${formatMoney(report.vatPayableAmount)}입니다. 결산 전에 별도로 챙겨야 합니다.`,
    ];
  }

  if (depth === 2) {
    return [
      `매출총이익률 ${toPct(management.income.grossMarginPct)}, 현금 런웨이 ${management.cashFlow.cashRunwayMonths}개월입니다.`,
      `외화채권 노출은 ${formatMoney(globalSummary.openForeignReceivableKrw)}, 헤지 계약은 ${globalSummary.hedgeCount}건입니다.`,
      `리포트 이력 점수는 ${reportTrend.archiveScore}%입니다. 북마크와 스냅샷이 부족하면 추적성이 떨어집니다.`,
    ];
  }

  if (depth === 3) {
    return [
      `공시 리스크 ${capitalSummary.disclosureRisk}/100, 투자자 신뢰 ${capitalSummary.investorTrust}/100입니다.`,
      `복원 모드는 ${restorePlan.restoreModeLabel}, dry-run 상태는 ${restorePlan.dryRunStatus}입니다.`,
      `장부 차이 ${restorePlan.tableDiffs.length}개 테이블을 보고 결산 전 복원 필요성을 판단하세요.`,
    ];
  }

  return [
    `원장 스냅샷 ${reportTrend.snapshotRows.length}개, 내보내기 ${reportTrend.exportRows.length}개, 북마크 ${reportTrend.bookmarkRows.length}개입니다.`,
    `복원 예상 삭제 행 ${restorePlan.deletedRowCount}개, 변경 테이블 ${restorePlan.tableDiffs.filter((row) => row.diffStatus !== 'MATCH').length}개입니다.`,
    '달인 모드에서는 추천을 참고만 하고, checksum, diff, dry-run 결과를 직접 대조하세요.',
  ];
}

function buildFocusRows({ depth, report, management, globalSummary, capitalSummary, reportTrend, restorePlan }) {
  const rows = [
    ['현금', formatMoney(management.cashFlow.cash)],
    ['채권', formatMoney(report.receivableAmount)],
    ['영업이익', formatMoney(management.income.operatingProfit)],
  ];

  if (depth >= 1) {
    rows.push(['VAT', formatMoney(report.vatPayableAmount)]);
  }
  if (depth >= 2) {
    rows.push(['마진', toPct(management.income.grossMarginPct)]);
    rows.push(['외화채권', formatMoney(globalSummary.openForeignReceivableKrw)]);
  }
  if (depth >= 3) {
    rows.push(['공시위험', `${capitalSummary.disclosureRisk}/100`]);
    rows.push(['복원상태', restorePlan.dryRunStatus]);
  }
  if (depth >= 4) {
    rows.push(['checksum', reportTrend.snapshotRows[0]?.checksum || '-']);
    rows.push(['diff tables', restorePlan.tableDiffs.length]);
  }

  return rows;
}

export function buildCompanyReportGuidance({
  level,
  state,
  report,
  management,
  globalSummary,
  capitalSummary,
  reportTrend,
  restorePlan,
  selectedVatRow,
}) {
  const levelId = normalizeCompanyReportGuidanceLevel(level);
  const levelInfo = LEVEL_BY_ID[levelId];
  const depth = levelInfo.depth;
  const primaryAction = buildPrimaryAction({ report, globalSummary, capitalSummary, selectedVatRow, restorePlan });
  const focusRows = buildFocusRows({ depth, report, management, globalSummary, capitalSummary, reportTrend, restorePlan });
  const coachLines = buildCoachLines({ depth, report, management, globalSummary, capitalSummary, reportTrend, restorePlan });
  const glossaryRows = buildGlossary(depth);

  return {
    levelId,
    levelLabel: levelInfo.label,
    levelShortLabel: levelInfo.shortLabel,
    levelDescription: levelInfo.description,
    period: `${state.company.year}-${String(state.company.month).padStart(2, '0')}`,
    primaryAction,
    focusRows,
    coachLines,
    glossaryRows,
    showGlobal: depth >= 2,
    showCapital: depth >= 3,
    showHistory: depth >= 2,
    showLedger: depth >= 3,
    showRawAudit: depth >= 4,
  };
}

export function CompanyReportGuidancePanel({ guidance, level, onLevelChange }) {
  return (
    <section className="games-panel">
      <div className="games-panel-title">
        <h2>경영 도움말</h2>
        <span>{guidance.period} · {guidance.levelLabel}</span>
      </div>
      <div className="games-hero-actions" role="group" aria-label="경영 숙련도">
        {COMPANY_REPORT_GUIDANCE_LEVELS.map((item) => {
          const selected = item.id === level;
          return (
            <button
              type="button"
              className="games-filter-chip"
              key={item.id}
              aria-pressed={selected}
              title={item.description}
              onClick={() => onLevelChange(item.id)}
              style={selected ? { borderColor: '#1b6fa2', background: '#eef7ff', color: '#12364f' } : undefined}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <section className="tcg-event-callout is-info" style={{ marginTop: 14 }}>
        <span>다음 판단</span>
        <strong>{guidance.primaryAction.title}</strong>
        <p>{guidance.primaryAction.action}</p>
        <small>{guidance.primaryAction.reason}</small>
      </section>

      <div className="games-rank-split" style={{ marginTop: 14 }}>
        {guidance.focusRows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="games-detail-grid" style={{ marginTop: 14 }}>
        <section className="games-panel">
          <div className="games-panel-title">
            <h3>판단 가이드</h3>
            <span>{guidance.levelShortLabel}</span>
          </div>
          <div className="games-activity-list">
            {guidance.coachLines.map((line) => (
              <div key={line}><strong>{line}</strong></div>
            ))}
          </div>
        </section>
        <section className="games-panel">
          <div className="games-panel-title">
            <h3>표기 방식</h3>
            <span>{guidance.levelDescription}</span>
          </div>
          <div className="game-save-list">
            {guidance.glossaryRows.map(([term, text]) => (
              <article className="game-save-row" key={term}>
                <div>
                  <span>용어</span>
                  <strong>{term}</strong>
                  <small>{text}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {guidance.showRawAudit ? (
        <details className="games-summary-overflow" style={{ marginTop: 14 }}>
          <summary>달인용 원자료 관점</summary>
          <div className="games-summary-overflow__grid">
            <div className="games-metric games-metric--secondary">
              <span>글로벌 탭</span>
              <strong>{guidance.showGlobal ? '노출' : '숨김'}</strong>
            </div>
            <div className="games-metric games-metric--secondary">
              <span>자본시장 탭</span>
              <strong>{guidance.showCapital ? '노출' : '숨김'}</strong>
            </div>
            <div className="games-metric games-metric--secondary">
              <span>원장 탭</span>
              <strong>{guidance.showLedger ? '노출' : '숨김'}</strong>
            </div>
          </div>
        </details>
      ) : null}
    </section>
  );
}
