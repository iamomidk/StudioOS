import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/studioos-api';

interface Params {
  params: Promise<{ rentalOrderId: string }>;
}

interface CreateEvidencePayload {
  organizationId: string;
  photoUrl: string;
  note: string;
  occurredAt: string;
  latitude?: number;
  longitude?: number;
}

export async function GET(request: Request, context: Params): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('studioos_access_token')?.value;
  if (!accessToken) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  const { rentalOrderId } = await context.params;
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organizationId');
  const cursor = url.searchParams.get('cursor');
  const limit = url.searchParams.get('limit');

  if (!organizationId) {
    return NextResponse.json({ message: 'organizationId is required' }, { status: 400 });
  }

  const query = new URLSearchParams({ organizationId });
  if (cursor) {
    query.set('cursor', cursor);
  }
  if (limit) {
    query.set('limit', limit);
  }

  const response = await fetch(
    `${getApiBaseUrl()}/rentals/${encodeURIComponent(rentalOrderId)}/evidence?${query.toString()}`,
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

export async function POST(request: Request, context: Params): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('studioos_access_token')?.value;
  if (!accessToken) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  const { rentalOrderId } = await context.params;
  const payload = (await request.json()) as CreateEvidencePayload;
  if (!payload.organizationId) {
    return NextResponse.json({ message: 'organizationId is required' }, { status: 400 });
  }

  const response = await fetch(
    `${getApiBaseUrl()}/rentals/${encodeURIComponent(rentalOrderId)}/evidence`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    }
  );

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' }
  });
}
