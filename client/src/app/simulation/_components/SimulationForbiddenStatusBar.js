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
      <span className="fz-chip" title="6번째 밤부터는 교전을 강하게 유도(서든데스)하고, 마지막 1명 생존 시 게임이 종료됩니다.">
        🔥 서든데스: <b>6번째 밤 이후</b>
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
      {detonationRiskSummary?.willForceAllThisPhase ? (
        <span className="fz-chip fz-danger" title="안전구역이 1~2개 남은 상태에서 현 페이즈 길이가 기준 이상이면 폭발이 전 구역에 적용됩니다.">
          ☢️ 이번 페이즈 전구역 폭발 가능
        </span>
      ) : null}
    </div>
  );
}
