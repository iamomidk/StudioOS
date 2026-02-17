import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePartnerSettlementAgreementDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  partnerName!: string;

  @IsString()
  @IsOptional()
  partnerExternalRef?: string;

  @IsString()
  @IsNotEmpty()
  startsAt!: string;

  @IsString()
  @IsOptional()
  endsAt?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  minimumGuaranteeCents?: number;

  @IsInt()
  @Min(0)
  @Max(10000)
  shareBps!: number;

  @IsString()
  @IsOptional()
  productCategory?: string;
}
