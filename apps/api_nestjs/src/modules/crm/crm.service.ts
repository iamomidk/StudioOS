import { Injectable, NotFoundException } from '@nestjs/common';

import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLeadDto } from './dto/create-lead.dto.js';
import { UpdateLeadDto } from './dto/update-lead.dto.js';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async listLeads(organizationId: string) {
    return this.prisma.lead.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createLead(dto: CreateLeadDto, actor?: AccessClaims) {
    const leadData: {
      organizationId: string;
      name: string;
      email?: string | null;
      phone?: string | null;
      source?: string | null;
    } = {
      organizationId: dto.organizationId,
      name: dto.name
    };

    if (dto.email !== undefined) {
      leadData.email = dto.email;
    }
    if (dto.phone !== undefined) {
      leadData.phone = dto.phone;
    }
    if (dto.source !== undefined) {
      leadData.source = dto.source;
    }

    const lead = await this.prisma.lead.create({
      data: leadData
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'Lead',
        entityId: lead.id,
        action: 'lead.created',
        metadata: { name: lead.name }
      }
    });

    return lead;
  }

  async updateLead(leadId: string, dto: UpdateLeadDto, actor?: AccessClaims) {
    const existing = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!existing) {
      throw new NotFoundException('Lead not found');
    }

    const leadUpdateData: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      source?: string | null;
      status?: 'new' | 'contacted' | 'qualified' | 'archived';
    } = {};

    if (dto.name !== undefined) {
      leadUpdateData.name = dto.name;
    }
    if (dto.email !== undefined) {
      leadUpdateData.email = dto.email;
    }
    if (dto.phone !== undefined) {
      leadUpdateData.phone = dto.phone;
    }
    if (dto.source !== undefined) {
      leadUpdateData.source = dto.source;
    }
    if (dto.status !== undefined) {
      leadUpdateData.status = dto.status;
    }

    const lead = await this.prisma.lead.update({
      where: { id: leadId },
      data: leadUpdateData
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: existing.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'Lead',
        entityId: lead.id,
        action: 'lead.updated',
        metadata: {
          changed: Object.keys(dto)
        }
      }
    });

    return lead;
  }

  async convertLead(leadId: string, organizationId: string, actor?: AccessClaims) {
    const result = await this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({
        where: {
          id: leadId,
          organizationId
        }
      });

      if (!lead) {
        throw new NotFoundException('Lead not found');
      }

      const client = await tx.client.create({
        data: {
          organizationId,
          name: lead.name,
          email: lead.email,
          phone: lead.phone
        }
      });

      const convertedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: 'converted',
          convertedAt: new Date()
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'Lead',
          entityId: lead.id,
          action: 'lead.converted',
          metadata: {
            clientId: client.id
          }
        }
      });

      return { lead: convertedLead, client };
    });

    return result;
  }
}
