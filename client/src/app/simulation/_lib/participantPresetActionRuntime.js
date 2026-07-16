import {
  CUSTOM_PARTICIPANT_PRESET_ID,
  PARTICIPANT_PRESET_LIMIT,
  RANDOM_PARTICIPANT_PRESET_ID,
  normalizeParticipantPresetIds,
  normalizeParticipantPresetList,
  writeLocalParticipantPresets,
} from './participantPresetRuntime';
import {
  applyMatchTeams,
  buildCustomParticipantsForRun,
  getMatchConfig,
  pickParticipantsForRun,
} from './matchRosterRuntime';
import { getRuntimeActorKey } from './runtimeParticipantRuntime';

export function createParticipantPresetActionRuntime(context = {}) {
  const state = context.state || {};
  const actions = context.actions || {};

  const {
    candidateSurvivors,
    day,
    isAdvancing,
    isGameOver,
    matchSec,
    participantPresetName,
    participantPresets,
    selectedParticipantPresetId,
    settings,
    survivors,
  } = state;

  const {
    saveSelectedParticipantPresetId = () => {},
    setAssistCounts = () => {},
    setDead = () => {},
    setKillCounts = () => {},
    setMarketMessage = () => {},
    setParticipantPresetName = () => {},
    setParticipantPresets = () => {},
    setParticipantSelectionMode = () => {},
    setSelectedCharId = () => {},
    setSurvivors = () => {},
    setWinnerPredictionId = () => {},
  } = actions;

  function commitParticipants(assigned) {
    const kills = {};
    const assists = {};
    const shouldTrackAssists = getMatchConfig(settings).matchMode !== 'solo';
    assigned.forEach((actor) => {
      const key = getRuntimeActorKey(actor);
      if (!key) return;
      kills[key] = 0;
      if (shouldTrackAssists) assists[key] = 0;
    });

    setSurvivors(assigned);
    setDead([]);
    setKillCounts(kills);
    setAssistCounts(assists);
    setSelectedCharId(assigned[0]?._id || assigned[0]?.id || '');
    setWinnerPredictionId('');
  }

  function applyParticipantPresetToCurrent(presetId = selectedParticipantPresetId) {
    if (day !== 0 || matchSec !== 0 || isAdvancing || isGameOver) {
      setMarketMessage('참가자 프리셋은 게임 시작 전(0일차 00초)에만 적용할 수 있습니다.');
      return;
    }

    const pool = (Array.isArray(candidateSurvivors) && candidateSurvivors.length)
      ? candidateSurvivors
      : survivors;
    const picked = pickParticipantsForRun(pool, participantPresets, presetId, settings);
    const assigned = applyMatchTeams(picked, settings);
    commitParticipants(assigned);
    setParticipantSelectionMode(
      presetId === RANDOM_PARTICIPANT_PRESET_ID
        ? 'random'
        : presetId === CUSTOM_PARTICIPANT_PRESET_ID
          ? 'custom'
          : 'preset'
    );
    saveSelectedParticipantPresetId(presetId);
    setMarketMessage(
      presetId === RANDOM_PARTICIPANT_PRESET_ID
        ? `무작위 참가자 ${assigned.length}명을 다시 구성했습니다.`
        : `참가자 프리셋을 적용했습니다. (${assigned.length}명)`
    );
    return { ok: true, participants: assigned };
  }

  function applyCustomParticipantRoster(draft = {}) {
    if (day !== 0 || matchSec !== 0 || isAdvancing || isGameOver) {
      const message = '사용자 지정 편성은 게임 시작 전 0일차 00초에만 적용할 수 있습니다.';
      setMarketMessage(message);
      return { ok: false, errors: [message], participants: [] };
    }

    const pool = (Array.isArray(candidateSurvivors) && candidateSurvivors.length)
      ? candidateSurvivors
      : survivors;
    const result = buildCustomParticipantsForRun(pool, draft, settings);
    if (!result.ready) {
      setMarketMessage(result.errors[0] || '사용자 지정 편성을 완료할 수 없습니다.');
      return { ...result, ok: false };
    }

    commitParticipants(result.participants);
    const now = Date.now();
    const currentPresets = normalizeParticipantPresetList(participantPresets);
    const previousCustom = currentPresets.find((preset) => preset.id === CUSTOM_PARTICIPANT_PRESET_ID);
    const customPreset = {
      id: CUSTOM_PARTICIPANT_PRESET_ID,
      name: '사용자 지정 24인',
      characterIds: result.orderedCharacterIds,
      matchMode: getMatchConfig(settings).matchMode,
      createdAt: Number(previousCustom?.createdAt || now),
      updatedAt: now,
    };
    const nextPresets = normalizeParticipantPresetList([
      customPreset,
      ...currentPresets.filter((preset) => preset.id !== CUSTOM_PARTICIPANT_PRESET_ID),
    ]);
    writeLocalParticipantPresets(nextPresets);
    setParticipantPresets(nextPresets);
    saveSelectedParticipantPresetId(CUSTOM_PARTICIPANT_PRESET_ID);
    setParticipantPresetName(customPreset.name);
    setParticipantSelectionMode('custom');
    setMarketMessage(
      getMatchConfig(settings).matchMode === 'squad'
        ? '사용자 지정 24인 편성을 적용했습니다. (8팀 · 팀당 3명)'
        : '사용자 지정 24인 솔로 편성을 적용했습니다.'
    );
    return { ...result, ok: true };
  }

  function saveCurrentParticipantPreset() {
    const ids = normalizeParticipantPresetIds((Array.isArray(survivors) ? survivors : []).map((actor) => getRuntimeActorKey(actor)));
    if (ids.length < 2) {
      setMarketMessage('저장할 참가자가 부족합니다.');
      return;
    }

    const now = Date.now();
    const existingId = selectedParticipantPresetId !== RANDOM_PARTICIPANT_PRESET_ID ? String(selectedParticipantPresetId || '') : '';
    const currentName = String(participantPresetName || '').trim();
    const list = normalizeParticipantPresetList(participantPresets);
    const existingIndex = existingId ? list.findIndex((preset) => String(preset?.id || '') === existingId) : -1;
    const userPresetCount = list.filter((preset) => preset.id !== CUSTOM_PARTICIPANT_PRESET_ID).length;
    if (existingIndex < 0 && userPresetCount >= PARTICIPANT_PRESET_LIMIT) {
      setMarketMessage(`참가자 프리셋은 최대 ${PARTICIPANT_PRESET_LIMIT}개까지 저장할 수 있습니다.`);
      return;
    }

    const previous = existingIndex >= 0 ? list[existingIndex] : null;
    const nextPreset = {
      id: previous?.id || `preset-${now}`,
      name: currentName || previous?.name || `프리셋 ${Math.min(list.length + 1, PARTICIPANT_PRESET_LIMIT)}`,
      characterIds: ids,
      matchMode: getMatchConfig(settings).matchMode,
      createdAt: Number(previous?.createdAt || now),
      updatedAt: now,
    };
    const next = existingIndex >= 0
      ? list.map((preset, index) => (index === existingIndex ? nextPreset : preset))
      : [...list, nextPreset];
    writeLocalParticipantPresets(next);
    setParticipantPresets(next);
    saveSelectedParticipantPresetId(nextPreset.id);
    setParticipantPresetName(nextPreset.name);
    setMarketMessage(`참가자 프리셋을 저장했습니다. (${ids.length}명)`);
  }

  function deleteSelectedParticipantPreset() {
    if (selectedParticipantPresetId === RANDOM_PARTICIPANT_PRESET_ID) return;
    const id = String(selectedParticipantPresetId || '');
    const next = normalizeParticipantPresetList(participantPresets).filter((preset) => String(preset?.id || '') !== id);
    writeLocalParticipantPresets(next);
    setParticipantPresets(next);
    saveSelectedParticipantPresetId(RANDOM_PARTICIPANT_PRESET_ID);
    setParticipantPresetName('');
    setMarketMessage('참가자 프리셋을 삭제했습니다.');
  }

  return {
    applyCustomParticipantRoster,
    applyParticipantPresetToCurrent,
    deleteSelectedParticipantPreset,
    saveCurrentParticipantPreset,
  };
}
