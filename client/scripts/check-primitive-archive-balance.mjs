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
assert.equal(engine.developerToolsSummary(preview).rows.length, 10, '개발자 도구는 기본 행동 2종과 생업 8종을 모두 보정해야 합니다.');
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
  /생업 벌목/,
  '기술 상세에는 해금되는 생업이 표시되어야 합니다.',
);
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
  tribeJobs: engine.tribeSummary(researched).jobs.map((job) => ({ id: job.id, unlocked: job.unlocked })),
  simulations,
}, null, 2));
