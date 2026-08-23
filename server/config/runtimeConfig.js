function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function parseAllowedOrigins(raw, nodeEnv = process.env.NODE_ENV) {
  const configured = String(raw || '')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (configured.length) return new Set(configured);
  if (nodeEnv === 'production') return new Set();
  return new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);
}

function buildCorsOptions(env = process.env) {
  const allowed = parseAllowedOrigins(env.CORS_ORIGINS, env.NODE_ENV);
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowed.has(String(origin).replace(/\/$/, ''))) return callback(null, true);
      const error = new Error('허용되지 않은 Origin입니다.');
      error.code = 'CORS_ORIGIN_DENIED';
      return callback(error);
    },
  };
}

function validateRuntimeEnv(env = process.env) {
  const missing = ['MONGO_URI', 'MY_SECRET_KEY'].filter((key) => !String(env[key] || '').trim());
  if (missing.length) throw new Error(`필수 환경변수가 없습니다: ${missing.join(', ')}`);
  if (String(env.MY_SECRET_KEY).length < 32) throw new Error('MY_SECRET_KEY는 32자 이상이어야 합니다.');
  return true;
}

function getHttpConfig(env = process.env) {
  return {
    port: positiveInt(env.PORT, 5000),
    jsonBodyLimit: String(env.JSON_BODY_LIMIT || '2mb'),
    trustProxy: Number.isFinite(Number(env.TRUST_PROXY_HOPS))
      ? Math.max(0, Math.floor(Number(env.TRUST_PROXY_HOPS)))
      : 0,
  };
}

module.exports = { buildCorsOptions, getHttpConfig, parseAllowedOrigins, positiveInt, validateRuntimeEnv };
