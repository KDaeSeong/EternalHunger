'use client';

export default function SimulationResultModal({
  open,
  gameEndReason,
  winner,
  resultSummary,
  specialSourceSummary,
  gainSourceSummary,
  creditSourceSummary,
  gainDetailSummary,
  runSupportSummary,
  runActionSummary,
  topRankedCharacters,
  killCounts,
  assistCounts,
  onClose,
}) {
  if (!open) return null;

  const ranked = Array.isArray(topRankedCharacters) ? topRankedCharacters : [];

  return (
    <div className="result-modal-overlay">
      <div className="result-modal">
        <h1>게임 종료</h1>
        {gameEndReason?.type === 'timelimit6night' ? (
          <div
            style={{
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(255, 120, 120, 0.6)',
              background: 'rgba(30, 10, 10, 0.55)',
              color: '#ffdfdf',
              fontWeight: 800,
              textAlign: 'center',
            }}
          >
            타임리밋 종료: 6일차 밤 도달
          </div>
        ) : null}

        {winner ? (
          <div className="winner-section">
            <img src={winner.previewImage || '/Images/default_image.png'} alt="우승자" className="winner-img" />
            <h2>{winner.name}</h2>
            <p>최후의 1인! 생존을 축하합니다!</p>
          </div>
        ) : (
          <h2>생존자가 없습니다...</h2>
        )}

        {resultSummary ? (
          <div
            style={{
              marginTop: 14,
              marginBottom: 14,
              padding: '12px 14px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.04)',
              display: 'grid',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <strong>참가자 {resultSummary.participantsCount || 0}명</strong>
              <span>우승 보상 LP {resultSummary.rewardLP || 0}</span>
              <span>우승자 킬/어시 {resultSummary.myKills || 0}/{resultSummary.myAssists || 0}</span>
            </div>

            {resultSummary.topKillLeader ? (
              <div style={{ color: '#ffd54f' }}>
                최다 킬: {resultSummary.topKillLeader.name} ({resultSummary.topKillLeader.kills || 0}킬 / {resultSummary.topKillLeader.assists || 0}어시)
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 13, opacity: 0.92 }}>
              <span>명예의 전당 저장: {resultSummary.saveStatus?.hallOfFame === 'success' ? '완료' : resultSummary.saveStatus?.hallOfFame === 'error' ? '실패' : resultSummary.saveStatus?.hallOfFame === 'skipped' ? '건너뜀' : '대기'}</span>
              <span>유저 전적 저장: {resultSummary.saveStatus?.userStats === 'success' ? '완료' : resultSummary.saveStatus?.userStats === 'error' ? '실패' : '대기'}</span>
            </div>

            {resultSummary.userProgress ? (
              <div style={{ fontSize: 13, opacity: 0.92 }}>
                누적 전적: {resultSummary.userProgress.statistics?.totalGames || 0}전 / {resultSummary.userProgress.statistics?.totalWins || 0}승 / {resultSummary.userProgress.statistics?.totalKills || 0}킬 · 현재 LP {resultSummary.userProgress.lp || 0} · 크레딧 {resultSummary.userProgress.credits || 0}
              </div>
            ) : null}

            <details className="result-details">
              <summary>상세 통계</summary>
              <div className="result-detail-grid">
                {specialSourceSummary ? <div>특수 보상: {specialSourceSummary}</div> : null}
                {gainSourceSummary ? <div>아이템 경로: {gainSourceSummary}</div> : null}
                {creditSourceSummary ? <div>크레딧 경로: {creditSourceSummary}</div> : null}
                {gainDetailSummary ? <div>{gainDetailSummary}</div> : null}
                {runSupportSummary?.line ? <div>사용/상태: {runSupportSummary.line}</div> : null}
                {runSupportSummary?.topItems ? <div>소모품: {runSupportSummary.topItems}</div> : null}
                {runSupportSummary?.topEffects ? <div>효과: {runSupportSummary.topEffects}</div> : null}
                {runActionSummary?.line ? <div>행동 큐: {runActionSummary.line}</div> : null}
                {runActionSummary?.chaseLine ? <div>추격/도주: {runActionSummary.chaseLine}</div> : null}
                {runActionSummary?.tuningLine ? <div>추격 지표: {runActionSummary.tuningLine}</div> : null}
                {runActionSummary?.topBlocked ? <div>막힌 이유: {runActionSummary.topBlocked}</div> : null}
                {runActionSummary?.topDeferred ? <div>밀린 행동: {runActionSummary.topDeferred}</div> : null}
              </div>
            </details>
          </div>
        ) : null}

        <div className="stats-summary">
          <h3>킬 랭킹 (Top 3)</h3>
          <ul>
            {ranked.map((char, idx) => (
              <li key={char._id}>
                <span>{idx + 1}위. {char.name}</span>
                <strong>{killCounts?.[char._id] || 0} 킬 / {assistCounts?.[char._id] || 0} 어시</strong>
              </li>
            ))}
          </ul>
        </div>

        <button className="close-btn" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
