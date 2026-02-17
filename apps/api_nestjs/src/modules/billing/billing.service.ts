import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueueProducerService } from '../queues/queue.producer.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import type { InvoiceLifecycleStatus } from './dto/update-invoice-status.dto.js';
import { UpdateInvoiceTotalsDto } from './dto/update-invoice-totals.dto.js';

const STATUS_TRANSITIONS: Record<InvoiceLifecycleStatus, InvoiceLifecycleStatus[]> = {
  draft: ['issued', 'cancelled'],
  issued: ['partially_paid', 'paid', 'overdue', 'cancelled'],
  partially_paid: ['paid', 'overdue', 'cancelled'],
  overdue: ['partially_paid', 'paid', 'cancelled'],
  paid: [],
  cancelled: []
};

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueProducer: QueueProducerService
  ) {}

  async listInvoices(organizationId: string) {
    return this.prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createInvoice(dto: CreateInvoiceDto, actor?: AccessClaims) {
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      throw new BadRequestException('Invalid invoice due date');
    }

    try {
      const invoice = await this.prisma.invoice.create({
        data: {
          organizationId: dto.organizationId,
          clientId: dto.clientId,
          invoiceNumber: dto.invoiceNumber,
          subtotalCents: dto.subtotalCents,
          taxCents: dto.taxCents,
          totalCents: dto.subtotalCents + dto.taxCents,
          dueAt
        }
      });

      await this.prisma.auditLog.create({
        data: {
          organizationId: dto.organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'Invoice',
          entityId: invoice.id,
          action: 'invoice.created',
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            totalCents: invoice.totalCents
          }
        }
      });

      return invoice;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Invoice number already exists for organization');
      }
      throw error;
    }
  }

  async updateTotals(
    invoiceId: string,
    organizationId: string,
    dto: UpdateInvoiceTotalsDto,
    actor?: AccessClaims
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId }
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status !== 'draft') {
      throw new BadRequestException('Invoice totals are immutable after issue');
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        subtotalCents: dto.subtotalCents,
        taxCents: dto.taxCents,
        totalCents: dto.subtotalCents + dto.taxCents
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'Invoice',
        entityId: invoice.id,
        action: 'invoice.totals.updated',
        metadata: {
          subtotalCents: updated.subtotalCents,
          taxCents: updated.taxCents,
          totalCents: updated.totalCents
        }
      }
    });

    return updated;
  }

  async updateStatus(
    invoiceId: string,
    organizationId: string,
    nextStatus: InvoiceLifecycleStatus,
    actor?: AccessClaims
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, organizationId }
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status === nextStatus) {
        return invoice;
      }

      const allowed = STATUS_TRANSITIONS[invoice.status as InvoiceLifecycleStatus] ?? [];
      if (!allowed.includes(nextStatus)) {
        throw new BadRequestException(
          `Invalid invoice status transition: ${invoice.status} -> ${nextStatus}`
        );
      }

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: nextStatus,
          issuedAt: nextStatus === 'issued' ? (invoice.issuedAt ?? new Date()) : invoice.issuedAt
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'Invoice',
          entityId: invoice.id,
          action: 'invoice.status.updated',
          metadata: {
            from: invoice.status,
            to: nextStatus
          }
        }
      });

      if (nextStatus === 'issued' && updated.dueAt) {
        await this.queueProducer.enqueueInvoiceReminder({
          invoiceId: updated.id,
          organizationId,
          reminderType: 'upcoming_due'
        });
      }

      return updated;
    });
  }
}
