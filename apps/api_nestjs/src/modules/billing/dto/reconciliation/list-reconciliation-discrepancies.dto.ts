import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ReconciliationDiscrepancyStatus, ReconciliationDiscrepancyType } from '@prisma/client';

export class ListReconciliationDiscrepanciesDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  runId?: string;

  @IsOptional()
  @IsEnum(ReconciliationDiscrepancyType)
  type?: ReconciliationDiscrepancyType;

  @IsOptional()
  @IsEnum(ReconciliationDiscrepancyStatus)
  status?: ReconciliationDiscrepancyStatus;
}
