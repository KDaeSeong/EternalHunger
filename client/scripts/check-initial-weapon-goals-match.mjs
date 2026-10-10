import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { buildGuestSimulationRoster } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { applyGuestCharacterProfiles } = await import('../src/app/simulation/_lib/guestCharacterProfileRuntime.js');
const { buildInitialSimulationRoster } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { getActorGrowthProgress } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getValidRecipeIngredients } = await import('../src/app/simulation/_lib/gearRecipeGuardRuntime.js');
const { inferEquipSlot, inferItemCategory } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { areEquipmentWeaponTypesCompatible } = await import('../src/utils/equipmentCatalog.js');
const { ER_WEAPON_TYPES_KO, normalizeErWeaponType } = await import('../src/utils/erMeta.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

const runSeed = 'initial-weapon-goal-competitive-20261010';
const initialRosterSeed = 'initial-weapon-goal-roster-20261010';
const watchedId = 'guest-survivor-01';
const firstNight = { day: 1, phase: 'night' };

const base = JSON.parse(await createRandomIsolationInput(runSeed, { initialRosterSeed }));
const items = base.items;
const target = items.filter((item) => item && Number(item.tier) === 4 && inferItemCategory(item) === 'equipment'
  && inferEquipSlot(item) === 'weapon' && getValidRecipeIngredients(item)
  && !String(item._id || '').startsWith('wpn_') && !String(item._id || '').startsWith('eq_')
  && item.lockedByAdmin !== 'deleted' && ER_WEAPON_TYPES_KO.includes(normalizeErWeaponType(item.weaponType))
  && items.find((row) => [row?.itemKey, row?.externalId, row?._id]
    .some((alias) => String(alias ?? '').trim() === String(item._id))) === item)
  .sort((a, b) => String(a._id).localeCompare(String(b._id)))[0];
assert.ok(target, '현재 내장 카탈로그에 실제 레시피가 있는 T4 무기가 있어야 합니다.');
const goalWeaponType = normalizeErWeaponType(target.weaponType);
const incompatibleWeaponType = ER_WEAPON_TYPES_KO.find((type) => type !== goalWeaponType
  && !areEquipmentWeaponTypesCompatible(type, goalWeaponType));
assert.ok(incompatibleWeaponType, '목표 무기와 호환되지 않는 두 번째 허용 무기가 있어야 합니다.');
const allowedWeapons = [incompatibleWeaponType, goalWeaponType];
const goalKey = String(target._id);

const chars = applyGuestCharacterProfiles(buildGuestSimulationRoster(), []);
assert.equal(chars.length, 24, 'fresh guest 경쟁 roster는 24명이어야 합니다.');
const watched = chars.find((actor) => actor._id === watchedId);
assert.ok(watched, '지정한 관전 대상 참가자가 있어야 합니다.');
const charListBefore = structuredClone(chars);
const targetBefore = structuredClone(target);
watched.erWeapons = [...allowedWeapons];
watched.goalLoadouts = {
  ...(watched.goalLoadouts && typeof watched.goalLoadouts === 'object' ? watched.goalLoadouts : {}),
  hero: { ...(watched.goalLoadouts?.hero || {}), weaponKey: goalKey },
};
for (const original of charListBefore) {
  if (original._id === watchedId) continue;
  assert.deepEqual(chars.find((actor) => actor._id === original._id), original,
    '다른 23명의 캐릭터 입력은 바꾸면 안 됩니다.');
}
assert.deepEqual(target, targetBefore, '카탈로그 입력은 변경하면 안 됩니다.');
const authoredBefore = structuredClone({ chars, items, map: base.map, settings: base.settings });

const initialized = withSimulationRandom(createSeedRng(initialRosterSeed), () => buildInitialSimulationRoster({
  charList: chars,
  routeItems: items,
  initialMap: base.map,
  initialZoneIds: base.map.zones.map((zone) => zone.zoneId),
  loadedSettings: base.settings,
}));
assert.equal(initialized.shuffledChars.length, 24);
const initializedTarget = initialized.shuffledChars.find((actor) => actor._id === watchedId);
assert.ok(initializedTarget);
assert.equal(initializedTarget.runWeaponType, goalWeaponType,
  '실제 roster 초기화는 작성된 T4 무기 목표와 호환되는 runWeaponType을 선택해야 합니다.');
assert.equal(initializedTarget.weaponType, goalWeaponType);
assert.deepEqual(initializedTarget.erWeapons, allowedWeapons,
  '목표 동기화는 사용자가 지정한 허용 무기 두 개를 제거하거나 재작성하면 안 됩니다.');
assert.equal(initializedTarget.goalLoadouts.hero.weaponKey, goalKey,
  '저장 목표 키를 다른 무기로 덮어쓰면 안 됩니다.');
assert.ok(initializedTarget.routePlanTargetItemIds.includes(String(target._id)),
  '실제 초기 경로가 지정한 목표 ID를 가져야 합니다.');
assert.deepEqual(getActorGrowthProgress(initializedTarget, items).goalIssues, [],
  '호환 목표는 성장 계획에서 무기 불일치가 아니어야 합니다.');
assert.deepEqual(initializedTarget.inventory, [], '경기 입력에 재료·장비를 주입하면 안 됩니다.');
assert.deepEqual({ chars, items, map: base.map, settings: base.settings }, authoredBefore,
  '실제 명단 초기화는 호출 시점의 작성 캐릭터·카탈로그·지도·설정을 바꾸면 안 됩니다.');

const inputObject = {
  map: base.map,
  settings: base.settings,
  items,
  survivors: initialized.shuffledChars,
  runSeed,
  initialRosterSeed,
};
const input = JSON.stringify(inputObject);
const inputBeforeRuns = structuredClone(inputObject);

async function runAndObserve() {
  let watchedCrafts = [];
  let equippedGoal = false;
  let fiveSlotCompletionSec = null;
  const result = await runRandomIsolationMatch(input, {
    stopAfterPhase: firstNight,
    onFrame(frame, { publicItems, events }) {
      const actor = [...frame.survivors, ...frame.dead].find((row) => row._id === watchedId);
      if (!actor) return;
      watchedCrafts = events.filter((event) => event.kind === 'craft' && event.who === watchedId
        && event.itemId === String(target._id));
      if (watchedCrafts.length && actor.equipped?.weapon === String(target._id)) equippedGoal = true;
      const growth = getActorGrowthProgress(actor, publicItems);
      if (fiveSlotCompletionSec === null && growth.totalSlots === 5 && growth.completedSlots === 5
        && growth.openingComplete && growth.goalIssues.length === 0) fiveSlotCompletionSec = frame.matchSec;
    },
  });
  assert.equal(result.finalFrame.day, 1);
  assert.equal(result.finalFrame.phase, 'night');
  assert.ok(result.events.some((event) => event.kind === 'battle'),
    '안전한 훈련 대체가 아니라 실제 24인 경쟁을 유지해야 합니다.');
  assert.ok(watchedCrafts.length > 0, `${watchedId}이 목표 무기 ID를 실제 제작해야 합니다.`);
  assert.ok(equippedGoal, `${watchedId}의 실제 목표 무기가 장착된 프레임이 있어야 합니다.`);
  assert.notEqual(fiveSlotCompletionSec, null,
    `${watchedId}이 첫날 밤까지 실제 5슬롯 성장 완료를 보여야 합니다.`);
  return { result, receipt: { watchedCrafts, equippedGoal, fiveSlotCompletionSec } };
}

const first = await runAndObserve();
const second = await runAndObserve();
assert.deepEqual(first.receipt, second.receipt, '두 반복에서 목표 제작·장착·성장 완료가 같아야 합니다.');
assert.deepEqual(first.result.events, second.result.events, '같은 fresh 입력의 전체 이벤트가 같아야 합니다.');
assert.deepEqual(first.result.finalFrame, second.result.finalFrame, '같은 fresh 입력의 최종 프레임이 같아야 합니다.');
assert.deepEqual(first.result.logs, second.result.logs, '같은 fresh 입력의 로그가 같아야 합니다.');
assert.deepEqual(first.result.evidence, second.result.evidence,
  '같은 fresh 입력의 이벤트/프레임 수·지문·난수 종료 상태가 같아야 합니다.');
assert.deepEqual(inputObject, inputBeforeRuns, '두 실행 뒤에도 실제 원 입력 객체가 보존되어야 합니다.');

console.log(`INITIAL_WEAPON_GOALS_COMPETITIVE_MATCH ${JSON.stringify({
  pass: true,
  runSeed,
  initialRosterSeed,
  watchedId,
  goalItemId: target._id,
  goalWeaponType,
  allowedWeapons,
  selectedRunWeaponType: initializedTarget.runWeaponType,
  watchedCrafts: first.receipt.watchedCrafts.length,
  equippedGoal: first.receipt.equippedGoal,
  fiveSlotCompletionSec: first.receipt.fiveSlotCompletionSec,
  events: first.result.evidence.eventCount,
  frames: first.result.evidence.frames,
  frameDigest: first.result.evidence.frameDigest,
  eventDigest: first.result.evidence.eventDigest,
  finalRandomState: first.result.evidence.random,
  scope: 'One current bundled catalog and fresh 24-actor competitive input through day-one night; not a guarantee for custom catalogs, deaths, unavailable recipes, all seeds, UI behavior or human evaluation.',
})}`);
