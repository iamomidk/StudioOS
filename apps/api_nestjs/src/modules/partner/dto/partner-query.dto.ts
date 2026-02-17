import { IsOptional, IsString, MinLength } from 'class-validator';

export class PartnerOrganizationQueryDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;
}

export class PartnerInventoryAvailabilityDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @IsString()
  category?: string;
}
