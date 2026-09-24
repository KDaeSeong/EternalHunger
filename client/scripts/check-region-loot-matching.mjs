import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { LUMIA_REGION_DATA, canonicalZoneId, getRegionData, getRegionZoneWeightsForItem, listRegionLootCandidates } =
  await import('../src/app/simulation/_lib/lumiaRegionData.js');
const { normalizeMatchKey } = await import('../src/app/simulation/_lib/simulationCommon.js');
const { isItemExcludedFromFieldFarming } = await import('../src/utils/erItemFilters.js');
const { loadGuestSimulationItemCatalog } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const items = await loadGuestSimulationItemCatalog();
let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };

// Frozen algorithm from before batching name normalization. Compare complete
// weights and ordering, not just candidate membership or a faster wall clock.
function legacyNameScore(item, name) {
  const target = normalizeMatchKey(name);
  if (!target) return 0;
  let best = 0;
  for (const candidate of [item?.name, item?.text, item?.localizedName, item?.itemKey, item?.externalId]
    .map((value) => String(value || '').trim()).filter(Boolean)) {
    const key = normalizeMatchKey(candidate);
    if (!key) continue;
    if (key === target) best = Math.max(best, 10);
    else if (key.includes(target) || target.includes(key)) best = Math.max(best, 6);
  }
  return best;
}
const legacyScore = (item, region) => !item || !region ? 0 : (region.searchNames || [])
  .reduce((best, name) => Math.max(best, legacyNameScore(item, name)), 0);

function legacyWeights(item, zones, forbidden = new Set()) {
  const forb = forbidden instanceof Set ? forbidden : new Set();
  const ids = Array.isArray(zones) && zones.length
    ? zones.map((zone) => canonicalZoneId(zone?.zoneId || zone?.id || zone?.name)).filter(Boolean)
    : LUMIA_REGION_DATA.map((zone) => zone.zoneId);
  const result = new Map();
  for (const raw of ids) {
    const id = canonicalZoneId(raw), region = getRegionData(id);
    if (!id || forb.has(id) || !region) continue;
    const score = legacyScore(item, region);
    if (score <= 0) continue;
    const bonus = Object.entries(region.resources || {}).reduce((sum, [name, count]) =>
      sum + (legacyNameScore(item, name) > 0 ? Math.min(5, Number(count || 0)) : 0), 0);
    result.set(id, score + bonus);
  }
  return result;
}

function legacyCandidates(zone, catalog, opts = {}) {
  const region = getRegionData(zone);
  if (!region) return [];
  const goals = new Set((opts.goalItemIds || []).map(String)), routes = new Set((opts.routeItemIds || []).map(String));
  return catalog.map((item) => {
    if (!item?._id || isItemExcludedFromFieldFarming(item) || opts.filterItem && !opts.filterItem(item)) return null;
    let weight = legacyScore(item, region);
    if (weight <= 0) return null;
    if (goals.has(String(item._id))) weight += Number(opts.goalWeight ?? 12);
    if (routes.has(String(item._id))) weight += Number(opts.routeWeight ?? 10);
    return { item, itemId: String(item._id), weight: Math.max(0.1, weight), minQty: 1, maxQty: Number(opts.maxQty || 1) };
  }).filter(Boolean);
}

check('one source lookup reads item name aliases once, not once for every region search term', () => {
  let reads = 0;
  getRegionZoneWeightsForItem({ _id: 'probe', get name() { reads++; return '물'; } });
  assert.equal(reads, 1);
});

check('all catalog source weights and insertion order retain the legacy matching rules', () => {
  const before = structuredClone(items);
  for (const item of items) assert.deepEqual(getRegionZoneWeightsForItem(item), legacyWeights(item), String(item._id));
  assert.deepEqual(items, before);
});

check('regional candidate order, item identity, goals, exclusions and weights stay exact', () => {
  const options = [{}, { goalItemIds: items.slice(0, 150).map((item) => item._id), routeItemIds: items.slice(80, 200).map((item) => item._id),
    goalWeight: -3, routeWeight: 7, maxQty: 3, filterItem: (item) => Number(item.tier) <= 2 }];
  for (const region of LUMIA_REGION_DATA) for (const opts of options) {
    const result = listRegionLootCandidates(region.zoneId, items, opts);
    assert.deepEqual(result, legacyCandidates(region.zoneId, items, opts), region.zoneId);
    result.forEach((row) => assert.ok(items.includes(row.item), 'Keep the original catalog item reference.'));
  }
});

check('custom aliases, partial names, forbidden zones and changed inputs are never stale-cached', () => {
  const zones = [{ name: '호텔' }, { zoneId: 'forest' }, { id: 'hospital' }, { zoneId: 'unknown' }, { zoneId: 'hotel' }];
  for (const name of ['', '   ', '물', '가죽', '스테이크', '아글라이아의 선물', '고철 조각', 'LEATHER', ' .- ']) {
    const item = { _id: 'custom', name, text: '돌멩이', localizedName: '접 착 제', itemKey: '물', externalId: 'custom-water' };
    for (const forbidden of [new Set(['hotel']), null]) {
      assert.deepEqual(getRegionZoneWeightsForItem(item, zones, forbidden), legacyWeights(item, zones, forbidden));
    }
    for (const region of LUMIA_REGION_DATA) {
      assert.deepEqual(listRegionLootCandidates(region.name, [null, item, { _id: '' }]), legacyCandidates(region.name, [null, item, { _id: '' }]));
    }
    item.text = '랜덤 custom'; item.name = '새 물품';
    assert.deepEqual(getRegionZoneWeightsForItem(item), legacyWeights(item));
  }
  assert.deepEqual(getRegionZoneWeightsForItem(null), new Map());
  assert.deepEqual(listRegionLootCandidates('unknown', items), []);
});

console.log(JSON.stringify({ checks, pass: true, catalogItems: items.length, regions: LUMIA_REGION_DATA.length,
  scope: 'matching equivalence and bounded repeated normalization, not browser timing' }));
