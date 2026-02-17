import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { ConvertLeadDto } from './dto/convert-lead.dto.js';
import { CreateLeadDto } from './dto/create-lead.dto.js';
import { ListLeadsDto } from './dto/list-leads.dto.js';
import { UpdateLeadDto } from './dto/update-lead.dto.js';
import { CrmService } from './crm.service.js';

@Controller('crm/leads')
@UseGuards(AccessTokenGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get()
  listLeads(@Query() query: ListLeadsDto) {
    return this.crmService.listLeads(query.organizationId);
  }

  @Post()
  createLead(@Body() dto: CreateLeadDto, @Req() request: AuthenticatedRequest) {
    return this.crmService.createLead(dto, request.user);
  }

  @Patch(':leadId')
  updateLead(
    @Param('leadId') leadId: string,
    @Body() dto: UpdateLeadDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.crmService.updateLead(leadId, dto, request.user);
  }

  @Post(':leadId/convert')
  convertLead(
    @Param('leadId') leadId: string,
    @Body() dto: ConvertLeadDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.crmService.convertLead(leadId, dto.organizationId, request.user);
  }
}
