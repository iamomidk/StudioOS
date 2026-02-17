import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRentalOrderDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  inventoryItemId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  clientId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  assignedUserId?: string;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;
}
