import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class ModerationCaseDecisionDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  action!: 'allow' | 'warn' | 'throttle' | 'quarantine' | 'block' | 'escalate';

  @IsString()
  @IsOptional()
  note?: string;

  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  sanctionDays?: number;
}
