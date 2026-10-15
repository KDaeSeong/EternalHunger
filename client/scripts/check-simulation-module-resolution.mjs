import assert from 'node:assert/strict';
import * as moduleApi from 'node:module';
import { resolve } from './lib/simulation-module-resolution.mjs';

let checks = 0;
function check(name, callback) {
  callback();
  checks += 1;
  console.log(`PASS ${name}`);
}

async function checkAsync(name, callback) {
  await callback();
  checks += 1;
  console.log(`PASS ${name}`);
}

const context = { parentURL: 'file:///resolution-check/entry.mjs', conditions: ['node', 'import'], importAttributes: {} };
const success = { url: 'file:///success.js' };
const missing = Object.assign(new Error('missing'), { code: 'ERR_MODULE_NOT_FOUND' });

check('sync original success', () => {
  let calls = 0;
  const result = resolve('./item', context, (specifier, forwardedContext) => { calls += 1; assert.equal(specifier, './item'); assert.equal(forwardedContext, context); return success; });
  assert.equal(result, success);
  assert.equal(calls, 1);
});

await checkAsync('async original success', async () => {
  let calls = 0;
  const result = await resolve('./item', context, (specifier, forwardedContext) => { calls += 1; assert.equal(specifier, './item'); assert.equal(forwardedContext, context); return Promise.resolve(success); });
  assert.equal(result, success);
  assert.equal(calls, 1);
});

for (const specifier of ['./item', '../item']) {
  check(`sync extension retry ${specifier}`, () => {
    const calls = [];
    const result = resolve(specifier, context, (value, forwardedContext) => {
      assert.equal(forwardedContext, context);
      calls.push(value);
      if (value === specifier) throw missing;
      return success;
    });
    assert.equal(result, success);
    assert.deepEqual(calls, [specifier, `${specifier}.js`]);
  });
  await checkAsync(`async extension retry ${specifier}`, async () => {
    const calls = [];
    const result = await resolve(specifier, context, (value, forwardedContext) => {
      assert.equal(forwardedContext, context);
      calls.push(value);
      return value === specifier ? Promise.reject(missing) : Promise.resolve(success);
    });
    assert.equal(result, success);
    assert.deepEqual(calls, [specifier, `${specifier}.js`]);
  });
}

for (const specifier of ['package-name', './item.js', './item.mjs', './item.json', 'file:///item']) {
  check(`sync non-retry ${specifier}`, () => {
    let calls = 0;
    assert.throws(() => resolve(specifier, context, () => { calls += 1; throw missing; }), error => error === missing);
    assert.equal(calls, 1);
  });
  await checkAsync(`async non-retry ${specifier}`, async () => {
    let calls = 0;
    await assert.rejects(resolve(specifier, context, () => { calls += 1; return Promise.reject(missing); }), error => error === missing);
    assert.equal(calls, 1);
  });
}

for (const failure of [Object.assign(new Error('denied'), { code: 'EACCES' }), Object.assign(new Error('directory'), { code: 'ERR_UNSUPPORTED_DIR_IMPORT' })]) {
  check(`sync non-retry ${failure.code}`, () => {
    let calls = 0;
    assert.throws(() => resolve('./item', context, () => { calls += 1; throw failure; }), error => error === failure);
    assert.equal(calls, 1);
  });
  await checkAsync(`async non-retry ${failure.code}`, async () => {
    let calls = 0;
    await assert.rejects(resolve('./item', context, () => { calls += 1; return Promise.reject(failure); }), error => error === failure);
    assert.equal(calls, 1);
  });
}

for (const asyncMode of [false, true]) {
  const label = asyncMode ? 'async' : 'sync';
  await checkAsync(`${label} suffix failure preserved`, async () => {
    let calls = 0;
    const suffixError = new Error('suffix failed');
    const nextResolve = specifier => {
      calls += 1;
      if (specifier === './item') return asyncMode ? Promise.reject(missing) : (() => { throw missing; })();
      return asyncMode ? Promise.reject(suffixError) : (() => { throw suffixError; })();
    };
    await assert.rejects(Promise.resolve().then(() => resolve('./item', context, nextResolve)), error => error === suffixError);
    assert.equal(calls, 2);
  });
}

await import('./lib/register-simulation-modules.mjs');
const { createInitialSimulationFrame } = await import('../src/app/simulation/_lib/simulationFrameRuntime');
const frame = createInitialSimulationFrame();
assert.ok(frame && typeof frame === 'object');
assert.equal(frame.phase, 'night');
assert.equal(frame.day, 0);
assert.ok(Array.isArray(frame.survivors));
checks += 1;
console.log('PASS registered extensionless runtime import and frame fields');

console.log(`RESULT checks=${checks} node=${process.version} branch=${typeof moduleApi.registerHooks === 'function' ? 'registerHooks' : typeof moduleApi.register === 'function' ? 'register' : 'unsupported'}`);
