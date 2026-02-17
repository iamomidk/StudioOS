import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class PartnerRentalCreateDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  inventoryItemId!: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}
