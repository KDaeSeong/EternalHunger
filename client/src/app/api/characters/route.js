import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SERVICE_UNAVAILABLE_MESSAGE = '서비스 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.';
const SERVICE_CONFIGURATION_ERROR = 'SERVICE_CONFIGURATION_ERROR';

function stripApiSuffix(value) {
  return String(value || '').trim().replace(/\/+$/, '').replace(/\/api\/proxy$/, '').replace(/\/api$/, '');
}

function getBackendBase() {
  const raw = String(process.env.BACKEND_BASE_URL || '').trim();
  try {
    const candidate = new URL(raw);
    return /^https?:$/.test(candidate.protocol) ? stripApiSuffix(candidate.toString()) : '';
  } catch {
    return '';
  }
}

function isCredentialOriginAllowed(backend) {
  try {
    const url = new URL(backend);
    if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return true;
    const allowed = String(process.env.AUTH_PROXY_CREDENTIAL_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => new URL(value).origin);
    return allowed.includes(url.origin);
  } catch {
    return false;
  }
}

export async function GET(request) {
  const backend = getBackendBase();
  if (!backend) {
    console.error('characters proxy configuration error: BACKEND_BASE_URL is missing or invalid');
    return NextResponse.json(
      { error: SERVICE_UNAVAILABLE_MESSAGE, code: SERVICE_CONFIGURATION_ERROR },
      { status: 500 }
    );
  }
  if (!isCredentialOriginAllowed(backend)) {
    console.error('characters proxy configuration error: credential origin is not allowlisted');
    return NextResponse.json(
      { error: SERVICE_UNAVAILABLE_MESSAGE, code: SERVICE_CONFIGURATION_ERROR },
      { status: 503 }
    );
  }

  const store = await cookies();
  const token = store.get('token')?.value || '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const target = `${backend}/api/characters${url.search || ''}`;
  let response;
  try {
    response = await fetch(target, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch (error) {
    console.error('characters proxy request failed:', { target, message: error?.message || String(error) });
    return NextResponse.json({ error: '서버 요청을 전달하지 못했습니다.' }, { status: 502 });
  }

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
