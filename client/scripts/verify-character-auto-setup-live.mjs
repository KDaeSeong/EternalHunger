// Opt-in, paid provider verification. Never part of the standard/offline check chain.
// Each sample has ONE SDK/HTTP attempt; an invalid response is never regenerated.
import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

if (process.argv[2] !== '--authorize-two-model-requests') {
  console.error('Explicit authorization for two model requests is required. No requests were made.');
  process.exit(2);
}

const serverRequire = createRequire(new URL('../../server/package.json', import.meta.url));
serverRequire('dotenv').config({ path: fileURLToPath(new URL('../../server/.env', import.meta.url)), quiet: true });
const { GoogleGenAI } = serverRequire('@google/genai');
const { createCharacterSetupHandler } = serverRequire('./utils/characterSetupService');
const { createErCharacterSourceReader } = serverRequire('./utils/erCharacterSource');
const { sanitizeCharacterSetup } = serverRequire('./utils/characterSetupContract');
const { createBlankCharacter, normalizeCharacterEditorList } = await import('../src/app/characters/_lib/characterEditorRuntime.js');
const { createCharacterSetupPatch } = await import('../src/utils/characterSetupDraft.js');
const { compactCharactersForSave } = await import('../src/utils/characterPayload.js');
const { getCharacterSkillDef } = await import('../src/app/simulation/_lib/characterSkillDefinitionRuntime.js');
const { previewCharacterSkill } = await import('../src/app/simulation/_lib/characterSkillRuntime.js');
const { resolveCombatWinnerOutcome } = await import('../src/app/simulation/_lib/phaseCombatDamageRuntime.js');

const apiKey = String(process.env.GOOGLE_API_KEY || '').trim();
if (!apiKey) throw new Error('AI_NOT_CONFIGURED: no requests made');
const provider = new GoogleGenAI({ apiKey });
const sources = new Map();
const readSource = createErCharacterSourceReader();
let requests = 0;
let current = null;
const handler = createCharacterSetupHandler({
  rateLimit: async () => ({ allowed: true }), // RAM-only probe, never an operating-account counter.
  loadErSource: async name => {
    const source = await readSource(name);
    sources.set(name, source);
    return source;
  },
  generate: async request => {
    assert.ok(requests < 2, 'MODEL_REQUEST_BUDGET_EXHAUSTED');
    requests += 1;
    current.provider = { requestNumber: requests, model: request.model, sdkAttempts: 1 };
    console.log(`LIVE_SETUP_REQUEST ${JSON.stringify({ mode: current.mode, ...current.provider })}`);
    const startedAt = performance.now();
    try {
      const response = await provider.models.generateContent({ ...request, config: {
        ...request.config,
        httpOptions: { ...request.config.httpOptions, retryOptions: { attempts: 1 } },
      } });
      current.provider.elapsedMs = Number((performance.now() - startedAt).toFixed(3));
      current.provider.usage = response.usageMetadata || null;
      try { current.raw = JSON.parse(String(response.text || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '')); }
      catch { current.parseFailure = true; }
      return response;
    } catch (error) {
      // Do not log credentials, request headers, stack traces, or the provider's raw error body.
      current.provider.elapsedMs = Number((performance.now() - startedAt).toFixed(3));
      current.provider.failure = { name: error.name, status: error.status ?? null };
      throw error;
    }
  },
});

function check(result, name, action) {
  try { action(); result.checks.push({ name, passed: true }); }
  catch (error) { result.checks.push({ name, passed: false, error: error.message }); }
}

function checkAppliedDraft(result) {
  const blank = createBlankCharacter(`live-${result.mode}`);
  const original = structuredClone(blank);
  const { patch } = createCharacterSetupPatch(blank, result.response);
  assert.deepEqual(blank, original);
  const character = { ...blank, ...patch };
  const payload = compactCharactersForSave([character]);
  const reopened = normalizeCharacterEditorList(payload)[0];
  assert.equal(Object.hasOwn(payload[0], 'records'), false);
  for (const slot of ['q', 'w', 'e', 'r', 'passive']) {
    assert.equal(reopened.characterSkills[slot].enabled, character.characterSkills[slot].enabled);
    if (slot !== 'passive') {
      assert.equal(reopened.characterSkills[slot].hpDamagePercentUnit, 'percent');
      assert.deepEqual(reopened.characterSkills[slot].firstFlat, character.characterSkills[slot].firstFlat);
      assert.deepEqual(reopened.characterSkills[slot].maxHpPct, character.characterSkills[slot].maxHpPct);
    }
  }
  result.localPayload = { applied: true, reopenedInMemory: true, accountWrites: 0 };

  const caster = { ...character, _id: 'caster', teamId: 'one', hp: character.stats.maxHp,
    maxHp: character.stats.maxHp, zoneId: 'school', _spatial: { zoneId: 'school', x: 4, y: 4 },
    characterSkillLevels: { q: 1 } };
  const target = { _id: 'target', name: '검증 대상', teamId: 'two', hp: 1000, maxHp: 1000,
    zoneId: 'school', _spatial: { zoneId: 'school', x: 4, y: 4 },
    stats: { maxHp: 1000, defense: 0, attackPower: 0, skillAmp: 0, attackSpeed: 1, attackRange: 2, sightRange: 10 } };
  const def = getCharacterSkillDef(caster, 'q');
  const preparedSkill = previewCharacterSkill(caster, target, def, 1, { nowSec: 100 });
  assert.ok(preparedSkill, 'generated Q cannot be prepared for actual combat');
  const events = [];
  const outcome = resolveCombatWinnerOutcome({
    state: { actor: caster, target, preparedSkill, currentActionSec: () => 100, pvpCfg: { criticalFleeHpBelow: 0 } },
    actions: { emitRunEvent: (kind, data) => events.push({ kind, ...data }) },
  });
  assert.equal(outcome.performed, true);
  assert.ok(events.some(event => event.kind === 'skill'));
  result.controlledCombat = { performed: true, targetHpBefore: 1000, targetHpAfter: target.hp,
    damage: 1000 - target.hp, scope: 'generated level-1 Q in controlled combat, not full-match balance' };
}

const samples = [
  { mode: 'er', name: '헤이즈', text: '' },
  { mode: 'custom', name: '라크리모사', text:
    '라크리모사. 제공된 스킬 설명은 Q뿐이며 다른 스킬과 능력치는 미제공. ' +
    'Q: 적 1인에게 10/20/30/40/50 피해, 쿨타임 7초, 5초 안에 다시 발동하면 ' +
    '20/30/40/50/60 피해. 범위 1. 대상 최대 체력의 1/1/2/2/3% 추가 피해.' },
];
const results = [];
for (const sample of samples) {
  current = { ...sample, checks: [] };
  let status = 200;
  const res = {
    status(value) { status = value; return this; },
    set() { return this; },
    json(value) { current.status = status; current.response = value; return this; },
  };
  await handler({ body: sample, user: { id: 'isolated-live-verification' }, ip: '127.0.0.1' }, res);
  if (status === 200) {
    check(current, 'accepted service contract', () => sanitizeCharacterSetup(current.response));
    if (sample.mode === 'er') {
      const source = sources.get(sample.name);
      current.source = { name: source.material.name, weapons: source.material.weapons,
        skillNames: Object.fromEntries(Object.entries(source.material.skills).map(([slot, skill]) => [slot, skill.name])),
        urls: source.sources.map(value => value.url) };
      check(current, 'ER exact source names', () => {
        assert.equal(current.response.name, source.material.name);
        for (const [slot, skill] of Object.entries(source.material.skills)) assert.equal(current.response.characterSkills[slot].name, skill.name);
      });
    } else {
      check(current, 'custom supplied Q values', () => {
        const q = current.response.characterSkills.q;
        assert.deepEqual(q.firstFlat, [10, 20, 30, 40, 50]);
        assert.deepEqual(q.secondFlat, [20, 30, 40, 50, 60]);
        assert.deepEqual(q.maxHpPct, [1, 1, 2, 2, 3]);
        assert.equal(q.hpDamagePercentUnit, 'percent');
        assert.equal(q.cooldownSec, 7);
        assert.equal(q.recastWindowSec, 5);
      });
    }
    check(current, 'local patch, save-payload round trip, and controlled Q execution', () => checkAppliedDraft(current));
  }
  if (current.raw && status !== 200) {
    check(current, 'raw response contract diagnosis (no repair or paid retry)', () => sanitizeCharacterSetup(current.raw));
  }
  console.log(`LIVE_SETUP_SAMPLE ${JSON.stringify(current)}`);
  results.push(current);
}
assert.ok(requests <= 2);
const passed = results.every(value => value.status === 200 && value.checks.every(check => check.passed));
console.log(`LIVE_SETUP_COMPLETE ${JSON.stringify({ schema: 'eh-character-setup-live.v1',
  requests, sdkAttemptsPerRequest: 1, automaticRetries: 0, operatingAccountWrites: 0,
  mountedAuthVerified: false, fullMatchBalanceVerified: false, passed, results })}`);
if (!passed) process.exitCode = 1;
