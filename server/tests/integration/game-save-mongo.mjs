import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';

// Run against a disposable local replica set, never an account database:
// EH_TEST_MONGO_URI=mongodb://127.0.0.1:PORT/?replicaSet=test node tests/integration/game-save-mongo.mjs
const uri = process.env.EH_TEST_MONGO_URI || '';
if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(uri)) {
  throw new Error('EH_TEST_MONGO_URI must point to a disposable local MongoDB replica set.');
}
const require = createRequire(import.meta.url);
const mongoose = require('mongoose');
const GameLog = require('../../models/GameLog');
const Character = require('../../models/Characters');
const TeamRecord = require('../../models/TeamRecord');
const router = require('../../routes/game');
const handler = router.stack.find((layer) => layer.route?.path === '/end').route.stack[0].handle;
const dbName = 'eh_game_save_test_' + randomBytes(6).toString('hex');
await mongoose.connect(uri, { dbName });
const userId = new mongoose.Types.ObjectId();
async function call(body) {
  const res = { code: 200, body: null, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
  await handler({ body, user: { id: String(userId) } }, res); return res;
}
try {
  await Promise.all([GameLog.init(), Character.init(), TeamRecord.init()]);
  const chars = await Character.create([{ userId, name: '가' }, { userId, name: '나' }]);
  const [a, b] = chars.map((actor) => String(actor._id));
  const body = { clientRunId: 'mongo-race', winnerId: a, winnerTeamId: 't', matchMode: 'squad', teamSize: 2,
    killCounts: { [a]: 3 }, assistCounts: { [b]: 2 }, fullLogs: ['같은 완료 경기'], runEvents: [],
    participants: [{ _id: a, name: '가', teamId: 't', hp: 100 }, { _id: b, name: '나', teamId: 't', hp: 0 }] };
  const replies = await Promise.all(Array.from({ length: 8 }, () => call(body)));
  assert.ok(replies.every((reply) => reply.code === 200), JSON.stringify(replies));
  assert.equal(new Set(replies.map((reply) => String(reply.body.gameLogId))).size, 1);
  assert.equal(await GameLog.countDocuments(), 1);
  assert.equal((await Character.findById(a)).records.gamesPlayed, 1);
  assert.equal((await Character.findById(a)).records.totalKills, 3);
  assert.equal((await Character.findById(b)).records.totalAssists, 2);
  assert.equal((await TeamRecord.findOne({ userId })).gamesPlayed, 1);

  const bulkWrite = TeamRecord.bulkWrite;
  TeamRecord.bulkWrite = async () => { throw new Error('intentional rollback test'); };
  try { assert.equal((await call({ ...body, clientRunId: 'mongo-retry' })).code, 500); }
  finally { TeamRecord.bulkWrite = bulkWrite; }
  assert.equal(await GameLog.countDocuments(), 1, 'failed transactions must not leave a partial log');
  assert.equal((await Character.findById(a)).records.gamesPlayed, 1, 'character increments must roll back too');
  assert.equal((await TeamRecord.findOne({ userId })).gamesPlayed, 1);
  assert.equal((await call({ ...body, clientRunId: 'mongo-retry' })).code, 200);
  assert.equal((await call({ ...body, clientRunId: 'mongo-retry' })).code, 200);
  assert.equal(await GameLog.countDocuments(), 2);
  assert.equal((await Character.findById(a)).records.gamesPlayed, 2);
  assert.equal((await TeamRecord.findOne({ userId })).gamesPlayed, 2);

  const concurrent = await Promise.all(['mongo-distinct-1', 'mongo-distinct-2'].map((clientRunId) => call({ ...body, clientRunId })));
  assert.ok(concurrent.every((reply) => reply.code === 200));
  assert.equal(await GameLog.countDocuments(), 4);
  assert.equal((await Character.findById(a)).records.gamesPlayed, 4);
  assert.equal((await TeamRecord.findOne({ userId })).gamesPlayed, 4);
  const legacy = { ...body }; delete legacy.clientRunId;
  const old = await call(legacy), again = await call(Object.fromEntries(Object.entries(legacy).reverse()));
  assert.equal(old.code, 200); assert.equal(again.code, 200); assert.equal(String(old.body.gameLogId), String(again.body.gameLogId));
  assert.equal((await Character.findById(a)).records.gamesPlayed, 5);
  console.log('MONGO_GAME_SAVE_CHECKS ' + JSON.stringify({ pass: true, sameRunRequests: 8, distinctSavedGames: 5, rollback: true, legacyRetry: true }));
} finally {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
