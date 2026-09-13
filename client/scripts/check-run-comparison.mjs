import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './lib/register-simulation-modules.mjs';

const { buildSimulationRunComparison, formatComparisonMetric } = await import('../src/app/simulation/_lib/simulationRunComparisonRuntime.js');
const { REPLAY_SCHEMA } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
const comparisonComponent = readFileSync(new URL('../src/app/simulation/_components/SimulationReplayHistory.js', import.meta.url), 'utf8');
const simulationCss = readFileSync(new URL('../src/styles/ERSimulation.css', import.meta.url), 'utf8');

let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
const actor = (id, teamId, extra = {}) => ({ _id: id, name: id.toUpperCase(), teamId, teamName: teamId,
  zoneId: 'z', hp: 100, maxHp: 100, tacticalSkill: '치유의 바람', weaponType: '검', stats: { attackPower: 20 }, ...extra });
const record = (id, extra = {}) => ({ schema: REPLAY_SCHEMA, id, input: { schema: REPLAY_SCHEMA,
  engineVersion: SIMULATION_ENGINE_VERSION, runSeed: 'seed', map: { _id: 'map', name: '루미아 섬', zones: [{ zoneId: 'z' }] },
  settings: { matchMode: 'squad', rulesetId: 'default', characterSkillsEnabled: true,
    battle: { damage: 1 }, simulationRuleset: {} }, publicItems: [], kiosks: [], droneOffers: [],
  initialFrame: { day: 0, phase: 'night', matchSec: 0,
    survivors: [actor('a', 'red'), actor('b', 'blue')], dead: [], killCounts: {}, assistCounts: {} } },
  events: [{ kind: 'craft' }, { kind: 'team_engagement' }, { kind: 'team_strike', damage: 12 },
    { kind: 'field_resource', qty: 2 }, { kind: 'dimension_rift', winnerTeamId: 'red' },
    { kind: 'match_end', outcome: 'last_team' }], random: { calls: 10, state: 12 },
  finalFrame: { matchSec: 120, survivors: [actor('a', 'red')], dead: [actor('b', 'blue', { hp: 0 })], killCounts: { a: 1 }, assistCounts: {} },
  summary: { winnerTeamName: 'red', ending: { outcome: 'last_team', atSec: 120 } }, ...extra });

check('identical records are classified as replay evidence rather than strategy evidence', () => {
  const a = record('a'); const out = buildSimulationRunComparison(a, structuredClone({ ...a, id: 'b' }));
  assert.equal(out.sameSeed, true); assert.equal(out.conditionChanges.length, 0); assert.equal(out.actorChanges.length, 0);
  assert.equal(out.inputChangeCount, 0); assert.equal(out.metrics.every((row) => row.delta === 0), true);
  assert.match(out.interpretation, /재현 불일치/);
});

check('team, tactical, weapon, stat and roster changes remain attributable to named actors', () => {
  const before = record('a'); const after = record('b');
  after.input.initialFrame.survivors[0] = actor('a', 'blue', { tacticalSkill: '붉은 폭풍', weaponType: '방망이', stats: { attackPower: 30 } });
  after.input.initialFrame.survivors.push(actor('c', 'green'));
  const out = buildSimulationRunComparison(before, after);
  assert.ok(out.conditionChanges.some((row) => row.key === 'teamRoster'));
  assert.ok(out.actorChanges.some((row) => row.actorId === 'a' && row.key === 'team'));
  assert.ok(out.actorChanges.some((row) => row.actorId === 'a' && row.key === 'tacticalSkill'));
  assert.ok(out.actorChanges.some((row) => row.actorId === 'a' && row.key === 'weaponType'));
  assert.ok(out.actorChanges.some((row) => row.actorId === 'a' && row.key === 'stats'
    && row.before === '기준 구성' && row.after === '변경 구성'));
  assert.ok(out.actorChanges.some((row) => row.actorId === 'c' && row.label === '참가자 추가'));
  assert.equal(out.inputChangeCount, out.actorChanges.length, 'the aggregate roster row must not be counted twice');
});

check('map, settings and seed changes are explicit and prevent a false controlled claim', () => {
  const before = record('a'); const after = record('b'); after.input.runSeed = 'other';
  after.input.map = { _id: 'custom', name: '사용자 지도', zones: [{ zoneId: 'z' }] };
  after.input.settings.matchMode = 'solo'; after.input.settings.battle = { damage: 2 };
  const out = buildSimulationRunComparison(before, after);
  assert.equal(out.sameSeed, false); assert.ok(out.conditionChanges.some((row) => row.key === 'runSeed'));
  assert.ok(out.conditionChanges.some((row) => row.key === 'map')); assert.ok(out.conditionChanges.some((row) => row.key === 'settings.matchMode'));
  assert.ok(out.conditionChanges.some((row) => row.key === 'settings.battle'
    && row.before === '기준 세부값' && row.after === '변경 세부값'));
  assert.match(out.interpretation, /편성·전략만의 영향으로 단정할 수 없습니다/);
});

check('local map bookkeeping metadata does not fabricate a gameplay map change', () => {
  const before = record('a'); const after = record('b');
  before.input.map = { ...before.input.map, updatedAt: 100, localUser: true, guestDefault: false };
  after.input.map = { ...after.input.map, updatedAt: 200, localUser: false, guestDefault: true };
  const out = buildSimulationRunComparison(before, after);
  assert.equal(out.conditionChanges.some((row) => row.key === 'map'), false);
});

check('outcome metrics use committed final state and semantic events', () => {
  const before = record('a'); const after = record('b', {
    events: [{ kind: 'craft' }, { kind: 'craft' }, { kind: 'team_engagement' }, { kind: 'team_engagement' },
      { kind: 'team_strike', damage: 20 }, { kind: 'team_strike', damage: 15 }, { kind: 'field_resource', qty: 5 },
      { kind: 'match_end', outcome: 'no_survivors' }],
    finalFrame: { matchSec: 180, survivors: [], dead: [actor('a', 'red', { hp: 0 }), actor('b', 'blue', { hp: 0 })], killCounts: { a: 1, b: 1 } },
    summary: { winnerTeamName: '', winnerName: '', ending: { outcome: 'no_survivors', atSec: 180 } },
  });
  const out = buildSimulationRunComparison(before, after); const metric = (key) => out.metrics.find((row) => row.key === key);
  assert.equal(metric('durationSec').delta, 60); assert.equal(metric('survivors').delta, -1);
  assert.equal(metric('kills').delta, 1); assert.equal(metric('crafts').delta, 1);
  assert.equal(metric('teamRounds').delta, 1); assert.equal(metric('teamDamage').delta, 23);
  assert.equal(metric('resourceUnits').delta, 3); assert.match(out.highlights[0], /우승 결과/);
});

check('one changed condition with the same seed is distinguished from a multi-change comparison', () => {
  const before = record('a'); const one = record('b'); one.input.initialFrame.survivors[0].tacticalSkill = '붉은 폭풍';
  const oneResult = buildSimulationRunComparison(before, one);
  assert.equal(oneResult.sameSeed, true);
  assert.equal(oneResult.inputChangeCount, 1); assert.match(oneResult.interpretation, /한 조건만/);
  assert.deepEqual(oneResult.conditionChanges, []);
  assert.deepEqual(oneResult.actorChanges.map((row) => row.key), ['tacticalSkill']);
  one.input.initialFrame.survivors[0].weaponType = '방망이';
  const multipleResult = buildSimulationRunComparison(before, one);
  assert.equal(multipleResult.inputChangeCount, 2); assert.match(multipleResult.interpretation, /여러 조건/);
});

check('a same-seed formation-only change remains attributable to the named actor', () => {
  const before = record('a'); const after = record('b');
  after.input.initialFrame.survivors[0].teamId = 'blue';
  const out = buildSimulationRunComparison(before, after);
  assert.equal(out.sameSeed, true);
  assert.equal(out.inputChangeCount, 1);
  assert.deepEqual(out.conditionChanges.map((row) => row.key), ['teamRoster']);
  assert.deepEqual(out.actorChanges.map((row) => row.key), ['team']);
  assert.match(out.interpretation, /한 조건만/);
});

check('a seed-only change is separated from controlled same-seed strategy comparison', () => {
  const before = record('a'); const after = record('b'); after.input.runSeed = 'other-seed';
  const out = buildSimulationRunComparison(before, after);
  assert.equal(out.sameSeed, false);
  assert.equal(out.inputChangeCount, 1);
  assert.deepEqual(out.conditionChanges.map((row) => row.key), ['runSeed']);
  assert.deepEqual(out.actorChanges, []);
  assert.match(out.interpretation, /난수 시드도 달라졌으므로/);
});

check('a tactical-only guest edit does not invent changes from disabled skill defaults', () => {
  const before = record('a'); const after = record('b');
  after.input.initialFrame.survivors[0] = {
    ...after.input.initialFrame.survivors[0],
    tacticalSkill: '블링크',
    characterSkills: Object.fromEntries(['q', 'w', 'e', 'r', 'passive']
      .map((slot) => [slot, { enabled: false, name: '', slot }])),
    characterSkillLevels: {},
    uniqueResource: { enabled: false, name: '', maxValue: 0, startValue: 0, regenPerSec: 0 },
  };
  const out = buildSimulationRunComparison(before, after);
  const changes = out.actorChanges.filter((row) => row.actorId === 'a');
  assert.deepEqual(changes.map((row) => row.key), ['tacticalSkill']);
  assert.equal(out.inputChangeCount, 1);
  assert.match(out.interpretation, /한 조건만/);
});

check('missing final or input evidence is rejected without fabricating a comparison', () => {
  assert.throws(() => buildSimulationRunComparison({}, record('b')), /시작 조건 또는 최종 기록/);
  assert.throws(() => buildSimulationRunComparison(record('a'), { input: {} }), /시작 조건 또는 최종 기록/);
});

check('outdated engines and incomplete outcome archives are rejected before comparison', () => {
  const outdated = record('old'); outdated.input.engineVersion = 'old-engine';
  assert.throws(() => buildSimulationRunComparison(record('a'), outdated), /경기 규칙이 업데이트/);
  for (const field of ['events', 'random']) {
    const broken = record(`missing-${field}`); delete broken[field];
    assert.throws(() => buildSimulationRunComparison(record('a'), broken), /경기 결과 기록이 손상/);
  }
  const noEnding = record('missing-ending'); delete noEnding.summary.ending;
  assert.throws(() => buildSimulationRunComparison(record('a'), noEnding), /경기 결과 기록이 손상/);
});

check('explicitly different ending judgments remain visible even when the final roster is equal', () => {
  const before = record('a'); const after = record('b');
  after.summary.ending = { outcome: 'no_survivors', atSec: 120 };
  const out = buildSimulationRunComparison(before, after);
  assert.equal(out.sameEnding, false);
  assert.equal(out.endingBefore, '마지막 팀 생존'); assert.equal(out.endingAfter, '전원 탈락');
  assert.ok(out.highlights.some((line) => /종료 판정/.test(line)));
});

check('ending time and metadata differences do not fabricate a changed judgment', () => {
  const before = record('a'); const after = record('b');
  before.summary.ending = { outcome: 'last_team', atSec: 120, day: 6, phase: 'night', cause: 'combat', causeName: '교전', winnerTeamId: 'red' };
  after.summary.ending = { outcome: 'last_team', atSec: 180, day: 7, phase: 'morning', cause: 'combat', causeName: '교전', winnerTeamId: 'blue', dimensionRifts: { closed: 1 } };
  const out = buildSimulationRunComparison(before, after);
  assert.equal(out.sameEnding, true);
  assert.equal(out.endingBefore, '마지막 팀 생존 · 교전');
  assert.equal(out.endingAfter, '마지막 팀 생존 · 교전');
  assert.equal(out.highlights.some((line) => /종료 판정/.test(line)), false);
});

check('comparison history renders both evidence columns and the responsive result contract', () => {
  for (const token of [
    'buildSimulationRunComparison', '기준:', '대상:', 'comparison.interpretation',
    '바뀐 시작 조건', '달라진 결과 지표', 'sim-run-comparison-table',
    'sim-run-comparison-highlights', 'role="table"', 'aria-label="경기 결과 지표 비교"',
  ]) assert.ok(comparisonComponent.includes(token), `comparison UI contract missing: ${token}`);
  assert.match(simulationCss, /\.sim-replay-history\s*\{[\s\S]*?width:\s*min\(800px,\s*100%\)[\s\S]*?max-height:\s*85vh[\s\S]*?overflow-y:\s*auto/);
  assert.match(simulationCss, /\.sim-replay-history li span\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(simulationCss, /@media\s*\(max-width:\s*680px\)[\s\S]*?\.sim-run-comparison-selection\s*\{\s*grid-template-columns:\s*1fr;\s*\}[\s\S]*?\.sim-run-comparison-table > div\s*\{[\s\S]*?minmax\(54px,\s*\.55fr\)/);
});

check('metric formatting preserves fractional game seconds and ordinary units', () => {
  assert.equal(formatComparisonMetric(125.25, 'sec'), '2:05.25');
  assert.equal(formatComparisonMetric(59.999, 'sec'), '1:00.00');
  assert.equal(formatComparisonMetric(65, 'sec'), '1:05');
  assert.equal(formatComparisonMetric(3, '회'), '3회');
});

console.log(`Run-comparison checks: ${checks}`);
