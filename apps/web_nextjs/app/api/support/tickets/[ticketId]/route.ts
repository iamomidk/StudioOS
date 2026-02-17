import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/studioos-api';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('studioos_access_token')?.value;
  if (!accessToken) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json({ message: 'organizationId is required' }, { status: 400 });
  }

  const { ticketId } = await params;
  const response = await fetch(
    `${getApiBaseUrl()}/support/tickets/${encodeURIComponent(ticketId)}?organizationId=${encodeURIComponent(organizationId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      },
      cache: 'no-store'
    }
  );

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' }
  });
}
