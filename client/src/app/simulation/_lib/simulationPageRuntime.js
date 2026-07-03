import { getRuleset } from '../../../utils/rulesets';
import {
  getActorTeamCapacity,
  getActorTeamId,
  getActorTeamName,
  getActorTeamOriginalSize,
} from './simulationEngine';
import { getMatchConfig, normalizeMatchMode } from './matchRosterRuntime';

function subscribeHydration() {
  return () => {};
}

function getClientHydrationSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

function getDefaultSimulationSettings() {
  return {
    statWeights: { maxHp: 1, attackPower: 1, skillAmp: 1, defense: 1, attackSpeed: 1, attackRange: 1, sightRange: 1 },
    suddenDeathTurn: 5,
    forbiddenZoneStartDay: 2,
    forbiddenZoneStartPhase: 'night',
    forbiddenZoneDamageBase: 1.5,
    rulesetId: 'ER_S11',
    matchMode: 'squad',
  };
}

function safeRenderCompute(label, factory, fallback) {
  try {
    return factory();
  } catch (err) {
    console.error(`[simulation:${label}]`, err);
    return fallback;
  }
}

function fireAndReport(label, job) {
  return Promise.resolve()
    .then(() => job())
    .catch((err) => {
      console.error(`[simulation:${label}]`, err);
      throw err;
    });
}

function buildCharacterSkillModeSettings(settings) {
  const rs = getRuleset(settings?.rulesetId);
  return {
    ...(settings || {}),
    skills: { ...(rs?.skills || {}), ...(settings?.skills || {}) },
  };
}

function buildCharacterSkillsToggleSettings(settings, enabled) {
  const on = !!enabled;
  return {
    ...(settings || {}),
    skills: {
      ...(settings?.skills || {}),
      enabled: on,
      characterSkills: on,
      aiUseSkills: on,
    },
  };
}

function buildActorAvatarByName(survivors, dead) {
  const out = {};
  const all = [
    ...(Array.isArray(survivors) ? survivors : []),
    ...(Array.isArray(dead) ? dead : []),
  ];
  for (const c of all) {
    const name = String(c?.name || '').trim();
    const img = String(c?.previewImage || c?.image || '').trim();
    if (name && img && !out[name]) out[name] = img;
  }
  return out;
}

function buildActorTeamState(actor, settings, survivors, dead) {
  if (!actor || normalizeMatchMode(settings?.matchMode) === 'solo') return null;
  const teamId = getActorTeamId(actor);
  if (!teamId) return null;

  const allActors = [
    ...(Array.isArray(survivors) ? survivors : []),
    ...(Array.isArray(dead) ? dead : []),
  ];
  const teamActors = allActors.filter((row) => getActorTeamId(row) === teamId);
  const aliveCount = (Array.isArray(survivors) ? survivors : [])
    .filter((row) => getActorTeamId(row) === teamId && Number(row?.hp || 0) > 0)
    .length;
  const rosterSize = Math.max(
    getActorTeamOriginalSize(actor, teamActors.length || 1),
    ...teamActors.map((row) => getActorTeamOriginalSize(row, teamActors.length || 1)),
    teamActors.length || 1
  );
  const matchConfig = getMatchConfig(settings);
  const capacity = Math.max(
    getActorTeamCapacity(actor, matchConfig.teamSize),
    matchConfig.teamSize
  );
  const rosterNames = Array.isArray(actor?.matchTeamRosterNames) && actor.matchTeamRosterNames.length
    ? actor.matchTeamRosterNames
    : teamActors.map((row) => String(row?.name || '').trim()).filter(Boolean);

  return {
    teamId,
    teamName: getActorTeamName(actor),
    aliveCount,
    rosterSize,
    capacity,
    missingCount: Math.max(0, rosterSize - aliveCount),
    rosterNames,
    label: `${getActorTeamName(actor)} · 생존 ${aliveCount}/${rosterSize}${capacity > rosterSize ? ` (정원 ${capacity})` : ''}`,
  };
}

function getPreferredHyperloopCharId(selectedCharId, survivors) {
  const preferred = String(selectedCharId || '').trim();
  if (preferred) return preferred;
  const alive = (Array.isArray(survivors) ? survivors : []).filter((actor) => Number(actor?.hp || 0) > 0);
  return String(alive[0]?._id || '');
}

function getActiveMapForForbiddenZones(activeMap, activeMapId, zones) {
  if (activeMap) return activeMap;
  return (Array.isArray(zones) && zones.length)
    ? { _id: String(activeMapId || 'local'), zones }
    : null;
}

export {
  buildActorAvatarByName,
  buildActorTeamState,
  buildCharacterSkillModeSettings,
  buildCharacterSkillsToggleSettings,
  fireAndReport,
  getActiveMapForForbiddenZones,
  getClientHydrationSnapshot,
  getDefaultSimulationSettings,
  getPreferredHyperloopCharId,
  getServerHydrationSnapshot,
  safeRenderCompute,
  subscribeHydration,
};
