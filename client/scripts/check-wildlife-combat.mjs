import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { runHuntAction } = await import('../src/app/simulation/_lib/phaseHuntActionRuntime.js');
const { runActorQueuedActionStep } = await import('../src/app/simulation/_lib/phaseActorQueuedActionStepRuntime.js');
const { runPvpActionLoop } = await import('../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { advanceSpatialMovement } = await import('../src/app/simulation/_lib/combatSpatialRuntime.js');
const { advanceTimedWildlifeEffects, completeTimedWildlifeEncounter, getWildlifeCombatRoster, releaseTimedWildlifeEncounter,
  getTimedWildlifeCombatSummary, resolveTimedWildlifeAction } = await import('../src/app/simulation/_lib/wildlifeCombatRuntime.js');
const { findCharacterSkillChoice, startCharacterCast, finishCharacterCast } = await import('../src/app/simulation/_lib/characterCastRuntime.js');
const { normalizeSkillState } = await import('../src/app/simulation/_lib/characterSkillDefinitionRuntime.js');
const { runCombatScenario } = await import('./lib/run-combat-scenario.mjs');
const { grantMasteries } = await import('../src/app/simulation/_lib/masteryProgressRuntime.js');
const { setDeathMetadata } = await import('../src/app/simulation/_lib/phaseDeathRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { makeShieldEffect, updateEffects } = await import('../src/utils/statusLogic.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

let checks = 0;
async function check(name, run) {
  await run();
  checks += 1;
  console.log(`PASS ${name}`);
}

const meat = { _id: 'meat', name: '고기', type: '재료', tier: 1, tags: ['meat'] };
const mithril = { _id: 'mithril', name: '미스릴', type: '재료', tier: 4, tags: ['mithril'] };
const publicItems = [meat];
const itemNameById = { meat: '고기' };
const itemMetaById = { meat };
const mapObj = { _id: 'hunt-map', zones: [{ zoneId: 'z', name: '사냥터' }], crates: [] };
const baseRules = getRuleset('ER_S11');
const rules = {
  ...baseRules,
  ai: { ...baseRules.ai, escapeHpBelow: 0, huntRetreatHpRatio: 0.05 },
  pvp: { ...baseRules.pvp, criticalFleeHpBelow: 0, criticalFleeChance: 0, teamCombatEnabled: false },
};
const actor = (extra = {}) => ({
  _id: 'hunter', name: '사냥자', teamId: 'team:1', zoneId: 'z', hp: 320, maxHp: 320,
  stats: { maxHp: 320, attackPower: 80, defense: 12, skillAmp: 0, attackSpeed: 1,
    moveSpeed: 3.2, attackRange: 1.4, sightRange: 10 },
  inventory: [], equipped: {}, activeEffects: [], tacticalSkill: 'none', simCredits: 0,
  _spatial: { zoneId: 'z', x: 8, y: 8 }, _actionCycleKey: '2:100', ...extra,
});
const spawn = (species = 'bear') => ({ mapId: 'hunt-map', bosses: {}, mutantWildlife: null,
  wildlife: { z: 1 }, wildlifeSpecies: { z: [species] } });
const huntingSkill = (extra = {}) => ({ enabled: true, name: '일반 사냥 스킬', type: 'attack_skill',
  flatDamage: [35], range: 6, cooldownSec: 4, castDelaySec: 0.25, recoveryDelaySec: 0.25, ...extra });
const ultimate = (extra = {}) => huntingSkill({ name: '교전 전용 궁극기', flatDamage: [1000],
  cooldownSec: 60, resourceCost: 25, ...extra });
const ultimateHunter = (extra = {}) => actor({ hp: 2000, maxHp: 2000,
  uniqueResource: { enabled: true, name: 'VF', maxValue: 100, startValue: 100, regenPerSec: 0 },
  uniqueResourceValue: 100, ...extra });

function beginUltimateHunt(subject, kind) {
  const world = spawn(kind);
  if (['alpha', 'omega', 'weakline', 'mutant_wildlife'].includes(kind)) {
    world.wildlife.z = 0;
    world.wildlifeSpecies.z = [];
    if (kind === 'mutant_wildlife') world.mutantWildlife = { alive: true, zoneId: 'z', animal: '멧돼지' };
    else world.bosses[kind] = { alive: true, zoneId: 'z' };
  }
  const items = [meat, mithril,
    { _id: 'force-core', name: '포스 코어', type: '재료', tier: 4 },
    { _id: 'vf-blood', name: 'VF 혈액 샘플', type: '재료', tier: 4 }];
  assert.equal(begin(subject, world, capture(), { publicItems: items,
    itemNameById: Object.fromEntries(items.map((item) => [item._id, item.name])),
    itemMetaById: Object.fromEntries(items.map((item) => [item._id, item])) }).pending, true);
  assert.equal(subject._wildlifeHunt.kind, kind);
  return world;
}

function capture(now = () => 100) {
  const events = [];
  const logs = [];
  const emitRunEvent = (kind, payload = {}, at) => events.push({ ...payload,
    ...(payload.kind != null && payload.subkind == null ? { subkind: payload.kind } : {}), kind, at });
  return {
    events,
    logs,
    actions: {
      addLog: (text, type) => logs.push({ text, type }),
      atNow: () => ({ day: 2, phase: 'morning', sec: now() }),
      emitRunEvent,
      emitItemGainIfAny: (qty, payload, at) => { if (qty > 0) emitRunEvent('gain', { ...payload, qty }, at); },
      emitObjectiveRunEvent: (subject, objective, payload, at) => emitRunEvent('objective', { who: subject._id, objective, ...payload }, at),
      emitDeathRunEventOnce: (subject, payload) => emitRunEvent('death', { who: subject._id, ...payload }, { day: 2, phase: 'morning', sec: now() }),
      emitEffectRunEvents: () => {},
      grantMasteries,
      setDeathMetadata: (subject, reason, details) => setDeathMetadata(subject, reason, details, now),
    },
  };
}

function begin(subject, world, observed, extra = {}) {
  return withSimulationRandom(() => 0, () => runHuntAction({
    state: {
      actor: subject,
      craftables: [],
      currentActionSec: () => 100,
      deferHuntSettlement: true,
      didMove: true,
      goalMissingIds: new Set(),
      itemMetaById,
      itemNameById,
      mapObj,
      nextDay: 2,
      nextPhase: 'morning',
      nextSpawn: world,
      phaseIdxNow: 2,
      publicItems,
      ruleset: rules,
      ...extra,
    },
    actions: observed.actions,
  }));
}

async function runTimedFight(subject, world, { duration = 12, skills = false } = {}) {
  let offset = 0;
  let advancedTo = 0;
  let live = new Map([[subject._id, subject]]);
  let frames = 0;
  const observed = capture(() => 100 + offset);
  let promise;
  withSimulationRandom(createSeedRng('wildlife-time-axis'), () => {
    promise = runPvpActionLoop({
      state: {
        updatedSurvivors: [subject], phaseSurvivors: [subject], phaseDurationSec: duration,
        nextDay: 2, nextPhase: 'morning', nextSpawn: world, currentActionSec: () => 100 + offset,
        getPhaseRuntimeOffsetSec: () => offset, battleSettings: { characterSkillsEnabled: skills },
        ruleset: rules, mapObj, publicItems, itemMetaById, itemNameById, craftables: [],
        phaseIdxNow: 2, reviveCutoffIdx: 4,
      },
      actions: {
        ...observed.actions,
        reserveActionSecond: (seconds) => { offset = Math.min(duration, Math.round((offset + seconds) * 1e6) / 1e6); },
        advanceWorld: ({ survivorMap, offsetSec }) => {
          live = survivorMap;
          const elapsedSec = Math.max(0, offsetSec - advancedTo);
          if (elapsedSec > 0) {
            const roster = [...live.values()];
            advanceSpatialMovement(getWildlifeCombatRoster(roster), 100 + advancedTo, elapsedSec);
            for (const [id, row] of live) live.set(id, updateEffects(row, { elapsedSec, startSec: 100 + advancedTo }));
            advanceTimedWildlifeEffects([...live.values()], { elapsedSec, startSec: 100 + advancedTo });
          }
          advancedTo = offsetSec;
        },
        publishActionFrame: async () => { frames += 1; assert.ok(frames < 1000, 'Timed hunt must always advance its clock.'); },
        shouldEndMatch: () => false,
        resolveWorldObjectives: () => {},
        appendPhaseDeadSnapshots: (rows) => rows,
        flushDeadSnapshots: () => {},
      },
    });
  });
  const result = await promise;
  return { result, observed, offset, frames };
}

await check('scheduled hunting reserves one shared animal without granting instant rewards', () => {
  const subject = actor();
  const world = spawn('bear');
  const observed = capture();
  const result = begin(subject, world, observed);
  assert.equal(result.pending, true);
  assert.equal(world.wildlife.z, 0);
  assert.deepEqual(world.wildlifeSpecies.z, []);
  assert.ok(subject._wildlifeHunt?.target?.hp > 0);
  assert.equal(subject.simCredits, 0);
  assert.equal(observed.events.filter((event) => event.kind === 'hunt_start').length, 1);
  assert.equal(observed.events.some((event) => event.kind === 'hunt_settlement'), false);

  const rival = actor({ _id: 'rival', name: '경쟁자', teamId: 'team:2', _actionCycleKey: '2:100:rival' });
  assert.equal(begin(rival, world, observed).hunt, null, 'A claimed shared animal cannot be duplicated for another team.');
  releaseTimedWildlifeEncounter(subject, world, '검사 후퇴', observed.actions, 101);
  assert.equal(world.wildlife.z, 1);
  assert.deepEqual(world.wildlifeSpecies.z, ['bear']);
});

await check('the real queued growth action wires scheduled hunting instead of legacy instant settlement', () => {
  const subject = actor();
  const world = spawn('bear');
  const observed = capture();
  const result = withSimulationRandom(() => 0, () => runActorQueuedActionStep({
    actor: subject,
    actionPlan: {
      queuedActionType: 'hunt',
      fallbackRouteItemIds: [],
      goalMissingIds: new Set(),
      queuedDroneOrder: null,
      queuedKioskAction: null,
    },
    movementResult: { didMove: true, recovering: false },
    fieldLootResult: {},
    state: {
      actionIntervalSec: 20,
      currentActionSec: () => 100,
      craftables: [],
      itemMetaById,
      itemNameById,
      kiosks: [],
      mapObj,
      nextDay: 2,
      nextPhase: 'morning',
      nextSpawn: world,
      phaseIdxNow: 2,
      publicItems,
      ruleset: rules,
    },
    actions: observed.actions,
  }));
  assert.equal(result.huntPending, true);
  assert.ok(result.actor._wildlifeHunt?.target?.hp > 0);
  assert.equal(result.actor.simCredits, 0);
  assert.equal(world.wildlife.z, 0);
  assert.equal(observed.events.filter((event) => event.kind === 'hunt_start').length, 1);
  assert.equal(observed.events.some((event) => event.kind === 'hunt_settlement'), false);
});

await check('boss and mutant claims stay alive until the timed target is actually defeated', () => {
  for (const [kind, world, items] of [
    ['alpha', { mapId: 'hunt-map', bosses: { alpha: { alive: true, zoneId: 'z' } }, wildlife: { z: 0 }, wildlifeSpecies: { z: [] } }, [meat, mithril]],
    ['mutant_wildlife', { mapId: 'hunt-map', bosses: {}, mutantWildlife: { alive: true, zoneId: 'z', animal: '멧돼지' }, wildlife: { z: 0 }, wildlifeSpecies: { z: [] } }, [meat]],
  ]) {
    const subject = actor({ _id: `hunter-${kind}`, _actionCycleKey: `2:100:${kind}` });
    const observed = capture();
    const result = begin(subject, world, observed, { publicItems: items,
      itemNameById: Object.fromEntries(items.map((item) => [item._id, item.name])),
      itemMetaById: Object.fromEntries(items.map((item) => [item._id, item])) });
    assert.equal(result.pending, true);
    assert.equal(subject._wildlifeHunt.kind, kind);
    const source = kind === 'alpha' ? world.bosses.alpha : world.mutantWildlife;
    assert.equal(source.alive, true);
    assert.equal(source.engagedBy, subject._id);
    subject._wildlifeHunt.target.hp = 0;
    assert.ok(completeTimedWildlifeEncounter(subject, world, observed.actions));
    assert.equal(source.alive, false);
    assert.equal(source.engagedBy, undefined);
    assert.equal(source.engagementId, undefined);
  }
});

await check('real attacks, movement and fractional attack periods settle one hunt on the shared clock', async () => {
  const subject = actor();
  const world = spawn('bear');
  const startup = capture();
  begin(subject, world, startup);
  const { result, observed } = await runTimedFight(subject, world);
  const final = result.survivorMap.get(subject._id);
  const damage = observed.events.filter((event) => event.kind === 'damage');
  const hunterHits = damage.filter((event) => event.who === subject._id && event.targetId?.startsWith('wildlife:'));
  const wildlifeHits = damage.filter((event) => event.who?.startsWith('wildlife:') && event.targetId === subject._id);
  assert.ok(hunterHits.length >= 4);
  assert.ok(wildlifeHits.length >= 1);
  assert.ok(new Set(hunterHits.map((event) => event.at.sec)).size === hunterHits.length);
  assert.ok(hunterHits.some((event, index) => index > 0 && event.at.sec - hunterHits[index - 1].at.sec >= 0.999));
  assert.equal(final._wildlifeHunt, null);
  assert.ok(final.simCredits > 0);
  assert.equal(world.wildlife.z, 0);
  assert.equal(observed.events.filter((event) => event.kind === 'hunt_settlement' && event.defeated).length, 1);
  assert.equal(observed.events.filter((event) => event.kind === 'hunt_end' && event.outcome === 'victory').length, 1);
  assert.ok(observed.events.some((event) => event.kind === 'hunt_exchange' && event.damageDealt > 0));
});

await check('character shields absorb wildlife attacks and authored skills damage the same target', async () => {
  const subject = actor({
    activeEffects: [makeShieldEffect(100, 20, 'hunt-test-shield')],
    characterSkills: { q: { enabled: true, name: '사냥용 강타', type: 'attack_skill', flatDamage: [120],
      cooldownSec: 30, castDelaySec: 0.5, recoveryDelaySec: 0.25, range: 6 } },
  });
  const world = spawn('bear');
  begin(subject, world, capture());
  const { result, observed } = await runTimedFight(subject, world, { skills: true });
  const skillHits = observed.events.filter((event) => event.kind === 'damage' && event.who === subject._id && event.type === 'skill');
  assert.ok(skillHits.length >= 1);
  assert.ok(observed.logs.some((row) => row.text.includes('보호막: 피해')));
  assert.ok(result.survivorMap.get(subject._id).hp > subject.hp - 100);
  assert.equal(result.survivorMap.get(subject._id)._wildlifeHunt, null);
});

for (const [index, kind] of ['chicken', 'bat', 'boar', 'dog', 'wolf', 'bear', 'mutant_wildlife', 'alpha', 'omega', 'weakline'].entries()) {
  await check(`${kind} hunting reserves R and its resource while ordinary skills and basic attacks still work`, async () => {
    const slot = ['q', 'w', 'e'][index % 3];
    const subject = ultimateHunter({ characterSkills: { [slot]: huntingSkill(), r: ultimate() } });
    const world = beginUltimateHunt(subject, kind);
    const { result, observed } = await runTimedFight(subject, world, { skills: true, duration: 30 });
    const final = result.survivorMap.get(subject._id);
    const casts = observed.events.filter((event) => event.kind === 'skill_cast');
    assert.equal(casts.filter((event) => event.slot === 'r').length, 0, `${kind} must not start an ultimate.`);
    assert.ok(casts.some((event) => event.slot === slot), 'Skipping R must not starve another ready skill.');
    assert.ok(observed.events.some((event) => event.kind === 'damage' && event.who === subject._id && event.type === 'basic'));
    assert.ok(observed.events.some((event) => event.kind === 'hunt_end' && event.outcome === 'victory'));
    assert.equal(Number(normalizeSkillState(final).r.cooldownUntil || 0), 0);
    assert.equal(final.uniqueResourceValue, 100);
    assert.equal(observed.events.some((event) => event.kind === 'unique_resource' && event.slot === 'r'), false);
  });
}

for (const type of ['heal_skill', 'shield_skill', 'buff_skill', 'basic_attack_enhance']) {
  await check(`hunting also reserves a ${type} ultimate even when its actual target would be self`, async () => {
    const subject = ultimateHunter({ hp: 200, maxHp: 320, characterSkills: {
      q: huntingSkill(),
      r: ultimate({ type, flatDamage: [0], heal: [100], shield: [100], durationSec: 5,
        statModifiers: { attackPower: 50 }, supportTargetScope: 'self', firstFlat: [1000] }),
    } });
    const opponent = actor({ _id: 'enemy', teamId: 'team:2' });
    assert.equal(findCharacterSkillChoice(subject, [opponent], [subject, opponent], 100, {}).def.slot, 'r',
      'This fixture must prefer the support/enhancement R when an enemy team is present.');
    const world = beginUltimateHunt(subject, 'bear');
    const { result, observed } = await runTimedFight(subject, world, { skills: true, duration: 5 });
    assert.equal(observed.events.some((event) => event.kind === 'skill_cast' && event.slot === 'r'), false);
    assert.equal(result.survivorMap.get(subject._id).uniqueResourceValue, 100);
  });
}

await check('an available ultimate recast is reserved in a hunt but remains available against an enemy team', () => {
  const subject = ultimateHunter({ characterSkills: { r: ultimate({ secondFlat: [1000], recastWindowSec: 5 }) },
    skillState: { r: { stage: 'recast', cooldownUntil: 160, recastUntil: 105 } } });
  beginUltimateHunt(subject, 'bear');
  const target = subject._wildlifeHunt.target;
  const before = JSON.stringify(subject);
  assert.equal(findCharacterSkillChoice(subject, [target], [subject, target], 100, {}), null);
  assert.equal(JSON.stringify(subject), before, 'Hunt selection must not consume or reset R state.');
  const opponent = actor({ _id: 'enemy', teamId: 'team:2' });
  const choice = findCharacterSkillChoice(subject, [target, opponent], [subject, target, opponent], 100, {});
  assert.equal(choice.def.slot, 'r');
  assert.equal(choice.stage, 2);
  assert.equal(choice.targetId, opponent._id, 'Even a mixed roster must not redirect R onto wildlife.');
});

await check('an R-enhanced basic prepared in PvP is not spent on an animal and can still hit an enemy before expiry', async () => {
  const subject = ultimateHunter({ characterSkills: { r: ultimate({ type: 'basic_attack_enhance',
    firstFlat: [1000], durationSec: 5 }) } });
  const opponent = actor({ _id: 'enemy', teamId: 'team:2', hp: 2000, maxHp: 2000, _basicAttackReadyAtSec: 999 });
  assert.equal(startCharacterCast(subject, findCharacterSkillChoice(subject, [opponent], [subject, opponent], 100, {}), 100, {}), true);
  finishCharacterCast(subject, 100.25);
  const armed = structuredClone(subject._armedCharacterSkill);
  const world = beginUltimateHunt(subject, 'bear');
  const target = subject._wildlifeHunt.target;
  target._spatial = { ...subject._spatial };
  const observed = capture(() => 100.5);
  const action = withSimulationRandom(() => 0, () => resolveTimedWildlifeAction({ ownerId: subject._id,
    encounterId: subject._wildlifeHunt.id, actorId: subject._id, targetId: target._id, actionType: 'hunt_basic' },
  { survivorMap: new Map([[subject._id, subject]]), nowSec: 100.5, battleSettings: {}, ruleset: rules, actions: observed.actions }));
  assert.equal(action.performed, true);
  assert.ok(action.targetLoss > 0, 'The ordinary basic attack must still hit the animal.');
  assert.deepEqual(subject._armedCharacterSkill, armed, 'Do not consume or extend an already paid R enhancement while hunting.');
  assert.equal(observed.events.some((event) => event.kind === 'skill' && event.slot === 'r'), false);
  releaseTimedWildlifeEncounter(subject, world, '검사 교전 전환', observed.actions, 100.5);
  const combat = await runCombatScenario([subject, opponent], { startSec: 102.5, duration: 1 });
  assert.ok(combat.events.some((event) => event.kind === 'skill' && event.slot === 'r' && event.targetId === opponent._id),
    'The saved enhancement must still resolve on the next enemy-team attack before its original expiry.');
  assert.equal(combat.survivorMap.get(subject._id)._armedCharacterSkill, null);
  assert.equal(combat.survivorMap.get(subject._id).uniqueResourceValue, 75, 'Only the original PvP cast pays the cost.');
});

await check('after hunting without R, real enemy-team combat can cast and land the reserved ultimate', async () => {
  const subject = ultimateHunter({ characterSkills: { r: ultimate() } });
  const world = beginUltimateHunt(subject, 'bear');
  const hunt = await runTimedFight(subject, world, { skills: true });
  const final = hunt.result.survivorMap.get(subject._id);
  assert.equal(hunt.observed.events.some((event) => event.kind === 'skill_cast' && event.slot === 'r'), false);
  const opponent = actor({ _id: 'enemy', teamId: 'team:2', hp: 2000, maxHp: 2000,
    _spatial: { ...final._spatial }, _basicAttackReadyAtSec: 999 });
  const combat = await runCombatScenario([final, opponent], { startSec: 112, duration: 2 });
  assert.ok(combat.events.some((event) => event.kind === 'skill_cast' && event.slot === 'r' && event.targetId === opponent._id));
  assert.ok(combat.events.some((event) => event.kind === 'damage' && event.who === subject._id && event.type === 'skill'));
  assert.equal(combat.survivorMap.get(subject._id).uniqueResourceValue, 75);
  assert.equal(combat.survivorMap.get(subject._id).skillState.r.cooldownUntil, 172);
});

await check('a hunter killed by actual wildlife damage dies once and releases the unfinished animal', async () => {
  const subject = actor({ hp: 20, maxHp: 100, stats: { maxHp: 100, attackPower: 1, defense: 0,
    skillAmp: 0, attackSpeed: 0.5, moveSpeed: 3, attackRange: 1.2, sightRange: 10 } });
  const world = spawn('bear');
  begin(subject, world, capture());
  const before = getTimedWildlifeCombatSummary(subject);
  assert.equal(before.wildlifeHp, before.wildlifeMaxHp);
  const { result, observed } = await runTimedFight(subject, world, { duration: 6 });
  const final = result.survivorMap.get(subject._id);
  assert.equal(final.hp, 0);
  assert.equal(final.deathReason, 'wildlife_hunt');
  assert.equal(result.newDeadIds.filter((id) => id === subject._id).length, 1);
  assert.equal(observed.events.filter((event) => event.kind === 'death' && event.who === subject._id).length, 1);
  assert.equal(observed.events.filter((event) => event.kind === 'hunt_settlement' && event.died).length, 1);
  assert.equal(world.wildlife.z, 1);
  assert.deepEqual(world.wildlifeSpecies.z, ['bear']);
});

await check('a non-wildlife death keeps its original cause while releasing the claimed animal', async () => {
  const subject = actor();
  const world = spawn('bear');
  begin(subject, world, capture());
  setDeathMetadata(subject, 'status_effect', { causeName: '맹독' }, () => 100);
  subject.hp = 0;
  const { result, observed } = await runTimedFight(subject, world, { duration: 0.25 });
  const final = result.survivorMap.get(subject._id);
  assert.equal(final.deathReason, 'status_effect');
  assert.equal(final.deathCauseName, '맹독');
  assert.equal(final._wildlifeHunt, null);
  assert.equal(world.wildlife.z, 1);
  assert.deepEqual(world.wildlifeSpecies.z, ['bear']);
  assert.equal(observed.events.filter((event) => event.kind === 'hunt_end'
    && event.outcome === 'interrupted_by_death').length, 1);
  assert.equal(observed.events.some((event) => event.kind === 'hunt_settlement'), false);
  assert.equal(observed.events.some((event) => event.kind === 'death'), false,
    'The hunt reconciler must not emit a second death for an external cause.');
});

await check('a phase boundary releases an unfinished claim before the next wildlife spawn refresh', async () => {
  const subject = actor();
  const world = spawn('bear');
  begin(subject, world, capture());
  const { result, observed } = await runTimedFight(subject, world, { duration: 0.25 });
  const final = result.survivorMap.get(subject._id);
  assert.equal(final._wildlifeHunt, null);
  assert.equal(world.wildlife.z, 1);
  assert.deepEqual(world.wildlifeSpecies.z, ['bear']);
  assert.equal(observed.events.filter((event) => event.kind === 'hunt_end'
    && event.outcome === 'retreat' && event.reason === '시간대 전환').length, 1);
});

await check('JSON restoration preserves the claimed target HP and attack clocks without a second reservation', () => {
  const subject = actor();
  const world = spawn('wolf');
  begin(subject, world, capture());
  subject._wildlifeHunt.target.hp -= 17;
  subject._wildlifeHunt.target._basicAttackReadyAtSec = 104.25;
  const restored = JSON.parse(JSON.stringify({ subject, world }));
  assert.equal(restored.subject._wildlifeHunt.target.hp, subject._wildlifeHunt.target.hp);
  assert.equal(restored.subject._wildlifeHunt.target._basicAttackReadyAtSec, 104.25);
  assert.equal(begin(restored.subject, restored.world, capture()).reason, 'active_encounter');
  assert.equal(restored.world.wildlife.z, 0);
});

console.log(`WILDLIFE_COMBAT_CHECKS ${checks}/${checks}`);
