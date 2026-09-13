import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  LOCAL_SIMULATION_RUN_HISTORY_KEY,
  LOCAL_SIMULATION_RUN_HISTORY_LIMIT,
  normalizeLocalSimulationRun,
  readLocalSimulationRunHistory,
  saveLocalSimulationRunBackup,
} from '../src/app/simulation/_lib/localRunHistoryRuntime.js';

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

function sampleRun(id, overrides = {}) {
  return {
    clientRunId: id,
    finishedAt: 1700000000000,
    runSeed: `seed-${id}`,
    day: 4,
    matchSec: 721,
    matchMode: 'squad',
    teamSize: 3,
    winnerId: 'char-a',
    winnerName: '우승자',
    winnerTeamId: 'team:1',
    winnerTeamName: '1팀',
    participants: [
      { _id: 'char-a', name: '우승자', teamId: 'team:1', teamName: '1팀', matchTeamSlot: 1, previewImage: 'data:image/png;base64,too-large' },
      { _id: 'char-b', name: '동료', teamId: 'team:1', teamName: '1팀', matchTeamSlot: 2, inventory: [{ huge: true }] },
    ],
    killCounts: { 'char-a': 3, 'char-b': 1, stranger: 999 },
    assistCounts: { 'char-a': 2, 'char-b': -10 },
    settings: {
      rulesetId: 'ER_S11',
      matchMode: 'squad',
      skills: { characterSkills: true, secretRuntimeConfig: 'must-not-persist' },
      serverSecret: 'must-not-persist',
    },
    ...overrides,
  };
}

const normalized = normalizeLocalSimulationRun(sampleRun('run-normalize'));
assert.equal(normalized.schemaVersion, 1);
assert.equal(normalized.clientRunId, 'run-normalize');
assert.equal(normalized.participants.length, 2);
assert.deepEqual(Object.keys(normalized.participants[0]).sort(), ['id', 'name', 'teamId', 'teamName', 'teamSlot'].sort());
assert.deepEqual(normalized.killCounts, { 'char-a': 3, 'char-b': 1 });
assert.deepEqual(normalized.assistCounts, { 'char-a': 2 });
assert.deepEqual(normalized.settings, {
  rulesetId: 'ER_S11',
  matchMode: 'squad',
  characterSkillsEnabled: true,
});
assert.equal(normalized.trustedOutcome, false);
assert.equal(JSON.stringify(normalized).includes('must-not-persist'), false);
assert.equal(JSON.stringify(normalized).includes('data:image'), false);
assert.equal(JSON.stringify(normalized).includes('inventory'), false);

const storage = new MemoryStorage();
const firstSave = saveLocalSimulationRunBackup(sampleRun('same-run'), storage);
const secondSave = saveLocalSimulationRunBackup(sampleRun('same-run', { winnerName: '수정된 우승자' }), storage);
assert.equal(firstSave.ok, true);
assert.equal(secondSave.ok, true);
assert.equal(readLocalSimulationRunHistory(storage).length, 1, 'The same clientRunId must not be counted twice.');
assert.equal(readLocalSimulationRunHistory(storage)[0].winnerName, '수정된 우승자');

for (let index = 0; index < LOCAL_SIMULATION_RUN_HISTORY_LIMIT + 5; index += 1) {
  saveLocalSimulationRunBackup(sampleRun(`capped-${index}`, { finishedAt: 1700000000000 + index }), storage);
}
const capped = readLocalSimulationRunHistory(storage);
assert.equal(capped.length, LOCAL_SIMULATION_RUN_HISTORY_LIMIT);
assert.equal(capped[0].clientRunId, `capped-${LOCAL_SIMULATION_RUN_HISTORY_LIMIT + 4}`);

const corruptStorage = new MemoryStorage({ [LOCAL_SIMULATION_RUN_HISTORY_KEY]: '{broken json' });
assert.deepEqual(readLocalSimulationRunHistory(corruptStorage), []);
assert.equal(saveLocalSimulationRunBackup(sampleRun('after-corruption'), corruptStorage).ok, true);

class QuotaStorage extends MemoryStorage {
  setItem(key, value) {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed?.runs) && parsed.runs.length > 5) throw new Error('quota');
    super.setItem(key, value);
  }
}

const quotaSeedRuns = Array.from({ length: 6 }, (_, index) => normalizeLocalSimulationRun(sampleRun(`quota-${index}`)));
const quotaStorage = new QuotaStorage({
  [LOCAL_SIMULATION_RUN_HISTORY_KEY]: JSON.stringify({ schemaVersion: 1, runs: quotaSeedRuns }),
});
const quotaSave = saveLocalSimulationRunBackup(sampleRun('quota-new'), quotaStorage);
assert.equal(quotaSave.ok, true);
assert.equal(quotaSave.trimmed, true);
assert.equal(readLocalSimulationRunHistory(quotaStorage).length, 5);
assert.equal(readLocalSimulationRunHistory(quotaStorage)[0].clientRunId, 'quota-new');

const sources = Object.fromEntries(await Promise.all([
  ['finish', '../src/app/simulation/_lib/finishGameRuntime.js'],
  ['phaseController', '../src/app/simulation/_lib/useSimulationPhaseController.js'],
  ['presetRuntime', '../src/app/simulation/_lib/participantPresetRuntime.js'],
  ['settingsControls', '../src/app/simulation/_lib/useSimulationSettingsControls.js'],
  ['resultModal', '../src/app/simulation/_components/SimulationResultModal.js'],
].map(async ([key, relativePath]) => [key, await readFile(new URL(relativePath, import.meta.url), 'utf8')])));

assert.ok(
  sources.finish.indexOf('saveLocalSimulationRunBackup({') < sources.finish.indexOf('if (!hasAuthenticatedUser)'),
  'A guest run must be saved locally before the unauthenticated branch returns.',
);
assert.ok(
  sources.finish.indexOf('if (!hasAuthenticatedUser)') < sources.finish.indexOf("await apiPost('/game/end'"),
  'A guest completion must not call the authenticated game-end API.',
);
assert.match(sources.phaseController, /day,[\s\S]*matchSec,[\s\S]*runSeed,[\s\S]*settings,/, 'Finish state must include the run identity fields.');
assert.match(sources.presetRuntime, /writeLocalParticipantPresets[\s\S]*localStorage\.setItem/, 'Participant presets must remain locally persisted.');
assert.match(sources.settingsControls, /eh_sim_match_mode/);
assert.match(sources.settingsControls, /eh_sim_character_skills/);
assert.match(sources.resultModal, /로컬 완주 기록/);

console.log(JSON.stringify({
  guestRunSchema: normalized.schemaVersion,
  localHistoryLimit: LOCAL_SIMULATION_RUN_HISTORY_LIMIT,
  duplicateRunIdempotent: true,
  corruptedStorageRecovered: true,
  quotaFallbackCount: quotaSave.runs.length,
  rosterAndSettingsWhitelisted: true,
  guestServerPostSkipped: true,
}, null, 2));
