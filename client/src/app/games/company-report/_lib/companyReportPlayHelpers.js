import { GLOBAL_MARKETS, PRODUCTS, formatMoney, reportSummary } from './companyReportEngine';

export function StatusBadge({ value }) {
  const tone = value === 'COLLECTED' || value === 'COMPLETED' || value === 'PAID' || value === 'NO_TAX' ? '통과' : value === 'OVERDUE' ? '위험' : '진행';
  return <span className="game-save-chip">{tone} {value}</span>;
}

export function getMarketName(id) {
  return GLOBAL_MARKETS.find((market) => market.id === id)?.name || id;
}

export function getProductName(id) {
  return PRODUCTS.find((product) => product.id === id)?.name || id;
}

export function safeFilePart(value) {
  return String(value || 'export').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'export';
}

export function downloadTextFile(fileName, text, type) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type });
  const url = window.URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvRows(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function actionFeedbackText(previous, next, label, fallback = '') {
  const latestLog = next.log?.[0];
  if (latestLog && latestLog !== previous.log?.[0]) return latestLog;

  const before = reportSummary(previous);
  const after = reportSummary(next);
  const cashDelta = Number(next.company?.cashKrw || 0) - Number(previous.company?.cashKrw || 0);
  const receivableDelta = Number(after.receivableAmount || 0) - Number(before.receivableAmount || 0);
  const inventoryDelta = Number(after.inventoryAmount || 0) - Number(before.inventoryAmount || 0);
  const parts = [];
  if (cashDelta) parts.push(`현금 ${cashDelta >= 0 ? '+' : ''}${formatMoney(cashDelta)}`);
  if (receivableDelta) parts.push(`채권 ${receivableDelta >= 0 ? '+' : ''}${formatMoney(receivableDelta)}`);
  if (inventoryDelta) parts.push(`재고 ${inventoryDelta >= 0 ? '+' : ''}${formatMoney(inventoryDelta)}`);
  if (parts.length) return `${label}: ${parts.join(' · ')}`;
  return fallback || `${label} 처리했습니다.`;
}
