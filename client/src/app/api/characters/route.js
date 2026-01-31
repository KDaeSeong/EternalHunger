import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

function getBackendBase() {
  // 배포/로컬 전환을 위해 환경변수를 우선 사용
  const candidates = [
    process.env.BACKEND_BASE_URL,
    process.env.API_BASE_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
    process.env.NEXT_PUBLIC_API_BASE,
  ].filter(Boolean);

  for (const v of candidates) {
    if (typeof v === 'string' && /^https?:\/\//.test(v)) return v.replace(/\/$/, '');
  }
  // 기본값(현재 Render 백엔드)
  return 'https://eternalhunger-e7z1.onrender.com';
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
  const backend = getBackendBase();
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
