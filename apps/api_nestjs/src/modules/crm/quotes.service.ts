import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateQuoteDto } from './dto/create-quote.dto.js';

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

const STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent', 'expired'],
  sent: ['accepted', 'rejected', 'expired'],
  accepted: [],
  rejected: [],
  expired: []
};

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async listQuotes(organizationId: string) {
    return this.prisma.quote.findMany({
      where: { organizationId },
      include: { lineItems: true, booking: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createQuote(dto: CreateQuoteDto, actor?: AccessClaims) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new BadRequestException('Invalid quote time window');
    }

    const subtotalCents = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceCents,
      0
    );
    const taxCents = dto.taxCents ?? 0;
    const totalCents = subtotalCents + taxCents;

    const quote = await this.prisma.quote.create({
      data: {
        organizationId: dto.organizationId,
        clientId: dto.clientId,
        title: dto.title,
        startsAt,
        endsAt,
        subtotalCents,
        taxCents,
        totalCents,
        lineItems: {
          create: dto.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            lineTotalCents: item.quantity * item.unitPriceCents
          }))
        }
      },
      include: { lineItems: true }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'Quote',
        entityId: quote.id,
        action: 'quote.created',
        metadata: {
          totalCents
        }
      }
    });

    return quote;
  }

  async updateStatus(
    quoteId: string,
    organizationId: string,
    nextStatus: QuoteStatus,
    actor?: AccessClaims
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id: quoteId, organizationId }
      });

      if (!quote) {
        throw new NotFoundException('Quote not found');
      }

      if (quote.status === nextStatus) {
        return tx.quote.findUnique({
          where: { id: quote.id },
          include: { lineItems: true, booking: true }
        });
      }

      const allowed = STATUS_TRANSITIONS[quote.status as QuoteStatus] ?? [];
      if (!allowed.includes(nextStatus)) {
        throw new BadRequestException(
          `Invalid quote status transition: ${quote.status} -> ${nextStatus}`
        );
      }

      const updatedQuote = await tx.quote.update({
        where: { id: quote.id },
        data: { status: nextStatus }
      });

      let bookingId: string | null = null;
      if (nextStatus === 'accepted') {
        const existingBooking = await tx.booking.findFirst({ where: { quoteId: quote.id } });
        if (existingBooking) {
          throw new BadRequestException('Accepted quote already linked to a booking');
        }

        const booking = await tx.booking.create({
          data: {
            organizationId: quote.organizationId,
            clientId: quote.clientId,
            quoteId: quote.id,
            title: quote.title,
            startsAt: quote.startsAt,
            endsAt: quote.endsAt,
            status: 'draft'
          }
        });
        bookingId = booking.id;
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'Quote',
          entityId: quote.id,
          action: 'quote.status.updated',
          metadata: {
            from: quote.status,
            to: nextStatus,
            bookingId
          }
        }
      });

      return tx.quote.findUnique({
        where: { id: updatedQuote.id },
        include: { lineItems: true, booking: true }
      });
    });

    return result;
  }
}
