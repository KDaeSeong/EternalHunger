export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// 배포 환경변수가 비어 있을 때 사용하는 임시 백엔드 fallback
const LEGACY_BACKEND_FALLBACK = 'https://eternalhunger-e7z1.onrender.com';

function stripApiSuffix(value) {
  return String(value || '').trim().replace(/\/+$/, '').replace(/\/api\/proxy$/, '').replace(/\/api$/, '');
}

function isProxyApiCandidate(value, request) {
  try {
    const reqUrl = request?.url ? new URL(request.url) : null;
    const candidate = new URL(String(value || '').trim(), reqUrl || undefined);
    return /^\/api\/proxy(?:\/|$)/.test(candidate.pathname);
  } catch {
    return false;
  }
}

function getBackendBase(request) {
  const candidates = [
    process.env.BACKEND_BASE_URL,
    process.env.API_BASE_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
    process.env.NEXT_PUBLIC_API_BASE,
  ].filter(Boolean);

  for (const v of candidates) {
    if (typeof v === 'string' && /^https?:\/\//.test(v) && !isProxyApiCandidate(v, request)) {
      return stripApiSuffix(v);
    }
  }

  const reqUrl = request?.url ? new URL(request.url) : null;
  const host = reqUrl?.hostname || '';
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:5000';
  }

  return LEGACY_BACKEND_FALLBACK;
}

async function getTokenFromCookies() {
  const store = await cookies();
  return (
    store.get('token')?.value ||
    store.get('accessToken')?.value ||
    store.get('authToken')?.value ||
    ''
  );
}

function copyRequestHeaders(request, fallbackToken) {
  const headers = new Headers();
  const authHeader = request.headers.get('authorization');
  const contentType = request.headers.get('content-type');
  const accept = request.headers.get('accept');

  if (accept) headers.set('Accept', accept);
  if (contentType) headers.set('Content-Type', contentType);
  if (authHeader) headers.set('Authorization', authHeader);
  else if (fallbackToken) headers.set('Authorization', fallbackToken.startsWith('Bearer ') ? fallbackToken : `Bearer ${fallbackToken}`);

  return headers;
}

function getCacheControl(path, method, hasAuth) {
  if (String(method || '').toUpperCase() !== 'GET' || hasAuth) return 'no-store, max-age=0';

  const normalized = String(path || '').replace(/^\/+|\/+$/g, '');
  if (/^public\/(items|maps|kiosks|drone-offers|perks|er-meta)$/.test(normalized)) {
    return 'public, max-age=60, stale-while-revalidate=120';
  }
  if (/^public\/(home-hub|guides|search|leaderboard)$/.test(normalized) || /^public\/users\/[^/]+$/.test(normalized)) {
    return 'public, max-age=15, stale-while-revalidate=45';
  }
  if (normalized === 'posts' || /^posts\/[^/]+$/.test(normalized) || normalized === 'twenty-questions') {
    return 'public, max-age=10, stale-while-revalidate=30';
  }

  return 'no-store, max-age=0';
}

async function proxy(request, context) {
  const backend = getBackendBase(request);
  if (!backend) {
    return NextResponse.json(
      { error: 'Backend target is not available' },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const params = await context?.params;
  const path = Array.isArray(params?.path)
    ? params.path.filter(Boolean).join('/')
    : typeof params?.path === 'string'
      ? params.path
      : '';
  if (!path) {
    return NextResponse.json({ error: 'Proxy path is required' }, { status: 400 });
  }

  const token = await getTokenFromCookies();
  const method = request.method || 'GET';
  const headers = copyRequestHeaders(request, token);
  const cacheControl = getCacheControl(path, method, headers.has('Authorization'));
  const target = `${backend}/api/${path}${url.search || ''}`;

  const init = {
    method,
    headers,
    cache: 'no-store',
  };

  if (!['GET', 'HEAD'].includes(method.toUpperCase())) {
    if (request.body) {
      init.body = request.body;
      init.duplex = 'half';
    }
  }

  const res = await fetch(target, init);
  const contentType = res.headers.get('content-type') || 'application/json';
  const body = await res.text();

  return new NextResponse(body, {
    status: res.status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    },
  });
}

export async function GET(request, context) {
  return proxy(request, context);
}

export async function POST(request, context) {
  return proxy(request, context);
}

export async function PUT(request, context) {
  return proxy(request, context);
}

export async function PATCH(request, context) {
  return proxy(request, context);
}

export async function DELETE(request, context) {
  return proxy(request, context);
}
