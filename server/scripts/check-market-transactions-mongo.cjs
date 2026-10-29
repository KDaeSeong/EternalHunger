const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, '.local/code-audit/mongo-market');
fs.mkdirSync(output, { recursive: true });
assert.equal(fs.realpathSync(output), output);
const binary = path.resolve(process.env.EH_MARKET_MONGOD || path.join(output, 'runtime/bin/mongod.exe'));
// The default is the official Windows MongoDB 8.0.30 binary. A different official
// binary needs an explicit expected checksum instead of trusting prior test output.
const expectedHash = process.env.EH_MARKET_MONGOD_SHA256 || '518304b8dd5130e38cb6b42a1c93e124ec745f1e16d1dccca6986449066f5834';
assert.match(expectedHash, /^[a-f0-9]{64}$/i);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex'), expectedHash.toLowerCase());
const nonce = crypto.randomBytes(6).toString('hex');
const fixtureRoot = path.join(output, `fixture-${nonce}`);
const dataPath = path.join(fixtureRoot, 'data');
fs.mkdirSync(dataPath, { recursive: true });
assert.equal(fs.realpathSync(fixtureRoot), fixtureRoot);
assert.equal(fs.realpathSync(dataPath), dataPath);
const { MongoClient } = require(path.join(root, 'server/node_modules/mongoose')).mongo;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
(async () => {
  const port = await unusedPort();
  const replicaSet = `eh_market_fixture_${nonce}`;
  const manifest = { createdUtc: new Date().toISOString(), fixtureRoot, dataPath, port, replicaSet,
    binary, binarySha256: expectedHash, purpose: 'Isolated market settlement regression, no public connection' };
  const manifestPath = path.join(fixtureRoot, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const args = ['--dbpath', dataPath, '--bind_ip', '127.0.0.1', '--port', String(port),
    '--replSet', replicaSet, '--wiredTigerCacheSizeGB', '0.25', '--logpath', path.join(fixtureRoot, 'mongod.log'),
    '--setParameter', 'diagnosticDataCollectionEnabled=false'];
  const mongo = spawn(binary, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  manifest.pid = mongo.pid;
  manifest.arguments = args;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  let exited = false;
  let exitCode;
  const mongoExit = new Promise(resolve => {
    mongo.once('error', error => { exited = true; exitCode = error.message; resolve(); });
    mongo.once('exit', (code, signal) => { exited = true; exitCode = code ?? signal; resolve(); });
  });
  let consoleOutput = '';
  for (const stream of [mongo.stdout, mongo.stderr]) stream.on('data', bytes => { consoleOutput += bytes.toString(); });
  const localUri = `mongodb://127.0.0.1:${port}/?replicaSet=${replicaSet}`;
  let admin;
  const receipt = { startedUtc: manifest.createdUtc, fixtureRoot, pid: mongo.pid, port, replicaSet, pass: false };
  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (exited) throw new Error(`Owned mongod exited during startup: ${exitCode}`);
      const client = new MongoClient(localUri, { directConnection: true, serverSelectionTimeoutMS: 400 });
      try { await client.connect(); admin = client; break; }
      catch { await client.close(); await sleep(250); }
    }
    if (!admin) throw new Error('Owned mongod did not start within the bounded wait');
    await admin.db('admin').command({ replSetInitiate: { _id: replicaSet,
      members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    let primary = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await admin.db('admin').command({ hello: 1 })).isWritablePrimary) { primary = true; break; }
      await sleep(200);
    }
    assert.ok(primary, 'Owned replica set must become writable');
    const test = spawn(process.execPath, ['server/tests/integration/market-transactions-mongo.mjs'], {
      cwd: root, windowsHide: true, env: { ...process.env, EH_TEST_MONGO_URI: localUri,
        EH_MARKET_FIXTURE_ROOT: fixtureRoot }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let testOutput = '';
    test.stdout.on('data', bytes => { testOutput += bytes; });
    test.stderr.on('data', bytes => { testOutput += bytes; });
    const timer = setTimeout(() => test.kill(), 180000);
    const testCode = await new Promise((resolve, reject) => { test.once('error', reject); test.once('exit', resolve); });
    clearTimeout(timer);
    fs.writeFileSync(path.join(fixtureRoot, 'test-output.log'), testOutput);
    receipt.testExitCode = testCode;
    const row = testOutput.split(/\r?\n/).find(line => line.startsWith('MONGO_MARKET_CHECKS '));
    if (row) receipt.result = JSON.parse(row.slice('MONGO_MARKET_CHECKS '.length));
    if (testCode !== 0 || !receipt.result?.pass) throw new Error(`Market integration failed; inspect ${path.relative(root, fixtureRoot)}/test-output.log`);
    receipt.pass = true;
  } catch (error) {
    receipt.error = error.message;
    process.exitCode = 1;
  } finally {
    if (admin) {
      try { await admin.db('admin').command({ shutdown: 1, force: true }); }
      catch (error) { if (error.name !== 'MongoNetworkError' && !exited) receipt.shutdownMessage = error.message; }
      await admin.close();
    }
    if (!exited) await Promise.race([mongoExit, sleep(15000)]);
    if (!exited) {
      receipt.ownedChildForcedStop = true;
      mongo.kill();
      await Promise.race([mongoExit, sleep(5000)]);
    }
    receipt.stopped = exited;
    receipt.mongoExitCode = exitCode;
    if (!exited) { receipt.pass = false; receipt.error = 'Owned MongoDB process still running'; process.exitCode = 1; }
    receipt.finishedUtc = new Date().toISOString();
    fs.writeFileSync(path.join(fixtureRoot, 'console.log'), consoleOutput);
    fs.writeFileSync(path.join(fixtureRoot, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
    fs.writeFileSync(path.join(output, 'latest-integration.json'), JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify(receipt, null, 2));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
