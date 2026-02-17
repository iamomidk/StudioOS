import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class EvaluatePricingDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsOptional()
  @IsString()
  experimentKey?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  baseAmountCents!: number;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsIn(['web', 'mobile', 'api'])
  source?: 'web' | 'mobile' | 'api';
}
