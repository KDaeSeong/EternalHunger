const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const express = require('express');

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  try {
    if (!server.listening) await new Promise((resolve, reject) => {
      server.once('listening', resolve); server.once('error', reject);
    });
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally { await new Promise(resolve => server.close(resolve)); }
}

for (const configured of [false, true]) {
  test(`retired endpoints return 410 with provider key ${configured ? 'present' : 'absent'} and never load a provider`, async () => {
    const previousKey = process.env.GOOGLE_API_KEY;
    const originalLoad = Module._load;
    let providerLoads = 0;
    if (configured) process.env.GOOGLE_API_KEY = 'test-only-retired-feature';
    else delete process.env.GOOGLE_API_KEY;
    Module._load = function(request, ...args) {
      if (request === '@google/genai' || /characterSetupService|erCharacterSource/.test(request)) {
        providerLoads += 1; throw new Error('Retired provider path must never load');
      }
      return originalLoad.call(this, request, ...args);
    };
    const routePath = require.resolve('../routes/analyze');
    delete require.cache[routePath];
    try {
      const app = express(); app.use(express.json()); app.use('/api/analyze', require(routePath));
      await withServer(app, async base => {
        for (const endpoint of ['', '/character-setup']) {
          for (const body of [{}, { text: 'retired request', mode: 'custom', name: '검증' }]) {
            const response = await fetch(`${base}/api/analyze${endpoint}`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            assert.equal(response.status, 410);
            const result = await response.json();
            assert.equal(result.code, 'AI_FEATURE_RETIRED');
            assert.doesNotMatch(JSON.stringify(result), /test-only|apiKey|retryAfter/);
          }
        }
      });
      assert.equal(providerLoads, 0);
    } finally {
      Module._load = originalLoad;
      delete require.cache[routePath];
      if (previousKey === undefined) delete process.env.GOOGLE_API_KEY;
      else process.env.GOOGLE_API_KEY = previousKey;
    }
  });
}

test('mounted retired endpoints preserve authentication and cookie CSRF gates', async () => {
  const { app } = require('../index');
  await withServer(app, async base => {
    for (const endpoint of ['', '/character-setup']) {
      for (const [headers, status, code] of [
        [{}, 401, 'AUTH_REQUIRED'],
        [{ Cookie: 'token=test-only-invalid-token; eh_csrf=test-only-csrf' }, 403, 'CSRF_INVALID'],
        [{ Cookie: 'token=test-only-invalid-token; eh_csrf=test-only-csrf', 'x-csrf-token': 'test-only-csrf' }, 401, 'AUTH_TOKEN_INVALID'],
      ]) {
        const response = await fetch(`${base}/api/analyze${endpoint}`, { method: 'POST', headers });
        assert.equal(response.status, status); assert.equal((await response.json()).code, code);
      }
    }
  });
});

test('mounted authenticated retirement and saved authored character reads remain independent', async () => {
  const jwt = require('jsonwebtoken');
  const User = require('../models/User');
  const Character = require('../models/Characters');
  const { app } = require('../index');
  const priorSecret = process.env.MY_SECRET_KEY;
  const priorUserFind = User.findById, priorCharacterFind = Character.find;
  const userId = '507f1f77bcf86cd799439011';
  const authored = [{ _id: '507f1f77bcf86cd799439012', userId, name: '직접 작성', summary: '보존된 설정', stats: { maxHp: 101 } }];
  process.env.MY_SECRET_KEY = 'test-only-retirement-secret';
  User.findById = () => ({ select: () => ({ lean: async () => ({ _id: userId, tokenVersion: 0 }) }) });
  Character.find = filter => {
    assert.equal(String(filter.userId), userId);
    const query = { sort: () => query, select: () => query, lean: async () => structuredClone(authored) };
    return query;
  };
  try {
    const token = jwt.sign({ id: userId, tokenVersion: 0 }, process.env.MY_SECRET_KEY);
    await withServer(app, async base => {
      for (const endpoint of ['', '/character-setup']) {
        const response = await fetch(`${base}/api/analyze${endpoint}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        assert.equal(response.status, 410); assert.equal((await response.json()).code, 'AI_FEATURE_RETIRED');
      }
      const response = await fetch(`${base}/api/characters`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 200); assert.deepEqual(await response.json(), authored);
    });
  } finally {
    User.findById = priorUserFind; Character.find = priorCharacterFind;
    if (priorSecret === undefined) delete process.env.MY_SECRET_KEY;
    else process.env.MY_SECRET_KEY = priorSecret;
  }
});
