export const CUSTOM_ROSTER_SIZE = 24;

function uniqueIds(value) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function validateCustomRosterDraft(draft = {}, options = {}) {
  const matchMode = String(options?.matchMode || draft?.matchMode || '').toLowerCase() === 'solo'
    ? 'solo'
    : 'squad';
  const participantSize = Math.max(1, Math.floor(Number(options?.maxParticipants || CUSTOM_ROSTER_SIZE)));
  const teamSize = matchMode === 'solo'
    ? 1
    : Math.max(1, Math.floor(Number(options?.teamSize || 3)));
  const maxTeams = matchMode === 'solo'
    ? participantSize
    : Math.max(1, Math.floor(Number(options?.maxTeams || Math.ceil(participantSize / teamSize))));
  const characterIds = uniqueIds(draft?.characterIds);
  const rawAssignments = draft?.teamAssignments && typeof draft.teamAssignments === 'object'
    ? draft.teamAssignments
    : {};
  const teamAssignments = {};
  const teamCounts = Object.fromEntries(
    Array.from({ length: maxTeams }, (_, index) => [index + 1, 0]),
  );
  const errors = [];

  if (characterIds.length !== participantSize) {
    errors.push(`참가자를 정확히 ${participantSize}명 선택해야 합니다.`);
  }

  if (matchMode === 'squad') {
    const unassigned = [];
    characterIds.forEach((id) => {
      const teamNo = Math.floor(Number(rawAssignments[id] || 0));
      if (teamNo < 1 || teamNo > maxTeams) {
        unassigned.push(id);
        return;
      }
      teamAssignments[id] = teamNo;
      teamCounts[teamNo] += 1;
    });
    if (unassigned.length) errors.push(`${unassigned.length}명의 팀이 지정되지 않았습니다.`);

    const incompleteTeams = Object.entries(teamCounts)
      .filter(([, count]) => count !== teamSize)
      .map(([teamNo, count]) => `${teamNo}팀 ${count}/${teamSize}`);
    if (incompleteTeams.length) {
      errors.push(`모든 팀을 ${teamSize}명으로 채워야 합니다: ${incompleteTeams.join(', ')}`);
    }
  }

  const selectionIndex = new Map(characterIds.map((id, index) => [id, index]));
  const orderedCharacterIds = matchMode === 'squad'
    ? [...characterIds].sort((a, b) => (
      Number(teamAssignments[a] || maxTeams + 1) - Number(teamAssignments[b] || maxTeams + 1)
      || Number(selectionIndex.get(a) || 0) - Number(selectionIndex.get(b) || 0)
    ))
    : [...characterIds];

  return {
    characterIds,
    errors,
    matchMode,
    maxTeams,
    orderedCharacterIds,
    participantSize,
    ready: errors.length === 0,
    selectedCount: characterIds.length,
    teamAssignments,
    teamCounts,
    teamSize,
  };
}
