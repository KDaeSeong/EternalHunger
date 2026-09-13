export const LOCAL_SIMULATION_RUN_HISTORY_KEY = 'eh_sim_run_history_v1';
export const LOCAL_SIMULATION_RUN_HISTORY_LIMIT = 20;
export const LOCAL_SIMULATION_RUN_SCHEMA_VERSION = 1;

function cleanLocalText(value, maxLength = 120) {
  return String(value ?? '').trim().slice(0, Math.max(0, Number(maxLength) || 0));
}

function cleanLocalInt(value, fallback = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(max, Math.floor(number)));
}

function getLocalStorage(storage) {
  if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function localActorId(actor) {
  return cleanLocalText(actor?._id || actor?.id || actor?.charId, 96);
}

function normalizeLocalRunParticipant(actor) {
  if (!actor || typeof actor !== 'object') return null;
  const id = localActorId(actor);
  if (!id) return null;
  return {
    id,
    name: cleanLocalText(actor?.name || actor?.nickname || actor?.charName || id, 80) || id,
    teamId: cleanLocalText(actor?.teamId || actor?.matchTeamId, 96),
    teamName: cleanLocalText(actor?.teamName || actor?.matchTeamName, 80),
    teamSlot: cleanLocalInt(actor?.matchTeamSlot ?? actor?.teamSlot, 0, 24),
  };
}

function normalizeLocalRunCountMap(value, participantIds) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const allowedIds = participantIds instanceof Set ? participantIds : new Set();
  const out = {};
  Object.entries(source).forEach(([rawId, rawCount]) => {
    const id = cleanLocalText(rawId, 96);
    if (!id || !allowedIds.has(id)) return;
    const count = cleanLocalInt(rawCount, 0, 9999);
    if (count > 0) out[id] = count;
  });
  return out;
}

function normalizeLocalRunSettings(value) {
  const settings = value && typeof value === 'object' ? value : {};
  const matchMode = cleanLocalText(settings?.matchMode, 16).toLowerCase() === 'solo' ? 'solo' : 'squad';
  const skillFlag = settings?.skills?.characterSkills ?? settings?.skills?.enabled ?? settings?.characterSkillsEnabled;
  return {
    rulesetId: cleanLocalText(settings?.rulesetId, 64),
    matchMode,
    characterSkillsEnabled: skillFlag !== false,
  };
}

export function normalizeLocalSimulationRun(value) {
  if (!value || typeof value !== 'object') return null;
  const clientRunId = cleanLocalText(value?.clientRunId || value?.id, 128);
  if (!clientRunId) return null;

  const participantById = new Map();
  (Array.isArray(value?.participants) ? value.participants : [])
    .slice(0, 48)
    .forEach((actor) => {
      const participant = normalizeLocalRunParticipant(actor);
      if (participant && !participantById.has(participant.id)) participantById.set(participant.id, participant);
    });
  const participants = Array.from(participantById.values()).slice(0, 24);
  const participantIds = new Set(participants.map((participant) => participant.id));
  const winnerId = cleanLocalText(value?.winnerId || value?.winner?.id || value?.winner?._id, 96);
  const winnerParticipant = participants.find((participant) => participant.id === winnerId) || null;

  return {
    schemaVersion: LOCAL_SIMULATION_RUN_SCHEMA_VERSION,
    clientRunId,
    finishedAt: cleanLocalInt(value?.finishedAt, Date.now()),
    runSeed: cleanLocalText(value?.runSeed, 128),
    day: cleanLocalInt(value?.day, 0, 99),
    matchSec: cleanLocalInt(value?.matchSec, 0, 86400),
    ending: value?.ending && typeof value.ending === 'object' ? {
      outcome: value.ending.outcome === 'no_survivors' ? 'no_survivors' : 'last_team',
      atSec: cleanLocalInt(value.ending.atSec, 0, 86400),
      day: cleanLocalInt(value.ending.day, 0, 99),
      phase: value.ending.phase === 'night' ? 'night' : 'morning',
      cause: cleanLocalText(value.ending.cause, 64),
      causeName: cleanLocalText(value.ending.causeName, 120),
      finalZoneStage: cleanLocalText(value.ending.finalZoneStage, 16),
    } : null,
    matchMode: cleanLocalText(value?.matchMode || value?.settings?.matchMode, 16).toLowerCase() === 'solo' ? 'solo' : 'squad',
    teamSize: cleanLocalInt(value?.teamSize, 1, 24) || 1,
    winnerId: participantIds.has(winnerId) ? winnerId : '',
    winnerName: cleanLocalText(value?.winnerName || winnerParticipant?.name, 80),
    winnerTeamId: cleanLocalText(value?.winnerTeamId, 96),
    winnerTeamName: cleanLocalText(value?.winnerTeamName, 80),
    participants,
    killCounts: normalizeLocalRunCountMap(value?.killCounts, participantIds),
    assistCounts: normalizeLocalRunCountMap(value?.assistCounts, participantIds),
    settings: normalizeLocalRunSettings(value?.settings),
    trustedOutcome: false,
  };
}

function normalizeLocalSimulationRunHistory(value) {
  const rows = Array.isArray(value) ? value : (Array.isArray(value?.runs) ? value.runs : []);
  const byRunId = new Map();
  rows.forEach((row) => {
    const normalized = normalizeLocalSimulationRun(row);
    if (normalized && !byRunId.has(normalized.clientRunId)) byRunId.set(normalized.clientRunId, normalized);
  });
  return Array.from(byRunId.values()).slice(0, LOCAL_SIMULATION_RUN_HISTORY_LIMIT);
}

export function readLocalSimulationRunHistory(storage) {
  const target = getLocalStorage(storage);
  if (!target) return [];
  try {
    const raw = target.getItem(LOCAL_SIMULATION_RUN_HISTORY_KEY);
    return normalizeLocalSimulationRunHistory(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

function writeLocalSimulationRunHistory(target, runs) {
  target.setItem(LOCAL_SIMULATION_RUN_HISTORY_KEY, JSON.stringify({
    schemaVersion: LOCAL_SIMULATION_RUN_SCHEMA_VERSION,
    runs,
  }));
}

export function saveLocalSimulationRunBackup(value, storage) {
  const target = getLocalStorage(storage);
  const record = normalizeLocalSimulationRun({ ...value, finishedAt: value?.finishedAt || Date.now() });
  if (!target || !record) return { ok: false, record: null, runs: [] };

  const previous = readLocalSimulationRunHistory(target);
  const runs = [record, ...previous.filter((row) => row.clientRunId !== record.clientRunId)]
    .slice(0, LOCAL_SIMULATION_RUN_HISTORY_LIMIT);
  try {
    writeLocalSimulationRunHistory(target, runs);
    return { ok: true, record, runs, trimmed: false };
  } catch {
    const compactRuns = runs.slice(0, 5);
    try {
      writeLocalSimulationRunHistory(target, compactRuns);
      return { ok: true, record, runs: compactRuns, trimmed: true };
    } catch {
      return { ok: false, record, runs: previous, trimmed: false };
    }
  }
}
