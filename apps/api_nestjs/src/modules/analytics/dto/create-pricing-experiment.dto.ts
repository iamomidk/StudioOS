import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';

class CreatePricingVariantDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  weight!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  pricingMultiplier?: number;
}

class CreateAllocationRuleDto {
  @IsIn(['all', 'organization', 'cohort'])
  targetType!: 'all' | 'organization' | 'cohort';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  targetValue?: string;
}

export class CreatePricingExperimentDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Date)
  startsAt?: Date;

  @IsOptional()
  @Type(() => Date)
  endsAt?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxExposure?: number;

  @IsOptional()
  @IsBoolean()
  killSwitchEnabled?: boolean;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreatePricingVariantDto)
  variants!: CreatePricingVariantDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateAllocationRuleDto)
  allocationRules!: CreateAllocationRuleDto[];
}
