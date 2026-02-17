import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';

import { AppConfigService } from '../../../config/app-config.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Role } from './role.enum.js';

export interface AccessClaims {
  sub: string;
  type: 'access';
  roles: Role[];
}

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
    'x-forwarded-for'?: string;
  };
  ip?: string;
  user?: AccessClaims;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          memberships: {
            include: {
              organization: {
                select: {
                  ipAllowlist: true
                }
              }
            }
          }
        }
      });
      if (!user) {
        throw new UnauthorizedException('Invalid access token');
      }

      if (user.deactivatedAt) {
        const graceMs = this.config.enterpriseDeprovisionGraceSeconds * 1000;
        if (Date.now() >= user.deactivatedAt.getTime() + graceMs) {
          throw new UnauthorizedException('User is deprovisioned');
        }
      }

      const sourceIp = this.resolveIp(request);
      const blocked = user.memberships.some((membership) => {
        const allowlist = membership.organization.ipAllowlist ?? [];
        return allowlist.length > 0 && !allowlist.includes(sourceIp);
      });
      if (blocked) {
        throw new UnauthorizedException('IP not allowed by organization policy');
      }

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private resolveIp(request: AuthenticatedRequest): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded && forwarded.length > 0) {
      return forwarded.split(',')[0]?.trim() ?? 'unknown';
    }
    return request.ip ?? 'unknown';
  }
}
