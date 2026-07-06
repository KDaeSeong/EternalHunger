const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const analyzeRateBuckets = new Map();
const ANALYZE_WINDOW_MS = toPositiveInt(process.env.ANALYZE_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);
const ANALYZE_MAX_REQUESTS = toPositiveInt(process.env.ANALYZE_RATE_LIMIT_MAX, 12);
const ANALYZE_MAX_TEXT_LENGTH = toPositiveInt(process.env.ANALYZE_MAX_TEXT_LENGTH, 3000);

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function cleanAnalyzeText(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim();
}

function pruneAnalyzeBuckets(now) {
  if (analyzeRateBuckets.size < 500) return;
  for (const [key, bucket] of analyzeRateBuckets.entries()) {
    if (!bucket || bucket.resetAt <= now) analyzeRateBuckets.delete(key);
  }
}

function checkAnalyzeRateLimit(req) {
  const now = Date.now();
  const key = `user:${req.user?.id || req.user?._id || req.ip || 'unknown'}`;
  let bucket = analyzeRateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + ANALYZE_WINDOW_MS };
    analyzeRateBuckets.set(key, bucket);
  }
  pruneAnalyzeBuckets(now);
  if (bucket.count >= ANALYZE_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

router.post('/', async (req, res) => {
  try {
    const text = cleanAnalyzeText(req.body?.text);
    if (!text) {
      return res.status(400).json({ error: '분석할 텍스트를 입력해주세요.' });
    }
    if (text.length > ANALYZE_MAX_TEXT_LENGTH) {
      return res.status(413).json({ error: `분석 텍스트는 ${ANALYZE_MAX_TEXT_LENGTH.toLocaleString('ko-KR')}자 이내로 입력해주세요.` });
    }

    const rate = checkAnalyzeRateLimit(req);
    if (!rate.allowed) {
      res.set('Retry-After', String(rate.retryAfterSec));
      return res.status(429).json({
        error: `AI 분석 요청이 너무 잦습니다. ${rate.retryAfterSec}초 후 다시 시도해주세요.`,
        retryAfterSec: rate.retryAfterSec,
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `Analyze character: "${text}". Return JSON ONLY: { "name": "Name", "gender": "남/여", "stats": { "maxHp":1-999,"hpGrowth":0-20,"attackPower":0-200,"attackPowerGrowth":0-20,"skillAmp":0-200,"skillAmpGrowth":0-20,"defense":0-200,"defenseGrowth":0-20,"attackSpeed":0.1-3,"attackSpeedGrowth":0-1,"attackRange":0.5-10,"sightRange":1-20 } }`;
    const result = await model.generateContent(prompt);
    res.json(JSON.parse(result.response.text().replace(/```json|```/g, '').trim()));
  } catch {
    res.json({
      name: '분석실패',
      stats: {
        maxHp: 100,
        hpGrowth: 4,
        attackPower: 24,
        attackPowerGrowth: 1.4,
        skillAmp: 0,
        skillAmpGrowth: 1.1,
        defense: 14,
        defenseGrowth: 0.8,
        attackSpeed: 0.72,
        attackSpeedGrowth: 0.015,
        attackRange: 1.5,
        sightRange: 8,
      },
    });
  }
});

module.exports = router;
