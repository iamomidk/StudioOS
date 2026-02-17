import { IsOptional, IsString, MinLength } from 'class-validator';

export class CancelEnterpriseSubscriptionDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
