import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class EnterpriseBillingReportDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
