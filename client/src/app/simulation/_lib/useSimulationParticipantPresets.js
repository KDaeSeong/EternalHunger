import { useMemo, useState } from 'react';
import {
  PARTICIPANT_PRESET_SELECTED_KEY,
  RANDOM_PARTICIPANT_PRESET_ID,
  getInitialParticipantPresetId,
  readLocalParticipantPresets,
} from './participantPresetRuntime';
import { createParticipantPresetActionRuntime } from './participantPresetActionRuntime';

function getInitialParticipantPresetName() {
  const selectedId = getInitialParticipantPresetId();
  if (selectedId === RANDOM_PARTICIPANT_PRESET_ID) return '';
  const preset = readLocalParticipantPresets()
    .find((row) => String(row?.id || '') === String(selectedId));
  return preset?.name || '';
}

export function useSimulationParticipantPresets({
  candidateSurvivors,
  day,
  isAdvancing,
  isGameOver,
  matchSec,
  settings,
  survivors,
  actions = {},
} = {}) {
  const [participantPresets, setParticipantPresets] = useState(readLocalParticipantPresets);
  const [selectedParticipantPresetIdRaw, setSelectedParticipantPresetId] = useState(getInitialParticipantPresetId);
  const [participantPresetName, setParticipantPresetName] = useState(getInitialParticipantPresetName);

  const selectedParticipantPresetId = useMemo(() => {
    const rawId = String(selectedParticipantPresetIdRaw || RANDOM_PARTICIPANT_PRESET_ID);
    if (rawId === RANDOM_PARTICIPANT_PRESET_ID) return RANDOM_PARTICIPANT_PRESET_ID;
    return participantPresets.some((preset) => String(preset?.id || '') === rawId)
      ? rawId
      : RANDOM_PARTICIPANT_PRESET_ID;
  }, [participantPresets, selectedParticipantPresetIdRaw]);

  const saveSelectedParticipantPresetId = (presetId) => {
    const nextId = String(presetId || RANDOM_PARTICIPANT_PRESET_ID);
    setSelectedParticipantPresetId(nextId);
    try {
      window.localStorage.setItem(PARTICIPANT_PRESET_SELECTED_KEY, nextId);
    } catch {}
  };

  function getParticipantPresetActions() {
    return createParticipantPresetActionRuntime({
      state: {
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
      },
      actions: {
        ...actions,
        saveSelectedParticipantPresetId,
        setParticipantPresetName,
        setParticipantPresets,
      },
    });
  }

  function applyParticipantPresetToCurrent(presetId = selectedParticipantPresetId) {
    return getParticipantPresetActions().applyParticipantPresetToCurrent(presetId);
  }

  function saveCurrentParticipantPreset() {
    return getParticipantPresetActions().saveCurrentParticipantPreset();
  }

  function deleteSelectedParticipantPreset() {
    return getParticipantPresetActions().deleteSelectedParticipantPreset();
  }

  return {
    applyParticipantPresetToCurrent,
    deleteSelectedParticipantPreset,
    participantPresetName,
    participantPresets,
    saveCurrentParticipantPreset,
    saveSelectedParticipantPresetId,
    selectedParticipantPresetId,
    setParticipantPresetName,
    setParticipantPresets,
    setSelectedParticipantPresetId,
  };
}
