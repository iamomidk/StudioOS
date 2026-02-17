import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { UpdateBookingDto } from './dto/update-booking.dto.js';

type BookingStatus = 'draft' | 'confirmed' | 'cancelled' | 'completed';

interface ConflictItem {
  bookingId: string;
  startsAt: string;
  endsAt: string;
  title: string;
  status: BookingStatus;
}

interface ConflictPayload {
  code: 'BOOKING_CONFLICT';
  message: string;
  requested: {
    startsAt: string;
    endsAt: string;
  };
  conflicts: ConflictItem[];
}

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listBookings(organizationId: string) {
    return this.prisma.booking.findMany({
      where: { organizationId },
      orderBy: { startsAt: 'asc' }
    });
  }

  async createBooking(dto: CreateBookingDto, actor?: AccessClaims) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.assertValidWindow(startsAt, endsAt);

    await this.assertNoConflicts(dto.organizationId, startsAt, endsAt);

    const booking = await this.prisma.booking.create({
      data: {
        organizationId: dto.organizationId,
        clientId: dto.clientId,
        title: dto.title,
        startsAt,
        endsAt,
        status: 'draft'
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'Booking',
        entityId: booking.id,
        action: 'booking.created',
        metadata: {
          startsAt: booking.startsAt,
          endsAt: booking.endsAt
        }
      }
    });

    return booking;
  }

  async updateBooking(bookingId: string, dto: UpdateBookingDto, actor?: AccessClaims) {
    const existing = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!existing) {
      throw new NotFoundException('Booking not found');
    }

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
    this.assertValidWindow(startsAt, endsAt);

    await this.assertNoConflicts(existing.organizationId, startsAt, endsAt, bookingId);

    const updateData: {
      title?: string;
      startsAt?: Date;
      endsAt?: Date;
      status?: BookingStatus;
    } = {};

    if (dto.title !== undefined) {
      updateData.title = dto.title;
    }
    if (dto.startsAt !== undefined) {
      updateData.startsAt = startsAt;
    }
    if (dto.endsAt !== undefined) {
      updateData.endsAt = endsAt;
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }

    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: updateData
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: existing.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'Booking',
        entityId: booking.id,
        action: 'booking.updated',
        metadata: {
          changed: Object.keys(dto)
        }
      }
    });

    return booking;
  }

  private assertValidWindow(startsAt: Date, endsAt: Date): void {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new BadRequestException('Invalid booking time window');
    }
  }

  private async assertNoConflicts(
    organizationId: string,
    startsAt: Date,
    endsAt: Date,
    excludeBookingId?: string
  ): Promise<void> {
    const conflicts = await this.prisma.booking.findMany({
      where: {
        organizationId,
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        status: {
          in: ['draft', 'confirmed']
        }
      },
      orderBy: { startsAt: 'asc' }
    });

    if (conflicts.length === 0) {
      return;
    }

    const payload: ConflictPayload = {
      code: 'BOOKING_CONFLICT',
      message: 'Requested booking window overlaps existing bookings',
      requested: {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString()
      },
      conflicts: conflicts.map((booking) => ({
        bookingId: booking.id,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        title: booking.title,
        status: booking.status as BookingStatus
      }))
    };

    throw new ConflictException(payload);
  }
}
