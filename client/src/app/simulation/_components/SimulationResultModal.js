'use client';

import { buildErBehaviorModifier } from '../../../utils/erMeta';

function saveLabel(value) {
  if (value === 'success') return '완료';
  if (value === 'error') return '실패';
  if (value === 'skipped') return '건너뜀';
  return '대기';
}

function compactText(value) {
  return String(value || '').trim();
}

function DetailRow({ label, children }) {
  if (!children) return null;
  return (
    <div className="result-detail-row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

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

  const ranked = Array.isArray(topRankedCharacters) ? topRankedCharacters.slice(0, 3) : [];
  const winnerKills = winner?._id ? (killCounts?.[winner._id] || 0) : (resultSummary?.myKills || 0);
  const winnerAssists = winner?._id ? (assistCounts?.[winner._id] || 0) : (resultSummary?.myAssists || 0);
  const topKillLeader = resultSummary?.topKillLeader || null;
  const saveStatus = resultSummary?.saveStatus || {};
  const userProgress = resultSummary?.userProgress || null;
  const winnerEr = winner ? buildErBehaviorModifier(winner) : null;
  const winnerErText = winnerEr
    ? [
      winnerEr.role,
      winnerEr.weaponType,
      winnerEr.masteryLevel ? `숙련 Lv.${winnerEr.masteryLevel}` : '',
      winnerEr.traitName,
      winnerEr.weaponSkill,
      winnerEr.signatureName,
    ].map((x) => String(x || '').trim()).filter(Boolean).join(' / ')
    : '';

  const detailCount = [
    specialSourceSummary,
    gainSourceSummary,
    creditSourceSummary,
    gainDetailSummary,
    runSupportSummary?.line,
    runSupportSummary?.combatLine,
    runActionSummary?.line,
    runActionSummary?.chaseLine,
  ].filter(Boolean).length;

  return (
    <div className="result-modal-overlay">
      <div className="result-modal">
        {gameEndReason?.type === 'timelimit6night' ? (
          <div className="result-alert">타임리밋 종료: 6일차 밤 도달</div>
        ) : null}

        <section className="result-hero">
          {winner ? (
            <img src={winner.previewImage || '/Images/default_image.png'} alt="" aria-hidden="true" className="winner-img" />
          ) : null}
          <div className="result-hero-copy">
            <div className="result-kicker">게임 종료</div>
            <h1>{winner ? winner.name : '생존자 없음'}</h1>
            <p>{winner ? '최후의 1인 생존을 축하합니다.' : '이번 경기에는 생존자가 남지 않았습니다.'}</p>
          </div>
        </section>

        {resultSummary ? (
          <section className="result-core">
            <div className="result-core-grid">
              <div>
                <span>참가자</span>
                <strong>{resultSummary.participantsCount || 0}명</strong>
              </div>
              <div>
                <span>우승 보상</span>
                <strong>LP {resultSummary.rewardLP || 0}</strong>
              </div>
              <div>
                <span>우승자 K/A</span>
                <strong>{winnerKills} / {winnerAssists}</strong>
              </div>
              <div>
                <span>최다 킬</span>
                <strong>{topKillLeader ? `${topKillLeader.name} ${topKillLeader.kills || 0}킬` : '-'}</strong>
              </div>
            </div>

            <details className="result-details">
              <summary>상세 통계 {detailCount ? `(${detailCount})` : ''}</summary>
              <div className="result-detail-grid">
                <DetailRow label="저장 상태">
                  명예의 전당 {saveLabel(saveStatus.hallOfFame)} / 유저 전적 {saveLabel(saveStatus.userStats)}
                </DetailRow>
                {userProgress ? (
                  <DetailRow label="누적 전적">
                    {userProgress.statistics?.totalGames || 0}전 / {userProgress.statistics?.totalWins || 0}승 / {userProgress.statistics?.totalKills || 0}킬 · LP {userProgress.lp || 0} · 크레딧 {userProgress.credits || 0}
                  </DetailRow>
                ) : null}
                <DetailRow label="우승자 ER 프로필">{compactText(winnerErText)}</DetailRow>
                <DetailRow label="특수 보상">{compactText(specialSourceSummary)}</DetailRow>
                <DetailRow label="아이템 획득">{compactText(gainSourceSummary)}</DetailRow>
                <DetailRow label="크레딧 획득">{compactText(creditSourceSummary)}</DetailRow>
                <DetailRow label="획득 상세">{compactText(gainDetailSummary)}</DetailRow>
                <DetailRow label="사용/상태">{compactText(runSupportSummary?.line)}</DetailRow>
                <DetailRow label="ER 전투 기여">{compactText(runSupportSummary?.combatLine)}</DetailRow>
                <DetailRow label="주요 전술 스킬">{compactText(runSupportSummary?.topTacticalSkills)}</DetailRow>
                <DetailRow label="주요 무기 스킬">{compactText(runSupportSummary?.topWeaponSkills)}</DetailRow>
                <DetailRow label="주요 소모품">{compactText(runSupportSummary?.topItems)}</DetailRow>
                <DetailRow label="주요 효과">{compactText(runSupportSummary?.topEffects)}</DetailRow>
                <DetailRow label="행동 요약">{compactText(runActionSummary?.line)}</DetailRow>
                <DetailRow label="추격/도주">{compactText(runActionSummary?.chaseLine)}</DetailRow>
                <DetailRow label="추격 지표">{compactText(runActionSummary?.tuningLine)}</DetailRow>
                <DetailRow label="많이 막힌 이유">{compactText(runActionSummary?.topBlocked)}</DetailRow>
                <DetailRow label="자주 밀린 행동">{compactText(runActionSummary?.topDeferred)}</DetailRow>
              </div>
            </details>
          </section>
        ) : null}

        <section className="stats-summary">
          <h3>킬 랭킹 Top 3</h3>
          <ul>
            {ranked.map((char, idx) => (
              <li key={char._id}>
                <span>{idx + 1}위. {char.name}</span>
                <strong>{killCounts?.[char._id] || 0}킬 / {assistCounts?.[char._id] || 0}어시</strong>
              </li>
            ))}
          </ul>
        </section>

        <button className="close-btn" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
