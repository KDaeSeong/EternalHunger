import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { exportSimulationBattleLog } = await import('../src/app/simulation/_lib/logActionRuntime.js');
const { captureSimulationReplayResult, createSimulationRunInput, prepareSimulationRunInput, compareSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { buildSimulationEvaluationExport, startSimulationEvaluation } = await import('../src/app/simulation/_lib/simulationEvaluationRuntime.js');

let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`); }
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fixture = JSON.parse(await createRandomIsolationInput('log-export-20261003'));
fixture.map.crateAllowDeny = { alley: ['fixture-denied-crate'] };
fixture.settings.authToken = 'fixture-private-token';
const input = createSimulationRunInput({ ...fixture, activeMap: fixture.map, publicItems: fixture.items });
const before = structuredClone(input);
fixture.survivors[0].hp = 1;
fixture.items[0].name = 'changed after the input capture';
fixture.map.crateAllowDeny = {};
const events = Array.from({ length: 5300 }, (_, index) => ({ kind: 'fixture', index }));
const refs = { fullLogsRef: { current: ['pregame', '=== 1일차 낮 ===', 'fixture battle'] }, runInputRef: { current: input } };
const state = { settings: fixture.settings, runEvents: events };
const downloads = [];
const blobs = new Map();
const oldWindow = globalThis.window, oldDocument = globalThis.document;
const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
globalThis.window = { setTimeout: (callback) => callback() };
globalThis.document = {
  body: { appendChild() {} },
  createElement: () => ({ click() { downloads.push({ filename: this.download, blob: blobs.get(this.href) }); }, remove() {} }),
};
URL.createObjectURL = (blob) => { const url = `blob:fixture-${blobs.size}`; blobs.set(url, blob); return url; };
URL.revokeObjectURL = () => {};
async function exported(format = 'json', exportRefs = refs, exportState = state) {
  const result = exportSimulationBattleLog({ format, refs: exportRefs, state: exportState });
  assert.equal(result.ok, true);
  const download = downloads.at(-1);
  return { result, filename: download.filename, text: await download.blob.text() };
}
try {
  await check('download contains the captured starting input, not later actor/catalog/map edits', async () => {
    const { text, filename } = await exported();
    const payload = JSON.parse(text);
    assert.equal(payload.schema, 'eternal-hunger.battle-log.v1');
    assert.ok(payload.input, 'a fresh export must include the captured starting input');
    assert.equal(digest(payload.input), digest(before));
    assert.equal(digest(prepareSimulationRunInput(payload.input).state.survivors), digest(before.initialFrame.survivors));
    assert.equal(payload.input.settings.authToken, undefined);
    assert.ok(filename.endsWith('.json'));
    assert.deepEqual(payload.logs.map((entry) => entry.text), ['=== 1일차 낮 ===', 'fixture battle']);
    assert.equal(digest(payload.runEvents), digest(events));
    assert.equal(digest(input), digest(before), 'export must not mutate the input');
  });
  await check('a log without captured input remains downloadable but does not invent a replay input', async () => {
    const { text } = await exported('json', { fullLogsRef: refs.fullLogsRef });
    assert.equal(JSON.parse(text).input, null);
  });
  await check('Markdown remains readable without embedding the starting catalog', async () => {
    const { text, filename } = await exported('md');
    assert.ok(filename.endsWith('.md'));
    assert.match(text, /^# Eternal Hunger Battle Log/);
    assert.match(text, /fixture battle/);
    assert.equal(text.includes('"publicItems"'), false);
  });
  await check('an empty journal does not download a fake log', () => {
    const count = downloads.length;
    assert.equal(exportSimulationBattleLog({ refs: { fullLogsRef: { current: [] }, runInputRef: refs.runInputRef } }).status, 'empty');
    assert.equal(downloads.length, count);
  });
  await check('the page passes the live captured-input ref through the log hook', () => {
    const page = readFileSync(new URL('../src/app/simulation/_lib/useSimulationPageController.js', import.meta.url), 'utf8');
    const hook = readFileSync(new URL('../src/app/simulation/_lib/useSimulationLogs.js', import.meta.url), 'utf8');
    assert.match(page, /useSimulationLogs\(\{[\s\S]*?runInputRef,/);
    assert.match(hook, /exportSimulationBattleLog\(\{[\s\S]*?refs:\s*\{\s*fullLogsRef,\s*runInputRef\s*\}/);
  });
  await check('evaluation export includes an owned, matching replay archive without account properties', () => {
    const rows = new Map();
    const storage = { getItem: (key) => rows.get(key) || null, setItem: (key, value) => rows.set(key, value) };
    const evaluation = startSimulationEvaluation({ runId: 'fixture-export', storage }).record;
    const archive = { schema: input.schema, id: evaluation.runId, input, finishedAt: Date.now(),
      events: [{ kind: 'match_end' }], finalFrame: input.initialFrame, random: { seed: input.runSeed },
      summary: { ending: { outcome: 'fixture', atSec: 0 } }, authToken: 'private-account-property' };
    const payload = buildSimulationEvaluationExport({ evaluation, replayRecord: archive });
    assert.equal(payload.replayAvailability, 'full-record');
    assert.equal(digest(payload.replay.input), digest(before));
    assert.equal(digest(payload.replay.events), digest(archive.events));
    assert.equal(payload.replay.authToken, undefined);
    assert.notEqual(payload.replay.input, archive.input);
    assert.equal(compareSimulationReplay(payload.replay, captureSimulationReplayResult({
      events: archive.events, finalFrame: archive.finalFrame, random: archive.random, ending: archive.summary.ending,
    })).matched, true);
    const mismatch = buildSimulationEvaluationExport({ evaluation, replayRecord: { ...archive, id: 'another-run' } });
    assert.equal(mismatch.replay, null);
    assert.equal(mismatch.replayAvailability, 'missing');
    const summaryOnly = buildSimulationEvaluationExport({ evaluation, replayRecord: { id: evaluation.runId, runSeed: input.runSeed } });
    assert.equal(summaryOnly.replayAvailability, 'summary-only');
    assert.equal(summaryOnly.replay.input, undefined);
  });
  if (process.argv.includes('--match')) {
    await check('a fresh completed match exported to JSON reproduces all events, final state, random state and ending', async () => {
      function progress(label) {
        let boundary = '';
        return (frame) => {
          const current = `${frame.day}:${frame.phase}`;
          if (current !== boundary) { boundary = current; console.log(`PROGRESS ${label} day=${frame.day} phase=${frame.phase}`); }
        };
      }
      const original = await runRandomIsolationMatch(null, { savedInput: before, onFrame: progress('original') });
      // Production completeReplay owns/normalizes the result through this same
      // capture before saving or comparing. A raw headless frame can contain
      // undefined properties that cannot survive any JSON download.
      const originalResult = captureSimulationReplayResult({ events: original.events, finalFrame: original.finalFrame,
        random: original.evidence.random, ending: original.evidence.ending });
      const { text } = await exported('json', {
        fullLogsRef: { current: original.logs.map((entry) => entry.text) }, runInputRef: { current: before },
      }, { settings: before.settings, runEvents: original.events });
      const payload = JSON.parse(text);
      const rows = new Map();
      const storage = { getItem: (key) => rows.get(key) || null, setItem: (key, value) => rows.set(key, value) };
      const evaluation = startSimulationEvaluation({ runId: 'fresh-completed-export', storage }).record;
      const exportedEvaluation = JSON.parse(JSON.stringify(buildSimulationEvaluationExport({ evaluation,
        replayRecord: { schema: before.schema, id: evaluation.runId, input: before, finishedAt: Date.now(),
          ...originalResult },
      })));
      assert.equal(exportedEvaluation.replayAvailability, 'full-record');
      assert.equal(digest(exportedEvaluation.replay.input), digest(payload.input));
      assert.equal(digest(exportedEvaluation.replay.events), digest(payload.runEvents));
      const rerun = await runRandomIsolationMatch(null, { savedInput: payload.input, onFrame: progress('downloaded-input') });
      const expected = { ...originalResult, events: payload.runEvents };
      const actual = captureSimulationReplayResult({ events: rerun.events, finalFrame: rerun.finalFrame,
        random: rerun.evidence.random, ending: rerun.evidence.ending });
      assert.equal(compareSimulationReplay(expected, actual).matched, true);
      assert.equal(compareSimulationReplay(exportedEvaluation.replay, actual).matched, true);
      assert.equal(original.evidence.frameDigest, rerun.evidence.frameDigest);
      console.log(JSON.stringify({ engineVersion: payload.input.engineVersion, events: payload.runEvents.length,
        frames: original.evidence.frames, ending: { outcome: original.evidence.ending.outcome,
          atSec: original.evidence.ending.atSec, winnerTeamId: original.evidence.ending.winnerTeamId },
        jsonBytes: Buffer.byteLength(text), sameFrameDigest: true, evaluationArchiveMatched: true }));
    });
  }
} finally {
  globalThis.window = oldWindow; globalThis.document = oldDocument;
  URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
}
console.log(`Simulation log export checks: ${passed}`);
