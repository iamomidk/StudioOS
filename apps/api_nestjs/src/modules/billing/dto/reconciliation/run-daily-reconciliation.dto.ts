import { IsOptional, IsString, MinLength } from 'class-validator';

export class RunDailyReconciliationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  organizationId?: string;
}
