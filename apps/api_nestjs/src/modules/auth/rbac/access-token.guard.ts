import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';

import { AppConfigService } from '../../../config/app-config.service.js';
import { Role } from './role.enum.js';

export interface AccessClaims {
  sub: string;
  type: 'access';
  roles: Role[];
}

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user?: AccessClaims;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      const payload = jwt.verify(token, this.config.jwtAccessTokenSecret) as AccessClaims;
      if (payload.type !== 'access' || !payload.sub || !Array.isArray(payload.roles)) {
        throw new UnauthorizedException('Invalid access token');
      }
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
