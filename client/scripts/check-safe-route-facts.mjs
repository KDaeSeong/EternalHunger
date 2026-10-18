import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const teamUrl = new URL('../src/app/simulation/_lib/teamTacticsRuntime.js', import.meta.url).href;
const routeBoundary = '  const routeAssessment = isPlanningMovePowerSnapshot(estimatePower)\n    ? createRouteCombatAssessment(actor, roster, travelParty, estimatePower) : null;';
const reuseGate = '  const reuseRoutes = isPlanningMovePowerSnapshot(options.estimatePower);';
const asText = source => typeof source === 'string' ? source : new TextDecoder().decode(source);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const worker = process.argv.find(value => value.startsWith('--worker='))?.slice(9);
const seed = process.argv.find(value => value.startsWith('--seed='))?.slice(7) || '1101';

// Restore per-node route assessment and disable recipe-route reuse. The
// reference uses current surrounding helpers and fresh inputs, never a historical result file.
function originalRouteSource(source, required = false) {
  let result = source;
  if (result.includes(routeBoundary)) {
    assert.equal(result.split(routeBoundary).length, 2, 'Replace exactly one route boundary.');
    result = result.replace(routeBoundary, '  const routeAssessment = null;');
  } else assert.ok(!required, 'Reference route boundary missing.');
  if (result.includes(reuseGate)) {
    assert.equal(result.split(reuseGate).length, 2, 'Replace exactly one recipe-route reuse gate.');
    result = result.replace(reuseGate, '  const reuseRoutes = false;');
  } else assert.ok(!required, 'Reference recipe-route reuse gate missing.');
  return result;
}

if (worker) {
  assert.ok(['production', 'reference'].includes(worker));
  let overlays = 0;
  const hook = worker === 'reference' ? registerHooks({
    load(url, context, nextLoad) {
      const loaded = nextLoad(url, context);
      if (url !== teamUrl) return loaded;
      overlays++;
      return { ...loaded, source: originalRouteSource(asText(loaded.source), true) };
    },
  }) : null;
  try {
    const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
    const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
    const input = await createRandomIsolationInput(seed), inputDigest = digest(input);
    const result = await runRandomIsolationMatch(input);
    assert.equal(digest(input), inputDigest);
    assert.equal(overlays, worker === 'reference' ? 1 : 0);
    console.log(JSON.stringify({ worker, overlays, engine: SIMULATION_ENGINE_VERSION,
      outcome: { inputDigest, evidence: result.evidence,
        finalFrameDigest: digest(result.finalFrame), logDigest: digest(result.logs) } }));
  } finally { hook?.deregister(); }
} else {
  const probe = { normalizations: 0, collections: 0 };
  globalThis.__safeRouteFactsProbe = probe;
  const hook = registerHooks({
    load(url, context, nextLoad) {
      const loaded = nextLoad(url, context);
      if (!url.startsWith(`${teamUrl}?safe-route-facts=`)) return loaded;
      let source = asText(loaded.source);
      if (new URL(url).searchParams.get('safe-route-facts') === 'reference') source = originalRouteSource(source);
      assert.equal(source.split('function liveRoster(actor, roster) {').length, 2);
      source = source.replace('function liveRoster(actor, roster) {',
        'function liveRoster(actor, roster) {\n  globalThis.__safeRouteFactsProbe.normalizations++;');
      assert.equal(source.split('function collectTeamSafeRoutes(actor, roster, zoneGraph, forbiddenIds = new Set(), {').length, 2);
      const collectBody = '} = {}) {\n  const from = String(actor?.zoneId || \'\');';
      assert.equal(source.split(collectBody).length, 2, 'Instrument only the route-collection body.');
      source = source.replace(collectBody, '} = {}) {\n  globalThis.__safeRouteFactsProbe.collections++;\n  const from = String(actor?.zoneId || \'\');');
      return { ...loaded, source };
    },
  });
  let checks = 0, failures = 0;
  const check = (name, run) => {
    try { run(); checks++; console.log(`PASS ${name}`); }
    catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
  };
  try {
    const production = await import(`${teamUrl}?safe-route-facts=production`);
    const reference = await import(`${teamUrl}?safe-route-facts=reference`);
    const power = await import('../src/app/simulation/_lib/movePowerRuntime.js');
    const actor = (id, extra = {}) => ({ _id: id, name: id, teamId: 'one', zoneId: 'a', hp: 100,
      maxHp: 100, stats: { attackPower: 24.5, defense: 13.7, maxHp: 100 }, inventory: [], ...extra });
    const graph = { a: ['b', 'd'], b: ['a', 'c'], c: ['d', 'a'], d: ['a', 'c'] };
    const call = (runtime, rows, subject, zoneGraph = graph, forbidden = new Set(), options = {}) => {
      probe.normalizations = 0; probe.collections = 0;
      const result = runtime.pickTeamSafeZone(subject, rows, zoneGraph, forbidden, options);
      return { result, normalizations: probe.normalizations, collections: probe.collections };
    };
    const compare = (rows, subject, zoneGraph = graph, forbidden = new Set(), options = {}) => {
      const before = structuredClone({ rows, subject, zoneGraph, forbidden });
      const estimatePower = power.createPlanningMovePowerSnapshot(rows);
      const current = call(production, rows, subject, zoneGraph, forbidden, { ...options, estimatePower });
      const old = call(reference, rows, subject, zoneGraph, forbidden, { ...options, estimatePower });
      assert.deepEqual(current.result, old.result);
      assert.deepEqual({ rows, subject, zoneGraph, forbidden }, before, 'Route observation cannot mutate its input.');
      return { current, old };
    };
    check('one route normalizes its fixed roster twice instead of once per candidate', () => {
      const zoneGraph = Object.fromEntries(Array.from({ length: 18 }, (_, i) => {
        const key = `z${i}`;
        return [key, [0, 1, 3].map(delta => `z${(i + delta) % 18}`)];
      }));
      const rows = Array.from({ length: 24 }, (_, i) => actor(`actor-${i}`, { zoneId: `z${i % 18}`, teamId: 'one' }));
      const { current, old } = compare(rows, rows[0], zoneGraph, new Set(), { maxDepth: 18, travelParty: rows.slice(0, 3) });
      assert.equal(current.normalizations, 2);
      assert.ok(old.normalizations >= 18, 'Independent original scan must exercise multiple destinations.');
      console.log(JSON.stringify({ operationCounts: { current: current.normalizations, original: old.normalizations } }));
    });
    check('directed paths, forbidden/excluded zones, target/stay/depth and pressure keep exact outcomes', () => {
      for (let n = 0; n < 96; n++) {
        const rows = [actor('leader', { zoneId: ['a', 'b'][n % 2], hp: 20 + n % 81 }),
          actor('friend', { zoneId: ['b', 'c', 'd'][n % 3] }),
          actor('enemy', { zoneId: ['a', 'b', 'c', 'd'][n % 4], teamId: 'two', hp: 10 + n % 91,
            stats: { attackPower: n % 4 ? 60.125 : 4.125, defense: 9.5 } }),
          actor('other-space', { zoneId: 'b', teamId: 'two', _combatSpaceId: 'dimension_rift:r1' })];
      for (const targetZoneId of ['', 0, 'a', 'c', 'missing']) for (const travelParty of [[], rows.slice(0, 2), rows.slice(1, 3)]) {
          compare(rows, rows[0], graph, new Set(n % 3 ? [] : ['c']), { targetZoneId, travelParty,
            enemyFree: n % 2 === 0, allowStay: n % 4 !== 0,
            excludedZoneIds: n % 5 ? [] : ['d'], maxDepth: [0, 1, 2.5, 8, NaN][n % 5] });
        }
      }
    });
    check('latest living identity, active overrides, fallback allies and dimension defeat are retained', () => {
      const defeated = actor('rift-defeated', { zoneId: 'b', hp: 1, teamId: 'two', _combatSpaceId: 'dimension_rift:r1',
        _dimensionRiftEntry: { riftId: 'r1', enteredAtSec: 5 }, _dimensionRiftDefeat: { riftId: 'r1', enteredAtSec: 5 } });
      const rows = [actor('dup'), null, actor('dup', { zoneId: 'b', teamId: 'two', hp: 40 }),
        actor('dup', { zoneId: 'c', hp: 0 }), actor('', { zoneId: 'c' }),
        actor('friend', { zoneId: 'b' }), defeated, actor('nan', { hp: NaN, zoneId: 'b' })];
      for (const subject of [rows[0], actor('dup', { zoneId: 'd', hp: 80 }), actor('absent', { zoneId: 'a' }),
        actor('dead', { hp: 0 }), actor('', { teamId: '', zoneId: 'a' }), { ...rows[0], _combatSpaceId: 'dimension_rift:r1' }]) {
        for (const targetZoneId of ['', 'a', 'b', 'd']) compare(rows, subject, graph, new Set(),
          { targetZoneId, maxDepth: 8, travelParty: [rows[0], rows[5], null] });
      }
    });
    check('facts are rebuilt after mutable roster, party, actor, graph and forbidden changes', () => {
      const rows = [actor('a'), actor('b'), actor('enemy', { teamId: 'two', zoneId: 'c' })];
      const estimatePower = power.createPlanningMovePowerSnapshot(rows), mutableGraph = structuredClone(graph);
      const forbidden = new Set(), options = { estimatePower, maxDepth: 8, travelParty: [rows[0], rows[1]], targetZoneId: 'd' };
      for (let n = 0; n < 5; n++) {
        assert.deepEqual(call(production, rows, rows[0], mutableGraph, forbidden, options).result,
          call(reference, rows, rows[0], mutableGraph, forbidden, options).result);
        if (n === 0) { rows[1].hp = 0; rows[2].zoneId = 'b'; }
        if (n === 1) { rows[0].zoneId = 'b'; options.travelParty = []; }
        if (n === 2) { forbidden.add('c'); mutableGraph.b = ['d']; }
        if (n === 3) { rows[1].hp = 100; rows[2]._combatSpaceId = 'dimension_rift:r2'; }
      }
    });
    check('external estimators retain per-node callbacks and their mutation ordering', () => {
      const run = runtime => {
        const rows = [actor('a'), actor('b', { zoneId: 'b' }), actor('enemy', { teamId: 'two', zoneId: 'c' })];
        const order = [];
        const estimatePower = row => {
          order.push([row._id, row.zoneId]);
          if (order.length === 1) rows[2].zoneId = 'd';
          return row.teamId === 'two' ? 30 : 100;
        };
        const outcome = call(runtime, rows, rows[0], graph, new Set(), { estimatePower, maxDepth: 8,
          travelParty: rows.slice(0, 2), targetZoneId: 'c' });
        return { ...outcome, rows, order };
      };
      assert.deepEqual(run(production), run(reference));
    });
    check('only real planning snapshot functions are branded; wrappers keep legacy behavior', () => {
      assert.equal(typeof power.isPlanningMovePowerSnapshot, 'function');
      const rows = [actor('a'), actor('b', { zoneId: 'b' })], snapshot = power.createPlanningMovePowerSnapshot(rows);
      assert.equal(power.isPlanningMovePowerSnapshot(snapshot), true);
      for (const candidate of [power.estimateMovePower, row => snapshot(row), null, {}, () => 10]) {
        assert.equal(power.isPlanningMovePowerSnapshot(candidate), false);
      }
      const wrapper = row => snapshot(row);
      assert.deepEqual(call(production, rows, rows[0], graph, new Set(), { estimatePower: wrapper }),
        call(reference, rows, rows[0], graph, new Set(), { estimatePower: wrapper }));
    });
    check('same-input team coordination keeps all movement plans and regroup decisions', () => {
      const rows = [actor('a', { teamSlot: 1, _growthPlan: { openingComplete: true } }),
        actor('b', { zoneId: 'b', teamSlot: 2, _growthPlan: { openingComplete: true } }),
        actor('enemy', { teamId: 'two', zoneId: 'c' })];
      const options = { roster: rows, zoneGraph: graph, day: 3, estimatePower: power.createPlanningMovePowerSnapshot(rows),
        chooseLeaderMove: () => ({ targets: ['d'], reason: 'safe-route-control' }) };
      assert.deepEqual(production.buildTeamCoordination(options), reference.buildTeamCoordination(options));
    });
    check('one recipe decision shares route candidates across resource zones but rebuilds them after each squad yield', () => {
      const base = { _id: 'route-query-base', itemKey: 'route-query-base-key', name: '기본 모자',
        type: '방어구', category: 'equipment', equipSlot: 'head', tier: 4 };
      const tree = { _id: 'route-query-tree', itemKey: 'route-query-tree-key', name: '생명의 나무',
        type: '재료', category: 'material', tier: 4 };
      const target = { ...base, _id: 'route-query-target', itemKey: 'route-query-target-key', name: '생명 모자', tier: 5,
        recipe: { ingredients: [{ itemId: base._id, qty: 1 }, { itemId: tree._id, qty: 1 }], resultQty: 1, creditsCost: 0 } };
      const run = (runtime, useUnbrandedEstimator = false) => {
        const member = (id, teamId, teamSlot) => actor(id, { teamId, teamSlot, zoneId: 'a', simCredits: 10,
          inventory: [{ ...base, itemId: base._id, qty: 1 }], equipped: { head: base._id },
          routePlanTargetItemIds: [base._id], goalLoadouts: { hero: { headKey: base.itemKey },
            legend: { headKey: target.itemKey } },
          _growthPlan: { openingComplete: true, targetId: target._id, completedSlots: 5, totalSlots: 5, blocked: '' } });
        const rows = [member('recipe-one-a', 'recipe-one', 1), member('recipe-one-b', 'recipe-one', 2),
          member('recipe-two-a', 'recipe-two', 1), member('recipe-two-b', 'recipe-two', 2)];
        const zoneGraph = { a: ['b', 'c', 'd'], b: ['a', 'c', 'd'], c: ['a'], d: ['a'] };
        const estimatePower = power.createPlanningMovePowerSnapshot(rows);
        const options = { roster: rows, zoneGraph, forbiddenIds: new Set(), day: 3, phase: 'morning',
          isSoloMatch: false, spawnState: { coreNodes: ['b', 'c', 'd'].map(zoneId => ({
            id: `tree-${zoneId}`, kind: 'life_tree', zoneId, picked: false })), bosses: {} },
          ruleset: { ai: { recoverHpBelow: 38, fightAvoidMinRatio: 0.4, huntRetreatHpRatio: 0.22 } },
          publicItems: [base, tree, target], estimatePower: useUnbrandedEstimator ? row => estimatePower(row) : estimatePower,
          getRotationHold: null, chooseLeaderMove: () => null };
        probe.collections = 0;
        const steps = runtime.buildTeamCoordinationSteps(options);
        assert.equal(steps.next().done, false, 'The first squad is separated by the generator boundary.');
        const firstYield = steps.next();
        assert.equal(firstYield.done, false, 'A second squad must start only after the first decision yields.');
        const firstSquadCollections = probe.collections;
        rows[2].zoneId = 'b'; rows[3].zoneId = 'b';
        zoneGraph.b = ['a', 'c', 'd'];
        const completed = steps.next();
        assert.equal(completed.done, true);
        return { result: completed.value, firstSquadCollections,
          secondSquadCollections: probe.collections - firstSquadCollections };
      };
      const current = run(production), old = run(reference);
      assert.deepEqual(current.result, old.result, 'Movement plans and observations retain the independent per-query oracle.');
      assert.equal(current.firstSquadCollections, 3, 'One shared recipe scan plus each member\'s independent final route.');
      assert.equal(current.secondSquadCollections, 3, 'The next squad rebuilds route facts after the yield and roster edit.');
      assert.equal(old.firstSquadCollections, 5, 'Reference performs one recipe scan for each of three resource zones plus final routes.');
      assert.equal(old.secondSquadCollections, 5, 'Reference independently rescans each target after the same yield.');
      const unbranded = run(production, true);
      assert.deepEqual(unbranded.result, old.result, 'A wrapper estimator retains reference decision behavior.');
      assert.equal(unbranded.firstSquadCollections, 5, 'Unbranded wrappers keep per-zone route queries in each squad.');
      assert.equal(unbranded.secondSquadCollections, 5, 'The later squad also uses fresh per-zone queries through the wrapper.');
    });
    assert.equal(failures, 0, `${failures} safe-route fact groups failed.`);
    console.log(JSON.stringify({ pass: true, checks,
      scope: 'branded synchronous planning queries and legacy callback boundary; not full-input or actual x32 acceptance' }));
  } finally { hook.deregister(); delete globalThis.__safeRouteFactsProbe; }
  if (!process.argv.includes('--fixtures-only')) {
    const seeds = process.argv.find(value => value.startsWith('--seeds='))?.slice(8).split(',') || [seed];
    for (const matchSeed of seeds) {
      const matches = ['reference', 'production'].map(mode => {
        const output = execFileSync(process.execPath, [fileURLToPath(import.meta.url), `--worker=${mode}`, `--seed=${matchSeed}`], {
          cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', maxBuffer: 1024 * 1024,
          stdio: ['ignore', 'pipe', 'inherit'],
        });
        const row = JSON.parse(output.trim()), evidence = row.outcome.evidence;
        console.log(JSON.stringify({ completed: mode, engine: row.engine, overlays: row.overlays,
          seed: evidence.seed, phases: evidence.phases, frames: evidence.frames, matchSec: evidence.ticks,
          events: evidence.eventCount, ending: evidence.ending.outcome,
          randomState: evidence.random.state, randomDraws: evidence.random.draws,
          inputDigest: row.outcome.inputDigest, eventDigest: evidence.eventDigest, frameDigest: evidence.frameDigest,
          endingDigest: digest(evidence.ending), finalFrameDigest: row.outcome.finalFrameDigest, logDigest: row.outcome.logDigest }));
        return row;
      });
      assert.equal(matches[0].engine, matches[1].engine);
      assert.deepEqual(matches[0].outcome, matches[1].outcome);
      console.log(JSON.stringify({ pass: true, seed: matchSeed, completeMatches: 2,
        scope: 'fresh whole matches with original route assessment; surrounding helpers shared, not historical outputs or all inputs' }));
    }
  }
}
