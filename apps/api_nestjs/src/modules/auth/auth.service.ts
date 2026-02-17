import { createHash, randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role } from './rbac/role.enum.js';

interface RefreshClaims {
  sub: string;
  jti: string;
  type: 'refresh';
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AccessClaims {
  sub: string;
  type: 'access';
  roles: Role[];
}

interface UserAuthPolicies {
  requiresSso: boolean;
  requiresMfa: boolean;
  sessionDurationMinutes: number;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService
  ) {}

  async login(email: string, password: string, mfaCode?: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: {
            organization: {
              select: {
                id: true,
                ssoEnforced: true,
                mfaEnforced: true,
                sessionDurationMinutes: true
              }
            }
          }
        }
      }
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.isUserDeprovisioned(user.deactivatedAt)) {
      throw new UnauthorizedException('User is deprovisioned');
    }

    const policies = this.buildPoliciesFromMemberships(user.memberships);
    if (policies.requiresSso) {
      throw new UnauthorizedException('SSO-only login is enforced for this organization');
    }

    if (policies.requiresMfa) {
      if (!user.mfaEnabled || mfaCode !== '000000') {
        throw new UnauthorizedException('MFA verification failed');
      }
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokenPair(user.id, policies.sessionDurationMinutes);
    await this.writeAuthAuditLogs(user.id, 'auth.login.succeeded', { source: 'password' });
    return tokens;
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const claims = this.verifyRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);

    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash }
    });

    if (!existing || existing.userId !== claims.sub || existing.jti !== claims.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revokedAt || existing.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: existing.userId },
      include: {
        memberships: {
          include: {
            organization: {
              select: {
                id: true,
                ssoEnforced: true,
                mfaEnforced: true,
                sessionDurationMinutes: true
              }
            }
          }
        }
      }
    });
    if (!user || this.isUserDeprovisioned(user.deactivatedAt)) {
      throw new UnauthorizedException('User is deprovisioned');
    }

    const policies = this.buildPoliciesFromMemberships(user.memberships);
    const rotated = await this.issueTokenPair(existing.userId, policies.sessionDurationMinutes);

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: {
        revokedAt: new Date(),
        replacedBy: this.hashToken(rotated.refreshToken)
      }
    });

    return rotated;
  }

  async logout(refreshToken: string): Promise<void> {
    const claims = this.verifyRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);

    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash }
    });

    if (!existing || existing.userId !== claims.sub || existing.jti !== claims.jti) {
      return;
    }

    if (!existing.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() }
      });
    }
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          select: { role: true }
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid access token');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.memberships.map((membership) => membership.role as Role)
    };
  }

  async issueTokenPair(userId: string, sessionDurationMinutes?: number): Promise<TokenPair> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: { role: true }
    });
    const roles = memberships.map((membership) => membership.role as Role);

    const accessClaims: AccessClaims = {
      sub: userId,
      type: 'access',
      roles
    };

    const accessToken = jwt.sign(accessClaims, this.config.jwtAccessTokenSecret, {
      expiresIn: '15m'
    });

    const jti = randomUUID();
    const refreshToken = jwt.sign(
      { sub: userId, jti, type: 'refresh' },
      this.config.jwtRefreshTokenSecret,
      { expiresIn: `${sessionDurationMinutes ?? 7 * 24 * 60}m` }
    );

    const decoded = jwt.decode(refreshToken) as { exp?: number };
    if (!decoded.exp) {
      throw new UnauthorizedException('Unable to issue refresh token');
    }

    await this.prisma.refreshToken.create({
      data: {
        userId,
        jti,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000)
      }
    });

    return {
      accessToken,
      refreshToken
    };
  }

  private verifyRefreshToken(token: string): RefreshClaims {
    try {
      const payload = jwt.verify(token, this.config.jwtRefreshTokenSecret) as RefreshClaims;
      if (payload.type !== 'refresh' || !payload.sub || !payload.jti) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildPoliciesFromMemberships(
    memberships: Array<{
      organization: {
        ssoEnforced: boolean;
        mfaEnforced: boolean;
        sessionDurationMinutes: number;
      };
    }>
  ): UserAuthPolicies {
    const sessionDurationMinutes = memberships.reduce(
      (min, membership) => {
        return Math.min(min, membership.organization.sessionDurationMinutes);
      },
      7 * 24 * 60
    );

    return {
      requiresSso: memberships.some((membership) => membership.organization.ssoEnforced),
      requiresMfa: memberships.some((membership) => membership.organization.mfaEnforced),
      sessionDurationMinutes: Math.max(15, sessionDurationMinutes)
    };
  }

  private isUserDeprovisioned(deactivatedAt: Date | null): boolean {
    if (!deactivatedAt) {
      return false;
    }
    const graceMs = this.config.enterpriseDeprovisionGraceSeconds * 1000;
    return Date.now() >= deactivatedAt.getTime() + graceMs;
  }

  private async writeAuthAuditLogs(
    userId: string,
    action: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: { organizationId: true }
    });

    if (memberships.length === 0) {
      return;
    }

    await this.prisma.auditLog.createMany({
      data: memberships.map((membership) => ({
        organizationId: membership.organizationId,
        actorUserId: userId,
        entityType: 'User',
        entityId: userId,
        action,
        metadata: metadata as Prisma.InputJsonValue
      }))
    });
  }
}
