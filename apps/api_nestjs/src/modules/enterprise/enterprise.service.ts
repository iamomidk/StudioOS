import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import bcrypt from 'bcryptjs';

import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApprovePurgeDto } from './dto/approve-purge.dto.js';
import { DeactivateProvisionedUserDto } from './dto/deactivate-provisioned-user.dto.js';
import { ExportComplianceDto } from './dto/export-compliance.dto.js';
import { RequestPurgeDto } from './dto/request-purge.dto.js';
import { UpdateEnterpriseSettingsDto } from './dto/update-enterprise-settings.dto.js';
import { UpsertProvisionedUserDto } from './dto/upsert-provisioned-user.dto.js';

@Injectable()
export class EnterpriseService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        ssoEnforced: true,
        ssoProvider: true,
        ssoDomains: true,
        enterpriseScimEnabled: true,
        sessionDurationMinutes: true,
        mfaEnforced: true,
        ipAllowlist: true,
        retentionDays: true
      }
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async updateSettings(dto: UpdateEnterpriseSettingsDto, actor?: AccessClaims) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true }
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const updated = await this.prisma.organization.update({
      where: { id: dto.organizationId },
      data: {
        ...(dto.ssoEnforced !== undefined ? { ssoEnforced: dto.ssoEnforced } : {}),
        ...(dto.ssoProvider !== undefined ? { ssoProvider: dto.ssoProvider } : {}),
        ...(dto.ssoDomains !== undefined ? { ssoDomains: dto.ssoDomains } : {}),
        ...(dto.enterpriseScimEnabled !== undefined
          ? { enterpriseScimEnabled: dto.enterpriseScimEnabled }
          : {}),
        ...(dto.sessionDurationMinutes !== undefined
          ? { sessionDurationMinutes: dto.sessionDurationMinutes }
          : {}),
        ...(dto.mfaEnforced !== undefined ? { mfaEnforced: dto.mfaEnforced } : {}),
        ...(dto.ipAllowlist !== undefined ? { ipAllowlist: dto.ipAllowlist } : {}),
        ...(dto.retentionDays !== undefined ? { retentionDays: dto.retentionDays } : {})
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'Organization',
        entityId: dto.organizationId,
        action: 'enterprise.settings.updated',
        metadata: {
          reason: dto.reason,
          changed: {
            ssoEnforced: dto.ssoEnforced,
            ssoProvider: dto.ssoProvider,
            ssoDomains: dto.ssoDomains,
            enterpriseScimEnabled: dto.enterpriseScimEnabled,
            sessionDurationMinutes: dto.sessionDurationMinutes,
            mfaEnforced: dto.mfaEnforced,
            ipAllowlist: dto.ipAllowlist,
            retentionDays: dto.retentionDays
          }
        }
      }
    });

    return updated;
  }

  async upsertProvisionedUser(dto: UpsertProvisionedUserDto, actor?: AccessClaims) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true, enterpriseScimEnabled: true }
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (!organization.enterpriseScimEnabled) {
      throw new ForbiddenException('SCIM provisioning is disabled for this organization');
    }

    const user = await this.prisma.user.upsert({
      where: { email: dto.email },
      update: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        mfaEnabled: dto.mfaEnabled ?? false,
        deletedAt: null
      },
      create: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash: await bcrypt.hash(randomUUID(), 10),
        mfaEnabled: dto.mfaEnabled ?? false
      }
    });

    await this.prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: dto.organizationId,
          userId: user.id
        }
      },
      update: {
        role: dto.role
      },
      create: {
        organizationId: dto.organizationId,
        userId: user.id,
        role: dto.role
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'User',
        entityId: user.id,
        action: 'enterprise.scim.user.upserted',
        metadata: {
          email: dto.email,
          role: dto.role,
          mfaEnabled: dto.mfaEnabled ?? false
        }
      }
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: dto.role,
      mfaEnabled: user.mfaEnabled,
      deactivatedAt: user.deactivatedAt
    };
  }

  async deactivateProvisionedUser(
    userId: string,
    dto: DeactivateProvisionedUserDto,
    actor?: AccessClaims
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId: dto.organizationId,
        userId
      }
    });
    if (!membership) {
      throw new NotFoundException('User is not a member of this organization');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        deactivatedAt: new Date()
      }
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'User',
        entityId: userId,
        action: 'enterprise.scim.user.deactivated',
        metadata: {
          reason: dto.reason,
          ticketId: dto.ticketId ?? null
        }
      }
    });

    return {
      id: user.id,
      email: user.email,
      deactivatedAt: user.deactivatedAt
    };
  }

  async requestPurge(userId: string, dto: RequestPurgeDto, actor?: AccessClaims) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId: dto.organizationId,
        userId
      }
    });
    if (!membership) {
      throw new NotFoundException('User is not a member of this organization');
    }

    const requestRecord = await this.prisma.enterprisePurgeRequest.create({
      data: {
        organizationId: dto.organizationId,
        targetUserId: userId,
        requestedByUserId: actor?.sub ?? userId,
        reason: dto.reason
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'EnterprisePurgeRequest',
        entityId: requestRecord.id,
        action: 'enterprise.user.purge.requested',
        metadata: {
          targetUserId: userId,
          reason: dto.reason
        }
      }
    });

    return requestRecord;
  }

  async approvePurge(requestId: string, dto: ApprovePurgeDto, actor?: AccessClaims) {
    if (!actor?.sub) {
      throw new ForbiddenException('Actor required');
    }

    const requestRecord = await this.prisma.enterprisePurgeRequest.findFirst({
      where: {
        id: requestId,
        organizationId: dto.organizationId
      }
    });
    if (!requestRecord) {
      throw new NotFoundException('Purge request not found');
    }
    if (requestRecord.status !== 'pending') {
      throw new BadRequestException('Purge request is not pending');
    }

    const approved = await this.prisma.enterprisePurgeRequest.update({
      where: { id: requestId },
      data: {
        status: dto.executeNow ? 'executed' : 'approved',
        approvedByUserId: actor.sub,
        approvalReason: dto.reason,
        approvedAt: new Date(),
        ...(dto.executeNow ? { executedAt: new Date() } : {})
      }
    });

    if (dto.executeNow) {
      await this.prisma.user.update({
        where: { id: approved.targetUserId },
        data: {
          deactivatedAt: new Date(),
          deletedAt: new Date()
        }
      });
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor.sub,
        entityType: 'EnterprisePurgeRequest',
        entityId: requestId,
        action: 'enterprise.user.purge.approved',
        metadata: {
          executeNow: dto.executeNow ?? false,
          reason: dto.reason
        }
      }
    });

    return approved;
  }

  async exportAuditLogs(query: ExportComplianceDto, actor?: AccessClaims) {
    return this.runExport('audit_logs', query, actor?.sub, async (from, to) => {
      return this.prisma.auditLog.findMany({
        where: {
          organizationId: query.organizationId,
          createdAt: {
            gte: from,
            lte: to
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    });
  }

  async exportAdminActionLogs(query: ExportComplianceDto, actor?: AccessClaims) {
    return this.runExport('admin_actions', query, actor?.sub, async (from, to) => {
      return this.prisma.auditLog.findMany({
        where: {
          organizationId: query.organizationId,
          createdAt: {
            gte: from,
            lte: to
          },
          OR: [
            { action: { startsWith: 'support.admin.' } },
            { action: { startsWith: 'partner.credential.' } },
            { action: { startsWith: 'enterprise.' } }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });
    });
  }

  async exportAccessLogs(query: ExportComplianceDto, actor?: AccessClaims) {
    return this.runExport('access_logs', query, actor?.sub, async (from, to) => {
      return this.prisma.auditLog.findMany({
        where: {
          organizationId: query.organizationId,
          createdAt: {
            gte: from,
            lte: to
          },
          action: 'auth.login.succeeded'
        },
        orderBy: { createdAt: 'desc' }
      });
    });
  }

  private async runExport(
    exportType: string,
    query: ExportComplianceDto,
    actorUserId: string | undefined,
    run: (from: Date, to: Date) => Promise<unknown[]>
  ) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

    const rows = await run(from, to);

    const exportRecord = await this.prisma.complianceExportRecord.create({
      data: {
        organizationId: query.organizationId,
        actorUserId: actorUserId ?? null,
        exportType,
        dateFrom: from,
        dateTo: to,
        rowCount: rows.length
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: query.organizationId,
        actorUserId: actorUserId ?? null,
        entityType: 'ComplianceExportRecord',
        entityId: exportRecord.id,
        action: 'enterprise.export.generated',
        metadata: {
          exportType,
          rowCount: rows.length,
          from: from.toISOString(),
          to: to.toISOString()
        }
      }
    });

    return {
      export: {
        id: exportRecord.id,
        type: exportType,
        from: from.toISOString(),
        to: to.toISOString(),
        rowCount: rows.length,
        generatedAt: exportRecord.createdAt.toISOString()
      },
      rows
    };
  }
}
