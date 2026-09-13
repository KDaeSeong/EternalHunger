export function describeDimensionRiftMatchClosure(summary) {
  if (!summary) return '';
  const details = [];
  if (summary.expiredWorldGifts > 0) details.push(`미수령 선물 ${summary.expiredWorldGifts}개 만료(아이템·연계 크레딧 미지급)`);
  if (summary.expiredForElimination > 0) details.push(`그중 수령자 전원 부활 불가로 경기 중 만료 ${summary.expiredForElimination}개`);
  if (summary.unfinishedContests > 0) details.push(`미결정 전장 ${summary.unfinishedContests}곳 종료(승리 보상 없음)`);
  if (summary.invalidRewards > 0) details.push(`보상 기록 오류 ${summary.invalidRewards}건 미지급·재지급 차단`);
  return details.length ? `🌀 경기 종료 정산: ${details.join(' · ')}` : '';
}

export function describeDimensionRiftRewardClosure(closure) {
  if (closure?.disposition !== 'expired') return '차원의 틈 보상 기록 오류 · 재지급 차단';
  const reason = closure.reason === 'recipients_eliminated' ? '수령자 전원 탈락 · 부활 불가' : '경기 종료';
  return `차원의 틈 미수령 선물 만료 · ${reason} · 아이템·연계 크레딧 미지급`;
}
