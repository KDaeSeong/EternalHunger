import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const faith = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveAncestralFaith.js');
const { recordFounderDeed } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveFounders.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const clone = value => structuredClone(value);
const kinds = { gather: 'gather', hunt: 'hunt', craft: 'project', study: 'research_contribution', care: 'recovery' };
let checks = 0;
const failures = [];
function check(name, body) {
  try { body(); checks += 1; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${String(error.message).slice(0, 700)}`); }
}
function fixture(domain = 'gather', count = 3) {
  let state = engine.createNewState({ runId: 'ancestral-faith-fixture', now: '2026-10-30T00:00:00.000Z', rng: () => 0.5 });
  state.inventory = { ...state.inventory, berry: 20, fiber: 20, herb: 10 };
  state.camp = { ...state.camp, fireLevel: 1, fuel: 8, shelterLevel: 1, workbenchLevel: 1 };
  state.research.completed = { ...state.research.completed, GATHERING: true, HUNTING: true, SETTLEMENT: true, FOOD_STORAGE: true, CORDAGE: true };
  for (let index = 0; index < count; index += 1) state = recordFounderDeed(state, {
    actorId: state.party[0].id, kind: kinds[domain], success: true, target: 'bounded-fixture',
  });
  return engine.normalizeState(state);
}
function invoke(state) { return engine.ancestralRiteAction(state, state.party[1].id, state.founderHistory.members[0].actorId); }
function remaining(state) { return state.ancestralFaith.active?.remaining || 0; }
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

check('new-run faith is explicitly enabled while missing and observed legacy faith remain inert', () => {
  const source = fixture();
  assert.equal(source.ancestralFaith.origin, 'new_run');
  const legacy = clone(source);
  delete legacy.ancestralFaith;
  const before = JSON.stringify(legacy);
  const restored = engine.normalizeState(legacy);
  assert.equal(restored.ancestralFaith.origin, 'legacy_disabled');
  assert.equal(faith.runAncestralRite(restored, { actorId: restored.party[0].id, founderId: restored.party[0].id }).ok, false);
  assert.equal(JSON.stringify(legacy), before);
  delete legacy.founderHistory;
  const observed = engine.normalizeState(legacy);
  assert.equal(observed.founderHistory.foundersKnown, false);
  assert.equal(faith.createAncestralFaith(observed).origin, 'legacy_disabled');
});

check('a rite spends exactly one real berry and grants no AP turn, passive points, RNG or other stock', () => {
  const source = freeze(fixture());
  const before = JSON.stringify(source);
  const originalRandom = Math.random;
  let next;
  try {
    Math.random = () => { throw new Error('Rite must not draw gameplay RNG'); };
    next = invoke(source);
  } finally { Math.random = originalRandom; }
  const { ancestralFaith: beforeFaith, inventory: beforeInventory, log: beforeLog, ...beforeWorld } = source;
  const { ancestralFaith: afterFaith, inventory: afterInventory, log: afterLog, ...afterWorld } = next;
  assert.ok(beforeFaith && beforeInventory && beforeLog && afterLog);
  // The engine's normal log timestamp may change; no gameplay state may change.
  assert.ok(Number.isFinite(Date.parse(afterWorld.updatedAt)));
  assert.deepEqual(afterWorld, { ...beforeWorld, updatedAt: afterWorld.updatedAt });
  assert.deepEqual(afterInventory, { ...beforeInventory, berry: beforeInventory.berry - 1 });
  assert.equal(afterFaith.active.remaining, 2);
  assert.equal(afterFaith.lastRiteDay, source.day);
  assert.equal(JSON.stringify(source), before);
});

check('locked, invalid and duplicate rites preserve inventory, cooldown and the existing favor', () => {
  const source = fixture();
  for (const mutate of [state => { state.ended = true; }, state => { state.ap = 0; },
    state => { state.inventory.berry = 0; }, state => { state.camp.fuel = 0; },
    state => { state.camp.fireLevel = 0; }, state => { state.research.completed.SETTLEMENT = false; },
    state => { state.research.completed.FOOD_STORAGE = false; }]) {
    const locked = clone(source); mutate(locked);
    const result = faith.runAncestralRite(locked, { actorId: locked.party[1].id, founderId: locked.party[0].id });
    assert.equal(result.ok, false);
    assert.equal(result.state, locked);
  }
  for (const [actorId, founderId] of [['unknown', source.party[0].id], [source.party[1].id, 'unknown']]) {
    assert.equal(faith.runAncestralRite(source, { actorId, founderId }).ok, false);
  }
  assert.equal(faith.runAncestralRite(fixture('gather', 2), { actorId: source.party[1].id, founderId: source.party[0].id }).reason, 'contributions');
  const invoked = invoke(source);
  const duplicate = faith.runAncestralRite(invoked, { actorId: invoked.party[1].id, founderId: invoked.party[0].id });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.state, invoked);
});

check('actual recorded work determines all five domains; role, global counters and later recruits cannot impersonate a founder', () => {
  for (const domain of Object.keys(kinds)) {
    const source = fixture(domain);
    const rows = faith.ancestralFaithRows(source);
    assert.equal(rows[0].domain, domain);
    assert.equal(rows[0].contributionCount, 3);
    assert.equal(rows[0].ready, true);
    assert.ok(rows[0].effectText);
    assert.equal(invoke(source).ancestralFaith.active.domain, domain);
  }
  const noWork = fixture('gather', 0);
  noWork.counters.gather = 999;
  assert.equal(faith.ancestralFaithRows(noWork)[0].ready, false);
  noWork.founderHistory.members.push({ ...clone(noWork.founderHistory.members[0]), actorId: 'recruit', isFounder: false, tallies: { gather: 99 } });
  assert.equal(faith.runAncestralRite(noWork, { actorId: noWork.party[0].id, founderId: 'recruit' }).ok, false);
});

check('three actual paid safe-collection actions create the teaching evidence without fabricated counter history', () => {
  let source = fixture('gather', 0);
  const actorId = source.party[0].id;
  for (let index = 0; index < 3; index += 1) source = engine.runSafeGatherAction(source, actorId, 'wood', {
    rng: () => { throw new Error('Safe collection must not draw gameplay RNG'); },
  });
  assert.equal(source.founderHistory.members[0].tallies.gather, 3);
  assert.equal(faith.ancestralFaithRows(source)[0].ready, true);
  assert.equal(invoke(source).ancestralFaith.active.domain, 'gather');
});

check('living, retired and confirmed deceased founders share the same costs, power and cooldown without death rewards', () => {
  const living = fixture();
  const retired = clone(living);
  const first = retired.party.shift();
  const life = retired.lineage.members.find(member => member.actorId === first.id);
  life.stage = 'retired'; life.retiredSnapshot = { ...first, equipment: retired.equipment[first.id] };
  delete retired.equipment[first.id];
  const deceased = clone(retired);
  const deadLife = deceased.lineage.members.find(member => member.actorId === first.id);
  deadLife.stage = 'deceased'; deadLife.retiredSnapshot.hp = 0;
  const death = { day: deceased.day, source: 'natural', reason: '게임 생애주기 종료', hpBefore: 100,
    damage: 0, hungerDamage: 0, coldDamage: 0, hypothermiaDamage: 0 };
  deadLife.deathRecord = death;
  deceased.founderHistory.members[0].deathRecord = death;
  for (const [state, status] of [[living, 'living'], [retired, 'retired'], [deceased, 'deceased']]) {
    const row = faith.ancestralFaithRows(state)[0];
    assert.equal(row.status, status);
    assert.equal(row.mode, status === 'deceased' ? 'blessing' : 'teaching');
    const result = faith.runAncestralRite(state, { actorId: state.party[1].id, founderId: first.id });
    assert.equal(result.ok, true);
    assert.equal(result.state.inventory.berry, state.inventory.berry - 1);
    assert.equal(faith.ancestralActionChanceBonus(result.state, 'gather'), 0.15);
    assert.equal(result.state.ancestralFaith.active.remaining, 2);
    assert.deepEqual(result.state.meta, state.meta);
  }
  const pending = invoke(living);
  const afterDeath = { ...deceased, ancestralFaith: clone(pending.ancestralFaith) };
  assert.deepEqual(faith.normalizeAncestralFaith(afterDeath.ancestralFaith, afterDeath), pending.ancestralFaith);
  assert.equal(faith.runAncestralRite(afterDeath, { actorId: afterDeath.party[0].id, founderId: first.id }).reason, 'cooldown');
});

check('getters detach narrative, records and active favor without changing the selected founder personality', () => {
  const source = freeze(invoke(fixture()));
  const before = JSON.stringify(source);
  const rows = faith.ancestralFaithRows(source);
  const summary = faith.ancestralFaithSummary(source);
  assert.equal(rows[0].name, source.founderHistory.members[0].name);
  assert.equal(rows[0].role, source.founderHistory.members[0].role);
  assert.ok(rows[0].response && rows[0].legend);
  rows[0].tallies.gather = 99;
  rows[0].recentDeeds[0].target = 'mutated view';
  summary.active.remaining = 99;
  assert.equal(JSON.stringify(source), before);
});

check('strict save validation rejects foreign, future, invented and inconsistent faith without rewriting bytes', () => {
  const source = invoke(fixture());
  assert.equal(checkpoint.isValidRunState(source), true);
  assert.equal(faith.isValidAncestralFaith(source.ancestralFaith, source), true);
  for (const mutate of [raw => { raw.runId = 'other-run'; }, raw => { raw.lastRiteDay += 1; },
    raw => { raw.active.founderId = 'invented'; }, raw => { raw.lastRiteFounderId = 'invented'; },
    raw => { raw.active.remaining = 3; }, raw => { raw.active.remaining = 0; },
    raw => { raw.active.day += 1; }, raw => { raw.active.domain = 'unlimited-research'; },
    raw => { raw.active.bonus = 999; }, raw => { raw.origin = 'legacy_disabled'; }]) {
    const candidate = clone(source); mutate(candidate.ancestralFaith);
    const before = JSON.stringify(candidate);
    assert.equal(faith.isValidAncestralFaith(candidate.ancestralFaith, candidate), false);
    assert.equal(checkpoint.isValidRunState(candidate), false);
    assert.throws(() => faith.normalizeAncestralFaith(candidate.ancestralFaith, candidate), RangeError);
    assert.equal(JSON.stringify(candidate), before);
  }
  assert.deepEqual(engine.normalizeState(JSON.parse(JSON.stringify(source))).ancestralFaith, source.ancestralFaith);
});

check('expiration never replenishes uses and a consumed favor cannot buy another rite that day', () => {
  let source = invoke(fixture());
  assert.equal(faith.consumeAncestralFavor(source, 'gather'), source);
  assert.equal(faith.consumeAncestralFavor(source, 'hunt', { attempted: true }), source);
  source = faith.consumeAncestralFavor(source, 'gather', { attempted: true });
  assert.equal(remaining(source), 1);
  source = faith.consumeAncestralFavor(source, 'gather', { attempted: true });
  assert.equal(remaining(source), 0);
  assert.equal(faith.runAncestralRite(source, { actorId: source.party[1].id, founderId: source.party[0].id }).reason, 'cooldown');
  const expired = invoke(fixture());
  expired.day += 1;
  assert.equal(faith.ancestralActionChanceBonus(expired, 'gather'), 0);
  assert.equal(faith.normalizeAncestralFaith(expired.ancestralFaith, expired).active, null);
  assert.equal(faith.normalizeAncestralFaith(expired.ancestralFaith, expired).lastRiteDay, expired.day - 1);
});

check('real probability uses the bounded bonus and previews, safe collection and wrong-domain actions do not consume it', () => {
  const source = fixture();
  const active = invoke(source);
  const actorId = active.party[1].id;
  const baseChance = engine.actionChance(source, actorId, 'gather', 0.1);
  assert.ok(Math.abs(engine.actionChance(active, actorId, 'gather', 0.1) - baseChance - 0.15) < 1e-9);
  assert.equal(engine.actionChance(active, actorId, 'gather', 2), engine.actionChance(source, actorId, 'gather', 2));
  const preview = JSON.stringify(active.ancestralFaith);
  engine.actionForecastRows(active, actorId, 'whisper-woods', 'twine');
  assert.equal(JSON.stringify(active.ancestralFaith), preview);
  const safe = engine.runSafeGatherAction(active, actorId, 'wood', { rng: () => 0.5 });
  assert.equal(remaining(safe), 2);
  const wrong = engine.runHuntAction(active, actorId, 'whisper-woods', { rng: () => 0.999 });
  assert.equal(remaining(wrong), 2);
  for (const [blockedActor, ap] of [['invalid', active.ap], [actorId, 0]]) {
    const blocked = engine.runGatherAction({ ...active, ap }, blockedActor, 'whisper-woods', { rng: () => { throw new Error('Blocked action drew RNG'); } });
    assert.equal(remaining(blocked), 2);
  }
});

check('normal success and normal failed probability attempts consume exactly one use with zero extra gameplay draws', () => {
  for (const domain of ['gather', 'hunt', 'craft']) {
    const source = fixture(domain);
    const active = invoke(source);
    const actorId = active.party[1].id;
    const perform = state => domain === 'craft'
      ? engine.runCraftAction(state, actorId, 'twine', { rng })
      : domain === 'hunt' ? engine.runHuntAction(state, actorId, 'whisper-woods', { rng })
        : engine.runGatherAction(state, actorId, 'whisper-woods', { rng });
    let draws = 0;
    let roll = 0.999;
    const rng = () => { draws += 1; return roll; };
    const baseline = perform({ ...source, inventory: { ...source.inventory, berry: source.inventory.berry - 1 } });
    const baselineDraws = draws;
    draws = 0;
    const failed = perform(active);
    assert.equal(remaining(failed), 1);
    assert.equal(draws, baselineDraws);
    assert.deepEqual(failed.inventory, baseline.inventory);
    draws = 0; roll = 0;
    assert.equal(remaining(perform(active)), 1);
    if (domain === 'craft') {
      const locked = clone(active); delete locked.research.completed.CORDAGE;
      assert.equal(remaining(engine.runCraftAction(locked, actorId, 'twine', { rng })), 2);
      const empty = clone(active); empty.inventory.fiber = 0;
      assert.equal(remaining(engine.runCraftAction(empty, actorId, 'twine', { rng })), 2);
    }
  }
});

check('matching specialized and paid event-chain paths consume once; their invalid or locked paths consume nothing', () => {
  let source = fixture();
  source.research.completed.STONE_TOOLS = true;
  source.eventChains = [{ id: 'faith-chain', kind: 'obsidian_vein', zoneId: 'cave',
    startedDay: source.day, expiresDay: source.day + 3, resolved: false }];
  source = engine.normalizeState(source);
  const active = invoke(source);
  const actorId = active.party[1].id;
  assert.equal(engine.specializedActionRows(active, actorId, 'whisper-woods').find(row => row.id === 'logging').available, true);
  const specialized = engine.runSpecializedAction(active, actorId, 'logging', 'whisper-woods', { rng: () => 0.999 });
  assert.equal(remaining(specialized), 1);
  const noRng = () => { throw new Error('Invalid specialized/event action drew RNG'); };
  assert.equal(remaining(engine.runSpecializedAction(active, 'invalid', 'logging', 'whisper-woods', { rng: noRng })), 2);
  const locked = clone(active); locked.research.completed.STONE_TOOLS = false;
  assert.equal(remaining(engine.runSpecializedAction(locked, actorId, 'logging', 'whisper-woods', { rng: noRng })), 2);
  const chain = engine.eventChainRows(active, actorId)[0];
  assert.equal(chain.enabled, true);
  assert.equal(remaining(active), 2);
  assert.equal(remaining(engine.runEventChainAction(active, actorId, 'unknown', { rng: noRng })), 2);
  assert.equal(remaining(engine.runEventChainAction({ ...active, ap: 0 }, actorId, chain.id, { rng: noRng })), 2);
  const resolved = engine.runEventChainAction(active, actorId, chain.id, { rng: () => 0.999 });
  assert.equal(remaining(resolved), 1);
  assert.equal(remaining(engine.runEventChainAction(resolved, actorId, chain.id, { rng: noRng })), 1);
});

check('study and care helpers award only real remaining room, never completion spill or healing beyond 100', () => {
  const study = invoke(fixture('study'));
  assert.equal(faith.ancestralStudyBonus(study, 5, 20), 2);
  assert.equal(faith.ancestralStudyBonus(study, 5, 6), 1);
  assert.equal(faith.ancestralStudyBonus(study, 5, 5), 0);
  assert.equal(faith.ancestralStudyBonus(study, 0, 20), 0);
  assert.equal(faith.ancestralStudyBonus(study, 5, 0), 0);
  const care = invoke(fixture('care'));
  assert.equal(faith.ancestralCareBonus(care, 50, 10), 4);
  assert.equal(faith.ancestralCareBonus(care, 88, 10), 2);
  assert.equal(faith.ancestralCareBonus(care, 100, 10), 0);
  assert.equal(faith.ancestralCareBonus(care, 90, 10), 0);
  assert.equal(faith.ancestralCareBonus(care, 50, 0), 0);
});

check('actual research and council actions gain capped points while completed or locked actions preserve charges', () => {
  for (const track of ['research', 'civics']) {
    let source = fixture('study');
    source.research.completed.CORDAGE = false;
    source.research.selectedTechId = 'CORDAGE';
    const actorId = source.party[1].id;
    if (track === 'civics') {
      const target = engine.CIVIC_TREE.find(row => row.cost >= 20);
      const catalog = [...engine.TECHNOLOGY_TREE, ...engine.CIVIC_TREE];
      const completePrereqs = node => node.prereqs.forEach(id => {
        const prereq = catalog.find(row => row.id === id);
        if (prereq) completePrereqs(prereq);
        source.research.completed[id] = true;
      });
      completePrereqs(target);
      source.civics.selectedCivicId = target.id;
    }
    source = engine.normalizeState(source);
    const targetId = source[track][track === 'research' ? 'selectedTechId' : 'selectedCivicId'];
    const perform = state => track === 'research'
      ? engine.runResearchAction(state, actorId, { rng: () => 0.5 })
      : engine.runCivicAction(state, actorId, { rng: () => 0.5 });
    const baseline = perform(source);
    const active = invoke(source);
    const boosted = perform(active);
    assert.equal(remaining(boosted), 1);
    assert.equal(boosted[track].progress[targetId] - baseline[track].progress[targetId], 2);
    const locked = clone(active); locked.camp.workbenchLevel = 0;
    assert.equal(remaining(perform(locked)), 2);
    const complete = clone(active);
    for (const tech of engine.TECHNOLOGY_TREE) complete.research.completed[tech.id] = true;
    for (const civic of engine.CIVIC_TREE) complete.civics.completed[civic.id] = true;
    assert.equal(remaining(perform(complete)), 2);
  }
});

check('real research completion adds only its one remaining point and never spills another bonus into the next technology', () => {
  for (const gap of [0, 1]) {
    let source = fixture('study');
    source.research.completed.CORDAGE = false;
    source.research.selectedTechId = 'CORDAGE';
    source.research.eureka.CORDAGE = true;
    source.research.inspiration.CORDAGE = true;
    source = engine.normalizeState(source);
    const actorId = source.party[1].id;
    const target = engine.TECHNOLOGY_TREE.find(row => row.id === 'CORDAGE');
    const points = engine.researchActionEstimate(source, actorId).points;
    source.research.progress.CORDAGE = target.cost - points - gap;
    const active = invoke(source);
    const boosted = engine.runResearchAction(active, actorId, { rng: () => 0.5 });
    assert.equal(boosted.research.completed.CORDAGE, true);
    assert.equal(boosted.research.progress.CORDAGE, target.cost);
    assert.equal(remaining(boosted), gap ? 1 : 2);
    const reference = clone(source);
    reference.inventory.berry -= 1;
    reference.research.progress.CORDAGE += gap;
    const expected = engine.runResearchAction(reference, actorId, { rng: () => 0.5 });
    assert.deepEqual(boosted.research, expected.research);
  }
});

check('actual rest heals four extra HP once and full-HP or fully capped rest preserves both uses', () => {
  for (const hp of [50, 100]) {
    const source = fixture('care');
    const actorId = source.party[1].id;
    source.party[1].hp = hp;
    const baseline = engine.runRestAction(source, actorId, { rng: () => 0.5 });
    const boosted = engine.runRestAction(invoke(source), actorId, { rng: () => 0.5 });
    const baseHp = baseline.party.find(actor => actor.id === actorId).hp;
    const boostedHp = boosted.party.find(actor => actor.id === actorId).hp;
    assert.equal(boostedHp, Math.min(100, baseHp + (hp < 100 ? 4 : 0)));
    assert.equal(remaining(boosted), hp < 100 ? 1 : 2);
  }
});

console.log(`PRIMITIVE_ARCHIVE_ANCESTRAL_FAITH ${checks}/${checks + failures.length}; real engine material/probability/research/council/rest contracts; no browser, account, network or full campaign proof`);
if (failures.length) process.exitCode = 1;
