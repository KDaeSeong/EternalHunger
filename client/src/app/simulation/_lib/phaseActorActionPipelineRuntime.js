import { runDay1HeroGearDirectorWithLogs } from './phaseRouteProgressRuntime';
import { runSingleActorPhaseAction } from './phaseActorActionStepRuntime';

function buildBaseZonePopulation(phaseSurvivors) {
  const baseZonePop = {};
  (Array.isArray(phaseSurvivors) ? phaseSurvivors : []).forEach((survivor) => {
    if (!survivor || Number(survivor.hp || 0) <= 0) return;
    const zoneId = String(survivor.zoneId || '');
    if (!zoneId) return;
    baseZonePop[zoneId] = (baseZonePop[zoneId] || 0) + 1;
  });
  return baseZonePop;
}

export function runPhaseActorActionPipeline({
  state = {},
  actions = {},
} = {}) {
  const {
    itemMetaById,
    itemNameById,
    nextDay = 1,
    nextPhase = 'morning',
    pendingPickAssigned: initialPendingPickAssigned = false,
    phaseSurvivors = [],
    publicItems = [],
    ruleset,
  } = state;
  const {
    addLog = () => {},
  } = actions;

  const baseZonePop = buildBaseZonePopulation(phaseSurvivors);
  const newlyDead = [];
  let pendingPickAssigned = initialPendingPickAssigned;

  const runDay1HeroGear = (actor, options) => runDay1HeroGearDirectorWithLogs({
    state: { actor, publicItems, itemNameById, itemMetaById, day: nextDay, phase: nextPhase, ruleset },
    actions: { addLog },
    options,
  });

  const updatedSurvivors = (Array.isArray(phaseSurvivors) ? phaseSurvivors : [])
    .map((sourceActor) => {
      const actorStepResult = runSingleActorPhaseAction({
        actions: {
          ...actions,
          runDay1HeroGear,
        },
        sourceActor,
        state: {
          ...state,
          baseZonePop,
          pendingPickAssigned,
        },
      });

      pendingPickAssigned = actorStepResult.pendingPickAssigned;
      if (Array.isArray(actorStepResult.newlyDead) && actorStepResult.newlyDead.length) {
        newlyDead.push(...actorStepResult.newlyDead);
      }
      return actorStepResult.actor;
    })
    .filter((survivor) => Number(survivor?.hp || 0) > 0);

  return {
    newlyDead,
    pendingPickAssigned,
    updatedSurvivors,
  };
}
