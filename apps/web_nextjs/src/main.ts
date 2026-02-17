import { createStudioOsApiClient } from './generated/api-client';

interface DashboardRoute {
  path: '/dashboard';
}

export const dashboardRoute: DashboardRoute = {
  path: '/dashboard'
};

export async function pingApiHealth(): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  const client = createStudioOsApiClient(baseUrl);
  const { response } = await client.GET('/health');
  return response.ok;
}
