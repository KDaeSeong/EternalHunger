const path = require('node:path');
const { Worker } = require('node:worker_threads');

function loadExchangeEngine(modulePath = path.join(__dirname, '../generated/myanimecraftZero.cjs')) {
  let bundle;
  try { bundle = require(modulePath); } catch { return null; }
  if (!bundle.engineVersion || !bundle.buildHash || typeof bundle.simulate !== 'function') return null;
  let active = 0;
  return { engineVersion: bundle.engineVersion, buildHash: bundle.buildHash,
    simulate(input) {
      if (active >= 2) return Promise.reject(new Error('ENGINE_BUSY'));
      active += 1;
      return new Promise((resolve, reject) => {
        let done = false;
        let worker;
        try { worker = new Worker(`const {parentPort,workerData}=require('node:worker_threads');
          Promise.resolve().then(()=>require(workerData.modulePath).simulate(workerData.input))
            .then(value=>parentPort.postMessage({value}),error=>parentPort.postMessage({error:String(error)}));`,
          { eval: true, workerData: { modulePath, input }, resourceLimits: { maxOldGenerationSizeMb: 192 } }); }
        catch (error) { active -= 1; reject(error); return; }
        const finish = (error, value) => { if (done) return; done = true; active -= 1; clearTimeout(timer); worker.terminate(); error ? reject(error) : resolve(value); };
        const timer = setTimeout(() => finish(new Error('ENGINE_TIMEOUT')), 20000);
        worker.on('message', message => finish(message.error ? new Error(message.error) : null, message.value));
        worker.on('error', error => finish(error));
        worker.on('exit', () => { if (!done) finish(new Error('ENGINE_EXIT')); });
      });
    } };
}
module.exports = { loadExchangeEngine };
