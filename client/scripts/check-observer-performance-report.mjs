import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyzeObserverPerformanceRuns } from './lib/observer-performance-report.mjs';

// Deliberately synthetic gate fixtures. No row is browser performance evidence.
const engine = 'a'.repeat(64);
const policy = { expectedEngine: engine, maxLongTaskMs: 200, maxRafP95Ms: 50,
  maxRafGapMs: 200, maxBaselineHeapGrowthBytes: 1000, maxInterRunGapMs: 60000 };
function fixture() {
  return [1, 1, 1, 8, 8, 8, 32, 32, 32].map((speed, index) => ({
    schema: 'eh-observer-performance.v3', label: 'arbitrary label', engineVersion: engine,
    numericPrecision: { roundedMillisecondsResolutionMs: 0 }, // Exact synthetic inputs, not rounded browser exports.
    startedAtMs: index * 1200, endedAtMs: index * 1200 + 1000, elapsedMs: 1000, timeOriginMs: 1000000,
    environment: { userAgent: 'synthetic browser', viewportWidth: 1280, viewportHeight: 720, devicePixelRatio: 1 },
    boundary: { status: 'settled', stopReason: 'replay-complete' },
    visibility: { supported: true, entireMeasurementVisible: true, initialState: 'visible', endState: 'visible',
      transitions: 0, boundaryNotifications: 0, durationMs: { visible: 1000, hidden: 0, unknown: 0 } },
    context: { initial: { engineVersion: engine, speed, seed: '1101', replayId: 'synthetic-source', replayMode: true,
      day: 0, matchSec: 0, autoPlay: false, isGameOver: false, comparisonMatched: null, comparedEvents: null },
    final: { engineVersion: engine, speed, seed: '1101', replayId: 'synthetic-source', replayMode: true,
      day: 2, matchSec: 900, autoPlay: false, isGameOver: true, comparisonMatched: true, comparedEvents: 100 },
    speedChanges: 0, identityChanges: 0, pauses: 0, activeStartOffsetMs: 50, activeEndOffsetMs: 950 },
    longTasks: { supported: true, count: 1, totalMs: 55, maxMs: 55 },
    raf: { supported: true, samples: 60, intervalMs: { median: 16.7, p95: 16.7, max: 60 },
      boundaryGapsMs: { firstRafDelay: 10, trailingRafGap: 20 },
      percentiles: { scope: 'entire_measurement', resolutionMs: 0.1, p95RangeMs: null } },
    heap: { supported: true, baselineUsedBytes: 10000, usedBytes: 10100, deltaUsedBytes: 100 },
  }));
}
let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };
check('nine complete samples pass only their explicitly declared observational gates', () => {
  const before = fixture(), copy = structuredClone(before);
  const report = analyzeObserverPerformanceRuns(before, policy);
  assert.equal(report.status, 'pass'); assert.deepEqual(before, copy);
  assert.match(report.scope, /not_painted_FPS_INP_or_absence_of_leaks/);
});
check('defaults preserve the historical strict Long Task gate without inventing frame or memory budgets', () => {
  const report = analyzeObserverPerformanceRuns(fixture(), { expectedEngine: engine });
  assert.equal(report.runs[0].longTasks.status, 'pass'); assert.equal(report.status, 'unverified');
  const failed = fixture(); failed[0].longTasks = { supported: true, count: 1, totalMs: 200, maxMs: 200 };
  assert.equal(analyzeObserverPerformanceRuns(failed, policy).status, 'fail');
});
check('all nine samples are required; missing runs and best-of duplicates cannot pass', () => {
  for (const runs of [[], fixture().slice(0, 8), [...fixture(), fixture()[0]], [null]]) {
    assert.equal(analyzeObserverPerformanceRuns(runs, policy).status, 'unverified');
  }
  const duplicates = fixture(); duplicates[1] = structuredClone(duplicates[0]);
  assert.equal(analyzeObserverPerformanceRuns(duplicates, policy).status, 'unverified');
});
check('old engine, v2, live snapshots and immediate stops cannot inherit the current browser verdict', () => {
  for (const change of [run => run.engineVersion = 'b'.repeat(64), run => run.schema = 'eh-observer-performance.v2',
    run => run.boundary.status = 'recording', run => run.boundary.status = 'draining',
    run => run.boundary.status = 'incomplete', run => run.endedAtMs = null]) {
    const runs = fixture(); change(runs[0]); assert.equal(analyzeObserverPerformanceRuns(runs, policy).status, 'unverified');
  }
});
check('unsupported APIs and null/NaN metrics are never coerced to a healthy zero', () => {
  for (const change of [run => run.longTasks.supported = false, run => run.longTasks.maxMs = null,
    run => run.longTasks.maxMs = NaN, run => run.heap.supported = false,
    run => run.heap.baselineUsedBytes = null, run => run.raf.samples = 0]) {
    const runs = fixture(); change(runs[0]); assert.notEqual(analyzeObserverPerformanceRuns(runs, policy).status, 'pass');
  }
  const zero = fixture(); zero[0].longTasks = { supported: true, count: 0, totalMs: 0, maxMs: null };
  assert.equal(analyzeObserverPerformanceRuns(zero, policy).runs[0].longTasks.value, 0);
});
check('an initially and finally visible tab with a hidden interval is invalid', () => {
  for (const change of [run => run.visibility.durationMs.hidden = 1, run => run.visibility.transitions = 2,
    run => run.visibility.boundaryNotifications = 1, run => delete run.visibility.boundaryNotifications,
    run => delete run.visibility.entireMeasurementVisible, run => run.visibility.supported = false]) {
    const runs = fixture(); change(runs[0]); assert.equal(analyzeObserverPerformanceRuns(runs, policy).status, 'unverified');
  }
});
check('mixed speed, paused/mid-match windows, mismatched replays and post-result idle are invalid', () => {
  for (const change of [run => run.context.speedChanges = 2, run => run.context.pauses = 1,
    run => run.context.initial.matchSec = 20, run => run.context.final.comparisonMatched = false,
    run => run.context.initial.comparisonMatched = true, run => run.context.initial.comparedEvents = 100,
    run => run.context.identityChanges = 1, run => run.context.activeStartOffsetMs = 6000,
    run => run.context.activeEndOffsetMs = null]) {
    const runs = fixture(); change(runs[0]); assert.equal(analyzeObserverPerformanceRuns(runs, policy).status, 'unverified');
  }
});
check('label text cannot substitute for measured speed', () => {
  const runs = fixture(); runs[0].label = 'x32';
  assert.equal(analyzeObserverPerformanceRuns(runs, policy).runs[0].speed, 1);
  delete runs[0].context.initial.speed;
  assert.equal(analyzeObserverPerformanceRuns(runs, policy).status, 'unverified');
});
check('first and trailing RAF stalls fail even when interval p95 is healthy', () => {
  for (const key of ['firstRafDelay', 'trailingRafGap']) {
    const runs = fixture(); runs[0].raf.boundaryGapsMs[key] = 284;
    assert.equal(analyzeObserverPerformanceRuns(runs, policy).status, 'fail');
  }
});
check('overflow and histogram rounding near a budget cannot silently pass', () => {
  const runs = fixture(); runs[0].raf.intervalMs.p95 = null;
  runs[0].raf.percentiles.p95RangeMs = [1500, 4500];
  assert.equal(analyzeObserverPerformanceRuns(runs, policy).status, 'unverified');
  const boundary = fixture(); boundary[0].raf.intervalMs.p95 = 200;
  assert.equal(analyzeObserverPerformanceRuns(boundary, { ...policy, maxRafP95Ms: 200.01 }).status, 'fail');
});
check('reloads, changed viewport, source and interleaved speeds cannot become a sequential memory pass', () => {
  for (const change of [runs => runs[1].timeOriginMs++, runs => runs[1].environment.viewportWidth++,
    runs => runs[1].context.initial.replayId = 'other', runs => [runs[2], runs[3]] = [runs[3], runs[2]]]) {
    const runs = fixture(); change(runs); assert.equal(analyzeObserverPerformanceRuns(runs, policy).status, 'unverified');
  }
});
check('ordered files with long idle intervals cannot become continuous sampling or a memory pass', () => {
  const runs = fixture();
  for (let index = 1; index < runs.length; index++) {
    runs[index].startedAtMs += 100 * 60 * 1000;
    runs[index].endedAtMs += 100 * 60 * 1000;
  }
  const report = analyzeObserverPerformanceRuns(runs, policy);
  assert.equal(report.status, 'unverified');
  assert.equal(report.groups[0].continuity.status, 'unverified');
  assert.equal(report.groups[0].memory.status, 'unverified');
  assert.equal(report.groups[0].continuity.value[0], 6000200);
  assert.equal(report.runs[0].longTasks.status, 'pass');
  runs[0].longTasks = { supported: true, count: 1, totalMs: 318, maxMs: 318 };
  assert.equal(analyzeObserverPerformanceRuns(runs, policy).runs[0].longTasks.status, 'fail');
});
check('continuity requires a predeclared finite bound and includes the exact boundary', () => {
  for (const limit of [undefined, null, -1, NaN, Infinity]) {
    const report = analyzeObserverPerformanceRuns(fixture(), { ...policy, maxInterRunGapMs: limit });
    assert.equal(report.status, 'unverified');
    assert.equal(report.policy.maxInterRunGapMs, null);
  }
  const boundary = analyzeObserverPerformanceRuns(fixture(), { ...policy, maxInterRunGapMs: 200 });
  assert.equal(boundary.status, 'pass');
  assert.deepEqual(boundary.groups[0].continuity.value, [200, 200]);
  assert.equal(analyzeObserverPerformanceRuns(fixture(), { ...policy, maxInterRunGapMs: 199.99 }).status, 'unverified');
  const adjacent = fixture();
  adjacent.forEach((run, index) => { run.startedAtMs = index * 1000; run.endedAtMs = index * 1000 + 1000; });
  assert.equal(analyzeObserverPerformanceRuns(adjacent, { ...policy, maxInterRunGapMs: 0 }).status, 'pass');
});
check('rounded maxima and clock differences cannot slip under narrowly declared budgets', () => {
  const task = fixture(); task[0].numericPrecision.roundedMillisecondsResolutionMs = 0.001;
  task[0].longTasks = { supported: true, count: 1, totalMs: 200, maxMs: 200 };
  assert.equal(analyzeObserverPerformanceRuns(task, { ...policy, maxLongTaskMs: 200.00025 }).status, 'fail');
  const gap = fixture(); gap[0].numericPrecision.roundedMillisecondsResolutionMs = 0.001;
  gap[0].raf.intervalMs.max = 200;
  assert.equal(analyzeObserverPerformanceRuns(gap, policy).status, 'fail');
  for (const key of ['firstRafDelay', 'trailingRafGap']) {
    const boundary = fixture(); boundary[0].numericPrecision.roundedMillisecondsResolutionMs = 0.001;
    boundary[0].raf.boundaryGapsMs[key] = 200;
    assert.equal(analyzeObserverPerformanceRuns(boundary, policy).status, 'fail');
  }
  const clocks = fixture(); clocks.forEach(run => run.numericPrecision.roundedMillisecondsResolutionMs = 0.001);
  assert.equal(analyzeObserverPerformanceRuns(clocks, { ...policy, maxInterRunGapMs: 200 }).status, 'unverified');
  assert.equal(analyzeObserverPerformanceRuns(clocks, { ...policy, maxInterRunGapMs: 200.001 }).status, 'pass');
  const adjacent = fixture(); adjacent.forEach((run, index) => { run.startedAtMs = index * 1000; run.endedAtMs = index * 1000 + 1000; });
  adjacent.forEach(run => run.numericPrecision.roundedMillisecondsResolutionMs = 0.001);
  assert.equal(analyzeObserverPerformanceRuns(adjacent, policy).status, 'unverified');
  const empty = fixture(); empty[0].numericPrecision.roundedMillisecondsResolutionMs = 0.001;
  empty[0].longTasks = { supported: true, count: 0, totalMs: 0, maxMs: null };
  assert.equal(analyzeObserverPerformanceRuns(empty, { ...policy, maxLongTaskMs: 0.00025 }).runs[0].longTasks.status, 'pass');
  const p95 = fixture(); p95[0].numericPrecision.roundedMillisecondsResolutionMs = 0.001;
  assert.equal(analyzeObserverPerformanceRuns(p95, { ...policy, maxRafP95Ms: 16.75025 }).runs[0].rafP95.status, 'fail');
  const coarseP95 = fixture(); coarseP95[0].numericPrecision.roundedMillisecondsResolutionMs = 1;
  coarseP95[0].raf.intervalMs.p95 = 16;
  assert.equal(analyzeObserverPerformanceRuns(coarseP95, { ...policy, maxRafP95Ms: 16.1 }).runs[0].rafP95.status, 'fail');
  const legacy = fixture(); legacy.forEach(run => delete run.numericPrecision);
  assert.equal(analyzeObserverPerformanceRuns(legacy, policy).status, 'pass');
  assert.equal(analyzeObserverPerformanceRuns(legacy, { ...policy, maxInterRunGapMs: 200 }).status, 'unverified');
  for (const resolution of [null, NaN, -1, Infinity]) {
    const invalid = fixture(); invalid[0].numericPrecision.roundedMillisecondsResolutionMs = resolution;
    assert.equal(analyzeObserverPerformanceRuns(invalid, policy).status, 'unverified');
    assert.equal(analyzeObserverPerformanceRuns(invalid, policy).runs[0].rafP95.status, 'unverified');
  }
});
check('three increasing baselines remain unresolved even below a generous budget', () => {
  const runs = fixture();
  for (let index = 0; index < 3; index++) {
    runs[index].heap.baselineUsedBytes += index * 10; runs[index].heap.usedBytes += index * 10;
  }
  assert.equal(analyzeObserverPerformanceRuns(runs, policy).status, 'unverified');
  assert.equal(analyzeObserverPerformanceRuns(runs, { ...policy, maxBaselineHeapGrowthBytes: 1 }).status, 'fail');
});
check('CLI exit codes distinguish passing observational gates, failures and missing evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'observer-report-'));
  try {
    const path = join(directory, 'synthetic.json'); writeFileSync(path, JSON.stringify(fixture()));
    const cli = fileURLToPath(new URL('./analyze-observer-performance.mjs', import.meta.url));
    const args = [cli, path, `--expected-engine=${engine}`, '--max-raf-p95-ms=50',
      '--max-raf-gap-ms=200', '--max-baseline-heap-growth-bytes=1000', '--max-inter-run-gap-ms=60000'];
    assert.equal(spawnSync(process.execPath, args).status, 0);
    assert.equal(spawnSync(process.execPath, [...args, '--max-long-task-ms=50']).status, 1);
    assert.equal(spawnSync(process.execPath, args.filter(arg => !arg.startsWith('--max-inter-run-gap-ms='))).status, 2);
    assert.equal(spawnSync(process.execPath, args.map(arg => arg.startsWith('--max-inter-run-gap-ms=') ? '--max-inter-run-gap-ms=' : arg)).status, 2);
    assert.equal(spawnSync(process.execPath, args.map(arg => arg.startsWith('--max-baseline-heap-growth-bytes=') ? '--max-baseline-heap-growth-bytes= ' : arg)).status, 2);
    assert.equal(spawnSync(process.execPath, [cli]).status, 2);
  } finally { rmSync(directory, { recursive: true }); }
});
console.log(JSON.stringify({ checks, pass: true, scope: 'synthetic report rejection and CLI contracts; not actual browser measurements' }));
