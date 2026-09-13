import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const { advanceDimensionRiftContest, findActorDimensionRift } = await import('../src/app/simulation/_lib/dimensionRiftContestRuntime.js');
const { tryClaimDimensionRiftReward } = await import('../src/app/simulation/_lib/dimensionRiftRewardRuntime.js');
const { runDimensionRiftPhase } = await import('../src/app/simulation/_lib/phaseDimensionRiftRuntime.js');
const { buildDimensionRiftSpawn, resolveDimensionRiftWinner } = await import('../src/app/simulation/_lib/dimensionRiftRuntime.js');
const { cloneSpawnState } = await import('../src/app/simulation/_lib/spawnStateRuntime.js');
const { chooseAiMoveTargets } = await import('../src/app/simulation/_lib/aiMoveTargetRuntime.js');
const { buildTeamMovementPlans } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { runPvpActionLoop } = await import('../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');

let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
const item = { _id: 'meteor', name: '운석', type: 'material', tier: 4, tags: ['meteor'] };
const base = getRuleset('ER_S11');
const ruleset = { ...base,
  ai: { ...base.ai, escapeHpBelow: 0, fightAvoidMinRatio: 0 },
  pvp: { ...base.pvp, criticalFleeHpBelow: 0, postBattleMoveChance: 0,
    lootInventoryUnits: 0, lootCreditMin: 0, lootCreditRate: 0, restHealMax: 0, postBattleRestExtraHealMax: 0 },
  inventory: { ...base.inventory, maxSlots: 3, stackMax: { material: 6, equipment: 1 }, autoDropLowValue: false },
  worldSpawns: { ...base.worldSpawns, dimensionRift: { enabled: true, entryWindowSec: 45,
    contestChance: 1, rewardCreditsByDay: { 2: 45 } } },
};
const actor = (id, teamId = id, extra = {}) => ({ _id: id, name: id, teamId, teamName: teamId,
  zoneId: 'z', hp: 100, maxHp: 100, simCredits: 5, inventory: [],
  stats: { maxHp: 100, attackPower: 20, defense: 0, attackSpeed: 1 },
  _spatial: { zoneId: 'z', x: 4, y: 4 }, tacticalSkill: 'none', _tacNextAbsSec: 99999,
  _objectiveContestType: 'dimension_rift', _objectiveContestUntilPhaseIdx: 3, ...extra });
const rift = (extra = {}) => ({ id: 'r', day: 2, phase: 'night', zoneId: 'z', zoneName: '틈',
  maxTeams: 2, resolved: false, entrantTeamIds: [], entrants: [], ...extra });
const step = (subject, rows, nowSec = 100, extra = {}) => advanceDimensionRiftContest(subject, rows, {
  nowSec, phaseStartSec: 100, phaseDurationSec: 120, day: 2, phase: 'night', phaseIdxNow: 3,
  rule: ruleset.worldSpawns.dimensionRift, ...extra,
});
const claim = (subject, rows, nowSec = 145, extra = {}) => withSimulationRandom(() => 0.5,
  () => tryClaimDimensionRiftReward(subject, rows, { publicItems: [item], ruleset, nowSec, day: 2, ...extra }));
const soloWin = (rows = [actor('a')]) => {
  const subject = rift(); step(subject, rows); step(subject, rows, 145); return { subject, rows };
};

await check('an empty opening remains available for later arrivals', () => {
  const subject = rift(); step(subject, [], 100);
  assert.equal(subject.resolved, false); assert.equal(subject.entryClosesAtSec, 145);
  assert.equal(step(subject, [actor('a')], 120).joined.length, 1);
  assert.equal(subject.resolved, false);
});
await check('a passing team without an objective decision is not enrolled', () => {
  const subject = rift(); step(subject, [actor('a', 'a', { _objectiveContestType: '' })]);
  assert.deepEqual(subject.entrantTeamIds, []);
});
await check('a stale previous-phase intention is not an entry decision', () => {
  const subject = rift(); step(subject, [actor('a', 'a', { _objectiveContestUntilPhaseIdx: 2 })]);
  assert.deepEqual(subject.entrantTeamIds, []);
});
await check('uncontested rewards wait for the actual entry deadline', () => {
  const subject = rift(); const rows = [actor('a')]; step(subject, rows);
  assert.equal(step(subject, rows, 144.999999).resolution, null);
  const result = step(subject, rows, 145).resolution;
  assert.equal(result.reason, 'uncontested'); assert.equal(result.winnerTeamId, 'a');
  assert.equal(rows[0].hp, 100); assert.equal(rows[0].simCredits, 5);
});
await check('two living teams are never resolved by power or random scoring', () => {
  const teams = [{ teamId: 'a', members: [actor('a', 'a', { power: 999999 })] },
    { teamId: 'b', members: [actor('b', 'b', { power: 1 })] }];
  assert.equal(resolveDimensionRiftWinner(teams, { entryClosed: true }), null);
  assert.equal(resolveDimensionRiftWinner(teams, () => { throw new Error('Score callback must be unused'); }), null);
});
await check('the real last entrant death resolves without changing HP or inventory', () => {
  const subject = rift(); const rows = [actor('a'), actor('b')]; step(subject, rows);
  const resources = (actors) => actors.map(({ hp, maxHp, zoneId, inventory, simCredits, activeEffects, skillState }) =>
    structuredClone({ hp, maxHp, zoneId, inventory, simCredits, activeEffects, skillState }));
  rows[1].hp = 0; const snapshot = resources(rows);
  const result = step(subject, rows, 145);
  assert.equal(result.resolution.winnerTeamId, 'a'); assert.equal(subject.entrants[1].outcome, 'eliminated');
  assert.deepEqual(resources(rows), snapshot);
  assert.ok(rows.every((row) => row._combatSpaceId === 'world'));
});
await check('withdrawal retains the actual return zone and low HP without a 65 percent reset', () => {
  const subject = rift(); const rows = [actor('a'), actor('b')]; step(subject, rows);
  rows[1].hp = 9; rows[1].zoneId = 'away';
  const result = step(subject, rows, 145);
  assert.equal(result.resolution.winnerTeamId, 'a'); assert.equal(subject.entrants[1].outcome, 'withdrawn');
  assert.equal(rows[1].hp, 9); assert.equal(rows[1].zoneId, 'away');
});
await check('one fallen teammate is not an entire team defeat', () => {
  const subject = rift(); const rows = [actor('a'), actor('b1', 'b'), actor('b2', 'b')]; step(subject, rows);
  rows[1].hp = 0;
  assert.equal(step(subject, rows, 145).resolution, null); assert.equal(subject.resolved, false);
});
await check('missing roster evidence is not treated as an opponent death', () => {
  const subject = rift(); const rows = [actor('a'), actor('b')]; step(subject, rows);
  assert.equal(step(subject, [rows[0]], 145).resolution, null);
  assert.equal(subject.entrants[1].outcome, undefined);
});
await check('travelling actors cannot enter ahead of their arrival time', () => {
  const subject = rift(); const rows = [actor('a', 'a', { _actionReadyAtSec: 130 })];
  step(subject, rows); assert.deepEqual(subject.entrantTeamIds, []);
  step(subject, rows, 130); assert.deepEqual(subject.entrantTeamIds, ['a']);
});
await check('late teammates can join their admitted team before the deadline', () => {
  const subject = rift(); const a = actor('a1', 'a'); step(subject, [a]);
  step(subject, [a, actor('a2', 'a', { _objectiveContestType: '' })], 120);
  assert.deepEqual(subject.entrants[0].memberIds, ['a1', 'a2']);
});
await check('entry capacity does not expand to a third team', () => {
  const subject = rift(); step(subject, [actor('c'), actor('b'), actor('a')]);
  assert.deepEqual(subject.entrantTeamIds, ['a', 'b']);
});
await check('the same team cannot enter a second rift after JSON restore', () => {
  const first = rift(); const rows = [actor('a')]; step(first, rows);
  const saved = JSON.parse(JSON.stringify(first)); const second = rift({ id: 'r2' });
  step(second, rows, 110, { usedTeamIds: new Set(saved.entrantTeamIds) });
  assert.deepEqual(second.entrantTeamIds, []);
});
await check('no entrant and two surviving teams expire without a score winner', () => {
  for (const rows of [[], [actor('a'), actor('b')]]) {
    const subject = rift(); step(subject, rows); const out = step(subject, rows, 220);
    assert.equal(subject.resolved, true); assert.equal(out.resolution.winnerTeamId, '');
    assert.equal(claim(subject, rows, 220).claimed, false);
  }
});
await check('forbidden zone and old window closures grant no automatic victory', () => {
  for (const options of [{ forbiddenIds: new Set(['z']) }, { day: 3, phase: 'morning' }]) {
    const subject = rift(); const rows = [actor('a')]; step(subject, rows);
    const out = step(subject, rows, 120, options);
    assert.equal(out.resolution.winnerTeamId, ''); assert.equal(rows[0].hp, 100);
  }
});
await check('unknown duration and reversed observation time never accelerate rewards', () => {
  const subject = rift(); const rows = [actor('a')];
  step(subject, rows, 100, { phaseDurationSec: undefined }); assert.equal(subject.openedAtSec, undefined);
  step(subject, rows, 120); const snapshot = structuredClone(subject);
  step(subject, rows, 119); assert.deepEqual(subject, snapshot);
});
await check('nested contest and reward state are owned by the cloned spawn state', () => {
  const { subject, rows } = soloWin(); claim(subject, rows);
  const original = { mapId: 'm', dimensionRifts: [subject] };
  const cloned = cloneSpawnState(original, 'm');
  cloned.dimensionRifts[0].entrants[0].memberIds.push('other');
  cloned.dimensionRifts[0].rewardReceipt.credits[0].after = 999;
  assert.deepEqual(subject.entrants[0].memberIds, ['a']); assert.equal(subject.rewardReceipt.credits[0].after, 50);
});
await check('one world gift becomes one content item with one serialized credit receipt', () => {
  const { subject, rows } = soloWin(); const result = claim(subject, rows);
  assert.equal(result.claimed, true); assert.equal(invQty(rows[0].inventory, item._id), 1);
  assert.equal(rows[0].inventory.some((row) => String(row.itemId).includes('aglaia')), false);
  assert.equal(rows[0].simCredits, 50); assert.equal(subject.rewardOffer.remaining, 0);
  const saved = JSON.parse(JSON.stringify({ subject, rows }));
  assert.equal(claim(saved.subject, saved.rows, 200).reason, 'already_claimed');
  assert.equal(saved.rows[0].simCredits, 50); assert.equal(invQty(saved.rows[0].inventory, item._id), 1);
});
await check('full bags retain the gift and credits until one full receipt is possible', () => {
  const full = [1, 2, 3].map((n) => ({ itemId: `held-${n}`, name: `held-${n}`, type: 'material', tier: 4, qty: 6 }));
  const { subject, rows } = soloWin([actor('a', 'a', { inventory: full })]);
  const before = structuredClone(rows); assert.equal(claim(subject, rows).reason, 'inventory_full');
  assert.deepEqual(rows, before); assert.equal(subject.rewardOffer.remaining, 1);
  rows[0].inventory.pop(); assert.equal(claim(subject, rows, 164).reason, 'retry_later');
  assert.equal(claim(subject, rows, 165).claimed, true); assert.equal(rows[0].simCredits, 50);
});
await check('a teammate with space can receive the gift instead of discarding it', () => {
  const full = [1, 2, 3].map((n) => ({ itemId: `held-${n}`, name: `held-${n}`, type: 'material', tier: 4, qty: 6 }));
  const { subject, rows } = soloWin([actor('a1', 'a', { inventory: full }), actor('a2', 'a')]);
  const result = claim(subject, rows);
  assert.equal(result.receipt.who, 'a2'); assert.deepEqual(rows.map((row) => row.simCredits), [50, 50]);
  assert.deepEqual(rows[0].inventory, full);
});
await check('missing catalog contents do not create a virtual replacement or credits', () => {
  const { subject, rows } = soloWin(); const before = structuredClone(rows);
  const result = claim(subject, rows, 145, { publicItems: [] });
  assert.equal(result.reason, 'missing_catalog_content'); assert.deepEqual(rows, before);
  assert.equal(subject.rewardOffer.remaining, 1); assert.equal(subject.rewardReceipt, undefined);
});
await check('a dead reward recipient is not revived, credited or auto-equipped', () => {
  const { subject, rows } = soloWin(); rows[0].hp = 0; const before = structuredClone(rows);
  assert.equal(claim(subject, rows).reason, 'no_living_recipient'); assert.deepEqual(rows, before);
});
await check('invalid configured or current credits cannot contaminate a reward transaction', () => {
  const first = soloWin(); first.rows[0].simCredits = NaN;
  assert.equal(claim(first.subject, first.rows).reason, 'invalid_current_credits');
  assert.deepEqual(first.rows[0].inventory, []); assert.equal(first.subject.rewardOffer.remaining, 1);
  const second = soloWin();
  const badRules = { ...ruleset, worldSpawns: { dimensionRift: { rewardCreditsByDay: { 2: -1 } } } };
  assert.equal(claim(second.subject, second.rows, 145, { ruleset: badRules }).reason, 'invalid_reward_credits');
});
await check('non-default spawn phases use the same contest clock', () => {
  const out = withSimulationRandom(() => 0.5, () => buildDimensionRiftSpawn({ mapId: 'm' },
    [{ zoneId: 'z', name: '틈' }], new Set(), 2, 'morning', 'squad', 'm', { phase: 'morning', count: 1, maxTeams: 3 }));
  assert.ok(out.announcements[0].includes('3팀'));
  const subject = out.state.dimensionRifts[0]; const rows = [actor('a')];
  step(subject, rows, 100, { phase: 'morning' }); step(subject, rows, 145, { phase: 'morning' });
  assert.equal(subject.resolution.winnerTeamId, 'a');
});
await check('team rotation can choose a rift while preserving graph-based movement', () => {
  const spawn = { dimensionRifts: [rift({ zoneId: 'goal' })] };
  const rows = [actor('a1', 'a'), actor('a2', 'a')];
  const choose = (leader) => chooseAiMoveTargets({ actor: leader, mapObj: { zones: [] }, spawnState: spawn,
    forbiddenIds: new Set(), day: 2, phase: 'night', kiosks: [], nowSec: 100, ruleset });
  assert.equal(choose(rows[0]).objectiveType, 'dimension_rift');
  const plans = buildTeamMovementPlans({ roster: rows, zoneGraph: { z: ['middle'], middle: ['z', 'goal'], goal: ['middle'] },
    day: 2, phase: 'night', estimatePower: () => 1, chooseLeaderMove: choose });
  assert.equal(plans.get('a1').nextStep, 'middle'); assert.equal(plans.get('a2').objectiveType, 'dimension_rift');
});
await check('phase integration engages real opponents without inventing damage or a result', () => {
  const subject = rift(); const rows = [actor('a'), actor('b')]; const events = [];
  withSimulationRandom(() => 0.5, () => runDimensionRiftPhase({ state: { nextSpawn: { dimensionRifts: [subject] },
    updatedSurvivors: rows, currentActionSec: () => 100, phaseStartSec: 100, phaseDurationSec: 120,
    nextDay: 2, nextPhase: 'night', phaseIdxNow: 3, publicItems: [item], ruleset },
    actions: { emitRunEvent: (kind, payload) => events.push({ kind, ...payload }) } }));
  assert.equal(rows[0]._combatIntent.enemyTeamId, 'b'); assert.equal(rows[1]._combatIntent.enemyTeamId, 'a');
  assert.deepEqual(rows.map((row) => row.hp), [100, 100]); assert.equal(subject.resolved, false);
  assert.equal(events.some((event) => event.kind === 'dimension_rift_reward'), false);
  assert.equal(findActorDimensionRift({ dimensionRifts: [subject] }, rows[0]), subject);
});
await check('real PvP damage and arena defeat feed exactly one nonlethal rift settlement', async () => {
  const subject = rift(); const rows = [actor('a'), actor('b', 'b', { hp: 1 })];
  const localRules = { ...ruleset,
    ai: { ...ruleset.ai, escapeHpBelow: 0, fightAvoidMinRatio: 0, fightAvoidAbsDelta: 1e9 },
    worldSpawns: { ...ruleset.worldSpawns,
    dimensionRift: { ...ruleset.worldSpawns.dimensionRift, entryWindowSec: 3 } } };
  let offset = 0; let frames = 0; const events = [];
  const atNow = () => ({ day: 2, phase: 'night', sec: 100 + offset });
  const emitRunEvent = (kind, payload) => events.push({ kind, ...payload, at: atNow() });
  const observe = (survivorMap) => runDimensionRiftPhase({ state: { nextSpawn: { dimensionRifts: [subject] },
    updatedSurvivors: [...survivorMap.values()], currentActionSec: () => 100 + offset,
    phaseStartSec: 100, phaseDurationSec: 6, nextDay: 2, nextPhase: 'night', phaseIdxNow: 3,
    publicItems: [item], ruleset: localRules }, actions: { emitRunEvent, atNow } });
  let combatPromise;
  withSimulationRandom(() => 0.5, () => { combatPromise = runPvpActionLoop({ state: {
    updatedSurvivors: rows, phaseSurvivors: rows, phaseDurationSec: 6, nextDay: 2, nextPhase: 'night', phaseIdxNow: 3,
    currentActionSec: () => 100 + offset, getPhaseRuntimeOffsetSec: () => offset,
    battleSettings: { characterSkillsEnabled: false }, ruleset: localRules, publicItems: [item], craftables: [],
  }, actions: { atNow, emitRunEvent,
    reserveActionSecond: (duration) => { offset = Math.min(6, Math.round((offset + duration) * 1e6) / 1e6); },
    advanceWorld: ({ survivorMap }) => observe(survivorMap),
    resolveWorldObjectives: ({ survivorMap }) => observe(survivorMap),
    publishActionFrame: async () => { frames++; assert.ok(frames < 500, 'No zero-time loop'); },
  } }); });
  const result = await combatPromise;
  assert.ok(events.some((event) => event.kind === 'damage' && event.who === 'a'));
  assert.equal(result.newDeadIds.includes('b'), false); assert.equal(result.survivorMap.get('b').hp, 1);
  assert.equal(events.filter((event) => event.kind === 'dimension_rift_defeat' && event.who === 'b').length, 1);
  assert.equal(events.some((event) => event.kind === 'death' || event.kind === 'elimination'), false);
  assert.equal(subject.resolution.winnerTeamId, 'a'); assert.ok(subject.resolution.atSec >= 103);
  assert.equal(events.filter((event) => event.kind === 'dimension_rift_reward').length, 1);
  assert.equal(subject.rewardReceipt.consumedWorldGift, 1);
});

console.log(`dimension rift checks passed: ${checks}`);
