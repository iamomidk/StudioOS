import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { BillingService } from './billing.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { ListInvoicesDto } from './dto/list-invoices.dto.js';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto.js';
import { UpdateInvoiceTotalsDto } from './dto/update-invoice-totals.dto.js';

@Controller('billing/invoices')
@UseGuards(AccessTokenGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  listInvoices(@Query() query: ListInvoicesDto) {
    return this.billingService.listInvoices(query.organizationId);
  }

  @Post()
  createInvoice(@Body() dto: CreateInvoiceDto, @Req() request: AuthenticatedRequest) {
    return this.billingService.createInvoice(dto, request.user);
  }

  @Patch(':invoiceId/totals')
  updateTotals(
    @Param('invoiceId') invoiceId: string,
    @Query() query: ListInvoicesDto,
    @Body() dto: UpdateInvoiceTotalsDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.billingService.updateTotals(invoiceId, query.organizationId, dto, request.user);
  }

  @Patch(':invoiceId/status')
  updateStatus(
    @Param('invoiceId') invoiceId: string,
    @Query() query: ListInvoicesDto,
    @Body() dto: UpdateInvoiceStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.billingService.updateStatus(
      invoiceId,
      query.organizationId,
      dto.status,
      request.user
    );
  }
}
