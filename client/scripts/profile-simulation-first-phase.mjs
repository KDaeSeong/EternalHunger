import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

// A bounded diagnostic, not a completed match or a browser performance gate.
// The test harness freezes/hashes every frame; report those samples separately.
const destination = process.argv[2];
assert.ok(destination, 'Supply a new output directory for this diagnostic.');
const outputDirectory = path.resolve(destination);
const teamCountersEnabled = process.argv.slice(3).includes('--team-counters');
const teamRuntimeUrl = new URL('../src/app/simulation/_lib/teamTacticsRuntime.js', import.meta.url).href;
const teamCounters = {
  liveRosterCalls: 0,
  liveRosterInputRows: 0,
  metricsDecisions: 0,
  metricsZoneEvaluations: 0,
  metricsLiveRosterCalls: 0,
  metricsLiveRosterInputRows: 0,
  rallyQueueVisits: 0,
  metricsActive: false,
};
const asText = source => typeof source === 'string' ? source : new TextDecoder().decode(source);
function replaceOnce(source, before, after, label) {
  assert.equal(source.split(before).length, 2, `Expected exactly one ${label} instrumentation boundary.`);
  return source.replace(before, after);
}

let teamRuntimeLoads = 0;
if (teamCountersEnabled) globalThis.__firstPhaseTeamCounters = teamCounters;
const hook = teamCountersEnabled ? registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (url !== teamRuntimeUrl) return loaded;
    teamRuntimeLoads += 1;
    let source = asText(loaded.source);
    source = replaceOnce(source, 'function liveRoster(actor, roster) {\n  const rows =',
      `function liveRoster(actor, roster) {\n  const counterProbe = globalThis.__firstPhaseTeamCounters;\n  const inputRowCount = Array.isArray(roster) ? roster.length : 0;\n  counterProbe.liveRosterCalls += 1;\n  counterProbe.liveRosterInputRows += inputRowCount;\n  if (counterProbe.metricsActive) {\n    counterProbe.metricsLiveRosterCalls += 1;\n    counterProbe.metricsLiveRosterInputRows += inputRowCount;\n  }\n  const rows =`, 'liveRoster entry');
    source = replaceOnce(source,
      '    const metrics = new Map((zones.length > 1 ? zones : []).map(zone => [zone, {',
      '    globalThis.__firstPhaseTeamCounters.metricsDecisions += 1;\n    const metrics = new Map((zones.length > 1 ? zones : []).map(zone => [zone, {',
      'metrics decision count');
    source = replaceOnce(source,
      '      threat: assessTeamCombat(safeMembers[0], roster, { estimatePower, zoneId: zone }).enemyPower,',
      `      threat: (() => {\n        const counterProbe = globalThis.__firstPhaseTeamCounters;\n        counterProbe.metricsZoneEvaluations += 1;\n        counterProbe.metricsActive = true;\n        try { return assessTeamCombat(safeMembers[0], roster, { estimatePower, zoneId: zone }).enemyPower; }\n        finally { counterProbe.metricsActive = false; }\n      })(),`,
      'metrics zone assessment');
    source = replaceOnce(source,
      '      const zone = queue[i];\n      if (counts.has(zone) && !forbiddenIds.has(zone))',
      '      const zone = queue[i];\n      globalThis.__firstPhaseTeamCounters.rallyQueueVisits += 1;\n      if (counts.has(zone) && !forbiddenIds.has(zone))',
      'rally queue visit');
    return { ...loaded, source };
  },
}) : null;

async function runDiagnostic() {
  // Register the source hook before loading the runner, which imports the team runtime.
  const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
  const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
  const input = await createRandomIsolationInput('1101');
  const stopAtSec = 130;
  const boundary = new Error('diagnostic first-phase boundary');
  const session = new Session();
  session.connect();
  const post = (method, params = {}) => new Promise((resolve, reject) => {
    session.post(method, params, (error, result) => error ? reject(error) : resolve(result));
  });
  let finalFrame;
  let finalEvents;
  let frameCount = 0;
  let reachedBoundary = false;
  let profile;
  await post('Profiler.enable');
  await post('Profiler.setSamplingInterval', { interval: 1000 });
  await post('Profiler.start');
  const startedAt = performance.now();
  try {
    await runRandomIsolationMatch(input, {
      onFrame(frame, { events }) {
        frameCount += 1;
        if (frame.matchSec < stopAtSec) return;
        finalFrame = frame;
        finalEvents = events;
        throw boundary;
      },
    });
  } catch (error) {
    if (error !== boundary) throw error;
    reachedBoundary = true;
  } finally {
    ({ profile } = await post('Profiler.stop'));
    session.disconnect();
  }
  const elapsedMs = performance.now() - startedAt;
  assert.ok(reachedBoundary, 'The diagnostic must reach the first phase boundary.');
  assert.equal(finalFrame.matchSec, stopAtSec);
  if (teamCountersEnabled) assert.equal(teamRuntimeLoads, 1, 'The exact team runtime must be instrumented once.');

  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const samples = new Map();
  for (let index = 0; index < profile.samples.length; index += 1) {
    const node = nodes.get(profile.samples[index]);
    const { functionName, url, lineNumber } = node.callFrame;
    const key = `${url}:${lineNumber}:${functionName}`;
    const entry = samples.get(key) || { functionName, url, line: lineNumber + 1, selfMs: 0, samples: 0 };
    entry.selfMs += (profile.timeDeltas[index] || 0) / 1000;
    entry.samples += 1;
    samples.set(key, entry);
  }
  const sorted = [...samples.values()].sort((left, right) => right.selfMs - left.selfMs);
  const top = (predicate) => sorted.filter(predicate).slice(0, 20).map((entry) => ({
    ...entry, selfMs: Math.round(entry.selfMs * 1000) / 1000,
  }));
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  const { metricsActive, ...reportedCounters } = teamCounters;
  assert.equal(metricsActive, false, 'Metrics instrumentation cannot remain active beyond its synchronous assessment.');
  const evidence = {
    schema: 'eh-first-phase-node-profile.v1',
    scope: 'Node diagnostic including test harness overhead; no browser timing or completed-match acceptance',
    engineVersion: SIMULATION_ENGINE_VERSION,
    teamCounterScope: teamCountersEnabled
      ? 'teamTacticsRuntime only; seed 1101 through matchSec 130; metricsActive covers only each synchronous metrics-zone assessment; counters aggregate the bounded prefix and are not a cross-yield cache; counter instrumentation adds measurement overhead'
      : 'disabled; original CPU profile instrumentation only',
    ...(teamCountersEnabled ? { teamCounters: reportedCounters } : {}),
    seed: '1101', inputDigest: digest(input), stopAtSec, frameCount,
    eventCount: finalEvents.length, frameDigest: digest(JSON.stringify(finalFrame)),
    eventDigest: digest(JSON.stringify(finalEvents)), elapsedMs,
    topRuntimeSelf: top((entry) => /\/src\//.test(entry.url)),
    topAllSelf: top(() => true),
  };
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, 'first-phase.cpuprofile'), JSON.stringify(profile), { flag: 'wx' });
  await writeFile(path.join(outputDirectory, 'summary.json'), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify(evidence, null, 2));
}

try {
  await runDiagnostic();
} finally {
  hook?.deregister();
  if (teamCountersEnabled) delete globalThis.__firstPhaseTeamCounters;
}
