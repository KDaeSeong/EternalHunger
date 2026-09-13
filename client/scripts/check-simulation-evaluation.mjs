import assert from 'node:assert/strict';
import {
  buildSimulationEvaluationExport,
  completeSimulationEvaluation,
  listSimulationEvaluations,
  normalizeSimulationEvaluation,
  serializeSimulationEvaluationExport,
  startSimulationEvaluation,
  updateSimulationEvaluation,
  SIMULATION_EVALUATION_EXPORT_SCHEMA,
  SIMULATION_EVALUATION_SCHEMA,
} from '../src/app/simulation/_lib/simulationEvaluationRuntime.js';

const data = new Map();
const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
const started = startSimulationEvaluation({ runId: 'run-42', now: 1700000000000, storage });
assert.equal(started.ok, true, '평가 시작은 로컬 저장되어야 합니다.');
assert.equal(started.record.status, 'in_progress');
const partial = updateSimulationEvaluation(started.record.id, { fields: { understanding: 4, farmingUnderstand: 3, confusion: '파밍 목적을 한 번 놓쳤다.' } }, storage);
assert.equal(partial.ok, true, '부분 응답을 저장해야 합니다.');
assert.equal(listSimulationEvaluations(storage)[0].fields.understanding, 4);
const done = completeSimulationEvaluation(started.record.id, { ...partial.record.fields, fun: 5, replayDesire: 4, readability: 3, wouldReplay10m: true }, storage);
assert.equal(done.record.status, 'complete');
assert.equal(done.record.runId, 'run-42');
const blank = startSimulationEvaluation({ runId: 'run-blank', now: 1700000000003, storage });
assert.equal(completeSimulationEvaluation(blank.record.id, { fun: 6, confusion: '   ' }, storage).ok, false,
  '유효 범위를 벗어난 값이나 공백만으로 완료할 수 없어야 합니다.');
assert.equal(updateSimulationEvaluation(blank.record.id, { status: 'complete' }, storage).ok, false,
  '일반 변경 API로 완료 검증을 우회할 수 없어야 합니다.');
assert.equal(listSimulationEvaluations(storage).find((row) => row.id === blank.record.id)?.status, 'in_progress');
assert.equal(completeSimulationEvaluation(started.record.id, {}, storage).ok, false, '빈 응답은 완료할 수 없어야 합니다.');
assert.equal(updateSimulationEvaluation(started.record.id, { fields: { fun: 1 } }, storage).ok, false, '완료 기록은 변경할 수 없어야 합니다.');
const sameRun = startSimulationEvaluation({ runId: 'run-42', now: 1700000000001, storage });
assert.equal(sameRun.ok, true, '같은 run의 재평가 초안 자체는 시작할 수 있어야 합니다.');
assert.equal(sameRun.reused, true, '같은 run은 중복 평가 기록을 만들지 않아야 합니다.');
const failingStorage = { getItem: () => null, setItem: () => { throw new Error('storage denied'); } };
assert.equal(startSimulationEvaluation({ runId: 'write-fails', storage: failingStorage }).ok, false, 'localStorage 쓰기 실패를 성공으로 표시하면 안 됩니다.');
const collisionData = new Map();
const collisionStorage = { getItem: (key) => collisionData.get(key) ?? null, setItem: (key, value) => collisionData.set(key, value) };
const firstCollision = startSimulationEvaluation({ now: 1700000000002, storage: collisionStorage, idFactory: () => 'fixed-id' });
const secondCollision = startSimulationEvaluation({ now: 1700000000002, storage: collisionStorage, idFactory: () => 'fixed-id' });
assert.notEqual(firstCollision.record.id, secondCollision.record.id, 'ID 충돌 시 기존 평가를 덮어쓰면 안 됩니다.');
data.set('eh_simulation_evaluations_v1', JSON.stringify({ schema: 'eternal-hunger.evaluation.v2', evaluations: [started.record] }));
assert.deepEqual(listSimulationEvaluations(storage), [], '미래 envelope는 격리해야 합니다.');
assert.equal(normalizeSimulationEvaluation({ ...done.record, schema: 'future' }), null, '미래 스키마는 격리해야 합니다.');
const exported = buildSimulationEvaluationExport({
  evaluation: done.record,
  replayRecord: { id: 'run-42', finishedAt: 1700000000200, runSeed: 'seed-42', summary: { winnerName: '매화' } },
  evaluationCode: 'EH-G5.3-test',
  now: 1700000000300,
});
assert.equal(exported.schema, SIMULATION_EVALUATION_EXPORT_SCHEMA);
assert.equal(exported.evaluationCode, 'EH-G5.3-test');
assert.equal(exported.replay.runSeed, 'seed-42');
assert.equal(JSON.parse(serializeSimulationEvaluationExport({ evaluation: done.record, now: 1700000000301 })).evaluation.id, done.record.id,
  '평가 결과는 다른 사람에게 전달할 수 있는 JSON이어야 합니다.');
assert.throws(() => buildSimulationEvaluationExport({ evaluation: { schema: 'broken' } }), /올바르지/,
  '손상된 평가를 내보내면 안 됩니다.');
data.set('eh_simulation_evaluations_v1', '{broken');
assert.deepEqual(listSimulationEvaluations(storage), [], '손상된 저장 데이터는 빈 목록으로 격리해야 합니다.');
console.log(`SIMULATION_EVALUATION_CHECK_OK schema=${SIMULATION_EVALUATION_SCHEMA} start=1 partial=1 complete=1 export=1 corrupt=1`);
