import './register-simulation-modules.mjs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { parentPort, workerData } from 'node:worker_threads';

if (!parentPort) throw new Error('Simulation phase worker requires a parent port.');

const { createSimulationPhaseWorkerRuntime } = await import('../../src/app/simulation/_lib/simulationPhaseWorkerRuntime.js');
const finiteTransport = workerData?.finiteTransport === true;
const now = finiteTransport ? () => performance.now() : () => Number.NaN;
const onSourceFrame = finiteTransport ? (frame, receipt) => {
  const owned = structuredClone(frame);
  const sourceDigest = createHash('sha256').update(JSON.stringify(owned)).digest('hex');
  parentPort.postMessage({ kind: 'source-proof', sourceDigest,
    phaseId: receipt.phaseId, sourceIndex: receipt.sourceIndex,
    emitted: receipt.emitted === true, force: receipt.force === true,
    atMs: Number.isFinite(receipt.atMs) ? receipt.atMs : null });
} : null;
const runtime = createSimulationPhaseWorkerRuntime({
  send: (message) => parentPort.postMessage(message),
  now,
  wait: async () => {},
  taskYield: () => new Promise((resolve) => setImmediate(resolve)),
  onSourceFrame,
});

parentPort.on('message', (message) => { void runtime.receive(message); });
parentPort.postMessage({ kind: 'ready' });
