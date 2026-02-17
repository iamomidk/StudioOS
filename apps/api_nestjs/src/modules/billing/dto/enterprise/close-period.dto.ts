import { IsISO8601, IsString, MinLength } from 'class-validator';

export class CloseEnterpriseBillingPeriodDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsISO8601()
  periodStart!: string;

  @IsISO8601()
  periodEnd!: string;
}
