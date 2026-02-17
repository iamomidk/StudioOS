import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ApproveBillingAdjustmentDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  note?: string;
}
