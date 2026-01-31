import { NextResponse } from 'next/server';

function hasAnyCookie(request, names) {
  for (const name of names) {
    const v = request.cookies.get(name)?.value;
    if (v) return true;
  }
  return false;
}

export function middleware(request) {
  const pathname = request.nextUrl.pathname || '';

  // ✅ Admin 페이지(/admin/**)는 middleware에서 막지 않는다.
  // - 이유: localStorage 토큰은 서버(middleware)에서 볼 수 없음
  // - 대신 AdminShell(클라이언트)에서 로그인/권한 체크 후 리다이렉트 처리

  // ✅ Admin API(/api/admin/**)만 middleware에서 가드한다.
  if (!pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }

  // 토큰/세션 쿠키가 있으면 통과 (프로젝트에 맞게 이름 추가 가능)
  const hasTokenCookie = hasAnyCookie(request, ['token', 'accessToken', 'authToken']);
  const hasSessionCookie = hasAnyCookie(request, ['connect.sid', 'sid', 'session', 'sessionId']);

  if (hasTokenCookie || hasSessionCookie) {
    return NextResponse.next();
  }

  // API는 리다이렉트 대신 401 JSON
  return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
}

export const config = {
  matcher: ['/api/admin/:path*'],
};
