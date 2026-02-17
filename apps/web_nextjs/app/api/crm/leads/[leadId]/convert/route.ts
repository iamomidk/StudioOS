import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/studioos-api';

interface Params {
  params: Promise<{ leadId: string }>;
}

interface ConvertPayload {
  organizationId: string;
}

export async function POST(request: Request, context: Params): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('studioos_access_token')?.value;
  if (!accessToken) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  const { leadId } = await context.params;
  const payload = (await request.json()) as ConvertPayload;

  const response = await fetch(
    `${getApiBaseUrl()}/crm/leads/${encodeURIComponent(leadId)}/convert`,
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
