import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { logoutWithRefreshToken } from '@/lib/studioos-api';

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('studioos_refresh_token')?.value;

  if (refreshToken) {
    await logoutWithRefreshToken(refreshToken);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: 'studioos_access_token',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production'
  });
  response.cookies.set({
    name: 'studioos_refresh_token',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production'
  });

  return response;
}
