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

const ready = engine.normalizeState({
  ...base,
  ap: 4,
  camp: { ...base.camp, fireLevel: 1, shelterLevel: 1, workbenchLevel: 1 },
  research: {
    ...base.research,
    selectedTechId: 'FIREMAKING',
    completed: { GATHERING: true, HUNTING: true, SHELTER: true, HERBALISM: true },
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
assert.equal(civicMap.minTier, 4, '사회 제도 트리의 첫 티어는 실제 데이터와 일치해야 합니다.');
assert.equal(civicMap.maxTier, 12, '사회 제도 트리의 마지막 티어는 실제 데이터와 일치해야 합니다.');
assert.ok(
  civicMap.nodes.every((node) => node.x >= 0 && node.x + node.width <= civicMap.width),
  '사회 제도 노드는 트리 캔버스 안에 배치되어야 합니다.',
);
assert.equal(runtime.advancementAction(['MILITARY'], 'technology'), 'combat', '군사 기술은 전투 계통 아이콘을 사용해야 합니다.');
assert.equal(runtime.advancementAction(['CULTURE'], 'civics'), 'archive', '문화 제도는 기록 계통 아이콘을 사용해야 합니다.');
assert.equal(runtime.advancementAction([], 'civics'), 'policy', '태그가 없는 사회 제도는 제도 아이콘으로 대체해야 합니다.');

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
  civicGain,
  inspirationApplied: inspired.civics.inspiration.SETTLEMENT,
  civicMapWidth: civicMap.width,
  gatherFailureCue: gatherFailureFeedback.cue,
  legacyMigrated: legacy.civics.completed.SETTLEMENT,
}, null, 2));
