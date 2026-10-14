import './register-simulation-modules.mjs';
import { parentPort } from 'node:worker_threads';

if (!parentPort) throw new Error('Simulation phase worker requires a parent port.');

const { createSimulationPhaseWorkerRuntime } = await import('../../src/app/simulation/_lib/simulationPhaseWorkerRuntime.js');
const runtime = createSimulationPhaseWorkerRuntime({
  send: (message) => parentPort.postMessage(message),
  now: () => Number.NaN,
  wait: async () => {},
  taskYield: () => new Promise((resolve) => setImmediate(resolve)),
});

parentPort.on('message', (message) => { void runtime.receive(message); });
parentPort.postMessage({ kind: 'ready' });
