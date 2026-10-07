const finite = value => typeof value === 'number' && Number.isFinite(value);
const nonnegative = value => finite(value) && value >= 0;
const integer = value => Number.isInteger(value) && value >= 0;
const verdict = (status, reason, value = null) => ({ status, reason, value });

// These are evidence gates, not a claim about painted FPS, INP, other machines
// or absence of leaks. Only the repository's existing strict <200ms Long Task
// gate has a default. Declare other quality budgets BEFORE collecting samples.
export function analyzeObserverPerformanceRuns(runs, {
  expectedEngine, maxLongTaskMs = 200, maxRafP95Ms, maxRafGapMs, maxBaselineHeapGrowthBytes,
} = {}) {
  const issues = [];
  if (!Array.isArray(runs)) runs = [];
  if (!/^[a-f0-9]{64}$/.test(expectedEngine ?? '')) issues.push('expected engine must be an explicit 64-character hash');
  if (runs.length !== 9) issues.push('require exactly nine runs: three consecutive replays at each of x1, x8 and x32');
  const rows = runs.map((run, index) => {
    const gaps = [];
    const context = run?.context, initial = context?.initial, final = context?.final;
    const speed = initial?.speed;
    if (run?.schema !== 'eh-observer-performance.v3') gaps.push('v3 boundary and context evidence missing');
    if (!expectedEngine || run?.engineVersion !== expectedEngine
      || initial?.engineVersion !== expectedEngine || final?.engineVersion !== expectedEngine) gaps.push('engine mismatch or unidentified engine');
    if (run?.boundary?.status !== 'settled' || run?.boundary?.stopReason !== 'replay-complete') gaps.push('not automatically finalized after replay comparison and a frame/task barrier');
    if (!nonnegative(run?.startedAtMs) || !finite(run?.endedAtMs) || !finite(run?.elapsedMs) || run.elapsedMs <= 0
      || Math.abs(run.endedAtMs - run.startedAtMs - run.elapsedMs) > 0.003) gaps.push('invalid or incomplete measurement clock');
    const visibility = run?.visibility;
    if (visibility?.supported !== true || visibility.entireMeasurementVisible !== true
      || visibility.initialState !== 'visible' || visibility.endState !== 'visible' || visibility.transitions !== 0
      || visibility.boundaryNotifications !== 0
      || visibility.durationMs?.hidden !== 0 || visibility.durationMs?.unknown !== 0
      || !finite(visibility.durationMs?.visible) || Math.abs(visibility.durationMs.visible - run?.elapsedMs) > 0.003) gaps.push('continuous visible coverage unproven');
    if (![1, 8, 32].includes(speed) || final?.speed !== speed || context?.speedChanges !== 0) gaps.push('actual speed missing or changed; free-text labels are not evidence');
    if (initial?.replayMode !== true || final?.replayMode !== true || !initial?.replayId
      || initial.replayId !== final?.replayId || !initial?.seed || initial.seed !== final?.seed
      || context?.identityChanges !== 0) gaps.push('identical replay source/seed unproven');
    if (initial?.day !== 0 || initial?.matchSec !== 0 || initial?.autoPlay !== false || initial?.isGameOver !== false
      || final?.isGameOver !== true || !finite(final?.matchSec) || final.matchSec <= 0
      || final?.comparisonMatched !== true || !Number.isInteger(final?.comparedEvents) || final.comparedEvents <= 0) gaps.push('measurement must precede start and include a completed matching replay');
    if (context?.pauses !== 0 || !nonnegative(context?.activeStartOffsetMs) || context.activeStartOffsetMs > 5000
      || !finite(context?.activeEndOffsetMs) || context.activeEndOffsetMs <= context.activeStartOffsetMs
      || !nonnegative(run?.elapsedMs - context.activeEndOffsetMs) || run.elapsedMs - context.activeEndOffsetMs > 1000) gaps.push('paused run, excessive setup/result idle, or missing active run boundaries');
    const environment = run?.environment;
    if (!finite(run?.timeOriginMs) || run.timeOriginMs <= 0 || !environment?.userAgent
      || !finite(environment?.viewportWidth) || environment.viewportWidth <= 0
      || !finite(environment?.viewportHeight) || environment.viewportHeight <= 0
      || !finite(environment?.devicePixelRatio) || environment.devicePixelRatio <= 0) gaps.push('browser/document/viewport provenance missing');

    const tasks = run?.longTasks;
    const maxTask = tasks?.count === 0 && tasks.maxMs === null ? 0 : tasks?.maxMs;
    const validTasks = tasks?.supported === true && integer(tasks.count) && nonnegative(tasks.totalMs)
      && nonnegative(maxTask) && tasks.totalMs >= maxTask
      && (tasks.count === 0 ? tasks.totalMs === 0 : maxTask >= 50);
    const longTasks = !validTasks || !finite(maxLongTaskMs) || maxLongTaskMs <= 0
      ? verdict('unverified', 'Long Tasks support, metrics or budget missing')
      : verdict(maxTask < maxLongTaskMs ? 'pass' : 'fail', 'strict maximum Long Task budget', maxTask);
    const raf = run?.raf;
    const validRaf = raf?.supported === true && Number.isInteger(raf.samples) && raf.samples > 0
      && raf.percentiles?.scope === 'entire_measurement' && nonnegative(raf.intervalMs?.max)
      && nonnegative(raf.boundaryGapsMs?.firstRafDelay) && nonnegative(raf.boundaryGapsMs?.trailingRafGap);
    const peakGap = validRaf ? Math.max(raf.intervalMs.max, raf.boundaryGapsMs.firstRafDelay, raf.boundaryGapsMs.trailingRafGap) : null;
    const rafGap = !validRaf || !finite(maxRafGapMs) || maxRafGapMs <= 0
      ? verdict('unverified', 'RAF samples, boundary gaps or predeclared gap budget missing', peakGap)
      : verdict(peakGap <= maxRafGapMs ? 'pass' : 'fail', 'maximum including first/trailing RAF gaps', peakGap);
    // Rounded histogram values are estimates. Use their upper rounding bound;
    // null/overflow can never become zero or a healthy clamped percentile.
    const p95 = raf?.intervalMs?.p95, resolution = raf?.percentiles?.resolutionMs;
    const rafP95 = !validRaf || !finite(maxRafP95Ms) || maxRafP95Ms <= 0
      ? verdict('unverified', 'RAF samples or predeclared p95 budget missing', p95 ?? null)
      : !nonnegative(p95) || !finite(resolution) || resolution <= 0 || raf.percentiles.p95RangeMs != null
        ? verdict('unverified', 'p95 unavailable/overflow; preserve reported range', raf.percentiles?.p95RangeMs ?? null)
        : verdict(p95 + resolution / 2 <= maxRafP95Ms ? 'pass' : 'fail', 'histogram p95 upper rounding bound', p95);
    const heap = run?.heap;
    const validHeap = heap?.supported === true && nonnegative(heap.baselineUsedBytes) && nonnegative(heap.usedBytes)
      && finite(heap.deltaUsedBytes) && heap.usedBytes - heap.baselineUsedBytes === heap.deltaUsedBytes;
    return { index: index + 1, speed: speed ?? null, label: run?.label ?? null,
      validity: verdict(gaps.length ? 'unverified' : 'pass', gaps),
      longTasks, rafP95, rafGap,
      heap: verdict(validHeap ? 'measured' : 'unverified', 'performance.memory sample; GC-sensitive, not leak proof',
        validHeap ? { baselineBytes: heap.baselineUsedBytes, endBytes: heap.usedBytes, deltaBytes: heap.deltaUsedBytes } : null),
      longAnimationFrames: { supported: run?.longAnimationFrames?.supported === true,
        maxMs: run?.longAnimationFrames?.maxDurationMs ?? null, maxRenderMs: run?.longAnimationFrames?.maxRenderMs ?? null },
      inputResponse: { scope: 'click_to_next_RAF_not_INP_or_presentation', samples: run?.inputResponse?.samples ?? null,
        pendingSamples: run?.inputResponse?.pendingSamples ?? null, maxMs: run?.inputResponse?.maxMs ?? null },
      visibility: visibility ?? null, elapsedMs: run?.elapsedMs ?? null };
  });
  const first = runs[0];
  for (let index = 1; index < runs.length; index++) {
    const run = runs[index], previous = runs[index - 1];
    if (run?.timeOriginMs !== first?.timeOriginMs || JSON.stringify(run?.environment) !== JSON.stringify(first?.environment)) issues.push(`run ${index + 1}: document reload or environment changed`);
    if (!finite(run?.startedAtMs) || !finite(previous?.endedAtMs) || run.startedAtMs < previous.endedAtMs) issues.push(`run ${index + 1}: chronological sequence overlaps or is unknown`);
    if (run?.context?.initial?.replayId !== first?.context?.initial?.replayId
      || run?.context?.initial?.seed !== first?.context?.initial?.seed) issues.push(`run ${index + 1}: different replay input identity`);
  }
  const groups = [1, 8, 32].map(speed => {
    const indices = rows.flatMap((row, index) => row.speed === speed ? [index] : []);
    if (indices.length !== 3 || indices[2] - indices[0] !== 2) issues.push(`x${speed}: require three consecutive runs, without selecting the best samples`);
    const baselines = indices.map(index => rows[index].heap.value?.baselineBytes ?? null);
    const growth = baselines.length === 3 && baselines.every(nonnegative) ? Math.max(...baselines) - baselines[0] : null;
    const monotonicGrowth = baselines.length === 3 && baselines.every(nonnegative)
      && baselines[0] < baselines[1] && baselines[1] < baselines[2];
    const memory = growth == null || !nonnegative(maxBaselineHeapGrowthBytes)
      ? verdict('unverified', 'three supported baseline samples or predeclared heap growth budget missing', growth)
      : growth > maxBaselineHeapGrowthBytes ? verdict('fail', 'observed baseline growth exceeds budget; not a leak diagnosis', growth)
        : monotonicGrowth ? verdict('unverified', 'all three baselines grew; retain lifetime/GC investigation', growth)
          : verdict('pass', 'observed three-run baseline growth gate only; not absence of leaks', growth);
    return { speed, runIndices: indices.map(index => index + 1), baselineBytes: baselines, memory };
  });
  const valid = !issues.length && rows.every(row => row.validity.status === 'pass');
  const gates = rows.flatMap(row => [row.longTasks, row.rafP95, row.rafGap]).concat(groups.map(group => group.memory));
  const status = !valid ? 'unverified' : gates.some(gate => gate.status === 'fail') ? 'fail'
    : gates.every(gate => gate.status === 'pass') ? 'pass' : 'unverified';
  return { schema: 'eh-observer-browser-verification.v1', status,
    scope: 'observed_nine_run_gates_not_painted_FPS_INP_or_absence_of_leaks',
    policy: { expectedEngine: expectedEngine ?? null, maxLongTaskMs, maxRafP95Ms: maxRafP95Ms ?? null,
      maxRafGapMs: maxRafGapMs ?? null, maxBaselineHeapGrowthBytes: maxBaselineHeapGrowthBytes ?? null },
    issues, runs: rows, groups };
}
