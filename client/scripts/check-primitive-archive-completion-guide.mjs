import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import './lib/register-simulation-modules.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));
const React = require('react');
const ts = require('typescript');
const nextImage = require('next/image');
const previousImage = globalThis.__completionGuideImage;
globalThis.__completionGuideImage = nextImage.default || nextImage;
const base = new URL('../src/app/games/primitive-archive/', import.meta.url);
const sourceRoot = process.env.PA_COMPLETION_SOURCE_ROOT;
const overrides = new Set(['primitiveArchiveFocus.js', 'PrimitiveArchiveFocusPanel.js', 'PrimitiveArchivePlayContent.js']);
function actualSource(url) {
  const name = path.basename(new URL(url).pathname);
  if (sourceRoot && overrides.has(name)) {
    const group = name === 'primitiveArchiveFocus.js' ? '_lib' : '_components';
    const candidates = [path.join(sourceRoot, name), path.join(sourceRoot, group, name),
      path.join(sourceRoot, 'client/src/app/games/primitive-archive', group, name)];
    const found = candidates.find(candidate => existsSync(candidate));
    assert.ok(found, `Source override must contain ${name}`);
    return readFileSync(found, 'utf8');
  }
  return readFileSync(new URL(url), 'utf8');
}
const loader = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'next/image') return { url: 'data:text/javascript,export default globalThis.__completionGuideImage;', shortCircuit: true };
    if (specifier.startsWith('next/')) return { url: pathToFileURL(require.resolve(specifier)).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    const overridden = sourceRoot && overrides.has(path.basename(new URL(url).pathname));
    if (!overridden && (!url.includes('/src/') || !url.includes('/_components/') || !url.endsWith('.js'))) return next(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(actualSource(url), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const engine = await import(new URL('_lib/primitiveArchiveEngine.js', base));
const data = await import(new URL('_lib/primitiveArchiveData.js', base));
const checkpoint = await import(new URL('_lib/primitiveArchiveCheckpoint.js', base));
const { primitiveArchiveCompletionGuide } = await import(new URL('_lib/primitiveArchiveCompletionGuide.js', base));
const { primitiveArchiveFocusPlan } = await import(new URL('_lib/primitiveArchiveFocus.js', base));
const { default: Focus } = await import(new URL('_components/PrimitiveArchiveFocusPanel.js', base));
const { GameControlButton } = await import('../src/app/games/_components/GamePlayPrimitives.js');
const clone = value => structuredClone(value);
const playSource = actualSource(new URL('_components/PrimitiveArchivePlayContent.js', base));

// Capability fixtures are freshly constructed from current catalogs, not past
// simulation outputs and not evidence of naturally earning this progression.
function fixture(id = 'completion-guide') {
  let state = engine.createNewState({ runId: id, now: '2026-11-13T00:00:00.000Z', rng: () => 0.5 });
  state.day = engine.ARCHIVE_VICTORY_DAY;
  state.research.completed = Object.fromEntries(data.TECH_TREE.map(row => [row.id, true]));
  state.civics.completed = Object.fromEntries(data.CIVIC_TREE.map(row => [row.id, true]));
  state.camp = { ...state.camp, fireLevel: 3, shelterLevel: 3, workbenchLevel: 3, fuel: 20,
    archiveRoomLevel: 0, scribeDeskLevel: 1, libraryShelfLevel: 1 };
  state.inventory = { ...state.inventory, berry: 100, wood: 20, stone: 2, fiber: 20, hide: 20,
    clay: 20, resin: 20, twine: 20, herb: 20, book_craft_guide: 1, book_camp_manual: 1 };
  state.tribe.population = 8;
  state.party = state.party.map(member => ({ ...member, hp: 100, hunger: 0, stamina: 100, bodyTemp: 37 }));
  state.exploration.revealed = Object.fromEntries(engine.WORLD_REGIONS.map(row => [row.id, true]));
  const selected = data.TECH_TREE.find(row => !row.archiveRequired && row.cost > 1 && !row.unlocks?.camp?.length);
  assert.ok(selected, 'A real non-facility research target exists.');
  state.research.completed[selected.id] = false;
  state.research.progress[selected.id] = 1;
  state.research.selectedTechId = selected.id;
  state = engine.normalizeState(state);
  assert.equal(checkpoint.isValidRunState(state), true);
  return state;
}
const inputs = state => ({ state, archiveVictory: engine.archiveVictorySummary(state),
  facilities: engine.campFacilityRows(state), recipes: engine.recipeRows(state),
  technologies: engine.techRows(state), civics: engine.civicRows(state), regions: engine.regionRows(state),
  processing: engine.tribeSummary(state).processing });
const guideFor = state => primitiveArchiveCompletionGuide(inputs(state));
function focusFor(state, extra = {}) {
  return primitiveArchiveFocusPlan({ state, archiveVictory: engine.archiveVictorySummary(state),
    research: engine.researchSummary(state), campActions: engine.campActionRows(state),
    completionGuide: guideFor(state), ready: true, busy: false, ...extra });
}
const nodes = (node, predicate) => !node || typeof node !== 'object' ? []
  : typeof node.type === 'function' && node.type.name === 'CompletionProgress' ? nodes(node.type(node.props), predicate)
  : [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => nodes(child, predicate))];
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(text).join('');
function declaration(name, source = playSource) {
  const ast = ts.createSourceFile('play.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const found = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found.push(`const ${node.getText(ast)};`);
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.equal(found.length, 1, `Actual completion declaration ${name}`); return found[0];
}
function harness(state = fixture()) {
  const stateRef = { current: state }, actionVersionRef = { current: 0 }, actorSelectionRef = { current: state.party[0].id };
  const session = { scope: 'auth:cookie:A', revision: 1, csrfToken: 'csrf-A' };
  const storageRefs = { mountedRef: { current: true }, readyRef: { current: true }, activeOwnerRef: { current: 'A' },
    desiredOwnerRef: { current: 'A' }, writerLeasesRef: { current: new Map([['A', { status: 'held' }]]) }, useCallback: fn => fn };
  const checkpointSource = readFileSync(new URL('_hooks/usePrimitiveArchiveCheckpoint.js', base), 'utf8');
  const canMutate = new Function(...Object.keys(storageRefs),
    `${declaration('hasWriterLease', checkpointSource)}\n${declaration('canMutate', checkpointSource)}\nreturn canMutate;`)(...Object.values(storageRefs));
  const checkpointView = { ready: true, exclusive: true, canMutate };
  const annualUiGuardRef = { current: { hydrated: true, checkpoint: checkpointView, busy: false, shopControlsBusy: false } };
  const calls = { tabs: [], recipes: [], help: [], forbidden: [] };
  const scope = { ...engine, primitiveArchiveCompletionGuide, state, stateRef, actorSelectionRef, actionVersionRef,
    actorId: state.party[0].id, archiveVictory: engine.archiveVictorySummary(state),
    campFacilities: engine.campFacilityRows(state), recipes: engine.recipeRows(state), regions: engine.regionRows(state),
    tribe: engine.tribeSummary(state),
    useMemo: fn => fn(), captureAuthSession: () => ({ ...session }), isCurrentAuthSession: value => Boolean(value)
      && ['scope', 'revision', 'csrfToken'].every(key => value[key] === session[key]),
    checkpoint: checkpointView, annualUiGuardRef, hydrated: true, busy: '', shopControlsBusy: false,
    shopStartRef: { current: false }, setActiveTabId: value => calls.tabs.push(value),
    setRecipeId: value => calls.recipes.push(value), setRequirementHelpRequest: value => calls.help.push(value),
    setState: () => calls.forbidden.push('state'), setZoneId: () => calls.forbidden.push('zone'),
    setMessage: () => calls.forbidden.push('message'), playGameSfx: () => calls.forbidden.push('sound') };
  const names = ['completionGuide', 'completionHelpVersion', 'completionHelpSession', 'completionHelpBlocked', 'openCompletionHelp'];
  const compiled = ts.transpileModule(names.map(name => declaration(name)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const view = new Function(...Object.keys(scope), `${compiled}\nreturn { completionGuide, completionHelpBlocked, openCompletionHelp };`)(...Object.values(scope));
  return { ...view, calls, stateRef, actorSelectionRef, actionVersionRef, session, storageRefs,
    checkpointView, annualUiGuardRef, shopStartRef: scope.shopStartRef };
}
function panel(view, extra = {}) {
  const state = view.stateRef.current;
  return Focus({ plan: focusFor(state), annual: { ...engine.annualSettlementSummary(state), lineageMode: state.lineage.mode },
    onCompletionHelp: view.openCompletionHelp, completionHelpBlocked: view.completionHelpBlocked,
    onNavigate: tab => view.calls.forbidden.push(`unguarded-navigation:${tab}`), ...extra });
}
function freeCall(view, callback) {
  const before = clone(view.stateRef.current), original = view.stateRef.current;
  const saved = new Map();
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, String(value)), removeItem: key => saved.delete(key) };
  assert.equal(checkpoint.writeCheckpoint(storage, 'guest', original, { expectedRevision: 0 }).status, 'ready');
  const stored = new Map(saved), originalRandom = Math.random;
  Math.random = () => { throw Error('Free navigation requested randomness'); };
  try { callback(); } finally { Math.random = originalRandom; }
  assert.equal(view.stateRef.current, original);
  assert.deepEqual(view.stateRef.current, before, 'Navigation preserves AP inventory time research region body lineage and all ledger fields.');
  assert.deepEqual(saved, stored); assert.deepEqual(view.calls.forbidden, []);
}
let passed = 0;
const failures = [];
function check(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) {
    const category = /Actual completion declaration/.test(error.message)
      || (sourceRoot && /actual focus|actual JSX|actual free/.test(name)) ? 'missing integration capability' : 'contract assertion';
    failures.push({ name, category, message: error.message }); console.error(`FAIL ${name} [${category}]: ${error.stack}`);
  }
}
const timeout = setTimeout(() => { console.error('FAIL completion guide exceeded 45 seconds'); process.exitCode = 1; }, 45000);
try {
  check('actual facility bottleneck remains visible while another real research is in progress', () => {
    const state = fixture(), before = clone(state), guide = guideFor(state);
    const facility = engine.campFacilityRows(state).find(row => row.id === 'archive_room');
    assert.equal(facility.materialRows.find(row => row.id === 'stone').required, 3);
    const goal = guide.objective;
    assert.equal(goal.kind, 'facility'); assert.equal(goal.id, facility.id);
    const material = goal.materials.find(row => row.resourceId === 'stone');
    assert.equal(material.current, 2); assert.equal(material.required, 3); assert.equal(material.missing, 1);
    assert.ok(material.sources.length > 0);
    const visible = engine.regionRows(state).filter(row => row.revealed && !row.safe);
    const expected = visible.flatMap(region => ['gather', 'hunt'].filter(kind =>
      (region.zone?.[kind] || []).some(row => row[0] === 'stone' && row[1] > 0)).map(kind => [region.id, kind]));
    assert.deepEqual(material.sources.map(row => [row.regionId, row.action]).sort(), expected.sort());
    for (const source of material.sources) {
      assert.equal(source.dangerLabel, visible.find(region => region.id === source.regionId).dangerLabel);
      assert.equal(Object.hasOwn(source, 'chance'), false);
      assert.equal(Object.hasOwn(source, 'probability'), false);
    }
    assert.equal(state.research.selectedTechId, before.research.selectedTechId);
    assert.deepEqual(state, before);
  });
  check('actual focus prioritizes the required facility instead of hiding it behind selected research', () => {
    const state = fixture('focus-facility');
    assert.equal(engine.researchSummary(state).selected.id, state.research.selectedTechId);
    assert.equal(focusFor(state).objective.id, 'archive_room');
  });
  check('locked required facilities and books expose actual catalog research and exact missing resources', () => {
    const state = fixture('locked-books');
    state.inventory.book_craft_guide = 0; state.inventory.book_camp_manual = 0;
    state.inventory.fiber = 0;
    const relevant = data.TECH_TREE.filter(row => row.unlocks?.recipes?.includes('book_craft_guide')
      || row.unlocks?.camp?.includes('archive_room'));
    assert.ok(relevant.length);
    for (const row of relevant) state.research.completed[row.id] = false;
    const guide = guideFor(state);
    for (const id of ['archive_room', 'book_craft_guide', 'book_camp_manual']) {
      const goal = guide.candidates.find(row => row.id === id); assert.ok(goal, id);
      assert.equal(goal.unlocked, false, id);
      const unlock = data.TECH_TREE.filter(row => id === 'archive_room' ? row.unlocks?.camp?.includes(id) : row.unlocks?.recipes?.includes(id));
      assert.deepEqual(goal.research.map(row => row.technologyId), unlock.map(row => row.id));
      const actual = id === 'archive_room' ? engine.campFacilityRows(state).find(row => row.id === id)
        : engine.recipeRows(state).find(row => row.id === id);
      assert.deepEqual(goal.materials.map(row => [row.resourceId, row.missing]), actual.materialRows
        .filter(row => row.required > row.current).map(row => [row.id, row.required - row.current]));
    }
  });
  check('undiscovered sources remain absent instead of leaking names or promising fabricated routes', () => {
    const state = fixture('hidden-source');
    state.exploration.revealed = Object.fromEntries(engine.WORLD_REGIONS.map(row => [row.id, false]));
    const regions = engine.regionRows(state), guide = guideFor(state);
    const hidden = regions.filter(row => !row.revealed), visible = regions.filter(row => row.revealed && !row.safe);
    assert.ok(hidden.length > 0);
    assert.ok(regions.some(row => row.revealedAtStart && row.revealed), 'The actual engine preserves public starting regions.');
    const serialized = JSON.stringify(guide);
    for (const row of hidden) { assert.ok(!serialized.includes(row.name)); assert.ok(!serialized.includes(`"regionId":"${row.id}"`)); }
    for (const candidate of guide.candidates) for (const material of candidate.materials) for (const source of material.sources) {
      const region = visible.find(row => row.id === source.regionId);
      assert.ok(region, 'Only actually revealed nonsafe regions may supply a material.');
      assert.ok(['gather', 'hunt'].includes(source.action));
      assert.ok(region.zone[source.action].some(row => row[0] === material.resourceId && Number(row[1]) > 0));
      assert.equal(Object.hasOwn(source, 'chance'), false); assert.equal(Object.hasOwn(source, 'probability'), false);
    }
    const noRegions = primitiveArchiveCompletionGuide({ ...inputs(state), regions: [] });
    assert.ok(noRegions.candidates.flatMap(row => row.materials).every(material => material.sources.length === 0),
      'An explicitly empty public-region input must never fabricate a supply route.');
  });
  check('blocked ended and urgent survival objectives retain precedence over completion guidance', () => {
    const state = fixture('priority');
    assert.equal(focusFor(state, { ready: false }).blocked, true);
    assert.equal(focusFor(state, { busy: true }).blocked, true);
    const ended = { ...state, ended: true };
    assert.equal(guideFor(ended).status, 'ended'); assert.equal(focusFor(ended).objective.targetTab, 'run');
    const member = state.party[0];
    const urgent = focusFor(state, { nightRows: [{ id: member.id, name: member.name,
      currentHp: 10, hp: 0, damage: 10, hungerDamage: 10, coldDamage: 0, hypothermiaDamage: 0 }] });
    assert.match(urgent.objective.title, /생존/); assert.notEqual(urgent.objective.id, 'archive_room');
  });
  check('real complete conditions offer continuing play without completing or rewriting the run', () => {
    const state = fixture('complete-choice');
    state.research.completed = Object.fromEntries(data.TECH_TREE.map(row => [row.id, true]));
    state.camp.archiveRoomLevel = 1;
    assert.equal(engine.archiveVictorySummary(state).canComplete, true);
    const before = clone(state);
    assert.equal(guideFor(state).status, 'complete');
    const plan = focusFor(state); assert.match(plan.objective.detail, /이어갈|계속/);
    assert.equal(state.ended, false); assert.deepEqual(state, before);
  });
  check('daily book crafting and annual community book guidance use distinct real routes without changing plans', () => {
    let state = fixture('book-navigation');
    state.camp.archiveRoomLevel = 1;
    state.inventory.book_craft_guide = 0; state.inventory.book_camp_manual = 0; state.inventory.twine = 0;
    const daily = guideFor(state), book = daily.candidates.find(row => row.id === 'book_craft_guide');
    assert.ok(book); assert.equal(book.targetTab, 'actions'); assert.equal(book.recipeId, 'book_craft_guide');
    const twine = book.materials.find(row => row.resourceId === 'twine'); assert.ok(twine);
    assert.ok(twine.crafting.some(row => row.recipeId === 'twine'));
    const stamp = { runId: state.runId, day: state.day, ap: state.ap, updatedAt: state.updatedAt, completedYears: null };
    state = engine.startAnnualSettlementAction(state, stamp, { observedLifetimeYears: 60 });
    const before = clone(state), annual = guideFor(state);
    const annualBook = annual.candidates.find(row => row.id === 'book_craft_guide');
    assert.equal(annualBook.targetTab, 'tribe'); assert.equal(annualBook.processingActionId, 'annual_book_craft_guide');
    assert.ok(engine.tribeProcessingSummary(state).options.some(row => row.id === annualBook.processingActionId));
    assert.deepEqual(state, before, 'Guidance does not force a production plan or craft a book.');
  });
  check('actual JSX primary facility and visible material links invoke the free current handler', () => {
    const view = harness(), tree = panel(view);
    const target = nodes(tree, node => node.type === GameControlButton && text(node) === '필수 시설 확인')[0];
    assert.ok(target); assert.equal(Boolean(target.props.disabled), false);
    freeCall(view, () => target.props.onClick()); assert.deepEqual(view.calls.tabs, ['camp']);
    assert.deepEqual(view.calls.help, [null]);
    const source = view.completionGuide.objective.materials.find(row => row.resourceId === 'stone').sources[0];
    const mapButton = nodes(tree, node => node.type === GameControlButton && text(node).includes(source.regionName)
      && text(node).includes('공급처 보기'))[0];
    assert.ok(mapButton); assert.match(mapButton.props.title, /보장하지/);
    freeCall(view, () => mapButton.props.onClick());
    assert.equal(view.calls.tabs.at(-1), 'map');
    assert.deepEqual(view.calls.help.at(-1), { kind: 'map', runId: view.stateRef.current.runId,
      resourceId: 'stone', regionId: source.regionId, resourceName: engine.itemName('stone') });
  });
  check('actual JSX book recipe and locked research help change only their permitted view selection', () => {
    const state = fixture('book-help'); state.camp.archiveRoomLevel = 1;
    state.inventory.book_craft_guide = 0; state.inventory.book_camp_manual = 0; state.inventory.twine = 0;
    const view = harness(state), tree = panel(view);
    const target = nodes(tree, node => node.type === GameControlButton && text(node) === '책 제작 확인')[0];
    assert.ok(target); freeCall(view, () => target.props.onClick());
    assert.equal(view.calls.tabs.at(-1), 'actions'); assert.equal(view.calls.recipes.at(-1), 'book_craft_guide');
    const crafting = nodes(tree, node => node.type === GameControlButton && text(node) === `${engine.itemName('twine')} · 제작법 확인`)[0];
    assert.ok(crafting); freeCall(view, () => crafting.props.onClick());
    assert.equal(view.calls.recipes.at(-1), 'twine');
    const lockedState = fixture('research-help');
    const unlock = data.TECH_TREE.find(row => row.unlocks?.camp?.includes('archive_room'));
    assert.ok(unlock); lockedState.research.completed[unlock.id] = false;
    const locked = harness(lockedState);
    const button = nodes(panel(locked), node => node.type === GameControlButton && text(node) === `${unlock.name} 조건 보기`)[0];
    assert.ok(button); freeCall(locked, () => button.props.onClick());
    assert.equal(locked.calls.tabs.at(-1), 'growth');
    assert.deepEqual(locked.calls.help.at(-1), { kind: 'research', runId: lockedState.runId, technologyId: unlock.id });
  });
  check('actual JSX annual completion and complete-choice targets preserve production plans and ongoing play', () => {
    let state = fixture('annual-help'); state.camp.archiveRoomLevel = 1;
    state.inventory.book_craft_guide = 0; state.inventory.book_camp_manual = 0;
    state = engine.startAnnualSettlementAction(state, { runId: state.runId, day: state.day, ap: state.ap,
      updatedAt: state.updatedAt, completedYears: null }, { observedLifetimeYears: 60 });
    const annual = harness(state);
    const button = nodes(panel(annual), node => node.type === GameControlButton && text(node) === '공동체 책 가공 확인')[0];
    assert.ok(button); freeCall(annual, () => button.props.onClick());
    assert.equal(annual.calls.tabs.at(-1), 'tribe'); assert.deepEqual(annual.calls.recipes, []);
    const completeState = fixture('complete-navigation'); completeState.camp.archiveRoomLevel = 1;
    completeState.research.completed = Object.fromEntries(data.TECH_TREE.map(row => [row.id, true]));
    assert.equal(engine.archiveVictorySummary(completeState).canComplete, true);
    const complete = harness(completeState);
    const completeButton = nodes(panel(complete), node => node.type === GameControlButton && text(node) === '완주 선택 확인')[0];
    assert.ok(completeButton); freeCall(complete, () => completeButton.props.onClick());
    assert.equal(complete.calls.tabs.at(-1), 'run'); assert.equal(complete.stateRef.current.ended, false);
  });
  check('actual free help rejects fabricated requests and stale state resources actor session lifecycle or storage ownership', () => {
    const validRequest = { scope: 'completion', kind: 'target', candidateKind: 'facility', id: 'archive_room' };
    const changes = {
      identity: h => { h.stateRef.current = clone(h.stateRef.current); },
      resourcesAcquired: h => {
        const source = h.completionGuide.objective.materials.find(row => row.resourceId === 'stone').sources.find(row => row.action === 'gather');
        assert.ok(source);
        const before = Number(h.stateRef.current.inventory.stone);
        h.stateRef.current = engine.runGatherAction(h.stateRef.current, h.stateRef.current.party[0].id, source.regionId, { rng: () => 0 });
        assert.ok(h.stateRef.current.inventory.stone > before, 'A real current gather action acquires the missing resource.');
      },
      run: h => { h.stateRef.current = fixture('new-run'); },
      actor: h => { h.actorSelectionRef.current = h.stateRef.current.party[1].id; },
      actionVersion: h => { h.actionVersionRef.current++; },
      owner: h => { h.session.scope = 'auth:cookie:B'; }, revision: h => { h.session.revision++; },
      csrf: h => { h.session.csrfToken = 'rotated'; }, unmount: h => { h.storageRefs.mountedRef.current = false; },
      storageOwner: h => { h.storageRefs.desiredOwnerRef.current = 'B'; },
      lease: h => { h.storageRefs.writerLeasesRef.current.set('A', { status: 'busy' }); },
      ready: h => { h.checkpointView.ready = false; }, exclusive: h => { h.checkpointView.exclusive = false; },
      hydrated: h => { h.annualUiGuardRef.current.hydrated = false; },
      busy: h => { h.annualUiGuardRef.current.busy = true; }, shopBusy: h => { h.annualUiGuardRef.current.shopControlsBusy = true; },
      shopStart: h => { h.shopStartRef.current = true; },
    };
    for (const [name, change] of Object.entries(changes)) {
      const view = harness(fixture(`stale-${name}`)); change(view);
      freeCall(view, () => view.openCompletionHelp(validRequest));
      assert.deepEqual(view.calls.tabs, [], name); assert.deepEqual(view.calls.help, [], name); assert.deepEqual(view.calls.recipes, [], name);
    }
    for (const request of [null, {}, { ...validRequest, scope: 'other' }, { ...validRequest, id: 'unknown' },
      { scope: 'completion', kind: 'map', resourceId: 'stone', regionId: 'unknown' },
      { scope: 'completion', kind: 'recipe', recipeId: 'unknown' },
      { scope: 'completion', kind: 'research', technologyId: 'unknown' },
      { scope: 'completion', kind: 'target', candidateKind: 'complete' }]) {
      const view = harness(); freeCall(view, () => view.openCompletionHelp(request));
      assert.deepEqual(view.calls.tabs, []); assert.deepEqual(view.calls.help, []); assert.deepEqual(view.calls.recipes, []);
    }
    const endedState = fixture('ended-help'); endedState.ended = true;
    const ended = harness(endedState); freeCall(ended, () => ended.openCompletionHelp(validRequest));
    assert.deepEqual(ended.calls.tabs, []);
  });
  check('actual JSX busy guidance disables its completion controls without inventing navigation', () => {
    const view = harness(), tree = panel(view, { completionHelpBlocked: true });
    const buttons = nodes(tree, node => node.type === GameControlButton && text(node) === '필수 시설 확인');
    assert.ok(buttons.length > 0); assert.ok(buttons.every(button => button.props.disabled));
    assert.deepEqual(view.calls.tabs, []);
  });
  check('annual completion material routes exactly preserve real community jobs and research metadata instead of field maps', () => {
    let state = fixture('annual-community-contract');
    state.inventory.book_craft_guide = 0; state.inventory.book_camp_manual = 0;
    for (const id of ['fiber', 'clay', 'resin', 'twine']) state.inventory[id] = 0;
    state = engine.startAnnualSettlementAction(state, { runId: state.runId, day: state.day, ap: state.ap,
      updatedAt: state.updatedAt, completedYears: null }, { observedLifetimeYears: 60 });
    const processing = engine.tribeSummary(state).processing;
    const gatedSource = processing.communitySources.find(source => source.resourceIds.includes('stone')
      && source.researchRequirements.some(row => row.technologyId !== 'SETTLEMENT'));
    assert.ok(gatedSource);
    const missingResearch = gatedSource.researchRequirements.find(row => row.technologyId !== 'SETTLEMENT');
    state.research.completed[missingResearch.technologyId] = false;
    const before = clone(state), actualProcessing = engine.tribeSummary(state).processing, guide = guideFor(state);
    let materialCount = 0;
    for (const candidate of guide.candidates) {
      assert.ok(candidate.helpRequests.every(request => request.kind !== 'map'));
      for (const material of candidate.materials) {
        materialCount++;
        const expected = actualProcessing.communitySources.filter(source => source.resourceIds.includes(material.resourceId))
          .map(source => ({ kind: 'community', actionId: source.id,
            actionLabel: engine.TRIBE_JOBS.find(job => job.id === source.id).name,
            research: source.researchRequirements.map(row => ({ technologyId: row.technologyId,
              name: row.name || row.technologyId, completed: row.completed === true })) }));
        assert.deepEqual(material.sources, expected, `${candidate.id}/${material.resourceId} actual annual supply`);
        for (const source of material.sources) {
          assert.ok(engine.TRIBE_JOBS.some(job => job.id === source.actionId));
          assert.equal(Object.hasOwn(source, 'regionId'), false);
          assert.equal(Object.hasOwn(source, 'probability'), false); assert.equal(Object.hasOwn(source, 'chance'), false);
          assert.ok(candidate.helpRequests.some(request => request.kind === 'community'
            && request.actionId === source.actionId && request.resourceId === material.resourceId));
          for (const research of source.research.filter(row => !row.completed)) {
            assert.ok(candidate.research.some(row => row.technologyId === research.technologyId));
          }
        }
      }
      assert.equal(new Set(candidate.research.map(row => row.technologyId)).size, candidate.research.length);
    }
    assert.ok(materialCount > 0);
    const twine = guide.candidates.find(row => row.id === 'book_craft_guide').materials.find(row => row.resourceId === 'twine');
    assert.ok(twine.crafting.some(row => row.recipeId === 'twine'));
    assert.deepEqual(state, before);
  });
  check('actual JSX annual community supply opens only free tribe view and rejects fake or obsolete map requests', () => {
    let state = fixture('annual-community-navigation');
    const dailyMap = guideFor(state).objective.materials.find(row => row.resourceId === 'stone').sources[0];
    assert.ok(dailyMap);
    state = engine.startAnnualSettlementAction(state, { runId: state.runId, day: state.day, ap: state.ap,
      updatedAt: state.updatedAt, completedYears: null }, { observedLifetimeYears: 60 });
    const view = harness(state);
    const material = view.completionGuide.objective.materials.find(row => row.resourceId === 'stone');
    const source = material.sources.find(row => row.kind === 'community'); assert.ok(source);
    const button = nodes(panel(view), node => node.type === GameControlButton
      && text(node) === `${source.actionLabel} · 공동체 생산 확인`)[0];
    assert.ok(button); assert.equal(Boolean(button.props.disabled), false);
    assert.match(button.props.title, /연구|일손|배치/); assert.match(button.props.title, /1년|연간/);
    assert.match(button.props.title, /보장하지|보장 아님|보장.*[X×]/);
    freeCall(view, () => button.props.onClick());
    assert.deepEqual(view.calls.tabs, ['tribe']); assert.deepEqual(view.calls.recipes, []);
    const requests = [
      { scope: 'completion', kind: 'community', actionId: 'unknown-job', resourceId: 'stone' },
      { scope: 'completion', kind: 'community', actionId: source.actionId, resourceId: 'unknown-resource' },
      { scope: 'completion', kind: 'map', resourceId: 'stone' },
      { scope: 'completion', kind: 'map', resourceId: 'stone', regionId: undefined },
      { scope: 'completion', kind: 'map', resourceId: 'stone', regionId: dailyMap.regionId },
    ];
    const before = clone(view.calls);
    for (const request of requests) freeCall(view, () => view.openCompletionHelp(request));
    assert.deepEqual(view.calls, before);
    const stale = harness(state);
    stale.stateRef.current = engine.runSettlementYearAction(state, { runId: state.runId, day: state.day,
      ap: state.ap, updatedAt: state.updatedAt, completedYears: state.calendar.completedYears });
    freeCall(stale, () => stale.openCompletionHelp({ scope: 'completion', kind: 'community',
      actionId: source.actionId, resourceId: 'stone' }));
    assert.deepEqual(stale.calls.tabs, []);
  });
} finally {
  clearTimeout(timeout); loader.deregister();
  if (previousImage === undefined) delete globalThis.__completionGuideImage; else globalThis.__completionGuideImage = previousImage;
}
console.log(JSON.stringify({ passed, failed: failures.length, sourceMode: sourceRoot ? 'original source override' : 'current product',
  fixtureMode: 'Fresh capability fixtures from actual current catalogs; not natural progression',
  failures: failures.map(({ name, category }) => ({ name, category })),
  scope: 'Actual pure helper/engine/JSX and current source callbacks under controlled ownership; not browser/human acceptance' }));
if (failures.length) process.exitCode = 1;
