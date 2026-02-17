import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const periodActions = ['review', 'approve', 'pay', 'reconcile', 'hold', 'release'] as const;

export class UpdatePartnerSettlementPeriodStatusDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsIn(periodActions)
  action!: (typeof periodActions)[number];

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  payoutReference?: string;
}
