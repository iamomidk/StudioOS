import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

const bookingStatuses = ['draft', 'confirmed', 'cancelled', 'completed'] as const;

export class UpdateBookingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsEnum(bookingStatuses)
  status?: (typeof bookingStatuses)[number];
}
