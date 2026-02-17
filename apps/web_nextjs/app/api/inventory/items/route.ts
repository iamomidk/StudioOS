import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/studioos-api';

interface CreateInventoryItemPayload {
  organizationId: string;
  assetId: string;
  serialNumber: string;
  condition: 'excellent' | 'good' | 'fair' | 'damaged';
  ownerName?: string;
}

export async function GET(request: Request): Promise<NextResponse> {
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

  const response = await fetch(
    `${getApiBaseUrl()}/inventory/items?organizationId=${encodeURIComponent(organizationId)}`,
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

export async function POST(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('studioos_access_token')?.value;
  if (!accessToken) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  const payload = (await request.json()) as CreateInventoryItemPayload;
  const response = await fetch(`${getApiBaseUrl()}/inventory/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload),
    cache: 'no-store'
  });

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' }
  });
}
