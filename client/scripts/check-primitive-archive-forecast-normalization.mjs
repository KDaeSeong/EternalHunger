import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import './lib/register-simulation-modules.mjs';

const engineUrl = new URL('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js', import.meta.url);
const enginePath = fileURLToPath(engineUrl);
const source = await readFile(enginePath, 'utf8');
const counterHook = '  globalThis.__paForecastNormalizeCount = (globalThis.__paForecastNormalizeCount || 0) + 1;\n';
const normalizeMarker = 'export function normalizeState(value) {\n';
const gatherMarker = "  const gatherChance = regionalActionChanceForNormalizedState(current, actorId, 'gather', requestedRegionId);";
const huntMarker = "  const huntChance = regionalActionChanceForNormalizedState(current, actorId, 'hunt', requestedRegionId);";
assert.ok(source.includes(normalizeMarker), 'normalizeState instrumentation anchor exists');
assert.ok(source.includes(gatherMarker) && source.includes(huntMarker), 'forecast helper anchors exist');

const instrumentedOptimized = source.replace(normalizeMarker, `${normalizeMarker}${counterHook}`);
const instrumentedLegacy = instrumentedOptimized
  .replace(gatherMarker, "  const gatherChance = regionalActionChance(current, actorId, 'gather', requestedRegionId);")
  .replace(huntMarker, "  const huntChance = regionalActionChance(current, actorId, 'hunt', requestedRegionId);");
assert.notEqual(instrumentedLegacy, instrumentedOptimized, 'legacy wrapper oracle must use both public calls');

const nonce = randomUUID();
const optimizedPath = new URL(`../src/app/games/primitive-archive/_lib/.forecast-optimized-${nonce}.mjs`, import.meta.url);
const legacyPath = new URL(`../src/app/games/primitive-archive/_lib/.forecast-legacy-${nonce}.mjs`, import.meta.url);
try {
  await Promise.all([
    writeFile(optimizedPath, instrumentedOptimized, 'utf8'),
    writeFile(legacyPath, instrumentedLegacy, 'utf8'),
  ]);
  const [engine, optimized, legacy, data] = await Promise.all([
    import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js'),
    import(optimizedPath.href),
    import(legacyPath.href),
    import('../src/app/games/primitive-archive/_lib/primitiveArchiveData.js'),
  ]);

  const firstActorId = (state) => state.party[0]?.id || '';
  const normalState = (runId, difficulty = 'normal') => engine.createNewState({
    runId,
    difficulty,
    now: '2026-10-29T00:00:00.000Z',
    rng: () => 0.5,
  });
  const mutateUnlocked = (state) => {
    Object.assign(state.research.completed, Object.fromEntries(data.TECH_TREE.map((tech) => [tech.id, true])));
    state.exploration.revealed = Object.fromEntries(data.WORLD_REGIONS.map((region) => [region.id, true]));
    state.exploration.selectedRegionId = data.WORLD_REGIONS.at(-1)?.id || '';
    state.research.selectedTechId = data.TECH_TREE.at(-1)?.id || state.research.selectedTechId;
    Object.assign(state.civics.completed, Object.fromEntries(data.CIVIC_TREE.map((civic) => [civic.id, true])));
    state.civics.selectedCivicId = data.CIVIC_TREE.at(-1)?.id || state.civics.selectedCivicId;
  };
  const cases = [];
  const early = normalState('forecast-early');
  cases.push({ name: 'early baseline, implicit region, starter recipe', state: early, region: '', recipe: data.RECIPES[0]?.id || '' });

  const hard = normalState('forecast-hard', 'hard');
  cases.push({ name: 'hard difficulty, requested region while selection locked', state: hard, region: data.WORLD_REGIONS.at(-1)?.id || '', recipe: data.RECIPES.at(-1)?.id || '' });

  const unlocked = normalState('forecast-unlocked');
  mutateUnlocked(unlocked);
  cases.push({ name: 'cartography and late research/civic with selected region', state: unlocked, region: data.WORLD_REGIONS.at(-1)?.id || '', recipe: data.RECIPES.at(-1)?.id || '' });

  const normalizedDirectMutation = engine.normalizeState(normalState('forecast-direct-mutation'));
  normalizedDirectMutation.difficulty = 'hard';
  normalizedDirectMutation.party[0].hp = 0;
  normalizedDirectMutation.party[0].stamina = 4;
  normalizedDirectMutation.inventory.berry = 0;
  mutateUnlocked(normalizedDirectMutation);
  cases.push({ name: 'already-normalized input mutated in place', state: normalizedDirectMutation, region: data.WORLD_REGIONS[0]?.id || '', recipe: data.RECIPES[0]?.id || '' });

  const noParty = normalState('forecast-empty-party');
  noParty.party = [];
  cases.push({ name: 'empty party input falls back through normalizer', state: noParty, region: '', recipe: '' });

  const allDead = normalState('forecast-all-dead');
  allDead.party = allDead.party.map((member) => ({ ...member, hp: 0 }));
  cases.push({ name: 'all members dead', state: allDead, region: '', recipe: '' });

  const acted = engine.runGatherAction(early, firstActorId(early), '', { rng: () => 0.5 });
  cases.push({ name: 'after gather action', state: acted, region: '', recipe: data.RECIPES[0]?.id || '' });

  const afterTechAndCivic = engine.selectTechAction(unlocked, data.TECH_TREE[0]?.id || unlocked.research.selectedTechId);
  const afterCivic = engine.selectCivicAction(afterTechAndCivic, data.CIVIC_TREE[0]?.id || afterTechAndCivic.civics.selectedCivicId);
  cases.push({ name: 'after tech and civic selection actions', state: afterCivic, region: '', recipe: data.RECIPES.at(-1)?.id || '' });

  function callForecast(module, state, actorId, region, recipe) {
    globalThis.__paForecastNormalizeCount = 0;
    const before = structuredClone(state);
    const rows = module.actionForecastRows(state, actorId, region, recipe);
    const normalizeCalls = globalThis.__paForecastNormalizeCount;
    assert.deepEqual(state, before, 'forecast must not mutate its input');
    return { rows, normalizeCalls };
  }

  for (const testCase of cases) {
    const actorId = firstActorId(testCase.state);
    const optimizedResult = callForecast(optimized, structuredClone(testCase.state), actorId, testCase.region, testCase.recipe);
    const legacyResult = callForecast(legacy, structuredClone(testCase.state), actorId, testCase.region, testCase.recipe);
    assert.deepEqual(optimizedResult.rows, legacyResult.rows, `${testCase.name}: forecast rows equal legacy wrapper route`);
    assert.equal(legacyResult.normalizeCalls - optimizedResult.normalizeCalls, 2, `${testCase.name}: exactly two normalizeState calls removed`);
    console.log(`PASS ${testCase.name}: rows equal; normalizeState ${legacyResult.normalizeCalls} -> ${optimizedResult.normalizeCalls}`);
  }

  // Public regionalActionChance retains its normalize-on-every-call contract,
  // including when the supplied object was normalized and then mutated.
  const publicInput = engine.normalizeState(normalState('forecast-public-mutation'));
  publicInput.difficulty = 'hard';
  publicInput.party[0].stats.gather = 10;
  globalThis.__paForecastNormalizeCount = 0;
  const publicResult = optimized.regionalActionChance(publicInput, firstActorId(publicInput), 'gather', '');
  assert.equal(globalThis.__paForecastNormalizeCount, 1, 'public regional chance normalizes exactly once per call');
  assert.equal(publicResult, engine.regionalActionChance(publicInput, firstActorId(publicInput), 'gather', ''), 'public wrapper matches production result');
  console.log('PASS public regionalActionChance still normalizes every call and matches production');

  const timingState = cases[2].state;
  const timingActor = firstActorId(timingState);
  const timingArgs = [timingState, timingActor, cases[2].region, cases[2].recipe];
  for (let index = 0; index < 12; index += 1) {
    optimized.actionForecastRows(...timingArgs);
    legacy.actionForecastRows(...timingArgs);
  }
  function timeBatch(module, repetitions) {
    const start = process.hrtime.bigint();
    for (let index = 0; index < repetitions; index += 1) module.actionForecastRows(...timingArgs);
    return Number(process.hrtime.bigint() - start) / 1e6;
  }
  const optimizedMs = [];
  const legacyMs = [];
  for (let block = 0; block < 5; block += 1) {
    optimizedMs.push(timeBatch(optimized, 20));
    legacyMs.push(timeBatch(legacy, 20));
  }
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  console.log(`TIMING targeted forecast only: 5x20 calls, optimized median ${median(optimizedMs).toFixed(2)}ms; legacy-wrapper median ${median(legacyMs).toFixed(2)}ms (not browser/UI timing)`);
} finally {
  await Promise.allSettled([unlink(optimizedPath), unlink(legacyPath)]);
  delete globalThis.__paForecastNormalizeCount;
}
