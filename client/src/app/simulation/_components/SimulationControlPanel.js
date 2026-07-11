'use client';

import GameActionIcon from '../../games/_components/GameActionIcon';

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

function getActorId(actor) {
  return String(actor?._id || actor?.id || actor?.charId || '').trim();
}

function getPredictionLabel(actor, matchMode) {
  const name = String(actor?.name || actor?.nickname || actor?.charName || '이름 없음').trim();
  if (normalizeMode(matchMode) === 'solo') return name;
  const teamName = String(actor?.teamName || actor?.squadName || actor?.matchTeamName || '').trim();
  return teamName ? `${name} · ${teamName}` : name;
}

export default function SimulationControlPanel({
  matchMode,
  onMatchModeChange,
  matchModeDisabled,
  matchSec,
  survivors,
  winnerPredictionId,
  onWinnerPredictionChange,
  winnerPredictionDisabled,
  characterSkillsEnabled,
  onCharacterSkillsToggle,
  characterSkillsDisabled,
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
      <div className="prediction-row">
        <label className="winner-prediction-control">
          <span className="sim-icon-label">
            <GameActionIcon action="trophy" label="승자 예측" />
            승자 예측
          </span>
          <select
            data-game-sfx-change="select"
            value={winnerPredictionId || ''}
            onChange={(event) => onWinnerPredictionChange?.(event.target.value)}
            disabled={winnerPredictionDisabled}
            title="경기 시작 전에 우승자를 예측하면 성공 시 LP 100을 추가로 받습니다."
          >
            <option value="">예측 안 함</option>
            {(Array.isArray(survivors) ? survivors : []).map((actor) => {
              const id = getActorId(actor);
              if (!id) return null;
              return (
                <option value={id} key={id}>
                  {getPredictionLabel(actor, matchMode)}
                </option>
              );
            })}
          </select>
        </label>
        <span className="winner-prediction-help">
          기본 50 LP · 예측 성공 +100 LP{Number(matchSec || 0) > 0 ? ' · 경기 시작 후 변경 불가' : ''}
        </span>
      </div>
      <div className="control-row">
        <select
          className="autoplay-speed"
          data-game-sfx-change="select"
          value={normalizeMode(matchMode)}
          onChange={(event) => onMatchModeChange?.(event.target.value)}
          disabled={matchModeDisabled}
          title="매치 모드는 게임 시작 전에 변경할 수 있습니다."
        >
          <option value="squad">스쿼드</option>
          <option value="solo">솔로</option>
        </select>

        <label className="sim-skill-toggle" title="캐릭터별 Q/W/E/R 스킬 레이어를 켜거나 끕니다.">
          <input
            type="checkbox"
            data-game-sfx-change="toggle"
            checked={!!characterSkillsEnabled}
            onChange={(event) => onCharacterSkillsToggle?.(event.target.checked)}
            disabled={characterSkillsDisabled}
          />
          <span className="sim-icon-label">
            <GameActionIcon action="skill" label="캐릭터 스킬" />
            캐릭터 스킬
          </span>
        </label>

        {isGameOver ? (
          <button className="btn-restart" type="button" data-game-sfx="start" onClick={onRestart}>
            <GameActionIcon action="reset" label="다시 하기" />
            다시 하기
          </button>
        ) : (
          <button
            className="btn-proceed"
            type="button"
            data-game-sfx="advance"
            onClick={onProceed}
            disabled={actionDisabled}
            style={{ opacity: actionDisabled ? 0.5 : 1 }}
          >
            <GameActionIcon action="advance" label={proceedLabel} />
            {proceedLabel}
          </button>
        )}

        <button
          className={`btn-secondary sim-devtools-control ${showMarketPanel ? 'active' : ''}`}
          type="button"
          data-game-sfx="toggle"
          onClick={onToggleDevTools}
          title="테스트와 수동 조작이 필요할 때만 개발자 도구를 엽니다."
        >
          <GameActionIcon action="settings" label="개발자 도구" />
          {showMarketPanel ? '개발자 도구 닫기' : '개발자 도구'}
        </button>

        <button
          className="btn-secondary"
          type="button"
          data-game-sfx={autoPlay ? 'toggle' : 'start'}
          onClick={onToggleAutoPlay}
          disabled={autoDisabled}
          title="오토 진행은 다음 페이즈 버튼을 자동으로 눌러 진행합니다."
        >
          <GameActionIcon action={autoPlay ? 'pause' : 'auto'} label={autoPlay ? '오토 정지' : '오토'} />
          {autoPlay ? '오토 정지' : '오토'}
        </button>

        <select
          className="autoplay-speed"
          data-game-sfx-change="select"
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
