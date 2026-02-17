import { SetMetadata } from '@nestjs/common';

export const PARTNER_SCOPES_KEY = 'partner_scopes';

export const PartnerScopes = (...scopes: string[]) => SetMetadata(PARTNER_SCOPES_KEY, scopes);
