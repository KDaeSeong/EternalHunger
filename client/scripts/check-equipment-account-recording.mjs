import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import axios from 'axios';
const require = createRequire(import.meta.url);
const { actor, skill, runCombatScenario } = await import('./lib/run-combat-scenario.mjs');
const { finishSimulationGame } = await import('../src/app/simulation/_lib/finishGameRuntime.js');
const router = require('../../server/routes/game.js');
const Character = require('../../server/models/Characters.js');
const GameLog = require('../../server/models/GameLog.js');
const handler = router.stack.find(row => row.route?.path === '/end').route.stack.at(-1).handle;

const item = { itemId: 'authored-rupture', name: '기록 검증 파열', type: '방어구', equipSlot: 'head', qty: 1, tier: 4,
  equipmentEffects: [{ version: 1, kind: 'rupture', delaySec: 0.8, cooldownSec: 8, radius: 2,
    damage: { base: 100, perLevel: 0, attackPowerRatio: 0, skillAmpRatio: 0 } }] };
const combat = await runCombatScenario([
  actor('a', { inventory: [item], equipped: { head: item.itemId }, characterSkills: { q: skill({ castDelaySec: 0.25, recoveryDelaySec: 0.25 }) } }),
  actor('b', { hp: 62, maxHp: 62, stats: { defense: 100, attackPower: 1, attackSpeed: 1 }, _basicAttackReadyAtSec: 200 }),
]);
const receipts = combat.events.filter(row => row.kind === 'equipment_effect');
assert.deepEqual(receipts.map(row => row.stage), ['scheduled', 'triggered']);
const events = [...Array.from({ length: 1600 }, (_, i) => ({ kind: 'move', who: 'a', at: { sec: i / 100 } })), ...combat.events];
const eventsBefore = JSON.stringify(events), values = new Map([['user', JSON.stringify({ id: '222222222222222222222222', username: 'recording-fixture' })]]);
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
const before = { window: globalThis.window, localStorage: globalThis.localStorage, fetch: globalThis.fetch,
  adapter: axios.defaults.adapter, findOne: Character.findOne, find: Character.find,
  count: GameLog.countDocuments, save: GameLog.prototype.save };
let requests = 0, saved, summary, capturedCount = 0;
try {
  globalThis.window = { localStorage: storage, location: { hostname: 'localhost', origin: 'http://localhost:3107' }, dispatchEvent: () => {} };
  globalThis.localStorage = storage;
  globalThis.fetch = () => { throw new Error('This contract check must never contact a network.'); };
  Character.findOne = async () => ({ name: 'a' });
  Character.find = async () => [];
  GameLog.countDocuments = async () => 0;
  GameLog.prototype.save = async function () { saved = this.toObject(); return this; };
  axios.defaults.adapter = async config => {
    assert.equal(config.method, 'post'); assert.match(config.url, /\/api\/game\/end$/);
    requests++;
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ user: { id: '222222222222222222222222' }, body: JSON.parse(config.data) }, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    return { data: res.body, status: res.statusCode, statusText: 'OK', headers: {}, config };
  };
  await finishSimulationGame({ finalSurvivors: [combat.survivorMap.get('a')],
    latestKillCounts: combat.roundKills, latestAssistCounts: combat.roundAssists,
    options: { finalDead: [combat.survivorMap.get('b')], ending: { day: 1, atSec: 104, cause: 'combat', outcome: 'last_team' } },
    refs: { fullLogsRef: { current: [] }, isFinishingRef: { current: false } },
    state: { runEvents: events, runSeed: 'equipment-account-contract', settings: { matchMode: 'solo' } },
    actions: { completeReplay: () => { capturedCount = events.length; },
      setResultSummary: value => { summary = typeof value === 'function' ? value(summary) : value; } },
  });
  assert.equal(requests, 1); assert.equal(summary.saveStatus.hallOfFame, 'success');
  assert.equal(summary.saveStatus.localRun, 'success'); assert.equal(summary.rewardLP, 0);
  assert.equal(saved.runEvents.length, 1500); assert.equal(capturedCount, events.length);
  assert.equal(JSON.stringify(events), eventsBefore);
  for (const expected of receipts) {
    const actual = saved.runEvents.find(row => row.effectId === expected.effectId && row.stage === expected.stage);
    for (const key of ['effectId', 'effectKind', 'who', 'targetId', 'stage', 'itemId', 'itemName', 'dueAtSec',
      'delaySec', 'cooldownUntil', 'radius', 'baseDamage', 'centerPosition', 'at']) assert.deepEqual(actual[key], expected[key], key);
  }
  const hit = combat.events.find(row => row.kind === 'damage' && row.equipmentEffectId);
  const storedHit = saved.runEvents.find(row => row.kind === 'damage' && row.equipmentEffectId === hit.equipmentEffectId);
  for (const key of ['equipmentEffectId', 'itemId', 'targetId', 'hpDamage', 'hpBefore', 'hpAfter', 'absorbed',
    'centerPosition', 'targetPosition', 'radius', 'at']) assert.deepEqual(storedHit[key], hit[key], key);
  const battle = combat.events.find(row => row.kind === 'battle' && row.equipmentEffectId);
  const storedBattle = saved.runEvents.find(row => row.kind === 'battle' && row.equipmentEffectId === battle.equipmentEffectId);
  for (const key of ['health', 'damage', 'lethal', 'itemName', 'equipmentEffectId']) assert.deepEqual(storedBattle[key], battle[key], key);
  console.log(`EQUIPMENT_ACCOUNT_RECORDING_CONTRACT ${JSON.stringify({ pass: true, requests, receipts: receipts.length,
    capturedCount, accountEventCount: saved.runEvents.length, scope: 'Real combat + client finish/API serialization + server handler/schema. Memory storage, HTTP adapter and DB doubles; not real authentication, HTTP or Mongo persistence.' })}`);
} finally {
  globalThis.window = before.window; globalThis.localStorage = before.localStorage; globalThis.fetch = before.fetch;
  axios.defaults.adapter = before.adapter; Character.findOne = before.findOne; Character.find = before.find;
  GameLog.countDocuments = before.count; GameLog.prototype.save = before.save;
}
