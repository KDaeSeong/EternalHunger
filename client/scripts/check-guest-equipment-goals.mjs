import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--match') || args.filter((arg) => arg === '--match').length > 1) {
  throw new Error('Usage: node client/scripts/check-guest-equipment-goals.mjs [--match]');
}
const runMatch = args.includes('--match');
const { ER_WEAPON_TYPES_KO } = await import('../src/utils/erMeta.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { buildGuestSimulationMap, buildGuestSimulationRoster, loadGuestSimulationItemCatalog, resolveSimulationBootstrapData }
  = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { GUEST_ITEM_PROFILE_KEY, mergeGuestItemCatalog, readGuestItems, saveGuestItem }
  = await import('../src/app/simulation/_lib/guestItemProfileRuntime.js');
const { buildInitialSimulationRoster } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { createSimulationRunInput, prepareSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { getDefaultSimulationSettings } = await import('../src/app/simulation/_lib/simulationPageRuntime.js');
const { GUEST_GOAL_SLOTS, GUEST_GOAL_TIERS, getGuestEquipmentGoalErrors, getGuestEquipmentGoalOptions,
  normalizeGuestGoalLoadouts, resolveGuestEquipmentGoal } = await import('../src/app/simulation/_lib/guestEquipmentGoalRuntime.js');
const { GUEST_CHARACTER_PROFILE_KEY, normalizeGuestCharacterProfile, readGuestCharacterProfiles,
  saveGuestCharacterBeforeMatch, saveGuestCharacterProfile } = await import('../src/app/simulation/_lib/guestCharacterProfileRuntime.js');

const memoryStorage = (initial = null, failWrite = false) => {
  const values = new Map();
  if (initial !== null) values.set(GUEST_CHARACTER_PROFILE_KEY, initial);
  return { getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { if (failWrite) throw Error('quota'); values.set(key, String(value)); }, values };
};
const blankGoals = () => Object.fromEntries(GUEST_GOAL_TIERS.map(({ key }) => [key,
  Object.fromEntries(GUEST_GOAL_SLOTS.map(({ key: slotKey }) => [slotKey, '']))]));
const skilllessProfile = (id, extra = {}) => ({ id, name: '로컬 목표 테스트', characterSkills: {}, ...extra });
let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };

check('optional goal normalization distinguishes absent, invalid and fresh canonical 3x5 values', () => {
  assert.equal(normalizeGuestGoalLoadouts(undefined), undefined);
  assert.equal(normalizeGuestGoalLoadouts(null), null);
  assert.equal(normalizeGuestGoalLoadouts({ unknown: {} }), null);
  assert.equal(normalizeGuestGoalLoadouts({ hero: { unknownKey: 'x' } }), null);
  assert.equal(normalizeGuestGoalLoadouts({ hero: { headKey: 4 } }), null);
  assert.equal(normalizeGuestGoalLoadouts({ hero: { headKey: 'x'.repeat(181) } }), null);
  const normalized = normalizeGuestGoalLoadouts({ hero: { headKey: ' stable-id ' } });
  assert.equal(normalized.hero.headKey, 'stable-id');
  assert.deepEqual(Object.keys(normalized), ['hero', 'legend', 'transcend']);
  assert.deepEqual(Object.keys(normalized.transcend), GUEST_GOAL_SLOTS.map(({ key }) => key));
  normalized.hero.headKey = 'changed';
  assert.equal(normalizeGuestGoalLoadouts({ hero: { headKey: 'stable-id' } }).hero.headKey, 'stable-id');
});

check('legacy profile normalization omits both new fields, while explicit weapon types must be canonical', () => {
  const legacy = normalizeGuestCharacterProfile(skilllessProfile('guest-survivor-01'));
  assert.ok(legacy); assert.equal(Object.hasOwn(legacy, 'weaponType'), false); assert.equal(Object.hasOwn(legacy, 'goalLoadouts'), false);
  for (const weaponType of [ER_WEAPON_TYPES_KO[0], ' Rifle ', 'not-a-weapon']) {
    const normalized = normalizeGuestCharacterProfile(skilllessProfile('guest-survivor-01', { weaponType }));
    assert.equal(Boolean(normalized), weaponType === ER_WEAPON_TYPES_KO[0]);
  }
});

const catalog = [
  { _id: 'leaf', type: '재료' },
  { _id: 'first-row', itemKey: 'collision', type: '방어구', equipSlot: 'head', tier: 5,
    recipe: { ingredients: [{ itemId: 'leaf', qty: 1 }] } },
  { _id: 'collision', type: '방어구', equipSlot: 'head', tier: 5,
    recipe: { ingredients: [{ itemId: 'leaf', qty: 1 }] } },
  { _id: 'opening-weapon', itemKey: 'opening-alias', type: '무기', equipSlot: 'weapon', weaponType: '돌격소총', tier: 4,
    recipe: { ingredients: [{ itemId: 'leaf', qty: 1 }] } },
  { _id: 'late-weapon', itemKey: 'late-primary', externalId: 'late-secondary', type: '무기', equipSlot: 'weapon', weaponType: '돌격소총', tier: 6,
    recipe: { ingredients: [{ itemId: 'leaf', qty: 1 }] } },
  { _id: 'wrong-slot', type: '무기', equipSlot: 'weapon', weaponType: '권총', tier: 5,
    recipe: { ingredients: [{ itemId: 'leaf', qty: 1 }] } },
  { _id: 'deleted', type: '방어구', equipSlot: 'head', tier: 5, lockedByAdmin: 'deleted',
    recipe: { ingredients: [{ itemId: 'leaf', qty: 1 }] } },
];
check('goal options honor tier, slot, known weapon-family compatibility and runtime first-alias match', () => {
  const actor = { weaponType: '기관단총', erWeapons: ['기관단총'] };
  const heroWeapons = getGuestEquipmentGoalOptions(actor, catalog, 'hero', 'weapon');
  assert.deepEqual(heroWeapons.map((item) => item._id), ['opening-weapon']);
  assert.deepEqual(getGuestEquipmentGoalOptions({ weaponType: '권총', erWeapons: ['권총'] }, catalog, 'hero', 'weapon'), []);
  assert.deepEqual(getGuestEquipmentGoalOptions(actor, catalog, 'legend', 'head').map((item) => item._id), ['first-row']);
  assert.equal(getGuestEquipmentGoalOptions(actor, catalog, 'legend', 'head').some((item) => item._id === 'collision'), false);
  assert.deepEqual(getGuestEquipmentGoalOptions(actor, catalog, 'transcend', 'weapon').map((item) => item._id), ['late-weapon']);
});

check('late goal resolution follows the actual planner keyOf aliases, recipe filtering and global first-valid collision rules', () => {
  const actor = { weaponType: '기관단총', erWeapons: ['기관단총'] };
  const fallbackAfterInvalidRecipe = [
    { _id: 'invalid-first', itemKey: 'primary', type: '방어구', equipSlot: 'head', tier: 5,
      recipe: { ingredients: [{ itemId: 'leaf', qty: 0 }] } },
    { _id: 'leaf', type: '재료' },
    { _id: 'valid-later', itemKey: 'primary', type: '방어구', equipSlot: 'head', tier: 5,
      recipe: { ingredients: [{ itemId: 'leaf', qty: 1 }] } },
  ];
  assert.equal(resolveGuestEquipmentGoal(actor, fallbackAfterInvalidRecipe, 'legend', 'head', 'primary')?._id, 'valid-later');
  assert.equal(resolveGuestEquipmentGoal(actor, catalog, 'transcend', 'weapon', 'late-primary')?._id, 'late-weapon');
  assert.equal(resolveGuestEquipmentGoal(actor, catalog, 'transcend', 'weapon', 'late-secondary'), null,
    'Late runtime keyOf ignores a secondary externalId when itemKey is present.');
  const wrongSlotCollision = [
    { _id: 'weapon-collision', itemKey: 'shared-late-key', type: '무기', equipSlot: 'weapon', weaponType: '돌격소총', tier: 5,
      recipe: { ingredients: [{ itemId: 'leaf', qty: 1 }] } },
    { _id: 'head-collision', itemKey: 'shared-late-key', type: '방어구', equipSlot: 'head', tier: 5,
      recipe: { ingredients: [{ itemId: 'leaf', qty: 1 }] } },
    { _id: 'leaf', type: '재료' },
  ];
  assert.equal(resolveGuestEquipmentGoal(actor, wrongSlotCollision, 'legend', 'head', 'shared-late-key'), null,
    'A globally earlier eligible alias of another slot remains a conflict, not a fallthrough.');
});

check('saved keys are preserved but semantic errors report missing, deleted, collided, wrong-slot, wrong-tier and incompatible targets', () => {
  const invalid = blankGoals();
  invalid.legend.headKey = 'opening-alias'; // The first alias hit is a weapon, not the later intended slot.
  invalid.transcend.headKey = 'deleted';
  invalid.hero.weaponKey = 'wrong-slot';
  const profile = normalizeGuestCharacterProfile(skilllessProfile('guest-survivor-01', { goalLoadouts: invalid }));
  assert.ok(profile, 'catalog-dependent problems remain persisted for the UI to explain');
  assert.equal(profile.goalLoadouts.legend.headKey, 'opening-alias');
  const errors = getGuestEquipmentGoalErrors({ ...profile, weaponType: '기관단총', erWeapons: ['기관단총'] }, catalog);
  assert.equal(errors.length, 3);
  assert.ok(getGuestEquipmentGoalErrors({ weaponType: '권총', erWeapons: ['권총'], goalLoadouts: { hero: { weaponKey: 'opening-weapon' } } }, catalog).length);
  assert.ok(getGuestEquipmentGoalErrors({ goalLoadouts: { legend: { headKey: 'no-longer-present' } } }, catalog).length);
});

check('a usable ID can only be offered when selecting it round-trips through runtime alias ordering', () => {
  const rows = [{ _id: 'other', itemKey: 'target-id', type: '방어구', equipSlot: 'head', tier: 5,
    recipe: { ingredients: [{ itemId: 'leaf', qty: 1 }] } },
  { _id: 'target-id', type: '방어구', equipSlot: 'head', tier: 5,
    recipe: { ingredients: [{ itemId: 'leaf', qty: 1 }] } }, { _id: 'leaf', type: '재료' }];
  assert.deepEqual(getGuestEquipmentGoalOptions({}, rows, 'legend', 'head').map((item) => item._id), ['other']);
});

const map = buildGuestSimulationMap();
const baseRoster = buildGuestSimulationRoster();
const items = await loadGuestSimulationItemCatalog({ includeLocal: false });
const actorId = baseRoster[0]._id;
const selectedWeapon = ER_WEAPON_TYPES_KO.find((weapon) => weapon === baseRoster[0].weaponType) || ER_WEAPON_TYPES_KO[0];
const byTierSlot = (tier, slot, weaponType = '') => items.find((item) => Number(item.tier) === tier
  && item.equipSlot === slot && item.lockedByAdmin !== 'deleted'
  && (slot !== 'weapon' || item.weaponType === weaponType));
const hero = byTierSlot(4, 'weapon', selectedWeapon);
const legend = byTierSlot(5, 'head');
const transcend = byTierSlot(6, 'shoes');
assert.ok(hero && legend && transcend, 'fresh generated catalog must contain canonical tier/slot examples');
const goals = blankGoals();
goals.hero.weaponKey = hero._id; goals.legend.headKey = legend._id; goals.transcend.shoesKey = transcend._id;
const store = memoryStorage();
const rawProfile = skilllessProfile(actorId, { weaponType: selectedWeapon, goalLoadouts: goals });
assert.equal(saveGuestCharacterProfile(rawProfile, store).ok, true);
const parsedProfile = readGuestCharacterProfiles(store).profiles[0];
assert.equal(parsedProfile.weaponType, selectedWeapon);
assert.equal(getGuestEquipmentGoalErrors({ ...parsedProfile, erWeapons: [selectedWeapon] }, items).length, 0);

check('fresh profile → guest bootstrap → real initial roster → saved input/replay retains authored goals and explicit weapon', () => {
  const bootstrap = resolveSimulationBootstrapData({ guestMode: true, charList: baseRoster, guestProfiles: [parsedProfile],
    mapsList: [map], defaultSettings: getDefaultSimulationSettings() });
  const init = withSimulationRandom(createSeedRng('guest-goal-initialization'), () => buildInitialSimulationRoster({
    charList: bootstrap.charList, routeItems: items, initialMap: map, initialZoneIds: map.zones.map((zone) => zone.zoneId),
    loadedSettings: bootstrap.settingValue,
  }));
  const actor = init.candidateChars.find((row) => row._id === actorId);
  assert.equal(actor.weaponType, selectedWeapon); assert.equal(actor.runWeaponType, selectedWeapon);
  assert.deepEqual(actor.erWeapons, [selectedWeapon]); assert.deepEqual(actor.goalLoadouts, parsedProfile.goalLoadouts);
  const input = createSimulationRunInput({ survivors: init.shuffledChars, dead: [], killCounts: {}, assistCounts: {},
    activeMap: map, settings: bootstrap.settingValue, runSeed: 'goal-roundtrip', publicItems: items, kiosks: [], droneOffers: [] }, store);
  const replayActor = prepareSimulationRunInput(input).state.survivors.find((row) => row._id === actorId);
  assert.equal(replayActor.weaponType, selectedWeapon); assert.equal(replayActor.runWeaponType, selectedWeapon);
  assert.deepEqual(replayActor.goalLoadouts, parsedProfile.goalLoadouts);
  assert.equal(resolveSimulationBootstrapData({ guestMode: false, charList: baseRoster, guestProfiles: [parsedProfile] }).charList[0].goalLoadouts, undefined);
  const isolated = resolveSimulationBootstrapData({ guestMode: true, isolatedEvaluation: true, charList: baseRoster,
    guestProfiles: [parsedProfile], mapsList: [map], defaultSettings: getDefaultSimulationSettings() });
  assert.equal(isolated.charList[0].goalLoadouts, undefined);
  assert.equal(isolated.charList[0].weaponType, baseRoster[0].weaponType);
});

const isolationProbeStorage = { getItem: () => { throw Error('isolated catalog must not inspect local storage'); } };
const isolatedCatalog = await loadGuestSimulationItemCatalog({ includeLocal: false, storage: isolationProbeStorage });
assert.deepEqual(isolatedCatalog, items);
checks++;
console.log('PASS isolated local catalog skips local profiles and returns generated catalog only');

check('invalid or unprepared goal saves are atomic; valid pregame changes replan one actor without RNG, team/start/inventory/credits mutation', () => {
  const initial = withSimulationRandom(createSeedRng('goal-replan-start'), () => buildInitialSimulationRoster({
    charList: baseRoster, routeItems: items, initialMap: map, initialZoneIds: map.zones.map((zone) => zone.zoneId),
    loadedSettings: getDefaultSimulationSettings(),
  }));
  const actor = initial.candidateChars.find((row) => row._id === actorId);
  const live = { ...actor, teamId: 'team:8', inventory: [{ itemId: 'kept', qty: 2, tags: [] }], simCredits: 77,
    _growthPlan: { old: true }, _growthFocusId: 'old-focus', _growthFallbackTargets: { head: 'old' },
    _openingAcquiredItemIds: { head: 'old' }, _lateAcquiredItemIds: { legend: { head: 'old' } } };
  const unrelatedCandidate = baseRoster[1];
  const unrelatedSelected = { ...baseRoster[1], teamId: 'team:2' };
  let current = [live, unrelatedSelected], candidates = [live, unrelatedCandidate], updates = 0;
  const invalidStore = memoryStorage();
  const badGoals = blankGoals(); badGoals.legend.headKey = 'deleted-or-missing';
  const invalid = saveGuestCharacterBeforeMatch({ actorId, draft: skilllessProfile(actorId, { goalLoadouts: badGoals }), storage: invalidStore,
    state: { day: 0, matchSec: 0, candidateSurvivors: candidates, survivors: current, activeMap: map, publicItems: items },
    actions: { setSurvivors: () => updates++, setCandidateSurvivors: () => updates++ } });
  assert.equal(invalid.ok, false); assert.equal(invalidStore.values.has(GUEST_CHARACTER_PROFILE_KEY), false); assert.equal(updates, 0);
  const unprepared = memoryStorage();
  const noMap = saveGuestCharacterBeforeMatch({ actorId, draft: skilllessProfile(actorId, { goalLoadouts: goals }), storage: unprepared,
    state: { day: 0, matchSec: 0, candidateSurvivors: candidates, publicItems: items },
    actions: { setSurvivors: () => updates++ } });
  assert.equal(noMap.ok, false); assert.equal(unprepared.values.has(GUEST_CHARACTER_PROFILE_KEY), false);
  const quota = memoryStorage(null, true);
  const failedWrite = saveGuestCharacterBeforeMatch({ actorId, draft: skilllessProfile(actorId, { goalLoadouts: goals }), storage: quota,
    state: { day: 0, matchSec: 0, candidateSurvivors: candidates, activeMap: map, publicItems: items },
    actions: { setSurvivors: () => updates++ } });
  assert.equal(failedWrite.ok, false); assert.equal(updates, 0);
  const rng = createSeedRng('goal-edit-no-draw'); const before = rng.getState();
  const saved = withSimulationRandom(rng, () => saveGuestCharacterBeforeMatch({ actorId,
    draft: skilllessProfile(actorId, { weaponType: selectedWeapon, goalLoadouts: goals }), storage: memoryStorage(),
    state: { day: 0, matchSec: 0, candidateSurvivors: candidates, survivors: current, activeMap: map, publicItems: items },
    actions: { setCandidateSurvivors: (update) => { candidates = update(candidates); },
      setSurvivors: (update) => { current = update(current); } } }));
  assert.equal(saved.ok, true); assert.deepEqual(rng.getState(), before);
  for (const updated of [candidates[0], current[0]]) {
    assert.equal(updated.teamId, live.teamId); assert.equal(updated.zoneId, live.zoneId);
    assert.equal(updated.hp, live.hp); assert.equal(updated.maxHp, live.maxHp);
    assert.deepEqual(updated.inventory, live.inventory); assert.equal(updated.simCredits, live.simCredits);
    for (const key of ['_growthPlan', '_growthFocusId', '_growthFallbackTargets', '_openingAcquiredItemIds', '_lateAcquiredItemIds']) {
      assert.equal(Object.hasOwn(updated, key), false, `${key} must be invalidated after route changes.`);
    }
    assert.deepEqual(updated.goalLoadouts, goals); assert.equal(updated.runWeaponType, selectedWeapon);
  }
  assert.equal(candidates[1], unrelatedCandidate, 'An unrelated candidate retains object identity.');
  assert.equal(current[1], unrelatedSelected, 'An unrelated selected actor retains object identity.');
});

check('loaded v1 invalid catalog goals are preserved for diagnosis and cleared only by an explicit valid save', () => {
  const invalidGoals = blankGoals(); invalidGoals.transcend.shoesKey = 'removed-item-id';
  const saved = JSON.stringify({ schemaVersion: 1, profiles: [skilllessProfile(actorId, { goalLoadouts: invalidGoals })] });
  const store = memoryStorage(saved);
  const loaded = readGuestCharacterProfiles(store);
  assert.equal(loaded.ok, true); assert.equal(loaded.profiles[0].goalLoadouts.transcend.shoesKey, 'removed-item-id');
  assert.ok(getGuestEquipmentGoalErrors({ ...loaded.profiles[0], weaponType: selectedWeapon }, items).length);
  assert.equal(store.getItem(GUEST_CHARACTER_PROFILE_KEY), saved);
});

console.log(`PASS ${checks} guest equipment goal checks`);

if (runMatch) {
  const { runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
  const { getPhaseDurationSec, getRuleset } = await import('../src/utils/rulesets.js');
  const { getInvItemId, inferEquipSlot } = await import('../src/app/simulation/_lib/inventoryItemRules.js');
  const { areEquipmentWeaponTypesCompatible } = await import('../src/utils/equipmentCatalog.js');
  const builtin = await loadGuestSimulationItemCatalog({ includeLocal: false });
  const builtinBefore = JSON.stringify(builtin);
  const itemStorage = memoryStorage();
  const characterStorage = memoryStorage();
  const scrap = builtin.find((item) => item.name === '고철' && item.type === '재료');
  const branch = builtin.find((item) => item.name === '나뭇가지' && item.type === '재료');
  assert.ok(scrap && branch, 'The generated catalog must contain the two natural recipe leaves.');
  const weaponType = String(baseRoster[0].weaponType || '');
  assert.ok(ER_WEAPON_TYPES_KO.includes(weaponType), 'The selected roster actor must have a canonical ER weapon type.');
  const customWeapon = { _id: 'guest-item-goal-match-hero-weapon', name: '검증용 맞춤 영웅 무기', type: '무기',
    equipSlot: 'weapon', weaponType, tier: 4, stats: { attackPower: 1 },
    recipe: { ingredients: [{ itemId: scrap._id, qty: 1 }, { itemId: branch._id, qty: 1 }], resultQty: 1, creditsCost: 1 } };
  assert.equal(saveGuestItem(customWeapon, builtin, itemStorage).ok, true);
  const localItems = readGuestItems(builtin, itemStorage);
  assert.equal(localItems.ok, true);
  const mergedItems = mergeGuestItemCatalog(builtin, { storage: itemStorage });
  assert.deepEqual(readGuestItems(builtin, itemStorage).items, localItems.items);
  const mergedTarget = mergedItems.find((item) => item._id === customWeapon._id);
  assert.ok(mergedTarget);
  const matchGoals = blankGoals(); matchGoals.hero.weaponKey = customWeapon._id;
  const authoredProfile = skilllessProfile(baseRoster[0]._id, { weaponType, goalLoadouts: matchGoals });
  assert.equal(saveGuestCharacterProfile(authoredProfile, characterStorage).ok, true);
  const savedProfile = readGuestCharacterProfiles(characterStorage);
  assert.equal(savedProfile.ok, true);
  const boot = resolveSimulationBootstrapData({ guestMode: true, charList: baseRoster, guestProfiles: savedProfile.profiles,
    mapsList: [map], defaultSettings: getDefaultSimulationSettings() });
  const initial = withSimulationRandom(createSeedRng('guest-equipment-goal-match-initial-v1'), () => buildInitialSimulationRoster({
    charList: boot.charList, routeItems: mergedItems, initialMap: map, initialZoneIds: map.zones.map((zone) => zone.zoneId),
    loadedSettings: boot.settingValue,
  }));
  const matchInput = createSimulationRunInput({ survivors: initial.shuffledChars, dead: [], killCounts: {}, assistCounts: {},
    activeMap: map, settings: boot.settingValue, runSeed: 'guest-equipment-goal-match-seed-v1', publicItems: mergedItems,
    kiosks: [], droneOffers: [] }, itemStorage);
  assert.equal(matchInput.initialFrame.survivors.length, 24);
  const inputBeforeMatch = JSON.stringify(matchInput);
  assert.ok(matchInput.initialFrame.survivors.every((actor) => (actor.inventory || []).length === 0),
    'The match begins with ordinary empty inventories; custom equipment is not granted.');
  const goalActor = matchInput.initialFrame.survivors.find((actor) => actor._id === baseRoster[0]._id);
  assert.equal(goalActor.goalLoadouts.hero.weaponKey, customWeapon._id);
  assert.equal(goalActor.weaponType, weaponType); assert.equal(goalActor.simCredits, baseRoster[0].simCredits ?? 15);
  const inputSourceFacts = matchInput.initialFrame.survivors.map((actor) => ({ id: actor._id, hp: actor.hp, maxHp: actor.maxHp,
    teamId: actor.teamId, teamSlot: actor.teamSlot, zoneId: actor.zoneId, simCredits: actor.simCredits,
    inventory: actor.inventory, goalLoadouts: actor.goalLoadouts, weaponType: actor.weaponType }));
  let firstNightFrame = null;
  let firstEquippedFrame = null;
  let craftActionFrame = null;
  const actual = await runRandomIsolationMatch(null, { savedInput: matchInput, onFrame(frame, { events = [] } = {}) {
    if (frame.day === 1 && frame.phase === 'night' && !firstNightFrame) firstNightFrame = frame;
    const actor = [...frame.survivors, ...frame.dead].find((row) => row._id === goalActor._id);
    if (!actor) return;
    const hasPositiveGoalInventory = (actor.inventory || []).some((entry) => getInvItemId(entry) === customWeapon._id
      && Number(entry.qty ?? 1) > 0);
    if (!firstEquippedFrame && hasPositiveGoalInventory && actor.equipped?.weapon === customWeapon._id) {
      firstEquippedFrame = { matchSec: frame.matchSec, day: frame.day, phase: frame.phase,
        alive: frame.survivors.some((row) => row._id === goalActor._id), weaponType: actor.weaponType };
    }
    const sameActionReceipt = events.find((event) => event.kind === 'craft' && event.who === goalActor._id
      && event.itemId === customWeapon._id && Number(event.at?.sec) === Number(frame.matchSec));
    if (!craftActionFrame && sameActionReceipt && Number(actor.simCredits) === Number(sameActionReceipt.afterCredits)) {
      craftActionFrame = { matchSec: frame.matchSec, credits: actor.simCredits, receipt: sameActionReceipt };
    }
  } });
  assert.ok(actual.evidence.ending, 'The only requested match case must reach its natural ending.');
  assert.equal(JSON.stringify(matchInput), inputBeforeMatch, 'The actual match cannot mutate saved input.');
  assert.equal(JSON.stringify(builtin), builtinBefore, 'Adding local equipment must not edit the generated catalog.');
  assert.ok(firstNightFrame, 'Capture the actual day 1 night from production frames.');
  const targetReceiptRows = actual.events.filter((event) => event.kind === 'craft' && event.who === goalActor._id
    && event.itemId === customWeapon._id);
  assert.equal(targetReceiptRows.length, 1, 'The profile-authored custom weapon must produce exactly one real craft receipt.');
  const receipt = targetReceiptRows[0];
  assert.equal(receipt.receiptVersion, 1); assert.equal(receipt.paidCost, 1);
  assert.equal(receipt.beforeCredits - receipt.afterCredits, 1);
  assert.deepEqual(receipt.consumed, customWeapon.recipe.ingredients);
  assert.ok(firstEquippedFrame, 'The goal actor must produce a published first frame with the crafted item equipped and positively owned.');
  assert.ok(craftActionFrame, 'The craft receipt and resulting credit balance must appear together in a published action frame.');
  const ruleset = getRuleset(matchInput.settings?.rulesetId, matchInput.settings?.simulationRuleset);
  const firstNightDeadline = getPhaseDurationSec(ruleset, 1, 'morning') + getPhaseDurationSec(ruleset, 1, 'night');
  assert.ok(Number.isFinite(firstNightDeadline), 'The production first-night deadline must be derivable from its ruleset phase start and duration.');
  assert.ok(firstEquippedFrame.matchSec <= firstNightDeadline, 'The first actual equipped-and-owned frame must occur by the production first-night deadline.');
  assert.ok(Number(receipt.at?.sec) <= firstEquippedFrame.matchSec, 'The actual craft receipt must precede the first equipped-and-owned frame.');
  const equipped = mergedItems.find((item) => item._id === customWeapon._id);
  assert.ok(inferEquipSlot(equipped) === 'weapon'
    && areEquipmentWeaponTypesCompatible(firstEquippedFrame.weaponType, equipped.weaponType));
  const terminalActors = [...actual.finalFrame.survivors, ...actual.finalFrame.dead];
  assert.equal(terminalActors.length, 24);
  assert.deepEqual(inputSourceFacts, matchInput.initialFrame.survivors.map((actor) => ({ id: actor._id, hp: actor.hp,
    maxHp: actor.maxHp, teamId: actor.teamId, teamSlot: actor.teamSlot, zoneId: actor.zoneId, simCredits: actor.simCredits,
    inventory: actor.inventory, goalLoadouts: actor.goalLoadouts, weaponType: actor.weaponType })));
  const clearGoals = blankGoals();
  assert.equal(saveGuestCharacterProfile(skilllessProfile(baseRoster[0]._id, { goalLoadouts: clearGoals }), characterStorage).ok, true);
  assert.equal(Object.hasOwn(readGuestCharacterProfiles(characterStorage).profiles[0], 'weaponType'), false);
  assert.equal(JSON.stringify(matchInput), inputBeforeMatch, 'Clearing the live local profile cannot rewrite captured replay input.');
  const replay = await runRandomIsolationMatch(null, { savedInput: matchInput });
  assert.deepEqual(replay.evidence, actual.evidence, 'Replay from exact saved input must match events, frames, RNG and ending digests.');
  assert.deepEqual(replay.events, actual.events);
  assert.deepEqual(replay.finalFrame, actual.finalFrame);
  assert.deepEqual(replay.logs, actual.logs, 'Replay logs must match exactly.');
  assert.deepEqual(replay.evidence.random, actual.evidence.random, 'Replay final RNG state must match exactly.');
  const terminalDead = actual.finalFrame.dead.length;
  const terminalAlive = actual.finalFrame.survivors.length;
  const sha256 = (value) => createHash('sha256').update(value).digest('hex');
  console.log(`GUEST_EQUIPMENT_GOAL_MATCH ${JSON.stringify({ seed: matchInput.runSeed, initialRosterSeed: 'guest-equipment-goal-match-initial-v1',
    engineVersion: matchInput.engineVersion, participants: 24, phases: actual.evidence.phases, frames: actual.evidence.frames,
    matchSec: actual.evidence.ticks, events: actual.evidence.eventCount, logs: actual.logs.length,
    inputSha256: sha256(inputBeforeMatch), protectedAxesSha256: sha256(JSON.stringify(inputSourceFacts)),
    firstNightDeadlineSec: firstNightDeadline, firstEquippedAt: firstEquippedFrame,
    craftActionFrame, craftedTarget: receipt.itemId,
    receipt: { paidCost: receipt.paidCost, consumed: receipt.consumed, beforeCredits: receipt.beforeCredits,
      afterCredits: receipt.afterCredits }, equippedByFirstNight: equipped._id, ending: actual.evidence.ending,
    terminal: { denominator: 24, alive: terminalAlive, dead: terminalDead },
    everActuallyEquipped: true,
    replayExact: { inputUnchangedAfterProfileClear: true, events: true, logs: true, fullFrames: actual.evidence.frameDigest,
      finalFrame: true, randomState: true, ending: true }, profileClearedAfterCapture: true })}`);
}
