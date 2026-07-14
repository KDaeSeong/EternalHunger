import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../src/app/games/primitive-archive/_lib/', import.meta.url);
const loreSource = await readFile(new URL('primitiveArchiveAdvancementLore.js', rootUrl), 'utf8');
const loreUrl = `data:text/javascript;base64,${Buffer.from(loreSource).toString('base64')}`;
const lore = await import(loreUrl);
const dataSource = (await readFile(new URL('primitiveArchiveData.js', rootUrl), 'utf8'))
  .replace("from './primitiveArchiveAdvancementLore';", `from '${loreUrl}';`);
const dataUrl = `data:text/javascript;base64,${Buffer.from(dataSource).toString('base64')}`;
const engineSource = (await readFile(new URL('primitiveArchiveEngine.js', rootUrl), 'utf8'))
  .replaceAll("} from './primitiveArchiveData';", `} from '${dataUrl}';`);
const engineUrl = `data:text/javascript;base64,${Buffer.from(engineSource).toString('base64')}`;
const engine = await import(engineUrl);
const runtimeSource = (await readFile(new URL('primitiveArchivePageRuntime.js', rootUrl), 'utf8'))
  .replace("} from './primitiveArchiveEngine';", `} from '${engineUrl}';`);
const runtimeUrl = `data:text/javascript;base64,${Buffer.from(runtimeSource).toString('base64')}`;
const runtime = await import(runtimeUrl);
const feedbackSource = await readFile(new URL('primitiveArchiveFeedback.js', rootUrl), 'utf8');
const feedbackUrl = `data:text/javascript;base64,${Buffer.from(feedbackSource).toString('base64')}`;
const feedback = await import(feedbackUrl);
const componentRootUrl = new URL('../src/app/games/primitive-archive/_components/', import.meta.url);
const actionWorkspaceSource = await readFile(new URL('PrimitiveArchiveActionWorkspace.js', componentRootUrl), 'utf8');
const campWorkspaceSource = await readFile(new URL('PrimitiveArchiveCampWorkspace.js', componentRootUrl), 'utf8');
const runTabSource = await readFile(new URL('PrimitiveArchiveRunTab.js', componentRootUrl), 'utf8');
const growthTabSource = await readFile(new URL('PrimitiveArchiveGrowthTab.js', componentRootUrl), 'utf8');
const researchPreviewSource = await readFile(new URL('PrimitiveArchiveResearchTreePreview.js', componentRootUrl), 'utf8');
const advancementQuoteSource = await readFile(new URL('PrimitiveArchiveAdvancementQuote.js', componentRootUrl), 'utf8');

assert.doesNotMatch(
  engineSource,
  /이\(가\)|은\(는\)|을\(를\)|\(으\)로/,
  '플레이어에게 보이는 엔진 문장에는 병기형 조사가 남으면 안 됩니다.',
);
assert.equal(engine.subjectParticle('시로코'), '시로코가', '주격 조사는 받침 유무를 반영해야 합니다.');
assert.equal(engine.topicParticle('수렵'), '수렵은', '보조사는 받침 유무를 반영해야 합니다.');
assert.equal(engine.objectParticle('끈'), '끈을', '목적격 조사는 받침 유무를 반영해야 합니다.');
assert.equal(engine.directionParticle('정착'), '정착으로', '방향격 조사는 받침 유무를 반영해야 합니다.');

const base = engine.createNewState({ rng: () => 0.5 });
assert.deepEqual(
  engine.difficultyRows().map((preset) => preset.key),
  ['veryeasy', 'easy', 'normal', 'hard', 'nightmare'],
  '난이도는 매우 쉬움부터 악몽까지 순서대로 제공되어야 합니다.',
);
const veryEasy = engine.createNewState({ difficulty: 'veryeasy', rng: () => 0.5, runId: 'very-easy-check' });
assert.equal(veryEasy.difficulty, 'veryeasy', '매우 쉬움 난이도 키가 저장 상태에 유지되어야 합니다.');
assert.equal(veryEasy.apMax, 6, '매우 쉬움은 하루 AP를 6 제공해야 합니다.');
assert.equal(veryEasy.inventory.berry, 6, '매우 쉬움 시작 보급은 기본 열매 2개에 추가 4개를 제공해야 합니다.');
assert.equal(veryEasy.inventory.meat, 1, '매우 쉬움은 첫 식사 실패를 완화할 고기 1개를 제공해야 합니다.');
const pressuredVeryEasy = {
  ...veryEasy,
  weather: { ...veryEasy.weather, actionMod: -0.12 },
};
assert.ok(
  engine.actionChance(pressuredVeryEasy, 'shiroko', 'gather', 0) >= 0.9,
  '매우 쉬움은 날씨가 나빠도 행동 성공률 최저 90%를 보장해야 합니다.',
);
const normalForChance = engine.createNewState({ difficulty: 'normal', rng: () => 0.5, runId: 'normal-check' });
assert.ok(
  engine.actionChance(veryEasy, 'shiroko', 'gather', 0.55) > engine.actionChance(normalForChance, 'shiroko', 'gather', 0.55),
  '매우 쉬움은 같은 조건의 보통보다 행동 성공률이 높아야 합니다.',
);
const normalSeventyChance = engine.actionChance(normalForChance, 'shiroko', 'gather', 0.45);
const veryEasyNinetyChance = engine.actionChance(veryEasy, 'shiroko', 'gather', 0.45);
assert.ok(
  normalSeventyChance >= 0.7 && normalSeventyChance < 0.71,
  '보통 난이도 비교 행동은 70%대 성공률이어야 합니다.',
);
assert.ok(
  veryEasyNinetyChance >= 0.9 && veryEasyNinetyChance < 0.91,
  '매우 쉬움은 같은 행동을 90%대 성공률로 올려야 합니다.',
);
assert.ok(
  Math.abs((veryEasyNinetyChance - normalSeventyChance) - 0.2) < Number.EPSILON,
  '매우 쉬움은 행동 성공률에 정확히 20%p 보정을 적용해야 합니다.',
);
assert.ok(
  engine.regionalActionChance(veryEasy, 'shiroko', 'hunt') >= 0.9,
  '매우 쉬움은 위험 지역을 포함한 최종 행동 성공률도 최소 90%를 보장해야 합니다.',
);
assert.equal(engine.normalizeState(veryEasy).difficulty, 'veryeasy', '저장 불러오기 뒤에도 매우 쉬움 난이도가 유지되어야 합니다.');
assert.match(runTabSource, /성공.*actionChanceBonus/, '난이도 카드에는 행동 성공률 보정이 표시되어야 합니다.');
const campLogState = engine.runCampAction(base, 'shiroko', 'fuel', { rng: () => 0.5 });
assert.match(campLogState.log.join('\n'), /시로코가 모닥불 연료를 보충했습니다/, '캠프 행동 로그는 올바른 주격 조사를 사용해야 합니다.');
const overlap = engine.TECHNOLOGY_TREE.filter((technology) => (
  engine.CIVIC_TREE.some((civic) => civic.id === technology.id)
));
assert.equal(overlap.length, 0, '기술과 사회 제도 목록이 겹치면 안 됩니다.');
assert.ok(engine.TECHNOLOGY_TREE.length > engine.CIVIC_TREE.length, '기술과 사회 제도 목록이 비어 있으면 안 됩니다.');
const allAdvancements = [...engine.TECHNOLOGY_TREE, ...engine.CIVIC_TREE];
const advancementById = Object.fromEntries(engine.TECH_TREE.map((advancement) => [advancement.id, advancement]));
assert.ok(
  allAdvancements.every((advancement) => (
    advancement.quote?.text
    && advancement.quote?.author
    && advancement.quote?.work
    && /^https:\/\//.test(advancement.quote?.sourceUrl || '')
  )),
  '모든 기술과 사회 제도에는 인용문, 저자, 저작, 출처 URL이 있어야 합니다.',
);
assert.ok(
  allAdvancements.every((advancement) => advancement.quote.explicit),
  '모든 기술과 사회 제도는 태그 기본값이 아니라 주제에 맞는 인용구를 명시 배정해야 합니다.',
);
const quoteAssignments = Object.entries(lore.ADVANCEMENT_QUOTE_ASSIGNMENTS)
  .flatMap(([key, ids]) => ids.map((id) => ({ id, key })));
assert.equal(
  new Set(quoteAssignments.map((assignment) => assignment.id)).size,
  quoteAssignments.length,
  '한 발전 항목을 여러 인용구 주제에 중복 배정하면 안 됩니다.',
);
assert.deepEqual(
  quoteAssignments.map((assignment) => assignment.id).filter((id) => !advancementById[id]),
  [],
  '인용구 매핑에는 존재하지 않는 발전 ID가 들어가면 안 됩니다.',
);
const expectedQuoteKeys = {
  POTTERY: 'pottery',
  STONE_TOOLS: 'tools',
  POETRY: 'poetry',
  MICROSCOPE: 'optics',
  EMPIRICISM: 'empiricism',
  EARLY_ART: 'art',
  EARLY_MUSIC: 'music',
  UTILITARIANISM: 'utilitarianism',
  THERMODYNAMICS: 'steam',
  ELECTROMAGNETISM: 'electricity',
  FOOD_CANNING: 'foodPreservation',
  REFRIGERATION: 'refrigeration',
  RELIGIOUS_LIBERTY: 'tolerance',
};
Object.entries(expectedQuoteKeys).forEach(([advancementId, quoteKey]) => {
  assert.equal(
    advancementById[advancementId]?.quote?.key,
    quoteKey,
    `${advancementId}는 ${quoteKey} 주제의 인용구를 사용해야 합니다.`,
  );
});
assert.ok(
  new Set(allAdvancements.map((advancement) => advancement.quote.key)).size >= 18,
  '인용구는 기술 주제에 맞게 충분히 다양한 고전 출처를 사용해야 합니다.',
);
assert.equal(
  new Set(engine.TECHNOLOGY_TREE.map((technology) => technology.name)).size,
  engine.TECHNOLOGY_TREE.length,
  '기술 표시 이름은 중복되면 안 됩니다.',
);
assert.equal(
  new Set(engine.CIVIC_TREE.map((civic) => civic.name)).size,
  engine.CIVIC_TREE.length,
  '사회 제도 표시 이름은 중복되면 안 됩니다.',
);
const expectedCivilizationStyleNames = {
  FIREMAKING: '불의 이용',
  BASIC_MATH: '수학',
  BASIC_PHILOSOPHY: '철학',
  EARLY_CONSTRUCTION: '건축술',
  ASTRONOMY_EARLY: '천문학',
  EARLY_HORSEBACK: '기마술',
  EARLY_IRONWORKING: '철기 가공',
  BASIC_SHIPBUILDING: '조선술',
  EARLY_CURRENCY: '화폐',
  MOVABLE_TYPE_PRINTING: '인쇄술',
  GUNPOWDER_MILL: '화약',
  EARLY_STEAM_ENGINE: '증기력',
  FEUDAL_CONTRACT: '봉건제',
  BUREAUCRATIC_STATE: '관료제',
  SOCIAL_CONTRACT: '사회 계약',
};
Object.entries(expectedCivilizationStyleNames).forEach(([id, name]) => {
  assert.equal(advancementById[id]?.name, name, `${id}는 문명식 간결한 표시 이름을 사용해야 합니다.`);
});
assert.match(growthTabSource, /PrimitiveArchiveAdvancementQuote quote=\{focusedTreeNode\.quote\}/, '진행 중 발전 트리는 인용구를 표시해야 합니다.');
assert.match(researchPreviewSource, /PrimitiveArchiveAdvancementQuote quote=\{focusedNode\.quote\}/, '발전 트리 미리보기는 인용구를 표시해야 합니다.');
assert.match(advancementQuoteSource, /target="_blank"/, '인용구 출처는 새 탭에서 원문을 열어야 합니다.');
assert.ok(engine.CIVIC_TREE.every((civic) => civic.inspiration), '모든 사회 제도에는 영감 조건이 있어야 합니다.');
assert.ok(engine.TECHNOLOGY_TREE.every((technology) => !technology.inspiration), '기술 트리에는 영감 조건이 남으면 안 됩니다.');
assert.ok(engine.CIVIC_TREE.every((civic) => !civic.eureka), '사회 제도 트리에는 유레카 조건이 남으면 안 됩니다.');

const technologyIds = new Set(engine.TECHNOLOGY_TREE.map((technology) => technology.id));
const civicIds = new Set(engine.CIVIC_TREE.map((civic) => civic.id));
const trackForId = (id) => civicIds.has(id) ? 'civics' : technologyIds.has(id) ? 'technology' : '';
engine.TECH_TREE.forEach((advancement) => {
  (advancement.prereqs || []).forEach((prereqId) => {
    const prereq = advancementById[prereqId];
    assert.ok(prereq, `${advancement.name}의 선행 발전 ${prereqId}가 존재해야 합니다.`);
    if (trackForId(prereqId) === trackForId(advancement.id)) {
      assert.ok(
        Number(prereq.tier) < Number(advancement.tier),
        `${advancement.name}의 같은 트리 선행 발전은 더 낮은 단계여야 합니다.`,
      );
    }
  });
});
const reachableAdvancements = new Set();
let discoveredAdvancement = true;
while (discoveredAdvancement) {
  discoveredAdvancement = false;
  engine.TECH_TREE.forEach((advancement) => {
    if (reachableAdvancements.has(advancement.id)) return;
    if ((advancement.prereqs || []).every((prereqId) => reachableAdvancements.has(prereqId))) {
      reachableAdvancements.add(advancement.id);
      discoveredAdvancement = true;
    }
  });
}
assert.equal(reachableAdvancements.size, engine.TECH_TREE.length, '기술과 사회 제도의 교차 선행 관계에 순환이 없어야 합니다.');

function assertStageCostsDoNotRegress(rows, label) {
  const tiers = [...new Set(rows.map((row) => row.tier))].sort((left, right) => left - right);
  let previousMax = 0;
  tiers.forEach((tier) => {
    const costs = rows.filter((row) => row.tier === tier).map((row) => Number(row.cost || 0));
    assert.ok(Math.min(...costs) >= previousMax, `${label} ${tier}단계 비용이 이전 단계보다 낮아지면 안 됩니다.`);
    previousMax = Math.max(...costs);
  });
}

assertStageCostsDoNotRegress(engine.TECHNOLOGY_TREE, '기술');
assertStageCostsDoNotRegress(engine.CIVIC_TREE, '사회 제도');
assert.deepEqual(
  engine.TECH_TIER_DEFS.map((definition) => definition.tier),
  Array.from({ length: 30 }, (_, index) => index + 1),
  '기술 단계는 T1부터 T30까지 연속이어야 합니다.',
);
assert.deepEqual(
  engine.CIVIC_TIER_DEFS.map((definition) => definition.tier),
  Array.from({ length: 26 }, (_, index) => index + 1),
  '사회 제도 단계는 C1부터 C26까지 연속이어야 합니다.',
);

const classicalTechnologies = engine.TECHNOLOGY_TREE.filter((technology) => technology.era === 'CLASSICAL');
const classicalCivics = engine.CIVIC_TREE.filter((civic) => civic.era === 'CLASSICAL');
const medievalTechnologies = engine.TECHNOLOGY_TREE.filter((technology) => technology.era === 'MEDIEVAL');
const medievalCivics = engine.CIVIC_TREE.filter((civic) => civic.era === 'MEDIEVAL');
const earlyModernTechnologies = engine.TECHNOLOGY_TREE.filter((technology) => technology.era === 'EARLY_MODERN');
const earlyModernCivics = engine.CIVIC_TREE.filter((civic) => civic.era === 'EARLY_MODERN');
const modernEarlyTechnologies = engine.TECHNOLOGY_TREE.filter((technology) => technology.era === 'MODERN_EARLY');
const modernEarlyCivics = engine.CIVIC_TREE.filter((civic) => civic.era === 'MODERN_EARLY');
const expansionBranches = ['ENGINEERING', 'FAITH', 'LITERATURE', 'MILITARY', 'NATURAL_PHILOSOPHY', 'SURVIVAL'];
assert.equal(classicalTechnologies.length, 17, '고전 시대에는 기술 17개가 있어야 합니다.');
assert.equal(classicalCivics.length, 13, '고전 시대에는 사회 제도 13개가 있어야 합니다.');
assert.ok(classicalTechnologies.every((technology) => technology.eureka), '모든 고전 기술에는 유레카가 있어야 합니다.');
assert.ok(classicalCivics.every((civic) => civic.inspiration), '모든 고전 사회 제도에는 영감이 있어야 합니다.');
assert.deepEqual(
  [...new Set([...classicalTechnologies, ...classicalCivics].map((advancement) => advancement.branch))].sort(),
  expansionBranches,
  '고전 시대는 신앙·이학·문학·군사·생존·기술 여섯 계통을 모두 포함해야 합니다.',
);
assert.equal(medievalTechnologies.length, 24, '중세 확장에는 기술 24개가 있어야 합니다.');
assert.equal(medievalCivics.length, 18, '중세 확장에는 사회 제도 18개가 있어야 합니다.');
assert.ok(medievalTechnologies.every((technology) => technology.eureka), '모든 중세 기술에는 유레카가 있어야 합니다.');
assert.ok(medievalCivics.every((civic) => civic.inspiration), '모든 중세 사회 제도에는 영감이 있어야 합니다.');
assert.deepEqual(
  [...new Set([...medievalTechnologies, ...medievalCivics].map((advancement) => advancement.branch))].sort(),
  expansionBranches,
  '중세 확장은 신앙·이학·문학·군사·생존·기술 여섯 계통을 모두 포함해야 합니다.',
);
assert.equal(earlyModernTechnologies.length, 24, '근세 확장에는 기술 24개가 있어야 합니다.');
assert.equal(earlyModernCivics.length, 18, '근세 확장에는 사회 제도 18개가 있어야 합니다.');
assert.ok(earlyModernTechnologies.every((technology) => technology.eureka), '모든 근세 기술에는 유레카가 있어야 합니다.');
assert.ok(earlyModernCivics.every((civic) => civic.inspiration), '모든 근세 사회 제도에는 영감이 있어야 합니다.');
assert.deepEqual(
  [...new Set([...earlyModernTechnologies, ...earlyModernCivics].map((advancement) => advancement.branch))].sort(),
  expansionBranches,
  '근세 확장은 신앙·이학·문학·군사·생존·기술 여섯 계통을 모두 포함해야 합니다.',
);
assert.equal(modernEarlyTechnologies.length, 24, '전기 근대 확장에는 기술 24개가 있어야 합니다.');
assert.equal(modernEarlyCivics.length, 18, '전기 근대 확장에는 사회 제도 18개가 있어야 합니다.');
assert.ok(modernEarlyTechnologies.every((technology) => technology.eureka), '모든 전기 근대 기술에는 유레카가 있어야 합니다.');
assert.ok(modernEarlyCivics.every((civic) => civic.inspiration), '모든 전기 근대 사회 제도에는 영감이 있어야 합니다.');
assert.deepEqual(
  [...new Set([...modernEarlyTechnologies, ...modernEarlyCivics].map((advancement) => advancement.branch))].sort(),
  expansionBranches,
  '전기 근대 확장은 신앙·이학·문학·군사·생존·기술 여섯 계통을 모두 포함해야 합니다.',
);
assert.equal(engine.TECHNOLOGY_TREE.length, 126, '기술 트리는 전기 근대 확장을 포함해 126개여야 합니다.');
assert.equal(engine.CIVIC_TREE.length, 76, '사회 제도 트리는 전기 근대 확장을 포함해 76개여야 합니다.');

const expansionPassives = [
  ...classicalTechnologies,
  ...classicalCivics,
  ...medievalTechnologies,
  ...medievalCivics,
  ...earlyModernTechnologies,
  ...earlyModernCivics,
  ...modernEarlyTechnologies,
  ...modernEarlyCivics,
]
  .flatMap((advancement) => advancement.unlocks?.passives || []);
expansionPassives.forEach((passiveId) => {
  assert.ok(
    engineSource.includes(`'${passiveId}'`),
    `${passiveId} 패시브는 데이터 설명뿐 아니라 실제 엔진 효과에 연결되어야 합니다.`,
  );
});

const ready = engine.normalizeState({
  ...base,
  ap: 4,
  camp: { ...base.camp, fireLevel: 1, shelterLevel: 1, workbenchLevel: 1 },
  research: {
    ...base.research,
    selectedTechId: 'FIREMAKING',
    completed: { GATHERING: true, HUNTING: true, SHELTER: true, HERBALISM: true, POTTERY: true },
  },
  civics: { ...base.civics, selectedCivicId: 'SETTLEMENT' },
});
const beforeCivicProgress = Number(ready.civics.progress.SETTLEMENT || 0);
const afterCivicAction = engine.runCivicAction(ready, 'shiroko', { rng: () => 0.5 });
const civicGain = Number(afterCivicAction.civics.progress.SETTLEMENT || 0) - beforeCivicProgress;
assert.ok(civicGain > 0, '부족 회의는 선택한 사회 제도에 CP를 추가해야 합니다.');
assert.equal(engine.civicsSummary(afterCivicAction).total, engine.CIVIC_TREE.length, '사회 제도 요약은 전체 트리 수를 반영해야 합니다.');
assert.ok(engine.civicsPlannerRows(afterCivicAction).some((civic) => civic.id === 'SETTLEMENT'), '사회 제도 플래너에 선택 후보가 표시되어야 합니다.');

let completedCivicState = ready;
for (let index = 0; index < 8 && !completedCivicState.civics.completed.SETTLEMENT; index += 1) {
  completedCivicState = engine.runCivicAction(completedCivicState, 'shiroko', { rng: () => 0.5 });
}
assert.equal(completedCivicState.civics.completed.SETTLEMENT, true, 'CP가 비용에 도달하면 사회 제도가 확립되어야 합니다.');
assert.equal(completedCivicState.research.completed.SETTLEMENT, true, '사회 제도 완료는 교차 선행 판정용 발전 기록에도 반영되어야 합니다.');
assert.equal(
  engine.techRows(completedCivicState).find((technology) => technology.id === 'AGRICULTURE')?.available,
  true,
  '사회 제도 완료로 연결된 기술의 선행 조건이 열려야 합니다.',
);

const inspired = engine.runGatherAction(ready, 'shiroko', 'whisper-woods', { rng: () => 0 });
assert.equal(inspired.civics.inspiration.SETTLEMENT, true, '사회 제도 영감 조건을 충족하면 보너스가 적용되어야 합니다.');
assert.equal(Object.keys(inspired.research.inspiration || {}).length, 0, '기술 트리에는 영감 보너스가 적용되면 안 됩니다.');
const civicMap = runtime.buildResearchMap(engine.civicRows(ready));
const technologyMap = runtime.buildResearchMap(engine.techRows(ready));

function pathSegments(path) {
  const tokens = String(path || '').match(/[MHV]|-?\d+(?:\.\d+)?/g) || [];
  const segments = [];
  let cursor = 0;
  let x = 0;
  let y = 0;
  while (cursor < tokens.length) {
    const command = tokens[cursor];
    cursor += 1;
    if (command === 'M') {
      x = Number(tokens[cursor]);
      y = Number(tokens[cursor + 1]);
      cursor += 2;
    } else if (command === 'H') {
      const nextX = Number(tokens[cursor]);
      cursor += 1;
      segments.push({ x1: x, y1: y, x2: nextX, y2: y });
      x = nextX;
    } else if (command === 'V') {
      const nextY = Number(tokens[cursor]);
      cursor += 1;
      segments.push({ x1: x, y1: y, x2: x, y2: nextY });
      y = nextY;
    }
  }
  return segments;
}

function segmentCrossesNode(segment, node) {
  const left = node.x + 1;
  const right = node.x + node.width - 1;
  const top = node.y + 1;
  const bottom = node.y + node.height - 1;
  if (segment.y1 === segment.y2) {
    return segment.y1 > top
      && segment.y1 < bottom
      && Math.max(segment.x1, segment.x2) > left
      && Math.min(segment.x1, segment.x2) < right;
  }
  return segment.x1 > left
    && segment.x1 < right
    && Math.max(segment.y1, segment.y2) > top
    && Math.min(segment.y1, segment.y2) < bottom;
}

function assertNoUnrelatedNodeCrossings(map, label) {
  map.edges.forEach((edge) => {
    const unrelatedNodes = map.nodes.filter((node) => node.id !== edge.from && node.id !== edge.to);
    pathSegments(edge.path).forEach((segment) => {
      const crossed = unrelatedNodes.find((node) => segmentCrossesNode(segment, node));
      assert.equal(crossed, undefined, `${label} ${edge.from} -> ${edge.to} 선이 ${crossed?.name || crossed?.id || '다른 노드'}를 가로지르면 안 됩니다.`);
    });
  });
}

assert.equal(technologyMap.minTier, 1, '기술 트리는 T1부터 시작해야 합니다.');
assert.equal(technologyMap.maxTier, 30, '기술 트리는 T30에서 끝나야 합니다.');
assert.equal(technologyMap.rangeLabel, 'T1-T30', '기술 트리는 T 접두사를 사용해야 합니다.');
assert.equal(technologyMap.tierCount, 30, '기술 트리는 서른 단계가 모두 표시되어야 합니다.');
assert.deepEqual(
  technologyMap.tierHeaders.slice(0, 4).map((tier) => tier.count),
  [2, 4, 4, 3],
  '초반 기술 단계는 생존 기초에서 전문 생존으로 자연스럽게 분산되어야 합니다.',
);
assert.equal(civicMap.minTier, 1, '사회 제도 트리는 C1부터 시작해야 합니다.');
assert.equal(civicMap.maxTier, 26, '사회 제도 트리는 C26에서 끝나야 합니다.');
assert.equal(civicMap.rangeLabel, 'C1-C26', '사회 제도 트리는 C 접두사를 사용해야 합니다.');
assert.equal(civicMap.tierCount, 26, '사회 제도 트리는 스물여섯 단계가 모두 표시되어야 합니다.');
assert.ok(civicMap.nodes.every((node) => node.tierLabel.startsWith('C')), '사회 제도 노드는 C 단계 라벨을 사용해야 합니다.');
assert.ok(technologyMap.nodes.every((node) => node.tierLabel.startsWith('T')), '기술 노드는 T 단계 라벨을 사용해야 합니다.');
const technologyEdgeCount = engine.TECHNOLOGY_TREE.reduce((sum, technology) => (
  sum + (technology.prereqs || []).filter((prereqId) => technologyIds.has(prereqId)).length
), 0);
const civicEdgeCount = engine.CIVIC_TREE.reduce((sum, civic) => (
  sum + (civic.prereqs || []).filter((prereqId) => civicIds.has(prereqId)).length
), 0);
const totalPrerequisiteCount = engine.TECH_TREE.reduce((sum, advancement) => sum + (advancement.prereqs || []).length, 0);
const crossTrackGateCount = totalPrerequisiteCount - technologyEdgeCount - civicEdgeCount;
assert.equal(technologyMap.edges.length, technologyEdgeCount, '기술 트리는 같은 트리 내부 선행선만 그려야 합니다.');
assert.equal(civicMap.edges.length, civicEdgeCount, '사회 제도 트리는 같은 트리 내부 선행선만 그려야 합니다.');
assertNoUnrelatedNodeCrossings(technologyMap, '기술 트리');
assertNoUnrelatedNodeCrossings(civicMap, '사회 제도 트리');
const huntingRow = engine.techRows(ready).find((technology) => technology.id === 'HUNTING');
const militaryTraditionRow = engine.civicRows(ready).find((civic) => civic.id === 'MILITARY_TRADITION');
assert.deepEqual(huntingRow.nextTechIds, [], '수렵은 억지 장거리 기술선 대신 사회 제도로 이어져야 합니다.');
assert.ok(
  huntingRow.nextCrossTrackRows.some((row) => row.id === 'MILITARY_TRADITION'),
  '수렵 상세에는 군사 전통으로 이어지는 교차 트리 후속 발전이 표시되어야 합니다.',
);
assert.ok(
  militaryTraditionRow.nextCrossTrackRows.some((row) => row.id === 'TRAPPING'),
  '군사 전통 상세에는 덫 사냥으로 이어지는 교차 트리 후속 기술이 표시되어야 합니다.',
);
assert.ok(
  civicMap.nodes.every((node) => node.x >= 0 && node.x + node.width <= civicMap.width),
  '사회 제도 노드는 트리 캔버스 안에 배치되어야 합니다.',
);
assert.equal(runtime.advancementAction(['MILITARY'], 'technology'), 'combat', '군사 기술은 전투 계통 아이콘을 사용해야 합니다.');
assert.equal(runtime.advancementAction(['CULTURE'], 'civics'), 'archive', '문화 제도는 기록 계통 아이콘을 사용해야 합니다.');
assert.equal(runtime.advancementAction([], 'civics'), 'policy', '태그가 없는 사회 제도는 제도 아이콘으로 대체해야 합니다.');
assert.equal(runtime.advancementAction(['SPIRITUAL'], 'civics', 'FAITH'), 'counsel', '중세 신앙 계통은 전용 아이콘을 사용해야 합니다.');
assert.equal(runtime.RESEARCH_ERA_LABELS.MEDIEVAL, '중세', '중세 시대 라벨이 표시되어야 합니다.');
assert.equal(runtime.RESEARCH_ERA_LABELS.EARLY_MODERN, '근세', '근세 시대 라벨이 표시되어야 합니다.');
assert.equal(runtime.RESEARCH_ERA_LABELS.MODERN_EARLY, '전기 근대', '전기 근대 시대 라벨이 표시되어야 합니다.');

const actorStatusMatches = actionWorkspaceSource.match(/primitive-acting-vitals/g) || [];
assert.ok(actorStatusMatches.length >= 1, '행동 패널에는 선택한 캐릭터의 상태가 표시되어야 합니다.');
assert.match(actionWorkspaceSource, /recipeMaterialsReady/, '제작 버튼은 보유 재료를 기준으로 활성화되어야 합니다.');
assert.match(campWorkspaceSource, /primitive-material-status/, '캠프 행동에는 보유\/필요 재료 수치가 표시되어야 합니다.');
assert.match(campWorkspaceSource, /action\.enabled/, '캠프 행동은 재료가 부족하면 비활성화되어야 합니다.');

const emptyCampState = engine.normalizeState({
  ...base,
  inventory: { ...base.inventory, wood: 0, stone: 0, fiber: 0, hide: 0, meat: 0 },
  camp: { ...base.camp, fuel: 0 },
});
const emptyCampRows = engine.campActionRows(emptyCampState);
assert.equal(emptyCampRows.find((row) => row.id === 'fire')?.enabled, false, '모닥불 재료가 부족하면 행동이 비활성화되어야 합니다.');
assert.match(emptyCampRows.find((row) => row.id === 'fire')?.materialText || '', /나무 0\/2/, '캠프 재료에는 보유량과 필요량이 함께 표시되어야 합니다.');
const rejectedCampState = engine.runCampAction(emptyCampState, 'shiroko', 'fire', { rng: () => 0.5 });
assert.equal(rejectedCampState.ap, emptyCampState.ap, '재료 부족으로 거절된 캠프 행동은 AP를 소모하면 안 됩니다.');
const readyCampState = engine.normalizeState({
  ...base,
  inventory: { ...base.inventory, wood: 4, stone: 2, meat: 1 },
  camp: { ...base.camp, fireLevel: 1, fuel: 1 },
});
assert.equal(engine.campActionRows(readyCampState).find((row) => row.id === 'workbench')?.enabled, true, '재료가 충분한 캠프 행동은 활성화되어야 합니다.');
assert.equal(engine.campActionRows(readyCampState).find((row) => row.id === 'cook')?.enabled, true, '모닥불·연료·고기가 있으면 조리가 활성화되어야 합니다.');
const maxedCampState = engine.normalizeState({
  ...readyCampState,
  camp: { ...readyCampState.camp, workbenchLevel: 2 },
});
assert.equal(engine.campActionRows(maxedCampState).find((row) => row.id === 'workbench')?.enabled, false, '최대 레벨 시설은 재료가 있어도 비활성화되어야 합니다.');
const unavailableRecipe = engine.recipeRows(emptyCampState).find((row) => row.id === 'twine');
assert.equal(unavailableRecipe.materialsReady, false, '제작 레시피도 보유 재료 부족 여부를 제공해야 합니다.');
assert.match(unavailableRecipe.materialText, /섬유 0\/2/, '제작 레시피에는 보유\/필요 재료 수치가 포함되어야 합니다.');

const medievalEffectState = engine.normalizeState({
  ...base,
  research: {
    ...base.research,
    completed: {
      THREE_FIELD_SYSTEM: true,
      BLOOMERY_FURNACE: true,
      CHIVALRIC_CODE: true,
      CHAINMAIL: true,
      FEUDAL_CONTRACT: true,
      ESTATES_ASSEMBLY: true,
    },
  },
});
assert.ok(
  engine.actionChance(medievalEffectState, 'shiroko', 'gather', 0.5) > engine.actionChance(base, 'shiroko', 'gather', 0.5),
  '삼포농법은 실제 채집 성공률을 높여야 합니다.',
);
assert.ok(
  engine.actionChance(medievalEffectState, 'noa', 'craft', 0.5) > engine.actionChance(base, 'noa', 'craft', 0.5),
  '괴철로는 실제 제작 성공률을 높여야 합니다.',
);
assert.equal(engine.getPartyCap(medievalEffectState), engine.getPartyCap(base) + 2, '중세 사회 제도는 파티 정원을 실제로 늘려야 합니다.');
assert.ok(engine.huntFailureDamage(medievalEffectState) < engine.huntFailureDamage(base), '중세 방어 기술은 사냥 실패 피해를 줄여야 합니다.');

const classicalEffectState = engine.normalizeState({
  ...base,
  research: {
    ...base.research,
    completed: {
      CROP_CALENDAR: true,
      LEVER_MECHANICS: true,
      STEEL_QUENCHING: true,
      CIVIC_LAW: true,
      CLASSICAL_EDUCATION: true,
    },
  },
});
assert.ok(
  engine.actionChance(classicalEffectState, 'shiroko', 'gather', 0.5) > engine.actionChance(base, 'shiroko', 'gather', 0.5),
  '경작력은 실제 채집 성공률을 높여야 합니다.',
);
assert.ok(
  engine.actionChance(classicalEffectState, 'noa', 'craft', 0.5) > engine.actionChance(base, 'noa', 'craft', 0.5),
  '지레 역학은 실제 제작 성공률을 높여야 합니다.',
);
assert.equal(engine.getPartyCap(classicalEffectState), engine.getPartyCap(base) + 1, '시민법은 파티 정원을 실제로 늘려야 합니다.');

const earlyModernEffectState = engine.normalizeState({
  ...base,
  research: {
    ...base.research,
    completed: {
      BOTANICAL_CLASSIFICATION: true,
      ARQUEBUS: true,
      STANDING_ARMY: true,
      SOCIAL_CONTRACT: true,
      COPPERPLATE_PRINTING: true,
    },
  },
});
assert.ok(
  engine.actionChance(earlyModernEffectState, 'shiroko', 'gather', 0.5) > engine.actionChance(base, 'shiroko', 'gather', 0.5),
  '식물 분류학은 실제 채집 성공률을 높여야 합니다.',
);
assert.ok(
  engine.actionChance(earlyModernEffectState, 'shiroko', 'hunt', 0.5) > engine.actionChance(base, 'shiroko', 'hunt', 0.5),
  '조총은 실제 사냥 성공률을 높여야 합니다.',
);
assert.equal(engine.getPartyCap(earlyModernEffectState), engine.getPartyCap(base) + 2, '근세 사회 제도는 파티 정원을 실제로 늘려야 합니다.');
assert.ok(engine.logCapacity(earlyModernEffectState) > engine.logCapacity(base), '동판 인쇄는 로그 저장량을 실제로 늘려야 합니다.');

const modernEarlyCompleted = {
  ROTARY_STEAM_POWER: true,
  MODERN_CHEMISTRY: true,
  MECHANIZED_FARMING: true,
  RIFLED_MUSKET: true,
  STEAM_PRINTING_PRESS: true,
  MISSIONARY_MEDICINE: true,
  INDUSTRIAL_ENTREPRENEURSHIP: true,
  UTILITARIANISM: true,
  AGRARIAN_REFORM: true,
  MASS_CONSCRIPTION: true,
  FREEDOM_OF_PRESS: true,
  EVANGELICAL_REVIVAL: true,
};
const modernEarlyEffectState = engine.normalizeState({
  ...base,
  ap: 4,
  research: { ...base.research, completed: modernEarlyCompleted },
  civics: {
    ...base.civics,
    completed: {
      INDUSTRIAL_ENTREPRENEURSHIP: true,
      UTILITARIANISM: true,
      AGRARIAN_REFORM: true,
      MASS_CONSCRIPTION: true,
      FREEDOM_OF_PRESS: true,
      EVANGELICAL_REVIVAL: true,
    },
  },
});
[
  'MODERN_ENGINEERING_TECH_STACK',
  'MODERN_SCIENCE_TECH_STACK',
  'MODERN_SURVIVAL_TECH_STACK',
  'MODERN_MILITARY_TECH_STACK',
  'MODERN_MEDIA_TECH_STACK',
  'MODERN_MEDICAL_TECH_STACK',
  'MODERN_ENGINEERING_CIVIC_STACK',
  'MODERN_SCIENCE_CIVIC_STACK',
  'MODERN_SURVIVAL_CIVIC_STACK',
  'MODERN_MILITARY_CIVIC_STACK',
  'MODERN_MEDIA_CIVIC_STACK',
  'MODERN_FAITH_CIVIC_STACK',
].forEach((passiveId) => {
  assert.equal(engine.passiveStackCount(modernEarlyEffectState, passiveId), 1, `${passiveId} 완료 수를 누적해야 합니다.`);
});
assert.ok(
  engine.actionChance(modernEarlyEffectState, 'shiroko', 'gather', 0.5) > engine.actionChance(base, 'shiroko', 'gather', 0.5),
  '전기 근대 생존 발전은 실제 채집 성공률을 높여야 합니다.',
);
assert.ok(
  engine.actionChance(modernEarlyEffectState, 'shiroko', 'hunt', 0.5) > engine.actionChance(base, 'shiroko', 'hunt', 0.5),
  '전기 근대 군사 발전은 실제 사냥 성공률을 높여야 합니다.',
);
assert.ok(
  engine.actionChance(modernEarlyEffectState, 'noa', 'craft', 0.5) > engine.actionChance(base, 'noa', 'craft', 0.5),
  '전기 근대 공학 발전은 실제 제작 성공률을 높여야 합니다.',
);
assert.ok(engine.huntFailureDamage(modernEarlyEffectState) < engine.huntFailureDamage(base), '전기 근대 군사 발전은 사냥 실패 피해를 줄여야 합니다.');
assert.equal(engine.getPartyCap(modernEarlyEffectState), engine.getPartyCap(base) + 1, '전기 근대 군사 제도는 파티 정원을 늘려야 합니다.');
assert.ok(engine.logCapacity(modernEarlyEffectState) >= engine.logCapacity(base) + 50, '전기 근대 기록 발전은 로그 용량을 늘려야 합니다.');
assert.ok(engine.scoreState(modernEarlyEffectState) > engine.scoreState(base), '전기 근대 발전은 아카이브 점수에 반영되어야 합니다.');
const baseGatherResult = engine.runGatherAction(base, 'shiroko', 'whisper-woods', { rng: () => 0.3 });
const modernGatherResult = engine.runGatherAction(modernEarlyEffectState, 'shiroko', 'whisper-woods', { rng: () => 0.3 });
const gainedQuantity = (before, after) => Object.keys(after.inventory).reduce(
  (sum, itemId) => sum + Math.max(0, Number(after.inventory[itemId] || 0) - Number(before.inventory[itemId] || 0)),
  0,
);
assert.ok(
  gainedQuantity(modernEarlyEffectState, modernGatherResult) > gainedQuantity(base, baseGatherResult),
  '전기 근대 공학·생존 발전은 같은 난수에서 실제 채집 수익을 높여야 합니다.',
);
const injuredBase = engine.normalizeState({
  ...base,
  ap: 4,
  party: base.party.map((member) => member.id === 'shiroko' ? { ...member, hp: 40 } : member),
});
const injuredModern = engine.normalizeState({
  ...modernEarlyEffectState,
  ap: 4,
  party: modernEarlyEffectState.party.map((member) => member.id === 'shiroko' ? { ...member, hp: 40 } : member),
});
const baseRested = engine.runRestAction(injuredBase, 'shiroko', { rng: () => 0.5 });
const modernRested = engine.runRestAction(injuredModern, 'shiroko', { rng: () => 0.5 });
assert.ok(
  modernRested.party.find((member) => member.id === 'shiroko').hp > baseRested.party.find((member) => member.id === 'shiroko').hp,
  '전기 근대 의료·인도주의 발전은 실제 휴식 회복량을 높여야 합니다.',
);

const feedbackBase = {
  runId: 'feedback-a',
  day: 1,
  ap: 4,
  ended: false,
  victory: false,
  party: [{ hp: 100 }],
  counters: { gather: 0, hunt: 0, craft: 0, meals: 0, camp: 0 },
  exploration: { discoverySerial: 0 },
  projects: { completionSerial: 0 },
  research: { completionSerial: 0, eureka: {} },
  civics: { completionSerial: 0, inspiration: {} },
  tribe: { growthSerial: 0 },
  diplomacy: { contactSerial: 0 },
};
const gatherSuccessFeedback = feedback.primitiveActionFeedback(feedbackBase, {
  ...feedbackBase,
  ap: 3,
  counters: { ...feedbackBase.counters, gather: 1 },
}, '채집');
assert.deepEqual(
  gatherSuccessFeedback,
  { key: 'gather', action: 'primitive-gather', cue: 'gather', label: '채집 성공', outcome: 'success', tone: 'success' },
  '채집 성공은 채집 아이콘과 성공 톤을 사용해야 합니다.',
);
const gatherFailureFeedback = feedback.primitiveActionFeedback(feedbackBase, {
  ...feedbackBase,
  ap: 3,
}, '채집');
assert.equal(gatherFailureFeedback.cue, 'survivalFail', '채집 실패는 전용 생존 실패음을 사용해야 합니다.');
assert.equal(gatherFailureFeedback.tone, 'warning', '피해 없는 실패는 경고 톤을 사용해야 합니다.');
const huntDangerFeedback = feedback.primitiveActionFeedback(feedbackBase, {
  ...feedbackBase,
  ap: 3,
  party: [{ hp: 82 }],
}, '사냥');
assert.equal(huntDangerFeedback.tone, 'danger', 'HP를 잃은 사냥 실패는 위험 톤을 사용해야 합니다.');

const rolloverGatherStart = { ...base, ap: 1 };
const rolloverGatherEnd = engine.runGatherAction(rolloverGatherStart, 'shiroko', 'whisper-woods', { rng: () => 0.999 });
assert.match(
  feedback.primitiveActionResultText(rolloverGatherStart, rolloverGatherEnd, '채집'),
  /채집 실패/,
  '하루가 넘어가 일일 정산 로그가 추가되어도 이번 행동 결과에는 채집 결과를 표시해야 합니다.',
);
assert.match(
  feedback.primitiveActionResultText(
    { log: ['Day 1: 기존 로그'] },
    { log: ['Day 1: 탐험 사건: 캠프 동선이 안정됐습니다.', 'Day 1: 시로코가 모닥불 연료를 보충했습니다.', 'Day 1: 기존 로그'] },
    '캠프',
  ),
  /모닥불 연료를 보충/,
  '캠프 행동 뒤 탐험 사건이 발생해도 시설 행동 결과를 우선 표시해야 합니다.',
);

const milestonePrevious = feedback.primitiveMilestoneSnapshot(feedbackBase, 'spring');
const milestoneCurrent = feedback.primitiveMilestoneSnapshot({
  ...feedbackBase,
  exploration: { discoverySerial: 1 },
  projects: { completionSerial: 1 },
  research: { completionSerial: 1, eureka: { GATHERING: true } },
  civics: { completionSerial: 1, inspiration: { SETTLEMENT: true } },
}, 'summer');
assert.equal(
  feedback.primitiveMilestoneCue(milestonePrevious, milestoneCurrent),
  'projectComplete',
  '여러 발전이 동시에 발생해도 우선순위가 가장 높은 효과음 하나만 선택해야 합니다.',
);
assert.equal(
  feedback.primitiveActionFeedback(feedbackBase, {
    ...feedbackBase,
    ap: 3,
    counters: { ...feedbackBase.counters, gather: 1 },
    exploration: { discoverySerial: 1 },
  }, '채집').cue,
  '',
  '발견 같은 이정표가 발생한 행동은 기본 행동음을 겹쳐 재생하면 안 됩니다.',
);
assert.equal(
  feedback.primitiveMilestoneCue(milestonePrevious, { ...milestonePrevious, ended: true, victory: true }),
  'champion',
  '아카이브 완성은 종료음보다 우승 효과음을 우선해야 합니다.',
);
assert.equal(
  feedback.primitiveMilestoneCue(milestonePrevious, { ...milestoneCurrent, runId: 'feedback-b' }),
  '',
  '다른 런을 불러올 때 이전 런의 완료음을 재생하면 안 됩니다.',
);
assert.equal(
  feedback.primitiveMilestoneCue(
    feedback.primitiveMilestoneSnapshot(feedbackBase, 'spring', 'CLASSICAL'),
    feedback.primitiveMilestoneSnapshot(feedbackBase, 'spring', 'MEDIEVAL'),
  ),
  'eraAdvance',
  '중세 진입은 전용 시대 전환 효과음을 선택해야 합니다.',
);
assert.equal(
  feedback.primitiveMilestoneCue(
    feedback.primitiveMilestoneSnapshot(feedbackBase, 'spring', 'MEDIEVAL'),
    feedback.primitiveMilestoneSnapshot(feedbackBase, 'spring', 'EARLY_MODERN'),
  ),
  'eraAdvance',
  '근세 진입은 전용 시대 전환 효과음을 선택해야 합니다.',
);
assert.equal(
  feedback.primitiveMilestoneCue(
    feedback.primitiveMilestoneSnapshot(feedbackBase, 'spring', 'EARLY_MODERN'),
    feedback.primitiveMilestoneSnapshot(feedbackBase, 'spring', 'MODERN_EARLY'),
  ),
  'eraAdvance',
  '전기 근대 진입은 전용 시대 전환 효과음을 선택해야 합니다.',
);

const legacy = engine.normalizeState({
  ...base,
  research: {
    ...base.research,
    selectedTechId: 'SETTLEMENT',
    progress: { SETTLEMENT: 9 },
    completed: { SETTLEMENT: true },
    inspiration: { SETTLEMENT: true },
  },
});
assert.equal(legacy.civics.completed.SETTLEMENT, true, '기존 저장의 사회 제도 완료 상태를 이관해야 합니다.');
assert.equal(legacy.civics.progress.SETTLEMENT, 9, '기존 저장의 사회 제도 진행도를 이관해야 합니다.');
assert.equal(legacy.civics.inspiration.SETTLEMENT, true, '기존 저장의 영감 상태를 이관해야 합니다.');

console.log(JSON.stringify({
  technologies: engine.TECHNOLOGY_TREE.length,
  civics: engine.CIVIC_TREE.length,
  technologyRange: technologyMap.rangeLabel,
  civicRange: civicMap.rangeLabel,
  classicalTechnologies: classicalTechnologies.length,
  classicalCivics: classicalCivics.length,
  medievalTechnologies: medievalTechnologies.length,
  medievalCivics: medievalCivics.length,
  earlyModernTechnologies: earlyModernTechnologies.length,
  earlyModernCivics: earlyModernCivics.length,
  modernEarlyTechnologies: modernEarlyTechnologies.length,
  modernEarlyCivics: modernEarlyCivics.length,
  technologyEdges: technologyMap.edges.length,
  civicEdges: civicMap.edges.length,
  quoteSources: new Set(allAdvancements.map((advancement) => advancement.quote.sourceUrl)).size,
  quoteThemes: new Set(allAdvancements.map((advancement) => advancement.quote.key)).size,
  explicitQuotes: allAdvancements.filter((advancement) => advancement.quote.explicit).length,
  crossTrackGates: crossTrackGateCount,
  totalPrerequisites: totalPrerequisiteCount,
  earlyTechnologyDensity: technologyMap.tierHeaders.slice(0, 4).map((tier) => tier.count),
  civicGain,
  inspirationApplied: inspired.civics.inspiration.SETTLEMENT,
  civicMapWidth: civicMap.width,
  gatherFailureCue: gatherFailureFeedback.cue,
  legacyMigrated: legacy.civics.completed.SETTLEMENT,
}, null, 2));
