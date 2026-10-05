import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { cloneMovementRosterForPlanning, runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { buildActorGrowthPlan, refreshActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getLateGrowthTargets } = await import('../src/app/simulation/_lib/lateGrowthTargetRuntime.js');
const { getActorEquipmentTier } = await import('../src/app/simulation/_lib/growthEquipmentRuntime.js');
const { getCraftRecipeTerms } = await import('../src/app/simulation/_lib/gearRecipeGuardRuntime.js');
const { areEquipmentWeaponTypesCompatible, normalizeWeaponType } = await import('../src/utils/equipmentCatalog.js');
const { getActorDimensionRiftId } = await import('../src/app/simulation/_lib/dimensionRiftSpaceRuntime.js');
const { appendSimulationLog } = await import('../src/app/simulation/_lib/logActionRuntime.js');
const { ensureEquipped } = await import('../src/app/simulation/_lib/survivorRuntime.js');
const { getInvItemId, inferEquipSlot, inferItemCategory, invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { EQUIP_SLOTS } = await import('../src/app/simulation/_lib/simulationConstants.js');
const { ER_STAT_FIELDS, ER_STAT_KEYS, DEFAULT_ER_STATS, normalizeErStats } = await import('../src/utils/erStats.js');
const { itemDisplayName, safeTags } = await import('../src/app/simulation/_lib/simulationCommon.js');

let checks = 0;
const check = (name, run) => {
  run();
  checks += 1;
  console.log(`PASS ${name}`);
};

check('the action pipeline treats a malformed roster as an empty boundary', () => {
  const result = runPhaseActorActionPipeline({ state: { phaseSurvivors: null } });
  assert.deepEqual(result, { newlyDead: [], pendingPickAssigned: false, updatedSurvivors: [] });
});

const source = [
  {
    _id: 'planner-1',
    hp: 100,
    zoneId: 'a',
    inventory: [{ itemId: 'fiber', qty: 1, tags: ['route_goal'], metadata: { source: 'field' } }],
    activeEffects: [{ name: 'read-only-status', remainingDuration: 5 }],
    _spatial: { x: 1, y: 2 },
  },
  {
    _id: 'rift-1',
    hp: 100,
    zoneId: 'a',
    _combatSpaceId: 'dimension_rift:r1',
    _dimensionRiftEntry: { riftId: 'r1', enteredAtSec: 10 },
    inventory: [],
  },
];

check('planning roster keeps legacy output while isolating planner-owned fields', () => {
  const legacy = structuredClone(source.filter((actor) => !getActorDimensionRiftId(actor)));
  legacy.forEach((actor) => refreshActorGrowthPlan(actor, [], {}));

  const optimized = cloneMovementRosterForPlanning(source);
  optimized.forEach((actor) => refreshActorGrowthPlan(actor, [], {}));

  assert.deepEqual(optimized, legacy);
  assert.equal(optimized.length, 1, 'dimension-rift actors stay out of world movement planning');
  assert.notEqual(optimized[0], source[0]);
  assert.notEqual(optimized[0].inventory, source[0].inventory);
  assert.notEqual(optimized[0].inventory[0].metadata, source[0].inventory[0].metadata);
  assert.equal(optimized[0].activeEffects, source[0].activeEffects, 'read-only status state is not deep-cloned');
  optimized[0].inventory[0].metadata.source = 'planner-only';
  assert.equal(source[0].inventory[0].metadata.source, 'field');
});

check('full log refs append in place without changing order or contents', () => {
  const refs = { fullLogsRef: { current: [] }, fullLogEntriesRef: { current: [] }, logSeqRef: { current: 0 } };
  const fullLogs = refs.fullLogsRef.current;
  const fullEntries = refs.fullLogEntriesRef.current;
  const updates = [];
  for (let index = 0; index < 2000; index += 1) {
    appendSimulationLog({ text: `line-${index}`, type: 'system', refs, actions: { setLogs: (update) => updates.push(update) } });
  }
  assert.equal(refs.fullLogsRef.current, fullLogs);
  assert.equal(refs.fullLogEntriesRef.current, fullEntries);
  assert.equal(refs.fullLogsRef.current.length, 2000);
  assert.equal(refs.fullLogEntriesRef.current[1999].text, 'line-1999');
  assert.equal(updates.length, 2000, 'visible React updaters remain one per log');
});

check('visible log enqueue preserves one immutable entry per event', () => {
  const refs = { fullLogsRef: { current: [] }, fullLogEntriesRef: { current: [] }, logSeqRef: { current: 0 } };
  const visible = [];
  appendSimulationLog({ text: 'queued', type: 'highlight', refs, actions: {
    enqueueVisibleLog: (entry) => visible.push(entry),
  } });
  assert.deepEqual(visible, [{ text: 'queued', type: 'highlight', id: 'log-1' }]);
});

function legacyEnsureEquipped(actor) {
  const inventory = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const equipped = Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot,
    actor?.equipped && typeof actor.equipped === 'object' ? actor.equipped[slot] ?? null : null]));
  const tier = (entry) => Number.isFinite(Number(entry?.tier ?? entry?.t ?? 1))
    ? Math.max(1, Math.min(6, Math.floor(Number(entry?.tier ?? entry?.t ?? 1)))) : 1;
  for (const slot of EQUIP_SLOTS) {
    const id = String(equipped[slot] || '');
    const current = id ? inventory.find((entry) => String(getInvItemId(entry)) === id) : null;
    const candidates = inventory.filter((entry) => String(entry?.equipSlot || inferEquipSlot(entry) || '').toLowerCase() === slot);
    candidates.sort((left, right) => (tier(right) - tier(left))
      || (Number(right?.acquiredDay ?? 0) - Number(left?.acquiredDay ?? 0)));
    const best = candidates[0];
    equipped[slot] = best && (!current || tier(best) > tier(current))
      ? String(getInvItemId(best)) : current ? String(getInvItemId(current)) : null;
  }
  return equipped;
}

check('one inventory classification pass retains equipment selection and input ownership', () => {
  const values = [undefined, null, 0, 1, 3, 6, '4', -2, NaN, Infinity];
  for (let index = 0; index < 300; index += 1) {
    const inventory = [
      ...EQUIP_SLOTS.flatMap((slot, position) => [
        { itemId: slot, equipSlot: slot.toUpperCase(), tier: values[(index + position) % values.length], acquiredDay: index % 4 },
        { itemId: `${slot}-next`, tags: [slot], tier: values[(index * 3 + position) % values.length], acquiredDay: values[index % values.length] },
      ]),
      { itemId: 'weapon', equipSlot: 'weapon', tier: 6 }, // First matching duplicate ID still wins.
      { itemId: 'ingredient', type: 'material', name: '돌' },
      { itemId: 'legacy', type: '무기', name: '검', t: 4 },
      null,
    ];
    const actor = { inventory, equipped: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, index % 2 ? slot : 'absent'])) };
    const before = structuredClone(actor);
    assert.deepEqual(ensureEquipped(actor), legacyEnsureEquipped(actor), `fixture ${index}`);
    assert.deepEqual(actor, before);
  }
  assert.deepEqual(ensureEquipped(null), legacyEnsureEquipped(null));
});

check('equipment classification reads a material once instead of once per equipment slot', () => {
  let nameReads = 0;
  const material = { itemId: 'stone', type: 'material', get name() { nameReads += 1; return '돌'; } };
  ensureEquipped({ inventory: [material] });
  assert.equal(nameReads, 1, 'The shared hot path must not infer each item slot five times.');
});

check('single-pass stat normalization preserves rounding, aliases and independent returned objects', () => {
  const values = [undefined, null, NaN, Infinity, -Infinity, -0, 0, -3, 1.23456, 1.0005, 1e21, '2.4995', '', false];
  for (const round of [undefined, false, true]) for (let index = 0; index < 100; index += 1) {
    const stats = Object.fromEntries(ER_STAT_KEYS.map((key, position) => [index % 2 ? key : key.toUpperCase(),
      values[(index + position) % values.length]]));
    if (index % 3 === 0) stats.attackPower = null;
    const before = structuredClone(stats);
    const expected = {};
    for (const field of ER_STAT_FIELDS) {
      const explicit = stats[field.key] ?? stats[field.key.toUpperCase()];
      const number = Number(explicit !== undefined ? explicit : DEFAULT_ER_STATS[field.key]);
      expected[field.key] = Math.max(field.min ?? 0, Math.min(field.max ?? Infinity,
        Number.isFinite(number) ? number : field.defaultValue ?? 0));
    }
    if (round !== false) for (const field of ER_STAT_FIELDS) {
      expected[field.key] = (field.step ?? 1) < 1 ? Number(expected[field.key].toFixed(3)) : Math.round(expected[field.key]);
    }
    const result = normalizeErStats(stats, { round });
    assert.deepEqual(result, expected);
    assert.deepEqual(stats, before);
    result.attackPower = -99;
    assert.deepEqual(normalizeErStats(stats, { round }), expected, 'No mutable result cache may escape.');
  }
});

const planningMaterial = (id, spawnZones = ['b']) => ({ _id: id, name: id, category: 'material', type: '재료', tier: 1, spawnZones });
const planningGear = (id, slot = 'head', tier = 2, ingredients = [{ itemId: 'raw', qty: 1 }]) => ({
  _id: id, name: id, itemKey: `${id}-key`, category: 'equipment', equipSlot: slot, tier,
  ...(slot === 'weapon' ? { weaponType: '단검' } : {}), recipe: { ingredients },
});
const planningActor = (extra = {}) => ({ _id: 'planning-actor', hp: 100, maxHp: 100, weaponType: '단검',
  zoneId: 'a', inventory: [], equipped: {}, simCredits: 20, routePlanTargetItemIds: ['missing-target'], ...extra });
const planningWorld = () => ({ mapObj: { zones: ['a', 'b', 'c'].map(zoneId => ({ zoneId, name: zoneId })) },
  zoneGraph: { a: ['b', 'c'], b: ['a'], c: ['a'] }, forbiddenIds: new Set() });

check('alternative growth recipes share one source filter and one route query per destination', () => {
  let graphReads = 0, stockReads = 0;
  const world = planningWorld();
  Object.defineProperty(world.zoneGraph, 'a', { get() { graphReads++; return ['b', 'c']; } });
  world.fieldResources = { byZone: { b: { raw: { get remaining() { stockReads++; return 1; } } } } };
  const items = [planningMaterial('raw'), planningGear('recovery-a'), planningGear('recovery-b')];
  const who = planningActor(), before = structuredClone(who);
  const plan = buildActorGrowthPlan(who, items, world);
  assert.equal(plan.targetId, 'recovery-a'); assert.equal(plan.nextStep, 'b');
  assert.equal(graphReads, 3, 'One reachability read plus the two property reads inside a single route query, not another BFS for each recipe.');
  assert.equal(stockReads, 3, 'Filter the shared source once; each recipe still checks its own required quantity.');
  assert.deepEqual(who, before, 'Lookup reuse cannot grant items or change the actor.');
});

check('growth lookups expire after every call and re-read stock, forbidden zones, position and paths', () => {
  const items = [planningMaterial('raw', ['b', 'c']), planningGear('goal')];
  const who = planningActor({ routePlanTargetItemIds: ['goal'] }), world = planningWorld();
  world.fieldResources = { byZone: { b: { raw: { remaining: 1 } }, c: { raw: { remaining: 1 } } } };
  const first = buildActorGrowthPlan(who, items, world);
  assert.equal(first.targetZoneId, 'b');
  first.missing[0].zones.push('not-a-real-source');
  world.fieldResources.byZone.b.raw.remaining = 0;
  assert.equal(buildActorGrowthPlan(who, items, world).targetZoneId, 'c');
  world.fieldResources.byZone.b.raw.remaining = 1;
  assert.equal(buildActorGrowthPlan(who, items, world).targetZoneId, 'b');
  world.forbiddenIds.add('b');
  const restricted = buildActorGrowthPlan(who, items, world);
  assert.equal(restricted.targetZoneId, 'c'); assert.deepEqual(restricted.missing[0].zones, ['c']);
  who.zoneId = 'c';
  assert.equal(buildActorGrowthPlan(who, items, world).nextStep, 'c');
  who.zoneId = 'a'; world.zoneGraph.a = ['b'];
  assert.equal(buildActorGrowthPlan(who, items, world).blocked, 'no_safe_path');
  world.zoneGraph.a = ['b', 'c'];
  assert.equal(buildActorGrowthPlan(who, items, world).targetZoneId, 'c');
});

check('actors with all five basic equipment slots do not enumerate irrelevant recovery recipes', () => {
  let recoveryReads = 0;
  const irrelevant = { ...planningGear('unused', 'head', 3), get category() { recoveryReads++; return 'equipment'; } };
  const inventory = EQUIP_SLOTS.map(slot => ({ ...planningGear(`owned-${slot}`, slot, 4), itemId: `owned-${slot}`, qty: 1 }));
  const who = planningActor({ inventory, routePlanTargetItemIds: [], equipped: Object.fromEntries(inventory.map(item => [item.equipSlot, item.itemId])) });
  assert.equal(buildActorGrowthPlan(who, [planningMaterial('raw'), irrelevant], planningWorld()), null);
  assert.equal(recoveryReads, 0, 'No recovery candidate can improve a slot already at tier four or higher.');
});

// Independent fixture-level reference for candidate ordering, not a past match
// export or another invocation of the optimized implementation.
function legacyLateGrowthTargets(actor, items, { authoredOnly = false } = {}) {
  const inventory = Array.isArray(actor.inventory) ? actor.inventory : [];
  const owned = new Set(inventory.filter(entry => invQty(inventory, getInvItemId(entry)) > 0).map(getInvItemId));
  const weapon = normalizeWeaponType(actor.weaponType || '');
  const catalog = items.filter(item => [5, 6].includes(Number(item.tier)) && inferItemCategory(item) === 'equipment'
    && EQUIP_SLOTS.includes(inferEquipSlot(item)) && getCraftRecipeTerms(item));
  const compatible = (item, slot, tier) => inferEquipSlot(item) === slot && Number(item.tier) === tier
    && (slot !== 'weapon' || areEquipmentWeaponTypesCompatible(weapon, item.weaponType));
  const candidates = [], issues = [];
  for (const slot of EQUIP_SLOTS) {
    const currentTier = getActorEquipmentTier(actor, slot);
    for (const [group, tier] of [['legend', 5], ['transcend', 6]]) {
      if (currentTier > tier) continue;
      const requested = String(actor.goalLoadouts?.[group]?.[`${slot}Key`] || '').trim();
      if (requested) {
        const target = catalog.find(item => String(item.itemKey || item.externalId || item._id || '').trim() === requested || String(item._id) === requested);
        if (!target || !compatible(target, slot, tier)) issues.push({ slot, tier, key: requested, reason: 'invalid_target' });
        else if (!owned.has(String(target._id))) candidates.push({ target, authored: true, slot, tier });
      } else if (!authoredOnly && currentTier < tier) {
        for (const target of catalog.filter(item => compatible(item, slot, tier) && !owned.has(String(item._id)))) {
          if (currentTier >= 4 || getCraftRecipeTerms(target).ingredients.every(row => invQty(inventory, row.itemId) >= row.qty)) {
            candidates.push({ target, authored: false, slot, tier });
          }
        }
      }
    }
  }
  const score = item => getCraftRecipeTerms(item).ingredients.reduce((sum, row) => sum + Math.min(row.qty, invQty(inventory, row.itemId)), 0);
  candidates.sort((a, b) => Number(b.authored) - Number(a.authored) || a.tier - b.tier || score(b.target) - score(a.target)
    || EQUIP_SLOTS.indexOf(a.slot) - EQUIP_SLOTS.indexOf(b.slot) || String(a.target._id).localeCompare(String(b.target._id)));
  return { targets: candidates.map(row => row.target), issues };
}

check('call-local ingredient scores preserve authored, tier, quantity and tie-break priorities', () => {
  const baseItems = EQUIP_SLOTS.flatMap(slot => [5, 6].flatMap(tier => [1, 2, 3].map(qty =>
    planningGear(`${slot}-${tier}-${qty}`, slot, tier, [{ itemId: 'raw', qty }]))));
  for (let index = 0; index < 60; index++) for (const authoredOnly of [false, true]) {
    const items = index % 2 ? [...baseItems].reverse() : baseItems;
    const inventory = EQUIP_SLOTS.map((slot, position) => ({ ...planningGear(`owned-${slot}`, slot, (index + position) % 7), itemId: `owned-${slot}`, qty: 1 }));
    inventory.push({ itemId: 'raw', qty: [0, 1, 3, '2', -1, undefined][index % 6] }, { itemId: 'raw', qty: index % 3 });
    const who = planningActor({ inventory, equipped: Object.fromEntries(inventory.filter(item => item.equipSlot).map(item => [item.equipSlot, item.itemId])),
      goalLoadouts: { legend: { headKey: index % 3 ? 'head-5-2-key' : 'missing' }, transcend: { armKey: 'arm-6-3-key' } } });
    const before = structuredClone(who);
    assert.deepEqual(getLateGrowthTargets(who, items, { authoredOnly }), legacyLateGrowthTargets(who, items, { authoredOnly }), `fixture ${index}/${authoredOnly}`);
    assert.deepEqual(who, before);
  }
});

check('ingredient scoring reads each sortable recipe once and is recomputed after inventory changes', () => {
  const items = [1, 2, 3, 4].map(qty => planningGear(`score-${qty}`, 'head', 5, [{ itemId: 'raw', qty }]));
  const worn = { ...planningGear('owned-head', 'head', 4), itemId: 'owned-head', qty: 1 };
  let reads = 0;
  const raw = { itemId: 'raw', get qty() { reads++; return 4; } };
  const who = planningActor({ inventory: [worn, raw], equipped: { head: worn.itemId } });
  assert.deepEqual(getLateGrowthTargets(who, items).targets.map(item => item._id), ['score-4', 'score-3', 'score-2', 'score-1']);
  assert.equal(reads, 10, 'The quantity helper reads qty twice: one ownership lookup plus one score per candidate, not per sort comparison.');
  who.inventory[1] = { itemId: 'raw', qty: 1 };
  assert.deepEqual(getLateGrowthTargets(who, items).targets.map(item => item._id), ['score-1', 'score-2', 'score-3', 'score-4']);
});

check('explicit consumable and equipment intent bypasses unused name and tag inference', () => {
  let displayReads = 0, slotReads = 0;
  const entry = { type: 'CONSUMABLE',
    get equipSlot() { slotReads++; return 'head'; },
    get name() { displayReads++; return '붕대 검'; },
    get tags() { displayReads++; return ['weapon']; } };
  assert.equal(inferItemCategory(entry), 'consumable');
  assert.equal(inferEquipSlot(entry), '');
  assert.equal(slotReads, 0, 'Consumable type must win without consulting a conflicting slot.');
  assert.equal(displayReads, 0, 'Explicit type does not need display heuristics.');
  entry.type = '방어구';
  assert.equal(inferItemCategory(entry), 'equipment');
  assert.equal(inferEquipSlot(entry), 'head');
  assert.equal(displayReads, 0, 'An authored slot does not need incidental name or tag words.');
});

// Independent pre-optimization rule reference. These declarations retain the
// legacy precedence and fallback vocabulary, not a saved match or old result.
function referenceItemCategory(item) {
  const tags = safeTags(item), type = String(item?.type || '').toLowerCase();
  const name = itemDisplayName(item), lower = String(name || '').toLowerCase();
  if (type === '소모품' || type === 'consumable') return 'consumable';
  if (item && typeof item === 'object' && String(item.equipSlot || '').trim().toLowerCase()) return 'equipment';
  if (lower.includes('bandage') || name.includes('붕대')) return 'material';
  const consumable = type === 'food' || type === 'consumable'
    || ['food', 'healthy', 'capsule', 'book'].some(tag => tags.includes(tag))
    || ['apple', 'steak'].some(word => lower.includes(word))
    || ['음식', '사과', '스테이크', '빵', '고기', '치킨'].some(word => name.includes(word));
  const equipment = type === 'weapon' || item?.type === '무기' || item?.type === '방어구'
    || ['weapon', 'armor', 'equipment', 'equip'].some(tag => tags.includes(tag))
    || lower.includes('weapon')
    || ['무기', '검', '총', '창', '활', '갑옷', '헬멧', '신발', '장갑'].some(word => name.includes(word));
  return equipment ? 'equipment' : consumable ? 'consumable' : 'material';
}

function referenceEquipSlot(item) {
  const tags = safeTags(item), type = String(item?.type || '').toLowerCase();
  if (type === '소모품' || type === 'consumable') return '';
  const name = itemDisplayName(item), lower = String(name || '').toLowerCase();
  if (item && typeof item === 'object') {
    const slot = String(item.equipSlot || '').trim().toLowerCase();
    if (slot) return slot;
  }
  if (type === 'weapon' || item?.type === '무기' || tags.includes('weapon') || lower.includes('weapon')
    || ['무기', '검', '총', '활', '창'].some(word => name.includes(word))) return 'weapon';
  if (tags.includes('head') || lower.includes('helmet') || ['머리', '모자', '헬멧'].some(word => name.includes(word))) return 'head';
  if (tags.includes('clothes') || tags.includes('body') || ['옷', '상의', '갑옷', '방어복'].some(word => name.includes(word))) return 'clothes';
  if (tags.includes('arm') || lower.includes('glove') || ['팔', '장갑', '암가드'].some(word => name.includes(word))) return 'arm';
  if (tags.includes('shoes') || lower.includes('boots') || ['신발', '부츠'].some(word => name.includes(word))) return 'shoes';
  return '';
}

check('fast item inference retains legacy type, slot, name and tag precedence', () => {
  const types = [undefined, '소모품', 'CONSUMABLE', 'food', '무기', 'weapon', '방어구', 'material', 'unknown'];
  const slots = [undefined, '', '  ', 'head', 'WEAPON', '  arm ', 'custom-slot', '0', 0, false];
  const names = ['', '붕대 검', 'bandage gloves', '검술 책', '사과 모자', 'weapon helmet', '머리', '모자',
    'helmet', '갑옷', '방어복', 'glove', '장갑', 'boots', '신발', '돌'];
  const tagLists = [undefined, null, 'weapon', [], ['food'], ['weapon'], ['head', 'food'], ['body', 'arm'], ['shoes', 'arm']];
  let variants = 0;
  for (const type of types) for (const equipSlot of slots) for (const name of names) for (const tags of tagLists) {
    const item = Object.freeze({ type, equipSlot, name, tags });
    assert.equal(inferItemCategory(item), referenceItemCategory(item), JSON.stringify(item));
    assert.equal(inferEquipSlot(item), referenceEquipSlot(item), JSON.stringify(item));
    variants++;
  }
  assert.equal(variants, 12960);
  for (const item of [null, undefined, false, 0, 'weapon', [], { text: '장갑' }, { itemId: { name: '부츠' } }]) {
    assert.equal(inferItemCategory(item), referenceItemCategory(item));
    assert.equal(inferEquipSlot(item), referenceEquipSlot(item));
  }
});

check('item inference is rebuilt after edits instead of retaining stale intent', () => {
  const item = { type: '소모품', equipSlot: 'WEAPON', name: '붕대 검', tags: ['head'] };
  assert.deepEqual([inferItemCategory(item), inferEquipSlot(item)], ['consumable', '']);
  item.type = '방어구'; item.equipSlot = ' shoes ';
  assert.deepEqual([inferItemCategory(item), inferEquipSlot(item)], ['equipment', 'shoes']);
  item.equipSlot = ''; item.type = ''; item.name = '돌';
  assert.deepEqual([inferItemCategory(item), inferEquipSlot(item)], ['material', 'head']);
  item.tags = ['food']; item.name = '고기';
  assert.deepEqual([inferItemCategory(item), inferEquipSlot(item)], ['consumable', '']);
});

console.log(JSON.stringify({ checks, pass: true, scope: 'phase planning/log append, call-local growth lookups and hot item/stat normalization contracts; no browser/build' }));
