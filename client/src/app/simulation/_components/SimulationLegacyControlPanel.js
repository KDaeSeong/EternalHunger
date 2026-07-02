'use client';

function getLegacyProceedLabel({
  aliveTeamCount,
  day,
  isAdvancing,
  loading,
  phase,
  startBlocked,
  startBlockedText,
}) {
  if (loading) return '⏳ 로딩 중...';
  if (isAdvancing) return '⏩ 진행 중...';
  if (startBlocked) return startBlockedText;
  if (day === 0) return '🔥 게임 시작';
  if (aliveTeamCount <= 1) return '🏆 결과 확인하기';
  if (phase === 'morning') return day >= 6 ? '🔥 서든데스 진행' : '🌙 밤으로 진행';
  return day >= 6 ? '🔥 서든데스 진행' : '🌞 다음 날 낮으로 진행';
}

export default function SimulationLegacyControlPanel({
  actionDisabled,
  aliveTeamCount,
  autoDisabled,
  autoPlay,
  autoSpeed,
  day,
  isAdvancing,
  isGameOver,
  loading,
  matchMode,
  matchModeDisabled,
  onAutoSpeedChange,
  onMatchModeChange,
  onProceed,
  onRestart,
  onToggleAutoPlay,
  onToggleDevTools,
  phase,
  showMarketPanel,
  speedDisabled,
  startBlocked,
  startBlockedText,
}) {
  const proceedLabel = getLegacyProceedLabel({
    aliveTeamCount,
    day,
    isAdvancing,
    loading,
    phase,
    startBlocked,
    startBlockedText,
  });

  return (
    <div className="control-panel" style={{ display: 'none' }} aria-hidden="true">
      <div className="control-row">
        <select
          className="autoplay-speed"
          value={matchMode}
          onChange={(event) => onMatchModeChange?.(event.target.value)}
          disabled={matchModeDisabled}
          title="매치 모드: 시작 전 변경 가능"
        >
          <option value="squad">스쿼드</option>
          <option value="solo">솔로</option>
        </select>

        {isGameOver ? (
          <button className="btn-restart" type="button" onClick={onRestart}>🔄 다시 하기</button>
        ) : (
          <button
            className="btn-proceed"
            type="button"
            onClick={onProceed}
            disabled={actionDisabled}
            style={{ opacity: actionDisabled ? 0.5 : 1 }}
          >
            {proceedLabel}
          </button>
        )}

        <button
          className={`btn-secondary sim-devtools-control ${showMarketPanel ? 'active' : ''}`}
          type="button"
          onClick={onToggleDevTools}
          title="관전자 모드에서는 기본적으로 숨겨두고, 테스트할 때만 열어쓰세요."
        >
          {showMarketPanel ? '🛠 개발자 도구 닫기' : '🛠 개발자 도구'}
        </button>

        <button
          className="btn-secondary"
          type="button"
          onClick={onToggleAutoPlay}
          disabled={autoDisabled}
          title="오토 플레이: 다음 페이즈 버튼을 자동으로 눌러 진행합니다(페이즈 내부는 틱 엔진으로 계산)."
        >
          {autoPlay ? '⏸ 오토' : '▶ 오토'}
        </button>

        <select
          className="autoplay-speed"
          value={autoSpeed}
          onChange={(event) => onAutoSpeedChange?.(event.target.value)}
          disabled={speedDisabled}
          title="오토 플레이 배속: 1초 틱 기준으로 최대 32배속까지 진행합니다."
        >
          <option value={1}>x1</option>
          <option value={2}>x2</option>
          <option value={4}>x4</option>
          <option value={8}>x8</option>
          <option value={16}>x16</option>
          <option value={32}>x32</option>
        </select>
      </div>
    </div>
  );
}
