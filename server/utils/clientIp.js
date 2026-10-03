const crypto = require('crypto');

// Browser requests reach Express through the Next.js proxy (/api/proxy). Express
// then sees the proxy's address, so every user would share one rate-limit bucket.
// The proxy forwards the browser address in X-EH-Client-IP and proves it with a
// shared secret (PROXY_SHARED_SECRET on both Vercel and the API server).
const CLIENT_IP_HEADER = 'x-eh-client-ip';
const PROXY_AUTH_HEADER = 'x-eh-proxy-auth';
const PROXIED_HEADER = 'x-eh-proxied';

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function normalizeIp(value) {
  const ip = String(value || '').split(',')[0].trim().replace(/^::ffff:/, '');
  if (!ip || ip.length > 64) return '';
  return /^[0-9a-fA-F:.]+$/.test(ip) ? ip : '';
}

function proxySecret() {
  const secret = String(process.env.PROXY_SHARED_SECRET || '').trim();
  return secret.length >= 16 ? secret : '';
}

/**
 * @returns {{ ip: string, source: 'proxy' | 'direct', shared: boolean }}
 * - source 'proxy': the proxy proved the browser address with the shared secret.
 * - shared: the request came through the proxy but the address could not be
 *   verified, so `ip` is the proxy's address and is shared by many users.
 */
function resolveClientIp(req) {
  const headers = req?.headers || {};
  const secret = proxySecret();
  if (secret && safeEqual(headers[PROXY_AUTH_HEADER], secret)) {
    const forwarded = normalizeIp(headers[CLIENT_IP_HEADER]);
    if (forwarded) return { ip: forwarded, source: 'proxy', shared: false };
  }
  const direct = normalizeIp(req?.ip || req?.socket?.remoteAddress) || 'unknown';
  return { ip: direct, source: 'direct', shared: Boolean(headers[PROXIED_HEADER]) };
}

module.exports = {
  CLIENT_IP_HEADER,
  PROXIED_HEADER,
  PROXY_AUTH_HEADER,
  normalizeIp,
  resolveClientIp,
};
