import { uniqStr } from './simulationCommon';

export const PARTICIPANT_PRESET_STORAGE_KEY = 'eh_participant_presets_v1';
export const PARTICIPANT_PRESET_SELECTED_KEY = 'eh_participant_preset_selected_v1';
export const PARTICIPANT_PRESET_LIMIT = 10;
export const PARTICIPANT_PRESET_SIZE = 24;
export const RANDOM_PARTICIPANT_PRESET_ID = '__random__';
export const CUSTOM_PARTICIPANT_PRESET_ID = '__custom__';

export function normalizeParticipantPresetIds(ids) {
  return uniqStr(Array.isArray(ids) ? ids : []).slice(0, PARTICIPANT_PRESET_SIZE);
}

export function normalizeParticipantPreset(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const characterIds = normalizeParticipantPresetIds(raw.characterIds || raw.ids || []);
  if (characterIds.length <= 0) return null;
  const now = Date.now();
  const id = String(raw.id || `preset-${now}-${index}`).trim();
  return {
    id,
    name: String(raw.name || `프리셋 ${index + 1}`).trim() || `프리셋 ${index + 1}`,
    characterIds,
    matchMode: String(raw.matchMode || '').trim(),
    createdAt: Number(raw.createdAt || now),
    updatedAt: Number(raw.updatedAt || raw.createdAt || now),
  };
}

export function normalizeParticipantPresetList(value) {
  const normalized = (Array.isArray(value) ? value : [])
    .map((row, index) => normalizeParticipantPreset(row, index))
    .filter(Boolean);
  const custom = normalized.find((preset) => preset.id === CUSTOM_PARTICIPANT_PRESET_ID) || null;
  const userPresets = normalized
    .filter((preset) => preset.id !== CUSTOM_PARTICIPANT_PRESET_ID)
    .slice(0, PARTICIPANT_PRESET_LIMIT);
  return custom ? [custom, ...userPresets] : userPresets;
}

export function readLocalParticipantPresets() {
  try {
    if (typeof localStorage === 'undefined') return [];
    return normalizeParticipantPresetList(JSON.parse(localStorage.getItem(PARTICIPANT_PRESET_STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function writeLocalParticipantPresets(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PARTICIPANT_PRESET_STORAGE_KEY, JSON.stringify(normalizeParticipantPresetList(list)));
  } catch {
    // ignore local storage failures
  }
}

export function getInitialParticipantPresetId() {
  try {
    if (typeof localStorage === 'undefined') return RANDOM_PARTICIPANT_PRESET_ID;
    return localStorage.getItem(PARTICIPANT_PRESET_SELECTED_KEY) || RANDOM_PARTICIPANT_PRESET_ID;
  } catch {
    return RANDOM_PARTICIPANT_PRESET_ID;
  }
}
