import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/studioos-api';

interface Params {
  params: Promise<{ rentalOrderId: string }>;
}

interface UpdateStatusPayload {
  organizationId: string;
  status: 'reserved' | 'picked_up' | 'returned' | 'incident' | 'cancelled';
}

export async function PATCH(request: Request, context: Params): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('studioos_access_token')?.value;
  if (!accessToken) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  const { rentalOrderId } = await context.params;
  const payload = (await request.json()) as UpdateStatusPayload;
  if (!payload.organizationId) {
    return NextResponse.json({ message: 'organizationId is required' }, { status: 400 });
  }

  const response = await fetch(
    `${getApiBaseUrl()}/rentals/${encodeURIComponent(rentalOrderId)}/status?organizationId=${encodeURIComponent(payload.organizationId)}`,
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
