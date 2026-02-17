import { IsOptional, IsString, MinLength } from 'class-validator';

export class ResolveReconciliationDiscrepancyDto {
  @IsString()
  @MinLength(1)
  resolutionReason!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  note?: string;
}
