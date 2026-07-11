import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../src/app/games/primitive-archive/_lib/', import.meta.url);
const dataSource = await readFile(new URL('primitiveArchiveData.js', rootUrl), 'utf8');
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
const campLogState = engine.runCampAction(base, 'shiroko', 'fuel', { rng: () => 0.5 });
assert.match(campLogState.log.join('\n'), /시로코가 모닥불 연료를 보충했습니다/, '캠프 행동 로그는 올바른 주격 조사를 사용해야 합니다.');
const overlap = engine.TECHNOLOGY_TREE.filter((technology) => (
  engine.CIVIC_TREE.some((civic) => civic.id === technology.id)
));
assert.equal(overlap.length, 0, '기술과 사회 제도 목록이 겹치면 안 됩니다.');
assert.ok(engine.TECHNOLOGY_TREE.length > engine.CIVIC_TREE.length, '기술과 사회 제도 목록이 비어 있으면 안 됩니다.');
assert.ok(engine.CIVIC_TREE.every((civic) => civic.inspiration), '모든 사회 제도에는 영감 조건이 있어야 합니다.');
assert.ok(engine.TECHNOLOGY_TREE.every((technology) => !technology.inspiration), '기술 트리에는 영감 조건이 남으면 안 됩니다.');
assert.ok(engine.CIVIC_TREE.every((civic) => !civic.eureka), '사회 제도 트리에는 유레카 조건이 남으면 안 됩니다.');

const technologyIds = new Set(engine.TECHNOLOGY_TREE.map((technology) => technology.id));
const civicIds = new Set(engine.CIVIC_TREE.map((civic) => civic.id));
const advancementById = Object.fromEntries(engine.TECH_TREE.map((advancement) => [advancement.id, advancement]));
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
  Array.from({ length: 16 }, (_, index) => index + 1),
  '기술 단계는 T1부터 T16까지 연속이어야 합니다.',
);
assert.deepEqual(
  engine.CIVIC_TIER_DEFS.map((definition) => definition.tier),
  Array.from({ length: 14 }, (_, index) => index + 1),
  '사회 제도 단계는 C1부터 C14까지 연속이어야 합니다.',
);

const medievalTechnologies = engine.TECHNOLOGY_TREE.filter((technology) => technology.era === 'MEDIEVAL');
const medievalCivics = engine.CIVIC_TREE.filter((civic) => civic.era === 'MEDIEVAL');
const expansionBranches = ['ENGINEERING', 'FAITH', 'LITERATURE', 'MILITARY', 'NATURAL_PHILOSOPHY', 'SURVIVAL'];
assert.equal(medievalTechnologies.length, 24, '중세 확장에는 기술 24개가 있어야 합니다.');
assert.equal(medievalCivics.length, 18, '중세 확장에는 사회 제도 18개가 있어야 합니다.');
assert.ok(medievalTechnologies.every((technology) => technology.eureka), '모든 중세 기술에는 유레카가 있어야 합니다.');
assert.ok(medievalCivics.every((civic) => civic.inspiration), '모든 중세 사회 제도에는 영감이 있어야 합니다.');
assert.deepEqual(
  [...new Set([...medievalTechnologies, ...medievalCivics].map((advancement) => advancement.branch))].sort(),
  expansionBranches,
  '중세 확장은 신앙·이학·문학·군사·생존·기술 여섯 계통을 모두 포함해야 합니다.',
);

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
assert.equal(technologyMap.maxTier, 16, '기술 트리는 T16에서 끝나야 합니다.');
assert.equal(technologyMap.rangeLabel, 'T1-T16', '기술 트리는 T 접두사를 사용해야 합니다.');
assert.equal(technologyMap.tierCount, 16, '기술 트리는 열여섯 단계가 모두 표시되어야 합니다.');
assert.deepEqual(
  technologyMap.tierHeaders.slice(0, 4).map((tier) => tier.count),
  [2, 4, 4, 3],
  '초반 기술 단계는 생존 기초에서 전문 생존으로 자연스럽게 분산되어야 합니다.',
);
assert.equal(civicMap.minTier, 1, '사회 제도 트리는 C1부터 시작해야 합니다.');
assert.equal(civicMap.maxTier, 14, '사회 제도 트리는 C14에서 끝나야 합니다.');
assert.equal(civicMap.rangeLabel, 'C1-C14', '사회 제도 트리는 C 접두사를 사용해야 합니다.');
assert.equal(civicMap.tierCount, 14, '사회 제도 트리는 열네 단계가 모두 표시되어야 합니다.');
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
  { action: 'gather', cue: 'gather', outcome: 'success', tone: 'success' },
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
  medievalTechnologies: medievalTechnologies.length,
  medievalCivics: medievalCivics.length,
  technologyEdges: technologyMap.edges.length,
  civicEdges: civicMap.edges.length,
  crossTrackGates: crossTrackGateCount,
  totalPrerequisites: totalPrerequisiteCount,
  earlyTechnologyDensity: technologyMap.tierHeaders.slice(0, 4).map((tier) => tier.count),
  civicGain,
  inspirationApplied: inspired.civics.inspiration.SETTLEMENT,
  civicMapWidth: civicMap.width,
  gatherFailureCue: gatherFailureFeedback.cue,
  legacyMigrated: legacy.civics.completed.SETTLEMENT,
}, null, 2));
