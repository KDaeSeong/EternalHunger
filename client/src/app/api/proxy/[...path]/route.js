import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// 배포 환경변수가 비어 있을 때 사용하는 임시 백엔드 fallback
const LEGACY_BACKEND_FALLBACK = 'https://eternalhunger-e7z1.onrender.com';

function stripApiSuffix(value) {
  return String(value || '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
}

function getBackendBase(request) {
  const candidates = [
    process.env.BACKEND_BASE_URL,
    process.env.API_BASE_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
    process.env.NEXT_PUBLIC_API_BASE,
  ].filter(Boolean);

  for (const v of candidates) {
    if (typeof v === 'string' && /^https?:\/\//.test(v)) return stripApiSuffix(v);
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

async function proxy(request, context) {
  const backend = getBackendBase(request);
  if (!backend) {
    return NextResponse.json(
      { error: 'Backend target is not available' },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const path = Array.isArray(context?.params?.path) ? context.params.path.join('/') : '';
  if (!path) {
    return NextResponse.json({ error: 'Proxy path is required' }, { status: 400 });
  }

  const token = await getTokenFromCookies();
  const method = request.method || 'GET';
  const headers = copyRequestHeaders(request, token);
  const target = `${backend}/api/${path}${url.search || ''}`;

  const init = {
    method,
    headers,
    cache: 'no-store',
  };

  if (!['GET', 'HEAD'].includes(method.toUpperCase())) {
    const rawBody = await request.text();
    if (rawBody) init.body = rawBody;
  }

  const res = await fetch(target, init);
  const contentType = res.headers.get('content-type') || 'application/json';
  const body = await res.text();

  return new NextResponse(body, {
    status: res.status,
    headers: { 'Content-Type': contentType },
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
