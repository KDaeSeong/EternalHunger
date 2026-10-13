const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { parseCookies, CSRF_COOKIE } = require('../utils/authPolicy');
const { createExchangeService } = require('../utils/myanimecraftExchangeService');
const { createMongoRepository } = require('../utils/myanimecraftExchangeRepository');
const { loadExchangeEngine } = require('../utils/myanimecraftExchangeEngine');

function createRouter({ service, authenticate = verifyToken } = {}) {
  const router = express.Router();
  // Defense in depth if this router is mounted without the app-wide body limit.
  router.use(express.json({ limit: '128kb' }));
  router.use(authenticate);
  const rate = new Map();
  router.use((req, res, next) => {
    const now = Date.now(), userId = String(req.user.id), bucket = rate.get(userId);
    if (!bucket || now - bucket.startedAt >= 60000) rate.set(userId, { startedAt: now, read: 0, write: 0, create: 0 });
    if (rate.size > 1000) for (const [key, value] of rate) if (now - value.startedAt >= 60000) rate.delete(key);
    const current = rate.get(userId), kind = req.method === 'GET' ? 'read' : req.path === '/rooms' ? 'create' : 'write';
    current[kind] += 1;
    if (current[kind] > ({ read: 240, write: 30, create: 6 })[kind]) return res.status(429).json({ code: 'EXCHANGE_RATE_LIMIT', error: '요청이 너무 빠르답니다. 잠시 뒤 다시 시도하시와요.' });
    return next();
  });
  let defaultService;
  const getService = () => {
    if (service) return service;
    if (!defaultService) {
      if (!process.env.MY_SECRET_KEY) { const error = new Error('교류전 서버 인증 설정이 준비되지 않았사와요.'); error.status = 503; throw error; }
      defaultService = createExchangeService({ repository: createMongoRepository(require('../models/MyAnimecraftExchangeRoom')),
        engine: loadExchangeEngine(), inviteSecret: process.env.MY_SECRET_KEY });
    }
    return defaultService;
  };
  const action = fn => async (req, res) => {
    try {
      if (req.method === 'POST' && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) return res.status(400).json({ code: 'INVALID_REQUEST', error: '교류전 요청 형식을 확인하시와요.' });
      if (req.body && Buffer.byteLength(JSON.stringify(req.body)) > 128 * 1024) return res.status(413).json({ error: '교류전 요청 자료가 너무 크답니다.' });
      res.set('Cache-Control', 'no-store');
      const data = await fn(getService(), String(req.user.id), req);
      return res.json(data);
    } catch (error) { return res.status(error.status || 500).json({ code: error.code || 'EXCHANGE_UNAVAILABLE', error: error.status ? error.message : '교류전 서버가 요청을 처리하지 못했사와요. 연결 상태를 확인하시와요.' }); }
  };
  router.get('/session', action(async (s, userId, req) => ({ ...(await s.sessionInfo()), userId, csrfToken: parseCookies(req)[CSRF_COOKIE] || '' })));
  router.get('/rooms', action(async (s, userId) => ({ rooms: await s.list(userId) })));
  router.get('/rooms/:id', action(async (s, userId, req) => ({ room: await s.get(userId, req.params.id) })));
  router.post('/rooms', action(async (s, userId, req) => ({ room: await s.create(userId, req.body) })));
  router.post('/join', action(async (s, userId, req) => ({ room: await s.join(userId, req.body) })));
  router.post('/rooms/:id/confirm', action(async (s, userId, req) => ({ room: await s.confirm(userId, req.params.id, req.body) })));
  router.post('/rooms/:id/resolve', action(async (s, userId, req) => ({ room: await s.resolve(userId, req.params.id) })));
  return router;
}
module.exports = createRouter();
module.exports.createRouter = createRouter;
