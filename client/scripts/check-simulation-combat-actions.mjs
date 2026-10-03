import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createHandlerHarness } from './lib/hook-handler-harness.mjs';

const hookUrl = new URL('../src/app/simulation/_lib/useSimulationEventActions.js', import.meta.url).href;
const harnessUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
registerHooks({ load(url, context, nextLoad) {
  if (url !== hookUrl) return nextLoad(url, context);
  return { format: 'module', shortCircuit: true,
    source: readFileSync(new URL(url), 'utf8').replaceAll("from 'react'", `from '${harnessUrl}'`) };
} });
const { useSimulationEventActions } = await import(hookUrl);
const { createIsolationCombatActions } = await import('./lib/run-random-isolation-match.mjs');
const { emitEffectRunEvents } = await import('../src/app/simulation/_lib/runEventRuntime.js');
const combat = await import('../src/app/simulation/_lib/combatRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const actor = (id, extra = {}) => ({ _id: id, name: id, teamId: id, zoneId: 'zone', hp: 1000, maxHp: 1000,
  _spatial: { zoneId: 'zone', x: 4, y: 4 }, inventory: [], tacticalSkill: 'none',
  stats: { maxHp: 1000, attackPower: 100, defense: 0, skillAmp: 0, attackSpeed: 0.72 }, ...extra });

function exercise(factory, weaponType, extra = {}) {
  const events = [], logs = [];
  const addLog = (...entry) => logs.push(entry);
  const emitRunEvent = (kind, payload, at) => events.push({ kind, ...payload, at });
  const actions = factory({ addLog, emitRunEvent,
    emitEffectRunEvents: (...args) => emitEffectRunEvents(emitRunEvent, ...args) });
  const attacker = actor('attacker', { weaponType, weaponMasteryLevel: 10, ...extra });
  const target = actor('target');
  const result = withSimulationRandom(() => 0, () => actions.applyErWeaponSkillAfterCombat(attacker, target,
    { damageDealt: 100, nowSec: 100, at: { day: 1, phase: 'night', sec: 100 } }));
  return JSON.parse(JSON.stringify({ events, logs, attacker, target, result }));
}
function productFactory(props) {
  const harness = createHandlerHarness(useSimulationEventActions, props);
  const actions = harness.flush(); harness.unmount(); return actions;
}
// Frozen old bare-runtime wiring: the negative control uses no past result file.
const modelFactory = process.argv.includes('--baseline') ? ({ addLog, emitRunEvent }) => ({
  // The phase supplied these two options; only the product hook supplied effects.
  applyErWeaponSkillAfterCombat: (attacker, target, opts) => combat.applyErWeaponSkillAfterCombat(
    attacker, target, { ...opts, addLog, emitRunEvent }),
}) : createIsolationCombatActions;
let passed = 0;
for (const [name, weapon, extra, expectedReason] of [
  ['attacker weapon buffs', '돌격소총', {}, 'combat_after'],
  ['target weapon crowd control', '글러브', {}, 'combat_after_target'],
  ['blocked skill emits no notifications', '돌격소총', { weaponMasteryLevel: 1 }, null],
]) {
  const expected = exercise(productFactory, weapon, extra);
  if (expectedReason) assert.ok(expected.events.some(event => event.kind === 'effect'
    && event.source === 'weapon_skill' && event.reason === expectedReason), 'the real product hook must emit the fixture effect');
  else assert.equal(expected.events.length, 0);
  assert.deepEqual(exercise(modelFactory, weapon, extra), expected, name);
  passed++; console.log(`PASS ${name}`);
}
console.log(`Simulation combat action parity checks: ${passed}`);
