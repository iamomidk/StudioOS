import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { BookingsService } from './bookings.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { ListBookingsDto } from './dto/list-bookings.dto.js';
import { UpdateBookingDto } from './dto/update-booking.dto.js';

@Controller('bookings')
@UseGuards(AccessTokenGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  listBookings(@Query() query: ListBookingsDto) {
    return this.bookingsService.listBookings(query.organizationId);
  }

  @Post()
  createBooking(@Body() dto: CreateBookingDto, @Req() request: AuthenticatedRequest) {
    return this.bookingsService.createBooking(dto, request.user);
  }

  @Patch(':bookingId')
  updateBooking(
    @Param('bookingId') bookingId: string,
    @Body() dto: UpdateBookingDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.bookingsService.updateBooking(bookingId, dto, request.user);
  }
}
