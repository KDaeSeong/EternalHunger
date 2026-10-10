import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { buildInitialSimulationRoster } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { getActorGrowthProgress } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getLateGrowthTargets } = await import('../src/app/simulation/_lib/lateGrowthTargetRuntime.js');
const { pickInitialErWeaponTypeForGoals } = await import('../src/app/simulation/_lib/initialWeaponGoalRuntime.js');
const { areEquipmentWeaponTypesCompatible } = await import('../src/utils/equipmentCatalog.js');
const { ER_WEAPON_TYPES_KO, pickInitialErWeaponType } = await import('../src/utils/erMeta.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

const zoneId = 'weapon-goal-zone';
const map = { zones: [{ zoneId, name: '검사 구역' }], zoneConnections: [] };
const settings = { rulesetId: 'ER_S11', matchMode: 'solo' };
const rolls = [0, 0.249999, 0.5, 0.749999, 0.999999];

function makeCatalog() {
  const items = [];
  const addMaterial = (id) => items.push({ _id: `raw:${id}`, name: `재료 ${id}`, type: '재료', tier: 1, spawnZones: [zoneId] });
  const addGear = (id, slot, weaponType = '', tier = 4, aliases = {}) => {
    addMaterial(id);
    const item = {
      _id: id,
      name: id,
      type: 'equipment',
      equipSlot: slot,
      weaponType,
      tier,
      spawnZones: [zoneId],
      recipe: { ingredients: [{ itemId: `raw:${id}`, qty: 1 }] },
      ...aliases,
    };
    items.push(item);
    return item;
  };

  const weapons = new Map();
  for (const weaponType of [
    '돌격소총', '권총', '유탄발사기', '로켓발사기',
    '단검', '한손검', '양손검', '저격총',
  ]) {
    const itemKey = weaponType === '권총' ? 'goal:hero-pistol' : `catalog:${weaponType}`;
    weapons.set(weaponType, addGear(`weapon-t4-${weaponType}`, 'weapon', weaponType, 4, { itemKey }));
  }
  const neutral = addGear('weapon-t4-neutral', 'weapon', '', 4, { itemKey: 'goal:neutral' });
  for (const slot of ['head', 'clothes', 'arm', 'shoes']) addGear(`gear-t4-${slot}`, slot);

  const future = {
    legendPistol: addGear('weapon-t5-pistol', 'weapon', '권총', 5, { externalId: 'goal:legend-pistol' }),
    transcendPistol: addGear('weapon-t6-pistol', 'weapon', '유탄발사기', 6),
    legendSniper: addGear('weapon-t5-sniper', 'weapon', '저격총', 5, { itemKey: 'goal:legend-sniper' }),
    transcendSniper: addGear('weapon-t6-sniper', 'weapon', '저격총', 6, { itemKey: 'goal:transcend-sniper' }),
  };
  return { items, weapons, neutral, future, addGear };
}

function makeCharacter({
  id = 'initial-weapon-goal-fixture',
  erWeapons = ['돌격소총', '권총', '유탄발사기', '로켓발사기'],
  heroKey = 'goal:hero-pistol',
  legendKey = 'goal:legend-pistol',
  transcendKey = 'weapon-t6-pistol',
  goalLoadouts = null,
} = {}) {
  return {
    _id: id,
    id,
    name: id,
    weaponType: '돌격소총',
    erWeapons,
    stats: { maxHp: 100, attackPower: 12, defense: 5 },
    ...(goalLoadouts === null ? {
      goalLoadouts: {
        hero: { weaponKey: heroKey },
        legend: { weaponKey: legendKey },
        transcend: { weaponKey: transcendKey },
      },
    } : { goalLoadouts }),
  };
}

function freezeTree(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeTree(child);
  return Object.freeze(value);
}

function stableSummary(actor, items) {
  const growth = getActorGrowthProgress(actor, items);
  return {
    runWeaponType: actor.runWeaponType,
    weaponType: actor.weaponType,
    erWeapons: actor.erWeapons,
    routePlanSource: actor.routePlanSource,
    routePlanZoneIds: actor.routePlanZoneIds,
    routePlanTargetItemIds: actor.routePlanTargetItemIds,
    goalLoadouts: actor.goalLoadouts,
    growth: {
      openingComplete: growth.openingComplete,
      goalIssues: growth.goalIssues,
      targetIds: growth.targetIds,
    },
  };
}

function buildOneRun(character, items, roll) {
  const inputBefore = structuredClone(character);
  const catalogBefore = structuredClone(items);
  freezeTree(character);
  freezeTree(items);
  let draws = 0;
  const result = withSimulationRandom(() => { draws += 1; return roll; }, () => buildInitialSimulationRoster({
    charList: [character],
    routeItems: items,
    initialMap: map,
    initialZoneIds: [zoneId],
    loadedSettings: { ...settings },
  }));
  assert.equal(result.shuffledChars.length, 1, '단일 고정 입력이 solo 참가자로 남아야 합니다.');
  const actor = result.shuffledChars[0];
  assert.equal(draws, 1, '완성된 단일 구역 경로에서는 시작 무기 선택이 RNG를 정확히 한 번 소비해야 합니다.');
  assert.deepEqual(character, inputBefore, '원본 캐릭터 설정을 변경하면 안 됩니다.');
  assert.deepEqual(items, catalogBefore, '공개 카탈로그를 변경하면 안 됩니다.');
  return { actor, summary: stableSummary(actor, items), draws };
}

function assertAllCompatible(weaponType, targets, label) {
  for (const target of targets) {
    assert.ok(areEquipmentWeaponTypesCompatible(weaponType, target.weaponType),
      `${label}: ${weaponType}은 ${target._id}(${target.weaponType || '중립'})와 호환되어야 합니다.`);
  }
}

function assertOneDrawPick(character, items, roll, expected) {
  let draws = 0;
  const picked = pickInitialErWeaponTypeForGoals(character, items, () => { draws += 1; return roll; });
  assert.equal(draws, 1, '목표 기반 picker도 허용 무기 수와 무관하게 기존처럼 RNG 한 번만 소비해야 합니다.');
  assert.equal(picked, expected);
  return picked;
}

let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };

check('hero·legend·transcend의 권총 계열 교집합은 모든 실제 로스터 추첨에서 유지된다', () => {
  for (const roll of rolls) {
    const fixture = makeCatalog();
    const character = makeCharacter();
    const targets = [fixture.items.find((item) => item.itemKey === 'goal:hero-pistol'),
      fixture.future.legendPistol, fixture.future.transcendPistol];
    const first = buildOneRun(character, fixture.items, roll);
    const second = buildOneRun(character, fixture.items, roll);
    assert.equal(first.draws, 1);
    assert.deepEqual(first.summary, second.summary, `같은 입력·roll ${roll}은 전체 관련 출력이 재현되어야 합니다.`);
    assertAllCompatible(first.actor.runWeaponType, targets, '권총 계열 목표');
    assert.ok(first.actor.routePlanZoneIds.length > 0, '실제 초기 경로계획이 만들어져야 합니다.');
    assert.ok(first.actor.routePlanTargetItemIds.includes(targets[0]._id), '초기 경로가 작성된 영웅 무기 목표를 보존해야 합니다.');
    assert.deepEqual(first.summary.growth.goalIssues, [], '호환되는 영웅 목표를 무기 불일치로 보고하면 안 됩니다.');
  }
});

check('한손검·양손검의 호환 계열은 모든 roll에서 유지되고 단검은 교집합에 들어오지 않는다', () => {
  for (const roll of rolls) {
    const fixture = makeCatalog();
    const character = makeCharacter({
      id: 'melee-weapon-goal-fixture',
      erWeapons: ['단검', '한손검', '양손검'],
      heroKey: 'goal:hero-twohand',
      legendKey: 'goal:legend-onehand',
      transcendKey: 'goal:transcend-twohand',
    });
    const hero = fixture.addGear('weapon-t4-twohand-goal', 'weapon', '양손검', 4, { itemKey: 'goal:hero-twohand' });
    const legend = fixture.addGear('weapon-t5-onehand-goal', 'weapon', '한손검', 5, { externalId: 'goal:legend-onehand' });
    const transcend = fixture.addGear('weapon-t6-twohand-goal', 'weapon', '양손검', 6);
    character.goalLoadouts.transcend.weaponKey = transcend._id;
    const first = buildOneRun(character, fixture.items, roll);
    assertAllCompatible(first.actor.runWeaponType, [hero, legend, transcend], '근접 계열 목표');
    assert.notEqual(first.actor.runWeaponType, '단검', '단검은 한손검·양손검 계열과 별개여야 합니다.');
    assert.deepEqual(first.summary.growth.goalIssues, []);
  }
});

check('빈 weaponType 목표는 중립으로 취급되어 원래 허용 pool과 roll을 보존한다', () => {
  for (const roll of [0, 0.5, 0.999999]) {
    const fixture = makeCatalog();
    const character = makeCharacter({
      id: 'neutral-weapon-goal-fixture',
      erWeapons: ['돌격소총', '권총'],
      heroKey: 'goal:neutral',
      legendKey: '',
      transcendKey: '',
      goalLoadouts: { hero: { weaponKey: 'goal:neutral' } },
    });
    const expected = pickInitialErWeaponType(character, () => roll);
    assertOneDrawPick(character, fixture.items, roll, expected);
    const { actor } = buildOneRun(character, fixture.items, roll);
    assert.equal(actor.runWeaponType, expected);
    assertAllCompatible(actor.runWeaponType, [fixture.neutral], '중립 무기 목표');
    assert.deepEqual(getActorGrowthProgress(actor, fixture.items).goalIssues, []);
  }
});

check('유효 목표가 없으면 기존 무작위 선택과 정확히 같은 결과·소비량을 낸다', () => {
  for (const roll of rolls) {
    const fixture = makeCatalog();
    const character = makeCharacter({ id: 'no-weapon-goal-fixture', goalLoadouts: {} });
    let oldDraws = 0;
    const expected = pickInitialErWeaponType(character, () => { oldDraws += 1; return roll; });
    assert.equal(oldDraws, 1);
    assertOneDrawPick(character, fixture.items, roll, expected);
    const { actor } = buildOneRun(character, fixture.items, roll);
    assert.equal(actor.runWeaponType, expected);
  }
});

check('허용 pool 밖·삭제·가상·잘못된 부위·누락 목표는 자동 수정하지 않고 성장 진단에 남는다', () => {
  const cases = [
    { name: 'allowed-excludes-goal', configure: (fixture) => ({
      character: makeCharacter({ erWeapons: ['돌격소총'], legendKey: '', transcendKey: '' }),
      issue: 'weapon_mismatch',
    }) },
    { name: 'deleted-goal', configure: (fixture) => {
      const deleted = fixture.addGear('deleted-weapon-goal', 'weapon', '권총', 4,
        { itemKey: 'goal:deleted', lockedByAdmin: 'deleted' });
      return { character: makeCharacter({ heroKey: deleted.itemKey, legendKey: '', transcendKey: '' }), issue: 'unavailable_target' };
    } },
    { name: 'virtual-goal', configure: (fixture) => {
      const virtual = fixture.addGear('wpn_virtual-goal', 'weapon', '권총', 4, { itemKey: 'goal:virtual' });
      return { character: makeCharacter({ heroKey: virtual.itemKey, legendKey: '', transcendKey: '' }), issue: 'unavailable_target' };
    } },
    { name: 'wrong-slot-goal', configure: (fixture) => {
      const wrongSlot = fixture.addGear('wrong-slot-goal', 'head', '', 4, { itemKey: 'goal:wrong-slot' });
      return { character: makeCharacter({ heroKey: wrongSlot.itemKey, legendKey: '', transcendKey: '' }), issue: 'slot_mismatch' };
    } },
    { name: 'missing-goal', configure: () => ({
      character: makeCharacter({ heroKey: 'goal:not-in-catalog', legendKey: '', transcendKey: '' }),
      issue: 'missing_target',
    }) },
  ];

  for (const scenario of cases) {
    const fixture = makeCatalog();
    const { character, issue } = scenario.configure(fixture);
    const before = structuredClone(character.goalLoadouts);
    const { actor } = buildOneRun(character, fixture.items, 0);
    assert.deepEqual(actor.goalLoadouts, before, `${scenario.name}: 사용자 목표를 덮어쓰면 안 됩니다.`);
    assert.ok(getActorGrowthProgress(actor, fixture.items).goalIssues.some((row) => row.reason === issue),
      `${scenario.name}: 기존 성장 진단 ${issue}가 남아야 합니다.`);
    if (scenario.name === 'allowed-excludes-goal') assert.equal(actor.runWeaponType, '돌격소총');
  }
});

check('영웅·전설·초월 간 계열 충돌과 tier 오기재를 숨기거나 goalLoadouts를 지우지 않는다', () => {
  const conflict = makeCatalog();
  const character = makeCharacter({ erWeapons: ['돌격소총', '권총'], legendKey: 'goal:legend-sniper' });
  const before = structuredClone(character.goalLoadouts);
  const { actor } = buildOneRun(character, conflict.items, 0);
  assert.equal(actor.runWeaponType, '돌격소총', '교집합이 비면 기존 허용 pool의 추첨으로 돌아가야 합니다.');
  assert.deepEqual(actor.goalLoadouts, before);
  assert.ok(getActorGrowthProgress(actor, conflict.items).goalIssues.some((row) => row.reason === 'weapon_mismatch'));
  assert.ok(getLateGrowthTargets({ ...actor, inventory: [], equipped: {} }, conflict.items, { authoredOnly: true }).issues
    .some((row) => row.reason === 'invalid_target'), '계열이 맞지 않는 후속 목표를 실제 late 성장 진단이 계속 표시해야 합니다.');

  const wrongTier = makeCatalog();
  const tierCharacter = makeCharacter({ legendKey: 'goal:transcend-sniper' });
  const tierBefore = structuredClone(tierCharacter.goalLoadouts);
  const tierRun = buildOneRun(tierCharacter, wrongTier.items, 0.5);
  assert.deepEqual(tierRun.actor.goalLoadouts, tierBefore);
  assert.ok(getLateGrowthTargets({ ...tierRun.actor, inventory: [], equipped: {} }, wrongTier.items, { authoredOnly: true }).issues
    .some((row) => row.key === 'goal:transcend-sniper' && row.reason === 'invalid_target'),
  '전설 슬롯에 초월 티어 목표를 지정한 오류는 계속 보여야 합니다.');
});

check('영웅 목표의 중복 alias는 전체 카탈로그 첫 행을 따르며 뒤의 유효 무기로 대체하지 않는다', () => {
  for (const firstRowKind of ['wrong-slot', 'deleted']) {
    const fixture = makeCatalog();
    const aliases = { itemKey: 'goal:hero-collision' };
    const first = firstRowKind === 'wrong-slot'
      ? fixture.addGear('first-hero-collision', 'head', '', 4, aliases)
      : fixture.addGear('first-hero-collision', 'weapon', '권총', 4, { ...aliases, lockedByAdmin: 'deleted' });
    fixture.addGear('later-valid-hero-collision', 'weapon', '권총', 4, aliases);
    const character = makeCharacter({ heroKey: 'goal:hero-collision', legendKey: '', transcendKey: '' });
    const before = structuredClone(character.goalLoadouts);
    const { actor } = buildOneRun(character, fixture.items, 0);
    assert.deepEqual(actor.goalLoadouts, before, '검사 입력에 명시한 목표는 런타임이 교체하면 안 됩니다.');
    assert.equal(actor.runWeaponType, '돌격소총',
      '첫 alias 행이 유효하지 않으면 뒤의 같은 alias를 목표로 삼아 pistol 계열로 재선택하면 안 됩니다.');
    const issue = getActorGrowthProgress(actor, fixture.items).goalIssues.find((row) => row.key === 'goal:hero-collision');
    assert.equal(issue?.reason, firstRowKind === 'wrong-slot' ? 'slot_mismatch' : 'unavailable_target');
    assert.equal(issue?.itemId, first._id, '전체 카탈로그 첫 alias 행의 실제 진단을 유지해야 합니다.');
  }
});

check('후속 목표 중복 alias는 첫 유효 T5/T6 recipe 장비를 선택한다', () => {
  const fixture = makeCatalog();
  const invalidRecipe = fixture.addGear('late-collision-no-recipe', 'weapon', '저격총', 5,
    { externalId: 'goal:late-collision', recipe: { ingredients: [] } });
  const firstValid = fixture.addGear('late-collision-first-valid', 'weapon', '권총', 5,
    { externalId: 'goal:late-collision' });
  fixture.addGear('late-collision-later-valid', 'weapon', '저격총', 5,
    { externalId: 'goal:late-collision' });
  const character = makeCharacter({
    legendKey: 'goal:late-collision',
    transcendKey: '',
  });
  const { actor } = buildOneRun(character, fixture.items, 0);
  assert.equal(actor.runWeaponType, '권총', '영웅 목표와 후속 selector가 허용하는 계열의 교집합이어야 합니다.');
  assert.notEqual(invalidRecipe._id, firstValid._id);
  const late = getLateGrowthTargets({ ...actor, inventory: [], equipped: {} }, fixture.items, { authoredOnly: true });
  assert.ok(late.targets.some((item) => item._id === firstValid._id), '첫 유효 T5 recipe 목표를 선택해야 합니다.');
  assert.ok(!late.targets.some((item) => item._id === 'late-collision-later-valid'), '뒤의 중복 목표로 alias를 덮으면 안 됩니다.');
  assert.ok(!late.issues.some((row) => row.key === 'goal:late-collision'));
});

check('같은 character·catalog 참조의 명시적 수정 후 다음 picker 호출은 새 목표와 분류를 읽는다', () => {
  const fixture = makeCatalog();
  const character = makeCharacter({
    id: 'mutable-call-local-fixture',
    erWeapons: ['돌격소총', '권총', '저격총'],
    heroKey: 'goal:hero-pistol',
    legendKey: '',
    transcendKey: '',
  });
  const mutableItems = fixture.items;
  const beforeFirst = structuredClone({ character, items: mutableItems });
  let firstDraws = 0;
  const first = pickInitialErWeaponTypeForGoals(character, mutableItems, () => { firstDraws += 1; return 0; });
  assert.equal(firstDraws, 1);
  assert.equal(first, '권총');
  assert.deepEqual({ character, items: mutableItems }, beforeFirst, '첫 picker 호출은 character/catalog을 바꾸면 안 됩니다.');

  // This is a deliberate test-fixture edit between two independent decisions,
  // not a runtime mutation. Reuse the same array and the same catalog row.
  const replacement = mutableItems.find((item) => item._id === 'weapon-t4-저격총');
  assert.ok(replacement);
  replacement.itemKey = 'goal:hero-sniper';
  replacement.weaponType = '돌격소총';
  character.goalLoadouts.hero.weaponKey = 'goal:hero-sniper';
  const beforeSecond = structuredClone({ character, items: mutableItems });
  let secondDraws = 0;
  const second = pickInitialErWeaponTypeForGoals(character, mutableItems, () => { secondDraws += 1; return 0; });
  assert.equal(secondDraws, 1);
  assert.equal(second, '돌격소총', '다음 호출은 변경된 목표 key와 같은 행의 새 weaponType을 읽어야 합니다.');
  assert.deepEqual({ character, items: mutableItems }, beforeSecond, '두 번째 picker 호출도 호출 시점 입력을 바꾸면 안 됩니다.');
});

check('erWeapons 누락 시 단일 weaponType fallback과 전체 pool이 기존 picker와 같다', () => {
  const fixture = makeCatalog();
  const cases = [
    { character: { _id: 'single-fallback', weaponType: '망치' }, rolls: [0, 0.5, 0.999999] },
    { character: { _id: 'all-pool-fallback', weaponType: '정의되지 않은 무기' }, rolls: [0, 0.5, 0.999999] },
  ];
  for (const { character, rolls: caseRolls } of cases) {
    for (const roll of caseRolls) {
      let legacyDraws = 0;
      const legacy = pickInitialErWeaponType(character, () => { legacyDraws += 1; return roll; });
      assert.equal(legacyDraws, 1);
      assertOneDrawPick(character, fixture.items, roll, legacy);
      if (character._id === 'single-fallback') assert.equal(legacy, '망치');
      else assert.equal(legacy, ER_WEAPON_TYPES_KO[Math.floor(roll * ER_WEAPON_TYPES_KO.length)]);
    }
  }
});

console.log(JSON.stringify({
  checks,
  rollCases: rolls.length,
  actualRosterRouteGrowthPath: true,
  helperConsumesOneRandomDraw: true,
  inputAndCatalogImmutable: true,
  invalidGoalsPreserved: true,
}, null, 2));
