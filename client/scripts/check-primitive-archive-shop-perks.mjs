import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const perks = await import('../src/utils/gameplayPerks.js');
const { CAREFUL_GATHER, RESEARCH_NOTES } = perks.GAMEPLAY_PERK_CODES;
const now = '2026-10-27T00:00:00.000Z';
let checks = 0;

function run(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

function stateWith(codes = [CAREFUL_GATHER, RESEARCH_NOTES], overrides = {}) {
  const base = engine.createNewState({ runId: `shop-perks-${checks}`, now, rng: () => 0.5, shopPerkCodes: codes });
  return engine.normalizeState({
    ...base,
    ap: 20,
    ...overrides,
  });
}

function gatherRng() {
  const values = [0, 0, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99];
  let calls = 0;
  return { rng: () => values[calls++] ?? 0.99, calls: () => calls };
}

run('new run snapshot filters known archive codes, removes duplicates and starts usage counters at zero', () => {
  const state = engine.createNewState({
    runId: 'shop-perks-snapshot', now, rng: () => 0.5,
    shopPerkCodes: [CAREFUL_GATHER, CAREFUL_GATHER, 'PLAY_EH_START_SPONSOR', RESEARCH_NOTES, 'unknown'],
  });
  assert.deepEqual(state.shopPerks, { version: 1, codes: [CAREFUL_GATHER, RESEARCH_NOTES], uses: { carefulGather: 0, researchNotes: 0 } });
});

run('successful ordinary gathering grants one deterministic first-order basic resource without extra RNG or cost changes', () => {
  const state = stateWith([CAREFUL_GATHER]);
  const control = engine.normalizeState({ ...state, shopPerks: { version: 1, codes: [], uses: { carefulGather: 0, researchNotes: 0 } } });
  const perkRng = gatherRng();
  const controlRng = gatherRng();
  const next = engine.runGatherAction(state, 'shiroko', 'whisper-woods', { rng: perkRng.rng });
  const baseline = engine.runGatherAction(control, 'shiroko', 'whisper-woods', { rng: controlRng.rng });
  assert.ok(next.log.some((line) => line.includes('채집 성공')));
  assert.equal(next.inventory.wood, baseline.inventory.wood + 1, 'The first eligible forest resource is wood.');
  assert.equal(next.inventory.fiber, baseline.inventory.fiber);
  assert.equal(next.inventory.berry, baseline.inventory.berry);
  assert.equal(perkRng.calls(), controlRng.calls(), 'The perk adds no random draw.');
  assert.equal(next.ap, baseline.ap);
  assert.equal(next.party.find((member) => member.id === 'shiroko').stamina, baseline.party.find((member) => member.id === 'shiroko').stamina);
  assert.equal(next.shopPerks.uses.carefulGather, 1);
});

run('failed and safe gathering do not spend careful-gather uses', () => {
  const state = stateWith([CAREFUL_GATHER]);
  const failed = engine.runGatherAction(state, 'shiroko', 'whisper-woods', { rng: () => 0.999 });
  assert.ok(failed.log.some((line) => line.includes('채집 실패')));
  assert.equal(failed.shopPerks.uses.carefulGather, 0);
  const safe = engine.runSafeGatherAction(state, 'shiroko', 'berry', { rng: () => 0.5 });
  assert.equal(safe.shopPerks.uses.carefulGather, 0);
});

run('gathering usage is capped at three and JSON restoration preserves the equipped snapshot and count', () => {
  let state = stateWith([CAREFUL_GATHER]);
  for (let index = 0; index < 4; index += 1) {
    state = engine.runGatherAction(state, 'shiroko', 'whisper-woods', { rng: gatherRng().rng });
  }
  assert.equal(state.shopPerks.uses.carefulGather, 3);
  const restored = engine.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.shopPerks, state.shopPerks);
  const noPerk = engine.startNewRunFromMeta(restored, { runId: 'shop-perks-no-new-snapshot', now, rng: () => 0.5 });
  assert.deepEqual(noPerk.shopPerks, { version: 1, codes: [], uses: { carefulGather: 0, researchNotes: 0 } });
  const equipped = engine.startNewRunFromMeta(restored, { runId: 'shop-perks-new-snapshot', now, rng: () => 0.5, shopPerkCodes: [CAREFUL_GATHER] });
  assert.deepEqual(equipped.shopPerks, { version: 1, codes: [CAREFUL_GATHER], uses: { carefulGather: 0, researchNotes: 0 } });
});

run('malformed persisted usage counts fail closed at the cap', () => {
  const state = stateWith([CAREFUL_GATHER, RESEARCH_NOTES], {
    shopPerks: { version: 1, codes: [CAREFUL_GATHER, RESEARCH_NOTES], uses: { carefulGather: 99, researchNotes: -1 } },
  });
  assert.deepEqual(state.shopPerks.uses, { carefulGather: 3, researchNotes: 10 });
});

function researchFixture({ uses = 0, progress = 0, codes = [RESEARCH_NOTES], camp = {} } = {}) {
  const base = stateWith(codes, {
    camp: { fireLevel: 1, shelterLevel: 1, workbenchLevel: 1, ...camp },
    party: engine.createNewState({ rng: () => 0.5 }).party.map((member) => ({ ...member, stats: { ...member.stats, craft: 0 } })),
    research: {
      ...engine.createNewState({ rng: () => 0.5 }).research,
      completed: { GATHERING: true, HUNTING: true },
      selectedTechId: 'FIREMAKING',
      progress: { FIREMAKING: progress },
    },
    shopPerks: { version: 1, codes, uses: { carefulGather: 0, researchNotes: uses } },
  });
  return base;
}

run('direct research adds one RP and charges one use while passive daily research stays unchanged', () => {
  const state = researchFixture();
  const control = researchFixture({ codes: [] });
  const baseline = engine.runResearchAction(control, 'shiroko', { rng: () => 0.999 });
  const next = engine.runResearchAction(state, 'shiroko', { rng: () => 0.999 });
  assert.equal(next.research.progress.FIREMAKING, baseline.research.progress.FIREMAKING + 1);
  assert.equal(next.shopPerks.uses.researchNotes, 1);
  assert.ok(next.log.some((line) => line.includes('연구 기록법') && line.includes('+1RP')));
  const normalized = engine.normalizeState(JSON.parse(JSON.stringify(next)));
  assert.equal(normalized.shopPerks.uses.researchNotes, 1);
  const passiveWithPerk = engine.advanceDay(state, { rng: () => 0.999 });
  const passiveWithoutPerk = engine.advanceDay(control, { rng: () => 0.999 });
  assert.equal(passiveWithPerk.research.progress.FIREMAKING, passiveWithoutPerk.research.progress.FIREMAKING);
  assert.equal(passiveWithPerk.shopPerks.uses.researchNotes, 0);
});

run('research notes stop after ten useful actions and do not charge when base research already completes the technology', () => {
  let state = researchFixture({ uses: 9 });
  state = engine.runResearchAction(state, 'shiroko', { rng: () => 0.999 });
  assert.equal(state.shopPerks.uses.researchNotes, 10);
  state = engine.runResearchAction(state, 'shiroko', { rng: () => 0.999 });
  assert.equal(state.shopPerks.uses.researchNotes, 10, 'The capped counter cannot grant an eleventh bonus.');

  const nearlyDone = researchFixture({ progress: 8 });
  const actionPoints = engine.researchActionEstimate(nearlyDone, 'shiroko').points;
  const capped = engine.runResearchAction(nearlyDone, 'shiroko', { rng: () => 0.999 });
  assert.ok(actionPoints >= 2);
  assert.equal(capped.shopPerks.uses.researchNotes, 0);
  assert.equal(capped.research.completed.FIREMAKING, true);
});

run('locked, ended, AP-starved and completed research preserve notes uses and never add RP', () => {
  const state = researchFixture();
  const locked = engine.normalizeState({ ...state, camp: { ...state.camp, fireLevel: 0 } });
  assert.equal(engine.runResearchAction(locked, 'shiroko', { rng: () => 0.5 }).shopPerks.uses.researchNotes, 0);
  assert.equal(engine.runResearchAction({ ...state, ended: true }, 'shiroko').shopPerks.uses.researchNotes, 0);
  assert.equal(engine.runResearchAction({ ...state, ap: 0 }, 'shiroko').shopPerks.uses.researchNotes, 0);
  const allCompleted = Object.fromEntries(engine.TECH_TREE.map((tech) => [tech.id, true]));
  const completed = engine.normalizeState({ ...state, research: { ...state.research, completed: allCompleted, selectedTechId: 'FIREMAKING' } });
  assert.equal(engine.runResearchAction(completed, 'shiroko').shopPerks.uses.researchNotes, 0);
});

console.log(`\n${checks} archive shop-perk checks passed.`);
