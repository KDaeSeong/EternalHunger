import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const libRootUrl = new URL('../src/app/games/schale-idle-rpg/_lib/', import.meta.url);
const componentRootUrl = new URL('../src/app/games/schale-idle-rpg/_components/', import.meta.url);
const sharedComponentRootUrl = new URL('../src/app/games/_components/', import.meta.url);
const sharedLibRootUrl = new URL('../src/app/games/_lib/', import.meta.url);

const dataSource = await readFile(new URL('schaleIdleData.js', libRootUrl), 'utf8');
const dataUrl = `data:text/javascript;base64,${Buffer.from(dataSource).toString('base64')}`;
const engineSource = (await readFile(new URL('schaleIdleEngine.js', libRootUrl), 'utf8'))
  .replaceAll("} from './schaleIdleData';", `} from '${dataUrl}';`);
const engineUrl = `data:text/javascript;base64,${Buffer.from(engineSource).toString('base64')}`;
const engine = await import(engineUrl);
const feedbackSource = await readFile(new URL('schaleIdleFeedback.js', libRootUrl), 'utf8');
const feedbackUrl = `data:text/javascript;base64,${Buffer.from(feedbackSource).toString('base64')}`;
const feedback = await import(feedbackUrl);

const gearSource = await readFile(new URL('SchaleIdleGearTab.js', componentRootUrl), 'utf8');
const dutySource = await readFile(new URL('SchaleIdleDutyTab.js', componentRootUrl), 'utf8');
const featureSource = await readFile(new URL('SchaleIdleFeatureTabs.js', componentRootUrl), 'utf8');
const iconSource = await readFile(new URL('GameActionIcon.js', sharedComponentRootUrl), 'utf8');
const sfxSource = await readFile(new URL('useGameSfx.js', sharedLibRootUrl), 'utf8');
const styleSource = await readFile(new URL('../src/styles/AppShell.css', import.meta.url), 'utf8');

const base = engine.createNewState({ now: '2026-07-12T00:00:00.000Z', runId: 'schale-check' });
assert.equal(base.version, 'schale-idle-rpg-v2', '새 당직은 UID 장비 세이브 버전을 사용해야 합니다.');
assert.deepEqual(base.equipment, {}, '새 당직의 장착 슬롯은 비어 있어야 합니다.');
assert.deepEqual(base.equipmentInventory, {}, '새 당직의 장비 보관함은 비어 있어야 합니다.');

const legacyWeapon = {
  uid: 'legacy-weapon',
  itemId: 'eq_rusty_rifle',
  slot: 'WEAPON',
  rarity: 'UNCOMMON',
  enhance: 3,
};
const legacyReserve = {
  uid: 'legacy-reserve',
  itemId: 'eq_rusty_rifle',
  slot: 'WEAPON',
  rarity: 'UNCOMMON',
  enhance: 1,
};
const migratedSiteSave = engine.normalizeState({
  ...base,
  version: 'schale-idle-rpg-v1',
  equipment: { WEAPON: legacyWeapon },
  salvageQueue: [{ uid: legacyReserve.uid, equip: legacyReserve, reason: '구형 대기열' }],
});
assert.equal(migratedSiteSave.version, 'schale-idle-rpg-v2', '사이트 구형 세이브는 v2로 승격되어야 합니다.');
assert.equal(migratedSiteSave.equipment.WEAPON, legacyWeapon.uid, '슬롯 객체는 UID 참조로 변환되어야 합니다.');
assert.equal(migratedSiteSave.equipmentInventory[legacyWeapon.uid].enhance, 3, '장착 장비 강화 수치를 보존해야 합니다.');
assert.ok(migratedSiteSave.equipmentInventory[legacyReserve.uid], '구형 분해 대기 장비도 보관함에 남아야 합니다.');

const sourceSave = engine.normalizeState({
  version: '1.34',
  runId: 'source-save',
  inventory: {
    stack: { itm_scrap: 37, itm_battery: 4 },
    equip: {
      'source-weapon': {
        uid: 'source-weapon',
        itemId: 'eq_rusty_rifle',
        enhanceLevel: 5,
        affixes: [],
      },
      'source-armor': {
        uid: 'source-armor',
        itemId: 'eq_field_armor',
        enhanceLevel: 2,
        affixes: [],
      },
    },
  },
  equipment: { WEAPON: 'source-weapon' },
});
assert.equal(sourceSave.inventory.itm_scrap, 37, '원본 inventory.stack을 사이트 스택 인벤토리로 변환해야 합니다.');
assert.equal(sourceSave.equipment.WEAPON, 'source-weapon', '원본 슬롯 UID를 유지해야 합니다.');
assert.equal(sourceSave.equipmentInventory['source-weapon'].enhance, 5, '원본 enhanceLevel을 보존해야 합니다.');
assert.ok(sourceSave.salvageQueue.some((entry) => entry.uid === 'source-armor'), '원본 예비 장비는 보관 및 분해 후보로 이관되어야 합니다.');

const richState = engine.normalizeState({
  ...base,
  credits: 5000,
  inventory: {
    ...base.inventory,
    itm_scrap: 500,
    itm_battery: 50,
    itm_bandage: 50,
    itm_memory_chip: 50,
    itm_tower_token: 100,
  },
});
const craftedOnce = engine.craftRecipeAction(richState, 'rcp_rusty_rifle');
const craftedTwice = engine.craftRecipeAction(craftedOnce, 'rcp_rusty_rifle');
assert.equal(Object.keys(craftedTwice.equipmentInventory).length, 2, '같은 장비를 두 번 제작해도 두 UID를 모두 보존해야 합니다.');
assert.equal(typeof craftedTwice.equipment.WEAPON, 'string', '장착 슬롯에는 장비 객체가 아니라 UID가 저장되어야 합니다.');
assert.equal(craftedTwice.salvageQueue.length, 1, '비장착 장비는 분해 대기열에 한 번만 등록되어야 합니다.');

const reserveUid = craftedTwice.salvageQueue[0].uid;
const previousUid = craftedTwice.equipment.WEAPON;
const manuallyEquipped = engine.equipEquipmentAction(craftedTwice, reserveUid);
assert.equal(manuallyEquipped.equipment.WEAPON, reserveUid, '보관 장비를 UID로 직접 장착할 수 있어야 합니다.');
assert.ok(!manuallyEquipped.salvageQueue.some((entry) => entry.uid === reserveUid), '장착한 장비는 분해 대기열에서 빠져야 합니다.');
assert.ok(manuallyEquipped.salvageQueue.some((entry) => entry.uid === previousUid), '교체된 장비는 보관 및 분해 후보로 남아야 합니다.');

const locked = engine.toggleEquipmentProtectionAction(manuallyEquipped, previousUid, 'locked');
const unsafeSalvage = engine.setSalvageCandidateOnlyAction(locked, false);
const afterLockedSalvage = engine.autoSalvageAction(unsafeSalvage);
assert.ok(afterLockedSalvage.equipmentInventory[previousUid], '잠금 장비는 전체 분해 모드에서도 보존되어야 합니다.');
assert.ok(afterLockedSalvage.salvageQueue.some((entry) => entry.uid === previousUid), '잠금 장비는 대기열에서 보호 상태로 남아야 합니다.');

const unlocked = engine.toggleEquipmentProtectionAction(afterLockedSalvage, previousUid, 'locked');
const favorite = engine.toggleEquipmentProtectionAction(unlocked, previousUid, 'favorite');
const afterFavoriteSalvage = engine.autoSalvageAction(favorite);
assert.ok(afterFavoriteSalvage.equipmentInventory[previousUid], '즐겨찾기 장비도 전체 분해 모드에서 보존되어야 합니다.');

const presetSaved = engine.saveEquipmentPresetAction(manuallyEquipped, '검증 세트');
const presetId = presetSaved.activePresetId;
const alternateUid = presetSaved.salvageQueue.find((entry) => entry.uid !== presetSaved.equipment.WEAPON)?.uid
  || presetSaved.salvageQueue[0]?.uid;
assert.ok(alternateUid, '프리셋 검증용 예비 장비가 있어야 합니다.');
const switched = engine.equipEquipmentAction(presetSaved, alternateUid);
const presetApplied = engine.applyEquipmentPresetAction(switched, presetId);
assert.equal(presetApplied.equipment.WEAPON, reserveUid, '프리셋은 저장된 UID 장착 상태를 복원해야 합니다.');

const noMaterialPlan = engine.recipeCostPlan(engine.normalizeState({ ...base, credits: 0, inventory: {} }), 'rcp_rusty_rifle');
assert.equal(noMaterialPlan.canCraft, false, '크레딧이나 재료가 부족하면 제작을 비활성화해야 합니다.');
assert.match(noMaterialPlan.shortageText, /크레딧/, '제작 불가 사유에 부족한 크레딧을 포함해야 합니다.');
assert.ok(noMaterialPlan.materialRows.every((row) => !row.met), '재료별 보유량 부족을 계산해야 합니다.');

const cueForCounter = (key, cue) => {
  const previous = engine.normalizeState({ ...base, counters: { ...base.counters, [key]: 0 } });
  const next = engine.normalizeState({ ...previous, counters: { ...previous.counters, [key]: 1 } });
  assert.equal(feedback.schaleIdleResultCue(previous, next), cue, `${key} 변화는 ${cue} 효과음을 반환해야 합니다.`);
};
cueForCounter('CRAFT', 'craftComplete');
cueForCounter('REROLL', 'reroll');
cueForCounter('SALVAGE', 'salvage');
cueForCounter('SHOP_BUY', 'shop');
cueForCounter('SHOP_RESET', 'shopRefresh');
cueForCounter('UPGRADE', 'research');
cueForCounter('EQUIP', 'equip');
cueForCounter('EQUIP_LOCK', 'lock');
cueForCounter('EQUIP_FAVORITE', 'favorite');
cueForCounter('PRESET', 'preset');

assert.equal(feedback.schaleIdleResultCue(base, {
  ...base,
  towerLastBatchReport: { at: 1, successes: 1 },
}), 'towerClear', '탑 승리는 전용 클리어 큐를 사용해야 합니다.');
assert.equal(feedback.schaleIdleResultCue(base, {
  ...base,
  towerLastBatchReport: { at: 1, successes: 0 },
}), 'towerFail', '탑 패배는 전용 실패 큐를 사용해야 합니다.');
assert.equal(feedback.schaleIdleResultCue(base, {
  ...base,
  lastDutyReport: { at: 1 },
  counters: { ...base.counters, CLEAR_FLOOR: 1 },
}), 'dutyComplete', '당직 클리어는 완료 큐를 사용해야 합니다.');
assert.equal(feedback.schaleIdleResultCue(base, {
  ...base,
  lastDutyReport: { at: 1 },
}), 'defeat', '당직 실패는 패배 큐를 사용해야 합니다.');
assert.equal(feedback.schaleIdleResultCue(base, {
  ...base,
  counters: { ...base.counters, ENHANCE_TRY: 1, ENHANCE_SUCCESS: 1 },
}), 'enhanceSuccess', '강화 성공은 성공 큐를 사용해야 합니다.');
assert.equal(feedback.schaleIdleResultCue(base, {
  ...base,
  counters: { ...base.counters, ENHANCE_TRY: 1 },
}), 'enhanceFail', '강화 실패는 실패 큐를 사용해야 합니다.');
assert.equal(feedback.schaleIdleResultCue(base, {
  ...base,
  claimedMissions: ['mission-check'],
}), 'reward', '보상 수령은 보상 큐를 사용해야 합니다.');

assert.match(gearSource, /장비 보관함/, '장비 탭에 UID 보관함이 표시되어야 합니다.');
assert.match(gearSource, /equipEquipmentAction/, '보관함에서 직접 장착 동작을 제공해야 합니다.');
assert.match(gearSource, /toggleEquipmentProtectionAction/, '장비 잠금과 즐겨찾기 동작을 제공해야 합니다.');
assert.match(dutySource, /disabled=\{!selectedRecipePlan\.canCraft\}/, '제작 버튼은 비용 부족 시 비활성화되어야 합니다.');
assert.ok(featureSource.indexOf("id: 'duty'") < featureSource.indexOf("id: 'plan'"), '실제 당직 탭이 운영 리포트보다 먼저 열려야 합니다.');
assert.match(dutySource, /schale-duty-panel--settle/, '당직 정산 패널에 행동 우선순위 클래스가 있어야 합니다.');
assert.match(styleSource, /\.schale-duty-panel--settle\s*\{\s*order:\s*1;/, '당직 정산이 성장 리포트보다 먼저 보여야 합니다.');
assert.match(styleSource, /@media \(max-width: 720px\)[\s\S]*\.schale-equipment-actions > button/, '모바일 장비 버튼은 가용 폭에 맞춰 재배치되어야 합니다.');
assert.match(styleSource, /\.schale-equipment-vault\s*\{[\s\S]*max-height:/, '장비 보관함은 내부 스크롤로 페이지 길이를 제한해야 합니다.');
assert.match(iconSource, /favorite:\s*Star/, '즐겨찾기 행동은 별 아이콘을 사용해야 합니다.');
assert.match(sfxSource, /favorite:\s*\[/, '즐겨찾기 전용 효과음이 있어야 합니다.');
assert.match(sfxSource, /shopRefresh:\s*\[/, '상점 갱신 전용 효과음이 있어야 합니다.');
assert.doesNotMatch(engineSource, /이\(가\)|은\(는\)|을\(를\)|\(으\)로/, '플레이어 로그에 병기형 조사가 남으면 안 됩니다.');

console.log(JSON.stringify({
  saveVersion: base.version,
  migratedSiteEquipment: Object.keys(migratedSiteSave.equipmentInventory).length,
  migratedSourceEquipment: Object.keys(sourceSave.equipmentInventory).length,
  craftedEquipment: Object.keys(craftedTwice.equipmentInventory).length,
  protectedLocked: Boolean(afterLockedSalvage.equipmentInventory[previousUid]),
  protectedFavorite: Boolean(afterFavoriteSalvage.equipmentInventory[previousUid]),
  presetRestored: presetApplied.equipment.WEAPON === reserveUid,
  feedbackCues: 17,
}, null, 2));
