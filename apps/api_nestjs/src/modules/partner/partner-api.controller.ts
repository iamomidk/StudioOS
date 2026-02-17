import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';

import {
  PartnerApiKeyGuard,
  type PartnerAuthenticatedRequest
} from './auth/partner-api-key.guard.js';
import { PartnerScopes } from './auth/partner-scope.decorator.js';
import { PartnerBookingCreateDto } from './dto/partner-booking.dto.js';
import { PartnerLeadCreateDto } from './dto/partner-lead.dto.js';
import {
  PartnerInventoryAvailabilityDto,
  PartnerOrganizationQueryDto
} from './dto/partner-query.dto.js';
import { PartnerRentalCreateDto } from './dto/partner-rental.dto.js';
import { PartnerApiService } from './partner-api.service.js';
import { PartnerUsageInterceptor } from './partner-usage.interceptor.js';
import { PartnerService } from './partner.service.js';

@Controller('api/partner/v1')
@UseGuards(PartnerApiKeyGuard)
@UseInterceptors(PartnerUsageInterceptor)
export class PartnerApiController {
  constructor(
    private readonly partnerApi: PartnerApiService,
    private readonly partner: PartnerService
  ) {}

  @Get('leads')
  @PartnerScopes('leads:read')
  listLeads(
    @Query() query: PartnerOrganizationQueryDto,
    @Req() request: PartnerAuthenticatedRequest
  ) {
    this.partner.assertTenant(request.partner!.organizationId, query.organizationId);
    return this.partnerApi.listLeads(query);
  }

  @Post('leads')
  @PartnerScopes('leads:write')
  async createLead(
    @Body() dto: PartnerLeadCreateDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: PartnerAuthenticatedRequest
  ) {
    this.partner.assertTenant(request.partner!.organizationId, dto.organizationId);
    this.partnerApi.assertIdempotencyHeader(idempotencyKey);

    const result = await this.partner.idempotentWrite(
      {
        credentialId: request.partner!.credentialId,
        organizationId: dto.organizationId,
        method: 'POST',
        path: '/api/partner/v1/leads',
        idempotencyKey: idempotencyKey!,
        payload: dto
      },
      async () => ({
        statusCode: 201,
        body: await this.partnerApi.createLead(dto)
      })
    );

    return result.body;
  }

  @Get('bookings')
  @PartnerScopes('bookings:read')
  listBookings(
    @Query() query: PartnerOrganizationQueryDto,
    @Req() request: PartnerAuthenticatedRequest
  ) {
    this.partner.assertTenant(request.partner!.organizationId, query.organizationId);
    return this.partnerApi.listBookings(query);
  }

  @Post('bookings')
  @PartnerScopes('bookings:write')
  async createBooking(
    @Body() dto: PartnerBookingCreateDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: PartnerAuthenticatedRequest
  ) {
    this.partner.assertTenant(request.partner!.organizationId, dto.organizationId);
    this.partnerApi.assertIdempotencyHeader(idempotencyKey);

    const result = await this.partner.idempotentWrite(
      {
        credentialId: request.partner!.credentialId,
        organizationId: dto.organizationId,
        method: 'POST',
        path: '/api/partner/v1/bookings',
        idempotencyKey: idempotencyKey!,
        payload: dto
      },
      async () => ({
        statusCode: 201,
        body: await this.partnerApi.createBooking(dto)
      })
    );

    return result.body;
  }

  @Get('bookings/:bookingId')
  @PartnerScopes('bookings:read')
  getBookingStatus(
    @Param('bookingId') bookingId: string,
    @Query() query: PartnerOrganizationQueryDto,
    @Req() request: PartnerAuthenticatedRequest
  ) {
    this.partner.assertTenant(request.partner!.organizationId, query.organizationId);
    return this.partnerApi.getBookingStatus(bookingId, query);
  }

  @Get('inventory/availability')
  @PartnerScopes('inventory:read')
  inventoryAvailability(
    @Query() query: PartnerInventoryAvailabilityDto,
    @Req() request: PartnerAuthenticatedRequest
  ) {
    this.partner.assertTenant(request.partner!.organizationId, query.organizationId);
    return this.partnerApi.inventoryAvailability(query);
  }

  @Post('rentals')
  @PartnerScopes('rentals:write')
  async createRental(
    @Body() dto: PartnerRentalCreateDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: PartnerAuthenticatedRequest
  ) {
    this.partner.assertTenant(request.partner!.organizationId, dto.organizationId);
    this.partnerApi.assertIdempotencyHeader(idempotencyKey);

    const result = await this.partner.idempotentWrite(
      {
        credentialId: request.partner!.credentialId,
        organizationId: dto.organizationId,
        method: 'POST',
        path: '/api/partner/v1/rentals',
        idempotencyKey: idempotencyKey!,
        payload: dto
      },
      async () => ({
        statusCode: 201,
        body: await this.partnerApi.createRental(dto)
      })
    );

    return result.body;
  }

  @Get('rentals/:rentalOrderId')
  @PartnerScopes('rentals:read')
  getRentalStatus(
    @Param('rentalOrderId') rentalOrderId: string,
    @Query() query: PartnerOrganizationQueryDto,
    @Req() request: PartnerAuthenticatedRequest
  ) {
    this.partner.assertTenant(request.partner!.organizationId, query.organizationId);
    return this.partnerApi.getRentalStatus(rentalOrderId, query);
  }

  @Get('invoices/:invoiceId')
  @PartnerScopes('invoices:read')
  getInvoiceStatus(
    @Param('invoiceId') invoiceId: string,
    @Query() query: PartnerOrganizationQueryDto,
    @Req() request: PartnerAuthenticatedRequest
  ) {
    this.partner.assertTenant(request.partner!.organizationId, query.organizationId);
    return this.partnerApi.getInvoiceStatus(invoiceId, query);
  }
}
