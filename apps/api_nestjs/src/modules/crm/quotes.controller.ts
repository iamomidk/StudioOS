import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { CreateQuoteDto } from './dto/create-quote.dto.js';
import { ListQuotesDto } from './dto/list-quotes.dto.js';
import { UpdateQuoteStatusDto } from './dto/update-quote-status.dto.js';
import { QuotesService } from './quotes.service.js';

@Controller('crm/quotes')
@UseGuards(AccessTokenGuard)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get()
  listQuotes(@Query() query: ListQuotesDto) {
    return this.quotesService.listQuotes(query.organizationId);
  }

  @Post()
  createQuote(@Body() dto: CreateQuoteDto, @Req() request: AuthenticatedRequest) {
    return this.quotesService.createQuote(dto, request.user);
  }

  @Patch(':quoteId/status')
  updateStatus(
    @Param('quoteId') quoteId: string,
    @Query() query: ListQuotesDto,
    @Body() dto: UpdateQuoteStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.quotesService.updateStatus(quoteId, query.organizationId, dto.status, request.user);
  }
}
