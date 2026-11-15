import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import ts from 'typescript';
import './lib/register-simulation-modules.mjs';

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const life = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveLineage.js');
const calendar = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCalendar.js');
const { primitiveArchiveSuccessionGuidance } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveSuccessionGuidance.js');
const clone = value => structuredClone(value);
let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
function fresh(id, lineageMode = 'hybrid') {
  const state = engine.createNewState({ runId: `succession-guidance-${id}`, lineageMode,
    now: '2026-11-15T00:00:00.000Z', rng: () => 0.5 });
  state.day = 40;
  Object.assign(state.research.completed, { SETTLEMENT: true, FOOD_STORAGE: true });
  state.camp.shelterLevel = 1;
  state.inventory.berry = 20;
  return state;
}
// Calendar/receipt fixtures isolate the existing lineage guidance contract.
// They are not production runs or evidence of earning these years/resources.
function years(state, count, tick = false) {
  for (let index = 0; index < count; index++) {
    const next = { ...state, day: state.day + 1, calendar: calendar.advanceAnnualCalendar(state) };
    const need = next.calendar.lastCensus.foodNeed;
    next.tribe = { ...next.tribe, lastProduction: { ...next.tribe.lastProduction,
      day: next.day, foodNeed: need, foodProvided: need, shortage: 0, foodSpent: { berry: need } } };
    state = tick ? life.tickLineageYear(next) : next;
  }
  return state;
}
function annual(id, count = 20, lineageMode = 'hybrid') {
  const state = fresh(id, lineageMode);
  state.calendar = calendar.createAnnualCalendar(state);
  return years(state, count);
}
function projection(state) {
  const before = clone(state);
  assert.equal(life.isValidLineage(state.lineage, state), true);
  if (state.calendar) assert.equal(calendar.isValidAnnualCalendar(state.calendar, state), true);
  const lineage = life.lineageSummary(state);
  const guidance = primitiveArchiveSuccessionGuidance({ state, lineage });
  assert.deepEqual(state, before, 'Summary and guidance leave the complete input unchanged');
  return { lineage, guidance };
}
const ids = rows => rows.map(row => row.actorId);
const prepare = (state, actorId = state.party[0].id) => {
  const next = engine.prepareSuccessorAction(state, actorId, { rng: () => 0.5 });
  assert.equal(next.lineage.prepared.length, state.lineage.prepared.length + 1);
  return next;
};
function shortage(state) {
  const next = clone(state);
  next.tribe.lastProduction.foodProvided = 0;
  next.tribe.lastProduction.shortage = next.tribe.lastProduction.foodNeed;
  return next;
}

check('real annual calendar starts warnings at service20 and retains unprepared actor identities', () => {
  const young = annual('warning-boundary', 19);
  assert.equal(calendar.annualPersonSummary(young, young.party[0].id).serviceYears, 19);
  assert.deepEqual(projection(young).guidance, { needsPreparation: [], blockedHandover: [] });
  const state = years(young, 1), { lineage, guidance } = projection(state);
  assert.equal(lineage.communityReady, true);
  assert.equal(lineage.rows[0].annual.serviceYears, 20);
  assert.deepEqual(ids(guidance.needsPreparation), state.party.map(actor => actor.id));
  assert.deepEqual(guidance.blockedHandover, []);
});

check('actual paid preparation converts a worker and suppresses only that ready mentor warning', () => {
  const input = annual('prepare'), before = clone(input), state = prepare(input);
  assert.deepEqual(input, before);
  assert.equal(state.ap, input.ap - 1);
  assert.equal(state.tribe.population, input.tribe.population - 1);
  assert.equal(calendar.annualCensus(state).total, calendar.annualCensus(input).total);
  const { lineage, guidance } = projection(state);
  assert.equal(lineage.communityReady, true);
  assert.equal(lineage.rows[0].successorId, state.lineage.prepared[0].actor.id);
  assert.deepEqual(ids(guidance.needsPreparation), state.party.slice(1).map(actor => actor.id));
  assert.deepEqual(guidance.blockedHandover, []);
});

check('prepared successor and unpaid annual rations produce a separate blocked-handover warning', () => {
  const state = shortage(prepare(annual('ration')));
  state.inventory.berry = 1000;
  const { lineage, guidance } = projection(state);
  assert.equal(lineage.communityReady, false, 'Stock cannot replace a paid annual receipt');
  assert.equal(lineage.rows[0].canRetire, false);
  assert.deepEqual(ids(guidance.blockedHandover), [state.party[0].id]);
  assert.deepEqual(ids(guidance.needsPreparation), state.party.slice(1).map(actor => actor.id));
});

check('zero morale blocks a prepared handover even with a fully paid current receipt', () => {
  const state = prepare(annual('morale')); state.tribe.morale = 0;
  const { lineage, guidance } = projection(state);
  assert.equal(state.tribe.lastProduction.shortage, 0);
  assert.equal(lineage.communityReady, false);
  assert.deepEqual(ids(guidance.blockedHandover), [state.party[0].id]);
});

check('AP0 alone does not report a prepared handover as community-blocked', () => {
  const state = prepare(annual('ap-zero')); state.ap = 0;
  const { lineage, guidance } = projection(state);
  assert.equal(lineage.communityReady, true);
  assert.equal(lineage.rows[0].canRetire, false);
  assert.match(lineage.rows[0].retireReason, /차례/);
  assert.deepEqual(guidance.blockedHandover, []);
  assert.deepEqual(ids(guidance.needsPreparation), state.party.slice(1).map(actor => actor.id));
});

check('missing readiness information is not inferred from disabled controls or reason text', () => {
  const state = shortage(prepare(annual('unknown-readiness'))), lineage = life.lineageSummary(state);
  delete lineage.communityReady;
  assert.deepEqual(primitiveArchiveSuccessionGuidance({ state, lineage }).blockedHandover, []);
});

check('a prepared person before service20 does not create an early warning', () => {
  const state = shortage(prepare(annual('early', 19)));
  assert.deepEqual(projection(state).guidance, { needsPreparation: [], blockedHandover: [] });
});

check('ended and legacy runs suppress both action warnings without changing their records', () => {
  const ended = shortage(prepare(annual('ended'))); ended.ended = true;
  assert.deepEqual(projection(ended).guidance, { needsPreparation: [], blockedHandover: [] });
  const legacy = annual('legacy', 20, 'legacy');
  assert.equal(projection(legacy).lineage.enabled, false);
  assert.deepEqual(projection(legacy).guidance, { needsPreparation: [], blockedHandover: [] });
});

check('actual year25 handover excludes the retired mentor and the newly active successor', () => {
  const input = prepare(annual('handover')), actorId = input.party[0].id;
  const state = years(input, 5, true), heirId = input.lineage.prepared[0].actor.id;
  assert.equal(state.lineage.members.find(row => row.actorId === actorId).stage, 'retired');
  assert.equal(state.party[0].id, heirId);
  assert.equal(calendar.annualPersonSummary(state, actorId).serviceYears, 25);
  assert.equal(calendar.annualPersonSummary(state, heirId).serviceYears, 0);
  const { guidance } = projection(shortage(state));
  assert.deepEqual(ids(guidance.needsPreparation), state.party.slice(1).map(actor => actor.id));
  assert.deepEqual(guidance.blockedHandover, []);
});

check('real observed60 deaths stay out of guidance while a living later generation remains visible', () => {
  const input = prepare(annual('deaths')), retiredId = input.party[0].id;
  const state = years(input, 40, true);
  assert.equal(state.ended, false);
  assert.equal(state.lineage.members.find(row => row.actorId === retiredId).deathRecord.source, 'natural');
  assert.ok(state.party.slice(1).every(actor => actor.hp === 0 && actor.deathRecord.source === 'natural'));
  assert.deepEqual(ids(projection(state).guidance.needsPreparation), [state.party[0].id]);
  assert.deepEqual(projection(state).guidance.blockedHandover, []);
});

check('daily cycle warnings keep the existing preparation path and distinguish blocked prepared heirs', () => {
  const state = fresh('daily'); state.lineage.communityStartedDay = 1;
  state.lineage.members[0].cycle = life.LINEAGE_RULES.warningCycle;
  state.lineage.members[0].stage = 'elder';
  assert.deepEqual(ids(projection(state).guidance.needsPreparation), [state.party[0].id]);
  const prepared = prepare(state); prepared.inventory = {};
  assert.deepEqual(ids(projection(prepared).guidance.blockedHandover), [state.party[0].id]);
  assert.deepEqual(projection(prepared).guidance.needsPreparation, []);
});

check('JSON readback and repeated queries preserve clocks, AP, stock and lineage without caching', () => {
  const state = shortage(prepare(annual('readback'))), before = clone(state);
  const first = projection(state), second = projection(state), restored = projection(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(second, first); assert.deepEqual(restored, first); assert.deepEqual(state, before);
  assert.equal(Object.hasOwn(state.lineage, 'communityReady'), false, 'Readiness is a query field, not saved lineage data');
  const ready = clone(state); ready.tribe.lastProduction.foodProvided = ready.tribe.lastProduction.foodNeed;
  ready.tribe.lastProduction.shortage = 0;
  assert.deepEqual(projection(ready).guidance.blockedHandover, []);
});

// Evaluate the actual screen declarations, including its actual JSX handlers,
// without mounting the application or substituting product source modules.
const playSource = readFileSync(new URL('../src/app/games/primitive-archive/_components/PrimitiveArchivePlayContent.js', import.meta.url), 'utf8');
function declaration(name) {
  const ast = ts.createSourceFile('play.js', playSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX), matches = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) matches.push(`const ${node.getText(ast)};`);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.equal(matches.length, 1, `Actual screen declaration: ${name}`); return matches[0];
}
function screenMessages(state) {
  const { lineage } = projection(state), navigation = [];
  const source = `const { state, lineage, primitiveArchiveSuccessionGuidance, selectArchiveTab, LINEAGE_RULES } = scope;
    const initialShopPending = false, checkpointProblem = false, checkpoint = {}, shopPerks = {}, busy = false;
    const message = '', archiveVictory = {}, dead = state.ended, annualMode = state.calendar?.mode === 'annual';
    const annual = { observedLifetimeYears: state.calendar?.observedLifetimeYears };
    ${declaration('successionGuidance')}
    ${declaration('playMessages')}
    return playMessages.filter(Boolean);`;
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.None } }).outputText;
  const before = clone(state);
  const messages = new Function('React', 'scope', compiled)(React, { state, lineage, primitiveArchiveSuccessionGuidance,
    selectArchiveTab: tab => navigation.push(tab), LINEAGE_RULES: life.LINEAGE_RULES });
  assert.deepEqual(state, before);
  return { messages, navigation };
}
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(text).join('');
const buttons = node => !node || typeof node !== 'object' ? [] : [
  ...(node.type === 'button' ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(buttons)];

check('actual mixed UI warnings keep each name, correct instructions and distinct button destinations', () => {
  const state = shortage(prepare(annual('screen'))), { messages, navigation } = screenMessages(state);
  const preparation = messages.find(row => row.key === 'succession-warning');
  const blocked = messages.find(row => row.key === 'succession-blocked');
  assert.ok(preparation); assert.ok(blocked);
  const prepText = text(preparation.text), blockedText = text(blocked.text);
  assert.ok(!prepText.includes(state.party[0].name)); assert.ok(blockedText.includes(state.party[0].name));
  for (const actor of state.party.slice(1)) { assert.ok(prepText.includes(actor.name)); assert.ok(!blockedText.includes(actor.name)); }
  assert.match(prepText, /후계를 준비/); assert.match(blockedText, /후계는 준비되었지만/);
  assert.match(blockedText, /정착 기반·공동 배식·사기/); assert.doesNotMatch(blockedText, /후계를 준비|후계 준비 열기/);
  const prepButton = buttons(preparation.text), blockedButton = buttons(blocked.text);
  assert.equal(prepButton.length, 1); assert.equal(blockedButton.length, 1);
  assert.equal(text(prepButton[0]), '후계 준비 열기'); assert.equal(text(blockedButton[0]), '공동체 일손 보기');
  prepButton[0].props.onClick(); blockedButton[0].props.onClick();
  assert.deepEqual(navigation, ['founders', 'tribe']);
});

check('actual screen suppresses the blocked banner for ready AP0, ended and legacy states', () => {
  const ready = prepare(annual('screen-ready')); ready.ap = 0;
  assert.ok(!screenMessages(ready).messages.some(row => row.key === 'succession-blocked'));
  const ended = shortage(ready); ended.ended = true;
  assert.ok(!screenMessages(ended).messages.some(row => row.key.startsWith('succession-')));
  assert.ok(!screenMessages(annual('screen-legacy', 20, 'legacy')).messages.some(row => row.key.startsWith('succession-')));
});

console.log(JSON.stringify({ pass: true, checks,
  scope: 'Current lineage/calendar capability fixtures, actual paid preparation and focused lineage ticks; actual UI declaration text/navigation. Not a natural campaign, browser layout or persistence acceptance.' }));
