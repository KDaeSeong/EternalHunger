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
const pageSource = await readFile(new URL('../src/app/games/schale-idle-rpg/play/page.js', import.meta.url), 'utf8');
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

function createEnhanceState({
  itemId,
  slot,
  level = 0,
  failStreak = 0,
  runId = 'enhance-check',
  autoUseProtectionTicket = false,
  protectionPreference = 'AUTO',
  pityPolicyOnProtection = 'KEEP',
  protectionStock = {},
  withPreset = false,
}) {
  const uid = `${itemId}-uid`;
  return engine.normalizeState({
    ...base,
    runId,
    credits: 999999,
    inventory: {
      ...base.inventory,
      itm_scrap: 9999,
      itm_bandage: 999,
      itm_battery: 999,
      itm_memory_chip: 999,
      itm_enhance_stone: 999,
      itm_protect_ticket: 0,
      itm_protect_downgrade: 0,
      itm_protect_destroy: 0,
      itm_protect_charm: 0,
      ...protectionStock,
    },
    equipment: { [slot]: uid },
    equipmentInventory: {
      [uid]: {
        uid,
        itemId,
        slot,
        enhance: level,
        affixes: [],
      },
    },
    equipmentPresets: withPreset ? [{ id: 'enhance-preset', name: '강화 검증', equipment: { [slot]: uid } }] : [],
    activePresetId: withPreset ? 'enhance-preset' : '',
    autoUseProtectionTicket,
    protectionPreference,
    pityPolicyOnProtection,
    enhanceFailStreakByUid: failStreak ? { [uid]: failStreak } : {},
    lastEnhanceResult: null,
  });
}

function findEnhanceOutcome(options, expectedOutcome) {
  for (let index = 0; index < 500; index += 1) {
    const previous = createEnhanceState({ ...options, runId: `${expectedOutcome}-${index}` });
    const next = engine.enhanceEquipmentAction(previous, options.slot);
    if (next.lastEnhanceResult?.outcome === expectedOutcome) return { previous, next };
  }
  assert.fail(`${expectedOutcome} 강화 결과를 재현하지 못했습니다.`);
}

const originalRuleState = createEnhanceState({ itemId: 'eq_rusty_rifle', slot: 'WEAPON' });
const originalRulePlan = engine.enhancePlanForSlot(originalRuleState, 'WEAPON');
const originalRuleMaterials = Object.fromEntries(originalRulePlan.materialRows.map((row) => [row.itemId, row.required]));
assert.equal(originalRulePlan.creditCost, 80, '녹슨 소총 +1 비용은 원본의 80 Cr이어야 합니다.');
assert.deepEqual(
  originalRuleMaterials,
  { itm_enhance_stone: 1, itm_battery: 1, itm_scrap: 6 },
  '녹슨 소총 +1 재료는 원본 강화 규칙과 같아야 합니다.',
);
assert.equal(originalRulePlan.successChancePct, 90, '녹슨 소총 +1 기본 성공률은 원본의 90%여야 합니다.');

const pityPrevious = createEnhanceState({ itemId: 'eq_rusty_rifle', slot: 'WEAPON', level: 4, failStreak: 10, runId: 'hard-pity' });
const pityNext = engine.enhanceEquipmentAction(pityPrevious, 'WEAPON');
assert.equal(pityNext.lastEnhanceResult?.outcome, 'pity_success', '10회 연속 실패 후 다음 강화는 확정 성공해야 합니다.');
assert.equal(pityNext.equipmentInventory['eq_rusty_rifle-uid'].enhance, 5, '하드 천장 성공은 강화 단계를 1 올려야 합니다.');
assert.equal(pityNext.enhanceFailStreakByUid['eq_rusty_rifle-uid'], undefined, '강화 성공 시 실패 누적을 초기화해야 합니다.');
assert.equal(feedback.schaleIdleResultCue(pityPrevious, pityNext), 'enhancePity', '하드 천장 성공은 전용 효과음을 사용해야 합니다.');

const protectedResult = findEnhanceOutcome({
  itemId: 'eq_field_armor',
  slot: 'ARMOR',
  level: 8,
  failStreak: 2,
  autoUseProtectionTicket: true,
  protectionPreference: 'AUTO',
  pityPolicyOnProtection: 'KEEP',
  protectionStock: { itm_protect_charm: 1 },
}, 'protected');
assert.equal(protectedResult.next.inventory.itm_protect_charm, 0, '자동 보호는 하락 방지 부적을 1개 소비해야 합니다.');
assert.equal(protectedResult.next.equipmentInventory['eq_field_armor-uid'].enhance, 8, '보호권 발동 시 강화 단계를 유지해야 합니다.');
assert.equal(protectedResult.next.enhanceFailStreakByUid['eq_field_armor-uid'], 3, 'KEEP 정책은 보호된 실패도 천장에 누적해야 합니다.');
assert.equal(feedback.schaleIdleResultCue(protectedResult.previous, protectedResult.next), 'enhanceProtected', '보호권 발동은 전용 효과음을 사용해야 합니다.');

const decayedProtection = findEnhanceOutcome({
  itemId: 'eq_field_armor',
  slot: 'ARMOR',
  level: 8,
  failStreak: 3,
  autoUseProtectionTicket: true,
  protectionPreference: 'DOWNGRADE_ONLY',
  pityPolicyOnProtection: 'DECAY_1',
  protectionStock: { itm_protect_downgrade: 1, itm_protect_ticket: 1 },
}, 'protected');
assert.equal(decayedProtection.next.lastEnhanceResult.protectionItemId, 'itm_protect_downgrade', '하락 방지 전용 설정은 전용권을 사용해야 합니다.');
assert.equal(decayedProtection.next.enhanceFailStreakByUid['eq_field_armor-uid'], 2, 'DECAY_1 정책은 보호 발동 시 실패 누적을 1 줄여야 합니다.');

const resetProtection = findEnhanceOutcome({
  itemId: 'eq_shale_badge',
  slot: 'RELIC',
  level: 8,
  failStreak: 3,
  autoUseProtectionTicket: true,
  protectionPreference: 'DESTROY_ONLY',
  pityPolicyOnProtection: 'RESET',
  protectionStock: { itm_protect_destroy: 1, itm_protect_ticket: 1 },
}, 'protected');
assert.equal(resetProtection.next.lastEnhanceResult.protectionItemId, 'itm_protect_destroy', '파괴 방지 전용 설정은 파괴 방지권을 사용해야 합니다.');
assert.equal(resetProtection.next.enhanceFailStreakByUid['eq_shale_badge-uid'], undefined, 'RESET 정책은 보호 발동 시 실패 누적을 초기화해야 합니다.');

const downgradeResult = findEnhanceOutcome({
  itemId: 'eq_rusty_rifle',
  slot: 'WEAPON',
  level: 8,
  autoUseProtectionTicket: false,
}, 'downgrade');
assert.equal(downgradeResult.next.equipmentInventory['eq_rusty_rifle-uid'].enhance, 7, '보호하지 않은 하락 패널티는 강화 단계를 1 낮춰야 합니다.');
assert.equal(downgradeResult.next.enhanceFailStreakByUid['eq_rusty_rifle-uid'], 1, '하락 실패도 천장에 누적해야 합니다.');
assert.equal(feedback.schaleIdleResultCue(downgradeResult.previous, downgradeResult.next), 'enhanceDowngrade', '강화 하락은 전용 효과음을 사용해야 합니다.');

const destroyedResult = findEnhanceOutcome({
  itemId: 'eq_shale_badge',
  slot: 'RELIC',
  level: 8,
  autoUseProtectionTicket: false,
  withPreset: true,
}, 'destroyed');
assert.equal(destroyedResult.next.equipment.RELIC, undefined, '파괴된 장비는 장착 슬롯에서 제거되어야 합니다.');
assert.equal(destroyedResult.next.equipmentInventory['eq_shale_badge-uid'], undefined, '파괴된 장비는 보관함에서도 제거되어야 합니다.');
assert.equal(destroyedResult.next.equipmentPresets[0].equipment.RELIC, undefined, '파괴된 UID는 장비 프리셋에서도 정리되어야 합니다.');
assert.equal(feedback.schaleIdleResultCue(destroyedResult.previous, destroyedResult.next), 'enhanceDestroyed', '장비 파괴는 전용 효과음을 사용해야 합니다.');

const stableResult = findEnhanceOutcome({
  itemId: 'eq_lucky_charm',
  slot: 'ACCESSORY_1',
  level: 8,
  autoUseProtectionTicket: false,
}, 'failed_stable');
assert.equal(stableResult.next.equipmentInventory['eq_lucky_charm-uid'].enhance, 8, '패널티 없음 장비는 실패해도 강화 단계를 유지해야 합니다.');
assert.equal(stableResult.next.enhanceFailStreakByUid['eq_lucky_charm-uid'], 1, '패널티 없는 실패도 천장에 누적해야 합니다.');

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

const presentationCases = [
  ['시련의 탑 10회 요청: 성공 7, 실패 3, +420 Cr.', 'tower', '탑 배치 종료', 'warning', 'towerClear'],
  ['강화 보호권 제작 완료.', 'craft', '제작 완료', 'success', 'craftComplete'],
  ['녹슨 소총 +4 강화 성공. 하드 천장 발동으로 +5 달성.', 'enhance-pity', '강화 천장 성공', 'success', 'enhancePity'],
  ['현장 방호복 +8 강화 실패. 강화 보호 부적 사용으로 1단계 하락 패널티 방지.', 'enhance-protected', '보호권 발동', 'highlight', 'enhanceProtected'],
  ['녹슨 소총 +8 강화 실패. 실패 패널티로 +7까지 하락.', 'enhance-downgrade', '강화 단계 하락', 'warning', 'enhanceDowngrade'],
  ['샬레 휘장 +8 강화 실패. 장비 파괴.', 'enhance-destroyed', '장비 파괴', 'danger', 'enhanceDestroyed'],
  ['강화 실패. 강화석이 부족합니다.', 'upgrade', '장비 강화 실패', 'danger', 'enhanceFail'],
  ['미션 2개 보상 수령. +360 Cr.', 'claim', '보상 수령', 'success', 'reward'],
  ['재정비로 스태미나를 35 회복했습니다.', 'rest', '재정비 완료', 'success', 'rest'],
];
presentationCases.forEach(([text, action, label, tone, cue]) => {
  const presentation = feedback.schaleIdleFeedbackPresentation(text);
  assert.deepEqual(
    { action: presentation.action, label: presentation.label, tone: presentation.tone, cue: presentation.cue },
    { action, label, tone, cue },
    `${label} 결과는 전용 아이콘, 상태 톤, 효과음을 사용해야 합니다.`,
  );
});

assert.equal(feedback.schaleIdleResultCue(
  { ...base, log: ['이전 행동'] },
  { ...base, log: ['재정비로 스태미나를 35 회복했습니다.'] },
), 'rest', '카운터가 없는 재정비도 로그 변화로 효과음을 재생해야 합니다.');
assert.equal(feedback.schaleIdleResultCue(
  { ...base, log: ['이전 행동'] },
  { ...base, log: ['녹슨 소총 제작 실패. 필요한 재료가 부족합니다.'] },
), 'warning', '재료 부족처럼 카운터가 변하지 않는 실패도 경고음을 재생해야 합니다.');

assert.match(gearSource, /장비 보관함/, '장비 탭에 UID 보관함이 표시되어야 합니다.');
assert.match(gearSource, /equipEquipmentAction/, '보관함에서 직접 장착 동작을 제공해야 합니다.');
assert.match(gearSource, /toggleEquipmentProtectionAction/, '장비 잠금과 즐겨찾기 동작을 제공해야 합니다.');
assert.match(dutySource, /disabled=\{!selectedRecipePlan\.canCraft\}/, '제작 버튼은 비용 부족 시 비활성화되어야 합니다.');
assert.match(dutySource, /selectedEnhancePlan\.successChancePct/, '강화 화면에 실제 성공률을 표시해야 합니다.');
assert.match(dutySource, /state\.autoUseProtectionTicket/, '강화 화면에 자동 보호 토글을 제공해야 합니다.');
assert.match(dutySource, /protectionPreference/, '강화 화면에 보호권 우선순위 설정을 제공해야 합니다.');
assert.match(dutySource, /pityPolicyOnProtection/, '강화 화면에 보호 발동 후 천장 정책을 제공해야 합니다.');
assert.ok(featureSource.indexOf("id: 'duty'") < featureSource.indexOf("id: 'plan'"), '실제 당직 탭이 운영 리포트보다 먼저 열려야 합니다.');
assert.match(dutySource, /schale-duty-panel--settle/, '당직 정산 패널에 행동 우선순위 클래스가 있어야 합니다.');
assert.match(styleSource, /\.schale-duty-panel--settle\s*\{\s*order:\s*1;/, '당직 정산이 성장 리포트보다 먼저 보여야 합니다.');
assert.match(styleSource, /@media \(max-width: 720px\)[\s\S]*\.schale-equipment-actions > button/, '모바일 장비 버튼은 가용 폭에 맞춰 재배치되어야 합니다.');
assert.match(styleSource, /\.schale-equipment-vault\s*\{[\s\S]*max-height:/, '장비 보관함은 내부 스크롤로 페이지 길이를 제한해야 합니다.');
assert.match(iconSource, /favorite:\s*Star/, '즐겨찾기 행동은 별 아이콘을 사용해야 합니다.');
assert.match(iconSource, /'enhance-pity':\s*Sparkles/, '하드 천장 성공은 반짝임 아이콘을 사용해야 합니다.');
assert.match(iconSource, /'enhance-protected':\s*ShieldCheck/, '보호권 발동은 방패 아이콘을 사용해야 합니다.');
assert.match(iconSource, /'enhance-downgrade':\s*TrendingDown/, '강화 하락은 하락 아이콘을 사용해야 합니다.');
assert.match(iconSource, /'enhance-destroyed':\s*Skull/, '장비 파괴는 파괴 아이콘을 사용해야 합니다.');
assert.match(sfxSource, /favorite:\s*\[/, '즐겨찾기 전용 효과음이 있어야 합니다.');
assert.match(sfxSource, /shopRefresh:\s*\[/, '상점 갱신 전용 효과음이 있어야 합니다.');
assert.match(sfxSource, /enhancePity:\s*\[/, '하드 천장 전용 효과음이 있어야 합니다.');
assert.match(sfxSource, /enhanceProtected:\s*\[/, '보호권 발동 전용 효과음이 있어야 합니다.');
assert.match(sfxSource, /enhanceDowngrade:\s*\[/, '강화 하락 전용 효과음이 있어야 합니다.');
assert.match(sfxSource, /enhanceDestroyed:\s*\[/, '장비 파괴 전용 효과음이 있어야 합니다.');
assert.match(pageSource, /schaleIdleFeedbackPresentation/, '플레이 화면은 상태별 결과 표현을 사용해야 합니다.');
assert.match(pageSource, /action=\{resultPresentation\.action\}/, '최근 결과는 상태별 아이콘을 표시해야 합니다.');
assert.match(pageSource, /tone=\{resultPresentation\.tone\}/, '최근 결과는 성공, 경고, 실패 상태를 구분해야 합니다.');
assert.doesNotMatch(engineSource, /이\(가\)|은\(는\)|을\(를\)|\(으\)로/, '플레이어 로그에 병기형 조사가 남으면 안 됩니다.');

console.log(JSON.stringify({
  saveVersion: base.version,
  migratedSiteEquipment: Object.keys(migratedSiteSave.equipmentInventory).length,
  migratedSourceEquipment: Object.keys(sourceSave.equipmentInventory).length,
  craftedEquipment: Object.keys(craftedTwice.equipmentInventory).length,
  protectedLocked: Boolean(afterLockedSalvage.equipmentInventory[previousUid]),
  protectedFavorite: Boolean(afterFavoriteSalvage.equipmentInventory[previousUid]),
  presetRestored: presetApplied.equipment.WEAPON === reserveUid,
  feedbackCues: 23,
}, null, 2));
