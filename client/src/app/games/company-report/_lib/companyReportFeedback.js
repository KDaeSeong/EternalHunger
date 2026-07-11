import { inferGameActionSemantic } from '../../_lib/gameActionSemantics';

const FAILURE_TERMS = [
  '부족',
  '없습니다',
  '필요합니다',
  '불가',
  '실패',
  '초과',
  '먼저',
];

const RESULT_CUE_RULES = [
  { cue: 'ledgerClose', terms: ['월말 결산', '자본시장 월마감'] },
  { cue: 'taxPaid', terms: ['vat 납부'] },
  { cue: 'globalSettle', terms: ['글로벌 정산'] },
  { cue: 'cashCollect', terms: ['채권 회수', '외화채권 회수'] },
  { cue: 'orderComplete', terms: ['주문 생성', '주문 출고'] },
  { cue: 'craftComplete', terms: ['생산 입고'] },
  { cue: 'sales', terms: ['상품 캠페인'] },
  { cue: 'capitalAction', terms: ['공시 대응', '배당 결정', '자금 조달'] },
  { cue: 'contract', terms: ['수출 계획', '수입 계획', '환헤지'] },
  { cue: 'settle', terms: ['재고평가'] },
  { cue: 'archive', terms: ['스냅샷', '북마크', '내보내기', '다운로드'] },
  { cue: 'sync', terms: ['복원'] },
];

export function companyReportResultCue(label, previous, next) {
  const latestLog = String(next?.log?.[0] || '');
  const previousLog = String(previous?.log?.[0] || '');
  const normalized = `${label || ''} ${latestLog}`.toLowerCase();

  if (latestLog !== previousLog && FAILURE_TERMS.some((term) => normalized.includes(term))) {
    return 'warning';
  }

  const matched = RESULT_CUE_RULES.find((rule) => rule.terms.some((term) => normalized.includes(term)));
  if (matched) return matched.cue;
  return inferGameActionSemantic(label, latestLog).cue;
}
