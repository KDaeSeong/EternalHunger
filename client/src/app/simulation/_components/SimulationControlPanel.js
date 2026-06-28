'use client';

function normalizeMode(value) {
  return String(value || '').toLowerCase() === 'solo' ? 'solo' : 'squad';
}

function getProceedLabel({
  loading,
  isAdvancing,
  startBlocked,
  startBlockedText,
  day,
  phase,
  aliveTeamCount,
}) {
  if (loading) return '로딩 중...';
  if (isAdvancing) return '진행 중...';
  if (startBlocked) return startBlockedText || '시작 조건 부족';
  if (Number(day || 0) === 0) return '게임 시작';
  if (Number(aliveTeamCount || 0) <= 1) return '결과 확인하기';
  if (String(phase || '') === 'morning') {
    return Number(day || 0) >= 6 ? '서든데스 진행' : '밤으로 진행';
  }
  return Number(day || 0) >= 6 ? '서든데스 진행' : '다음 낮으로 진행';
}

export default function SimulationControlPanel({
  matchMode,
  onMatchModeChange,
  matchModeDisabled,
  isGameOver,
  onRestart,
  onProceed,
  actionDisabled,
  loading,
  isAdvancing,
  startBlocked,
  startBlockedText,
  day,
  phase,
  aliveTeamCount,
  showMarketPanel,
  onToggleDevTools,
  autoPlay,
  onToggleAutoPlay,
  autoDisabled,
  autoSpeed,
  onAutoSpeedChange,
  speedDisabled,
}) {
  const proceedLabel = getProceedLabel({
    loading,
    isAdvancing,
    startBlocked,
    startBlockedText,
    day,
    phase,
    aliveTeamCount,
  });

  return (
    <div className="control-panel">
      <div className="control-row">
        <select
          className="autoplay-speed"
          value={normalizeMode(matchMode)}
          onChange={(event) => onMatchModeChange?.(event.target.value)}
          disabled={matchModeDisabled}
          title="매치 모드는 게임 시작 전에 변경할 수 있습니다."
        >
          <option value="squad">스쿼드</option>
          <option value="solo">솔로</option>
        </select>

        {isGameOver ? (
          <button className="btn-restart" type="button" onClick={onRestart}>
            다시 하기
          </button>
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
          title="테스트와 수동 조작이 필요할 때만 개발자 도구를 엽니다."
        >
          {showMarketPanel ? '개발자 도구 닫기' : '개발자 도구'}
        </button>

        <button
          className="btn-secondary"
          type="button"
          onClick={onToggleAutoPlay}
          disabled={autoDisabled}
          title="오토 진행은 다음 페이즈 버튼을 자동으로 눌러 진행합니다."
        >
          {autoPlay ? '오토 정지' : '오토'}
        </button>

        <select
          className="autoplay-speed"
          value={autoSpeed}
          onChange={(event) => onAutoSpeedChange?.(event.target.value)}
          disabled={speedDisabled}
          title="오토 진행 배속입니다. 최대 32배속까지 지원합니다."
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
