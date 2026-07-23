import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  addItemToInventory,
  normalizeInventory,
} from '../src/app/simulation/_lib/inventoryRules.js';
import { pickKioskPrioritySpecialAction } from '../src/app/simulation/_lib/aiKioskPriorityRuntime.js';

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

assert.equal(
  pickKioskPrioritySpecialAction({ ...kioskArgs, missingSpecialKeys: new Set(['meteor']), curDay: 1, curPhase: 'morning' }),
  undefined,
  'Legendary materials must not be bought before day 2 daytime.',
);
assert.equal(
  pickKioskPrioritySpecialAction({ ...kioskArgs, missingSpecialKeys: new Set(['meteor']), curDay: 2, curPhase: 'morning' })?.itemId,
  'meteor',
  'Missing legendary materials must be prioritized from day 2 daytime.',
);
assert.equal(
  pickKioskPrioritySpecialAction({ ...kioskArgs, missingSpecialKeys: new Set(['vf']), curDay: 3, curPhase: 'night' }),
  undefined,
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

const sources = Object.fromEntries(await Promise.all([
  ['drone', '../src/app/simulation/_lib/aiDroneRuntime.js'],
  ['movement', '../src/app/simulation/_lib/actorMovementDecisionHelpers.js'],
  ['rift', '../src/app/simulation/_lib/phaseDimensionRiftRuntime.js'],
  ['devGuard', '../src/app/simulation/_lib/useSimulationDevRunGuard.js'],
  ['finish', '../src/app/simulation/_lib/finishGameRuntime.js'],
  ['logPanel', '../src/app/simulation/_components/SimulationLogPanel.js'],
].map(async ([key, relativePath]) => [key, await readFile(new URL(relativePath, import.meta.url), 'utf8')])));

assert.match(sources.drone, /dm\?\.maxTier \?\? 1/, 'The transfer drone default maximum tier must remain T1.');
assert.match(sources.drone, /category === 'material' && tier <= droneMaxTier/, 'Transfer drones must reject materials above the configured tier.');
assert.match(sources.movement, /forceFirstDayMorningMove/, 'Day 1 must retain its first-move guard.');
assert.match(sources.movement, /if \(forceFirstDayMorningMove\) willMove = true/, 'The first day move must not fail its random roll.');
assert.match(sources.rift, /buildRuntimeSurvivorMap\(updatedSurvivors\)/, 'Dimension rifts must operate on the complete survivor map.');
assert.match(sources.rift, /normalizeRuntimeSurvivorList\(Array\.from\(survivorById\.values\(\)\)\)/, 'Dimension rifts must restore the complete survivor list.');
assert.ok(
  sources.devGuard.includes('\uBA85\uC608\uC758 \uC804\uB2F9\uC5D0 \uAE30\uB85D\uB418\uC9C0 \uC54A\uACE0 \uBCF4\uC0C1\uB3C4 \uC9C0\uAE09\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4'),
  'Developer tools must warn that records and rewards are disabled.',
);
assert.match(sources.finish, /if \(isDevRunTainted\)[\s\S]*?return;/, 'A developer-tainted run must stop before records and rewards are saved.');
assert.match(sources.logPanel, /LOG_VIEW\.KILL/, 'The log panel must keep its kill-only view.');

console.log(JSON.stringify({
  duplicateStartingItemsMerged: true,
  protectedMaterialsPreserved: true,
  kioskTimeGatesCovered: 5,
  droneTierCapGuarded: true,
  dayOneMovementGuarded: true,
  dimensionRiftRosterGuarded: true,
  developerRunRewardsBlocked: true,
  killLogViewGuarded: true,
}, null, 2));
