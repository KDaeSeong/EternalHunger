import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const proxySource = await fs.readFile(
  new URL('../src/app/api/proxy/[...path]/route.js', import.meta.url),
  'utf8',
);
const charactersProxySource = await fs.readFile(
  new URL('../src/app/api/characters/route.js', import.meta.url),
  'utf8',
);
const loginSource = await fs.readFile(new URL('../src/app/login/page.js', import.meta.url), 'utf8');
const deploymentConfig = JSON.parse(
  await fs.readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
);

assert(proxySource.includes('AUTH_PROXY_CREDENTIAL_ORIGINS'), 'credential forwarding must remain allowlisted');
assert(proxySource.includes('BODYLESS_STATUS_CODES = new Set([204, 205, 304])'), 'bodyless HTTP statuses must be explicit');
assert(
  proxySource.includes('BODYLESS_STATUS_CODES.has(res.status) ? null : await res.text()'),
  '204/205/304 responses must be reconstructed with a null body',
);
assert(proxySource.includes('copySetCookies(res.headers, response)'), 'backend Set-Cookie headers must be forwarded');
assert(
  !proxySource.includes("{ error: 'BACKEND_BASE_URL") && !charactersProxySource.includes("{ error: 'BACKEND_BASE_URL"),
  'deployment variable names must not be returned to users',
);
assert(
  proxySource.includes("code: SERVICE_CONFIGURATION_ERROR") &&
    charactersProxySource.includes("code: SERVICE_CONFIGURATION_ERROR"),
  'proxy configuration failures must return a stable machine-readable code',
);
assert(
  !loginSource.includes("showToast({ tone: 'danger', message: nextMessage })"),
  'login errors must not be duplicated in both the form and a toast',
);
assert.equal(
  deploymentConfig.env?.BACKEND_BASE_URL,
  'https://eternalhunger-e7z1.onrender.com',
  'Vercel must retain the production backend origin in versioned deployment configuration',
);
assert.equal(
  deploymentConfig.env?.AUTH_PROXY_CREDENTIAL_ORIGINS,
  deploymentConfig.env?.BACKEND_BASE_URL,
  'credential forwarding must allow only the configured backend origin',
);

console.log('Proxy session contracts passed.');
