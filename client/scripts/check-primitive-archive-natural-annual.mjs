// Controlled engine natural-path check only. This does not mount a UI or
// establish browser, human, or manual-play acceptance. Never inject fixtures.
import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const calendar = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCalendar.js');
const lineage = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveLineage.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');

const reportArguments = process.argv.slice(2);
if (reportArguments.some(argument => !argument.startsWith('--report=') || argument.length === 9) || reportArguments.length > 1) {
  throw new Error('Usage: node check-primitive-archive-natural-annual.mjs [--report=path]');
}
const reportPath = reportArguments[0]?.slice(9);
const clone = value => structuredClone(value);
// Current engine's published ration denominations; quantities are physical
// items, whereas foodProvided is ration units and can exceed foodNeed.
const foodValues = { berry: 1, meat: 1, grain: 1, milled_grain: 2, fish: 1,
  milk: 1, jerky: 2, cooked_meat: 2, packed_ration: 3 };
let seed = 7;
let rngDraws = 0;
const rng = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  rngDraws++;
  return seed / 0x100000000;
};
const stamp = state => ({ runId: state.runId, day: state.day, ap: state.ap,
  updatedAt: state.updatedAt, completedYears: state.calendar?.completedYears ?? null });
const report = { name: 'controlled-engine-natural-seed7-to-annual-succession',
  scope: 'Engine actions only; no UI/browser/human/manual-play acceptance',
  seed: 7, maximumDailyActions: 120, injections: [], daily: [], annual: [], preparation: [],
  status: 'running' };
// Pre-execution contract correction: year25 handover is conditional on a
// prepared successor. Require at least one natural preparation and handover
// of every prepared original founder, not retirement of unprepared founders.
// This contract was corrected before the initial campaign execution.
const preparedOriginals = new Set();
const originalRandom = Math.random;
let ambientDraws = 0;
// Daily and annual actions must use only explicitly injected randomness.
let annualPhase = false;
Math.random = () => {
  ambientDraws++;
  throw Error('Campaign requested ambient randomness in ' + (annualPhase ? 'annual' : 'daily') + ' phase');
};
function action(state, name, perform) {
  const before = clone(state);
  const next = perform();
  assert.deepEqual(state, before, `${name}: source state must remain immutable`);
  assert.equal(checkpoint.isValidRunState(next), true, `${name}: checkpoint validity`);
  return next;
}
function restore(state) {
  const before = clone(state);
  const restored = engine.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(state, before, 'roundtrip must preserve source state');
  assert.equal(checkpoint.isValidRunState(restored), true);
  for (const key of ['inventory', 'research', 'party', 'tribe', 'camp', 'equipment', 'lineage', 'calendar']) {
    assert.deepEqual(restored[key], state[key], `roundtrip preserves ${key}`);
  }
  assert.deepEqual(restored, state, 'whole normalized JSON state is preserved');
  return restored;
}
function economics(state) {
  return Object.fromEntries(['day', 'ap', 'inventory', 'research', 'party', 'tribe', 'camp',
    'equipment', 'lineage', 'founderHistory', 'counters'].map(key => [key, clone(state[key])]));
}
function prepareEligible(state, originals) {
  for (const id of originals) {
    const row = lineage.lineageSummary(state).rows.find(row => row.actorId === id);
    if (!row || row.successorId || state.lineage.prepared.some(row => row.mentorId === id)) continue;
    report.preparation.push({ year: state.calendar.completedYears, actorId: id,
      canPrepare: row.canPrepare, reason: row.prepareReason, population: state.tribe.population,
      ap: state.ap, morale: state.tribe.morale });
    if (!row.canPrepare) continue;
    const before = clone(state), total = calendar.annualCensus(state).total;
    state = action(state, `prepare ${id}`, () => engine.prepareSuccessorAction(state, id, { rng }));
    assert.equal(state.tribe.population, before.tribe.population - 1);
    assert.equal(state.lineage.prepared.length, before.lineage.prepared.length + 1);
    preparedOriginals.add(id);
    assert.equal(state.ap, before.ap - 1);
    assert.equal(calendar.annualCensus(state).total, total);
    assert.deepEqual(state.inventory, before.inventory, 'annual preparation invents no stock');
  }
  return state;
}
try {
  let state = engine.createNewState({ difficulty: 'normal', rng,
    runId: 'controlled-natural-annual-seed7', now: '2026-11-13T00:00:00.000Z' });
  assert.equal(checkpoint.isValidRunState(state), true);
  for (let step = 0; step < 120 && !state.ended && !engine.annualSettlementSummary(state).canStart; step++) {
    state = action(state, 'natural daily action', () => engine.runAutoDayAction(state, { rng }));
    report.daily.push({ step: step + 1, day: state.day, ended: state.ended,
      population: state.tribe.population, canStart: engine.annualSettlementSummary(state).canStart });
  }
  const readiness = engine.annualSettlementSummary(state);
  report.reached = { day: state.day, reason: readiness.startReason, ended: state.ended,
    research: Object.keys(state.research.completed).filter(key => state.research.completed[key]),
    population: state.tribe.population, inventory: clone(state.inventory) };
  assert.equal(readiness.canStart, true, `natural seed7 failed annual readiness: ${readiness.startReason}`);
  const beforeTransition = economics(state);
  state = action(state, 'annual transition', () => engine.startAnnualSettlementAction(state, stamp(state), { observedLifetimeYears: 60 }));
  assert.equal(calendar.isAnnualMode(state), true);
  assert.equal(state.calendar.completedYears, 0);
  assert.deepEqual(economics(state), beforeTransition, 'transition preserves economy, bodies, equipment and history');
  state = restore(state);
  const originals = state.party.filter(person => person.hp > 0).map(person => person.id);
  const equipment = clone(state.equipment);
  annualPhase = true;
  for (let year = 1; year <= 25; year++) {
    state = prepareEligible(state, originals);
    const before = clone(state), census = calendar.annualCensus(state);
    const plan = engine.annualSettlementSummary(state).plan;
    const drawsBefore = rngDraws;
    state = action(state, `annual year ${year}`, () => engine.runSettlementYearAction(state, stamp(state), {
      rng: () => { throw Error('Annual operation requested injected randomness'); },
    }));
    assert.equal(rngDraws, drawsBefore, 'annual settlement uses no campaign randomness');
    assert.equal(state.calendar.completedYears, year);
    assert.equal(state.day, before.day + 1);
    assert.deepEqual(state.calendar.lastCensus, census, 'whole census recorded before growth or succession');
    const receipt = state.tribe.lastProduction;
    const ledger = { ...before.inventory };
    const apply = (entries, sign) => {
      for (const [id, qty] of Object.entries(entries || {})) ledger[id] = Number(ledger[id] || 0) + sign * qty;
    };
    apply(receipt.gains, 1);
    // Project cost is published by projectRows; commitment/completion changes
    // establish actual payment/reward, rather than inferring from net stock.
    const projectLedger = [];
    for (const project of engine.projectRows(before)) {
      const paid = !before.projects.resourceCommitted?.[project.id]
        && Boolean(state.projects.resourceCommitted?.[project.id]);
      const completed = !project.completed
        && engine.projectRows(state).find(row => row.id === project.id)?.completed;
      if (paid) apply(project.cost, -1);
      if (completed) apply(project.reward, 1);
      if (paid || completed) projectLedger.push({ id: project.id, paid, completed,
        cost: paid ? project.cost : {}, reward: completed ? project.reward : {} });
    }
    apply(receipt.education?.spent, -1);
    apply(receipt.foodSpent, -1);
    apply(receipt.processing?.spent, -1);
    apply(receipt.processing?.gains, 1);
    for (const id of new Set([...Object.keys(ledger), ...Object.keys(state.inventory)])) {
      assert.equal(Number(state.inventory[id] || 0), Number(ledger[id] || 0), `year${year} physical inventory ledger ${id}`);
    }
    assert.equal(receipt.day, state.calendar.lastSettledDay);
    assert.deepEqual(receipt.gains, plan.production, 'actual worker production matches current plan');
    assert.equal(receipt.foodNeed, census.foodNeed);
    assert.equal(receipt.shortage, Math.max(0, receipt.foodNeed - receipt.foodProvided));
    assert.equal(Object.entries(receipt.foodSpent).reduce((sum, [id, qty]) => {
      assert.ok(Object.hasOwn(foodValues, id), `unknown spent ration ${id}`);
      assert.ok(Number.isInteger(qty) && qty >= 0);
      return sum + qty * foodValues[id];
    }, 0), receipt.foodProvided,
      'actual food spending equals supplied whole-population rations');
    // Pre-execution plan: forecast excludes project costs/rewards and school.
    // Compare ration forecasts only when these do not alter food before ration.
    const foodAffected = projectLedger.some(row => Object.keys({ ...row.cost, ...row.reward })
      .some(id => Object.hasOwn(foodValues, id)))
      || Object.keys(receipt.education?.spent || {}).some(id => Object.hasOwn(foodValues, id));
    if (!foodAffected) {
      assert.equal(receipt.foodProvided, plan.provided);
      assert.equal(receipt.shortage, plan.shortage);
    }
    report.annual.push({ year, census, gains: receipt.gains, foodNeed: receipt.foodNeed,
      foodProvided: receipt.foodProvided, foodSpent: receipt.foodSpent, shortage: receipt.shortage,
      population: state.tribe.population, prepared: state.lineage.prepared.length,
      inventoryBefore: before.inventory, inventoryAfter: clone(state.inventory),
      forecastRationCompared: !foodAffected, projects: projectLedger,
      processing: receipt.processing || null, education: receipt.education || null });
    state = restore(state);
  }
  report.handover = originals.map(id => {
    const member = state.lineage.members.find(row => row.actorId === id);
    return { actorId: id, stage: member?.stage, successorId: member?.successorId,
      preparationReason: lineage.lineageSummary(state).rows.find(row => row.actorId === id)?.prepareReason };
  });
  report.preparedOriginals = [...preparedOriginals];
  assert.ok(preparedOriginals.size > 0, `no natural successor prepared: ${JSON.stringify(report.preparation)}`);
  for (const id of preparedOriginals) {
    const member = state.lineage.members.find(row => row.actorId === id);
    assert.equal(member.stage, 'retired', `natural founder ${id} must hand over by year25; ${JSON.stringify(report.handover)}`);
    assert.ok(member.successorId);
    assert.ok(member.retiredSnapshot.hp > 0);
    assert.equal(member.deathRecord, null);
    assert.deepEqual(state.equipment[member.successorId], equipment[id]);
    assert.equal(Object.hasOwn(state.equipment, id), false, 'equipment remains under one owner');
    assert.equal(state.party.some(row => row.id === id), false);
    assert.equal(state.party.filter(row => row.id === member.successorId).length, 1);
    assert.equal(state.calendar.people.find(row => row.actorId === id).serviceUntilYear, 25);
    assert.equal(state.calendar.people.find(row => row.actorId === member.successorId).serviceFromYear, 25);
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  Math.random = originalRandom;
  report.rngDraws = rngDraws;
  report.ambientDraws = ambientDraws;
  if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ name: report.name, status: report.status,
    dailyActions: report.daily.length, annualYears: report.annual.length,
    failure: report.failure?.message, scope: report.scope }));
}
