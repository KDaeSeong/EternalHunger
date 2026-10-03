import { calendarSummary, formatMoney } from './companyReportEngine';

export function buildCompanyReportExportBaseName(state) {
  return `company-report-${state.company.year}-${String(state.company.month).padStart(2, '0')}`;
}

export function buildCompanyReportMetrics({
  capitalSummary,
  globalSummary,
  guidance,
  report,
  reportTrend,
  score,
  state,
}) {
  return [
    { label: '도움말', value: guidance.levelShortLabel },
    { label: '회사', value: state.company.name },
    { label: '날짜', value: calendarSummary(state).currentDate },
    { label: '현금', value: formatMoney(state.company.cashKrw) },
    { label: '채권', value: formatMoney(report.receivableAmount) },
    { label: '외화채권', value: formatMoney(globalSummary.openForeignReceivableKrw) },
    { label: '주가', value: formatMoney(capitalSummary.sharePrice) },
    { label: '스냅샷', value: state.ledgerSnapshots.length },
    { label: '북마크', value: state.reportBookmarks.length },
    { label: '내보내기', value: state.exportHistory.length },
    { label: '이력', value: `${reportTrend.archiveScore}%` },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];
}

export function buildCompanyReportMessages({
  capitalSummary,
  hydrated,
  message,
  report,
  token,
}) {
  return [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 플레이는 가능하지만 저장, 불러오기, 전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    report.openReceivables >= 3 ? { key: 'ar-risk', tone: 'error', text: '미수 채권이 많습니다. 결제일이 지난 채권을 회수하고, 아직 기한이 남은 대금은 현금 계획에 반영하세요.' } : null,
    capitalSummary.disclosureRisk >= 35 ? { key: 'disclosure-risk', tone: 'error', text: '공시위험이 높습니다. 상장 월마감 전 공시 대응을 권장합니다.' } : null,
  ];
}
