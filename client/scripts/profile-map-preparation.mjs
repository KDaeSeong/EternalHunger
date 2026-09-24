import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const { buildGuestSimulationMap, buildGuestSimulationRoster, loadGuestSimulationItemCatalog } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { buildInitialSimulationRoster } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { getDefaultSimulationSettings } = await import('../src/app/simulation/_lib/simulationPageRuntime.js');
const { rebaseSurvivorsForMap } = await import('../src/app/simulation/_lib/mapActionRuntime.js');

// Bounded Node CPU diagnostic. These timings are not browser input latency.
const destination = process.argv[2];
assert.ok(destination, 'Supply a new output directory.');
const outputDirectory = path.resolve(destination);
const baselinePath = process.argv[3];
const baseline = baselinePath ? JSON.parse(await readFile(path.resolve(baselinePath), 'utf8')) : null;
let input = baseline?.input;
if (!input) {
  const items = await loadGuestSimulationItemCatalog();
  const map = buildGuestSimulationMap();
  const originalRandom = Math.random;
  let randomState = 1101;
  Math.random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  let roster;
  try {
    roster = buildInitialSimulationRoster({
      charList: buildGuestSimulationRoster(), routeItems: items, initialMap: map,
      initialZoneIds: map.zones.map((zone) => zone.zoneId), loadedSettings: getDefaultSimulationSettings(),
    }).shuffledChars;
  } finally {
    Math.random = originalRandom;
  }
  const ids = ['alley', 'gas_station', 'archery', 'school', 'police', 'firestation', 'temple', 'stream'];
  input = { items, roster, maps: [map, {
    _id: 'local-map-navigation-contract',
    zones: ids.map((zoneId) => ({ zoneId, hasHyperloop: false })),
    zoneConnections: ids.slice(0, -1).map((fromZoneId, index) => ({ fromZoneId, toZoneId: ids[index + 1], bidirectional: false })),
  }] };
}
const before = JSON.stringify(input);
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const session = new Session();
session.connect();
const post = (method, params = {}) => new Promise((resolve, reject) => {
  session.post(method, params, (error, result) => error ? reject(error) : resolve(result));
});
await post('Profiler.enable');
await post('Profiler.setSamplingInterval', { interval: 1000 });
const cases = [];
for (const map of input.maps) {
  await post('Profiler.start');
  const start = performance.now();
  const output = rebaseSurvivorsForMap(input.roster, map, input.items);
  const elapsedMs = performance.now() - start;
  const { profile } = await post('Profiler.stop');
  const expected = baseline?.cases.find((row) => row.mapId === map._id);
  if (baseline) {
    assert.ok(expected, 'Every measured map needs a baseline.');
    assert.deepEqual(output, expected.output, 'Optimization must preserve every actor field and route.');
  }
  cases.push({ mapId: map._id, zones: map.zones.length, elapsedMs, digest: digest(output), output, profile });
}
session.disconnect();
assert.equal(JSON.stringify(input), before, 'Preparation must not mutate the input.');
const topSelf = (profile) => {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const rows = new Map();
  profile.samples.forEach((id, index) => {
    const { functionName, url, lineNumber } = nodes.get(id).callFrame;
    const key = `${url}:${lineNumber}:${functionName}`;
    const row = rows.get(key) || { functionName, url, line: lineNumber + 1, selfMs: 0 };
    row.selfMs += (profile.timeDeltas[index] || 0) / 1000;
    rows.set(key, row);
  });
  return [...rows.values()].sort((a, b) => b.selfMs - a.selfMs).slice(0, 15);
};
const evidence = {
  schema: 'eh-map-preparation-node-profile.v1',
  scope: 'Node preparation timing, not browser responsiveness or match acceptance',
  inputDigest: digest(input), actors: input.roster.length, items: input.items.length,
  baselineMatched: baseline ? true : null,
  cases: cases.map(({ output: _output, profile, ...row }) => ({ ...row, topSelf: topSelf(profile) })),
};
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, 'baseline.json'), JSON.stringify({ input, cases: cases.map(({ profile: _profile, ...row }) => row) }), { flag: 'wx' });
for (const row of cases) await writeFile(path.join(outputDirectory, `${row.zones}-zones.cpuprofile`), JSON.stringify(row.profile), { flag: 'wx' });
await writeFile(path.join(outputDirectory, 'summary.json'), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify(evidence, null, 2));
