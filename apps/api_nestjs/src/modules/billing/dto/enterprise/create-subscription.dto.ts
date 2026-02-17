import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEnterpriseSubscriptionDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsString()
  @MinLength(1)
  planId!: string;

  @IsString()
  @MinLength(1)
  planVersionId!: string;

  @IsISO8601()
  startsAt!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  seatQuantities?: Record<string, number>;
}
