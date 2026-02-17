import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength
} from 'class-validator';

const SSO_PROVIDERS = ['saml', 'oidc'] as const;

export class UpdateEnterpriseSettingsDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  ssoEnforced?: boolean;

  @IsOptional()
  @IsIn(SSO_PROVIDERS)
  ssoProvider?: (typeof SSO_PROVIDERS)[number];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  ssoDomains?: string[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enterpriseScimEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(60 * 24 * 30)
  sessionDurationMinutes?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  mfaEnforced?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  ipAllowlist?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays?: number;

  @IsString()
  @MinLength(5)
  reason!: string;
}
