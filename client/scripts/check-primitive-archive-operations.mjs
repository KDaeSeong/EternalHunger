import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const clone = value => JSON.parse(JSON.stringify(value));
const fresh = () => engine.createNewState({ runId: 'operations-focused', difficulty: 'normal',
  now: '2026-11-01T00:00:00.000Z', rng: () => 0.5 });
const jobs = counts => Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, counts[job.id] || 0]));
function settled(counts = { forager: 3, hunter: 1 }) {
  const state = fresh();
  state.research.completed = { ...state.research.completed, GATHERING: true, SETTLEMENT: true, FOOD_STORAGE: true };
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 1, workbenchLevel: 1, fuel: 20 };
  state.weather = { id: 'clear', name: '검사 맑음', cold: 0, temp: 20, actionMod: 0 };
  state.inventory = { berry: 30, wood: 20, fiber: 10, stone: 10 };
  state.tribe.assignments = jobs(counts);
  state.tribe.autoAssignments = jobs({});
  return state;
}
const summary = state => engine.settlementOperationsSummary(state);
const row = (result, id) => result.rows.find(entry => entry.id === id);
const investment = (result, id) => result.investments.find(entry => entry.id === id);
let groups = 0;
function check(name, run) { run(); groups++; console.log(`PASS ${name}`); }

check('contract separates present stock, evening plan, fixed morning forecast and actual receipts', () => {
  const result = summary(settled());
  assert.equal(result.enabled, true);
  assert.equal(result.ended, false);
  assert.equal(result.day, 1);
  assert.equal(result.tone, 'ready');
  assert.deepEqual(result.rows.map(entry => entry.id), ['stock', 'evening', 'morning', 'receipt']);
  assert.deepEqual(result.investments.map(entry => entry.id), ['builder', 'scholar']);
  for (const entry of result.rows) assert.ok(entry.title && entry.text);
  assert.match(result.timingText, /오늘 저녁 관리.*밤 생존.*다음 아침 직업 생산/);
  assert.match(row(result, 'morning').text, /자동 재배치·인구 성장·생애 전환·사업 자재와 완성 보상은 포함하지 않습니다/);
  assert.match(row(result, 'morning').text, /파티의 다음 저녁 식사까지 마친 잔여량은 아닙니다/);
  assert.match(row(result, 'receipt').text, /아직 실제 아침 정산 영수증이 없습니다/);
});

check('unsettled, ended and pre-lineage saves remain readable without inventing operations', () => {
  const initial = summary(fresh());
  assert.equal(initial.enabled, false);
  assert.ok(initial.issues.some(issue => issue.id === 'settlement' && issue.tabId === 'tribe'));
  assert.ok(initial.investments.every(entry => !entry.available && entry.reason));
  const legacy = settled();
  delete legacy.lineage;
  delete legacy.founderHistory;
  delete legacy.ancestralFaith;
  assert.match(row(summary(legacy), 'stock').text, /생존 은퇴자 0명/);
  legacy.ended = true;
  const ended = summary(legacy);
  assert.equal(ended.ended, true);
  assert.equal(ended.tone, 'warning');
  assert.match(row(ended, 'evening').text, /종료로 실행되지 않습니다/);
  assert.match(row(ended, 'morning').text, /종료로 실행되지 않습니다/);
  assert.ok(ended.investments.every(entry => !entry.available));
  const storageLocked = settled();
  storageLocked.research.completed.FOOD_STORAGE = false;
  assert.ok(summary(storageLocked).issues.some(issue => issue.id === 'food-storage'));
});

check('investment comparisons use actual unassigned workers, food jobs and day-dependent rounding', () => {
  const state = settled();
  const evenMorning = summary(state);
  assert.match(investment(evenMorning, 'builder').text, /채집대 1명.*생산 3 → 2단위/);
  assert.match(investment(evenMorning, 'scholar').text, /생산 3 → 2단위/);
  assert.ok(evenMorning.investments.every(entry => entry.available));
  state.day = 2;
  assert.match(investment(summary(state), 'builder').text, /생산 2 → 1단위/);
  const rounded = settled({ forager: 4 });
  assert.match(investment(summary(rounded), 'builder').text, /생산 2 → 2단위/);
  rounded.tribe.population = 5;
  assert.match(investment(summary(rounded), 'builder').text, /실제 미배치 일손 1명.*생산 2 → 2단위/);
});

check('investment availability checks project targets, present materials, research gates and real workers', () => {
  const noMaterials = settled();
  noMaterials.inventory = { berry: 30 };
  assert.match(investment(summary(noMaterials), 'builder').reason, /착수 자재가 부족/);
  noMaterials.projects.resourceCommitted['drying-rack'] = true;
  assert.equal(investment(summary(noMaterials), 'builder').available, true);
  const locked = settled();
  locked.camp.workbenchLevel = 0;
  assert.match(investment(summary(locked), 'scholar').reason, /연구 체계를 먼저/);
  locked.projects.selectedProjectId = 'palisade';
  assert.match(investment(summary(locked), 'builder').reason, /선행 연구가 필요/);
  locked.projects.selectedProjectId = '';
  assert.match(investment(summary(locked), 'builder').reason, /프로젝트가 없습니다/);
  const noWorkers = settled({ builder: 4 });
  assert.match(investment(summary(noWorkers), 'builder').reason, /이동할 미배치 일손/);
});

check('whole cooked-food rations consume the full item without leaving fractional stock', () => {
  const state = settled({ builder: 4 });
  state.inventory = { cooked_meat: 1 };
  const result = summary(state);
  assert.match(row(result, 'stock').text, /현재 식량 2단위/);
  assert.match(row(result, 'morning').text, /필요 1 \/ 제공 2 \/ 부족 0단위 · 배식 후 공동 비축 0단위/);
  assert.deepEqual(state.inventory, { cooked_meat: 1 });
});

check('evening costs precede production and use current real food, wood and fuel', () => {
  const state = settled({ forager: 4 });
  state.inventory = { berry: 12, wood: 1 };
  state.party[0].hunger = 80;
  state.camp.fuel = 0;
  state.weather.cold = 7;
  const result = summary(state);
  assert.match(row(result, 'evening').text, /대원 1명 배식.*베리.*6/);
  assert.match(row(result, 'evening').text, /나무 1개 소비 → 연료 \+2/);
  assert.match(row(result, 'evening').text, /관리 뒤 식량 6단위 · 나무 0개 · 연료 2 → 야영 소비 1 후 1/);
  assert.match(row(result, 'morning').text, /저녁 관리 뒤 식량 6 \+ 직업 생산 2단위/);
  state.inventory = {};
  const empty = summary(state);
  assert.ok(empty.issues.some(issue => issue.id === 'party-food' && issue.tabId === 'actions'));
  assert.ok(empty.issues.some(issue => issue.id === 'fuel' && issue.tabId === 'camp'));
  assert.match(row(empty, 'evening').text, /대원 0명 배식/);
});

check('prepared successors and living retirees remain part of communal demand', () => {
  let state = settled();
  const founderId = state.party[0].id;
  state = engine.prepareSuccessorAction(state, founderId, { rng: () => 0.5 });
  assert.match(row(summary(state), 'stock').text, /일손 3명 · 준비 후계·생존 은퇴자 1명 · 공동 배식 필요 1단위/);
  state = engine.retireFounderAction(state, founderId);
  state.tribe.population += 1;
  assert.match(row(summary(state), 'stock').text, /일손 4명 · 준비 후계·생존 은퇴자 1명 · 공동 배식 필요 2단위/);
});

check('new actual receipts record their day and capped scholar contribution; old receipts do not invent either', () => {
  const state = settled({ forager: 2, scholar: 2 });
  const tech = engine.TECHNOLOGY_TREE.find(entry => entry.id === 'CORDAGE');
  for (const id of tech.prereqs || []) state.research.completed[id] = true;
  state.research.selectedTechId = tech.id;
  state.research.progress[tech.id] = tech.cost - 1;
  const next = engine.advanceDay(state, { rng: () => 0.5 });
  assert.equal(next.tribe.lastProduction.day, 2);
  assert.equal(next.tribe.lastProduction.researchRequested, 2);
  assert.equal(next.tribe.lastProduction.researchPoints, 1);
  assert.match(row(summary(next), 'receipt').text, /2일차.*기록대 실제 적용 \+1RP/);
  const old = clone(next);
  delete old.tribe.lastProduction.day;
  delete old.tribe.lastProduction.researchRequested;
  assert.match(row(summary(old), 'receipt').text, /정산 일차 미기록/);
  assert.match(row(summary(old), 'receipt').text, /실제 적용 RP 미기록/);
});

check('manual job changes are reflected immediately rather than cached from an older view', () => {
  let state = settled();
  assert.match(row(summary(state), 'morning').text, /직업 생산 3단위/);
  state = engine.adjustTribeJobAction(state, 'forager', -1);
  state = engine.adjustTribeJobAction(state, 'builder', 1);
  assert.match(row(summary(state), 'morning').text, /직업 생산 2단위/);
});

check('summary reads are deterministic without changing frozen state, logs or randomness', () => {
  const state = settled();
  state.party[0].hunger = 80;
  const before = clone(state);
  const freeze = value => { if (value && typeof value === 'object') {
    Object.freeze(value); for (const child of Object.values(value)) freeze(child);
  } };
  freeze(state);
  const random = Math.random;
  Math.random = () => { throw new Error('Operations summary used randomness'); };
  try { assert.deepEqual(summary(state), summary(state)); }
  finally { Math.random = random; }
  assert.deepEqual(state, before);
});

console.log(`Settlement operations: ${groups} focused groups passed.`);
