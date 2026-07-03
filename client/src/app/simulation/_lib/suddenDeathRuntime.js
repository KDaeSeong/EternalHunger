import {
  getActorTeamName,
  getAliveTeams,
  pickTeamRepresentative,
} from './teamRuntime';
import { normalizeRuntimeSurvivorList } from './survivorRuntime';

function runSuddenDeathGatherPhase({
  actions = {},
  state = {},
} = {}) {
  const {
    ruleset,
    suddenDeathActive = false,
    suddenDeathSafeZoneIds = [],
    updatedSurvivors = [],
  } = state;
  const {
    addLog = () => {},
    atNow = () => null,
    emitRunEvent = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
  } = actions;

  if (!suddenDeathActive || ruleset?.suddenDeath?.forceGather === false || suddenDeathSafeZoneIds.length <= 0) {
    return {
      ran: false,
      updatedSurvivors,
    };
  }

  const aliveTeamsBeforeClash = getAliveTeams(updatedSurvivors);
  if (aliveTeamsBeforeClash.length <= 1) {
    return {
      ran: false,
      updatedSurvivors,
    };
  }

  const clashZone = String(suddenDeathSafeZoneIds[0] || '');
  const criticalSec = Math.max(0, Number(ruleset?.detonation?.criticalSec ?? 5));
  const detMax = Math.max(criticalSec + 8, Number(ruleset?.detonation?.maxSec ?? 30));
  const gathered = normalizeRuntimeSurvivorList(
    updatedSurvivors.map((actor) => {
      if (!actor || Number(actor?.hp || 0) <= 0) return actor;
      if (!clashZone || String(actor.zoneId || '') === clashZone) return actor;
      return {
        ...actor,
        zoneId: clashZone,
        detonationMaxSec: Math.max(Number(actor?.detonationMaxSec || 0), detMax),
        detonationSec: Math.max(Number(actor?.detonationSec || 0), criticalSec + 8),
        aiTargetZoneId: null,
        aiTargetTTL: 0,
      };
    })
  ).filter((actor) => Number(actor?.hp || 0) > 0);

  addLog(`🔥 서든데스 교전 집결: 생존 팀이 ${getZoneName(clashZone)}로 진입합니다.`, 'highlight');
  emitRunEvent('sudden_death_gather', {
    zoneId: clashZone,
    teamCount: aliveTeamsBeforeClash.length,
  }, atNow());

  return {
    ran: true,
    updatedSurvivors: gathered,
  };
}

function runForcedSuddenDeathClash(opts = {}) {
  const {
    addLog,
    appendPhaseDeadSnapshots,
    assistCounts = {},
    emitDeathRunEventOnce,
    estimatePower,
    flushDeadSnapshots,
    killCounts = {},
    newDeadIds = [],
    phaseIdxNow = 0,
    roundAssists = {},
    roundKills = {},
    ruleset,
    setDeathMetadata,
    suddenDeathActive = false,
    survivorMap,
  } = opts;
  if (!suddenDeathActive || ruleset?.suddenDeath?.forcedClash === false) return { clashRounds: 0 };
  if (!survivorMap || typeof survivorMap.values !== 'function') return { clashRounds: 0 };

  const maxClashRounds = Math.max(1, Math.floor(Number(ruleset?.suddenDeath?.forceClashMaxRounds ?? 8)));
  const liveTeams = () => getAliveTeams(
    Array.from(survivorMap.values())
      .filter((actor) => actor && Number(actor.hp || 0) > 0 && !newDeadIds.includes(actor._id))
  );
  const scoreTeam = (team) => {
    const members = Array.isArray(team?.members) ? team.members : [];
    const hpSum = members.reduce((sum, member) => sum + Math.max(0, Number(member?.hp || 0)), 0);
    const powerSum = members.reduce((sum, member) => sum + Math.max(1, Number(estimatePower?.(member) || 0)), 0);
    const killSum = members.reduce((sum, member) => (
      sum + Number(killCounts?.[member?._id] || 0) + Number(roundKills?.[member?._id] || 0)
    ), 0);
    return powerSum + hpSum * 0.45 + killSum * 8 + Math.random() * 10;
  };

  let clashRound = 0;
  while (clashRound < maxClashRounds) {
    const teams = liveTeams();
    if (teams.length <= 1) break;
    const scored = teams
      .map((team) => ({ team, score: scoreTeam(team) }))
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    const top = scored[0];
    const challenger = scored[1];
    if (!top?.team || !challenger?.team) break;

    const totalScore = Math.max(1, Number(top.score || 0) + Number(challenger.score || 0));
    const topWins = Math.random() < (Number(top.score || 0) / totalScore);
    const winnerTeam = topWins ? top.team : challenger.team;
    const loserTeam = topWins ? challenger.team : top.team;
    const winnerRep = pickTeamRepresentative(
      winnerTeam.members,
      { ...(killCounts || {}), ...(roundKills || {}) },
      { ...(assistCounts || {}), ...(roundAssists || {}) }
    ) || winnerTeam.members?.[0];
    const loserMembers = (Array.isArray(loserTeam?.members) ? loserTeam.members : [])
      .map((member) => survivorMap.get(String(member?._id || '')) || member)
      .filter((member) => member && Number(member.hp || 0) > 0 && !newDeadIds.includes(member._id));
    if (!winnerRep || !loserMembers.length) break;

    addLog?.(`🔥 서든데스 결판: [${winnerTeam.teamName || getActorTeamName(winnerRep)}]이(가) [${loserTeam.teamName || '상대 팀'}]을 몰아냅니다.`, 'death');
    const winnerId = String(winnerRep?._id || '');
    roundKills[winnerId] = (roundKills[winnerId] || 0) + loserMembers.length;
    for (const loser of loserMembers) {
      loser.hp = 0;
      setDeathMetadata?.(loser, 'sudden_death_clash', { causeName: '서든데스 교전', by: winnerId });
      loser.deadAtPhaseIdx = phaseIdxNow;
      loser.reviveEligible = false;
      if (!newDeadIds.includes(loser._id)) newDeadIds.push(loser._id);
      survivorMap.set(String(loser._id || ''), loser);
      emitDeathRunEventOnce?.(loser, {
        by: winnerId,
        zoneId: String(loser?.zoneId || winnerRep?.zoneId || ''),
        reason: 'sudden_death_clash',
        cause: '서든데스 교전',
      });
    }
    const detBonus = Math.max(5, Number(ruleset?.detonation?.killBonusSec || 5));
    winnerRep.detonationSec = Math.max(Number(winnerRep?.detonationSec || 0), Number(ruleset?.detonation?.criticalSec || 5) + detBonus);
    survivorMap.set(String(winnerRep._id || ''), winnerRep);
    flushDeadSnapshots?.(appendPhaseDeadSnapshots?.(loserMembers));
    clashRound += 1;
  }
  return { clashRounds: clashRound };
}

export {
  runForcedSuddenDeathClash,
  runSuddenDeathGatherPhase,
};
