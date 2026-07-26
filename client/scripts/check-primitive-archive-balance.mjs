import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../src/app/games/primitive-archive/_lib/', import.meta.url);
const loreSource = await readFile(new URL('primitiveArchiveAdvancementLore.js', rootUrl), 'utf8');
const loreUrl = `data:text/javascript;base64,${Buffer.from(loreSource).toString('base64')}`;
const dataSource = (await readFile(new URL('primitiveArchiveData.js', rootUrl), 'utf8'))
  .replace("from './primitiveArchiveAdvancementLore';", `from '${loreUrl}';`);
const dataUrl = `data:text/javascript;base64,${Buffer.from(dataSource).toString('base64')}`;
const engineSource = (await readFile(new URL('primitiveArchiveEngine.js', rootUrl), 'utf8'))
  .replaceAll("} from './primitiveArchiveData';", `} from '${dataUrl}';`);
const engineUrl = `data:text/javascript;base64,${Buffer.from(engineSource).toString('base64')}`;
const engine = await import(engineUrl);

function seededRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

const base = engine.createNewState({ difficulty: 'normal', rng: () => 0.5, runId: 'balance-base' });
const baseGatherChance = engine.actionChance(base, 'shiroko', 'gather', 0.45);
const boosted = engine.updateDeveloperToolsAction(base, {
  enabled: true,
  actionBonuses: { gather: 0.2 },
});
assert.ok(
  Math.abs(engine.actionChance(boosted, 'shiroko', 'gather', 0.45) - baseGatherChance - 0.2) < 0.000001,
  '개발자 도구의 채집 보정은 정확한 %p로 한 번만 적용되어야 합니다.',
);
const baseCraftChance = engine.actionChance(base, 'shiroko', 'craft', 0.25);
const craftBoosted = engine.updateDeveloperToolsAction(base, {
  enabled: true,
  actionBonuses: { craft: 0.15 },
});
assert.ok(
  Math.abs(engine.actionChance(craftBoosted, 'shiroko', 'craft', 0.25) - baseCraftChance - 0.15) < 0.000001,
  '개발자 도구의 제작 보정은 정확한 %p로 한 번만 적용되어야 합니다.',
);

const lockedRows = engine.specializedActionRows(base, 'shiroko');
assert.deepEqual(
  lockedRows.filter((row) => row.available).map((row) => row.id),
  [],
  '기술 연구 전에는 특화 생업이 잠겨 있어야 합니다.',
);

const preview = engine.updateDeveloperToolsAction(base, {
  enabled: true,
  guaranteedSuccess: true,
  unlockSpecializedActions: true,
  actionBonuses: { farm: 0.2 },
});
const previewRows = engine.specializedActionRows(preview, 'shiroko');
assert.deepEqual(
  previewRows.filter((row) => row.available).map((row) => row.id).sort(),
  ['farm', 'fish', 'herbal', 'herd', 'logging', 'mine', 'quarry', 'trap'],
  '개발자 미리보기는 여덟 가지 특화 생업을 모두 열어야 합니다.',
);
assert.ok(
  previewRows.every((row) => row.chance === 1),
  '강제 성공을 켜면 모든 특화 생업 성공률이 100%여야 합니다.',
);
const developerRows = engine.developerToolsSummary(preview).rows;
assert.equal(developerRows.length, 11, '개발자 도구는 기본 행동 3종과 생업 8종을 모두 보정해야 합니다.');
assert.deepEqual(
  developerRows.find((row) => row.id === 'craft'),
  { id: 'craft', label: '제작', action: 'primitive-craft', value: 0, valuePct: 0 },
  '제작 보정 행은 제작 아이콘과 현재 보정치를 제공해야 합니다.',
);
assert.equal(previewRows.find((row) => row.id === 'trap')?.label, '덫 사냥', '덫 사냥 명칭은 정확히 표시되어야 합니다.');
const specializedOutputs = {
  logging: 'wood',
  herbal: 'herb',
  trap: 'meat',
  farm: 'grain',
  herd: 'milk',
  fish: 'fish',
  mine: 'stone',
  quarry: 'stone',
};
for (const [actionId, itemId] of Object.entries(specializedOutputs)) {
  const result = engine.runSpecializedAction(preview, 'shiroko', actionId, '', { rng: () => 0.1 });
  assert.ok(
    Number(result.inventory[itemId] || 0) > Number(preview.inventory[itemId] || 0),
    `${actionId} 성공은 ${itemId} 자원을 생산해야 합니다.`,
  );
  assert.equal(Number(result.counters[actionId] || 0), 1, `${actionId} 성공 횟수가 기록되어야 합니다.`);
}
assert.match(
  engine.researchPlannerRows(base).find((row) => row.id === 'STONE_TOOLS')?.unlockText || '',
  /행동 벌목/,
  '기술 상세에는 해금되는 행동이 표시되어야 합니다.',
);
const lockedUtilityRows = engine.utilityActionRows(base, 'shiroko');
assert.equal(lockedUtilityRows.some((row) => row.unlocked), false, '기술 연구 전 운영 행동은 모두 잠겨야 합니다.');
const previewUtilityRows = engine.utilityActionRows(preview, 'shiroko');
assert.equal(previewUtilityRows.every((row) => row.unlocked), true, '개발자 미리보기는 기술 해금 운영도 모두 열어야 합니다.');

const utilityReady = engine.normalizeState({
  ...base,
  ap: 4,
  inventory: { ...base.inventory, herb: 2, berry: 12, wood: 12, stone: 8, fiber: 8, clay: 2, meat: 3, resin: 2 },
  party: base.party.map((member) => (
    member.id === 'shiroko' ? { ...member, hp: 60, bodyTemp: 36 } : member
  )),
  research: {
    ...base.research,
    completed: {
      ...base.research.completed,
      CARTOGRAPHY: true,
      MEDICAL_CORPUS: true,
      AGRICULTURE: true,
      IRRIGATION: true,
      FOOD_STORAGE: true,
      ROAD_BUILDING: true,
      EARLY_CURRENCY: true,
      BASIC_SAILING: true,
      STONE_TOOLS: true,
    },
  },
  civics: {
    ...base.civics,
    completed: {
      ...base.civics.completed,
      MILITARY_TRADITION: true,
      DRAMA: true,
      SETTLEMENT: true,
    },
  },
  tribe: { ...base.tribe, morale: 40 },
});
const utilityRows = engine.utilityActionRows(utilityReady, 'shiroko');
assert.deepEqual(
  utilityRows.filter((row) => row.available).map((row) => row.id).sort(),
  ['festival', 'irrigation', 'patrol', 'preserve', 'road', 'settlement', 'survey', 'trade_route', 'treatment', 'voyage'],
  '연구와 재료 조건을 충족하면 운영 행동 열 가지를 모두 실행할 수 있어야 합니다.',
);
for (const [techId, label] of [
  ['CARTOGRAPHY', '지도 답사'],
  ['MEDICAL_CORPUS', '치료'],
  ['IRRIGATION', '관개 정비'],
  ['FOOD_STORAGE', '식량 보존'],
  ['ROAD_BUILDING', '도로 정비'],
  ['EARLY_CURRENCY', '교역로 개설'],
  ['BASIC_SAILING', '항해 답사'],
]) {
  assert.match(
    engine.researchPlannerRows(utilityReady).find((row) => row.id === techId)?.unlockText || '',
    new RegExp(`행동 ${label}`),
    `${techId} 상세에는 ${label} 해금이 표시되어야 합니다.`,
  );
}
for (const [civicId, label] of [
  ['MILITARY_TRADITION', '순찰'],
  ['DRAMA', '축제'],
  ['SETTLEMENT', '정착지 확장'],
]) {
  assert.match(
    engine.civicsPlannerRows(utilityReady).find((row) => row.id === civicId)?.unlockText || '',
    new RegExp(`행동 ${label}`),
    `${civicId} 상세에는 ${label} 해금이 표시되어야 합니다.`,
  );
}

const settlementCapacityBefore = engine.tribeCapacity(utilityReady);
const settled = engine.runUtilityAction(utilityReady, 'shiroko', 'settlement', { rng: () => 0.5 });
assert.equal(Number(settled.inventory.wood || 0), Number(utilityReady.inventory.wood || 0) - 4, '첫 정착지 확장은 나무 4개를 사용해야 합니다.');
assert.equal(Number(settled.inventory.stone || 0), Number(utilityReady.inventory.stone || 0) - 3, '첫 정착지 확장은 돌 3개를 사용해야 합니다.');
assert.equal(Number(settled.inventory.fiber || 0), Number(utilityReady.inventory.fiber || 0) - 2, '첫 정착지 확장은 섬유 2개를 사용해야 합니다.');
assert.equal(settled.tribe.settlementLevel, 1, '정착지 확장은 영구 정착지 등급을 올려야 합니다.');
assert.equal(engine.tribeCapacity(settled), settlementCapacityBefore + 2, '정착지 확장은 부족 수용력을 2명 늘려야 합니다.');
assert.equal(settled.tribe.morale, 44, '정착지 확장은 부족 사기를 4 높여야 합니다.');
assert.equal(settled.counters.settlement, 1, '정착지 확장 횟수가 기록되어야 합니다.');
const maxSettlement = engine.normalizeState({
  ...utilityReady,
  tribe: { ...utilityReady.tribe, settlementLevel: 99 },
});
assert.equal(maxSettlement.tribe.settlementLevel, 3, '저장된 정착지 등급은 최대 3으로 정규화되어야 합니다.');
assert.equal(engine.utilityActionRows(maxSettlement, 'shiroko').find((row) => row.id === 'settlement')?.available, false, '최대 정착지는 추가 확장이 비활성화되어야 합니다.');

const voyageFishBefore = Number(utilityReady.inventory.fish || 0);
const voyaged = engine.runUtilityAction(utilityReady, 'shiroko', 'voyage', { rng: () => 0 });
assert.equal(voyaged.exploration.discoverySerial, utilityReady.exploration.discoverySerial + 1, '항해 답사는 물길 인접 지역 발견 기록을 남겨야 합니다.');
assert.equal(Number(voyaged.inventory.wood || 0), Number(utilityReady.inventory.wood || 0) - 2, '항해 답사는 나무 2개를 사용해야 합니다.');
assert.equal(Number(voyaged.inventory.fiber || 0), Number(utilityReady.inventory.fiber || 0) - 2, '항해 답사는 섬유 2개를 사용해야 합니다.');
assert.ok(Number(voyaged.inventory.fish || 0) >= voyageFishBefore + 2, '항해 답사는 물고기 2개 이상을 확보해야 합니다.');
assert.equal(voyaged.counters.voyage, 1, '항해 답사 횟수가 기록되어야 합니다.');

const surveyed = engine.runUtilityAction(utilityReady, 'shiroko', 'survey', { rng: () => 0 });
assert.equal(surveyed.exploration.discoverySerial, utilityReady.exploration.discoverySerial + 1, '지도 답사는 새 지역 발견 기록을 남겨야 합니다.');
assert.equal(surveyed.counters.survey, 1, '지도 답사 횟수가 기록되어야 합니다.');

const patrolled = engine.runUtilityAction(utilityReady, 'shiroko', 'patrol', { rng: () => 0.5 });
assert.equal(patrolled.exploration.patrolCharges, 2, '순찰은 경계 태세를 2회 충전해야 합니다.');
assert.equal(patrolled.counters.patrol, 1, '순찰 횟수가 기록되어야 합니다.');

const herbBefore = Number(utilityReady.inventory.herb || 0);
const treated = engine.runUtilityAction(utilityReady, 'shiroko', 'treatment', { rng: () => 0.5 });
const treatedActor = engine.getActor(treated, 'shiroko');
assert.equal(Number(treated.inventory.herb || 0), herbBefore - 1, '치료는 약초 1개를 사용해야 합니다.');
assert.equal(treatedActor.hp, 84, '치료는 선택 대원의 HP를 24 회복해야 합니다.');
assert.equal(treatedActor.bodyTemp, 36.4, '치료는 선택 대원의 체온을 0.4도 회복해야 합니다.');
assert.equal(treated.counters.treatment, 1, '치료 횟수가 기록되어야 합니다.');

const festival = engine.runUtilityAction(utilityReady, 'shiroko', 'festival', { rng: () => 0.5 });
assert.equal(Number(festival.inventory.berry || 0), Number(utilityReady.inventory.berry || 0) - 3, '축제는 식량 3단위를 사용해야 합니다.');
assert.equal(festival.tribe.morale, 54, '축제는 부족 사기를 14 높여야 합니다.');
assert.equal(festival.counters.festival, 1, '축제 횟수가 기록되어야 합니다.');

const irrigationBlockedState = engine.normalizeState({
  ...utilityReady,
  inventory: { ...utilityReady.inventory, clay: 0 },
});
const irrigationBlockedRow = engine.utilityActionRows(irrigationBlockedState, 'shiroko').find((row) => row.id === 'irrigation');
assert.equal(irrigationBlockedRow?.available, false, '점토가 부족하면 관개 정비가 비활성화되어야 합니다.');
assert.match(irrigationBlockedRow?.lockedReason || '', /재료 부족/, '관개 정비는 부족한 재료를 설명해야 합니다.');

const woodBeforeIrrigation = Number(utilityReady.inventory.wood || 0);
const clayBeforeIrrigation = Number(utilityReady.inventory.clay || 0);
const irrigated = engine.runUtilityAction(utilityReady, 'shiroko', 'irrigation', { rng: () => 0.5 });
assert.equal(Number(irrigated.inventory.wood || 0), woodBeforeIrrigation - 2, '관개 정비는 나무 2개를 사용해야 합니다.');
assert.equal(Number(irrigated.inventory.clay || 0), clayBeforeIrrigation - 1, '관개 정비는 점토 1개를 사용해야 합니다.');
assert.equal(irrigated.exploration.irrigationCharges, 3, '관개 정비는 농업 보너스를 3회 충전해야 합니다.');
assert.equal(irrigated.counters.irrigation, 1, '관개 정비 횟수가 기록되어야 합니다.');

const irrigationClamped = engine.normalizeState({
  ...utilityReady,
  exploration: { ...utilityReady.exploration, irrigationCharges: 99 },
});
assert.equal(irrigationClamped.exploration.irrigationCharges, 3, '저장된 관개 충전은 최대 3회로 정규화되어야 합니다.');

const farmComparisonBase = engine.normalizeState({
  ...irrigated,
  ap: 4,
  weather: { ...irrigated.weather, actionMod: 0 },
  party: irrigated.party.map((member) => (
    member.id === 'shiroko' ? { ...member, stats: { ...member.stats, gather: 1 } } : member
  )),
});
const dryFarmState = engine.normalizeState({
  ...farmComparisonBase,
  exploration: { ...farmComparisonBase.exploration, irrigationCharges: 0 },
});
const dryFarmRow = engine.specializedActionRows(dryFarmState, 'shiroko').find((row) => row.id === 'farm');
const wetFarmRow = engine.specializedActionRows(farmComparisonBase, 'shiroko').find((row) => row.id === 'farm');
assert.equal(Math.round((wetFarmRow.chance - dryFarmRow.chance) * 100), 12, '관개 효과는 농업 성공률을 12%p 높여야 합니다.');
const dryFarmResult = engine.runSpecializedAction(dryFarmState, 'shiroko', 'farm', '', { rng: () => 0.1 });
const wetFarmResult = engine.runSpecializedAction(farmComparisonBase, 'shiroko', 'farm', '', { rng: () => 0.1 });
assert.equal(Number(wetFarmResult.inventory.grain || 0), Number(dryFarmResult.inventory.grain || 0) + 1, '관개 효과는 농업 성공 시 곡물을 1개 더 생산해야 합니다.');
assert.equal(wetFarmResult.exploration.irrigationCharges, 2, '성공한 농업 행동은 관개 충전을 1회 사용해야 합니다.');
const failedWetFarmResult = engine.runSpecializedAction(farmComparisonBase, 'shiroko', 'farm', '', { rng: () => 0.999999 });
assert.equal(failedWetFarmResult.exploration.irrigationCharges, 2, '실패한 농업 행동도 관개 충전을 1회 사용해야 합니다.');
assert.equal(failedWetFarmResult.log.some((entry) => /관개 효과는 1회 소모/.test(entry)), true, '농업 실패 로그는 관개 충전 소모를 알려야 합니다.');

const preserveBlockedState = engine.normalizeState({
  ...utilityReady,
  inventory: { ...utilityReady.inventory, resin: 0 },
});
const preserveBlockedRow = engine.utilityActionRows(preserveBlockedState, 'shiroko').find((row) => row.id === 'preserve');
assert.equal(preserveBlockedRow?.available, false, '수지가 부족하면 식량 보존이 비활성화되어야 합니다.');
assert.match(preserveBlockedRow?.lockedReason || '', /재료 부족/, '식량 보존은 부족한 재료를 설명해야 합니다.');

const preservationBefore = {
  meat: Number(utilityReady.inventory.meat || 0),
  resin: Number(utilityReady.inventory.resin || 0),
  berry: Number(utilityReady.inventory.berry || 0),
  herb: Number(utilityReady.inventory.herb || 0),
  ration: Number(utilityReady.inventory.packed_ration || 0),
};
const preserved = engine.runUtilityAction(utilityReady, 'shiroko', 'preserve', { rng: () => 0.5 });
assert.equal(Number(preserved.inventory.meat || 0), preservationBefore.meat - 2, '식량 보존은 고기 2개를 사용해야 합니다.');
assert.equal(Number(preserved.inventory.resin || 0), preservationBefore.resin - 1, '식량 보존은 수지 1개를 사용해야 합니다.');
assert.equal(Number(preserved.inventory.berry || 0), preservationBefore.berry - 1, '식량 보존은 베리 1개를 사용해야 합니다.');
assert.equal(Number(preserved.inventory.herb || 0), preservationBefore.herb - 1, '식량 보존은 약초 1개를 사용해야 합니다.');
assert.equal(Number(preserved.inventory.packed_ration || 0), preservationBefore.ration + 1, '식량 보존은 보존 식량 꾸러미 1개를 생산해야 합니다.');
assert.equal(preserved.counters.preserve, 1, '식량 보존 횟수가 기록되어야 합니다.');

const roadBlockedState = engine.normalizeState({
  ...utilityReady,
  inventory: { ...utilityReady.inventory, stone: 2 },
});
const roadBlockedRow = engine.utilityActionRows(roadBlockedState, 'shiroko').find((row) => row.id === 'road');
assert.equal(roadBlockedRow?.available, false, '돌이 부족하면 도로 정비가 비활성화되어야 합니다.');
assert.match(roadBlockedRow?.lockedReason || '', /재료 부족/, '도로 정비는 부족한 재료를 설명해야 합니다.');

const roaded = engine.runUtilityAction(utilityReady, 'shiroko', 'road', { rng: () => 0.5 });
assert.equal(Number(roaded.inventory.stone || 0), Number(utilityReady.inventory.stone || 0) - 3, '도로 정비는 돌 3개를 사용해야 합니다.');
assert.equal(Number(roaded.inventory.wood || 0), Number(utilityReady.inventory.wood || 0) - 2, '도로 정비는 나무 2개를 사용해야 합니다.');
assert.equal(roaded.exploration.roadCharges, 4, '도로 정비는 현장 스태미나 절감을 4회 충전해야 합니다.');
assert.equal(roaded.counters.road, 1, '도로 정비 횟수가 기록되어야 합니다.');

const roadClamped = engine.normalizeState({
  ...utilityReady,
  exploration: { ...utilityReady.exploration, roadCharges: 99 },
});
assert.equal(roadClamped.exploration.roadCharges, 4, '저장된 도로 충전은 최대 4회로 정규화되어야 합니다.');

const roadFieldBase = engine.normalizeState({
  ...utilityReady,
  ap: 4,
  party: utilityReady.party.map((member) => (
    member.id === 'shiroko' ? { ...member, stamina: 100 } : member
  )),
  exploration: { ...utilityReady.exploration, roadCharges: 0 },
});
const roadFieldReady = engine.normalizeState({
  ...roadFieldBase,
  exploration: { ...roadFieldBase.exploration, roadCharges: 4 },
});
const dryGatherResult = engine.runGatherAction(roadFieldBase, 'shiroko', '', { rng: () => 0.1 });
const roadGatherResult = engine.runGatherAction(roadFieldReady, 'shiroko', '', { rng: () => 0.1 });
assert.equal(
  engine.getActor(roadGatherResult, 'shiroko').stamina - engine.getActor(dryGatherResult, 'shiroko').stamina,
  4,
  '정비된 도로는 채집 스태미나 소모를 4 줄여야 합니다.',
);
assert.equal(roadGatherResult.exploration.roadCharges, 3, '성공한 채집은 도로 충전을 1회 사용해야 합니다.');
const failedRoadGather = engine.runGatherAction(roadFieldReady, 'shiroko', '', { rng: () => 0.999999 });
assert.equal(failedRoadGather.exploration.roadCharges, 3, '실패한 채집도 도로 충전을 1회 사용해야 합니다.');
assert.equal(failedRoadGather.log.some((entry) => /정비된 도로 효과/.test(entry)), true, '현장 행동 로그는 도로 효과 적용을 알려야 합니다.');

const dryLoggingResult = engine.runSpecializedAction(roadFieldBase, 'shiroko', 'logging', '', { rng: () => 0.1 });
const roadLoggingResult = engine.runSpecializedAction(roadFieldReady, 'shiroko', 'logging', '', { rng: () => 0.1 });
assert.equal(
  engine.getActor(roadLoggingResult, 'shiroko').stamina - engine.getActor(dryLoggingResult, 'shiroko').stamina,
  4,
  '정비된 도로는 벌목 스태미나 소모를 4 줄여야 합니다.',
);
assert.equal(roadLoggingResult.exploration.roadCharges, 3, '현장 특화 생업은 도로 충전을 1회 사용해야 합니다.');

const roadFarmState = engine.normalizeState({
  ...roadFieldReady,
  exploration: { ...roadFieldReady.exploration, roadCharges: 4, irrigationCharges: 0 },
});
const dryFarmRoadState = engine.normalizeState({
  ...roadFarmState,
  exploration: { ...roadFarmState.exploration, roadCharges: 0 },
});
const roadFarmResult = engine.runSpecializedAction(roadFarmState, 'shiroko', 'farm', '', { rng: () => 0.1 });
const dryFarmRoadResult = engine.runSpecializedAction(dryFarmRoadState, 'shiroko', 'farm', '', { rng: () => 0.1 });
assert.equal(
  engine.getActor(roadFarmResult, 'shiroko').stamina,
  engine.getActor(dryFarmRoadResult, 'shiroko').stamina,
  '정착지 농업에는 도로 스태미나 절감이 적용되지 않아야 합니다.',
);
assert.equal(roadFarmResult.exploration.roadCharges, 4, '정착지 농업은 도로 충전을 소비하지 않아야 합니다.');

const tradeRouteBlockedState = engine.normalizeState({
  ...utilityReady,
  inventory: { ...utilityReady.inventory, resin: 0 },
});
const tradeRouteBlockedRow = engine.utilityActionRows(tradeRouteBlockedState, 'shiroko').find((row) => row.id === 'trade_route');
assert.equal(tradeRouteBlockedRow?.available, false, '수지가 부족하면 교역로 개설이 비활성화되어야 합니다.');
assert.match(tradeRouteBlockedRow?.lockedReason || '', /재료 부족/, '교역로 개설은 부족한 재료를 설명해야 합니다.');

const tradeRouted = engine.runUtilityAction(utilityReady, 'shiroko', 'trade_route', { rng: () => 0.5 });
assert.equal(Number(tradeRouted.inventory.wood || 0), Number(utilityReady.inventory.wood || 0) - 2, '교역로 개설은 나무 2개를 사용해야 합니다.');
assert.equal(Number(tradeRouted.inventory.stone || 0), Number(utilityReady.inventory.stone || 0) - 1, '교역로 개설은 돌 1개를 사용해야 합니다.');
assert.equal(Number(tradeRouted.inventory.resin || 0), Number(utilityReady.inventory.resin || 0) - 1, '교역로 개설은 수지 1개를 사용해야 합니다.');
assert.equal(tradeRouted.diplomacy.tradeRouteCharges, 3, '교역로 개설은 교역 보너스를 3회 충전해야 합니다.');
assert.equal(tradeRouted.counters.trade_route, 1, '교역로 개설 횟수가 기록되어야 합니다.');

const tradeRouteClamped = engine.normalizeState({
  ...utilityReady,
  diplomacy: { ...utilityReady.diplomacy, tradeRouteCharges: 99 },
});
assert.equal(tradeRouteClamped.diplomacy.tradeRouteCharges, 3, '저장된 교역로 충전은 최대 3회로 정규화되어야 합니다.');

const routedTradeReady = engine.normalizeState({
  ...tradeRouted,
  ap: 4,
  diplomacy: {
    ...tradeRouted.diplomacy,
    tradeRouteCharges: 3,
    contacts: {
      ...tradeRouted.diplomacy.contacts,
      'ember-grove': { ...tradeRouted.diplomacy.contacts['ember-grove'], known: true, relation: 8, lastActionDay: 0 },
    },
  },
});
const routedTradeRow = engine.rivalTribeRows(routedTradeReady).find((row) => row.id === 'ember-grove');
assert.equal(routedTradeRow?.tradeCostText, '돌 1', '교역로가 활성화되면 첫 요구 자원이 1개 줄어 표시되어야 합니다.');
assert.equal(routedTradeRow?.tradeRouteActive, true, '외교 화면은 교역로 적용 상태를 표시해야 합니다.');
const routedStoneBefore = Number(routedTradeReady.inventory.stone || 0);
const routedTrade = engine.runDiplomacyAction(routedTradeReady, 'shiroko', 'ember-grove', 'trade', { rng: () => 0.5 });
assert.equal(Number(routedTrade.inventory.stone || 0), routedStoneBefore - 1, '교역로 교역은 절감된 돌 1개만 사용해야 합니다.');
assert.equal(routedTrade.diplomacy.contacts['ember-grove'].relation, 17, '교역로 교역은 관계를 총 9 높여야 합니다.');
assert.equal(routedTrade.diplomacy.tradeRouteCharges, 2, '성공한 교역은 교역로 충전을 1회 사용해야 합니다.');
assert.equal(routedTrade.log.some((entry) => /교역로 효과/.test(entry)), true, '교역 로그는 교역로 효과 적용을 알려야 합니다.');

const blockedTradeState = engine.normalizeState({
  ...routedTradeReady,
  inventory: { ...routedTradeReady.inventory, stone: 0 },
});
const blockedTrade = engine.runDiplomacyAction(blockedTradeState, 'shiroko', 'ember-grove', 'trade', { rng: () => 0.5 });
assert.equal(blockedTrade.diplomacy.tradeRouteCharges, 3, '자원 부족으로 실패한 교역은 교역로 충전을 소모하지 않아야 합니다.');

const huntBase = engine.normalizeState({
  ...utilityReady,
  ap: 4,
  party: utilityReady.party.map((member) => (
    member.id === 'shiroko' ? { ...member, hp: 100 } : member
  )),
  exploration: { ...utilityReady.exploration, patrolCharges: 0 },
});
const huntPatrolled = engine.normalizeState({
  ...huntBase,
  exploration: { ...huntBase.exploration, patrolCharges: 2 },
});
const failedHunt = engine.runHuntAction(huntBase, 'shiroko', '', { rng: () => 0.999999 });
const guardedHunt = engine.runHuntAction(huntPatrolled, 'shiroko', '', { rng: () => 0.999999 });
assert.equal(
  engine.getActor(guardedHunt, 'shiroko').hp - engine.getActor(failedHunt, 'shiroko').hp,
  4,
  '순찰은 실패한 현장 행동의 피해를 정확히 4 줄여야 합니다.',
);
assert.equal(guardedHunt.exploration.patrolCharges, 1, '현장 행동 후 순찰 충전은 1회 소모되어야 합니다.');

const farmed = engine.runSpecializedAction(preview, 'shiroko', 'farm', '', { rng: () => 0.1 });
const reset = engine.resetDeveloperToolsAction(farmed);
assert.equal(engine.developerToolsSummary(reset).enabled, false, '개발자 도구 전체 초기화는 보정을 꺼야 합니다.');

const researched = engine.normalizeState({
  ...base,
  research: {
    ...base.research,
    completed: {
      ...base.research.completed,
      STONE_TOOLS: true,
      HERBALISM: true,
      FISHING: true,
      TRAPPING: true,
      AGRICULTURE: true,
      ANIMAL_HUSBANDRY: true,
      MINING: true,
      EARLY_CONSTRUCTION: true,
    },
  },
  tribe: {
    ...base.tribe,
    population: 5,
  },
});
const researchedRows = engine.specializedActionRows(researched, 'shiroko');
for (const actionId of Object.keys(specializedOutputs)) {
  assert.equal(researchedRows.find((row) => row.id === actionId)?.unlocked, true, `${actionId} 연구는 해당 행동을 열어야 합니다.`);
}
const tribeBefore = engine.tribeSummary(researched);
for (const jobId of ['logger', 'herbalist', 'trapper', 'farmer', 'herder', 'fisher', 'miner', 'quarryman']) {
  assert.equal(tribeBefore.jobs.find((job) => job.id === jobId)?.unlocked, true, `${jobId} 직업이 해금되어야 합니다.`);
}
const tribeAssigned = engine.adjustTribeJobAction(researched, 'farmer', 1);
assert.equal(tribeAssigned.tribe.assignments.farmer, 1, '해금된 농경대에는 부족원을 배치할 수 있어야 합니다.');
assert.equal(engine.tribeSummary(base).jobs.find((job) => job.id === 'farmer')?.canAdd, false, '연구 전 농경대 배치는 비활성화되어야 합니다.');

const productionState = engine.normalizeState({
  ...researched,
  inventory: { ...researched.inventory, berry: 20 },
  tribe: {
    ...researched.tribe,
    population: 4,
    assignments: {
      forager: 0, hunter: 0, logger: 1, herbalist: 1, trapper: 1, farmer: 0,
      herder: 0, fisher: 0, miner: 0, quarryman: 1, builder: 0, scholar: 0,
    },
  },
});
const produced = engine.advanceDay(productionState, { rng: () => 0.5 });
for (const itemId of ['wood', 'herb', 'meat', 'stone']) {
  assert.ok(Number(produced.tribe.lastProduction?.gains?.[itemId] || 0) > 0, `신규 부족 직업은 ${itemId} 일일 생산을 제공해야 합니다.`);
}

const simulations = [];
for (const seed of [7, 19, 43]) {
  const rng = seededRng(seed);
  let state = engine.createNewState({ difficulty: 'normal', rng, runId: `auto-${seed}` });
  for (let day = 0; day < 18 && !state.ended; day += 1) {
    state = engine.runAutoDayAction(state, { rng });
  }
  const status = engine.researchSystemStatus(state);
  const completedResearch = Object.values(state.research.completed || {}).filter(Boolean).length;
  assert.ok(state.day >= 12, `시드 ${seed}: 자동 운영은 최소 12일까지 진행되어야 합니다.`);
  assert.equal(status.unlocked, true, `시드 ${seed}: 자동 운영이 연구 체계를 열어야 합니다.`);
  assert.ok(completedResearch >= 2, `시드 ${seed}: 자동 운영은 기초 기술을 2개 이상 완료해야 합니다.`);
  assert.ok(Number(state.tribe.population || 0) >= 4, `시드 ${seed}: 부족이 전멸하면 안 됩니다.`);
  simulations.push({
    seed,
    day: state.day,
    ended: state.ended,
    completedResearch,
    camp: state.camp,
    population: state.tribe.population,
    food: engine.tribeSummary(state).foodStock,
  });
}

console.log(JSON.stringify({
  specializedActions: previewRows.map((row) => row.id),
  utilityActions: utilityRows.map((row) => row.id),
  tribeJobs: engine.tribeSummary(researched).jobs.map((job) => ({ id: job.id, unlocked: job.unlocked })),
  simulations,
}, null, 2));
