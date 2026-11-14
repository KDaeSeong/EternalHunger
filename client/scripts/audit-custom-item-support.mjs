// Read-only HF6 audit: exercise actual schema/runtime functions on disposable
// in-memory items. No database connection, account mutation, or game balance edit.
// This reports missing support; it is NOT a passing feature/acceptance test.
import './lib/register-simulation-modules.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Item = require('../../server/models/Item.js');
const { applyItemEffect } = await import('../src/utils/itemLogic.js');
const { inferItemCategory, addItemToInventory, invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { isFoodRecoveryItem } = await import('../src/app/simulation/_lib/satietyRuntime.js');
const { forceUseConsumableAtIndex, createPhaseConsumableRuntime } = await import('../src/app/simulation/_lib/consumableRuntime.js');
const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { tryAutoCraftFromLoot } = await import('../src/app/simulation/_lib/craftRuntime.js');
const { getLootCraftOptions } = await import('../src/app/simulation/_lib/runEventRuntime.js');
const { commitCraftTransaction } = await import('../src/app/simulation/_lib/craftTransactionRuntime.js');
const { pickCatalogEquipmentItem } = await import('../src/app/simulation/_lib/gearCatalogRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

const rules = { inventory: { maxSlots: 10, stackMax: { material: 10, consumable: 10, equipment: 1 }, autoDropLowValue: false } };
const actor = (extra = {}) => ({ _id: 'hf6-audit', name: '감사 표본', hp: 10, maxHp: 100, satiety: 70,
  simCredits: 20, inventory: [], equipped: {}, stats: {}, _actionCycleKey: 'audit:1', ...extra });
const medicine = { _id: '111111111111111111111111', name: '맞춤 회복약', type: '소모품', tier: 1,
  consumeEffect: { heal: 25, satiety: 0 }, recipe: { ingredients: [{ itemId: '222222222222222222222222', qty: 1 }], creditsCost: 7, resultQty: 3 } };
const encoded = new Item(medicine).toObject();
const food = { ...medicine, _id: 'custom:food', name: '맞춤 음식', type: 'food', tags: ['food'] };
const received = addItemToInventory([], food, food._id, 1, 1, rules)[0];
const supportedMedicine = { ...medicine, itemId: medicine._id, type: 'consumable', qty: 1 };
const forcedActor = actor({ inventory: [structuredClone(supportedMedicine)] });
const forced = forceUseConsumableAtIndex(forcedActor, 0);
const autoActor = actor({ inventory: [structuredClone(supportedMedicine)] });
const automatic = createPhaseConsumableRuntime({ phaseIdxNow: 0 }).tryUseConsumable(autoActor, 'turn');
const rejectedEffectChecks = [
  { version: 1, unknownEffect: 25 },
  { version: 1, heal: 25, unknownEffect: 1 },
  { version: 1, heal: -1 },
].map(consumeEffect => {
  const item = { ...supportedMedicine, consumeEffect };
  const manualActor = actor({ inventory: [structuredClone(item)] });
  const automaticActor = actor({ inventory: [structuredClone(item)] });
  const manualBefore = JSON.stringify(manualActor), automaticBefore = JSON.stringify(automaticActor);
  const usedManually = forceUseConsumableAtIndex(manualActor, 0).used;
  const usedAutomatically = createPhaseConsumableRuntime({ phaseIdxNow: 0 }).tryUseConsumable(automaticActor, 'turn');
  return { consumeEffect, schemaRejected: Boolean(new Item({ ...item, type: medicine.type }).validateSync()?.errors?.consumeEffect), usedManually, usedAutomatically,
    manualPreserved: JSON.stringify(manualActor) === manualBefore,
    automaticPreserved: JSON.stringify(automaticActor) === automaticBefore };
});

const material = { _id: 'custom:leaf', itemId: 'custom:leaf', name: '약초', type: '재료', qty: 2, tier: 1 };
const recipe = { ...food, recipe: { ingredients: [{ itemId: material._id, qty: 2 }], resultQty: 3, creditsCost: 7 } };
const crafter = actor({ inventory: [structuredClone(material)] });
const craft = tryAutoCraftFromInventory(crafter, [recipe], {}, {}, 1, 0, rules);
const poorCrafter = actor({ simCredits: 0, inventory: [structuredClone(material)] });
const poorCraft = tryAutoCraftFromInventory(poorCrafter, [recipe], {}, {}, 1, 0, rules);
const lootCrafter = actor({ inventory: [structuredClone(material)] });
const lootCraft = withSimulationRandom(() => 0, () => tryAutoCraftFromLoot(lootCrafter.inventory, material._id, [recipe], {}, {}, 1, rules, getLootCraftOptions(lootCrafter)));
const lootCommit = commitCraftTransaction(lootCrafter, lootCraft?.transaction);

const findings = [
  { id: 'HF6-SCHEMA', requirement: 'Authored effects survive item storage',
    supported: encoded.consumeEffect?.heal === 25,
    evidence: { authoredHeal: 25, schemaHeal: encoded.consumeEffect?.heal ?? null, schemaResultQty: encoded.recipe.resultQty, schemaCreditsCost: encoded.recipe.creditsCost } },
  { id: 'HF6-CATEGORY', requirement: 'Editor consumable type is recognized without a special name or tag',
    supported: inferItemCategory(medicine) === 'consumable',
    evidence: { editorType: medicine.type, runtimeCategory: inferItemCategory(medicine), recognizedAsFood: isFoodRecoveryItem(medicine), automaticHealingUsed: automatic } },
  { id: 'HF6-RECEIPT', requirement: 'Received items retain explicit consumable effects',
    supported: applyItemEffect(actor(), received).recovery === 25,
    evidence: { beforeInventoryHeal: applyItemEffect(actor(), food).recovery, afterInventoryHeal: applyItemEffect(actor(), received).recovery,
      retainedEffect: received.consumeEffect ?? null } },
  { id: 'HF6-USE', requirement: 'Supported explicit recovery heals and consumes exactly one item',
    supported: forced.used === true && forced.heal === 25 && forcedActor.hp === 35 && forcedActor.inventory.length === 0
      && automatic === true && autoActor.hp === 35 && autoActor.inventory.length === 0,
    evidence: { used: forced.used, heal: forced.heal ?? 0, remainingItems: forcedActor.inventory.length, automaticUse: automatic, automaticHp: autoActor.hp } },
  { id: 'HF6-UNSUPPORTED', requirement: 'Unknown and malformed explicit effects reject use and preserve the whole actor',
    supported: rejectedEffectChecks.every(row => row.schemaRejected && !row.usedManually && !row.usedAutomatically
      && row.manualPreserved && row.automaticPreserved), evidence: rejectedEffectChecks },
  { id: 'HF6-CRAFT', requirement: 'Crafting honors authored yield and pays the authored cost atomically',
    supported: craft?.changed === true && invQty(crafter.inventory, recipe._id) === 3 && crafter.simCredits === 13 && !poorCraft?.changed
      && lootCommit.ok && invQty(lootCrafter.inventory, recipe._id) === 3 && lootCrafter.simCredits === 13,
    evidence: { declaredYield: 3, receivedYield: invQty(crafter.inventory, recipe._id), declaredCost: 7, afterCredits: crafter.simCredits,
      remainingIngredients: invQty(crafter.inventory, material._id), craftedWithZeroCredits: poorCraft?.changed === true,
      lootPathYield: invQty(lootCrafter.inventory, recipe._id), lootPathAfterCredits: lootCrafter.simCredits, lootPathHasActorCreditInput: true } },
];
const missingStarter = withSimulationRandom(() => 0, () => pickCatalogEquipmentItem([
  { _id: 'custom:head', name: '맞춤 투구', type: '방어구', equipSlot: 'head', tier: 1 },
], { slot: 'weapon', weaponType: '단검', tier: 1, allowNearestTier: false }));
console.log(JSON.stringify({ audit: 'HF6 actual in-memory support audit', implementationComplete: false,
  engineVersion: (await import('../src/app/simulation/_generated/simulationEngineVersion.js')).SIMULATION_ENGINE_VERSION,
  findings, missingSupport: findings.filter((row) => !row.supported).map((row) => row.id),
  emptySlotBoundary: { incompleteCatalogReturnsNoStarter: missingStarter === null,
    originalEvaluatorCatalogAvailable: false, originalEmptySlotCauseProven: false },
  limitations: ['No database or account UI write', 'Guest profile editor UI and real browser persistence not exercised', 'No item proc/rupture combat acceptance',
    'No original evaluator roster/catalog replay; empty-slot causation remains open', 'A successful audit command is not feature completion'] }, null, 2));
