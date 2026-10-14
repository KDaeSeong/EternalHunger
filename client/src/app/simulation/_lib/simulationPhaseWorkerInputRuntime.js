import { SIMULATION_FRAME_FIELDS } from './simulationFrameRuntime.js';
import { restoreSeedRng } from './randomSeedRuntime.js';

const UI_FIELDS = ['autoSpeed', 'selectedCharId', 'showMarketPanel', 'pendingTranscendPick'];
const REF_STATE_FIELDS = [
  ['startStarterLoadoutApplied', 'startStarterLoadoutAppliedRef'],
  ['suddenDeathActive', 'suddenDeathActiveRef'],
  ['suddenDeathEndAtSec', 'suddenDeathEndAtSecRef'],
  ['suddenDeathForbiddenAnnounced', 'suddenDeathForbiddenAnnouncedRef'],
];

function captureRefState(refs = {}) {
  return Object.fromEntries(REF_STATE_FIELDS.map(([field, ref]) => [field, refs[ref]?.current]));
}

function readRandomState(refs = {}) {
  return refs.runRandomRef?.current?.getState?.() || null;
}

export function createSimulationPhaseWorkerCommand({ input, state = {}, refs = {} } = {}) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('A prepared simulation run input is required for a phase worker command.');
  }
  const frame = Object.fromEntries(SIMULATION_FRAME_FIELDS
    .filter((field) => field in state)
    .map((field) => [field, state[field]]));
  const ui = Object.fromEntries(UI_FIELDS.map((field) => [field, state[field]]));
  const random = readRandomState(refs);
  return {
    input,
    frame,
    ui,
    refState: captureRefState(refs),
    random,
    logEntries: refs.fullLogEntriesRef?.current ?? [],
  };
}

export function restoreSimulationPhaseWorkerOptions(command = {}, prepared) {
  if (!prepared?.state || !prepared?.helpers) {
    throw new TypeError('Prepared simulation worker input is required.');
  }
  const refState = command.refState || {};
  const random = command.random ? restoreSeedRng(command.random) : null;
  return {
    state: { ...prepared.state, ...(command.frame || {}), ...(command.ui || {}) },
    refs: {
      activeMapRef: { current: prepared.state.activeMap },
      activeMapIdRef: { current: prepared.state.activeMapId },
      startStarterLoadoutAppliedRef: { current: refState.startStarterLoadoutApplied },
      suddenDeathActiveRef: { current: refState.suddenDeathActive },
      suddenDeathEndAtSecRef: { current: refState.suddenDeathEndAtSec },
      suddenDeathForbiddenAnnouncedRef: { current: refState.suddenDeathForbiddenAnnounced },
      fullLogEntriesRef: { current: command.logEntries ?? [] },
      autoSpeedRef: { current: command.ui?.autoSpeed },
      runRandomRef: { current: random },
    },
    helpers: prepared.helpers,
  };
}

export function captureSimulationPhaseWorkerRefState(refs = {}) {
  return { ...captureRefState(refs), random: readRandomState(refs) };
}

export function applySimulationPhaseWorkerRefState(snapshot = {}, refs = {}) {
  for (const [field, ref] of REF_STATE_FIELDS) {
    if (refs[ref]) refs[ref].current = snapshot[field];
  }
  if (refs.runRandomRef) refs.runRandomRef.current = snapshot.random ? restoreSeedRng(snapshot.random) : null;
}
