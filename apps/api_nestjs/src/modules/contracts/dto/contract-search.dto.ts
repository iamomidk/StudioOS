import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

const contractStatuses = [
  'draft',
  'legal_review',
  'business_approval',
  'sent',
  'signed',
  'active',
  'declined',
  'expired'
] as const;

export class ContractSearchDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsIn(contractStatuses)
  @IsOptional()
  status?: (typeof contractStatuses)[number];

  @IsString()
  @IsOptional()
  contractType?: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  minValueCents?: number;

  @IsIn(['asc', 'desc'])
  @IsOptional()
  sort?: 'asc' | 'desc';
}
