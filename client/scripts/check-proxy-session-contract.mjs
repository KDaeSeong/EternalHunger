import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const proxySource = await fs.readFile(
  new URL('../src/app/api/proxy/[...path]/route.js', import.meta.url),
  'utf8',
);

assert(proxySource.includes('AUTH_PROXY_CREDENTIAL_ORIGINS'), 'credential forwarding must remain allowlisted');
assert(proxySource.includes('BODYLESS_STATUS_CODES = new Set([204, 205, 304])'), 'bodyless HTTP statuses must be explicit');
assert(
  proxySource.includes('BODYLESS_STATUS_CODES.has(res.status) ? null : await res.text()'),
  '204/205/304 responses must be reconstructed with a null body',
);
assert(proxySource.includes('copySetCookies(res.headers, response)'), 'backend Set-Cookie headers must be forwarded');

console.log('Proxy session contracts passed.');
