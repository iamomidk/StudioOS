import { IsOptional, IsString, MinLength } from 'class-validator';

export class AssignReconciliationDiscrepancyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  note?: string;
}
