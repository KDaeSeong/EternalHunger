import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import './lib/register-simulation-modules.mjs';

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const SEEDS = [1, 1146, 1817];
const STRATEGIES = ['food', 'camp', 'development'];
const FOOD_ITEMS = ['berry', 'meat', 'cooked_meat', 'jerky', 'fish', 'grain', 'milled_grain', 'packed_ration'];

function seededRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function openingFixture(seed, scarceStart = false) {
  const rng = seededRng(seed);
  const base = engine.createNewState({ difficulty: 'normal', rng, runId: `opening-${seed}`, now: '2026-10-21T00:00:00.000Z' });
  // Keep a deliberately depleted stock case alongside the strengthened new
  // run supplies. Scarcity tradeoffs must not require hurting every new run.
  if (scarceStart) base.inventory = { ...base.inventory, wood: 2, berry: 2 };
  return { state: engine.normalizeState(base), rng };
}

function foodItemCount(state) {
  return FOOD_ITEMS.reduce((sum, id) => sum + Math.max(0, Number(state.inventory?.[id] || 0)), 0);
}

function bestActor(state, skill) {
  return [...state.party]
    .filter((member) => Number(member.hp || 0) > 0)
    .sort((a, b) => Number(b.stats?.[skill] || 0) - Number(a.stats?.[skill] || 0))[0]?.id || state.party[0]?.id;
}

function canCamp(state, actionId) {
  return engine.campActionRows(state).find((row) => row.id === actionId)?.enabled === true;
}

function targetCampAction(state, strategy) {
  const order = strategy === 'development'
    ? ['workbench', 'fire', 'shelter']
    : ['fire', 'shelter', 'workbench'];
  return order.find((id) => {
    const row = engine.campActionRows(state).find((candidate) => candidate.id === id);
    return row && !row.maxed;
  }) || '';
}

function chooseAction(state, strategy, options) {
  const actionId = targetCampAction(state, strategy);
  const food = foodItemCount(state);
  const hungry = state.party
    .filter((member) => Number(member.hp || 0) > 0)
    .sort((a, b) => Number(b.hunger || 0) - Number(a.hunger || 0))[0];

  if (strategy === 'food' && food < 3) {
    // Empty region selection is the actual UI's "unknown zone · random on action" route.
    return { label: 'hunt', run: () => engine.runHuntAction(state, bestActor(state, 'hunt'), '', options) };
  }

  if (strategy === 'food' && food > 0 && hungry && Number(hungry.hunger || 0) >= 58) {
    return { label: 'eat', run: () => engine.runEatAction(state, hungry.id, options) };
  }

  if (actionId && canCamp(state, actionId)) {
    return { label: `camp:${actionId}`, run: () => engine.runCampAction(state, bestActor(state, 'camp'), actionId, options) };
  }

  if (strategy === 'food' && food < 6) {
    return { label: 'hunt', run: () => engine.runHuntAction(state, bestActor(state, 'hunt'), '', options) };
  }

  // Gathering uses the engine's ordinary random revealed-region selection; no locked map selection is injected.
  return { label: 'gather', run: () => engine.runGatherAction(state, bestActor(state, 'gather'), '', options) };
}

function runOpening(strategy, seed, { resumeAfterDayOne = false, scarceStart = false } = {}) {
  const { state: initial, rng } = openingFixture(seed, scarceStart);
  const options = { rng };
  let state = initial;
  let blocked = 0;
  let failed = 0;
  const actions = [];
  let restored = false;

  while (state.day <= 3 && !state.ended) {
    const beforeDay = state.day;
    while (state.day === beforeDay && Number(state.ap || 0) > 0 && !state.ended) {
      const before = state;
      const chosen = chooseAction(before, strategy, options);
      state = chosen.run();
      actions.push(chosen.label);
      if (state.ap >= before.ap && state.day === before.day && !state.ended) blocked += 1;
      if (chosen.label === 'hunt' && Number(state.counters.hunt || 0) === Number(before.counters.hunt || 0)) failed += 1;
      if (chosen.label === 'gather' && Number(state.counters.gather || 0) === Number(before.counters.gather || 0)) failed += 1;
      assert.ok(state.day > before.day || state.ap < before.ap || state.ended,
        `${strategy}/${seed}: ${chosen.label} must be a valid AP-spending action.`);
    }

    // Action AP exhaustion uses afterAction -> advanceDay, so the night and next morning are real engine settlement.
    if (resumeAfterDayOne && !restored && state.day >= 2 && !state.ended) {
      const serialized = JSON.parse(JSON.stringify(state));
      state = engine.normalizeState(serialized);
      restored = true;
    }
  }

  const living = state.party.filter((member) => Number(member.hp || 0) > 0);
  const selectedTech = engine.TECH_TREE.find((tech) => tech.id === state.research.selectedTechId);
  const progress = Number(state.research.progress?.[selectedTech?.id] || 0);
  return {
    state,
    actions,
    blocked,
    failed,
    restored,
    metrics: {
      strategy,
      seed,
      day: state.day,
      survivors: living.length,
      hp: Math.round(living.reduce((sum, member) => sum + Number(member.hp || 0), 0) / Math.max(1, living.length)),
      hunger: Math.round(living.reduce((sum, member) => sum + Number(member.hunger || 0), 0) / Math.max(1, living.length)),
      food: Number(engine.tribeSummary(state).foodStock || 0),
      foodItems: foodItemCount(state),
      camp: `${state.camp.fireLevel}/${state.camp.shelterLevel}/${state.camp.workbenchLevel}`,
      fuel: Number(state.camp.fuel || 0),
      research: `${selectedTech?.id || 'none'}:${progress}`,
      ended: Boolean(state.ended),
      failed,
      blocked,
    },
  };
}

function comparableState(state) {
  const comparable = structuredClone(state);
  // addLog stamps updatedAt with wall-clock time; all persisted gameplay and log fields remain compared.
  delete comparable.updatedAt;
  return comparable;
}

const runs = STRATEGIES.flatMap((strategy) => SEEDS.map((seed) => runOpening(strategy, seed)));
const repeatedRuns = STRATEGIES.flatMap((strategy) => SEEDS.map((seed) => runOpening(strategy, seed)));
const digestFor = (group) => createHash('sha256')
  .update(JSON.stringify(group.map((run) => ({ metrics: run.metrics, operational: comparableState(run.state) }))))
  .digest('hex');
const hashes = new Map();
for (const strategy of STRATEGIES) {
  const group = runs.filter((run) => run.metrics.strategy === strategy);
  const repeated = repeatedRuns.filter((run) => run.metrics.strategy === strategy);
  const digest = digestFor(group);
  assert.equal(digestFor(repeated), digest, `${strategy}: fixed RNG repeat must produce the same outcomes.`);
  hashes.set(strategy, digest);
}

assert.equal(runs.length, 9);
assert.ok(runs.every((run) => run.metrics.day === 4 || run.metrics.ended), 'Each run must reach the Day 3 close or record actual party elimination.');
assert.ok(runs.every((run) => run.blocked === 0), 'Opening policies must issue only actions that spend AP or end the run.');
assert.ok(runs.some((run) => run.metrics.food > 0) && runs.some((run) => run.metrics.camp !== '0/0/0'),
  'Food and camp priorities must create measurably different opening outcomes.');
const pairedRows = SEEDS.map((seed) => Object.fromEntries(STRATEGIES.map((strategy) => [
  strategy,
  runs.find((run) => run.metrics.strategy === strategy && run.metrics.seed === seed).metrics,
])));
const differentPairs = pairedRows.flatMap((byStrategy, seedIndex) => {
  const strategies = Object.keys(byStrategy);
  return strategies.flatMap((left, index) => strategies.slice(index + 1).map((right) => ({
    seed: SEEDS[seedIndex],
    left: byStrategy[left],
    right: byStrategy[right],
    sameVector: ['hp', 'hunger', 'food', 'camp'].every((key) => byStrategy[left][key] === byStrategy[right][key]),
  })));
});
assert.ok(differentPairs.filter((pair) => !pair.sameVector).length >= 2,
  'At least two same-seed strategy pairs must differ on measured HP/hunger/food/camp outcomes.');
const facilityScore = (metrics) => metrics.camp.split('/').reduce((sum, level) => sum + Number(level || 0), 0);
const scarceRuns = STRATEGIES.flatMap((strategy) => SEEDS.map((seed) => runOpening(strategy, seed, { scarceStart: true })));
const scarcePairs = SEEDS.flatMap((seed) => {
  const group = scarceRuns.filter((run) => run.metrics.seed === seed).map((run) => run.metrics);
  return group.flatMap((left, index) => group.slice(index + 1).map((right) => ({ seed, left, right })));
});
const tradeoffPair = scarcePairs.find((pair) => (
  (pair.left.food > pair.right.food && facilityScore(pair.left) < facilityScore(pair.right) && pair.left.hp < pair.right.hp)
  || (pair.right.food > pair.left.food && facilityScore(pair.right) < facilityScore(pair.left) && pair.right.hp < pair.left.hp)
));
assert.ok(tradeoffPair, 'At least one deliberately scarce same-seed pair must show food versus camp/HP tradeoffs, without asserting a universal winner.');
const viableOpenings = STRATEGIES.filter((strategy) => runs
  .filter((run) => run.metrics.strategy === strategy)
  .every((run) => run.metrics.survivors > 0 && !run.metrics.ended));
assert.ok(viableOpenings.length >= 2, 'At least two tested opening priorities must be viable across all three seeds.');

const fuelShortage = [...runs, ...scarceRuns].flatMap((run) => run.state.log
  .filter((line) => line.includes('모닥불 연료가 없어 모닥불 보온 없이 밤을 보냈습니다.'))
  .map((line) => `${run.metrics.strategy}/${run.metrics.seed}: ${line}`))[0];
const explainedHuntFailure = [...runs, ...scarceRuns].flatMap((run) => run.state.log
  .filter((line) => line.includes('사냥 실패') && /HP -\d+/.test(line))
  .map((line) => `${run.metrics.strategy}/${run.metrics.seed}: ${line}`))[0];
assert.ok(fuelShortage, 'A fire without paid fuel must be reported as lacking camp warmth.');
assert.ok(explainedHuntFailure, 'A failed hunt must expose its actual HP loss in the run log.');

const jsonResume = runOpening('food', 1146, { resumeAfterDayOne: true });
const uninterrupted = runs.find((run) => run.metrics.strategy === 'food' && run.metrics.seed === 1146);
assert.equal(jsonResume.restored, true, 'The focused JSON continuation must pass through normalizeState once.');
assert.deepEqual(comparableState(jsonResume.state), comparableState(uninterrupted.state),
  'A same-stream JSON save/reload must preserve the opening result and RNG consumption.');
assert.equal(jsonResume.actions.join('|'), uninterrupted.actions.join('|'));

const rows = STRATEGIES.map((strategy) => {
  const group = runs.filter((run) => run.metrics.strategy === strategy).map((run) => run.metrics);
  return {
    opening: strategy,
    seeds: group.map((row) => row.seed),
    survivors: group.map((row) => row.survivors),
    hp: group.map((row) => row.hp),
    hunger: group.map((row) => row.hunger),
    food: group.map((row) => row.food),
    foodItems: group.map((row) => row.foodItems),
    camp: group.map((row) => row.camp),
    fuel: group.map((row) => row.fuel),
    research: group.map((row) => row.research),
    ended: group.map((row) => row.ended),
    failed: group.map((row) => row.failed),
    blocked: group.map((row) => row.blocked),
    repeatHash: hashes.get(strategy).slice(0, 12),
  };
});

console.log(JSON.stringify({
  pass: true,
  gate: 'engine-only; not browser or human-fun validation',
  days: 'Day 1-3 actions with real AP exhaustion and overnight settlement to Day 4 morning',
  autoDayActionUsed: false,
  jsonResume: { strategy: 'food', seed: 1146, sameOperationalResult: true, rngStreamKeptOutsideSave: true },
  viableOpenings,
  tradeoffSeed: tradeoffPair.seed,
  rows,
  logExamples: [fuelShortage, explainedHuntFailure],
}));
