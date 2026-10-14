import { createSimulationPhaseWorkerRuntime } from './simulationPhaseWorkerRuntime.js';

const runtime = createSimulationPhaseWorkerRuntime({ send: (message) => globalThis.postMessage(message) });
globalThis.addEventListener('message', (event) => { void runtime.receive(event.data); });
globalThis.postMessage({ kind: 'ready' });
