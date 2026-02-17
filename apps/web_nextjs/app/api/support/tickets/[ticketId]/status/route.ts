import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/studioos-api';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('studioos_access_token')?.value;
  if (!accessToken) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  const payload = (await request.json()) as { organizationId?: string; status?: string };
  if (!payload.organizationId || !payload.status) {
    return NextResponse.json(
      { message: 'organizationId and status are required' },
      { status: 400 }
    );
  }

  const { ticketId } = await params;
  const response = await fetch(
    `${getApiBaseUrl()}/support/tickets/${encodeURIComponent(ticketId)}/status?organizationId=${encodeURIComponent(payload.organizationId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ status: payload.status }),
      cache: 'no-store'
    }
  );

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' }
  });
}
