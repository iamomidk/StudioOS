import { IsISO8601, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class IngestEnterpriseUsageDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  meterCode!: string;

  @IsInt()
  @Min(0)
  quantity!: number;

  @IsISO8601()
  usageAt!: string;

  @IsString()
  @MinLength(1)
  dedupKey!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  correctionOfId?: string;
}
