import { buildRunActionSummary } from './runActionSummary.js';
import { validateSimulationReplayRecord } from './simulationReplayRuntime';

const idOf = (actor) => String(actor?._id || actor?.id || '');
const teamIdOf = (actor) => String(actor?.matchTeamId || actor?.teamId || actor?.squadId || idOf(actor));
const actorName = (actor) => String(actor?.name || idOf(actor) || '이름 없음');
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function comparableMap(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return map;
  const { updatedAt: _updatedAt, localUser: _localUser, guestDefault: _guestDefault, ...content } = map;
  return content;
}

function initialActors(record) {
  return Array.isArray(record?.input?.initialFrame?.survivors) ? record.input.initialFrame.survivors : [];
}

function finalActors(record) {
  return [...(Array.isArray(record?.finalFrame?.survivors) ? record.finalFrame.survivors : []),
    ...(Array.isArray(record?.finalFrame?.dead) ? record.finalFrame.dead : [])];
}

function teamRosterSignature(record) {
  const teams = new Map();
  for (const actor of initialActors(record)) {
    const teamId = teamIdOf(actor);
    if (!teams.has(teamId)) teams.set(teamId, []);
    teams.get(teamId).push(idOf(actor));
  }
  return [...teams.entries()].map(([teamId, ids]) => [teamId, ids.sort()]).sort(([a], [b]) => a.localeCompare(b));
}

function shortValue(value) {
  if (value == null || value === '') return '없음';
  if (typeof value === 'boolean') return value ? '사용' : '미사용';
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  return '세부값 변경';
}

function changedValuePair(beforeValue, afterValue, beforeComplex = '기준 세부값', afterComplex = '변경 세부값') {
  const isComplex = (value) => value != null && typeof value === 'object';
  return {
    before: isComplex(beforeValue) ? beforeComplex : shortValue(beforeValue),
    after: isComplex(afterValue) ? afterComplex : shortValue(afterValue),
  };
}

function activeCharacterSkills(actor) {
  const source = actor?.characterSkills && typeof actor.characterSkills === 'object' && !Array.isArray(actor.characterSkills)
    ? actor.characterSkills : {};
  return Object.fromEntries(Object.keys(source).sort()
    .filter((slot) => source[slot]?.enabled === true)
    .map((slot) => [slot, source[slot]]));
}

function activeCharacterSkillLevels(actor) {
  const activeSkills = activeCharacterSkills(actor);
  const source = actor?.characterSkillLevels && typeof actor.characterSkillLevels === 'object'
    && !Array.isArray(actor.characterSkillLevels) ? actor.characterSkillLevels : {};
  return Object.fromEntries(Object.keys(activeSkills).sort().flatMap((slot) => {
    const level = Number(source[slot]);
    return Number.isFinite(level) && level >= 1 && level <= 5 ? [[slot, Math.floor(level)]] : [];
  }));
}

function activeUniqueResource(actor) {
  return actor?.uniqueResource?.enabled === true ? actor.uniqueResource : {};
}

const SETTING_LABELS = {
  matchMode: '경기 모드', rulesetId: '규칙 세트', characterSkillsEnabled: '캐릭터 스킬', suddenDeathTurn: '최종전 시점',
  forbiddenZoneEnabled: '금지구역', forbiddenZoneStartDay: '금지구역 시작 일차', forbiddenZoneStartPhase: '금지구역 시작 시간대',
  forbiddenZoneDamageBase: '금지구역 피해', weaponSkillCooldownSec: '무기 스킬 쿨다운', erMetaScale: 'ER 성향 반영',
  statWeights: '능력치 가중치', battle: '전투 세부 규칙', skills: '스킬 세부 규칙', equipment: '장비 세부 규칙',
  simulationRuleset: '사용자 규칙 내용',
};

function compareConditions(baseline, candidate) {
  const changes = [];
  const leftSeed = String(baseline?.input?.runSeed ?? ''); const rightSeed = String(candidate?.input?.runSeed ?? '');
  if (leftSeed !== rightSeed) changes.push({ key: 'runSeed', label: '난수 시드', before: leftSeed || '없음', after: rightSeed || '없음' });
  const leftMap = baseline?.input?.map || {}; const rightMap = candidate?.input?.map || {};
  if (String(leftMap._id || leftMap.id || '') !== String(rightMap._id || rightMap.id || '')
    || canonical(comparableMap(leftMap)) !== canonical(comparableMap(rightMap))) {
    const beforeName = String(leftMap.name || leftMap._id || leftMap.id || '없음');
    const afterName = String(rightMap.name || rightMap._id || rightMap.id || '없음');
    changes.push({ key: 'map', label: '지도/지역 규칙', before: beforeName,
      after: beforeName === afterName ? `${afterName} · 세부 규칙 변경` : afterName });
  }
  const leftSettings = baseline?.input?.settings || {}; const rightSettings = candidate?.input?.settings || {};
  for (const key of [...new Set([...Object.keys(leftSettings), ...Object.keys(rightSettings)])].sort()) {
    if (canonical(leftSettings[key]) === canonical(rightSettings[key])) continue;
    const pair = changedValuePair(leftSettings[key], rightSettings[key]);
    changes.push({ key: `settings.${key}`, label: SETTING_LABELS[key] || `설정 ${key}`,
      before: pair.before, after: pair.after });
  }
  const beforeRoster = teamRosterSignature(baseline); const afterRoster = teamRosterSignature(candidate);
  if (canonical(beforeRoster) !== canonical(afterRoster)) {
    changes.push({ key: 'teamRoster', label: '팀 편성', before: `${beforeRoster.length}팀`, after: `${afterRoster.length}팀` });
  }
  return changes;
}

function compareActors(baseline, candidate) {
  const left = new Map(initialActors(baseline).map((actor) => [idOf(actor), actor]));
  const right = new Map(initialActors(candidate).map((actor) => [idOf(actor), actor]));
  const changes = [];
  for (const id of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    const before = left.get(id); const after = right.get(id);
    if (!before) { changes.push({ actorId: id, actorName: actorName(after), label: '참가자 추가', before: '불참', after: '참가' }); continue; }
    if (!after) { changes.push({ actorId: id, actorName: actorName(before), label: '참가자 제외', before: '참가', after: '불참' }); continue; }
    const fields = [
      ['team', '소속 팀', teamIdOf(before), teamIdOf(after)],
      ['name', '이름', actorName(before), actorName(after)],
      ['tacticalSkill', '전술 스킬', before.tacticalSkill, after.tacticalSkill],
      ['weaponType', '무기', before.weaponType, after.weaponType],
      ['erRole', '역할', before.erRole, after.erRole],
      ['erTrait', '특성', before.erTrait, after.erTrait],
      ['goalGearTier', '목표 장비', before.goalGearTier, after.goalGearTier],
      ['characterSkills', '캐릭터 스킬 구성', activeCharacterSkills(before), activeCharacterSkills(after)],
      ['characterSkillLevels', '스킬 레벨', activeCharacterSkillLevels(before), activeCharacterSkillLevels(after)],
      ['uniqueResource', '고유 자원 구성', activeUniqueResource(before), activeUniqueResource(after)],
      ['stats', '기본 능력치', before.stats, after.stats],
      ['goalLoadouts', '목표 장비 구성', before.goalLoadouts, after.goalLoadouts],
    ];
    for (const [key, label, beforeValue, afterValue] of fields) {
      if (canonical(beforeValue) === canonical(afterValue)) continue;
      const pair = changedValuePair(beforeValue, afterValue, '기준 구성', '변경 구성');
      changes.push({ actorId: id, actorName: actorName(after), key, label,
        before: pair.before, after: pair.after });
    }
  }
  return changes;
}

function eventCount(record, kind) {
  return (Array.isArray(record?.events) ? record.events : []).filter((event) => event?.kind === kind).length;
}

function sumValues(object) {
  return Object.values(object && typeof object === 'object' ? object : {}).reduce((sum, value) => sum + Math.max(0, finite(value)), 0);
}

function outcomeMetrics(record) {
  const action = buildRunActionSummary(record?.events || []);
  const living = Array.isArray(record?.finalFrame?.survivors) ? record.finalFrame.survivors.length : 0;
  const dead = Array.isArray(record?.finalFrame?.dead) ? record.finalFrame.dead.length : 0;
  return {
    durationSec: finite(record?.summary?.ending?.atSec ?? record?.finalFrame?.matchSec),
    survivors: living,
    eliminated: dead,
    kills: sumValues(record?.finalFrame?.killCounts),
    crafts: eventCount(record, 'craft'),
    hunts: eventCount(record, 'hunt_settlement'),
    teamRounds: finite(action.teamCombat?.rounds),
    teamStrikes: finite(action.teamCombat?.strikes),
    teamDamage: finite(action.teamCombat?.damage),
    retreats: finite(action.team?.retreats),
    resourceUnits: finite(action.fieldResources?.units),
    resourceReplans: finite(action.fieldResources?.replans),
    riftWins: (record?.events || []).filter((event) => event?.kind === 'dimension_rift' && event.winnerTeamId).length,
  };
}

const METRICS = [
  ['durationSec', '경기 시간', 'sec'], ['survivors', '최종 생존자', '명'], ['eliminated', '탈락자', '명'], ['kills', '총 킬', '회'],
  ['crafts', '제작 완료', '회'], ['hunts', '사냥 결산', '회'], ['teamRounds', '팀 교전', '회'], ['teamStrikes', '팀원 공격', '회'],
  ['teamDamage', '팀 공격 피해', ''], ['retreats', '열세 후퇴', '회'], ['resourceUnits', '공유 자원 획득', '개'],
  ['resourceReplans', '자원 고갈 재계획', '회'], ['riftWins', '차원의 틈 승리', '회'],
];

function winnerLabel(record) {
  return String(record?.summary?.winnerTeamName || record?.summary?.winnerName || '생존자 없음');
}

const ENDING_LABELS = { last_team: '마지막 팀 생존', no_survivors: '전원 탈락' };

function endingLabel(record) {
  const ending = record?.summary?.ending || {};
  const outcome = ENDING_LABELS[ending.outcome] || String(ending.outcome || '판정 없음');
  const cause = String(ending.causeName || ending.cause || '').trim();
  return cause ? `${outcome} · ${cause}` : outcome;
}

export function buildSimulationRunComparison(baseline, candidate) {
  if (!baseline?.input || !candidate?.input || !baseline?.finalFrame || !candidate?.finalFrame) {
    throw new Error('비교할 경기의 시작 조건 또는 최종 기록이 없습니다.');
  }
  validateSimulationReplayRecord(baseline);
  validateSimulationReplayRecord(candidate);
  const conditionChanges = compareConditions(baseline, candidate);
  const actorChanges = compareActors(baseline, candidate);
  const left = outcomeMetrics(baseline); const right = outcomeMetrics(candidate);
  const metrics = METRICS.map(([key, label, unit]) => ({ key, label, unit, before: left[key], after: right[key], delta: right[key] - left[key] }));
  const winnerBefore = winnerLabel(baseline); const winnerAfter = winnerLabel(candidate);
  const endingBefore = endingLabel(baseline); const endingAfter = endingLabel(candidate);
  // A comparison already reports elapsed time, winner and other result metrics
  // separately.  Those details must not turn the same visible end judgment into
  // a fabricated "ending changed" highlight.
  const sameEnding = endingBefore === endingAfter;
  const sameSeed = String(baseline.input.runSeed ?? '') === String(candidate.input.runSeed ?? '');
  const inputChangeCount = conditionChanges.filter((row) => row.key !== 'teamRoster').length + actorChanges.length;
  const changedOutcomeMetrics = metrics.filter((row) => row.delta !== 0);
  const highlights = [];
  if (winnerBefore !== winnerAfter) highlights.push(`우승 결과가 ${winnerBefore}에서 ${winnerAfter}(으)로 바뀌었습니다.`);
  if (!sameEnding) highlights.push(`종료 판정이 ${endingBefore}에서 ${endingAfter}(으)로 바뀌었습니다.`);
  for (const row of changedOutcomeMetrics.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5)) {
    const delta = `${row.delta > 0 ? '+' : '-'}${formatComparisonMetric(Math.abs(row.delta), row.unit)}`;
    highlights.push(`${row.label}: ${formatComparisonMetric(row.before, row.unit)} → ${formatComparisonMetric(row.after, row.unit)} (${delta})`);
  }
  const interpretation = !sameSeed
    ? '난수 시드도 달라졌으므로 결과 차이를 편성·전략만의 영향으로 단정할 수 없습니다.'
    : inputChangeCount === 0
      ? '같은 시작 조건과 시드입니다. 결과가 다르면 재현 불일치로 다뤄야 하며 전략 비교 근거가 아닙니다.'
      : inputChangeCount === 1
        ? '시드는 같고 기록상 한 조건만 달라졌습니다. 결과 차이와 함께 읽을 수 있지만 한 경기만으로 인과를 확정하지 않습니다.'
        : '시드는 같지만 여러 조건이 함께 달라졌습니다. 어떤 변경이 결과를 만들었는지는 한 조건씩 바꾼 추가 경기가 필요합니다.';
  return { baselineId: String(baseline.id || ''), candidateId: String(candidate.id || ''), sameSeed,
    winnerBefore, winnerAfter, endingBefore, endingAfter, sameEnding,
    conditionChanges, actorChanges, inputChangeCount, metrics, highlights, interpretation,
    participantNamesBefore: finalActors(baseline).map(actorName), participantNamesAfter: finalActors(candidate).map(actorName) };
}

export function formatComparisonMetric(value, unit = '') {
  const number = finite(value);
  if (unit === 'sec') {
    const clamped = Math.max(0, number);
    if (!Number.isInteger(clamped)) {
      const hundredths = Math.round(clamped * 100);
      const minutes = Math.floor(hundredths / 6000);
      const seconds = (hundredths - minutes * 6000) / 100;
      return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
    }
    const minutes = Math.floor(clamped / 60); const seconds = clamped - minutes * 60;
    return `${minutes}:${seconds.toFixed(0).padStart(2, '0')}`;
  }
  return `${Number.isInteger(number) ? number : number.toFixed(2)}${unit}`;
}
