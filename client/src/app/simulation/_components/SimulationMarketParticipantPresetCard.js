'use client';

import {
  CUSTOM_PARTICIPANT_PRESET_ID,
  PARTICIPANT_PRESET_LIMIT,
  RANDOM_PARTICIPANT_PRESET_ID,
  normalizeParticipantPresetIds,
} from '../_lib/participantPresetRuntime';

export default function SimulationMarketParticipantPresetCard({
  applyParticipantPresetToCurrent,
  candidateSurvivors,
  day,
  deleteSelectedParticipantPreset,
  isAdvancing,
  isGameOver,
  matchSec,
  participantPresetName,
  participantPresets,
  saveCurrentParticipantPreset,
  saveSelectedParticipantPresetId,
  selectedParticipantPresetId,
  setParticipantPresetName,
  survivors,
}) {
  const presets = Array.isArray(participantPresets) ? participantPresets : [];
  const userPresetCount = presets.filter((preset) => String(preset?.id || '') !== CUSTOM_PARTICIPANT_PRESET_ID).length;

  return (
    <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
      <div className="market-title">👥 참가자 프리셋</div>
      <div className="market-small">
        기본은 무작위 24명입니다. 현재 참가자 24명을 최대 {PARTICIPANT_PRESET_LIMIT}개까지 저장해 시작 전에 적용할 수 있습니다.
      </div>
      <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
        <select
          value={selectedParticipantPresetId}
          onChange={(e) => {
            const id = e.target.value;
            saveSelectedParticipantPresetId(id);
            const preset = presets.find((row) => String(row?.id || '') === String(id));
            setParticipantPresetName(preset?.name || '');
          }}
          style={{ width: '100%' }}
          disabled={isAdvancing || isGameOver}
        >
          <option value={RANDOM_PARTICIPANT_PRESET_ID}>무작위 24명</option>
          {presets.map((preset, index) => (
            <option key={preset.id} value={preset.id}>
              {preset.name || `프리셋 ${index + 1}`} ({normalizeParticipantPresetIds(preset.characterIds).length}명)
            </option>
          ))}
        </select>
        <button
          className="market-mini-btn"
          onClick={() => applyParticipantPresetToCurrent(selectedParticipantPresetId)}
          disabled={isAdvancing || isGameOver || day !== 0 || matchSec !== 0}
          title={(day !== 0 || matchSec !== 0) ? '게임 시작 전에만 적용할 수 있습니다.' : ''}
        >
          적용
        </button>
      </div>
      <div className="market-row" style={{ marginTop: 8, gap: 8 }}>
        <input
          value={participantPresetName}
          onChange={(e) => setParticipantPresetName(e.target.value)}
          placeholder="프리셋 이름"
          style={{ width: '100%' }}
          disabled={isAdvancing || isGameOver}
        />
        <button
          className="market-mini-btn"
          onClick={saveCurrentParticipantPreset}
          disabled={isAdvancing || isGameOver || !survivors.length}
          title="현재 참가자 목록을 저장합니다."
        >
          저장
        </button>
        <button
          className="market-mini-btn"
          onClick={deleteSelectedParticipantPreset}
          disabled={isAdvancing || isGameOver || selectedParticipantPresetId === RANDOM_PARTICIPANT_PRESET_ID}
        >
          삭제
        </button>
      </div>
      <div className="market-small" style={{ marginTop: 6 }}>
        저장됨: <strong>{userPresetCount}</strong>/{PARTICIPANT_PRESET_LIMIT}
        {' · '}후보: <strong>{(Array.isArray(candidateSurvivors) && candidateSurvivors.length) || survivors.length}</strong>명
      </div>
    </div>
  );
}
