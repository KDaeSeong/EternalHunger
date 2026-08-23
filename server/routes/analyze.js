const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { consumeRateLimit, positiveInt } = require('../utils/rateLimit');

const router = express.Router();
const ANALYZE_WINDOW_MS = positiveInt(process.env.ANALYZE_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);
const ANALYZE_MAX_REQUESTS = positiveInt(process.env.ANALYZE_RATE_LIMIT_MAX, 12);
const ANALYZE_MAX_TEXT_LENGTH = positiveInt(process.env.ANALYZE_MAX_TEXT_LENGTH, 3000);

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
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({
      model: process.env.GOOGLE_AI_MODEL || 'gemini-2.0-flash',
    });
    const prompt = `Analyze character: "${text}". Return JSON ONLY: { "name": "Name", "gender": "남/여", "stats": { "maxHp":1-999,"hpGrowth":0-20,"attackPower":0-200,"attackPowerGrowth":0-20,"skillAmp":0-200,"skillAmpGrowth":0-20,"defense":0-200,"defenseGrowth":0-20,"attackSpeed":0.1-3,"attackSpeedGrowth":0-1,"attackRange":0.5-10,"sightRange":1-20 } }`;
    const result = await model.generateContent(prompt);
    const output = JSON.parse(
      result.response.text().replace(/```json|```/g, '').trim(),
    );
    if (!output || typeof output !== 'object' || !output.stats || typeof output.stats !== 'object') {
      throw new Error('AI response schema is invalid');
    }
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
