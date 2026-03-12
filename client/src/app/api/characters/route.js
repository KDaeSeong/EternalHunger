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

function getTokenFromCookies() {
  const store = cookies();
  return (
    store.get('token')?.value ||
    store.get('accessToken')?.value ||
    store.get('authToken')?.value ||
    ''
  );
}

export async function GET(request) {
  const token = getTokenFromCookies();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const backend = getBackendBase(request);
  if (!backend) {
    return NextResponse.json(
      { error: 'Backend target is not available' },
      { status: 500 }
    );
  }
  const target = `${backend}/api/characters${url.search || ''}`;

  const res = await fetch(target, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const contentType = res.headers.get('content-type') || 'application/json';
  const body = await res.text();

  return new NextResponse(body, {
    status: res.status,
    headers: { 'Content-Type': contentType },
  });
}
