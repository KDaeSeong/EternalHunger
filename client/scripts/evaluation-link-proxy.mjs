import http from 'node:http';
import { pathToFileURL } from 'node:url';

const upstreamHost = '127.0.0.1';
const upstreamPort = Math.max(1, Math.min(65535, Number(process.env.EH_EVALUATION_UPSTREAM_PORT || 3102)));
const listenPort = Math.max(1, Math.min(65535, Number(process.env.EH_EVALUATION_PROXY_PORT || 3103)));

const allowedExactPaths = new Set([
  '/eternalhunger/evaluate',
  '/eternalhunger/evaluate/',
  '/favicon.ico',
]);
const allowedPathPrefixes = [
  '/_next/',
  '/Images/',
  '/audio/',
  '/games/',
];

export function isAllowedEvaluationRequest(method, rawUrl) {
  const normalizedMethod = String(method || 'GET').toUpperCase();
  if (normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD') return false;
  let url;
  try {
    url = new URL(String(rawUrl || '/'), 'http://evaluation.invalid');
  } catch {
    return false;
  }
  return allowedExactPaths.has(url.pathname)
    || allowedPathPrefixes.some((prefix) => url.pathname.startsWith(prefix));
}

export function cleanEvaluationRequestHeaders(headers = {}) {
  const cleaned = { ...headers, host: `${upstreamHost}:${upstreamPort}` };
  for (const name of [
    'authorization',
    'cookie',
    'proxy-authorization',
    'x-csrf-token',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
  ]) delete cleaned[name];
  return cleaned;
}

export function cleanEvaluationResponseHeaders(headers = {}) {
  const cleaned = { ...headers };
  delete cleaned['set-cookie'];
  cleaned['x-robots-tag'] = 'noindex, nofollow, noarchive';
  cleaned['referrer-policy'] = 'no-referrer';
  cleaned['x-content-type-options'] = 'nosniff';
  return cleaned;
}

export function createEvaluationLinkProxy() {
  return http.createServer((request, response) => {
  if (!isAllowedEvaluationRequest(request.method, request.url)) {
    response.writeHead(404, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow, noarchive',
    });
    response.end('Evaluation route only.');
    return;
  }

  const upstream = http.request({
    host: upstreamHost,
    port: upstreamPort,
    method: request.method,
    path: request.url,
    headers: cleanEvaluationRequestHeaders(request.headers),
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, cleanEvaluationResponseHeaders(upstreamResponse.headers));
    upstreamResponse.pipe(response);
  });

  upstream.on('error', () => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    response.end('Evaluation server unavailable.');
  });
  request.pipe(upstream);
  });
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const server = createEvaluationLinkProxy();
  server.listen(listenPort, '127.0.0.1', () => {
    console.log(`EVALUATION_LINK_PROXY_READY http://127.0.0.1:${listenPort}/eternalhunger/evaluate -> http://${upstreamHost}:${upstreamPort}`);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
