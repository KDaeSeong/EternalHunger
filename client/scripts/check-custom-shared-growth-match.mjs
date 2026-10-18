import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { GUEST_ITEM_PROFILE_KEY, readGuestItems } = await import('../src/app/simulation/_lib/guestItemProfileRuntime.js');
const { buildInitialFastRoutePlan, mergeInitialRoutePlanFields } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { createSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { getActorGrowthProgress } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getInvItemId, inferEquipSlot } = await import('../src/app/simulation/_lib/inventoryItemRules.js');
const { getRuleset, getPhaseDurationSec } = await import('../src/utils/rulesets.js');
const { areEquipmentWeaponTypesCompatible, normalizeWeaponType } = await import('../src/utils/equipmentCatalog.js');
const { ER_WEAPON_TYPES_KO } = await import('../src/utils/erMeta.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
const { createMatchDistributionFrameTracker } = await import('./lib/match-distribution-frame-tracker.mjs');

const args = process.argv.slice(2);
assert.ok(args.length <= 1 && args.every(arg => arg === '--expanded'),
  'Usage: node scripts/check-custom-shared-growth-match.mjs [--expanded]');
const expanded = args.includes('--expanded');

function expandedTargetActuallyEquipped(actor, target, items) {
  const slot = inferEquipSlot(target);
  if (!slot) return false;
  const equippedId = String(actor?.equipped?.[slot] || '');
  if (equippedId !== String(target?._id || '')) return false;
  const catalogItem = items.find(item => String(item._id) === equippedId);
  const inventoryItem = (actor?.inventory || []).find(entry => {
    const quantity = entry.qty === undefined ? 1 : Number(entry.qty);
    return getInvItemId(entry) === equippedId && Number.isSafeInteger(quantity) && quantity > 0;
  });
  if (!catalogItem || !inventoryItem) return false;
  const equippedItem = { ...catalogItem, ...inventoryItem };
  if (inferEquipSlot(equippedItem) !== slot) return false;
  return slot !== 'weapon' || areEquipmentWeaponTypesCompatible(actor.weaponType, equippedItem.weaponType);
}

async function runExpandedCases() {
  const cases = [
    { name: 'shared-batch', matchSeed: '5501', rosterSeed: 'HF4:roster-A', leaves: ['namu:material:고철'],
      stages: [{ id: 'batch', ingredients: [{ itemId: 'namu:material:고철', qty: 3 }], resultQty: 2, cost: 1 }],
      targetIngredients: [{ key: 'batch', qty: 1 }], targetCost: 1 },
    { name: 'multi-leaf-cost', matchSeed: '5502', rosterSeed: 'HF4:roster-C',
      leaves: ['namu:material:나뭇가지', 'namu:material:고철'],
      stages: [
        { id: 'branch-batch', ingredients: [{ itemId: 'namu:material:나뭇가지', qty: 2 }], resultQty: 2, cost: 2 },
        { id: 'scrap-batch', ingredients: [{ itemId: 'namu:material:고철', qty: 3 }], resultQty: 1, cost: 1 },
      ], targetIngredients: [{ key: 'branch-batch', qty: 1 }, { key: 'scrap-batch', qty: 1 }], targetCost: 3 },
  ];
  const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const protectedAxes = fixture => ({ map: fixture.map, settings: fixture.settings,
    roster: fixture.survivors.map(actor => ({ id: actor._id, hp: actor.hp, maxHp: actor.maxHp,
      stats: actor.stats, erStats: actor.erStats, weaponType: actor.weaponType, credits: actor.simCredits,
      inventory: actor.inventory || [], teamId: actor.teamId, zoneId: actor.zoneId })) });
  const summaries = [];

  for (const spec of cases) {
    const fixture = JSON.parse(await createRandomIsolationInput(spec.matchSeed, { initialRosterSeed: spec.rosterSeed }));
    assert.equal(fixture.survivors.length, 24, `${spec.name}: use the full natural 24-person roster.`);
    const protectedBefore = digest(protectedAxes(fixture));
    const originalCatalog = JSON.stringify(fixture.items);
    const emptyInventoryBaseline = fixture.survivors.every(actor => JSON.stringify(actor.inventory || []) === '[]');
    assert.ok(emptyInventoryBaseline, `${spec.name}: all 24 initial inventories remain empty.`);
    const groups = new Map();
    for (const actor of fixture.survivors) {
      const teamId = String(actor.teamId || '');
      assert.ok(teamId, `${spec.name}: every participant retains its team.`);
      if (!groups.has(teamId)) groups.set(teamId, []);
      groups.get(teamId).push(actor);
    }
    const eligibleTeams = [...groups.entries()].filter(([, actors]) => actors.length >= 2).sort(([a], [b]) => a.localeCompare(b));
    assert.ok(eligibleTeams.length >= 2, `${spec.name}: need two distinct teams with two members each.`);
    const selected = [...eligibleTeams[0][1].slice(0, 2), ...eligibleTeams[1][1].slice(0, 2)];
    const targetByActor = new Map();
    const itemIds = new Map();
    const profileRows = [];
    for (const stage of spec.stages) {
      const id = `guest-item-expanded-${spec.name}-${stage.id}`;
      itemIds.set(stage.id, id);
      profileRows.push({ _id: id, name: `${spec.name} ${stage.id}`, type: '재료', tier: 2, stackMax: 10,
        recipe: { ingredients: stage.ingredients, resultQty: stage.resultQty, creditsCost: stage.cost } });
    }
    for (const [selectedIndex, actor] of selected.entries()) {
      const weaponType = normalizeWeaponType(actor.weaponType);
      assert.ok(weaponType, `${spec.name}: selected weapon target needs a valid weapon family.`);
      const id = `guest-item-expanded-${spec.name}-goal-${selectedIndex + 1}`;
      targetByActor.set(actor._id, id);
      profileRows.push({ _id: id, name: `${spec.name} authored goal ${actor._id}`, type: '무기', equipSlot: 'weapon',
        weaponType, tier: 4, stackMax: 1,
        recipe: { ingredients: spec.targetIngredients.map(row => ({ itemId: itemIds.get(row.key), qty: row.qty })),
          resultQty: 1, creditsCost: spec.targetCost } });
    }
    for (const leafId of spec.leaves) assert.ok(fixture.items.some(item => item._id === leafId), `${spec.name}: ${leafId} must be a real catalog leaf.`);
    const profileResult = readGuestItems(fixture.items, { getItem(key) {
      assert.equal(key, GUEST_ITEM_PROFILE_KEY);
      return JSON.stringify({ schemaVersion: 1, items: profileRows });
    } });
    assert.equal(profileResult.ok, true, profileResult.error);
    assert.equal(JSON.stringify(fixture.items), originalCatalog, 'Reading custom profiles must not mutate the original catalogue.');
    fixture.items.push(...profileResult.items);
    assert.equal(JSON.stringify(fixture.items.slice(0, -profileResult.items.length)), originalCatalog,
      'Custom equipment must extend, not replace or rewrite the real catalogue.');
    for (const actor of selected) {
      const targetId = targetByActor.get(actor._id);
      const target = fixture.items.find(item => item._id === targetId);
      assert.ok(areEquipmentWeaponTypesCompatible(actor.weaponType, target.weaponType));
      const updated = { ...actor, goalLoadouts: { ...(actor.goalLoadouts || {}), hero: { weaponKey: targetId } } };
      const planned = mergeInitialRoutePlanFields(updated, buildInitialFastRoutePlan(updated, fixture.map, fixture.items));
      assert.ok(planned.routePlanTargetItemIds.includes(targetId), `${spec.name}: authored target must be in initial route.`);
      fixture.survivors[fixture.survivors.findIndex(row => row._id === actor._id)] = planned;
    }
    assert.equal(digest(protectedAxes(fixture)), protectedBefore,
      `${spec.name}: map/settings and all 24 initial HP/budget/inventory/team/start-zone values are unchanged.`);

    const savedInput = createSimulationRunInput({ activeMap: fixture.map, settings: fixture.settings,
      survivors: fixture.survivors, publicItems: fixture.items, runSeed: fixture.runSeed }, { getItem: () => null });
    const savedInputBefore = JSON.stringify(savedInput);
    const rules = getRuleset(savedInput.settings.rulesetId || 'ER_S11');
    const firstNightDeadline = getPhaseDurationSec(rules, 1, 'morning') + getPhaseDurationSec(rules, 1, 'night');
    const tracker = createMatchDistributionFrameTracker({ initialActors: savedInput.initialFrame.survivors,
      items: savedInput.publicItems, firstDayDeadlineSec: firstNightDeadline });
    const recipes = new Map(profileResult.items.map(item => [String(item._id), item.recipe]));
    const receipts = new Map(), customActionKeys = new Set(), firstEquippedAt = new Map(), lastTargets = new Map();
    const stock = new Map(), pickupTeamsByStock = new Map();
    let cursor = 0;
    console.log(`CUSTOM_SHARED_GROWTH_EXPANDED_START ${JSON.stringify({ case: spec.name,
      matchSeed: spec.matchSeed, rosterSeed: spec.rosterSeed, engine: SIMULATION_ENGINE_VERSION,
      inputSha256: digest(savedInput), selectedActors: selected.map(actor => ({ id: actor._id, teamId: actor.teamId })) })}`);
    const result = await runRandomIsolationMatch(null, { savedInput,
      onFrame(frame, { events, publicItems }) {
        tracker.observe(frame);
        const fieldByZone = frame.spawnState?.fieldResources?.byZone || {};
        for (const [zoneId, rows] of Object.entries(fieldByZone)) for (const [itemId, row] of Object.entries(rows || {})) {
          if (!spec.leaves.includes(itemId)) continue;
          const key = JSON.stringify([zoneId, itemId]);
          if (!stock.has(key)) stock.set(key, { zoneId, itemId, initial: Number(row.initial),
            remaining: Number(row.initial), taken: 0 });
        }
        for (const event of events.slice(cursor)) {
          const recipe = recipes.get(String(event.itemId));
          if (event.kind === 'craft' && recipe) {
            assert.equal(event.receiptVersion, 1);
            assert.equal(event.qty, recipe.resultQty);
            assert.equal(event.paidCost, recipe.creditsCost);
            assert.equal(event.beforeCredits - event.afterCredits, recipe.creditsCost);
            assert.deepEqual(event.consumed, recipe.ingredients);
            assert.ok(event.actionKey, 'Each custom craft transaction needs an action key.');
            assert.ok(!customActionKeys.has(event.actionKey), `${spec.name}: custom action key must not be reused.`);
            customActionKeys.add(event.actionKey);
            const rows = receipts.get(`${event.who}:${event.itemId}`) || [];
            rows.push(event); receipts.set(`${event.who}:${event.itemId}`, rows);
          }
          if (event.kind === 'field_resource' && spec.leaves.includes(event.itemId)) {
            const key = JSON.stringify([String(event.zoneId), String(event.itemId)]);
            const stockRow = stock.get(key);
            assert.ok(stockRow, `${spec.name}: pickup must map to a published stock row for ${key}`);
            assert.equal(event.initial, stockRow.initial, `${spec.name}: stock initial remains stable at ${key}`);
            assert.ok(Number.isSafeInteger(event.qty) && event.qty > 0);
            assert.equal(event.remaining, stockRow.remaining - event.qty, `${spec.name}: shared stock conservation at ${key}`);
            assert.ok(event.remaining >= 0);
            stockRow.remaining = event.remaining;
            stockRow.taken += event.qty;
            const teamId = targetByActor.has(event.who)
              ? String(savedInput.initialFrame.survivors.find(actor => actor._id === event.who)?.teamId || '') : '';
            if (teamId) {
              const teams = pickupTeamsByStock.get(key) || new Set();
              teams.add(teamId); pickupTeamsByStock.set(key, teams);
            }
          }
        }
        cursor = events.length;
        for (const [key, stockRow] of stock) {
          const published = fieldByZone[stockRow.zoneId]?.[stockRow.itemId];
          assert.ok(published, `${spec.name}: published frame must retain shared stock row ${key}`);
          assert.equal(Number(published.initial), stockRow.initial, `${spec.name}: published initial stock ${key}`);
          assert.equal(Number(published.remaining), stockRow.remaining, `${spec.name}: published remaining stock ${key}`);
          assert.equal(Number(published.taken), stockRow.taken, `${spec.name}: published taken stock ${key}`);
        }
        for (const actor of [...frame.survivors, ...frame.dead]) {
          if (!targetByActor.has(actor._id)) continue;
          const targetId = targetByActor.get(actor._id);
          const progress = getActorGrowthProgress(actor, publicItems);
          const priorTargets = lastTargets.get(actor._id);
          if (priorTargets) assert.ok(progress.targetIds.includes(targetId), `${spec.name}: original goal ID persists.`);
          lastTargets.set(actor._id, [...progress.targetIds]);
          const target = publicItems.find(item => item._id === targetId);
          if (target && expandedTargetActuallyEquipped(actor, target, publicItems) && !firstEquippedAt.has(actor._id)) {
            firstEquippedAt.set(actor._id, frame.matchSec);
          }
        }
      } });
    assert.equal(JSON.stringify(savedInput), savedInputBefore, `${spec.name}: full run input must remain immutable.`);
    assert.ok(result.events.some(event => event.kind === 'match_end'), `${spec.name}: natural full match must finish.`);
    assert.equal(result.events.at(-1)?.kind, 'match_end');
    for (const leafId of spec.leaves) assert.ok(result.events.some(event => event.kind === 'field_resource'
      && event.itemId === leafId), `${spec.name}: each declared real field leaf must have an actual pickup.`);
    for (const [key, rows] of receipts) assert.equal(new Set(rows.map(event => event.actionKey)).size, rows.length,
      `${spec.name}: no duplicate custom craft receipt for ${key}.`);
    console.log(`CUSTOM_SHARED_GROWTH_EXPANDED_MATCH case=${spec.name} phases=${result.evidence.phases} `
      + `frames=${result.evidence.frames} events=${result.events.length} replay=pending`);
    const replay = await runRandomIsolationMatch(null, { savedInput });
    assert.deepEqual(replay.evidence, result.evidence, `${spec.name}: exact full replay evidence.`);
    assert.deepEqual(replay.finalFrame, result.finalFrame);
    assert.deepEqual(replay.events, result.events);
    assert.deepEqual(replay.logs, result.logs);
    assert.equal(JSON.stringify(savedInput), savedInputBefore);

    const finalActors = new Map([...result.finalFrame.survivors, ...result.finalFrame.dead].map(actor => [actor._id, actor]));
    const goalRows = selected.map(actor => {
      const endingActor = finalActors.get(actor._id);
      assert.ok(endingActor, `${spec.name}: retain all four selected actors in the terminal frame.`);
      const targetId = targetByActor.get(actor._id);
      const craftRows = receipts.get(`${actor._id}:${targetId}`) || [];
      const actuallyEquipped = expandedTargetActuallyEquipped(endingActor, fixture.items.find(item => item._id === targetId), fixture.items);
      const everActuallyEquipped = firstEquippedAt.has(actor._id);
      const receiptBeforeEquipment = craftRows.some(event => event.who === actor._id && event.itemId === targetId
        && Number(event.at?.sec) <= Number(firstEquippedAt.get(actor._id)));
      const aliveAtEnd = result.finalFrame.survivors.some(row => row._id === actor._id);
      const completed = !!craftRows.length && everActuallyEquipped;
      return { actorId: actor._id, teamId: actor.teamId, targetId, aliveAtEnd,
        deadAtEnd: result.finalFrame.dead.some(row => row._id === actor._id), completed,
        status: completed ? 'custom-target-equipped' : aliveAtEnd ? 'alive-unfinished' : 'dead-unfinished',
        everActuallyEquipped, firstNightEquipped: (firstEquippedAt.get(actor._id) ?? Infinity) <= firstNightDeadline,
        firstEquippedAtSec: firstEquippedAt.get(actor._id) ?? null, terminalActuallyEquipped: actuallyEquipped,
        customTargetReceiptCount: craftRows.length, receiptBeforeEquipment,
        initialGoalTargetRetained: lastTargets.get(actor._id)?.includes(targetId) === true };
    });
    const trackerReport = tracker.report();
    const crossTeamStock = [...pickupTeamsByStock.entries()].filter(([, teams]) => teams.size > 1).map(([key, teams]) => {
      const row = stock.get(key);
      return { zoneId: row.zoneId, itemId: row.itemId, selectedGoalTeams: [...teams].sort() };
    });
    const casePass = goalRows.every(row => row.customTargetReceiptCount > 0 && row.receiptBeforeEquipment
      && row.firstEquippedAtSec !== null && row.initialGoalTargetRetained);
    const summary = { case: spec.name, matchSeed: spec.matchSeed, initialRosterSeed: spec.rosterSeed,
      participants: 24, selectedGoalDenominator: 4, selectedTeamIds: [...new Set(selected.map(actor => String(actor.teamId)))],
      sameTeamGoalActorCount: selected.filter(actor => String(actor.teamId) === String(selected[0].teamId)).length,
      opposingTeamGoalActorCount: selected.filter(actor => String(actor.teamId) !== String(selected[0].teamId)).length,
      goalRows, initialGoalDenominator: trackerReport.growth.goalParticipants,
      initialGoalAcquisition: { complete: trackerReport.growth.complete, denominator: trackerReport.growth.goalParticipants,
        diedBeforeCompletion: trackerReport.growth.diedBeforeCompletion, identityChanged: trackerReport.growth.goalIdentityChanged,
        participants: trackerReport.growth.total },
      fullTeamRegroup: { started: trackerReport.regroup.started, outcomes: trackerReport.regroup.outcomes,
        denominator: trackerReport.regroup.started },
      customCraftReceiptRows: receipts.size, stockZones: stock.size,
      crossTeamSameZoneLeafPickupsBySelectedGoalActors: crossTeamStock,
      crossTeamDemandLabel: crossTeamStock.length ? 'selected-goal-actors-same-zone-multi-team-pickups-observed' : 'co-demand-only',
      casePass, replayExact: true, savedInputSha256: digest(savedInput), protectedAxisSha256: protectedBefore,
      engine: SIMULATION_ENGINE_VERSION, phases: result.evidence.phases, matchSec: result.finalFrame.matchSec,
      ending: result.evidence.ending, terminalRoster: { survivors: result.finalFrame.survivors.length,
        dead: result.finalFrame.dead.length, denominator: result.finalFrame.survivors.length + result.finalFrame.dead.length },
      events: result.events.length, frames: result.evidence.frames,
      scope: 'Fresh natural 24-person full match; cross-team pickup scope is the four selected goal actors only. No population-rate claim.' };
    summaries.push(summary);
    console.log(`CUSTOM_SHARED_GROWTH_EXPANDED ${JSON.stringify(summary)}`);
  }
  const allCasesPass = summaries.length === 2 && summaries.every(row => row.casePass && row.goalRows.length === 4);
  console.log(`CUSTOM_SHARED_GROWTH_EXPANDED_RESULT ${JSON.stringify({ cases: summaries.length, expectedCases: 2,
    allFourActorsEquippedInBothCases: allCasesPass,
    scope: 'Both fixed cases must pass all four actor/item craft-and-equipment assertions; no replacing seeds or weakening expectations.' })}`);
  assert.ok(allCasesPass, `Both fixed cases require all four actor/item craft-and-equipment assertions; cases=${JSON.stringify(summaries.map(row => ({ case: row.case, casePass: row.casePass, goalRows: row.goalRows })))}`);
}

if (expanded) {
  await runExpandedCases();
} else {
// Fresh 24-participant input, unchanged world resources and starting budgets.
// Only authored item profiles and selected actors' declared goals are changed.
const fixture = JSON.parse(await createRandomIsolationInput('custom-shared-growth-20261014'));
assert.equal(fixture.survivors.length, 24);
const originals = fixture.survivors.map(actor => ({ id: actor._id,
  credits: actor.simCredits, inventory: JSON.stringify(actor.inventory || []), weaponType: actor.weaponType }));
const rawId = 'namu:material:고철';
assert.ok(fixture.items.some(item => item._id === rawId), 'Use an existing field material, not a synthetic supply.');

const first = fixture.survivors[0];
const firstWeapon = normalizeWeaponType(first.weaponType);
assert.ok(firstWeapon, 'The five-slot participant needs a real weapon type.');
const secondIndex = fixture.survivors.findIndex((actor, index) => index > 0
  && normalizeWeaponType(actor.weaponType)
  && normalizeWeaponType(actor.weaponType) !== firstWeapon);
assert.ok(secondIndex > 0, 'The fixture must contain a second participant with a different weapon type.');
const second = fixture.survivors[secondIndex];
const secondWeapon = normalizeWeaponType(second.weaponType);

const batchId = 'guest-item-shared-growth-batch';
const slots = ['weapon', 'head', 'clothes', 'arm', 'shoes'];
const targets = new Map();
const profiles = [{ _id: batchId, name: '공유 묶음 중간재', type: '재료', tier: 2, stackMax: 10,
  recipe: { ingredients: [{ itemId: rawId, qty: 3 }], resultQty: 2, creditsCost: 1 } }];
for (const slot of slots) {
  const id = `guest-item-shared-growth-first-${slot}`;
  targets.set(`${first._id}:${slot}`, id);
  profiles.push({ _id: id, name: `첫 대원 ${slot} 목표`, type: slot === 'weapon' ? '무기' : '방어구',
    equipSlot: slot, ...(slot === 'weapon' ? { weaponType: firstWeapon } : {}), tier: 4, stackMax: 1,
    recipe: { ingredients: [{ itemId: batchId, qty: 1 }], resultQty: 1, creditsCost: 1 } });
}
const secondWeaponId = 'guest-item-shared-growth-second-weapon';
targets.set(`${second._id}:weapon`, secondWeaponId);
profiles.push({ _id: secondWeaponId, name: '둘째 대원 무기 목표', type: '무기', equipSlot: 'weapon',
  weaponType: secondWeapon, tier: 4, stackMax: 1,
  recipe: { ingredients: [{ itemId: batchId, qty: 1 }], resultQty: 1, creditsCost: 1 } });
const headUpgradeId = 'guest-item-shared-growth-head-upgrade';
profiles.push({ _id: headUpgradeId, name: '확보한 목표로 만드는 상위 투구', type: '방어구', equipSlot: 'head', tier: 5, stackMax: 1,
  recipe: { ingredients: [{ itemId: targets.get(`${first._id}:head`), qty: 1 }, { itemId: batchId, qty: 1 }],
    resultQty: 1, creditsCost: 1 } });

const profileResult = readGuestItems(fixture.items, { getItem(key) {
  assert.equal(key, GUEST_ITEM_PROFILE_KEY);
  return JSON.stringify({ schemaVersion: 1, items: profiles });
} });
assert.equal(profileResult.ok, true, profileResult.error);
fixture.items.push(...profileResult.items);
assert.ok(areEquipmentWeaponTypesCompatible(first.weaponType, fixture.items.find(item => item._id === targets.get(`${first._id}:weapon`)).weaponType));
assert.ok(areEquipmentWeaponTypesCompatible(second.weaponType, fixture.items.find(item => item._id === secondWeaponId).weaponType));

function isAuthoredTargetActuallyEquipped(actor, target, items = fixture.items) {
  const slot = inferEquipSlot(target);
  if (!slot) return false;
  const equippedId = String(actor?.equipped?.[slot] || '');
  if (equippedId !== String(target?._id || '')) return false;
  const catalogItem = items.find(item => String(item._id) === equippedId);
  const inventoryItem = (actor?.inventory || []).find(entry => {
    const quantity = entry.qty === undefined ? 1 : Number(entry.qty);
    return getInvItemId(entry) === equippedId && Number.isSafeInteger(quantity) && quantity > 0;
  });
  if (!catalogItem || !inventoryItem) return false;
  const equippedItem = { ...catalogItem, ...inventoryItem };
  if (inferEquipSlot(equippedItem) !== slot) return false;
  return slot !== 'weapon' || areEquipmentWeaponTypesCompatible(actor.weaponType, equippedItem.weaponType);
}

const authoredWeaponTarget = fixture.items.find(item => item._id === secondWeaponId);
const invalidWeaponType = ER_WEAPON_TYPES_KO.find(type => !areEquipmentWeaponTypesCompatible(type, authoredWeaponTarget.weaponType));
assert.ok(invalidWeaponType, 'A known incompatible weapon family must exist for the negative contract.');
const contractActor = { _id: 'equipped-contract-copy', weaponType: second.weaponType,
  inventory: [{ itemId: secondWeaponId, qty: 1, equipSlot: 'weapon', weaponType: secondWeapon }],
  equipped: { weapon: secondWeaponId } };
assert.equal(isAuthoredTargetActuallyEquipped(contractActor, authoredWeaponTarget), true,
  'A positive-quantity, correctly slotted, compatible equipped authored item is observed.');
assert.equal(isAuthoredTargetActuallyEquipped({ ...contractActor, equipped: {} }, authoredWeaponTarget), false,
  'Inventory-only ownership is not actual equipment.');
assert.equal(isAuthoredTargetActuallyEquipped({ ...contractActor, equipped: { head: secondWeaponId } }, authoredWeaponTarget), false,
  'An equipped reference in the wrong actor slot is not actual equipment.');
assert.equal(isAuthoredTargetActuallyEquipped({ ...contractActor,
  inventory: [{ ...contractActor.inventory[0], equipSlot: 'head' }] }, authoredWeaponTarget), false,
  'An item recorded in the wrong equipment slot is not actual equipment.');
assert.equal(isAuthoredTargetActuallyEquipped({ ...contractActor, weaponType: invalidWeaponType }, authoredWeaponTarget), false,
  'An incompatible equipped weapon is not actual equipment.');
assert.equal(isAuthoredTargetActuallyEquipped({ ...contractActor,
  inventory: [{ ...contractActor.inventory[0], qty: 0 }] }, authoredWeaponTarget), false,
  'A zero-quantity inventory row is not actual equipment.');
console.log('PASS actual-equipment-contracts 6/6; independent of inventory growth progress.');

function setGoals(actor, goals) {
  const goalLoadouts = { ...(actor.goalLoadouts || {}), hero: goals };
  const updated = { ...actor, goalLoadouts };
  return mergeInitialRoutePlanFields(updated, buildInitialFastRoutePlan(updated, fixture.map, fixture.items));
}

fixture.survivors[0] = setGoals(first, {
  weaponKey: targets.get(`${first._id}:weapon`), headKey: targets.get(`${first._id}:head`),
  clothesKey: targets.get(`${first._id}:clothes`), armKey: targets.get(`${first._id}:arm`),
  shoesKey: targets.get(`${first._id}:shoes`),
});
fixture.survivors[secondIndex] = setGoals(second, { weaponKey: secondWeaponId });
fixture.survivors[0].goalLoadouts.legend = { ...(fixture.survivors[0].goalLoadouts.legend || {}), headKey: headUpgradeId };
const firstGoalIds = slots.map(slot => targets.get(`${first._id}:${slot}`));
assert.deepEqual(firstGoalIds.filter(id => fixture.survivors[0].routePlanTargetItemIds.includes(id)).sort(), [...firstGoalIds].sort(),
  'The five distinct authored goals must remain in the actual initial route.');
assert.ok(fixture.survivors[secondIndex].routePlanTargetItemIds.includes(secondWeaponId),
  'The other compatible weapon goal must remain in its initial route.');
const secondInitialTargets = [...new Set(fixture.survivors[secondIndex].routePlanTargetItemIds.map(String))];
assert.ok(secondInitialTargets.length >= 1 && secondInitialTargets.includes(secondWeaponId),
  'The second participant keeps its authored weapon while the initial route may add natural slot targets.');
for (const actorIndex of [0, secondIndex]) {
  const actor = fixture.survivors[actorIndex];
  assert.equal(actor.simCredits, originals[actorIndex].credits);
  assert.equal(JSON.stringify(actor.inventory || []), originals[actorIndex].inventory);
  assert.ok(actor.routePlanRequiredItemIds.includes(rawId), 'Both plans must demand the same real raw leaf.');
}
assert.equal(fixture.survivors[0].simCredits, 15, 'No starting credit grant is allowed.');
assert.equal(JSON.stringify(fixture.survivors[0].inventory || []), '[]', 'No starting inventory grant is allowed.');

const savedInput = createSimulationRunInput({ activeMap: fixture.map, settings: fixture.settings,
  survivors: fixture.survivors, publicItems: fixture.items, runSeed: fixture.runSeed }, { getItem: () => null });
const savedInputBefore = JSON.stringify(savedInput);
const dayOneRules = getRuleset(savedInput.settings.rulesetId || 'ER_S11');
const deadline = getPhaseDurationSec(dayOneRules, 1, 'morning') + getPhaseDurationSec(dayOneRules, 1, 'night');
const goalActors = new Set([first._id, second._id]);
const recipeById = new Map(profileResult.items.map(item => [item._id, item.recipe]));
const crafts = new Map();
const lastProgress = new Map();
const authoredGoals = new Map([[first._id, firstGoalIds], [second._id, [secondWeaponId]]]);
const firstEquippedAt = new Map();
const rawPickups = new Map();
const stockRemaining = new Map();
const rawDepletions = [];
let cursor = 0;

console.log(`CUSTOM_SHARED_GROWTH_START engine=${SIMULATION_ENGINE_VERSION} participants=24 goals=5+1 `
  + `sharedLeaf=${rawId} initialCredits=${first.simCredits}/${second.simCredits} deadline=${deadline}s`);
const result = await runRandomIsolationMatch(null, { savedInput, stopAfterPhase: { day: 1, phase: 'night' },
  onFrame(frame, { events, publicItems }) {
    for (const event of events.slice(cursor)) {
      if (event.kind === 'field_resource' && event.itemId === rawId) {
        const key = `${event.zoneId}:${event.itemId}`;
        const remaining = stockRemaining.has(key) ? stockRemaining.get(key) : event.initial;
        assert.equal(event.remaining, remaining - event.qty, `real shared stock conservation at ${key}`);
        assert.ok(event.remaining >= 0);
        stockRemaining.set(key, event.remaining);
        if (event.remaining === 0) rawDepletions.push({ sec: event.at?.sec, zoneId: event.zoneId, who: event.who });
        if (goalActors.has(event.who)) rawPickups.set(event.who, (rawPickups.get(event.who) || 0) + event.qty);
      }
      const recipe = recipeById.get(event.itemId);
      if (event.kind !== 'craft' || !recipe) continue;
      assert.equal(event.receiptVersion, 1);
      assert.equal(event.qty, recipe.resultQty);
      assert.equal(event.paidCost, recipe.creditsCost);
      assert.equal(event.beforeCredits - event.afterCredits, recipe.creditsCost);
      assert.deepEqual(event.consumed, recipe.ingredients);
      const rows = crafts.get(event.who) || [];
      rows.push(event);
      crafts.set(event.who, rows);
    }
    cursor = events.length;
    for (const actor of frame.survivors) {
      if (!goalActors.has(actor._id)) continue;
      const progress = getActorGrowthProgress(actor, publicItems);
      lastProgress.set(actor._id, { sec: frame.matchSec, alive: true, completedSlots: progress.completedSlots,
        totalSlots: progress.totalSlots, openingComplete: progress.openingComplete,
        issues: progress.goalIssues, targetIds: progress.targetIds, targetId: actor._growthPlan?.targetId || '',
        blocked: actor._growthPlan?.blocked || '', equipped: { ...(actor.equipped || {}) }, credits: actor.simCredits });
      for (const targetId of authoredGoals.get(actor._id) || []) {
        const key = `${actor._id}:${targetId}`;
        if (!firstEquippedAt.has(key)) {
          const target = publicItems.find(item => String(item._id) === targetId);
          if (target && isAuthoredTargetActuallyEquipped(actor, target, publicItems)) {
            firstEquippedAt.set(key, { sec: frame.matchSec, actorId: actor._id, targetId });
          }
        }
      }
    }
    for (const actor of frame.dead) if (goalActors.has(actor._id)) {
      const progress = getActorGrowthProgress(actor, publicItems);
      lastProgress.set(actor._id, { sec: frame.matchSec, alive: false, completedSlots: progress.completedSlots,
        totalSlots: progress.totalSlots, openingComplete: progress.openingComplete,
        issues: progress.goalIssues, targetIds: progress.targetIds, targetId: actor._growthPlan?.targetId || '',
        blocked: actor._growthPlan?.blocked || '', equipped: { ...(actor.equipped || {}) }, credits: actor.simCredits });
      for (const targetId of authoredGoals.get(actor._id) || []) {
        const key = `${actor._id}:${targetId}`;
        if (!firstEquippedAt.has(key)) {
          const target = publicItems.find(item => String(item._id) === targetId);
          if (target && isAuthoredTargetActuallyEquipped(actor, target, publicItems)) {
            firstEquippedAt.set(key, { sec: frame.matchSec, actorId: actor._id, targetId });
          }
        }
      }
    }
  },
});

assert.equal(result.finalFrame.matchSec, deadline, 'This is a bounded first-night observation, not a full match.');
assert.equal(JSON.stringify(savedInput), savedInputBefore, 'The actual run must not mutate the saved input.');
assert.ok(result.events.some(event => event.kind === 'battle'), 'The unchanged natural roster should reach combat during the sample.');
const equippedTierBySlot = (actor, slot) => {
  const equippedId = String(actor.equipped?.[slot] || '');
  const inventoryItem = (actor.inventory || []).find(entry => {
    const quantity = entry.qty === undefined ? 1 : Number(entry.qty);
    return getInvItemId(entry) === equippedId && Number.isSafeInteger(quantity) && quantity > 0;
  });
  const item = fixture.items.find(row => String(row._id) === equippedId);
  const equippedItem = item && inventoryItem ? { ...item, ...inventoryItem } : null;
  return { equippedId, item: equippedItem && inferEquipSlot(equippedItem) === slot ? equippedItem : null };
};
const terminalGrowth = [];
for (const [actorId, declaredIds] of authoredGoals) {
  const actor = [...result.finalFrame.survivors, ...result.finalFrame.dead].find(row => row._id === actorId);
  assert.ok(actor, `The terminal frame must retain goal actor ${actorId}, alive or dead.`);
  const progress = getActorGrowthProgress(actor, fixture.items);
  assert.ok(declaredIds.every(id => progress.targetIds.includes(id)),
    `Growth reporting must preserve every authored custom target for ${actorId}.`);
  assert.equal(progress.totalSlots, progress.targetIds.length,
    `Growth slot count must include the actual route targets for ${actorId}, including permitted natural additions.`);
  assert.equal(progress.completedSlots, progress.targets.length - progress.remaining.length,
    `Reported growth completion must match the runtime's inventory-based target semantics for ${actorId}.`);
  const actualEquipped = progress.targets.filter(target => {
    const slot = target.equipSlot;
    const { equippedId, item } = equippedTierBySlot(actor, slot);
    return !!equippedId && !!item
      && (slot !== 'weapon' || areEquipmentWeaponTypesCompatible(actor.weaponType, item.weaponType))
      && (equippedId === String(target._id)
        || Number(item.tier || 0) > Number(target.tier || 0));
  }).map(target => target._id);
  terminalGrowth.push({ actorId, alive: result.finalFrame.survivors.some(row => row._id === actorId),
    declaredTargetIds: declaredIds, routeTargetIds: progress.targetIds, reportedCompletedSlots: progress.completedSlots,
    reportedTotalSlots: progress.totalSlots, equipped: { ...(actor.equipped || {}) },
    actualEquippedSatisfiedIds: actualEquipped });
}
const firstNightAuthoredEquipment = [...authoredGoals].flatMap(([actorId, targetIds]) => targetIds.map(targetId => ({
  actorId, targetId, firstEquippedAtSec: firstEquippedAt.get(`${actorId}:${targetId}`)?.sec ?? null,
})));
console.log(`CUSTOM_SHARED_GROWTH_EQUIPPED_EXPOSURE ${JSON.stringify(firstNightAuthoredEquipment)}`);
assert.equal(firstNightAuthoredEquipment.length, 6, 'The scoped first-night contract contains five plus one authored equipment targets.');
assert.ok(firstNightAuthoredEquipment.every(row => Number.isFinite(row.firstEquippedAtSec)
  && row.firstEquippedAtSec <= deadline),
  `Every authored target for the two selected participants must be in positive-quantity inventory and correctly equipped by the first-night deadline; observed=${JSON.stringify(firstNightAuthoredEquipment)}`);
const firstActorCrafts = crafts.get(first._id) || [];
const upgradeReceipts = firstActorCrafts.filter(event => event.itemId === headUpgradeId);
assert.equal(upgradeReceipts.length, 1, 'The real loop must consume the actual authored head in its requested upgrade.');
assert.equal(firstActorCrafts.filter(event => event.itemId === targets.get(`${first._id}:head`)).length, 1,
  'An acquired-and-consumed opening target must not be crafted again forever.');
const firstTerminal = [...result.finalFrame.survivors, ...result.finalFrame.dead].find(actor => actor._id === first._id);
assert.equal(firstTerminal._openingAcquiredItemIds.head, targets.get(`${first._id}:head`));
assert.equal(getActorGrowthProgress(firstTerminal, fixture.items).openingComplete, true);
for (const actor of [fixture.survivors[0], fixture.survivors[secondIndex]]) {
  const rows = crafts.get(actor._id) || [];
  assert.equal(new Set(rows.map(event => event.actionKey)).size, rows.length, 'No authored craft receipt may execute twice.');
}
const observedStock = result.events.filter(event => event.kind === 'field_resource' && event.itemId === rawId);
assert.ok(observedStock.length > 0, 'The actual map must expose the declared shared leaf during the bounded sample.');
const summary = [first, second].map(actor => ({ id: actor._id,
  goals: actor._id === first._id ? firstGoalIds : [secondWeaponId],
  rawPickedQty: rawPickups.get(actor._id) || 0,
  customCrafts: (crafts.get(actor._id) || []).map(event => ({ itemId: event.itemId, sec: event.at.sec,
    paidCost: event.paidCost, qty: event.qty })),
  lastProgress: lastProgress.get(actor._id) || { alive: false, reason: 'not-observed-before-sample-end' },
}));
console.log(`CUSTOM_SHARED_GROWTH_OBSERVATION ${JSON.stringify({ engine: SIMULATION_ENGINE_VERSION,
  deadline, actualSec: result.finalFrame.matchSec, events: result.events.length, frames: result.evidence.frames,
  sharedLeafPickups: observedStock.length, sharedStockZones: stockRemaining.size, participants: summary,
  sharedLeafDepletions: rawDepletions,
  terminalGrowth,
  firstNightAuthoredEquipment,
  scope: 'Fresh 24-participant first-night actual-loop observation; five authored equipment goals plus one distinct compatible weapon goal sharing one real field leaf. Scoped authored-equipment exposure assertion only; no general survival, completion, or winner rate assertion.' })}`);

const replay = await runRandomIsolationMatch(null, { savedInput,
  stopAfterPhase: { day: 1, phase: 'night' } });
assert.deepEqual(replay.evidence, result.evidence, 'Fresh bounded replay retains all event/frame digests, RNG and the same stopping boundary.');
assert.deepEqual(replay.finalFrame, result.finalFrame);
assert.deepEqual(replay.events, result.events);
assert.deepEqual(replay.logs, result.logs);
assert.equal(JSON.stringify(savedInput), savedInputBefore);
console.log(`CUSTOM_SHARED_GROWTH_REPLAY phases=${result.evidence.phases} frames=${result.evidence.frames} events=${result.events.length} `
  + `upgradeCrafts=${upgradeReceipts.length} openingHeadCrafts=1 exact=true scope=first-night-not-full-match`);
}
