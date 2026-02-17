import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

const RENTAL_STATUSES = ['reserved', 'picked_up', 'returned', 'incident', 'cancelled'] as const;

export type RentalLifecycleStatus = (typeof RENTAL_STATUSES)[number];

export class UpdateRentalStatusDto {
  @IsIn(RENTAL_STATUSES)
  status!: RentalLifecycleStatus;

  @IsOptional()
  @IsString()
  baseVersion?: string;

  @IsOptional()
  @IsUUID()
  operationId?: string;

  @IsOptional()
  @IsString()
  deviceSessionId?: string;

  @IsOptional()
  @IsString()
  payloadHash?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  retryCount?: number;
}
