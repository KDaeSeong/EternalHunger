import { getActorTeamId, getActorTeamName } from './teamRuntime.js';
import { getRevivePhaseConfig, isTeamWipeReviveProtected } from './revivalPolicyRuntime.js';
import { getMatchConfig } from './matchRosterRuntime.js';
import { getRuleset } from '../../../utils/rulesets.js';
import { worldPhaseIndex } from './worldTime.js';

export function getTeamSurvivalContext(settings, day, phase) {
  const ruleset = getRuleset(settings?.rulesetId, settings?.simulationRuleset);
  return { canReviveThisMatch: getMatchConfig(settings).matchMode !== 'solo',
    phaseIdxNow: worldPhaseIndex(day, phase),
    wipeProtectionCutoffIdx: getRevivePhaseConfig(ruleset?.revive).wipeProtectionCutoffIdx };
}

// Input is the committed living/dead roster. A living actor supersedes an old
// corpse; a zero-HP live-map row must not supersede normalized death metadata.
export function getTeamSurvivalStates({ survivors = [], dead = [], ...context } = {}) {
  const actors = new Map();
  for (const actor of [...survivors.filter((row) => Number(row?.hp) <= 0), ...dead,
    ...survivors.filter((row) => Number(row?.hp) > 0)]) {
    const id = String(actor?._id || actor?.id || '');
    if (id) actors.set(id, actor);
  }
  const teams = new Map();
  for (const [id, actor] of actors) {
    const teamId = getActorTeamId(actor);
    if (!teamId) continue;
    if (!teams.has(teamId)) teams.set(teamId, { teamId, teamName: getActorTeamName(actor), participants: [], aliveCount: 0, protectedCount: 0 });
    const team = teams.get(teamId);
    team.participants.push(id);
    if (Number(actor.hp) > 0) team.aliveCount++;
    else if (isTeamWipeReviveProtected(actor, context)) team.protectedCount++;
  }
  return [...teams.values()].map((team) => ({ ...team,
    status: team.aliveCount > 0 ? 'active' : team.protectedCount > 0 ? 'revival_pending' : 'eliminated' }));
}

export function describeTeamSurvival(event) {
  const name = event.teamName || '팀';
  const count = `${event.aliveCount}/${event.participants?.length || 0}명 생존`;
  if (event.status === 'revival_pending') return `${name} 팀 전멸 · ${count} · 부활 대기 (${event.protectedCount}명 전멸 보호 적용)`;
  if (event.status === 'eliminated') return `${name} 팀 최종 탈락 · ${count} · ${event.reason === 'protection_expired' ? '전멸 보호 종료 · ' : ''}복귀 가능한 팀원 없음`;
  if (event.status === 'active') return `${name} 전장 복귀 · ${count}`;
  return '';
}

export function createTeamSurvivalObserver(initial, { emitRunEvent = () => {}, addLog = () => {} } = {}) {
  let previous = new Map(getTeamSurvivalStates(initial).map((team) => [team.teamId, team]));
  return (current, at) => {
    const next = getTeamSurvivalStates(current);
    for (const team of next) {
      const before = previous.get(team.teamId);
      if (!before || before.status === team.status) continue;
      // Solo eliminations already have individual death notices; do not call
      // one character a wiped squad. State still updates for deduplication.
      if (team.participants.length < 2) continue;
      const event = { ...team, previousStatus: before.status,
        reason: team.status === 'active' ? 'revived' : team.status === 'revival_pending' ? 'wipe_protected'
          : before.status === 'revival_pending' ? 'protection_expired' : 'no_revival_path' };
      emitRunEvent('team_status', event, at);
      addLog(describeTeamSurvival(event), 'highlight');
    }
    previous = new Map(next.map((team) => [team.teamId, team]));
  };
}
