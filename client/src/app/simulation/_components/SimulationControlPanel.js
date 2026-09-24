'use client';

import { useRef } from 'react';
import GameActionIcon from '../../games/_components/GameActionIcon';

function normalizeMode(value) {
  return String(value || '').toLowerCase() === 'solo' ? 'solo' : 'squad';
}

function getProceedLabel({
  mapPreparation,
  evaluationMode,
  draftMode,
  loading,
  isAdvancing,
  startBlocked,
  startBlockedText,
  day,
  phase,
  aliveTeamCount,
}) {
  if (loading) return '로딩 중...';
  if (mapPreparation) return '지도 준비 중...';
  if (isAdvancing) return '진행 중...';
  if (startBlocked) return startBlockedText || '시작 조건 부족';
  if (evaluationMode && !draftMode && Number(day || 0) === 0) return '평가 시작';
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
  settingsContent,
  replayMode,
  draftMode,
  evaluationMode,
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
  autoPlay,
  onToggleAutoPlay,
  autoDisabled,
  mapPreparation,
  autoSpeed,
  onAutoSpeedChange,
  speedDisabled,
}) {
  const settingsRef = useRef(null);
  const closeSettings = () => { if (settingsRef.current) settingsRef.current.open = false; };
  const proceedLabel = getProceedLabel({
    mapPreparation,
    evaluationMode,
    draftMode,
    loading,
    isAdvancing,
    startBlocked,
    startBlockedText,
    day,
    phase,
    aliveTeamCount,
  });
  const isEvaluationStart = evaluationMode && !draftMode && Number(day || 0) === 0 && !isGameOver;

  return (
    <div className="control-panel">
      <div className="control-row">
        {isGameOver ? (
          <button className="btn-restart" type="button" data-game-sfx="start" onClick={onRestart}>
            <GameActionIcon action="reset" label="다시 하기" />다시 하기
          </button>
        ) : (
          <button className="btn-proceed" type="button" data-game-sfx="off"
            onClick={() => { closeSettings(); onProceed?.(); }} disabled={actionDisabled}
            style={{ opacity: actionDisabled ? 0.5 : 1 }}>
            <GameActionIcon action="advance" label={proceedLabel} />{proceedLabel}
          </button>
        )}
        {!isEvaluationStart ? <button className="btn-secondary" type="button"
          data-game-sfx={autoPlay ? 'toggle' : 'start'}
          onClick={() => { closeSettings(); onToggleAutoPlay?.(); }} disabled={autoDisabled}
          title="오토 진행은 다음 페이즈 버튼을 자동으로 눌러 진행합니다.">
          <GameActionIcon action={autoPlay ? 'pause' : 'auto'} label={autoPlay ? '오토 정지' : '오토'} />
          {autoPlay ? '오토 정지' : '오토'}
        </button> : null}
        <select className="autoplay-speed" data-game-sfx-change="select"
          value={autoSpeed} onChange={(event) => onAutoSpeedChange?.(event.target.value)}
          disabled={speedDisabled} title="오토 진행 배속입니다. 최대 32배속까지 지원합니다.">
          {[1, 2, 4, 8, 16, 32].map((speed) => <option key={speed} value={speed}>x{speed}</option>)}
        </select>
      </div>
      {!evaluationMode || draftMode ? <details ref={settingsRef} name="simulation-tools" className="simulation-match-settings"
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || event.target.closest('[role="dialog"]')) return;
          closeSettings();
          settingsRef.current?.querySelector('summary')?.focus();
        }}>
        <summary>경기 설정 <span>{normalizeMode(matchMode) === 'solo' ? '솔로' : '스쿼드'} · 스킬 {characterSkillsEnabled ? '켬' : '끔'}</span></summary>
        <div className="simulation-match-settings-body">
      {!replayMode && !evaluationMode ? <div className="prediction-row">
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
      </div> : null}
      <div className="simulation-match-options">
        {!evaluationMode || draftMode ? <select
          className="autoplay-speed"
          data-game-sfx-change="select"
          value={normalizeMode(matchMode)}
          onChange={(event) => onMatchModeChange?.(event.target.value)}
          disabled={matchModeDisabled}
          title="매치 모드는 게임 시작 전에 변경할 수 있습니다."
        >
          <option value="squad">스쿼드</option>
          <option value="solo">솔로</option>
        </select> : null}

        {!evaluationMode || draftMode ? <label className="sim-skill-toggle" title="캐릭터별 Q/W/E/R 스킬 레이어를 켜거나 끕니다.">
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
        </label> : null}

      </div>
        {settingsContent}
        </div>
      </details> : null}
    </div>
  );
}
