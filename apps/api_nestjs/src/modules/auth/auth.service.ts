import { createHash, randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
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

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokenPair(user.id);
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

    const rotated = await this.issueTokenPair(existing.userId);

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

  private async issueTokenPair(userId: string): Promise<TokenPair> {
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
      { expiresIn: '7d' }
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
}
