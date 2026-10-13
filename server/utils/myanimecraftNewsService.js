const { validateSnapshot, buildFacts, headlines, validatePlan, snapshotHash } = require('./myanimecraftNewsFacts');
const { createVertexNewsProvider } = require('./myanimecraftNewsProvider');

function defaultStore() {
  const model = require('../models/MyAnimecraftNews');
  return {
    async claim(scope) {
      try { const row = await model.create({ ...scope, expiresAt: new Date(Date.now() + 90 * 86400000) }); return { owned: true, row: row.toObject() }; }
      catch (e) { if (e.code !== 11000) throw e; return { owned: false, row: await model.findOne(scope).lean() }; }
    },
    async complete(scope, result) { await model.updateOne({ ...scope, status: 'pending' }, { $set: { status: 'ready', result } }); },
  };
}
async function defaultQuota(userId, env) {
  const { consumeRateLimit, positiveInt } = require('./rateLimit');
  // Both counters are persistent/atomic; only the unique request owner reaches this point.
  const user = await consumeRateLimit({ scope: 'myanime-news-user', subject: userId,
    limit: positiveInt(env.MYANIMECRAFT_NEWS_DAILY_LIMIT, 12), windowMs: 86400000 });
  if (!user.allowed) return false;
  const global = await consumeRateLimit({ scope: 'myanime-news-global', subject: 'all',
    limit: positiveInt(env.MYANIMECRAFT_NEWS_GLOBAL_DAILY_LIMIT, 100), windowMs: 86400000 });
  return global.allowed;
}
function createNewsService({ env = process.env, provider = createVertexNewsProvider({ env }), store, quota = defaultQuota, now = Date.now } = {}) {
  const inFlight = new Map();
  async function execute(userId, snapshot) {
    if (typeof userId !== 'string' || !userId.length || userId.length > 160) { const e = new Error('로그인이 필요합니다.'); e.status = 401; throw e; }
    const s = validateSnapshot(snapshot), facts = buildFacts(s);
    const requestKey = snapshotHash({ version: 'news-editor-v1', snapshot: s });
    const base = { careerId: s.careerId, seasonNo: s.seasonNo, edition: s.edition,
      recordsRevision: s.recordsRevision, factsHash: requestKey, source: 'template',
      plan: { headlineIndex: 0, factIds: facts.map((f) => f.id) } };
    if (env.MYANIMECRAFT_NEWS_VERTEX_ENABLED !== 'true') return { ...base, reason: 'disabled' };
    const scope = { userId, careerId: s.careerId, requestKey };
    const key = JSON.stringify(scope);
    if (inFlight.has(key)) return inFlight.get(key);
    // Bound memory even if a caller floods distinct authenticated requests while DB is slow.
    if (inFlight.size >= 64) return { ...base, reason: 'busy' };
    const job = (async () => {
      const persistence = store || defaultStore();
      let claim;
      try { claim = await persistence.claim(scope); }
      catch { return { ...base, reason: 'store-unavailable' }; }
      if (!claim.owned) {
        if (claim.row?.status === 'ready' && claim.row.result) return claim.row.result;
        // A crashed owner is never blindly retried: it may already have incurred a charge.
        if (claim.row && now() - new Date(claim.row.createdAt).getTime() > 60000) {
          const result = { ...base, reason: 'interrupted' };
          await persistence.complete(scope, result).catch(() => {});
          return result;
        }
        return { ...base, reason: 'pending' };
      }
      let result;
      try {
        if (!await quota(userId, env)) result = { ...base, reason: 'quota' };
        else {
          const generated = await provider.generate({ facts, headlines: headlines(s) });
          const plan = validatePlan(generated.plan, facts);
          result = { ...base, source: 'vertex', plan, model: generated.model, usage: generated.usage };
        }
      } catch { result = { ...base, reason: 'unavailable' }; }
      // A failed write does not authorize another paid call on this request.
      await persistence.complete(scope, result).catch(() => {});
      return result;
    })();
    inFlight.set(key, job);
    try { return await job; } finally { inFlight.delete(key); }
  }
  return { generate: execute };
}
module.exports = { createNewsService, defaultQuota };
