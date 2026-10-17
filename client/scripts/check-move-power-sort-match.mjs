import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const movementURL = new URL('../src/app/simulation/_lib/phaseActorMovementRuntime.js', import.meta.url).href;
const currentStatement = '  const worstSameZoneOpponent = sortActorsByMovePowerDescending(sameZoneOpponents, movePowerContext)[0] || null;';
const referenceStatement = [
  '  const worstSameZoneOpponent = sameZoneOpponents',
  '    .slice()',
  '    .sort((a, b) => Number(estimateMovePower(b, movePowerContext) || 0) - Number(estimateMovePower(a, movePowerContext) || 0))[0] || null;',
].join('\n');
const MATCH_TIMEOUT_MS = 12 * 60 * 1000;

function referenceMovementSource(source) {
  const normalized = source.replaceAll('\r\n', '\n');
  const lines = normalized.split('\n');
  const occurrences = lines.reduce((count, line) => count + Number(line === currentStatement), 0);
  assert.equal(occurrences, 1, 'Reference must replace exactly the current move-power sort statement once.');
  const index = lines.indexOf(currentStatement);
  assert.ok(index > 0 && index + 1 < lines.length, 'The target statement must remain inside its expected block.');
  assert.ok(lines[index - 2].includes("&& String(target?.zoneId || '') === String(currentZone)")
    && lines[index - 1] === '  ));',
    'The same-zone opponent filter must immediately precede the target statement.');
  assert.equal(lines[index + 1],
    '  const avoidInfoNow = worstSameZoneOpponent ? shouldAvoidCombatByMovePower(updated, worstSameZoneOpponent, movePowerContext) : null;',
    'The combat-avoidance consumer must immediately follow the target statement.');
  const patched = normalized.replace(currentStatement, referenceStatement);
  assert.equal(patched.split(referenceStatement).length - 1, 1, 'The in-memory reference replacement must occur once.');
  assert.equal(patched.split(currentStatement).length - 1, 0, 'The updated statement must not remain in the reference.');
  return patched;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function frameFingerprint() {
  const hash = createHash('sha256');
  let count = 0;
  return {
    observe(frame) {
      const serialized = JSON.stringify(frame);
      hash.update(String(Buffer.byteLength(serialized, 'utf8')));
      hash.update(':');
      hash.update(serialized);
      count += 1;
    },
    finish() { return { count, sha256: hash.digest('hex') }; },
  };
}

async function runWorkerMatch(mode, input) {
  assert.ok(mode === 'reference' || mode === 'updated');
  let movementLoadCount = 0;
  let replacementCount = 0;
  registerHooks({
    load(url, context, nextLoad) {
      const loaded = nextLoad(url, context);
      if (url !== movementURL) return loaded;
      movementLoadCount += 1;
      assert.equal(movementLoadCount, 1, 'The movement runtime must load once in this isolated Worker.');
      if (mode !== 'reference') return loaded;
      const source = referenceMovementSource(readFileSync(new URL(url), 'utf8'));
      replacementCount += 1;
      return { ...loaded, source };
    },
  });

  try {
    // Import only after the in-memory loader hook is installed. The module
    // resolver hook is registered by this runner and remains independent in
    // each Worker thread.
    const { runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
    const frames = frameFingerprint();
    const run = await runRandomIsolationMatch(input, { onFrame: frame => frames.observe(frame) });
    assert.ok(run.evidence.phases > 1 && run.evidence.frames > 0 && run.events.length > 0 && run.logs.length > 0,
      'Both workers must complete a real multi-phase match with frames, events and logs.');
    assert.ok(run.finalFrame && run.evidence.random && run.evidence.ending,
      'Final state, RNG and natural ending must be present, not equal missing values.');
    assert.equal(movementLoadCount, 1, 'The phase movement module must use the hooked Worker-local module cache.');
    assert.equal(replacementCount, mode === 'reference' ? 1 : 0,
      'Only the reference Worker may replace the exact target statement, exactly once.');
    const observedFrames = frames.finish();
    assert.equal(observedFrames.count, run.evidence.frames, 'Every published full frame must be fingerprinted.');
    return {
      mode,
      phases: run.evidence.phases,
      frames: run.evidence.frames,
      frameFingerprint: observedFrames,
      runnerFrameDigest: run.evidence.frameDigest,
      eventCount: run.evidence.eventCount,
      logCount: run.logs.length,
      eventDigest: digest(run.events),
      logDigest: digest(run.logs),
      finalFrame: run.finalFrame,
      random: run.evidence.random,
      ending: run.evidence.ending,
      movementLoadCount,
      replacementCount,
    };
  } catch (error) {
    throw new Error(`${mode} Worker match failed: ${error?.stack || error}`, { cause: error });
  }
}

async function runIsolatedWorker(mode, input) {
  const worker = new Worker(new URL(import.meta.url), { workerData: { mode, input } });
  let timer;
  try {
    return await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        callback(value);
      };
      timer = setTimeout(() => {
        void worker.terminate();
        finish(reject, new Error(`${mode} Worker match exceeded ${MATCH_TIMEOUT_MS}ms.`));
      }, MATCH_TIMEOUT_MS);
      worker.once('message', message => {
        if (message?.ok) finish(resolve, message.result);
        else finish(reject, new Error(message?.error || `${mode} Worker returned no result.`));
      });
      worker.once('error', error => finish(reject, error));
      worker.once('exit', code => {
        if (code !== 0) finish(reject, new Error(`${mode} Worker exited with code ${code}.`));
        else finish(reject, new Error(`${mode} Worker exited before returning its match result.`));
      });
    });
  } finally {
    clearTimeout(timer);
    await worker.terminate();
  }
}

if (!isMainThread) {
  try {
    const result = await runWorkerMatch(workerData.mode, workerData.input);
    parentPort.postMessage({ ok: true, result });
  } catch (error) {
    parentPort.postMessage({ ok: false, error: error?.stack || String(error) });
  }
} else {
  const { createRandomIsolationInput } = await import('./lib/run-random-isolation-match.mjs');
  const input = await createRandomIsolationInput('1101');
  const inputDigest = createHash('sha256').update(input).digest('hex');
  console.log('MOVE_POWER_SORT_MATCH_START reference');
  const reference = await runIsolatedWorker('reference', input);
  console.log(`MOVE_POWER_SORT_MATCH_FINISHED ${JSON.stringify({ mode: 'reference', phases: reference.phases,
    frames: reference.frames, events: reference.eventCount })}`);
  console.log('MOVE_POWER_SORT_MATCH_START updated');
  const updated = await runIsolatedWorker('updated', input);
  console.log(`MOVE_POWER_SORT_MATCH_FINISHED ${JSON.stringify({ mode: 'updated', phases: updated.phases,
    frames: updated.frames, events: updated.eventCount })}`);

  assert.equal(updated.phases, reference.phases, 'Natural phase counts differ.');
  assert.equal(updated.frames, reference.frames, 'Natural frame counts differ.');
  assert.equal(updated.eventCount, reference.eventCount, 'Natural event counts differ.');
  assert.equal(updated.logCount, reference.logCount, 'Full log entry counts differ.');
  assert.deepEqual(updated.frameFingerprint, reference.frameFingerprint, 'Strict all-frame fingerprints differ.');
  assert.equal(updated.runnerFrameDigest, reference.runnerFrameDigest, 'Runner full-frame digests differ.');
  assert.equal(updated.eventDigest, reference.eventDigest, 'Full event journal fingerprints differ.');
  assert.equal(updated.logDigest, reference.logDigest, 'Full log fingerprints differ.');
  assert.deepEqual(updated.finalFrame, reference.finalFrame, 'Final full frame differs.');
  assert.deepEqual(updated.random, reference.random, 'Final gameplay RNG state differs.');
  assert.deepEqual(updated.ending, reference.ending, 'Natural ending summary differs.');

  console.log(`MOVE_POWER_SORT_MATCH ${JSON.stringify({ pass: true, seed: '1101', inputDigest,
    comparison: 'fresh reference uses exactly one in-memory replacement of the current statement; updated uses source as-is',
    workers: 'two isolated Worker threads run sequentially from the same one generated input',
    phases: updated.phases, frames: updated.frames, events: updated.eventCount, logs: updated.logCount,
    frameFingerprint: updated.frameFingerprint, runnerFrameDigest: updated.runnerFrameDigest,
    eventDigest: updated.eventDigest, logDigest: updated.logDigest,
    finalFrameExact: true, randomExact: true, endingExact: true,
    scope: 'fresh ordinary guest whole-match comparison; no performance claim, browser timing/rendering, custom inputs, account storage, or full release gate' })}`);
}
