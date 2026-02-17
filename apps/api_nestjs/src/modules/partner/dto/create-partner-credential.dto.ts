import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength
} from 'class-validator';

export class CreatePartnerCredentialDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  scopes!: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  requestsPerMinute?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  dailyQuota?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requestSigningRequired?: boolean;
}
