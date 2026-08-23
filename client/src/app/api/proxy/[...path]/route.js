export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Buffer } from 'node:buffer';

const SESSION_COOKIE = 'token';
const CSRF_COOKIE = 'eh_csrf';
const BODYLESS_STATUS_CODES = new Set([204, 205, 304]);

function stripApiSuffix(value) {
  return String(value || '').trim().replace(/\/+$/, '').replace(/\/api\/proxy$/, '').replace(/\/api$/, '');
}

function getBackendBase(request) {
  const raw = String(process.env.BACKEND_BASE_URL || '').trim();
  if (!raw) return '';
  try {
    const reqUrl = request?.url ? new URL(request.url) : null;
    const candidate = new URL(raw);
    if (!/^https?:$/.test(candidate.protocol)) return '';
    if (reqUrl && candidate.origin === reqUrl.origin && /^\/api\/proxy(?:\/|$)/.test(candidate.pathname)) return '';
    return stripApiSuffix(candidate.toString());
  } catch {
    return '';
  }
}

function isCredentialOriginAllowed(backend) {
  try {
    const origin = new URL(backend).origin;
    const hostname = new URL(origin).hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
    const allowed = String(process.env.AUTH_PROXY_CREDENTIAL_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => new URL(value).origin);
    return allowed.includes(origin);
  } catch {
    return false;
  }
}

async function getForwardCookies() {
  const store = await cookies();
  const values = [SESSION_COOKIE, CSRF_COOKIE]
    .map((name) => {
      const value = store.get(name)?.value;
      return value ? `${name}=${value}` : '';
    })
    .filter(Boolean);
  return { cookieHeader: values.join('; '), hasSession: Boolean(store.get(SESSION_COOKIE)?.value) };
}

function copyRequestHeaders(request, cookieHeader) {
  const headers = new Headers();
  const authHeader = request.headers.get('authorization');
  const contentType = request.headers.get('content-type');
  const accept = request.headers.get('accept');
  const csrfToken = request.headers.get('x-csrf-token');
  if (accept) headers.set('Accept', accept);
  if (contentType) headers.set('Content-Type', contentType);
  if (authHeader) headers.set('Authorization', authHeader);
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  if (cookieHeader) headers.set('Cookie', cookieHeader);
  return headers;
}

function getCacheControl(path, method, hasAuth) {
  if (String(method || '').toUpperCase() !== 'GET' || hasAuth) return 'no-store, max-age=0';
  const normalized = String(path || '').replace(/^\/+|\/+$/g, '');
  if (/^public\/(items|maps|kiosks|drone-offers|perks|er-meta)$/.test(normalized)) {
    return 'public, max-age=60, stale-while-revalidate=120';
  }
  if (
    /^public\/(home-hub|guides|search|leaderboard|activity)$/.test(normalized) ||
    /^public\/games\/[^/]+\/hub$/.test(normalized) ||
    /^public\/users\/[^/]+$/.test(normalized)
  ) {
    return 'public, max-age=15, stale-while-revalidate=45';
  }
  if (normalized === 'posts' || /^posts\/[^/]+$/.test(normalized) || normalized === 'twenty-questions') {
    return 'public, max-age=10, stale-while-revalidate=30';
  }
  return 'no-store, max-age=0';
}

function copySetCookies(sourceHeaders, response) {
  const values = typeof sourceHeaders.getSetCookie === 'function' ? sourceHeaders.getSetCookie() : [];
  if (values.length > 0) {
    values.forEach((value) => response.headers.append('Set-Cookie', value));
    return;
  }
  const fallback = sourceHeaders.get('set-cookie');
  if (fallback) response.headers.append('Set-Cookie', fallback);
}

async function proxy(request, context) {
  const backend = getBackendBase(request);
  if (!backend) {
    return NextResponse.json(
      { error: 'BACKEND_BASE_URL이 설정되지 않았거나 올바르지 않습니다.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  const url = new URL(request.url);
  const params = await context?.params;
  const path = Array.isArray(params?.path)
    ? params.path.filter(Boolean).join('/')
    : typeof params?.path === 'string' ? params.path : '';
  if (!path) return NextResponse.json({ error: 'Proxy path is required' }, { status: 400 });

  const credentialOriginAllowed = isCredentialOriginAllowed(backend);
  const authPath = /^auth\/(?:login|session|logout)(?:\/|$)/.test(path);
  const { cookieHeader, hasSession } = await getForwardCookies();
  const hasExplicitAuth = Boolean(request.headers.get('authorization'));
  if (!credentialOriginAllowed && (authPath || hasSession || hasExplicitAuth)) {
    return NextResponse.json(
      { error: '인증 프록시 목적지가 AUTH_PROXY_CREDENTIAL_ORIGINS에 허용되지 않았습니다.' },
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  const method = request.method || 'GET';
  const headers = copyRequestHeaders(request, credentialOriginAllowed ? cookieHeader : '');
  const cacheControl = getCacheControl(path, method, hasSession || hasExplicitAuth);
  const target = `${backend}/api/${path}${url.search || ''}`;
  const init = { method, headers, cache: 'no-store' };
  if (!['GET', 'HEAD'].includes(method.toUpperCase())) {
    const body = Buffer.from(await request.arrayBuffer());
    if (body.byteLength > 0) init.body = body;
  }

  let res;
  try {
    res = await fetch(target, init);
  } catch (err) {
    console.error('api proxy request failed:', { path, method, target, message: err?.message || String(err) });
    return NextResponse.json(
      { error: '서버 요청을 전달하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  const responseBody = BODYLESS_STATUS_CODES.has(res.status) ? null : await res.text();
  const responseHeaders = { 'Cache-Control': cacheControl };
  const contentType = res.headers.get('content-type');
  if (contentType && responseBody !== null) responseHeaders['Content-Type'] = contentType;
  const response = new NextResponse(responseBody, {
    status: res.status,
    headers: responseHeaders,
  });
  if (credentialOriginAllowed) copySetCookies(res.headers, response);
  return response;
}

export async function GET(request, context) { return proxy(request, context); }
export async function POST(request, context) { return proxy(request, context); }
export async function PUT(request, context) { return proxy(request, context); }
export async function PATCH(request, context) { return proxy(request, context); }
export async function DELETE(request, context) { return proxy(request, context); }
