import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePartnerSettlementPeriodDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  periodStart!: string;

  @IsString()
  @IsNotEmpty()
  periodEnd!: string;
}
