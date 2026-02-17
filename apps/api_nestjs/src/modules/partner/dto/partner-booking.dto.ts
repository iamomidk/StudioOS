import { IsDateString, IsString, MinLength } from 'class-validator';

export class PartnerBookingCreateDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  clientId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}
