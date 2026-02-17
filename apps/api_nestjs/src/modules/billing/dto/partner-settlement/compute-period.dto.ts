import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ComputePartnerSettlementPeriodDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsOptional()
  basis?: 'gross' | 'net';
}
