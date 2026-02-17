import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/dashboard'];

export function middleware(request: NextRequest): NextResponse {
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (!isProtected) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('studioos_access_token')?.value;
  if (accessToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', path);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*']
};
