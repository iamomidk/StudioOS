import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

class PriceComponentDto {
  @IsIn(['fixed', 'seat', 'usage'])
  componentType!: 'fixed' | 'seat' | 'usage';

  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsInt()
  unitPriceCents!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  includedUnits?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumUnits?: number;

  @IsOptional()
  tierJson?: Record<string, unknown>;
}

export class CreateEnterprisePlanDto {
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['monthly', 'annual'])
  billingCycle!: 'monthly' | 'annual';

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumCommitCents?: number;

  @IsISO8601()
  effectiveFrom!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceComponentDto)
  components!: PriceComponentDto[];
}
