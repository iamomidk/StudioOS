import createClient from 'openapi-fetch';

import type { paths } from './openapi.types';

export function createStudioOsApiClient(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}
