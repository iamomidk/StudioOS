import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { CreateRentalEvidenceDto } from './dto/create-rental-evidence.dto.js';
import { CreateRentalOrderDto } from './dto/create-rental-order.dto.js';
import { ListRentalEvidenceDto } from './dto/list-rental-evidence.dto.js';
import { ListRentalOrdersDto } from './dto/list-rental-orders.dto.js';
import { UpdateRentalStatusDto } from './dto/update-rental-status.dto.js';
import { RentalsService } from './rentals.service.js';

@Controller('rentals')
@UseGuards(AccessTokenGuard)
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Get()
  listOrders(@Query() query: ListRentalOrdersDto) {
    return this.rentalsService.listOrders(query.organizationId, query.status);
  }

  @Post()
  createOrder(@Body() dto: CreateRentalOrderDto, @Req() request: AuthenticatedRequest) {
    return this.rentalsService.createOrder(dto, request.user);
  }

  @Patch(':rentalOrderId/status')
  updateStatus(
    @Param('rentalOrderId') rentalOrderId: string,
    @Query() query: ListRentalOrdersDto,
    @Body() dto: UpdateRentalStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.rentalsService.updateStatus(
      rentalOrderId,
      query.organizationId,
      dto.status,
      request.user
    );
  }

  @Post(':rentalOrderId/evidence')
  createEvidence(
    @Param('rentalOrderId') rentalOrderId: string,
    @Body() dto: CreateRentalEvidenceDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.rentalsService.createEvidence(rentalOrderId, dto, request.user);
  }

  @Get(':rentalOrderId/evidence')
  listEvidence(
    @Param('rentalOrderId') rentalOrderId: string,
    @Query() query: ListRentalEvidenceDto
  ) {
    return this.rentalsService.listEvidence(rentalOrderId, query);
  }
}
