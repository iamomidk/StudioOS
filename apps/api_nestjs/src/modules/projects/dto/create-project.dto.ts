import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  clientId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  bookingId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  ownerUserId?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}
