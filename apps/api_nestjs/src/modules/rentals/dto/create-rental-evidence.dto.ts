import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength
} from 'class-validator';

export class CreateRentalEvidenceDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsUrl({ require_tld: false })
  photoUrl!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  note!: string;

  @IsISO8601()
  occurredAt!: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
