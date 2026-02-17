import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const DISPUTE_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const SLA_CLASSES = ['standard', 'expedited', 'urgent'] as const;

export type DisputeSeverity = (typeof DISPUTE_SEVERITIES)[number];
export type DisputeSlaClass = (typeof SLA_CLASSES)[number];

export class OverrideDisputePolicyDto {
  @IsOptional()
  @IsIn(DISPUTE_SEVERITIES)
  severity?: DisputeSeverity;

  @IsOptional()
  @IsIn(SLA_CLASSES)
  slaClass?: DisputeSlaClass;

  @IsOptional()
  @IsString()
  @MinLength(1)
  assignedTeam?: string;

  @IsString()
  @MinLength(1)
  reason!: string;
}
