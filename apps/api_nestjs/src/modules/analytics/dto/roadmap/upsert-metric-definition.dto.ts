import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpsertStrategicMetricDefinitionDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsIn(['north_star', 'leading_indicator'])
  kind!: 'north_star' | 'leading_indicator';

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  metricKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  title!: string;

  @IsString()
  @IsNotEmpty()
  formula!: string;

  @IsString()
  @IsNotEmpty()
  owner!: string;

  @IsNumber()
  @Min(0)
  targetValue!: number;

  @IsString()
  @IsOptional()
  guardrail?: string;
}
