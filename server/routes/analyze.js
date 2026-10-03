const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const { consumeRateLimit, positiveInt } = require('../utils/rateLimit');

const router = express.Router();
const ANALYZE_WINDOW_MS = positiveInt(process.env.ANALYZE_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);
const ANALYZE_MAX_REQUESTS = positiveInt(process.env.ANALYZE_RATE_LIMIT_MAX, 12);
const ANALYZE_MAX_TEXT_LENGTH = positiveInt(process.env.ANALYZE_MAX_TEXT_LENGTH, 3000);
// gemini-2.0-flash was shut down on 2026-06-01; Google's listed replacement is the default.
const DEFAULT_ANALYZE_MODEL = 'gemini-3.6-flash';

// The model's JSON is untrusted input: keep only known stats inside their ranges.
const STAT_RANGES = {
  maxHp: [1, 999], hpGrowth: [0, 20], attackPower: [0, 200], attackPowerGrowth: [0, 20],
  skillAmp: [0, 200], skillAmpGrowth: [0, 20], defense: [0, 200], defenseGrowth: [0, 20],
  attackSpeed: [0.1, 3], attackSpeedGrowth: [0, 1], attackRange: [0.5, 10], sightRange: [1, 20],
};

function sanitizeAnalysis(output) {
  if (!output || typeof output !== 'object' || !output.stats || typeof output.stats !== 'object') return null;
  const stats = {};
  for (const [key, [min, max]] of Object.entries(STAT_RANGES)) {
    const value = Number(output.stats[key]);
    if (Number.isFinite(value)) stats[key] = Math.min(max, Math.max(min, value));
  }
  if (!Object.keys(stats).length) return null;
  const gender = output.gender === '남' || output.gender === '여' ? output.gender : '';
  return { name: String(output.name || '').trim().slice(0, 40), gender, stats };
}

function cleanAnalyzeText(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim();
}

router.post('/', async (req, res) => {
  const text = cleanAnalyzeText(req.body?.text);
  if (!text) {
    return res.status(400).json({ error: '분석할 텍스트를 입력해주세요.' });
  }
  if (text.length > ANALYZE_MAX_TEXT_LENGTH) {
    return res.status(413).json({
      error: `분석 텍스트는 ${ANALYZE_MAX_TEXT_LENGTH.toLocaleString('ko-KR')}자 이내로 입력해주세요.`,
    });
  }
  if (!String(process.env.GOOGLE_API_KEY || '').trim()) {
    return res.status(503).json({
      error: 'AI 분석 서비스가 설정되지 않았습니다.',
      code: 'AI_NOT_CONFIGURED',
    });
  }

  try {
    const rate = await consumeRateLimit({
      scope: 'ai:analyze',
      subject: `user:${req.user?.id || req.ip || 'unknown'}`,
      limit: ANALYZE_MAX_REQUESTS,
      windowMs: ANALYZE_WINDOW_MS,
    });
    if (!rate.allowed) {
      res.set('Retry-After', String(rate.retryAfterSec));
      return res.status(429).json({
        error: `AI 분석 요청이 너무 잦습니다. ${rate.retryAfterSec}초 후 다시 시도해주세요.`,
        code: 'RATE_LIMITED',
        retryAfterSec: rate.retryAfterSec,
      });
    }
  } catch (error) {
    console.error('analyze rate limit unavailable:', error);
    return res.status(503).json({
      error: 'AI 요청 보호 서비스를 사용할 수 없습니다.',
      code: 'RATE_LIMIT_UNAVAILABLE',
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
    const prompt = `Analyze character: "${text}". Return JSON ONLY: { "name": "Name", "gender": "남/여", "stats": { "maxHp":1-999,"hpGrowth":0-20,"attackPower":0-200,"attackPowerGrowth":0-20,"skillAmp":0-200,"skillAmpGrowth":0-20,"defense":0-200,"defenseGrowth":0-20,"attackSpeed":0.1-3,"attackSpeedGrowth":0-1,"attackRange":0.5-10,"sightRange":1-20 } }`;
    const result = await ai.models.generateContent({
      model: process.env.GOOGLE_AI_MODEL || DEFAULT_ANALYZE_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    const output = sanitizeAnalysis(JSON.parse(String(result.text || '').replace(/```json|```/g, '').trim()));
    if (!output) throw new Error('AI response schema is invalid');
    return res.json(output);
  } catch (error) {
    console.error('AI analyze upstream failed:', error);
    return res.status(502).json({
      error: 'AI 분석 서비스 응답을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.',
      code: 'AI_UPSTREAM_FAILURE',
    });
  }
});

module.exports = router;
