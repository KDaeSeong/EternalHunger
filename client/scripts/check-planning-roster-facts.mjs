import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const runtimeUrl = name => new URL(`../src/app/simulation/_lib/${name}.js`, import.meta.url).href;
const urls = {
  team: runtimeUrl('teamTacticsRuntime'), frame: runtimeUrl('simulationFrameRuntime'),
  pipeline: runtimeUrl('phaseActorActionPipelineRuntime'),
};
const oldPopulation = `function buildBaseZonePopulation(phaseSurvivors, combatSpaceId) {
  const baseZonePop = {};
  (Array.isArray(phaseSurvivors) ? phaseSurvivors : []).forEach((survivor) => {
    if (!survivor || getCombatSpaceId(survivor) !== combatSpaceId || Number(survivor.hp || 0) <= 0) return;
    const zoneId = String(survivor.zoneId || '');
    if (!zoneId) return;
    baseZonePop[zoneId] = (baseZonePop[zoneId] || 0) + 1;
  });
  return baseZonePop;
}
function buildBaseZonePopulations(roster) {
  return new Map([...new Set(roster.map(getCombatSpaceId))]
    .map((spaceId) => [spaceId, buildBaseZonePopulation(roster, spaceId)]));
}`;
function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, `Expected exactly one source boundary: ${before}`);
  return source.replace(before, after);
}

// Independent original expressions, not old result files. Surrounding product
// helpers remain shared; this proves only these three call-local changes.
function referenceSource(kind, source) {
  if (kind === 'team' && source.includes('&& getLocalTeamCombatants(leader, roster).enemies.length === 0;')) {
    return replaceOnce(source, '&& getLocalTeamCombatants(leader, roster).enemies.length === 0;',
      '&& assessTeamCombat(leader, roster, { estimatePower }).enemyCount === 0;');
  }
  if (kind === 'frame' && source.includes('    const latestSurvivors = latestActors(survivors);')) {
    source = replaceOnce(source, '    const latestSurvivors = latestActors(survivors);\n', '');
    source = replaceOnce(source, 'const living = latestSurvivors.filter', 'const living = latestActors(survivors).filter');
    return replaceOnce(source, '...latestSurvivors.filter', '...latestActors(survivors).filter');
  }
  if (kind === 'pipeline' && !source.includes('function buildBaseZonePopulation(')) {
    const start = source.indexOf('function buildBaseZonePopulations(');
    const end = source.indexOf('\n// Movement planning', start);
    assert.ok(start >= 0 && end > start, 'Replace only the population helper.');
    return source.slice(0, start) + oldPopulation + '\n' + source.slice(end);
  }
  return source;
}

const worker = process.argv.find(value => value.startsWith('--worker='))?.slice(9);
const seed = process.argv.find(value => value.startsWith('--seed='))?.slice(7) || '1101';
const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
if (worker) {
  assert.ok(['production', 'reference'].includes(worker));
  const overlays = new Map();
  const hook = worker === 'reference' ? registerHooks({
    load(url, context, nextLoad) {
      const loaded = nextLoad(url, context);
      const kind = Object.keys(urls).find(key => urls[key] === url);
      if (!kind) return loaded;
      const source = typeof loaded.source === 'string' ? loaded.source : new TextDecoder().decode(loaded.source);
      const reference = referenceSource(kind, source);
      assert.notEqual(reference, source, `Reference must exercise the ${kind} change.`);
      overlays.set(kind, (overlays.get(kind) || 0) + 1);
      return { ...loaded, source: reference };
    },
  }) : null;
  try {
    const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
    const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
    const input = await createRandomIsolationInput(seed), before = digest(input);
    const result = await runRandomIsolationMatch(input);
    assert.equal(digest(input), before, 'A complete match cannot rewrite its fresh input.');
    const overlayCounts = Object.fromEntries([...overlays].sort(([a], [b]) => a.localeCompare(b)));
    assert.deepEqual(overlayCounts, worker === 'reference' ? { frame: 1, pipeline: 1, team: 1 } : {});
    console.log(JSON.stringify({ worker, engine: SIMULATION_ENGINE_VERSION, overlayCounts,
      outcome: { inputDigest: before, evidence: result.evidence,
        finalFrameDigest: digest(result.finalFrame), logDigest: digest(result.logs) } }));
  } finally { hook?.deregister(); }
} else {
  const probe = { frameRows: 0, spaces: 0, resources: 0 };
  globalThis.__planningRosterProbe = probe;
  const hook = registerHooks({
    load(url, context, nextLoad) {
      const loaded = nextLoad(url, context), query = new URL(url).searchParams;
      if (!query.has('roster-facts')) return loaded;
      const base = url.slice(0, url.indexOf('?'));
      const kind = Object.keys(urls).find(key => urls[key] === base);
      assert.ok(kind);
      let source = typeof loaded.source === 'string' ? loaded.source : new TextDecoder().decode(loaded.source);
      if (query.get('roster-facts') === 'reference') source = referenceSource(kind, source);
      if (kind === 'team') {
        source = replaceOnce(source, 'import { chooseTeamResourceMove }', 'import { chooseTeamResourceMove as originalResourceMove }');
        source += '\nconst chooseTeamResourceMove = options => { globalThis.__planningRosterProbe.resources++; return originalResourceMove(options); };\n';
      } else if (kind === 'frame') {
        source = replaceOnce(source, 'function latestActors(rows) {',
          'function latestActors(rows) {\n  globalThis.__planningRosterProbe.frameRows += (rows || []).length;');
      } else {
        source = replaceOnce(source, 'import { getCombatSpaceId }', 'import { getCombatSpaceId as originalSpaceId }');
        source += '\nconst getCombatSpaceId = actor => { globalThis.__planningRosterProbe.spaces++; return originalSpaceId(actor); };\n';
        if (!source.includes('function buildBaseZonePopulations(')) {
          source += '\nfunction buildBaseZonePopulations(roster) { return new Map([...new Set(roster.map(getCombatSpaceId))].map(spaceId => [spaceId, buildBaseZonePopulation(roster, spaceId)])); }\n';
        }
        source += '\nexport { buildBaseZonePopulations };\n';
      }
      return { ...loaded, source };
    },
  });
  let checks = 0, failures = 0;
  const check = (name, run) => {
    try { run(); checks++; console.log(`PASS ${name}`); }
    catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
  };
  try {
    const production = {}, reference = {};
    for (const kind of Object.keys(urls)) {
      production[kind] = await import(`${urls[kind]}?roster-facts=production`);
      reference[kind] = await import(`${urls[kind]}?roster-facts=reference`);
    }
    const actor = (id, extra = {}) => ({ _id: id, name: id, teamId: 'team:1', teamSlot: 1,
      zoneId: 'a', hp: 100, maxHp: 100, power: 100, inventory: [],
      _growthPlan: { openingComplete: true }, ...extra });
    const serialize = value => ({ movementPlans: [...value.movementPlans], regroupDecisions: [...value.regroupDecisions] });
    const runTeam = (runtime, fixture = {}) => {
      const roster = [actor('a'), actor('b', { teamSlot: 2 }), ...(fixture.enemy ? [actor('enemy', { teamId: 'team:2', power: 200 })] : [])];
      if (fixture.separated) roster[1].zoneId = 'b';
      if (fixture.growing) roster[0]._growthPlan.openingComplete = false;
      if (fixture.lowHp) roster[1].hp = 20;
      let estimates = 0, choices = 0;
      const holdOrder = [], estimateOrder = [], estimatesAtHold = [];
      probe.resources = 0;
      const options = { roster, zoneGraph: { a: [], b: [] }, day: 3, estimatePower: row => {
        estimates++; estimateOrder.push(row._id); return row.power;
      }, ruleset: { ai: { recoverHpBelow: 38, fightAvoidMinRatio: fixture.ratio ?? 0.4 } },
      spawnState: fixture.endgame ? { endgame: {} } : {},
      chooseLeaderMove: () => { choices++; return null; },
      getRotationHold: fixture.noHoldCallback ? null : row => {
        holdOrder.push(row._id); estimatesAtHold.push(estimates);
        if (fixture.mutate && row._id === 'a') roster.push(actor('late-enemy', { teamId: 'team:2', power: 1000 }));
        return fixture.hold && row._id === 'b' ? { reason: 'action_wait', readyAtSec: 20 } : null;
      } };
      return { result: serialize(runtime.buildTeamCoordination(options)), roster, estimates, estimateOrder,
        estimatesAtHold, holdOrder, choices, resources: probe.resources };
    };
    check('rotation waiting counts enemies without estimating unused combat power', () => {
      const current = runTeam(production.team, { hold: true }), old = runTeam(reference.team, { hold: true });
      assert.deepEqual(current.result, old.result); assert.deepEqual(current.holdOrder, old.holdOrder);
      assert.equal(current.estimates, 0); assert.equal(old.estimates, 2);
      assert.ok(current.result.regroupDecisions.every(([, row]) => row.stage === 'rotation_wait'));
    });
    check('healthy unheld squads perform one full combat assessment after callbacks', () => {
      const current = runTeam(production.team), old = runTeam(reference.team);
      assert.deepEqual(current.result, old.result); assert.deepEqual(current.roster, old.roster);
      assert.deepEqual(current.estimatesAtHold, [0, 0]); assert.equal(current.estimates, 2); assert.equal(old.estimates, 4);
      assert.deepEqual(current.estimateOrder, old.estimateOrder.slice(2));
    });
    check('configured exact ratio, guards and callback mutations retain old decisions', () => {
      const cases = [{ enemy: true, ratio: 0.6 }, { enemy: true, ratio: 0.3 }, { enemy: true, ratio: 0.5 },
        { enemy: true, ratio: NaN }, { separated: true }, { growing: true }, { lowHp: true },
        { endgame: true }, { noHoldCallback: true }, { mutate: true }];
      for (const fixture of cases) {
        const current = runTeam(production.team, fixture), old = runTeam(reference.team, fixture);
        assert.deepEqual(current.result, old.result); assert.deepEqual(current.roster, old.roster);
        assert.deepEqual(current.holdOrder, old.holdOrder); assert.equal(current.choices, old.choices);
        assert.equal(current.resources, old.resources);
        if (fixture.enemy) assert.equal(current.resources, Number(!(0.5 < fixture.ratio)));
        if (fixture.mutate) assert.equal(current.resources, 0, 'Re-read combat after the callback introduces an enemy.');
        if (fixture.noHoldCallback || fixture.lowHp || fixture.endgame || fixture.separated || fixture.growing) {
          assert.deepEqual(current.estimateOrder, old.estimateOrder, 'Preserve short-circuit paths.');
        }
      }
    });
    const frameInput = {
      day: 3, phase: 'night', matchSec: 123, survivors: [actor('a'), actor('b', { hp: 0 }),
        actor('a', { hp: 75 }), actor('d', { hp: 0 }), actor('revived')],
      dead: [actor('b', { hp: 0, inventory: [{ itemId: 'corpse', qty: 1 }] }), actor('revived', { hp: 0 })],
      spawnState: { nested: { count: 2 } }, forbiddenIds: new Set(['b']),
    };
    check('owned frame deduplicates the live roster once with identical death order', () => {
      probe.frameRows = 0; const current = production.frame.createSimulationFrame(frameInput), currentRows = probe.frameRows;
      probe.frameRows = 0; const old = reference.frame.createSimulationFrame(frameInput), oldRows = probe.frameRows;
      assert.deepEqual(current, old);
      assert.equal(currentRows, frameInput.survivors.length + frameInput.dead.length);
      assert.equal(oldRows, 2 * frameInput.survivors.length + frameInput.dead.length);
      assert.deepEqual(current.survivors.map(row => [row._id, row.hp]), [['a', 75], ['revived', 100]]);
      assert.deepEqual(current.dead.map(row => row._id), ['b', 'd']);
    });
    check('frames retain nested ownership, aliases, latest mutations and clone errors', () => {
      const shared = { effect: 'shared' }, input = structuredClone(frameInput);
      input.survivors[0].effects = shared; input.survivors[2].effects = shared; input.spawnState.alias = shared;
      const before = structuredClone(input), first = production.frame.createSimulationFrame(input);
      assert.equal(first.survivors[0].effects, first.spawnState.alias);
      first.survivors[0].effects.effect = 'only-frame'; first.dead[0].inventory[0].qty = 99;
      assert.deepEqual(input, before);
      input.survivors[2].hp = 0;
      const second = production.frame.createSimulationFrame(input);
      assert.deepEqual(second, reference.frame.createSimulationFrame(input));
      assert.equal(second.spawnState.alias.effect, 'shared'); assert.notEqual(second.spawnState, first.spawnState);
      for (const runtime of [production.frame, reference.frame]) {
        assert.throws(() => runtime.createSimulationFrame({ ...frameInput, spawnState: { cannotClone() {} } }), { name: 'DataCloneError' });
      }
    });
    const populations = rows => [...rows].map(([space, zones]) => [space, Object.entries(zones)]);
    check('combat spaces and zones are counted once without changing insertion or exclusion rules', () => {
      const rows = [actor('field-b', { zoneId: 'b' }), actor('rift-a', { _combatSpaceId: 'dimension_rift:r1' }),
        null, actor('dead', { hp: 0, _combatSpaceId: 'dimension_rift:r2' }), actor('field-a'),
        actor('invalid-zone', { zoneId: '' }), actor('nan', { hp: 'invalid', zoneId: 'nan-zone' }),
        actor('legacy-key', { zoneId: '__proto__' })];
      const before = structuredClone(rows);
      probe.spaces = 0; const current = production.pipeline.buildBaseZonePopulations(rows), currentReads = probe.spaces;
      probe.spaces = 0; const old = reference.pipeline.buildBaseZonePopulations(rows), oldReads = probe.spaces;
      assert.deepEqual(populations(current), populations(old)); assert.deepEqual(rows, before);
      assert.equal(currentReads, rows.length); assert.ok(oldReads > currentReads);
      assert.deepEqual([...current.keys()], ['world', 'dimension_rift:r1', 'dimension_rift:r2']);
      assert.deepEqual(Object.keys(current.get('world')), ['b', 'a', 'nan-zone']);
    });
    check('population facts expire between calls and preserve duplicate rows', () => {
      const rows = [actor('dup'), actor('dup'), actor('other', { _combatSpaceId: 'dimension_rift:r1' })];
      assert.equal(production.pipeline.buildBaseZonePopulations(rows).get('world').a, 2);
      rows[0].hp = 0; rows[1].zoneId = 'b'; rows[2]._combatSpaceId = 'world';
      assert.deepEqual(populations(production.pipeline.buildBaseZonePopulations(rows)),
        populations(reference.pipeline.buildBaseZonePopulations(rows)));
      assert.deepEqual(populations(production.pipeline.buildBaseZonePopulations([])), []);
    });
    assert.equal(failures, 0, `${failures} roster-fact regressions failed.`);
    console.log(JSON.stringify({ checks, pass: true, scope: 'call-local roster operations, stable scoring, callback boundaries and owned frames; not browser speed' }));
  } finally { hook.deregister(); delete globalThis.__planningRosterProbe; }
  if (!process.argv.includes('--fixtures-only')) {
    const seeds = process.argv.find(value => value.startsWith('--seeds='))?.slice(8).split(',') || [seed];
    for (const matchSeed of seeds) {
      const rows = ['reference', 'production'].map(mode => {
        const output = execFileSync(process.execPath, [fileURLToPath(import.meta.url), `--worker=${mode}`, `--seed=${matchSeed}`], {
          cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
        });
        const row = JSON.parse(output.trim()), evidence = row.outcome.evidence;
        console.log(JSON.stringify({ completed: mode, engine: row.engine, overlayCounts: row.overlayCounts,
          seed: evidence.seed, phases: evidence.phases, frames: evidence.frames, ticks: evidence.ticks,
          eventCount: evidence.eventCount, ending: evidence.ending.outcome, winnerTeamId: evidence.ending.winnerTeamId,
          randomState: evidence.random.state, randomDraws: evidence.random.draws,
          inputDigest: row.outcome.inputDigest, eventDigest: evidence.eventDigest, frameDigest: evidence.frameDigest,
          endingDigest: digest(evidence.ending), finalFrameDigest: row.outcome.finalFrameDigest, logDigest: row.outcome.logDigest }));
        return row;
      });
      assert.equal(rows[0].engine, rows[1].engine);
      assert.deepEqual(rows[0].outcome, rows[1].outcome, 'Roster work reduction must retain all events, frames, logs, ending and RNG.');
      console.log(JSON.stringify({ pass: true, seed: matchSeed, matches: 2,
        scope: 'fresh complete matches against original local expressions; not historical replay, all inputs or real x32 speed' }));
    }
  }
}
