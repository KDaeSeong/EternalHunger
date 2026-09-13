// The active source exists only during a synchronous engine step. In particular,
// never leave it installed while awaiting a render, timer, or another match.
// Shared helpers retain native randomness when called outside a simulation.
let activeSource = null;

export function getActiveSimulationRandom() {
  return activeSource;
}

export function simulationRandom() {
  return activeSource ? activeSource() : Math.random();
}

export function simulationRandomId(prefix) {
  if (typeof activeSource?.nextId === 'function') return activeSource.nextId(prefix);
  return `${prefix}_${Date.now()}_${Math.floor(simulationRandom() * 1e9)}`;
}

export function withSimulationRandom(source, step) {
  if (source !== null && typeof source !== 'function') throw new TypeError('A simulation random source must be a function or null.');
  const previous = activeSource;
  activeSource = source;
  try {
    const result = step();
    if (typeof result?.then === 'function') throw new TypeError('A random-scoped step must be synchronous; use runSimulationSteps for async work.');
    return result;
  } finally {
    activeSource = previous;
  }
}

// Generator yields mark display/I/O boundaries. Each continuation (including
// error handling and finally blocks) runs with its own match's random source.
export async function runSimulationSteps(source, iterator) {
  let method = 'next';
  let value;
  while (true) {
    const step = withSimulationRandom(source, () => iterator[method](value));
    if (step.done) return step.value;
    try {
      value = await step.value;
      method = 'next';
    } catch (error) {
      value = error;
      method = 'throw';
    }
  }
}
