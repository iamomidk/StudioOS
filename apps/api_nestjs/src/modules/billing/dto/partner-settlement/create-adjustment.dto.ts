import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePartnerSettlementAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsInt()
  amountCents!: number;

  @IsString()
  @IsNotEmpty()
  reasonCode!: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsBoolean()
  @IsOptional()
  carryForward?: boolean;
}
