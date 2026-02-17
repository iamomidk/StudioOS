import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePartnerCredentialDto } from './dto/create-partner-credential.dto.js';
import { RotatePartnerCredentialDto } from './dto/rotate-partner-credential.dto.js';
import { UpdatePartnerCredentialStatusDto } from './dto/update-partner-credential-status.dto.js';

function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requestHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value ?? {}))
    .digest('hex');
}

@Injectable()
export class PartnerService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveCredentialByKeyId(keyId: string) {
    return this.prisma.partnerApiCredential.findFirst({
      where: {
        keyId,
        status: 'active'
      }
    });
  }

  async enforceQuota(credentialId: string, organizationId: string) {
    const credential = await this.prisma.partnerApiCredential.findFirst({
      where: {
        id: credentialId,
        organizationId
      }
    });

    if (!credential || credential.status !== 'active') {
      throw new ForbiddenException('Partner credential is not active');
    }

    const now = new Date();
    const minuteStart = new Date(now.getTime() - 60 * 1000);
    const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [minuteCount, dayCount] = await Promise.all([
      this.prisma.partnerApiRequestLog.count({
        where: {
          credentialId,
          createdAt: {
            gte: minuteStart
          }
        }
      }),
      this.prisma.partnerApiRequestLog.count({
        where: {
          credentialId,
          createdAt: {
            gte: dayStart
          }
        }
      })
    ]);

    if (minuteCount >= credential.requestsPerMinute) {
      throw new HttpException('Partner rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (dayCount >= credential.dailyQuota) {
      throw new HttpException('Partner daily quota exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  assertTenant(credentialOrganizationId: string, requestedOrganizationId: string): void {
    if (credentialOrganizationId !== requestedOrganizationId) {
      throw new ForbiddenException('Partner tenant mismatch');
    }
  }

  async recordUsage(
    credentialId: string,
    organizationId: string,
    method: string,
    path: string,
    statusCode: number,
    latencyMs: number
  ) {
    await this.prisma.partnerApiRequestLog.create({
      data: {
        credentialId,
        organizationId,
        method,
        path,
        statusCode,
        latencyMs
      }
    });

    await this.prisma.partnerApiCredential.update({
      where: { id: credentialId },
      data: { lastUsedAt: new Date() }
    });
  }

  async idempotentWrite(
    input: {
      credentialId: string;
      organizationId: string;
      method: string;
      path: string;
      idempotencyKey: string;
      payload: unknown;
    },
    execute: () => Promise<{ statusCode: number; body: unknown }>
  ): Promise<{ statusCode: number; body: unknown; reused: boolean }> {
    const hash = requestHash(input.payload);

    const existing = await this.prisma.partnerApiIdempotencyRecord.findUnique({
      where: {
        credentialId_method_path_idempotencyKey: {
          credentialId: input.credentialId,
          method: input.method,
          path: input.path,
          idempotencyKey: input.idempotencyKey
        }
      }
    });

    if (existing) {
      if (existing.requestHash !== hash) {
        throw new ConflictException('Idempotency key reused with different payload');
      }

      return {
        statusCode: existing.statusCode,
        body: existing.responseBody,
        reused: true
      };
    }

    const result = await execute();
    await this.prisma.partnerApiIdempotencyRecord.create({
      data: {
        credentialId: input.credentialId,
        organizationId: input.organizationId,
        method: input.method,
        path: input.path,
        idempotencyKey: input.idempotencyKey,
        requestHash: hash,
        statusCode: result.statusCode,
        responseBody: result.body as Prisma.InputJsonValue
      }
    });

    return {
      statusCode: result.statusCode,
      body: result.body,
      reused: false
    };
  }

  async createCredential(dto: CreatePartnerCredentialDto, actor?: AccessClaims) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true }
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const keyId = `pk_${randomBytes(8).toString('hex')}`;
    const rawSecret = randomBytes(18).toString('hex');

    const credential = await this.prisma.partnerApiCredential.create({
      data: {
        organizationId: dto.organizationId,
        name: dto.name,
        keyId,
        keyHash: hashSecret(rawSecret),
        scopes: dto.scopes,
        requestsPerMinute: dto.requestsPerMinute ?? 120,
        dailyQuota: dto.dailyQuota ?? 10000,
        requestSigningRequired: dto.requestSigningRequired ?? false,
        signingSecret: dto.requestSigningRequired ? randomBytes(16).toString('hex') : null
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'PartnerApiCredential',
        entityId: credential.id,
        action: 'partner.credential.created',
        metadata: {
          keyId: credential.keyId,
          scopes: credential.scopes,
          status: credential.status
        }
      }
    });

    return {
      ...credential,
      rawApiKey: `${keyId}.${rawSecret}`
    };
  }

  async listCredentials(organizationId: string) {
    return this.prisma.partnerApiCredential.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async rotateCredential(
    credentialId: string,
    organizationId: string,
    dto: RotatePartnerCredentialDto,
    actor?: AccessClaims
  ) {
    const existing = await this.prisma.partnerApiCredential.findFirst({
      where: { id: credentialId, organizationId }
    });
    if (!existing) {
      throw new NotFoundException('Partner credential not found');
    }

    const keyId = `pk_${randomBytes(8).toString('hex')}`;
    const rawSecret = randomBytes(18).toString('hex');

    const rotated = await this.prisma.partnerApiCredential.create({
      data: {
        organizationId,
        name: dto.name ?? existing.name,
        keyId,
        keyHash: hashSecret(rawSecret),
        scopes: existing.scopes,
        requestsPerMinute: existing.requestsPerMinute,
        dailyQuota: existing.dailyQuota,
        requestSigningRequired: existing.requestSigningRequired,
        signingSecret: existing.signingSecret,
        rotatedFromId: existing.id
      }
    });

    await this.prisma.partnerApiCredential.update({
      where: { id: existing.id },
      data: { status: 'revoked' }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'PartnerApiCredential',
        entityId: rotated.id,
        action: 'partner.credential.rotated',
        metadata: {
          fromCredentialId: existing.id,
          toCredentialId: rotated.id,
          keyId: rotated.keyId
        }
      }
    });

    return {
      ...rotated,
      rawApiKey: `${keyId}.${rawSecret}`
    };
  }

  async updateCredentialStatus(
    credentialId: string,
    organizationId: string,
    dto: UpdatePartnerCredentialStatusDto,
    actor?: AccessClaims
  ) {
    const updated = await this.prisma.partnerApiCredential.updateMany({
      where: { id: credentialId, organizationId },
      data: { status: dto.status }
    });

    if (updated.count === 0) {
      throw new NotFoundException('Partner credential not found');
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'PartnerApiCredential',
        entityId: credentialId,
        action: 'partner.credential.status.updated',
        metadata: {
          status: dto.status
        }
      }
    });

    return this.prisma.partnerApiCredential.findUnique({ where: { id: credentialId } });
  }

  async usageDashboard(organizationId: string) {
    const logs = await this.prisma.partnerApiRequestLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        credential: {
          select: { keyId: true }
        }
      }
    });

    const byKey: Record<string, { requests: number; errors: number }> = {};
    const byEndpoint: Record<string, { requests: number; totalLatencyMs: number }> = {};

    for (const log of logs) {
      const key = log.credential.keyId;
      if (!byKey[key]) {
        byKey[key] = { requests: 0, errors: 0 };
      }
      byKey[key].requests += 1;
      if (log.statusCode >= 400) {
        byKey[key].errors += 1;
      }

      const endpoint = `${log.method} ${log.path}`;
      if (!byEndpoint[endpoint]) {
        byEndpoint[endpoint] = { requests: 0, totalLatencyMs: 0 };
      }
      byEndpoint[endpoint].requests += 1;
      byEndpoint[endpoint].totalLatencyMs += log.latencyMs;
    }

    return {
      requests: logs.length,
      byKey,
      topEndpoints: Object.entries(byEndpoint)
        .map(([endpoint, metrics]) => ({
          endpoint,
          requests: metrics.requests,
          averageLatencyMs:
            metrics.requests === 0 ? 0 : Math.round(metrics.totalLatencyMs / metrics.requests)
        }))
        .sort((left, right) => right.requests - left.requests)
        .slice(0, 10)
    };
  }
}
