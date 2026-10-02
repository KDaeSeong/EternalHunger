import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');

function seededRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

const rng = seededRng(7);
let natural = engine.createNewState({ difficulty: 'normal', rng, runId: 'auto-development-regression' });
// This is a complete, ordinary run, not a pre-completed research fixture.
// Stop only on actual completion readiness, death, or a bounded safety limit.
for (let day = 0; day < 120 && !natural.ended && !engine.archiveVictorySummary(natural).canComplete; day += 1) {
  natural = engine.runAutoDayAction(natural, { rng });
}
assert.ok(Number(natural.counters.craft || 0) > 0, 'Ordinary auto operation must not starve crafting behind perpetual stock replenishment.');
assert.equal(engine.archiveVictorySummary(natural).rows.find((row) => row.id === 'books').done, true, 'Unlocked archive books must be produced through ordinary paid crafting.');
assert.equal(engine.archiveVictorySummary(natural).canComplete, true, 'An ordinary run must reach all five archive objectives, not just survive and research.');
assert.equal(natural.victory, false, 'Auto operation must leave the final completion decision to the player.');

const completed = engine.completeArchiveAction(natural);
assert.equal(completed.victory, true);
assert.equal(completed.ended, true);
assert.equal(completed.meta.runsCompleted, natural.meta.runsCompleted + 1);
assert.deepEqual(engine.completeArchiveAction(completed).meta, completed.meta, 'Repeated completion must not grant duplicate rewards.');
assert.equal(engine.autoArchiveDevelopmentPlan(completed), null);
assert.deepEqual(engine.runAutoDayAction(completed).inventory, completed.inventory, 'Auto operation must not spend anything after completion.');
const restored = engine.normalizeState(JSON.parse(JSON.stringify(completed)));
assert.deepEqual(engine.archiveVictorySummary(restored), engine.archiveVictorySummary(completed), 'Serialized state must preserve actual completion and all objectives.');

function progressionFixture(overrides = {}) {
  const base = engine.createNewState({ rng: () => 0.5, runId: 'controlled-development', now: '2026-10-03T00:00:00.000Z' });
  return engine.normalizeState({
    ...base,
    day: 40,
    party: base.party.map((member) => ({ ...member, hp: 100, hunger: 0, stamina: 100, bodyTemp: 37 })),
    research: { ...base.research, completed: Object.fromEntries(engine.TECH_TREE.map((tech) => [tech.id, true])) },
    inventory: { wood: 20, stone: 20, fiber: 20, resin: 20, clay: 20, herb: 20, hide: 20, twine: 1, berry: 20 },
    camp: { fireLevel: 3, shelterLevel: 3, workbenchLevel: 2, archiveRoomLevel: 1, scribeDeskLevel: 1, libraryShelfLevel: 1, fuel: 12 },
    ...overrides,
  });
}

function firstRoll(value) {
  let first = true;
  return () => {
    if (!first) return 0.999;
    first = false;
    return value;
  };
}

const ready = progressionFixture();
const original = structuredClone(ready);
const plan = engine.autoArchiveDevelopmentPlan(ready);
assert.equal(plan.kind, 'craft');
assert.equal(plan.id, 'book_craft_guide');
assert.deepEqual(ready, original, 'Planning must not mutate resources or the run.');
const recipe = engine.RECIPES.find((row) => row.id === plan.id);
const crafted = engine.runCraftAction(ready, 'noa', plan.id, { rng: firstRoll(0) });
for (const [itemId, qty] of Object.entries(recipe.requires)) {
  assert.equal(Number(crafted.inventory[itemId] || 0), Number(ready.inventory[itemId] || 0) - qty, `${itemId} must be paid by real crafting.`);
}
assert.equal(crafted.inventory.book_craft_guide, 1);
assert.equal(crafted.ap, ready.ap - 1);
const failed = engine.runCraftAction(ready, 'noa', plan.id, { rng: firstRoll(0.999) });
assert.equal(Number(failed.inventory.book_craft_guide || 0), 0, 'A planned recipe must retain the real failure probability.');
assert.equal(failed.inventory.fiber, ready.inventory.fiber - recipe.requires.fiber, 'Failure must still pay the unchanged recipe cost.');

const needsTwine = progressionFixture({ inventory: { ...ready.inventory, twine: 0, book_camp_manual: 1 } });
const precursor = engine.autoArchiveDevelopmentPlan(needsTwine);
assert.equal(precursor.kind, 'craft');
assert.equal(precursor.id, 'twine', 'Missing book ingredients must come from their unlocked, paid precursor recipe.');
const madeTwine = engine.runCraftAction(needsTwine, 'noa', precursor.id, { rng: firstRoll(0) });
assert.equal(madeTwine.inventory.fiber, needsTwine.inventory.fiber - 2);
assert.equal(engine.autoArchiveDevelopmentPlan(madeTwine).id, 'book_craft_guide');

const needsClay = progressionFixture({ inventory: { ...ready.inventory, clay: 0, book_camp_manual: 1 } });
const source = engine.autoArchiveDevelopmentPlan(needsClay);
assert.equal(source.kind, 'gather');
const region = engine.regionRows(needsClay).find((row) => row.id === source.regionId);
assert.equal(region.revealed, true);
assert.equal(Boolean(region.safe), false);
assert.equal(region.zoneId, 'river', 'The source must really yield the missing clay.');
assert.equal(Number(needsClay.inventory.clay || 0), 0, 'Choosing a source must not gift its materials.');
const gathered = engine.runGatherAction(needsClay, source.actorId, source.regionId, { rng: firstRoll(0) });
assert.ok(Number(gathered.inventory.clay || 0) > 0, 'The proposed source must yield materials through the real field action.');
assert.equal(engine.autoArchiveDevelopmentPlan(gathered).id, 'book_craft_guide');
const mostlyHidden = engine.normalizeState({
  ...needsClay,
  exploration: { ...needsClay.exploration, revealed: Object.fromEntries(engine.WORLD_REGIONS
    .map((row) => [row.id, row.zoneId === 'forest'])) },
});
// Normalization preserves the starting river region; it cannot be made
// undiscovered by clearing fixture flags. Other regions remain hidden.
const visibilityRows = engine.regionRows(mostlyHidden);
assert.ok(visibilityRows.some((row) => !row.revealed));
const visibleSource = engine.autoArchiveDevelopmentPlan(mostlyHidden);
assert.equal(visibilityRows.find((row) => row.id === visibleSource.regionId).revealed, true, 'A material plan must use a genuinely revealed source.');
assert.equal(Number(mostlyHidden.inventory.clay || 0), 0);

const hasBooks = progressionFixture({ inventory: { ...ready.inventory, book_craft_guide: 1, book_camp_manual: 1 } });
assert.equal(engine.autoArchiveDevelopmentPlan(hasBooks), null, 'Finished archive books and facilities must not be made again.');
const needsFacility = progressionFixture({
  inventory: { ...hasBooks.inventory, stone: 0 },
  camp: { ...hasBooks.camp, archiveRoomLevel: 0 },
});
assert.equal(engine.autoArchiveDevelopmentPlan(needsFacility).kind, 'gather');
const readyFacility = engine.normalizeState({ ...needsFacility, inventory: { ...needsFacility.inventory, stone: 3 } });
const facilityPlan = engine.autoArchiveDevelopmentPlan(readyFacility);
assert.equal(facilityPlan.kind, 'camp');
assert.equal(facilityPlan.id, 'archive');
const built = engine.runCampAction(readyFacility, 'noa', facilityPlan.id, { rng: () => 0.999 });
assert.equal(built.camp.archiveRoomLevel, 1);
for (const [itemId, qty] of Object.entries(facilityPlan.cost)) {
  assert.equal(built.inventory[itemId], readyFacility.inventory[itemId] - qty, `${itemId} facility cost must remain unchanged.`);
}
assert.equal(engine.autoArchiveDevelopmentPlan(built), null);
assert.equal(engine.autoArchiveDevelopmentPlan(engine.createNewState({ rng: () => 0.5 })), null, 'Starting players must not bypass research unlocks.');

const hungry = progressionFixture({ party: ready.party.map((member) => ({ ...member, hunger: 90 })) });
const cared = engine.runAutoDayAction(hungry, { rng: () => 0.999 });
assert.ok(Number(cared.counters.meals || 0) > 0, 'Eating must retain priority over optional archive development.');
assert.equal(Number(cared.inventory.book_craft_guide || 0), 0, 'Auto operation must not consume its early development window while the party is starving.');

// Keep quantities bounded and count worn items as owned: crafting must not
// merely switch from "no equipment" to endless duplicate equipment.
const equipmentFixture = progressionFixture({
  inventory: { ...hasBooks.inventory, berry: 0, wood: 0, stone: 0, clay: 0, resin: 0, hide: 0, herb: 0, fiber: 30, twine: 3 },
});
const operated = engine.runAutoDayAction(equipmentFixture, { rng: firstRoll(0) });
assert.ok(Number(operated.inventory.twine || 0) <= 3, 'Auto crafting must not keep making stocked precursor materials.');

const basicEquipment = {
  tool: 'bone_awl', weapon: 'obsidian_blade', top: 'fur_coat', bottom: 'fur_pants', accessory: 'weather_totem',
  hat: 'fur_hat', shoes: 'fur_boots', earmuffs: 'fur_earmuffs', socks: 'socks', gloves: 'fur_gloves',
  armWarmers: 'arm_warmers', leggings: 'leggings', pauldron: 'pauldron',
};
const worn = progressionFixture({
  ...equipmentFixture,
  equipment: Object.fromEntries(ready.party.map((member) => [member.id, { ...basicEquipment }])),
});
const stocked = engine.runAutoDayAction(worn, { rng: firstRoll(0) });
assert.equal(Number(stocked.inventory.socks || 0), 0, 'Worn socks must count as owned instead of causing duplicate basic equipment.');
assert.equal(Number(stocked.inventory.twine || 0), 3, 'Counting worn equipment must not restart stocked precursor crafting.');

const canUpgrade = engine.normalizeState({ ...worn, inventory: { ...worn.inventory, dino_hide: 3 } });
const upgraded = engine.runAutoDayAction(canUpgrade, { rng: firstRoll(0) });
assert.equal(Number(upgraded.inventory.fur_socks || 0), 1, 'Bounded crafting must still produce a useful upgrade for an occupied slot.');
assert.ok(upgraded.inventory.dino_hide < canUpgrade.inventory.dino_hide, 'An upgrade must pay its actual materials.');
assert.equal(Number(upgraded.inventory.socks || 0), 0, 'An upgrade must not first duplicate the weaker equipped item.');
const equippedUpgrade = engine.autoEquipAction(upgraded, 'role');
assert.equal(equippedUpgrade.party.filter((member) => equippedUpgrade.equipment[member.id].socks === 'fur_socks').length, 1);

const secondRng = seededRng(7);
let repeat = engine.createNewState({ difficulty: 'normal', rng: secondRng, runId: 'repeat-development' });
for (let day = 0; day < 120 && !repeat.ended && !engine.archiveVictorySummary(repeat).canComplete; day += 1) {
  repeat = engine.runAutoDayAction(repeat, { rng: secondRng });
}
for (const key of ['day', 'party', 'inventory', 'equipment', 'camp', 'research', 'civics', 'counters']) {
  assert.deepEqual(repeat[key], natural[key], `The same seed must reproduce ${key} without external results or saves.`);
}

console.log(JSON.stringify({
  seed: 7,
  day: natural.day,
  ended: natural.ended,
  crafts: Number(natural.counters.craft || 0),
  controlledCases: ['read-only plan', 'paid craft', 'craft failure', 'paid precursor', 'real resource source', 'revealed source', 'no duplicate objectives', 'paid facility', 'research gating', 'survival priority', 'bounded stock', 'worn equipment', 'useful upgrade', 'repeat seed', 'completion and reward', 'serialized completion'],
  objectives: engine.archiveVictorySummary(natural).rows,
}, null, 2));
