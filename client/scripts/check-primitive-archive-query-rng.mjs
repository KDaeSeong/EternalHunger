import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const data = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveData.js');

// Exercise public save/query/action flows. No source rewriting, recorded user
// snapshots, prior audit output, or implementation-derived normalization oracle.
const originalRandom = Math.random;
const failures = [];
let checks = 0;
const now = '2026-11-12T00:00:00.000Z';
const fresh = (id = 'query-rng-regression') => engine.createNewState({ runId: id, now, rng: () => 0.5 });
const clone = (value) => structuredClone(value);
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function stream(values = [0.01, 0.01, 0.99, 0.01, 0.7, 0.02, 0.8, 0.2]) {
  const trace = [];
  return { trace, next() { const value = values[trace.length % values.length]; trace.push(value); return value; } };
}

function withGlobal(values, run) {
  const controlled = stream(values);
  Math.random = controlled.next.bind(controlled);
  try { return { value: run(controlled), trace: [...controlled.trace] }; }
  finally { Math.random = originalRandom; }
}

function check(name, run) {
  checks += 1;
  try { run(); console.log(`PASS ${name}`); }
  catch (error) {
    failures.push({ name, message: error.message.split('\n')[0] });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const saved = fresh();
const actorId = saved.party[0].id;
const recipeId = data.RECIPES[0].id;
const queries = [
  ['normalizeState', state => engine.normalizeState(state)],
  ['tribeSummary', state => engine.tribeSummary(state)],
  ['explorationSummary', state => engine.explorationSummary(state)],
  ['tribeProcessingSummary', state => engine.tribeProcessingSummary(state)],
  ['tribeEducationSummary', state => engine.tribeEducationSummary(state)],
  ['actionForecastRows', state => engine.actionForecastRows(state, actorId, '', recipeId)],
];

try {
  for (const [name, query] of queries) {
    check(`saved weather: ${name} draws zero and preserves input`, () => {
      const input = clone(saved);
      const before = clone(input);
      const observed = withGlobal([0.99], () => query(input));
      assert.deepEqual(input, before, `${name} input must remain unchanged`);
      if (name === 'normalizeState') assert.equal(observed.value.weather, input.weather, 'stored weather survives normalization by reference');
      assert.equal(observed.trace.length, 0, `${name} must consume no global RNG for saved weather`);
      assert.ok(observed.value, `${name} returns a real public result`);
    });
  }

  function perform({ queried, injected }) {
    const input = clone(saved);
    const before = clone(input);
    const actionStream = stream();
    const observed = withGlobal(undefined, globalStream => {
      if (queried) for (let repeat = 0; repeat < 3; repeat += 1) {
        for (const [, query] of queries) query(input);
      }
      const queryTrace = [...globalStream.trace];
      const next = engine.runGatherAction(input, actorId, '', injected ? { rng: actionStream.next.bind(actionStream) } : {});
      assert.deepEqual(input, before, 'gather and preceding queries preserve source save');
      assert.deepEqual(next.weather, before.weather, 'same-day gather preserves stored weather');
      assert.equal(next.ap, before.ap - 1, 'public gather performs an action');
      // Timestamps are wall-clock bookkeeping, not action outcomes.
      const { updatedAt, ...outcome } = next;
      return { outcome, queryTrace };
    });
    return { ...observed.value, globalTrace: observed.trace, actionTrace: [...actionStream.trace] };
  }

  check('global action stream: queries preserve actual gather outcome and complete draw trace', () => {
    const without = perform({ queried: false, injected: false });
    const withQueries = perform({ queried: true, injected: false });
    assert.ok(without.globalTrace.length > 0, 'gather genuinely uses controlled global randomness');
    assert.equal(fingerprint(withQueries.outcome), fingerprint(without.outcome), 'all observable gather state agrees');
    assert.deepEqual(withQueries.globalTrace, without.globalTrace, 'global draw trace agrees');
    assert.deepEqual(withQueries.queryTrace, [], 'pre-action queries draw nothing');
  });

  check('injected action stream: queries preserve gather outcome and independent draw trace', () => {
    const without = perform({ queried: false, injected: true });
    const withQueries = perform({ queried: true, injected: true });
    assert.ok(without.actionTrace.length > 0, 'gather genuinely uses injected randomness');
    assert.equal(fingerprint(withQueries.outcome), fingerprint(without.outcome), 'injected gather state agrees');
    assert.deepEqual(withQueries.actionTrace, without.actionTrace, 'injected action draw trace agrees');
    assert.deepEqual(without.globalTrace, [], 'injected gather needs no global weather fallback');
    assert.deepEqual(withQueries.globalTrace, [], 'queries plus injected gather consume no global RNG');
  });

  for (const value of [0.01, 0.8, 0.99]) {
    check(`new run injected RNG ${value}: exactly one real weather draw`, () => {
      const injected = stream([value]);
      const observed = withGlobal([0.4], () => engine.createNewState({ runId: 'new-injected', now, rng: injected.next.bind(injected) }));
      assert.deepEqual(injected.trace, [value], 'new run consumes exactly one supplied weather draw');
      assert.deepEqual(observed.trace, [], 'injected creation never consults global RNG');
      assert.deepEqual(observed.value.weather, data.rollWeather(1, () => value), 'new run weather matches public weather API');
    });
    check(`new run default RNG ${value}: exactly one real weather draw`, () => {
      const observed = withGlobal([value], () => engine.createNewState({ runId: 'new-default', now }));
      assert.deepEqual(observed.trace, [value], 'default creation consumes one global weather draw');
      assert.deepEqual(observed.value.weather, data.rollWeather(1, () => value), 'default weather matches public weather API');
    });
  }

  check('public new-run options.weather remains ignored and cannot skip the real draw', () => {
    const providedWeather = { id: 'do-not-install', cold: 99 };
    const observed = withGlobal([0.99], () => engine.createNewState({ runId: 'new-weather-option', now, weather: providedWeather }));
    assert.deepEqual(observed.trace, [0.99]);
    assert.deepEqual(observed.value.weather, data.rollWeather(1, () => 0.99));
    assert.notEqual(observed.value.weather, providedWeather);
  });

  const invalidWeather = [undefined, null, false, true, 0, 12, '', 'old-weather'];
  for (const weather of invalidWeather) {
    check(`fallback weather ${String(weather)}: exactly one real draw`, () => {
      const input = { ...clone(saved), day: 10000, weather };
      if (weather === undefined) delete input.weather;
      const before = clone(input);
      const observed = withGlobal([0.99], () => engine.normalizeState(input));
      assert.deepEqual(input, before, 'weather fallback preserves input');
      assert.deepEqual(observed.trace, [0.99], 'invalid/missing weather triggers exactly one fallback draw');
      assert.deepEqual(observed.value.weather, data.rollWeather(1, () => 0.99), 'fallback weather is the real day-one weather result');
    });
  }

  check('function weather uses the existing day-one fallback draw', () => {
    const weather = () => 'old-weather';
    const input = { ...clone(saved), day: 10000, weather };
    const before = { ...clone(saved), day: 10000, weather };
    const observed = withGlobal([0.99], () => engine.normalizeState(input));
    assert.deepEqual(input, before);
    assert.deepEqual(observed.trace, [0.99]);
    assert.deepEqual(observed.value.weather, data.rollWeather(1, () => 0.99));
  });

  for (const [name, weather] of [['empty-object', {}], ['custom-object', { id: 'legacy-custom', cold: 2, extra: 'keep' }], ['empty-array', []], ['legacy-array', [{ id: 'old-array' }]], ['date', new Date(now)]]) {
    check(`legacy ${name}: compatible stored object survives without a draw`, () => {
      const input = { ...clone(saved), weather: clone(weather) };
      const before = clone(input);
      const observed = withGlobal([0.99], () => engine.normalizeState(input));
      assert.deepEqual(input, before, 'legacy weather input is unchanged');
      assert.deepEqual(observed.value.weather, weather, 'truthy object/array weather remains compatible');
      assert.equal(observed.value.weather, input.weather, 'compatible stored weather keeps its original reference');
      assert.deepEqual(observed.trace, [], 'compatible legacy weather never rolls');
    });
  }

  check('function save carrying weather still creates the original fresh fallback', () => {
    const input = () => 'legacy-save';
    input.weather = { id: 'must-not-be-read' };
    const weatherBefore = input.weather;
    const observed = withGlobal([0.99], () => engine.normalizeState(input));
    assert.equal(input.weather, weatherBefore);
    assert.deepEqual(observed.trace, [0.99]);
    assert.deepEqual(observed.value.weather, data.rollWeather(1, () => 0.99));
    assert.ok(observed.value.party.length > 0);
  });

  for (const input of [undefined, null, false, 0, 'old-save']) {
    check(`primitive save ${String(input)}: real fresh fallback draws once`, () => {
      const observed = withGlobal([0.99], () => engine.normalizeState(input));
      assert.deepEqual(observed.trace, [0.99], 'primitive save creates weather exactly once');
      assert.deepEqual(observed.value.weather, data.rollWeather(1, () => 0.99));
      assert.ok(observed.value.party.length > 0, 'fallback remains a playable new state');
    });
  }

  check('ended day transition returns unchanged without any weather draw', () => {
    const input = { ...clone(saved), ended: true };
    const before = clone(input);
    const observed = withGlobal([0.99], () => engine.advanceDay(input));
    assert.equal(observed.value, input);
    assert.deepEqual(input, before);
    assert.deepEqual(observed.trace, []);
  });

  for (const injected of [false, true]) {
    check(`real day transition (${injected ? 'injected' : 'default'} RNG) retains weather draw`, () => {
      const input = clone(saved);
      const before = clone(input);
      const weatherStream = stream([0.99]);
      const observed = withGlobal([0.99], () => engine.advanceDay(input, injected ? { rng: weatherStream.next.bind(weatherStream) } : {}));
      assert.deepEqual(input, before, 'day transition preserves source save');
      assert.equal(observed.value.day, before.day + 1, 'public day transition really advances');
      assert.deepEqual(observed.value.weather, data.rollWeather(before.day + 1, () => 0.99), 'next day gets its real rolled weather');
      assert.deepEqual(injected ? weatherStream.trace : observed.trace, [0.99], 'day transition rolls exactly once');
      if (injected) assert.deepEqual(observed.trace, [], 'injected transition avoids global RNG');
    });
  }

  check('same normalized object reflects direct state and research edits on later queries', () => {
    const input = engine.normalizeState(clone(saved));
    const originalPopulation = engine.tribeSummary(input).population;
    const locked = engine.explorationSummary(input);
    assert.equal(locked.selectionUnlocked, false, 'fresh map selection starts locked');
    input.tribe.population = originalPopulation + 3;
    input.day = 7;
    input.ap = 1;
    input.inventory.berry = Number(input.inventory.berry || 0) + 40;
    Object.assign(input.research.completed, Object.fromEntries(data.TECH_TREE.map(tech => [tech.id, true])));
    input.exploration.revealed = Object.fromEntries(data.WORLD_REGIONS.map(region => [region.id, true]));
    const before = clone(input);
    const observed = withGlobal([0.99], () => ({ normalized: engine.normalizeState(input), tribe: engine.tribeSummary(input), exploration: engine.explorationSummary(input), forecast: engine.actionForecastRows(input, actorId, '', recipeId) }));
    assert.deepEqual(input, before, 'queries preserve directly edited input');
    assert.equal(observed.value.normalized.tribe.population, originalPopulation + 3, 'normalization rereads direct population edit');
    assert.equal(observed.value.tribe.population, originalPopulation + 3, 'tribe summary rereads direct population edit');
    assert.equal(observed.value.normalized.inventory.berry, input.inventory.berry, 'normalization rereads direct stock edit');
    assert.equal(observed.value.normalized.day, 7, 'normalization rereads direct day edit');
    assert.equal(observed.value.normalized.ap, 1, 'normalization rereads direct AP edit');
    assert.equal(observed.value.exploration.selectionUnlocked, true, 'map summary rereads completed research');
    assert.equal(observed.value.exploration.revealed, data.WORLD_REGIONS.length, 'map summary rereads direct discoveries');
    assert.deepEqual(observed.trace, [], 'direct changes do not cause weather draws');
  });
} finally {
  Math.random = originalRandom;
}

assert.equal(Math.random, originalRandom, 'global random function restored');
console.log(`RESULT ${checks - failures.length}/${checks} passed; ${failures.length} failed; Math.random restored`);
if (failures.length) process.exitCode = 1;
