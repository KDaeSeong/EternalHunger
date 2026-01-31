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

  // /admin 이하 경로만 가드
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // 토큰/세션 쿠키가 있으면 통과 (프로젝트에 맞게 이름 추가 가능)
  const hasTokenCookie = hasAnyCookie(request, ['token', 'accessToken', 'authToken']);
  const hasSessionCookie = hasAnyCookie(request, ['connect.sid', 'sid', 'session', 'sessionId']);

  if (hasTokenCookie || hasSessionCookie) {
    return NextResponse.next();
  }

  // 없으면 메인으로 리다이렉트
  const url = request.nextUrl.clone();
  url.pathname = '/';
  url.searchParams.set('from', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*'],
};
