import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { CrmService } from '../crm/crm.service.js';
import { RentalsService } from '../rentals/rentals.service.js';
import { PartnerBookingCreateDto } from './dto/partner-booking.dto.js';
import { PartnerLeadCreateDto } from './dto/partner-lead.dto.js';
import {
  PartnerOrganizationQueryDto,
  PartnerInventoryAvailabilityDto
} from './dto/partner-query.dto.js';
import { PartnerRentalCreateDto } from './dto/partner-rental.dto.js';

@Injectable()
export class PartnerApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crm: CrmService,
    private readonly bookings: BookingsService,
    private readonly rentals: RentalsService
  ) {}

  async listLeads(query: PartnerOrganizationQueryDto) {
    return this.crm.listLeads(query.organizationId);
  }

  async createLead(dto: PartnerLeadCreateDto) {
    return this.crm.createLead({
      organizationId: dto.organizationId,
      name: dto.name,
      ...(dto.email ? { email: dto.email } : {}),
      ...(dto.phone ? { phone: dto.phone } : {}),
      source: 'partner-api'
    });
  }

  async listBookings(query: PartnerOrganizationQueryDto) {
    return this.bookings.listBookings(query.organizationId);
  }

  async createBooking(dto: PartnerBookingCreateDto) {
    return this.bookings.createBooking({
      organizationId: dto.organizationId,
      clientId: dto.clientId,
      title: dto.title,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt
    });
  }

  async getBookingStatus(bookingId: string, query: PartnerOrganizationQueryDto) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        organizationId: query.organizationId
      },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true
      }
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async inventoryAvailability(query: PartnerInventoryAvailabilityDto) {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.category
          ? {
              asset: {
                category: {
                  contains: query.category,
                  mode: 'insensitive'
                }
              }
            }
          : {})
      },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            category: true
          }
        },
        rentalOrders: {
          where: {
            status: {
              in: ['reserved', 'picked_up', 'incident']
            }
          },
          select: { id: true }
        }
      },
      take: 200
    });

    return {
      organizationId: query.organizationId,
      items: items.map((item) => ({
        inventoryItemId: item.id,
        assetId: item.asset.id,
        assetName: item.asset.name,
        category: item.asset.category,
        serialNumber: item.serialNumber,
        available: item.rentalOrders.length === 0
      }))
    };
  }

  async createRental(dto: PartnerRentalCreateDto) {
    return this.rentals.createOrder({
      organizationId: dto.organizationId,
      inventoryItemId: dto.inventoryItemId,
      ...(dto.clientId ? { clientId: dto.clientId } : {}),
      startsAt: dto.startsAt,
      endsAt: dto.endsAt
    });
  }

  async getRentalStatus(rentalOrderId: string, query: PartnerOrganizationQueryDto) {
    const rental = await this.prisma.rentalOrder.findFirst({
      where: {
        id: rentalOrderId,
        organizationId: query.organizationId
      },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true
      }
    });

    if (!rental) {
      throw new NotFoundException('Rental order not found');
    }

    return rental;
  }

  async getInvoiceStatus(invoiceId: string, query: PartnerOrganizationQueryDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId: query.organizationId
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalCents: true,
        dueAt: true,
        issuedAt: true
      }
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  assertIdempotencyHeader(idempotencyKey: string | undefined) {
    if (!idempotencyKey || idempotencyKey.trim().length < 8) {
      throw new BadRequestException(
        'Idempotency-Key header is required for partner write endpoints'
      );
    }
  }
}
