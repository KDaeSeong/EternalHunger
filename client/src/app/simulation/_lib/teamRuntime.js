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

function assignSimulationTeams(list, opts = {}) {
  const arr = Array.isArray(list) ? list : [];
  const teamSize = Math.max(1, Math.floor(Number(opts?.teamSize ?? DEFAULT_TEAM_SIZE)));
  const maxTeams = Math.max(1, Math.floor(Number(opts?.maxTeams ?? 8)));
  const preserveExisting = opts?.preserveExisting !== false;
  let nextAutoIndex = 0;

  return arr.map((actor) => {
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
    if (!teams.has(teamId)) teams.set(teamId, { teamId, teamName, members: [] });
    teams.get(teamId).members.push(actor);
  }
  return [...teams.values()];
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
  getActorTeamId,
  getActorTeamName,
  getAliveTeams,
  getWinningTeam,
  pickTeamRepresentative,
};
