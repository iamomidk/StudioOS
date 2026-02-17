import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ListPartnerSettlementPeriodsDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsOptional()
  agreementId?: string;
}
