import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { AddTicketNoteDto } from './dto/add-ticket-note.dto.js';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto.js';
import { ListSupportTicketsDto } from './dto/list-support-tickets.dto.js';
import { SupportAdminActionDto } from './dto/support-admin-action.dto.js';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto.js';
import { SupportService } from './support.service.js';

@Controller('support')
@UseGuards(AccessTokenGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('tickets')
  createTicket(@Body() dto: CreateSupportTicketDto, @Req() request: AuthenticatedRequest) {
    return this.support.createTicket(dto, request.user);
  }

  @Get('tickets')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  listTickets(@Query() query: ListSupportTicketsDto) {
    return this.support.listTickets(query);
  }

  @Get('tickets/:ticketId')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  getTicket(@Param('ticketId') ticketId: string, @Query() query: ListSupportTicketsDto) {
    return this.support.getTicket(ticketId, query.organizationId);
  }

  @Patch('tickets/:ticketId/status')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  updateStatus(
    @Param('ticketId') ticketId: string,
    @Query() query: ListSupportTicketsDto,
    @Body() dto: UpdateTicketStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.support.updateStatus(ticketId, query.organizationId, dto, request.user);
  }

  @Post('tickets/:ticketId/notes')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  addNote(
    @Param('ticketId') ticketId: string,
    @Query() query: ListSupportTicketsDto,
    @Body() dto: AddTicketNoteDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.support.addNote(ticketId, query.organizationId, dto, request.user);
  }

  @Post('admin-actions/resend-notification')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  resendNotification(@Body() dto: SupportAdminActionDto, @Req() request: AuthenticatedRequest) {
    return this.support.resendNotification(dto, request.user);
  }

  @Post('admin-actions/retry-webhook')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  retryWebhook(@Body() dto: SupportAdminActionDto, @Req() request: AuthenticatedRequest) {
    return this.support.retryWebhook(dto, request.user);
  }

  @Post('admin-actions/requeue-job')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  requeueJob(@Body() dto: SupportAdminActionDto, @Req() request: AuthenticatedRequest) {
    return this.support.requeueJob(dto, request.user);
  }
}
