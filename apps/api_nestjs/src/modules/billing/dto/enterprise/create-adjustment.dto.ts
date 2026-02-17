import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBillingAdjustmentDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsInt()
  amountCents!: number;

  @IsString()
  @MinLength(1)
  reason!: string;
}
