import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { buildActorGrowthPlan, getGrowthRecipeWork, refreshActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { initializeActorPhaseMovementState } = await import('../src/app/simulation/_lib/actorMovementDecisionHelpers.js');
const { chooseTeamResourceMove } = await import('../src/app/simulation/_lib/teamResourceGoalRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

const ids = {
  hatchet: 'fixture-handaxe',
  mithril: 'fixture-mithril',
  graphite: 'fixture-graphite',
  resin: 'fixture-resin',
  weapon5: 'fixture-weapon-t5',
  head4: 'fixture-head-t4',
  clothes4: 'fixture-clothes-t4',
  arm4: 'fixture-arm-t4',
  shoes4: 'fixture-shoes-t4',
  axe6: 'fixture-half-god-axe',
  veil6: 'fixture-black-veil',
};

const material = (id, name, spawnZones, extra = {}) => ({
  _id: id, itemKey: `${id}-key`, name, type: '재료', category: 'material', tier: 1,
  spawnZones, recipe: { ingredients: [] }, ...extra,
});
const gear = (id, name, equipSlot, tier, recipe, extra = {}) => ({
  _id: id, itemKey: `${id}-key`, name, type: equipSlot === 'weapon' ? '무기' : '방어구',
  category: 'equipment', equipSlot, tier, stats: {}, recipe, ...extra,
});

const catalog = [
  material(ids.hatchet, '손도끼', ['firestation'], { type: '무기', category: 'equipment', equipSlot: 'weapon', tier: 1, weaponType: '도끼' }),
  material(ids.mithril, '미스릴', ['rift'], { tier: 3 }),
  material(ids.graphite, '흑연', ['park']),
  material(ids.resin, '수지', ['park']),
  gear(ids.weapon5, '기존 고급 도끼', 'weapon', 5, { ingredients: [] }, { weaponType: '도끼' }),
  gear(ids.head4, '기존 머리 장비', 'head', 4, { ingredients: [] }),
  gear(ids.clothes4, '기존 옷', 'clothes', 4, { ingredients: [] }),
  gear(ids.arm4, '기존 팔 장비', 'arm', 4, { ingredients: [] }),
  gear(ids.shoes4, '기존 신발', 'shoes', 4, { ingredients: [] }),
  gear(ids.axe6, '반고부', 'weapon', 6, { ingredients: [
    { itemId: ids.hatchet, qty: 1 }, { itemId: ids.mithril, qty: 1 },
  ], creditsCost: 2 }, { weaponType: '도끼' }),
  gear(ids.veil6, '검은 베일', 'head', 6, { ingredients: [
    { itemId: ids.graphite, qty: 1 }, { itemId: ids.resin, qty: 1 },
  ], creditsCost: 2 }),
];

const makeWorld = ({ mithril = 1, graphite = 2, resin = 2 } = {}) => ({
  mapObj: { _id: 'late-focus-fixture-map', zones: ['park', 'firestation', 'rift'].map((zoneId) => ({ zoneId, name: zoneId })) },
  zoneGraph: { park: ['firestation'], firestation: ['park', 'rift'], rift: ['firestation'] },
  forbiddenIds: new Set(),
  ruleset: { inventory: { maxSlots: 20, stackMax: { material: 3, consumable: 6, equipment: 1 } } },
  nextSpawn: { fieldResources: {
    version: 1,
    mapId: 'late-focus-fixture-map',
    byZone: {
      firestation: { [ids.hatchet]: { initial: 2, remaining: 2, taken: 0 } },
      rift: { [ids.mithril]: { initial: mithril, remaining: mithril, taken: 0 } },
      park: {
        [ids.graphite]: { initial: graphite, remaining: graphite, taken: 0 },
        [ids.resin]: { initial: resin, remaining: resin, taken: 0 },
      },
    },
  } },
});

const makeActor = ({ rareInventory = false, focus = ids.axe6, weaponType = '도끼', authoredAxe = true } = {}) => {
  const inventory = [
    { ...structuredClone(catalog.find((item) => item._id === ids.weapon5)), itemId: ids.weapon5, qty: 1 },
    { ...structuredClone(catalog.find((item) => item._id === ids.head4)), itemId: ids.head4, qty: 1 },
    { ...structuredClone(catalog.find((item) => item._id === ids.clothes4)), itemId: ids.clothes4, qty: 1 },
    { ...structuredClone(catalog.find((item) => item._id === ids.arm4)), itemId: ids.arm4, qty: 1 },
    { ...structuredClone(catalog.find((item) => item._id === ids.shoes4)), itemId: ids.shoes4, qty: 1 },
    { ...structuredClone(catalog.find((item) => item._id === ids.hatchet)), itemId: ids.hatchet, qty: 1,
      craftComponent: true, goalItem: true, _growthReserved: true, tags: ['growth_goal'] },
  ];
  if (rareInventory) inventory.push({ ...structuredClone(catalog.find((item) => item._id === ids.mithril)), itemId: ids.mithril, qty: 1 });
  const goalLoadouts = { hero: {}, legend: {}, transcend: {} };
  if (authoredAxe) goalLoadouts.transcend.weaponKey = `${ids.axe6}-key`;
  return {
    _id: 'fixture-actor', name: 'late focus fixture', teamId: 'fixture-team', hp: 100, maxHp: 100,
    zoneId: 'park', weaponType, simCredits: 50,
    inventory,
    equipped: { weapon: ids.weapon5, head: ids.head4, clothes: ids.clothes4, arm: ids.arm4, shoes: ids.shoes4 },
    goalLoadouts,
    _growthFocusId: focus,
    _growthPlan: { targetId: focus, targetSlot: 'weapon', targetTier: 6, stage: 'late',
      openingComplete: true, missing: [{ itemId: ids.mithril, name: '미스릴', need: 1, have: 0 }],
      componentIds: [ids.hatchet], reservedQtyById: { [ids.hatchet]: 1 }, blocked: '' },
  };
};

const makeInitialValidLateFocus = () => {
  const world = makeWorld({ mithril: 1 });
  const actor = makeActor();
  const plan = refreshActorGrowthPlan(actor, catalog, { ...world, nextSpawn: world.nextSpawn });
  assert.equal(plan.targetId, ids.axe6, 'fixture sanity: authored axe is initially a valid late focus');
  assert.equal(plan.blocked, '');
  assert.ok(plan.componentIds.includes(ids.hatchet));
  return { actor, world };
};

const checks = [];
const check = (name, fn) => {
  try {
    fn();
    checks.push({ name, error: null });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, error });
    console.error(`FAIL ${name}: ${error.message}`);
  }
};

check('rare-only wait preserves the valid late focus component through the next movement normalization', () => {
  const { actor, world } = makeInitialValidLateFocus();
  world.nextSpawn.fieldResources.byZone.rift[ids.mithril].remaining = 0;

  // Team planning reads an isolated roster copy before the execution actor is normalized.
  const planningActor = structuredClone(actor);
  const planningPlan = refreshActorGrowthPlan(planningActor, catalog, world);
  assert.equal(planningPlan.targetId, ids.axe6, 'a no-material-source rare-only wait keeps its active late focus');
  assert.equal(planningPlan.blocked, 'no_material_source');
  assert.equal(planningActor.inventory.find((item) => item.itemId === ids.hatchet)?.craftComponent, true);

  // The real execution boundary normalizes first, then refreshes the same actor.
  initializeActorPhaseMovementState(actor, { ruleset: world.ruleset });
  assert.ok(actor.inventory.some((item) => item.itemId === ids.hatchet), 'held component survives normalization');
  const executionPlan = refreshActorGrowthPlan(actor, catalog, world);
  assert.equal(executionPlan.targetId, ids.axe6);
  initializeActorPhaseMovementState(actor, { ruleset: world.ruleset });
  assert.ok(actor.inventory.some((item) => item.itemId === ids.hatchet), 'a second boundary does not discard the held component');
  const nextPlan = refreshActorGrowthPlan(actor, catalog, world);
  assert.equal(nextPlan.targetId, ids.axe6);
  assert.equal(nextPlan.missing.some((row) => row.itemId === ids.hatchet), false, 'the actor must not re-farm the acquired handaxe');
  assert.equal(nextPlan.blocked, 'no_material_source');
});

check('a genuinely ready alternative can proceed while a rare-only focus waits', () => {
  const { actor, world } = makeInitialValidLateFocus();
  world.nextSpawn.fieldResources.byZone.rift[ids.mithril].remaining = 0;
  actor.inventory.push({ ...structuredClone(catalog.find((item) => item._id === ids.graphite)), itemId: ids.graphite, qty: 1 });
  actor.inventory.push({ ...structuredClone(catalog.find((item) => item._id === ids.resin)), itemId: ids.resin, qty: 1 });
  const plan = refreshActorGrowthPlan(actor, catalog, world);
  assert.equal(plan.targetId, ids.veil6);
  assert.equal(plan.readyCraftId, ids.veil6, 'ready craft is allowed to supersede a waiting focus');
});

check('a directly ready but partially receivable alternative cannot replace the rare wait or consume anything', () => {
  const batchCatalog = structuredClone(catalog);
  batchCatalog.find(item => item._id === ids.veil6).recipe.resultQty = 2;
  const actor = makeActor();
  const world = makeWorld({ mithril: 0 });
  actor.inventory.push({ ...structuredClone(catalog.find(item => item._id === ids.graphite)), itemId: ids.graphite, qty: 1 });
  actor.inventory.push({ ...structuredClone(catalog.find(item => item._id === ids.resin)), itemId: ids.resin, qty: 1 });
  const before = structuredClone({ credits: actor.simCredits, equipped: actor.equipped,
    quantities: actor.inventory.map(item => [item.itemId, item.qty]) });
  const plan = refreshActorGrowthPlan(actor, batchCatalog, world);
  assert.equal(plan.targetId, ids.axe6);
  assert.equal(plan.blocked, 'no_material_source');
  assert.deepEqual({ credits: actor.simCredits, equipped: actor.equipped,
    quantities: actor.inventory.map(item => [item.itemId, item.qty]) }, before);
});

check('a rare wait does not route unready alternatives that cannot yield a ready final craft', () => {
  const routedCatalog = structuredClone(catalog);
  const actor = makeActor();
  const world = makeWorld();
  assert.equal(refreshActorGrowthPlan(actor, routedCatalog, world).targetId, ids.axe6);
  world.nextSpawn.fieldResources.byZone.rift[ids.mithril].remaining = 0;
  let unusedSourceReads = 0;
  Object.defineProperty(routedCatalog.find(item => item._id === ids.graphite), 'spawnZones', {
    configurable: true, enumerable: true,
    get() { unusedSourceReads += 1; return ['park']; },
  });
  const plan = refreshActorGrowthPlan(actor, routedCatalog, world);
  assert.equal(plan.targetId, ids.axe6);
  assert.equal(plan.blocked, 'no_material_source');
  assert.equal(unusedSourceReads, 0, 'unowned final inputs cannot justify full field-source/path planning while the focus waits');
  assert.equal(actor.inventory.find(item => item.itemId === ids.hatchet).craftComponent, true);
});

check('real basic-gear recovery keeps priority over a rare-wait focus without granting gear', () => {
  const recoveryId = 'fixture-recovery-head';
  const recoveryCatalog = [...structuredClone(catalog),
    gear(recoveryId, '실제 복구 모자', 'head', 2, { ingredients: [
      { itemId: ids.graphite, qty: 1 },
    ], creditsCost: 2 }),
  ];
  const actor = makeActor();
  actor.inventory = actor.inventory.filter(item => item.itemId !== ids.head4);
  delete actor.equipped.head;
  const world = makeWorld({ mithril: 0 });
  const before = structuredClone({ credits: actor.simCredits, equipped: actor.equipped,
    quantities: actor.inventory.map(item => [item.itemId, item.qty]), world });
  const plan = refreshActorGrowthPlan(actor, recoveryCatalog, world);
  assert.equal(plan.targetId, recoveryId);
  assert.equal(plan.stage, 'recovery');
  assert.equal(plan.blocked, '');
  assert.ok(plan.currentZoneItemIds.includes(ids.graphite), 'recovery uses a real stocked material in the current zone');
  assert.deepEqual({ credits: actor.simCredits, equipped: actor.equipped,
    quantities: actor.inventory.map(item => [item.itemId, item.qty]), world }, before);
  assert.equal(actor.inventory.some(item => item.itemId === recoveryId), false);
});

check('blocked automatic lower-tier candidates do not discard a started rare-wait equipment component', () => {
  const coreId = 'fixture-unavailable-force-core';
  const automaticCatalog = [...structuredClone(catalog), material(coreId, '포스 코어', []),
    gear('fixture-automatic-legend-head', '자동 전설 모자', 'head', 5, { ingredients: [
      { itemId: ids.head4, qty: 1 }, { itemId: coreId, qty: 1 },
    ], creditsCost: 2 }),
  ];
  const actor = makeActor({ authoredAxe: false });
  const world = makeWorld();
  const initial = refreshActorGrowthPlan(actor, automaticCatalog, world);
  assert.equal(initial.targetId, ids.axe6, 'a blocked automatic legend precedes the initially viable axe');
  assert.equal(initial.blocked, '');
  world.nextSpawn.fieldResources.byZone.rift[ids.mithril].remaining = 0;
  const waiting = refreshActorGrowthPlan(actor, automaticCatalog, world);
  assert.equal(waiting.targetId, ids.axe6);
  assert.equal(waiting.blocked, 'no_material_source');
  initializeActorPhaseMovementState(actor, { ruleset: world.ruleset });
  assert.ok(actor.inventory.some(item => item.itemId === ids.hatchet));
  assert.equal(refreshActorGrowthPlan(actor, automaticCatalog, world).missing.some(row => row.itemId === ids.hatchet), false);
});

check('a newly authored viable goal still outranks the previous automatic focus', () => {
  const world = makeWorld();
  const actor = makeActor({ authoredAxe: false, focus: ids.veil6 });
  actor.goalLoadouts.transcend.weaponKey = `${ids.axe6}-key`;
  const plan = refreshActorGrowthPlan(actor, catalog, world);
  assert.equal(plan.targetId, ids.axe6);
});

check('deleted authored goals are not resurrected from stale focus memory', () => {
  const world = makeWorld();
  const actor = makeActor({ focus: 'deleted-weapon-id' });
  actor.goalLoadouts.transcend.weaponKey = 'deleted-weapon-key';
  const plan = refreshActorGrowthPlan(actor, catalog, world);
  assert.notEqual(plan?.targetId, 'deleted-weapon-id');
  assert.notEqual(plan?.targetId, 'deleted-weapon-key');
  assert.ok(plan.goalIssues.some((row) => row.reason === 'invalid_target'));
});

check('a weapon-incompatible authored goal does not block a compatible alternative', () => {
  const world = makeWorld();
  const actor = makeActor({ weaponType: '권총' });
  const plan = refreshActorGrowthPlan(actor, catalog, world);
  assert.notEqual(plan?.targetId, ids.axe6);
  assert.equal(plan?.targetId, ids.veil6);
  assert.ok(plan.goalIssues.some((row) => row.reason === 'invalid_target'));
});

check('ordinary-material exhaustion retains the existing replanning behavior', () => {
  const ordinaryCatalog = catalog.map((source) => { const item = structuredClone(source); return item._id === ids.mithril
    ? { ...item, _id: 'fixture-ordinary-powder', itemKey: 'fixture-ordinary-powder-key', name: '일반 가루', spawnZones: ['rift'] }
    : item; });
  const world = makeWorld();
  world.nextSpawn.fieldResources.byZone.rift['fixture-ordinary-powder'] = { initial: 1, remaining: 0, taken: 1 };
  const actor = makeActor();
  actor.inventory.find((item) => item.itemId === ids.hatchet).craftComponent = true;
  const axe = ordinaryCatalog.find((item) => item._id === ids.axe6);
  axe.recipe = { ingredients: [{ itemId: ids.hatchet, qty: 1 }, { itemId: 'fixture-ordinary-powder', qty: 1 }], creditsCost: 2 };
  const plan = refreshActorGrowthPlan(actor, ordinaryCatalog, world);
  assert.equal(plan.targetId, ids.veil6, 'non-special ordinary depletion still falls through to the viable alternative');
  assert.equal(actor.inventory.find((item) => item.itemId === ids.hatchet)?.craftComponent, false);
});

check('credit failure remains eligible for ordinary fallback instead of rare-focus waiting', () => {
  const world = makeWorld();
  const actor = makeActor({ rareInventory: true });
  actor.simCredits = 0;
  const plan = refreshActorGrowthPlan(actor, catalog, world);
  assert.equal(plan.targetId, ids.veil6);
  assert.notEqual(plan.blocked, 'no_material_source');
});

check('a forbidden rare-source route remains blocked rather than borrowing a wait exception', () => {
  const { actor, world } = makeInitialValidLateFocus();
  world.forbiddenIds.add('rift');
  const plan = refreshActorGrowthPlan(actor, catalog, world);
  assert.equal(plan.targetId, ids.veil6);
});

check('a disconnected stocked rare source retains no-safe-path replanning', () => {
  const { actor, world } = makeInitialValidLateFocus();
  world.zoneGraph = { park: ['firestation'], firestation: ['park'], rift: [] };
  const blocked = buildActorGrowthPlan(actor, catalog, { ...world, attemptedTargets: [ids.veil6] });
  assert.equal(blocked.targetId, ids.axe6);
  assert.equal(blocked.blocked, 'no_safe_path', 'the fixture must exercise an actual disconnected source');
  const plan = refreshActorGrowthPlan(actor, catalog, world);
  assert.equal(plan.targetId, ids.veil6);
});

check('a partially receivable output batch retains inventory-full replanning without spending inputs', () => {
  const batchCatalog = structuredClone(catalog);
  batchCatalog.find(item => item._id === ids.axe6).recipe.resultQty = 2;
  const actor = makeActor({ rareInventory: true });
  const world = makeWorld();
  const before = structuredClone(actor);
  const work = getGrowthRecipeWork(actor, batchCatalog, ids.axe6, { ruleset: world.ruleset });
  assert.equal(work.blocked, 'inventory_full', 'the whole two-item output must fit, not just one item');
  assert.equal(work.readyCraftId, '');
  assert.deepEqual(actor, before, 'capacity accounting must not consume or receive anything');
  const plan = refreshActorGrowthPlan(actor, batchCatalog, world);
  assert.equal(plan.targetId, ids.veil6);
  assert.deepEqual(actor.inventory.map(item => [item.itemId, item.qty]), before.inventory.map(item => [item.itemId, item.qty]));
  assert.equal(actor.simCredits, before.simCredits);
});

check('worn base gear cannot promote a stale transcend focus over an earlier blocked authored legend goal', () => {
  const legendId = 'fixture-ordinary-legend-head';
  const transcendId = 'fixture-rare-transcend-head';
  // Limit this boundary fixture to the two head recipes. An independently
  // farmable automatic weapon upgrade must retain its existing fallback.
  const wornCatalog = [...structuredClone(catalog.filter(item => ![ids.axe6, ids.veil6].includes(item._id))),
    gear(legendId, '일반 전설 모자', 'head', 5, { ingredients: [
      { itemId: ids.head4, qty: 1 }, { itemId: ids.graphite, qty: 1 },
    ], creditsCost: 2 }),
    gear(transcendId, '희귀 초월 모자', 'head', 6, { ingredients: [
      { itemId: ids.head4, qty: 1 }, { itemId: ids.mithril, qty: 1 },
    ], creditsCost: 2 }),
  ];
  const actor = makeActor({ authoredAxe: false, focus: transcendId });
  actor.inventory = actor.inventory.filter(item => item.itemId !== ids.hatchet);
  actor.goalLoadouts = { hero: {}, legend: { headKey: `${legendId}-key` },
    transcend: { headKey: `${transcendId}-key` } };
  const world = makeWorld({ mithril: 0, graphite: 0, resin: 0 });
  const plan = refreshActorGrowthPlan(actor, wornCatalog, world);
  assert.equal(plan.targetId, legendId);
  assert.equal(plan.blocked, 'no_material_source');
  assert.equal(actor.inventory.find(item => item.itemId === ids.head4).craftComponent, false);
  assert.equal(actor.equipped.head, ids.head4);
});

check('a focus without any secured recipe input cannot borrow the rare-wait exception', () => {
  const onlyRareCatalog = structuredClone(catalog);
  const axe = onlyRareCatalog.find(item => item._id === ids.axe6);
  axe.recipe = { ingredients: [{ itemId: ids.mithril, qty: 1 }], creditsCost: 2 };
  const actor = makeActor();
  actor.inventory = actor.inventory.filter(item => item.itemId !== ids.hatchet);
  const plan = refreshActorGrowthPlan(actor, onlyRareCatalog, makeWorld({ mithril: 0 }));
  assert.equal(plan.targetId, ids.veil6);
});

check('a later rare-wait focus cannot take an earlier authored legend recipe boss-material claim', () => {
  const legendId = 'fixture-earlier-legend-head';
  const rankedCatalog = [...structuredClone(catalog),
    gear(legendId, '우선 전설 모자', 'head', 5, { ingredients: [
      { itemId: ids.head4, qty: 1 }, { itemId: ids.mithril, qty: 1 },
    ], creditsCost: 2 }),
  ];
  const actor = makeActor();
  actor.goalLoadouts.legend.headKey = `${legendId}-key`;
  const world = makeWorld({ mithril: 0, graphite: 0, resin: 0 });
  const plan = refreshActorGrowthPlan(actor, rankedCatalog, world);
  const ruleset = { ...getRuleset('ER_S11'), inventory: world.ruleset.inventory };
  const goal = withSimulationRandom(() => { throw Error('Resource planning must not draw RNG.'); }, () => chooseTeamResourceMove({
    members: [actor, { _id: 'fixture-ally', teamId: actor.teamId, hp: 100, maxHp: 100, inventory: [] }],
    publicItems: rankedCatalog, ruleset,
    spawnState: { coreNodes: [], bosses: { alpha: { alive: true, zoneId: 'rift', spawnedDay: 2, spawnedPhase: 'morning' } } },
    routeForZone: () => ({ distance: 2, nextStep: 'firestation' }),
  }));
  assert.equal(goal?.beneficiary.targetItemId, legendId, 'the shared boss-material tie must retain authored rank');
  assert.equal(plan.targetId, legendId);
  assert.equal(plan.blocked, 'no_material_source');
});

check('a rare wait changes only planning markers, never possessions, payment or field stock', () => {
  const { actor, world } = makeInitialValidLateFocus();
  world.nextSpawn.fieldResources.byZone.rift[ids.mithril].remaining = 0;
  const before = structuredClone({ equipped: actor.equipped, credits: actor.simCredits, world,
    quantities: actor.inventory.map(item => [item.itemId, item.qty]) });
  const plan = refreshActorGrowthPlan(actor, catalog, world);
  assert.equal(plan.targetId, ids.axe6);
  assert.deepEqual({ equipped: actor.equipped, credits: actor.simCredits, world,
    quantities: actor.inventory.map(item => [item.itemId, item.qty]) }, before);
  assert.equal(actor.inventory.some(item => item.itemId === ids.axe6), false);
});

const failed = checks.filter((row) => row.error);
console.log(`RESULT late-growth-focus: ${checks.length - failed.length}/${checks.length} groups passed`);
if (failed.length) {
  console.error(`First failing group: ${failed[0].name}`);
  process.exitCode = 1;
}
