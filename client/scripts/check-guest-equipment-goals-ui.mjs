import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';
import { createHandlerHarness } from './lib/hook-handler-harness.mjs';
import { ER_WEAPON_TYPES_KO } from '../src/utils/erMeta.js';

const componentUrl = new URL('../src/app/simulation/_components/SimulationGuestEquipmentGoals.js', import.meta.url).href;
const helperUrl = new URL('../src/app/simulation/_lib/guestEquipmentGoalRuntime.js', import.meta.url).href;
const participantHookUrl = new URL('../src/app/simulation/_lib/useSimulationParticipantPresets.js', import.meta.url).href;
const harnessUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
registerHooks({ load(url, context, nextLoad) {
  if (url === participantHookUrl) {
    const source = readFileSync(new URL(url), 'utf8').replace("from 'react';", `from '${harnessUrl}';`);
    return { format: 'module', shortCircuit: true, source };
  }
  if (url !== componentUrl) return nextLoad(url, context);
  const source = readFileSync(new URL(url), 'utf8');
  const transpiled = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const reactStub = `const React = { createElement(type, props, ...children) {
    return { type, props: { ...(props || {}), children: children.length === 1 ? children[0] : children } };
  } };\n`;
  return { format: 'module', shortCircuit: true, source: `${reactStub}${transpiled}` };
} });

const [{ default: SimulationGuestEquipmentGoals }, helper] = await Promise.all([
  import(componentUrl), import(helperUrl),
]);
const { GUEST_GOAL_TIERS, GUEST_GOAL_SLOTS, normalizeGuestGoalLoadouts,
  getGuestEquipmentGoalOptions, resolveGuestEquipmentGoal } = helper;
const item = (id, slot, tier, weaponType = '') => ({ _id: id, itemKey: `key:${id}`, name: id,
  type: slot === 'weapon' ? '무기' : '방어구', category: 'equipment', equipSlot: slot,
  ...(slot === 'weapon' ? { weaponType } : {}), tier,
  recipe: { ingredients: [{ itemId: 'raw-material', qty: 1 }], creditsCost: 0, resultQty: 1 } });
const items = [
  item('hero-weapon', 'weapon', 4, '활'), item('hero-head', 'head', 4), item('hero-clothes', 'clothes', 4),
  item('hero-arm', 'arm', 4), item('hero-shoes', 'shoes', 4),
  item('legend-head', 'head', 5), item('transcend-head', 'head', 6),
];
const deepCopy = (value) => structuredClone(value);
const walk = (node, predicate, found = []) => {
  if (!node || typeof node !== 'object') return found;
  if (Array.isArray(node)) { node.forEach((child) => walk(child, predicate, found)); return found; }
  if (predicate(node)) found.push(node);
  walk(node.props?.children, predicate, found);
  return found;
};
const render = (props) => SimulationGuestEquipmentGoals(props);
const selectById = (tree, id) => walk(tree, (node) => node.type === 'select' && node.props?.id === id)[0];
let patches = [];
const onChange = (patch) => patches.push(patch);

const actor = { _id: 'guest-survivor-01', guestDefault: true, weaponType: '권총', erWeapons: ['권총'] };
const actorBefore = deepCopy(actor), itemsBefore = deepCopy(items);
let tree = render({ actor, draft: { name: actor.name }, items, onChange });
const details = walk(tree, (node) => node.type === 'details');
assert.equal(details[0].props.className, 'simulation-guest-equipment-goals');
assert.equal(details[0].props.open, undefined, 'Top-level goals start collapsed.');
assert.equal(details.find((node) => String(node.props.className || '').includes('is-hero'))?.props.open, true,
  'Hero goals alone start open.');
assert.equal(details.filter((node) => String(node.props.className || '').includes('__tier') && !String(node.props.className).includes('is-hero')
  && node.props.open === true).length, 0, 'Legend and transcend goals do not expand by default.');
assert.equal(walk(tree, (node) => node.type === 'select').length, 16, 'One weapon-family select and fifteen tier/slot selects are rendered.');
assert.equal(Object.hasOwn(actor, 'goalLoadouts'), false, 'A draft with no goals remains absent until an explicit change.');
assert.deepEqual(patches, [], 'Render does not write defaults back into an optional draft.');

patches = [];
selectById(tree, 'simulation-guest-equipment-weapon-type').props.onChange({ target: { value: '활' } });
assert.deepEqual(patches, [{ weaponType: '활' }], 'Weapon-family changes emit a canonical scalar patch.');
patches = [];
selectById(tree, 'simulation-guest-goal-hero-headKey').props.onChange({ target: { value: 'hero-head' } });
assert.equal(patches.length, 1);
assert.equal(patches[0].goalLoadouts.hero.headKey, 'hero-head', 'Goal choices store stable catalog IDs.');
assert.deepEqual(actor, actorBefore, 'Rendering and handlers do not mutate the source actor.');
assert.deepEqual(items, itemsBefore, 'Rendering and handlers do not mutate the catalog.');

const aliasDraft = { goalLoadouts: { hero: { headKey: 'key:hero-head' } } };
const aliasBefore = deepCopy(aliasDraft);
const patchesBeforeAlias = patches.length;
tree = render({ actor, draft: aliasDraft, items, onChange });
assert.equal(selectById(tree, 'simulation-guest-goal-hero-headKey').props.value, 'hero-head',
  'A legacy alias resolves to its source option for display.');
assert.deepEqual(aliasDraft, aliasBefore, 'Reading an alias does not rewrite the raw saved key.');
assert.equal(patches.length, patchesBeforeAlias, 'Reading an alias emits no change patch.');

const latePrimaryAlias = item('late-primary', 'head', 5);
latePrimaryAlias.itemKey = 'late-primary-key';
latePrimaryAlias.externalId = 'late-secondary-key';
const lateCatalog = [...items, latePrimaryAlias];
const lateSecondaryDraft = { goalLoadouts: { legend: { headKey: 'late-secondary-key' } } };
tree = render({ actor, draft: lateSecondaryDraft, items: lateCatalog, onChange });
const lateSecondarySelect = selectById(tree, 'simulation-guest-goal-legend-headKey');
assert.equal(resolveGuestEquipmentGoal({ ...actor, ...lateSecondaryDraft }, lateCatalog, 'legend', 'head', 'late-secondary-key'), null,
  'The planner does not resolve a non-primary secondary externalId alias for late goals.');
assert.ok(walk(lateSecondarySelect, (node) => node.type === 'option' && node.props?.disabled
  && String(node.props.children).includes('late-secondary-key')).length,
  'The UI preserves that unsupported raw alias as a disabled goal.');
assert.deepEqual(lateSecondaryDraft.goalLoadouts.legend.headKey, 'late-secondary-key',
  'Reading an unsupported late alias does not rewrite the raw key.');

const invalidHeroCollision = item('invalid-collision', 'head', 4);
invalidHeroCollision.itemKey = 'hero-collision-key';
invalidHeroCollision.recipe = { ingredients: [{ itemId: 'raw-material', qty: 0 }] };
const validHeroCollision = item('valid-collision', 'head', 4);
validHeroCollision.itemKey = 'hero-collision-key';
const collisionCatalog = [...items, invalidHeroCollision, validHeroCollision];
const collisionDraft = { goalLoadouts: { hero: { headKey: 'hero-collision-key' } } };
tree = render({ actor, draft: collisionDraft, items: collisionCatalog, onChange });
const collisionSelect = selectById(tree, 'simulation-guest-goal-hero-headKey');
assert.equal(resolveGuestEquipmentGoal({ ...actor, ...collisionDraft }, collisionCatalog, 'hero', 'head', 'hero-collision-key'), null,
  'A first invalid hero alias collision remains unresolved instead of falling through to a later valid row.');
assert.ok(walk(collisionSelect, (node) => node.type === 'option' && node.props?.disabled
  && String(node.props.children).includes('hero-collision-key')).length,
  'The UI reflects the runtime first-row collision behavior.');

const invalidLateCollision = item('invalid-late-collision', 'head', 5);
invalidLateCollision.itemKey = 'late-collision-key';
invalidLateCollision.recipe = { ingredients: [{ itemId: 'raw-material', qty: 0 }] };
const validLateCollision = item('valid-late-collision', 'head', 5);
validLateCollision.itemKey = 'late-collision-key';
const lateCollisionCatalog = [...items, invalidLateCollision, validLateCollision];
const lateCollisionOptions = getGuestEquipmentGoalOptions(actor, lateCollisionCatalog, 'legend', 'head');
assert.ok(lateCollisionOptions.some((candidate) => candidate._id === 'valid-late-collision'),
  'Late authored aliases use first-valid registration and skip an earlier invalid-recipe row.');

const missingDraft = { goalLoadouts: { hero: { headKey: 'removed-head' } } };
tree = render({ actor, draft: missingDraft, items, onChange });
let missingSelect = selectById(tree, 'simulation-guest-goal-hero-headKey');
assert.ok(walk(missingSelect, (node) => node.type === 'option' && node.props?.disabled
  && String(node.props.children).includes('removed-head')).length, 'A missing saved goal remains visible as a disabled option.');
assert.ok(walk(tree, (node) => node.type === 'li' && String(node.props?.children).includes('현재 아이템 목록')).length,
  'Missing targets are surfaced through the real goal-validation helper.');
patches = [];
missingSelect.props.onChange({ target: { value: 'hero-head' } });
assert.equal(patches[0].goalLoadouts.hero.headKey, 'hero-head', 'An explicit valid option can replace a missing goal.');

const incompatibleDraft = { weaponType: '권총', goalLoadouts: { hero: { weaponKey: 'hero-weapon' } } };
tree = render({ actor, draft: incompatibleDraft, items, onChange });
const incompatibleSelect = selectById(tree, 'simulation-guest-goal-hero-weaponKey');
assert.ok(walk(incompatibleSelect, (node) => node.type === 'option' && node.props?.disabled
  && String(node.props.children).includes('hero-weapon')).length, 'An incompatible weapon goal is retained as disabled, not replaced.');
assert.ok(walk(tree, (node) => node.type === 'li' && String(node.props?.children).includes('무기 호환')).length,
  'Weapon incompatibility is reported by the actual helper.');

tree = render({ actor, draft: {}, items: [], onChange });
assert.ok(walk(tree, (node) => node.type === 'p' && node.props?.className === 'simulation-guest-equipment-goals__waiting').length,
  'An empty catalog displays the waiting guidance.');
assert.equal(walk(tree, (node) => node.type === 'select' && node.props?.disabled
  && String(node.props?.id || '').startsWith('simulation-guest-goal-')).length, 15,
  'All goal selects are disabled while the catalog is not ready.');

const invalidDraft = { goalLoadouts: { unknownTier: { headKey: 'bad' } } };
tree = render({ actor, draft: invalidDraft, items, onChange });
assert.ok(walk(tree, (node) => node.type === 'li' && String(node.props?.children).includes('목표 형식')).length,
  'Malformed raw goals are reported instead of normalized silently.');
assert.equal(walk(tree, (node) => node.type === 'select' && node.props?.disabled
  && String(node.props?.id || '').startsWith('simulation-guest-goal-')).length, 15,
  'Malformed goals cannot be edited through an accidental fallback value.');
patches = [];
walk(tree, (node) => node.type === 'button' && node.props?.className === 'simulation-guest-equipment-goals__reset')[0]
  .props.onClick();
assert.deepEqual(patches, [{ goalLoadouts: normalizeGuestGoalLoadouts({}) }], 'Only explicit reset clears malformed goals.');

const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const localRows = new Map();
const memoryStorage = { getItem: (key) => localRows.has(key) ? localRows.get(key) : null,
  setItem: (key, value) => localRows.set(key, String(value)), removeItem: (key) => localRows.delete(key) };
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage });
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: memoryStorage } });
try {
  const [{ useSimulationParticipantPresets }, bootstrap, guestCatalogModule] = await Promise.all([
    import(participantHookUrl), import('../src/app/simulation/_lib/guestSimulationBootstrap.js'),
    import('../src/app/simulation/_generated/guestItemCatalog.generated.js'),
  ]);
  const boot = bootstrap.resolveSimulationBootstrapData({
    charList: bootstrap.buildGuestSimulationRoster(), guestMode: true, isolatedEvaluation: true,
  });
  const activeMap = bootstrap.buildGuestSimulationMap();
  const publicItems = (await bootstrap.loadGuestSimulationItemCatalog({ isolatedEvaluation: true }));
  assert.ok(guestCatalogModule.GUEST_ITEM_CATALOG.length > 0 && publicItems.length > 0,
    'The hook scenario uses the actual embedded guest item catalogue.');
  const candidates = boot.charList.slice(0, 2);
  const selectedActor = candidates[1];
  const unrelatedActor = candidates[0];
  const survivors = [...candidates];
  const nextWeapon = ER_WEAPON_TYPES_KO.find((value) => value !== selectedActor.weaponType);
  const validationActor = { ...selectedActor, weaponType: nextWeapon };
  const target = getGuestEquipmentGoalOptions(validationActor, publicItems, 'hero', 'head')[0];
  assert.ok(target, 'Actual bootstrap catalog provides a valid hero head goal.');
  const goalLoadouts = normalizeGuestGoalLoadouts({ hero: { headKey: target._id } });
  let candidateState = candidates, survivorState = survivors;
  const updaterKinds = [];
  const actions = {
    setCandidateSurvivors(update) { updaterKinds.push(['candidates', typeof update]); candidateState = update(candidateState); },
    setSurvivors(update) { updaterKinds.push(['survivors', typeof update]); survivorState = update(survivorState); },
  };
  const hookProps = { activeMap, candidateSurvivors: candidateState, day: 0, isAdvancing: false, isGameOver: false,
    isRunLocked: () => false, replayMode: false, matchSec: 0, publicItems, settings: {}, survivors: survivorState, actions };
  const harness = createHandlerHarness(() => useSimulationParticipantPresets(hookProps), {});
  let hookState = harness.render();
  const saved = hookState.saveLocalCharacter(selectedActor._id, {
    name: selectedActor.name, weaponType: nextWeapon, goalLoadouts,
  });
  assert.equal(saved.ok, true, `The actual hook save path accepts the prepared guest edit: ${saved.errors?.join('; ') || ''}`);
  assert.deepEqual(updaterKinds, [['candidates', 'function'], ['survivors', 'function']],
    'The hook passes functional state updates for both candidate and active rosters.');
  hookProps.candidateSurvivors = candidateState;
  hookProps.survivors = survivorState;
  harness.dirty = true;
  harness.flush();
  const candidateAfter = candidateState.find((row) => row._id === selectedActor._id);
  const survivorAfter = survivorState.find((row) => row._id === selectedActor._id);
  for (const updated of [candidateAfter, survivorAfter]) {
    assert.equal(updated.weaponType, nextWeapon, 'The saved weapon family reaches both live roster snapshots.');
    assert.deepEqual(updated.goalLoadouts, goalLoadouts, 'The saved goal reaches both live roster snapshots.');
    assert.ok(updated.routePlanZoneIds && updated.routePlanZoneIds.length > 0,
      'The goal edit publishes a freshly planned route.');
  }
  assert.equal(candidateState.find((row) => row._id === unrelatedActor._id), unrelatedActor,
    'The unrelated candidate actor retains object identity.');
  assert.equal(survivorState.find((row) => row._id === unrelatedActor._id), unrelatedActor,
    'The unrelated active survivor retains object identity.');
  assert.equal(selectedActor.weaponType !== nextWeapon, true, 'The source bootstrap actor was not mutated.');
} finally {
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
  else delete globalThis.localStorage;
  if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
  else delete globalThis.window;
}

console.log(JSON.stringify({ pass: true, checks: 28, scope: 'synthetic React-element tree, component handlers, and actual preset-hook path; not DOM/browser proof' }));
console.log('GUEST_EQUIPMENT_GOALS_UI 28/28');
