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

const base = engine.createNewState({ rng: () => 0.5 });
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
  legacyMigrated: legacy.civics.completed.SETTLEMENT,
}, null, 2));
