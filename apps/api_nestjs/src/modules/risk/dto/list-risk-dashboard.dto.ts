import { IsOptional, IsString, MinLength } from 'class-validator';

export class ListRiskDashboardDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  organizationId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  pilotCohortId?: string;
}
