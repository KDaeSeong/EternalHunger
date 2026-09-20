import { getActorTeamId, getActorTeamName } from './teamRuntime.js';

export const MINIMAP_TEAM_PALETTE = Object.freeze([
  '#55c7ff',
  '#ff9d5c',
  '#a8dc5f',
  '#e78cff',
  '#ffd35f',
  '#55dfc1',
  '#ff718b',
  '#9da8ff',
]);

const idOf = (actor) => String(actor?._id || actor?.id || '');
const list = (value) => Array.isArray(value) ? value : [];

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function teamNumber(teamId, teamName = '') {
  const idMatch = String(teamId || '').match(/^team:(\d+)$/i);
  if (idMatch) return Number(idMatch[1]);
  const nameMatch = String(teamName || '').match(/^(\d+)\s*팀$/);
  return nameMatch ? Number(nameMatch[1]) : null;
}

export function getMinimapTeamPresentation(actor) {
  const teamId = getActorTeamId(actor);
  const teamName = getActorTeamName(actor);
  const number = teamNumber(teamId, teamName);
  const paletteIndex = Number.isInteger(number) && number > 0
    ? (number - 1) % MINIMAP_TEAM_PALETTE.length
    : hashText(teamId || teamName) % MINIMAP_TEAM_PALETTE.length;
  const solo = String(teamId || '').startsWith('solo:');
  return {
    teamId,
    teamName,
    teamNumber: number,
    shortLabel: solo ? 'S' : number ? String(number) : String(teamName || '?').slice(0, 2),
    color: solo ? '#70df9b' : MINIMAP_TEAM_PALETTE[paletteIndex],
    solo,
  };
}

function compareTeamPresentation(a, b) {
  if (a.teamNumber != null && b.teamNumber != null) return a.teamNumber - b.teamNumber;
  if (a.teamNumber != null) return -1;
  if (b.teamNumber != null) return 1;
  return a.teamName.localeCompare(b.teamName, 'ko-KR', { numeric: true });
}

export function buildMinimapTeamLegend(actors, trackedActorIds = []) {
  const tracked = trackedActorIds instanceof Set ? trackedActorIds : new Set(list(trackedActorIds).map(String));
  const teams = new Map();
  list(actors).forEach((actor) => {
    const presentation = getMinimapTeamPresentation(actor);
    if (presentation.solo || !presentation.teamId) return;
    const current = teams.get(presentation.teamId) || {
      ...presentation,
      aliveCount: 0,
      selected: false,
    };
    if (Number(actor?.hp || 0) > 0) current.aliveCount += 1;
    if (tracked.has(idOf(actor))) current.selected = true;
    teams.set(presentation.teamId, current);
  });
  return [...teams.values()].sort(compareTeamPresentation);
}

export function layoutMinimapZoneActors(actors, trackedActorIds = [], limit = 24) {
  const tracked = trackedActorIds instanceof Set ? trackedActorIds : new Set(list(trackedActorIds).map(String));
  const rows = list(actors).slice(0, Math.max(0, limit));
  if (!rows.length) return [];

  const presentations = rows.map((actor) => ({ actor, ...getMinimapTeamPresentation(actor) }));
  const isSolo = presentations.every((row) => row.solo);
  if (isSolo) {
    const columns = Math.min(3, presentations.length);
    const rowCount = Math.ceil(presentations.length / columns);
    return presentations.map((row, index) => {
      const maxHp = Math.max(1, Number(row.actor?.maxHp || 100));
      return {
        ...row,
        actors: [row.actor],
        aggregate: false,
        count: 1,
        hpRatio: Math.max(0, Math.min(1, Number(row.actor?.hp || 0) / maxHp)),
        dx: (index % columns - (columns - 1) / 2) * 4.8,
        dy: (Math.floor(index / columns) - (rowCount - 1) / 2) * 5.2,
        tracked: tracked.has(idOf(row.actor)),
      };
    });
  }

  const groups = new Map();
  presentations.forEach((row) => {
    if (!groups.has(row.teamId)) groups.set(row.teamId, []);
    groups.get(row.teamId).push(row);
  });
  const groupedRows = [...groups.values()].sort((left, right) => {
    const leftTracked = left.some((row) => tracked.has(idOf(row.actor)));
    const rightTracked = right.some((row) => tracked.has(idOf(row.actor)));
    if (leftTracked !== rightTracked) return leftTracked ? -1 : 1;
    return compareTeamPresentation(left[0], right[0]);
  });

  if (groupedRows.length > 3 || presentations.length > 9) {
    const columns = groupedRows.length > 6 ? 3 : 2;
    const rowCount = Math.ceil(groupedRows.length / columns);
    return groupedRows.map((group, groupIndex) => {
      const maxHp = group.reduce((sum, row) => sum + Math.max(1, Number(row.actor?.maxHp || 100)), 0);
      const hp = group.reduce((sum, row) => sum + Math.max(0, Number(row.actor?.hp || 0)), 0);
      return {
        ...group[0],
        actor: group[0].actor,
        actors: group.map((row) => row.actor),
        aggregate: true,
        count: group.length,
        hpRatio: Math.max(0, Math.min(1, hp / Math.max(1, maxHp))),
        dx: (groupIndex % columns - (columns - 1) / 2) * 5.8,
        dy: (Math.floor(groupIndex / columns) - (rowCount - 1) / 2) * 5.7,
        tracked: group.some((row) => tracked.has(idOf(row.actor))),
      };
    });
  }

  const rowSpacing = groupedRows.length > 3 ? 5.1 : 5.6;

  return groupedRows.flatMap((group, groupIndex) => {
    const sorted = [...group].sort((a, b) => idOf(a.actor).localeCompare(idOf(b.actor), 'en', { numeric: true }));
    const width = Math.min(3, sorted.length);
    const baseY = (groupIndex - (groupedRows.length - 1) / 2) * rowSpacing;
    return sorted.map((row, memberIndex) => ({
      ...row,
      actors: [row.actor],
      aggregate: false,
      count: 1,
      hpRatio: Math.max(0, Math.min(1, Number(row.actor?.hp || 0) / Math.max(1, Number(row.actor?.maxHp || 100)))),
      dx: (memberIndex - (width - 1) / 2) * 4.8,
      dy: baseY,
      tracked: tracked.has(idOf(row.actor)),
    }));
  });
}
