'use client';

export default function SimulationForbiddenStatusBar({
  detonationRiskSummary,
  forbiddenAddedNow,
  getZoneName,
}) {
  if (!detonationRiskSummary?.visible) return null;

  return (
    <div className="forbidden-top-bar">
      <span className="fz-title">🚫 금지구역</span>
      <span className="fz-chip" title="6번째 밤부터 안전구역을 단계적으로 줄입니다. 각 팀은 직접 이동하며, 마지막 팀이 남으면 종료됩니다.">
        🔥 최종 구역 축소: <b>6번째 밤 이후</b>
      </span>
      <span className="fz-chip" title={detonationRiskSummary?.fzHoverText || '현재 금지구역 없음'}>
        금지 <b>{detonationRiskSummary?.forbiddenCnt || 0}</b> / 전체 <b>{detonationRiskSummary?.total || 0}</b> · 안전 <b>{detonationRiskSummary?.safeLeft || 0}</b>
      </span>
      <span
        className={`fz-chip ${(detonationRiskSummary?.riskyCount || 0) > 0 ? 'fz-danger' : ''}`}
        title={detonationRiskSummary?.riskyTitle || '폭발 타이머 임계치 이하 생존자 수'}
      >
        ⚠️ 위험 <b>{detonationRiskSummary?.riskyCount || 0}</b>명
      </span>
      {Array.isArray(forbiddenAddedNow) && forbiddenAddedNow.length ? (
        <span className="fz-chip fz-danger" title={`이번 진행에서 새로 금지된 구역: ${forbiddenAddedNow.map((z) => getZoneName(z)).join(', ')}`}>
          +{forbiddenAddedNow.length} 신규 금지
        </span>
      ) : null}
      {detonationRiskSummary?.allZonesClosed ? (
        <span className="fz-chip fz-danger" title="마지막 안전구역이 폐쇄되어 현재 모든 지역에 구역 위험이 적용됩니다.">
          ☢️ 전지역 폐쇄
        </span>
      ) : null}
    </div>
  );
}
