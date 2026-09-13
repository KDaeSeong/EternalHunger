import assert from 'node:assert/strict';
const { runPvpActionLoop } = await import('../../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { createPhaseActionTimeline } = await import('../../src/app/simulation/_lib/phaseActionTimelineRuntime.js');
const { engageCombatParticipants, roundCombatTime } = await import('../../src/app/simulation/_lib/combatTimingRuntime.js');
const { updateEffects } = await import('../../src/utils/statusLogic.js');
const { advanceSpatialMovement } = await import('../../src/app/simulation/_lib/combatSpatialRuntime.js');
const { createSeedRng } = await import('../../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../../src/utils/simulationRandom.js');

export const effect = (name, seconds, extra = {}) => ({ name, remainingDuration: seconds, durationUnit: 'sec', ...extra });
export const actor = (id, extra = {}) => ({ _id: id, name: id, teamId: id, zoneId: 'zone', hp: 1000, maxHp: 1000,
  _spatial: { zoneId: 'zone', x: 4, y: 4 },
  inventory: [], tacticalSkill: 'none', _tacNextAbsSec: 1e9,
  stats: { maxHp: 1000, attackPower: 1, defense: 0, attackSpeed: 1 }, ...extra });
export const skill = (extra = {}) => ({ enabled: true, name: 'test skill', type: 'attack_skill', flatDamage: [40],
  cooldownSec: 10, castDelaySec: 1.25, recoveryDelaySec: 0.25, ...extra });

export async function runCombatScenario(rows, { duration = 4, startSec = 100, settings = {}, onElapsed = () => {},
  engage = true, nextDay = 1, onFrame = () => {} } = {}) {
  let offset = 0; let live; const events = []; const frames = [];
  const timeline = createPhaseActionTimeline({ durationSec: duration, onElapsed: (from, elapsed) => {
    advanceSpatialMovement([...live.values()], startSec + from, elapsed);
    for (const [id, current] of live) live.set(id, updateEffects(current, { elapsedSec: elapsed }));
    onElapsed(live, roundCombatTime(from + elapsed));
  } });
  let promise;
  withSimulationRandom(createSeedRng('cast-scenario'), () => {
    if (engage) engageCombatParticipants(rows[0], rows[1], rows, startSec);
    promise = runPvpActionLoop({ state: { updatedSurvivors: rows, phaseSurvivors: rows, phaseDurationSec: duration,
      nextDay, nextPhase: 'morning', currentActionSec: () => roundCombatTime(startSec + offset),
      getPhaseRuntimeOffsetSec: () => offset, battleSettings: settings,
      ruleset: { ai: { escapeHpBelow: 0 }, pvp: { criticalFleeHpBelow: 0, teamCombatEnabled: true } } },
      actions: { reserveActionSecond: (seconds) => { offset = Math.min(duration, roundCombatTime(offset + seconds)); },
        advanceWorld: ({ survivorMap, offsetSec }) => { live = survivorMap; timeline.advanceTo(offsetSec); },
        emitRunEvent: (kind, data, at) => events.push({ kind, ...data, at }),
        atNow: () => ({ sec: roundCombatTime(startSec + offset), day: 1, phase: 'morning' }),
        publishActionFrame: async ({ survivorMap }) => {
          assert.ok(frames.length < 1000, 'Combat must not stall at the same time.');
          const frame = { sec: roundCombatTime(startSec + offset), roster: structuredClone([...survivorMap.values()]) };
          frames.push(frame); onFrame(frame);
        },
      } });
  });
  const result = await promise;
  return { ...result, events, frames, times: (id, type = 'basic') => events.filter((event) => event.kind === 'damage'
    && event.who === id && event.type === type).map((event) => event.at.sec) };
}
