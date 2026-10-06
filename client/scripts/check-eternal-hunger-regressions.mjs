import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  addItemToInventory,
  normalizeInventory,
} from '../src/app/simulation/_lib/inventoryRules.js';
import { pickKioskPrioritySpecialAction } from '../src/app/simulation/_lib/aiKioskPriorityRuntime.js';
import { withSimulationRandom } from '../src/utils/simulationRandom.js';
import {
  buildGuestSimulationMap,
  buildGuestSimulationRoster,
  isGuestSimulationSession,
  resolveSimulationBootstrapData,
} from '../src/app/simulation/_lib/guestSimulationBootstrap.js';

const { rollDroneOrder } = await import('../src/app/simulation/_lib/aiDroneRuntime.js');

const compactRuleset = {
  inventory: {
    maxSlots: 3,
    stackMax: { material: 3, consumable: 6, equipment: 1 },
  },
};

const duplicateStart = normalizeInventory([
  { itemId: 'wood', name: '\uB098\uBB34', category: 'material', tier: 1, qty: 1, tags: ['route_goal'], goalItem: true },
  { itemId: 'wood', name: '\uB098\uBB34', category: 'material', tier: 1, qty: 2 },
], compactRuleset);
assert.equal(duplicateStart.length, 1, 'Duplicate starting materials must share one inventory slot.');
assert.equal(duplicateStart[0]?.qty, 3, 'Duplicate starting material quantities must merge up to the stack cap.');
assert.equal(duplicateStart[0]?.goalItem, true, 'Stack merging must preserve the goal-item marker.');
assert.ok(duplicateStart[0]?.tags?.includes('route_goal'), 'Stack merging must preserve route-goal tags.');

const protectedInventory = [
  { itemId: 'aegis-essence', name: '\uC544\uC774\uAE30\uC2A4\uC758 \uC815\uC218', category: 'material', tier: 1, qty: 1 },
  { itemId: 'rare-ore', name: '\uACE0\uAE09 \uAD11\uC11D', category: 'material', tier: 4, qty: 1 },
  { itemId: 'wood', name: '\uB098\uBB34', category: 'material', tier: 1, qty: 1 },
];
const incomingLifeTree = {
  _id: 'life-tree',
  name: '\uC0DD\uBA85\uC758 \uB098\uBB34',
  type: 'material',
  tier: 4,
  tags: ['life_tree'],
};
const afterPriorityPickup = addItemToInventory(
  protectedInventory,
  incomingLifeTree,
  incomingLifeTree._id,
  1,
  2,
  compactRuleset,
);
assert.equal(afterPriorityPickup?._lastAdd?.reason, 'auto_dropped', 'A valuable pickup must replace a low-value material.');
assert.ok(afterPriorityPickup.some((item) => item.itemId === 'aegis-essence'), 'Aegis essence must never be auto-dropped.');
assert.ok(afterPriorityPickup.some((item) => item.itemId === 'rare-ore'), 'Tier 4 materials must never be auto-dropped.');
assert.ok(afterPriorityPickup.some((item) => item.itemId === 'life-tree'), 'The valuable incoming material must be stored.');
assert.ok(!afterPriorityPickup.some((item) => item.itemId === 'wood'), 'A low-value material should be removed first.');

const specialItems = {
  meteorItem: { _id: 'meteor', name: '\uC6B4\uC11D' },
  lifeTreeItem: { _id: 'life-tree', name: '\uC0DD\uBA85\uC758 \uB098\uBB34' },
  mithrilItem: { _id: 'mithril', name: '\uBBF8\uC2A4\uB9B4' },
  forceCoreItem: { _id: 'force-core', name: '\uD3EC\uC2A4 \uCF54\uC5B4' },
  surplusVfItem: { _id: 'vf-blood', name: 'VF \uD608\uC561 \uC0D8\uD50C' },
};
const specialPrices = { meteor: 200, life_tree: 200, mithril: 200, force_core: 350, vf: 500 };
const kioskArgs = {
  specialItems,
  inv: [],
  simCredits: 1000,
  allowVf: true,
  allowLegendary: true,
  kioskSpecialPrice: (key) => specialPrices[key] ?? 9999,
};

function assertBlockedKioskGoal(options, message) {
  let offerChecks = 0;
  const args = { ...kioskArgs, ...options, isOfferUsable: () => { offerChecks++; return true; } };
  const state = () => ({ specialItems: args.specialItems, inv: args.inv, simCredits: args.simCredits,
    up: args.up, missingSpecialKeys: args.missingSpecialKeys });
  const before = structuredClone(state());
  // null explicitly blocks surplus/recommendation fallback; undefined means no goal.
  assert.equal(pickKioskPrioritySpecialAction(args), null, message);
  assert.equal(offerChecks, 0, 'A time-gated goal must not even validate an offer.');
  assert.deepEqual(state(), before, 'A rejected goal must preserve credits, inventory and goal inputs.');
}
assertBlockedKioskGoal(
  { missingSpecialKeys: new Set(['meteor']), curDay: 1, curPhase: 'morning', up: { wantLegend: true } },
  'Legendary materials must not be bought before day 2 daytime.',
);
assert.equal(
  pickKioskPrioritySpecialAction({ ...kioskArgs, missingSpecialKeys: new Set(['meteor']), curDay: 2, curPhase: 'morning' })?.itemId,
  'meteor',
  'Missing legendary materials must be prioritized from day 2 daytime.',
);
assertBlockedKioskGoal(
  { missingSpecialKeys: new Set(['vf']), curDay: 3, curPhase: 'night', up: { wantTrans: true } },
  'VF blood must not be bought before day 4 daytime.',
);
assert.equal(
  pickKioskPrioritySpecialAction({ ...kioskArgs, missingSpecialKeys: new Set(['vf']), curDay: 4, curPhase: 'morning' })?.itemId,
  'vf-blood',
  'VF blood must be available from day 4 daytime.',
);
assert.equal(
  pickKioskPrioritySpecialAction({
    ...kioskArgs,
    missingSpecialKeys: new Set(['vf', 'meteor']),
    curDay: 4,
    curPhase: 'morning',
    shouldDeferVfForLegend: true,
  })?.itemId,
  'meteor',
  'An overdue legendary build must take priority over VF blood.',
);
assert.equal(
  pickKioskPrioritySpecialAction(kioskArgs), undefined,
  'Only an absent priority goal may permit surplus purchase fallback.',
);

let droneEligibilityCases = 0;
for (const path of ['catalog', 'craft_need', 'route_plan', 'keyword']) {
  const order = (item, maxTier) => {
    const actor = { inventory: [], simCredits: 100, goalGearTier: 4,
      ...(path === 'route_plan' ? { routePlanDroneItemIds: [item._id] } : {}) };
    const offers = path === 'catalog' ? [{ itemId: item._id, price: 10 }] : [];
    const goal = path === 'craft_need' ? { missing: [{ itemId: item._id }] } : null;
    return withSimulationRandom(() => 0, () => rollDroneOrder(offers, null, [item], 1, 'morning',
      actor, 0, goal, () => item.name, { drone: { maxTier, fallbackKeywords: ['wood'] } }));
  };
  const material = { _id: 'drone-wood', name: 'wood', type: 'material', tier: 1 };
  assert.equal(order(material)?.itemId, material._id, `${path}: T1 materials remain available.`);
  assert.equal(order({ ...material, tier: 2 }), null, `${path}: the default T1 cap rejects T2 materials.`);
  assert.equal(order({ ...material, tier: 2 }, 2)?.itemId, material._id, `${path}: configured T2 caps allow T2 materials.`);
  assert.equal(order({ ...material, tier: 3 }, 2), null, `${path}: configured caps still reject higher tiers.`);
  const water = { _id: 'drone-water', name: '물', type: 'drink', tier: 1 };
  assert.equal(order(water)?.itemId, water._id, `${path}: plain water is the allowed drink exception.`);
  assert.equal(order({ ...water, tier: 2 }), null, `${path}: the water exception cannot bypass the tier cap.`);
  assert.equal(order({ ...material, type: 'food' }), null, `${path}: food cannot bypass material filtering.`);
  assert.equal(order({ ...material, type: 'weapon', equipSlot: 'weapon' }), null, `${path}: equipment cannot be delivered.`);
  assert.equal(order({ ...material, name: '운석' }), null, `${path}: rare materials cannot bypass their kiosk-only restriction.`);
  droneEligibilityCases += 9;
}

const guestRoster = buildGuestSimulationRoster();
assert.equal(guestRoster.length, 24, 'Guest bootstrap must provide a complete 24-player roster.');
assert.equal(new Set(guestRoster.map((row) => row._id)).size, 24, 'Guest roster IDs must be stable and unique.');
assert.ok(guestRoster.every((row) => Number(row?.stats?.maxHp || 0) > 0), 'Every guest survivor must have valid base stats.');

const guestMap = buildGuestSimulationMap();
const guestZoneIds = new Set(guestMap.zones.map((zone) => String(zone.zoneId)));
assert.equal(guestZoneIds.size, 21, 'Guest bootstrap must provide all 21 Lumia zones.');
assert.ok(guestMap.zoneConnections.length > 0, 'Guest map must include traversable connections.');
assert.ok(
  guestMap.zoneConnections.every((edge) => guestZoneIds.has(edge.fromZoneId) && guestZoneIds.has(edge.toZoneId)),
  'Every guest map connection must reference a known zone.',
);
assert.equal(isGuestSimulationSession(null, null), true, 'Missing auth must select guest mode.');
assert.equal(isGuestSimulationSession('cookie-session', { username: 'viewer' }), false, 'A stored account marker must retain account mode.');
const resolvedGuestData = resolveSimulationBootstrapData({ guestMode: true, defaultSettings: { matchMode: 'squad' } });
assert.equal(resolvedGuestData.charList.length, 24, 'Guest fallback resolution must inject the local roster.');
assert.equal(resolvedGuestData.mapsList[0]?._id, guestMap._id, 'Guest fallback resolution must inject the local map.');
assert.equal(resolvedGuestData.meValue?.isGuest, true, 'Guest fallback must not impersonate an account user.');

const sources = Object.fromEntries(await Promise.all([
  ['movement', '../src/app/simulation/_lib/actorMovementDecisionHelpers.js'],
  ['rift', '../src/app/simulation/_lib/phaseDimensionRiftRuntime.js'],
  ['devGuard', '../src/app/simulation/_lib/useSimulationDevRunGuard.js'],
  ['finish', '../src/app/simulation/_lib/finishGameRuntime.js'],
  ['initialData', '../src/app/simulation/_lib/useSimulationInitialData.js'],
  ['initRuntime', '../src/app/simulation/_lib/simulationInitRuntime.js'],
  ['logPanel', '../src/app/simulation/_components/SimulationLogPanel.js'],
  ['mapAction', '../src/app/simulation/_lib/mapActionRuntime.js'],
  ['marketAction', '../src/app/simulation/_lib/marketActionRuntime.js'],
  ['marketState', '../src/app/simulation/_lib/marketStateRuntime.js'],
  ['mapDerived', '../src/app/simulation/_lib/mapDerived.js'],
].map(async ([key, relativePath]) => [key, await readFile(new URL(relativePath, import.meta.url), 'utf8')])));

assert.match(sources.movement, /forceFirstDayMorningMove/, 'Day 1 must retain its first-move guard.');
assert.match(sources.movement, /if \(forceFirstDayMorningMove\) willMove = true/, 'The first day move must not fail its random roll.');
assert.match(sources.rift, /advanceDimensionRiftContest\(rift, updatedSurvivors,/, 'Dimension rifts must operate on the complete authoritative survivor list.');
assert.match(sources.rift, /return \{ updatedSurvivors, ran: true \};/, 'Dimension rifts must return the complete authoritative survivor list.');
assert.doesNotMatch(sources.rift, /filter\(\(survivor\) => Number\(survivor\.hp \|\| 0\) > 0\)/,
  'Dimension rifts must not discard zero-HP snapshots before normal death finalization.');
assert.ok(
  sources.devGuard.includes('\uBA85\uC608\uC758 \uC804\uB2F9\uC5D0 \uAE30\uB85D\uB418\uC9C0 \uC54A\uACE0 \uBCF4\uC0C1\uB3C4 \uC9C0\uAE09\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4'),
  'Developer tools must warn that records and rewards are disabled.',
);
assert.match(sources.finish, /if \(isDevRunTainted\)[\s\S]*?return;/, 'A developer-tainted run must stop before records and rewards are saved.');
assert.match(sources.logPanel, /LOG_VIEW\.KILL/, 'The log panel must keep its kill-only view.');
assert.ok(
  sources.initialData.indexOf('if (hasInitialized.current) return;') < sources.initialData.indexOf('const token = getToken();'),
  'The one-shot initialization guard must run before session mode is selected.',
);
assert.match(
  sources.initialData,
  /const guestMode = forceGuest \|\| isGuestSimulationSession\(token, me\);/,
  'Missing auth and the isolated evaluation route must select guest bootstrap instead of redirecting.',
);
assert.doesNotMatch(sources.initialData, /if \(!token \|\| !me\?\.username\)/, 'Simulation entry must not require an account marker.');
assert.match(
  sources.initialData,
  /const itemsLoadPromise = guestMode\s*\? loadGuestSimulationItemCatalog\(\{ includeLocal: !isolatedEvaluation \}\)\s*:\s*apiGetCached\('\/public\/items'/,
  'Guest initialization must use the local catalog, exclude personal edits from isolated evaluation, and never use the remote item API.',
);
assert.match(
  sources.initialData,
  /const publicCriticalRequests = guestMode\s*\? \[Promise\.resolve\(\[\]\), Promise\.resolve\(\[\]\)\]/,
  'Guest initialization must use local map and perk fallbacks without public API requests.',
);
assert.match(
  sources.initialData,
  /const loadDeferredInitData = \(\) => \{\s*if \(guestMode\) \{[\s\S]*?setMyTradeOffers\(\[\]\);\s*return;/,
  'Guest initialization must return before kiosk, drone, or trade requests are created.',
);
assert.match(sources.mapAction, /if \(!getToken\(\)\)[\s\S]*?return false;/, 'Guest map refresh must retain the built-in map.');
assert.match(sources.marketAction, /function ensureAccountFeature\(label\)/, 'Account-only market mutations must have a guest guard.');
assert.match(sources.marketState, /if \(!getToken\(\)\)[\s\S]*?guestMode: true/, 'Guest trade loading must stop before account APIs are called.');
assert.match(
  sources.mapDerived,
  /id: `\$\{who\}:\$\{String\(event\._id \|\| event\.ts \|\| `\$\{i\}`\)\}:\$\{from\}:\$\{to\}`/,
  'Move trail render IDs must stay unique when batched actors share a timestamp.',
);
assert.match(sources.initRuntime, /let loginRedirectInFlight = false;/, 'Simulation login redirects must have an in-flight guard.');
assert.match(
  sources.initRuntime,
  /loginRedirectInFlight \|\| window\.location\.pathname === '\/login'/,
  'Repeated auth updates must not trigger another login alert and redirect.',
);


console.log(JSON.stringify({
  duplicateStartingItemsMerged: true,
  protectedMaterialsPreserved: true,
  kioskTimeGatesCovered: 5,
  kioskRejectedGoalFallbackBlocked: true,
  kioskRejectedGoalStatePreserved: true,
  kioskAbsentGoalFallbackAllowed: true,
  droneTierCapGuarded: true,
  droneEligibilityCases,
  dayOneMovementGuarded: true,
  dimensionRiftRosterGuarded: true,
  developerRunRewardsBlocked: true,
  killLogViewGuarded: true,
  guestBootstrapRosterSize: guestRoster.length,
  guestBootstrapZoneCount: guestZoneIds.size,
  guestInitializationApiCalls: 0,
  guestAccountFeaturesGuarded: true,
  loginRedirectLoopGuarded: true,
}, null, 2));
