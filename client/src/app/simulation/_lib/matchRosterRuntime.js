import { normalizeRuntimeSurvivor, normalizeRuntimeSurvivorList } from './survivorRuntime';
import { shuffleArray } from './simulationCommon';
import { assignSimulationTeams, getAliveTeams } from './teamRuntime';
import { validateCustomRosterDraft } from './customRosterRuntime';
import {
  PARTICIPANT_PRESET_SIZE,
  RANDOM_PARTICIPANT_PRESET_ID,
  normalizeParticipantPresetIds,
} from './participantPresetRuntime';
import { dedupeRuntimeParticipants, getRuntimeActorKey } from './runtimeParticipantRuntime';

export function normalizeMatchMode(value) {
  return String(value || '').toLowerCase() === 'solo' ? 'solo' : 'squad';
}

export function getMatchConfig(src = {}) {
  const matchMode = normalizeMatchMode(src?.matchMode);
  return matchMode === 'solo'
    ? { matchMode, teamSize: 1, maxTeams: 24, maxParticipants: 24 }
    : { matchMode, teamSize: 3, maxTeams: 8, maxParticipants: 24 };
}

export function getFullRosterLimit(count, cfg) {
  const total = Math.max(0, Math.floor(Number(count || 0)));
  const capped = Math.max(0, Math.min(PARTICIPANT_PRESET_SIZE, Number(cfg?.maxParticipants || PARTICIPANT_PRESET_SIZE), total));
  const teamSize = Math.max(1, Math.floor(Number(cfg?.teamSize || 1)));
  if (teamSize <= 1) return capped;
  return Math.floor(capped / teamSize) * teamSize;
}

export function applyMatchTeams(list, src = {}) {
  const cfg = getMatchConfig(src);
  const normalized = normalizeRuntimeSurvivorList(Array.isArray(list) ? list : []);
  const limit = getFullRosterLimit(normalized.length, cfg);
  return assignSimulationTeams(
    normalized.slice(0, limit),
    { teamSize: cfg.teamSize, maxTeams: cfg.maxTeams, preserveExisting: false }
  ).map((c) => normalizeRuntimeSurvivor(c));
}

export function getParticipantPreset(participantPresets, presetId) {
  const id = String(presetId || '');
  if (!id || id === RANDOM_PARTICIPANT_PRESET_ID) return null;
  return (Array.isArray(participantPresets) ? participantPresets : [])
    .find((preset) => String(preset?.id || '') === id) || null;
}

export function pickParticipantsForRun(list, participantPresets, presetId, src = {}) {
  const cfg = getMatchConfig(src);
  const pool = dedupeRuntimeParticipants(normalizeRuntimeSurvivorList(Array.isArray(list) ? list : []));
  const max = getFullRosterLimit(pool.length, cfg);
  const preset = getParticipantPreset(participantPresets, presetId);

  if (max <= 0) return [];
  if (!preset) return shuffleArray(pool).slice(0, max);

  const byId = new Map(pool.map((actor) => [getRuntimeActorKey(actor), actor]).filter(([key]) => key));
  const picked = [];
  const pickedKeys = new Set();
  for (const id of normalizeParticipantPresetIds(preset.characterIds)) {
    const key = String(id || '').trim();
    const actor = byId.get(key);
    if (!actor || pickedKeys.has(key)) continue;
    picked.push(actor);
    pickedKeys.add(key);
    if (picked.length >= max) break;
  }

  if (picked.length < max) {
    const fillers = shuffleArray(pool.filter((actor) => !pickedKeys.has(getRuntimeActorKey(actor))));
    picked.push(...fillers.slice(0, max - picked.length));
  }

  return picked.slice(0, max);
}

export function buildCustomParticipantsForRun(list, draft = {}, src = {}) {
  const cfg = getMatchConfig(src);
  const validation = validateCustomRosterDraft(draft, cfg);
  const pool = dedupeRuntimeParticipants(normalizeRuntimeSurvivorList(Array.isArray(list) ? list : []));
  const byId = new Map(pool.map((actor) => [getRuntimeActorKey(actor), actor]).filter(([key]) => key));
  const missingIds = validation.orderedCharacterIds.filter((id) => !byId.has(id));
  const errors = [...validation.errors];
  if (missingIds.length) errors.push(`선택한 캐릭터 ${missingIds.length}명을 현재 후보에서 찾을 수 없습니다.`);
  if (errors.length) {
    return {
      ...validation,
      errors,
      missingIds,
      participants: [],
      ready: false,
    };
  }

  const picked = validation.orderedCharacterIds.map((id) => byId.get(id)).filter(Boolean);
  return {
    ...validation,
    errors: [],
    missingIds: [],
    participants: applyMatchTeams(picked, src),
    ready: true,
  };
}

export function getMatchStartInfo(list, src = {}) {
  const cfg = getMatchConfig(src);
  const normalized = normalizeRuntimeSurvivorList(Array.isArray(list) ? list : []);
  const limit = getFullRosterLimit(normalized.length, cfg);
  const assigned = assignSimulationTeams(
    normalized.slice(0, limit),
    { teamSize: cfg.teamSize, maxTeams: cfg.maxTeams, preserveExisting: false }
  );
  const teams = getAliveTeams(assigned);
  const minReadyCount = cfg.teamSize <= 1 ? 2 : cfg.teamSize * 2;
  return {
    ...cfg,
    participantCount: assigned.length,
    teamCount: teams.length,
    ready: assigned.length >= minReadyCount && teams.length >= 2 && (cfg.teamSize <= 1 || assigned.length % cfg.teamSize === 0),
  };
}
