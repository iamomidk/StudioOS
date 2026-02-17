import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const RENTAL_STATUSES = ['reserved', 'picked_up', 'returned', 'incident', 'cancelled'] as const;

export class ListRentalOrdersDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @IsIn(RENTAL_STATUSES)
  status?: (typeof RENTAL_STATUSES)[number];
}
