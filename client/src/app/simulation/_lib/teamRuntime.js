const DEFAULT_TEAM_SIZE = 3;

function cleanId(value) {
  return String(value || '').trim();
}

function readTeamId(actor) {
  if (!actor || typeof actor !== 'object') return '';
  return cleanId(
    actor.teamId ||
    actor.matchTeamId ||
    actor.squadId ||
    actor.partyId ||
    actor.team?._id ||
    actor.team?.id ||
    actor.team
  );
}

function readTeamName(actor, fallback = '') {
  if (!actor || typeof actor !== 'object') return fallback;
  return cleanId(actor.teamName || actor.squadName || actor.partyName || actor.team?.name) || fallback;
}

function actorFallbackTeamId(actor) {
  const id = cleanId(actor?._id || actor?.id);
  return id ? `solo:${id}` : '';
}

function getActorTeamId(actor) {
  return readTeamId(actor) || actorFallbackTeamId(actor);
}

function getActorTeamName(actor) {
  const id = getActorTeamId(actor);
  const raw = readTeamName(actor);
  if (raw) return raw;
  if (id.startsWith('team:')) return `${Number(id.slice(5)) || 1}팀`;
  return cleanId(actor?.name) || id || '팀';
}

function getRuntimeActorId(actor) {
  return cleanId(actor?._id || actor?.id || actor?.charId || actor?.name);
}

function getActorTeamOriginalSize(actor, fallback = 1) {
  const value = Number(
    actor?.matchTeamSize ??
    actor?.teamOriginalSize ??
    actor?.initialTeamSize ??
    actor?.originalTeamSize ??
    actor?.teamSize ??
    fallback
  );
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : Math.max(1, Math.floor(Number(fallback || 1)));
}

function getActorTeamCapacity(actor, fallback = DEFAULT_TEAM_SIZE) {
  const value = Number(actor?.matchTeamCapacity ?? actor?.teamCapacity ?? fallback);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : Math.max(1, Math.floor(Number(fallback || DEFAULT_TEAM_SIZE)));
}

function assignSimulationTeams(list, opts = {}) {
  const arr = Array.isArray(list) ? list : [];
  const teamSize = Math.max(1, Math.floor(Number(opts?.teamSize ?? DEFAULT_TEAM_SIZE)));
  const maxTeams = Math.max(1, Math.floor(Number(opts?.maxTeams ?? 8)));
  const preserveExisting = opts?.preserveExisting !== false;
  let nextAutoIndex = 0;

  const assigned = arr.map((actor) => {
    if (!actor || typeof actor !== 'object') return actor;
    const existing = readTeamId(actor);
    if (existing && preserveExisting) {
      return {
        ...actor,
        teamId: existing,
        teamName: readTeamName(actor, getActorTeamName(actor)),
      };
    }

    const teamNo = Math.min(maxTeams, Math.floor(nextAutoIndex / teamSize) + 1);
    nextAutoIndex += 1;
    const solo = teamSize === 1;
    return {
      ...actor,
      teamId: `team:${teamNo}`,
      teamName: solo ? (cleanId(actor?.name) || `Solo ${teamNo}`) : `${teamNo}팀`,
      teamSlot: ((nextAutoIndex - 1) % teamSize) + 1,
    };
  });

  const grouped = new Map();
  assigned.forEach((actor, index) => {
    if (!actor || typeof actor !== 'object') return;
    const teamId = getActorTeamId(actor);
    if (!teamId) return;
    if (!grouped.has(teamId)) grouped.set(teamId, []);
    grouped.get(teamId).push({ actor, index });
  });

  return assigned.map((actor, index) => {
    if (!actor || typeof actor !== 'object') return actor;
    const teamId = getActorTeamId(actor);
    const rows = grouped.get(teamId) || [];
    const rosterIds = rows.map((row) => getRuntimeActorId(row.actor)).filter(Boolean);
    const rosterNames = rows.map((row) => cleanId(row.actor?.name || row.actor?.nickname || row.actor?.charName)).filter(Boolean);
    const slot = Math.max(1, Number(actor?.teamSlot || actor?.matchTeamSlot || (rows.findIndex((row) => row.index === index) + 1) || 1));
    const originalSize = Math.max(1, rows.length || (teamSize === 1 ? 1 : teamSize));
    return {
      ...actor,
      matchTeamId: teamId,
      matchTeamName: getActorTeamName(actor),
      matchTeamSlot: slot,
      teamSlot: slot,
      matchTeamSize: originalSize,
      teamOriginalSize: originalSize,
      matchTeamCapacity: teamSize,
      matchTeamRosterIds: rosterIds,
      matchTeamRosterNames: rosterNames,
    };
  });
}

function areSameTeam(a, b) {
  const ta = getActorTeamId(a);
  const tb = getActorTeamId(b);
  return !!ta && !!tb && ta === tb;
}

function getAliveTeams(list) {
  const teams = new Map();
  for (const actor of Array.isArray(list) ? list : []) {
    if (!actor || Number(actor?.hp || 0) <= 0) continue;
    const teamId = getActorTeamId(actor);
    if (!teamId) continue;
    const teamName = getActorTeamName(actor);
    if (!teams.has(teamId)) {
      teams.set(teamId, {
        teamId,
        teamName,
        members: [],
        originalSize: getActorTeamOriginalSize(actor, 1),
        capacity: getActorTeamCapacity(actor, DEFAULT_TEAM_SIZE),
        rosterIds: Array.isArray(actor?.matchTeamRosterIds) ? actor.matchTeamRosterIds.filter(Boolean) : [],
        rosterNames: Array.isArray(actor?.matchTeamRosterNames) ? actor.matchTeamRosterNames.filter(Boolean) : [],
      });
    }
    const team = teams.get(teamId);
    team.members.push(actor);
    team.originalSize = Math.max(team.originalSize || 1, getActorTeamOriginalSize(actor, team.members.length));
    team.capacity = Math.max(team.capacity || 1, getActorTeamCapacity(actor, team.originalSize));
    if (Array.isArray(actor?.matchTeamRosterIds) && actor.matchTeamRosterIds.length > (team.rosterIds || []).length) {
      team.rosterIds = actor.matchTeamRosterIds.filter(Boolean);
    }
    if (Array.isArray(actor?.matchTeamRosterNames) && actor.matchTeamRosterNames.length > (team.rosterNames || []).length) {
      team.rosterNames = actor.matchTeamRosterNames.filter(Boolean);
    }
  }
  return [...teams.values()].map((team) => {
    const aliveCount = Array.isArray(team.members) ? team.members.length : 0;
    const originalSize = Math.max(aliveCount, Number(team.originalSize || aliveCount || 1));
    return {
      ...team,
      aliveCount,
      originalSize,
      missingCount: Math.max(0, originalSize - aliveCount),
      rosterIds: Array.isArray(team.rosterIds) && team.rosterIds.length ? team.rosterIds : team.members.map((m) => getRuntimeActorId(m)).filter(Boolean),
      rosterNames: Array.isArray(team.rosterNames) && team.rosterNames.length ? team.rosterNames : team.members.map((m) => cleanId(m?.name)).filter(Boolean),
    };
  });
}

function pickTeamRepresentative(members, killCounts = {}, assistCounts = {}) {
  const arr = Array.isArray(members) ? members.filter(Boolean) : [];
  if (!arr.length) return null;
  return [...arr].sort((a, b) => {
    const aId = cleanId(a?._id || a?.id);
    const bId = cleanId(b?._id || b?.id);
    return (Number(killCounts?.[bId] || 0) - Number(killCounts?.[aId] || 0)) ||
      (Number(assistCounts?.[bId] || 0) - Number(assistCounts?.[aId] || 0)) ||
      (Number(b?.hp || 0) - Number(a?.hp || 0));
  })[0] || null;
}

function getWinningTeam(list, killCounts = {}, assistCounts = {}) {
  const aliveTeams = getAliveTeams(list);
  if (aliveTeams.length !== 1) return null;
  const team = aliveTeams[0];
  return {
    ...team,
    representative: pickTeamRepresentative(team.members, killCounts, assistCounts),
  };
}

export {
  areSameTeam,
  assignSimulationTeams,
  getActorTeamCapacity,
  getActorTeamId,
  getActorTeamName,
  getActorTeamOriginalSize,
  getAliveTeams,
  getWinningTeam,
  pickTeamRepresentative,
};
