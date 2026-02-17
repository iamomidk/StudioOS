import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash, createHmac } from 'node:crypto';

import { PARTNER_SCOPES_KEY } from './partner-scope.decorator.js';
import { PartnerService } from '../partner.service.js';

export interface PartnerRequestContext {
  credentialId: string;
  organizationId: string;
  scopes: string[];
  keyId: string;
}

export interface PartnerAuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  partner?: PartnerRequestContext;
  rawBody?: string;
  body?: unknown;
  method?: string;
  originalUrl?: string;
  path?: string;
}

function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class PartnerApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly partnerService: PartnerService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PartnerAuthenticatedRequest>();
    const headerValue = this.readHeader(request, 'x-partner-api-key') ?? this.readBearer(request);
    if (!headerValue) {
      throw new UnauthorizedException('Missing partner API key');
    }

    const parsed = this.parseKey(headerValue);
    const credential = await this.partnerService.getActiveCredentialByKeyId(parsed.keyId);
    if (!credential) {
      throw new UnauthorizedException('Invalid partner API key');
    }

    if (credential.keyHash !== hashSecret(parsed.secret)) {
      throw new UnauthorizedException('Invalid partner API key');
    }

    if (credential.requestSigningRequired) {
      const signature = this.readHeader(request, 'x-partner-signature');
      if (!signature || !credential.signingSecret) {
        throw new UnauthorizedException('Missing partner request signature');
      }

      const payload = request.rawBody ?? JSON.stringify(request.body ?? {});
      const expected = createHmac('sha256', credential.signingSecret).update(payload).digest('hex');
      if (signature !== expected) {
        throw new UnauthorizedException('Invalid partner request signature');
      }
    }

    await this.partnerService.enforceQuota(credential.id, credential.organizationId);

    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(PARTNER_SCOPES_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (requiredScopes.length > 0) {
      const hasScope = requiredScopes.some((scope) => credential.scopes.includes(scope));
      if (!hasScope) {
        throw new ForbiddenException('Missing required partner scope');
      }
    }

    request.partner = {
      credentialId: credential.id,
      organizationId: credential.organizationId,
      scopes: credential.scopes,
      keyId: credential.keyId
    };

    return true;
  }

  private parseKey(value: string): { keyId: string; secret: string } {
    const [keyId, secret] = value.split('.', 2);
    if (!keyId || !secret) {
      throw new UnauthorizedException('Malformed partner API key');
    }
    return { keyId, secret };
  }

  private readHeader(
    request: { headers?: Record<string, string | string[] | undefined> },
    header: string
  ) {
    const value = request.headers?.[header];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  private readBearer(request: { headers?: Record<string, string | string[] | undefined> }) {
    const auth = this.readHeader(request, 'authorization');
    if (!auth) {
      return null;
    }

    const [prefix, token] = auth.split(' ', 2);
    if (prefix?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }

    return token;
  }
}
