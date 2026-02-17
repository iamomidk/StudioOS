import { NextResponse } from 'next/server';

import { loginWithPassword } from '@/lib/studioos-api';

interface LoginPayload {
  email: string;
  password: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  const payload = (await request.json()) as Partial<LoginPayload>;

  if (!payload.email || !payload.password) {
    return NextResponse.json({ message: 'Missing credentials' }, { status: 400 });
  }

  try {
    const tokens = await loginWithPassword(payload.email, payload.password);

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: 'studioos_access_token',
      value: tokens.accessToken,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production'
    });
    response.cookies.set({
      name: 'studioos_refresh_token',
      value: tokens.refreshToken,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production'
    });

    return response;
  } catch {
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }
}
