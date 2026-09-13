import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { runHuntAction } = await import('../src/app/simulation/_lib/phaseHuntActionRuntime.js');
const { runActorQueuedActionStep } = await import('../src/app/simulation/_lib/phaseActorQueuedActionStepRuntime.js');
const { runPvpActionLoop } = await import('../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { advanceSpatialMovement } = await import('../src/app/simulation/_lib/combatSpatialRuntime.js');
const { advanceTimedWildlifeEffects, completeTimedWildlifeEncounter, getWildlifeCombatRoster, releaseTimedWildlifeEncounter,
  getTimedWildlifeCombatSummary } = await import('../src/app/simulation/_lib/wildlifeCombatRuntime.js');
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
