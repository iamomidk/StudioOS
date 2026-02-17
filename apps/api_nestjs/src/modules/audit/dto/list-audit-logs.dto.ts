import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class ListAuditLogsDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  entityId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  cursor?: string;
}
