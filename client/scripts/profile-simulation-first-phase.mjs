import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');

// A bounded diagnostic, not a completed match or a browser performance gate.
// The test harness freezes/hashes every frame; report those samples separately.
const destination = process.argv[2];
assert.ok(destination, 'Supply a new output directory for this diagnostic.');
const outputDirectory = path.resolve(destination);
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
const evidence = {
  schema: 'eh-first-phase-node-profile.v1',
  scope: 'Node diagnostic including test harness overhead; no browser timing or completed-match acceptance',
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
