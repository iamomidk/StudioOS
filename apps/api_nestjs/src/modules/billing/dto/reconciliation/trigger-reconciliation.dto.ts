import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class TriggerReconciliationDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
