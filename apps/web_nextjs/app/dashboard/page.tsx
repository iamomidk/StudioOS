import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { createAuthorizationHeader, createServerApiClient } from '@/lib/studioos-api';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('studioos_access_token')?.value;

  if (!accessToken) {
    redirect('/login');
  }

  const client = createServerApiClient();
  const [healthResult, rbacResult] = await Promise.all([
    client.GET('/health'),
    client.GET('/rbac-probe/org-manage', {
      headers: createAuthorizationHeader(accessToken)
    })
  ]);

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      <p style={{ color: 'var(--muted)' }}>
        Authenticated shell is active and using generated OpenAPI client calls.
      </p>
      <ul>
        <li>Health API status: {healthResult.response.status}</li>
        <li>RBAC probe status: {rbacResult.response.status}</li>
      </ul>
    </main>
  );
}
