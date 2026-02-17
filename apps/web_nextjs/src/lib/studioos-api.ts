import createClient from 'openapi-fetch';

import type { paths } from '@/generated/openapi.types';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function getApiBaseUrl(): string {
  return (
    process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000'
  );
}

export function createServerApiClient() {
  return createClient<paths>({
    baseUrl: getApiBaseUrl()
  });
}

export function createAuthorizationHeader(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`
  };
}

export async function loginWithPassword(email: string, password: string): Promise<TokenPair> {
  const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ email, password }),
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('Invalid credentials');
  }

  return (await response.json()) as TokenPair;
}

export async function logoutWithRefreshToken(refreshToken: string): Promise<void> {
  await fetch(`${getApiBaseUrl()}/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store'
  });
}
