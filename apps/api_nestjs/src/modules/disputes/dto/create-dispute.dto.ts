import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';

const DISPUTE_TYPES = ['damage', 'late_return', 'payment', 'other'] as const;
const RISK_TIERS = ['low', 'medium', 'high'] as const;

export type DisputeType = (typeof DISPUTE_TYPES)[number];
export type DisputeRiskTier = (typeof RISK_TIERS)[number];

export class DisputeEvidenceDto {
  @IsOptional()
  @IsString()
  checkInPhotoUrl?: string;

  @IsOptional()
  @IsString()
  checkOutPhotoUrl?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsInt()
  @Min(-90)
  @Max(90)
  geotagLat?: number;

  @IsOptional()
  @IsInt()
  @Min(-180)
  @Max(180)
  geotagLng?: number;
}

export class CreateDisputeDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  entityType!: string;

  @IsString()
  @MinLength(1)
  entityId!: string;

  @IsString()
  @MinLength(1)
  reason!: string;

  @IsOptional()
  @IsIn(DISPUTE_TYPES)
  disputeType?: DisputeType;

  @IsOptional()
  @IsInt()
  @Min(0)
  rentalValueCents?: number;

  @IsOptional()
  @IsIn(RISK_TIERS)
  customerRiskTier?: DisputeRiskTier;

  @IsOptional()
  @IsIn(RISK_TIERS)
  providerRiskTier?: DisputeRiskTier;

  @IsOptional()
  @IsString()
  evidenceLink?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DisputeEvidenceDto)
  evidence?: DisputeEvidenceDto;
}
