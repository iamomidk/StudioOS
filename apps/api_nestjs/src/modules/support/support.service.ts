import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppConfigService } from '../../config/app-config.service.js';
import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { QueueProducerService } from '../queues/queue.producer.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddTicketNoteDto } from './dto/add-ticket-note.dto.js';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto.js';
import { ListSupportTicketsDto } from './dto/list-support-tickets.dto.js';
import { SupportAdminActionDto } from './dto/support-admin-action.dto.js';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto.js';
import { SupportSlaService } from './sla.service.js';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly queues: QueueProducerService,
    private readonly sla: SupportSlaService
  ) {}

  async createTicket(dto: CreateSupportTicketDto, actor?: AccessClaims) {
    await this.enforceSubmissionRateLimit(dto.organizationId, actor?.sub);
    this.validateAttachments(dto.attachments);

    const ticket = await this.prisma.supportTicket.create({
      data: {
        organizationId: dto.organizationId,
        reporterUserId: actor?.sub ?? null,
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        routePath: dto.routePath ?? null,
        screenName: dto.screenName ?? null,
        appVersion: dto.appVersion ?? null,
        correlationId: dto.correlationId ?? null,
        requestId: dto.requestId ?? null,
        attachments: dto.attachments
          ? (dto.attachments as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'SupportTicket',
        entityId: ticket.id,
        action: 'support.ticket.created',
        metadata: {
          severity: ticket.severity,
          source: dto.source ?? 'api'
        }
      }
    });

    if (ticket.severity === 'p0' || ticket.severity === 'p1') {
      await this.sendPriorityAlert(ticket.id, ticket.organizationId, ticket.severity, dto.title);
    }

    await this.sla.initializeTicketSla({
      ticketId: ticket.id,
      organizationId: ticket.organizationId,
      severity: ticket.severity,
      startedAt: ticket.createdAt
    });

    return ticket;
  }

  async listTickets(query: ListSupportTicketsDto) {
    return this.prisma.supportTicket.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.severity ? { severity: query.severity } : {}),
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50
    });
  }

  async getTicket(ticketId: string, organizationId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, organizationId },
      include: {
        notes: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    const [recentAuditLogs, recentErrors] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      this.prisma.auditLog.findMany({
        where: {
          organizationId,
          OR: [
            { action: { contains: 'failed', mode: 'insensitive' } },
            { action: { contains: 'error', mode: 'insensitive' } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    return {
      ...ticket,
      diagnostics: {
        recentAuditLogs,
        recentErrors
      }
    };
  }

  async updateStatus(
    ticketId: string,
    organizationId: string,
    dto: UpdateTicketStatusDto,
    actor?: AccessClaims
  ) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, organizationId }
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: dto.status,
        resolvedAt:
          dto.status === 'resolved' || dto.status === 'closed' ? new Date() : ticket.resolvedAt
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'SupportTicket',
        entityId: ticket.id,
        action: 'support.ticket.status.updated',
        metadata: {
          from: ticket.status,
          to: dto.status
        }
      }
    });

    if (!ticket.status || (ticket.status === 'open' && dto.status !== 'open')) {
      await this.sla.markFirstResponse(ticket.id);
    }
    await this.sla.onStatusChanged(ticket.id, ticket.status, dto.status);

    return updated;
  }

  async addNote(
    ticketId: string,
    organizationId: string,
    dto: AddTicketNoteDto,
    actor?: AccessClaims
  ) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, organizationId }
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    const note = await this.prisma.supportTicketNote.create({
      data: {
        ticketId: ticket.id,
        authorUserId: actor?.sub ?? null,
        note: dto.note
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'SupportTicket',
        entityId: ticket.id,
        action: 'support.ticket.note.added',
        metadata: { noteId: note.id }
      }
    });

    await this.sla.markFirstResponse(ticket.id);

    return note;
  }

  async resendNotification(dto: SupportAdminActionDto, actor?: AccessClaims) {
    this.assertAdminActionsEnabled();
    await this.ensureTicketExists(dto.ticketId, dto.organizationId);

    await this.queues.enqueueNotification({
      recipientUserId: 'support-ops',
      channel: 'email',
      template: 'support-ticket-resend',
      variables: {
        organizationId: dto.organizationId,
        ticketId: dto.ticketId,
        referenceId: dto.referenceId ?? ''
      }
    });

    await this.createAdminActionAudit(
      dto.organizationId,
      dto.ticketId,
      actor?.sub,
      'resend_notification',
      {
        referenceId: dto.referenceId ?? null
      }
    );

    return { status: 'accepted' };
  }

  async retryWebhook(dto: SupportAdminActionDto, actor?: AccessClaims) {
    this.assertAdminActionsEnabled();
    await this.ensureTicketExists(dto.ticketId, dto.organizationId);

    await this.createAdminActionAudit(
      dto.organizationId,
      dto.ticketId,
      actor?.sub,
      'retry_webhook',
      {
        referenceId: dto.referenceId ?? null
      }
    );

    return { status: 'accepted' };
  }

  async requeueJob(dto: SupportAdminActionDto, actor?: AccessClaims) {
    this.assertAdminActionsEnabled();
    await this.ensureTicketExists(dto.ticketId, dto.organizationId);

    await this.queues.enqueueNotification({
      recipientUserId: 'support-ops',
      channel: 'email',
      template: 'support-job-requeue',
      variables: {
        organizationId: dto.organizationId,
        ticketId: dto.ticketId,
        referenceId: dto.referenceId ?? ''
      }
    });

    await this.createAdminActionAudit(dto.organizationId, dto.ticketId, actor?.sub, 'requeue_job', {
      referenceId: dto.referenceId ?? null
    });

    return { status: 'accepted' };
  }

  private async enforceSubmissionRateLimit(organizationId: string, reporterUserId?: string) {
    const since = new Date(Date.now() - 60 * 1000);
    const count = await this.prisma.supportTicket.count({
      where: {
        organizationId,
        ...(reporterUserId ? { reporterUserId } : {}),
        createdAt: { gte: since }
      }
    });

    if (count >= this.config.supportMaxSubmissionsPerMinute) {
      throw new HttpException('Support submission rate limit exceeded', 429);
    }
  }

  private validateAttachments(
    attachments: Array<{ contentType: string; sizeBytes: number }> | undefined
  ) {
    if (!attachments || attachments.length === 0) {
      return;
    }

    for (const attachment of attachments) {
      if (!this.config.supportAllowedAttachmentTypes.includes(attachment.contentType)) {
        throw new BadRequestException(`Unsupported attachment type: ${attachment.contentType}`);
      }
      if (attachment.sizeBytes > this.config.supportMaxAttachmentBytes) {
        throw new BadRequestException('Attachment exceeds allowed max size');
      }
    }
  }

  private assertAdminActionsEnabled() {
    if (!this.config.featureSupportAdminActionsEnabled) {
      throw new ForbiddenException('Support admin actions are disabled');
    }
  }

  private async ensureTicketExists(ticketId: string, organizationId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, organizationId },
      select: { id: true }
    });
    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }
  }

  private async createAdminActionAudit(
    organizationId: string,
    ticketId: string,
    actorUserId: string | undefined,
    action: string,
    metadata: Record<string, unknown>
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actorUserId ?? null,
        entityType: 'SupportTicket',
        entityId: ticketId,
        action: `support.admin.${action}`,
        metadata: metadata as Prisma.InputJsonValue
      }
    });
  }

  private async sendPriorityAlert(
    ticketId: string,
    organizationId: string,
    severity: 'p0' | 'p1' | 'p2' | 'p3',
    title: string
  ) {
    if (!this.config.supportAlertWebhookUrl) {
      return;
    }

    try {
      await fetch(this.config.supportAlertWebhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          organizationId,
          severity,
          title,
          source: 'support-ticket'
        })
      });
    } catch {
      // Best-effort alerting only.
    }
  }
}
